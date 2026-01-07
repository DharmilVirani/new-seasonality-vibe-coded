/**
 * API Key Management Service
 * Generate, validate, and manage API keys
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const { 
  ValidationError, 
  NotFoundError,
  AuthorizationError 
} = require('../utils/errors');

// API Key prefix for identification
const API_KEY_PREFIX = 'sk_';
const API_KEY_LENGTH = 32;

// Default permissions by tier
const DEFAULT_PERMISSIONS = {
  trial: ['read:analysis'],
  basic: ['read:analysis', 'read:scanner'],
  premium: ['read:analysis', 'read:scanner', 'read:backtest', 'write:analysis'],
  enterprise: ['*'],
};

// Rate limits by tier (requests per hour)
const RATE_LIMITS = {
  trial: 100,
  basic: 500,
  premium: 2000,
  enterprise: 10000,
};

class APIKeyService {
  /**
   * Generate a new API key
   */
  async generateAPIKey(userId, options = {}) {
    const { name, permissions, rateLimit, expiresAt } = options;

    // Get user to determine default permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.isActive) {
      throw new AuthorizationError('User account is inactive');
    }

    // Check API key limit (max 5 per user)
    const existingKeys = await prisma.apiKey.count({
      where: { userId, isActive: true },
    });

    if (existingKeys >= 5) {
      throw new ValidationError('Maximum API key limit reached (5 keys)');
    }

    // Generate secure API key
    const rawKey = this.generateRawKey();
    const keyHash = await bcrypt.hash(rawKey, 10);

    // Determine permissions
    const keyPermissions = permissions || DEFAULT_PERMISSIONS[user.subscriptionTier] || [];
    const keyRateLimit = rateLimit || RATE_LIMITS[user.subscriptionTier] || 100;

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        name: name || `API Key ${existingKeys + 1}`,
        userId,
        permissions: keyPermissions,
        rateLimit: keyRateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Log creation
    await this.logAuditEvent('API_KEY_CREATED', userId, {
      keyId: apiKey.id,
      name: apiKey.name,
    });

    logger.info(`API key created for user ${userId}: ${apiKey.name}`);

    // Return the raw key only once (it won't be retrievable later)
    return {
      ...apiKey,
      key: rawKey,
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  /**
   * Validate API key and return user
   */
  async validateAPIKey(rawKey) {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    // Find all active API keys and check against hash
    const apiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            subscriptionTier: true,
            subscriptionExpiry: true,
            isActive: true,
          },
        },
      },
    });

    for (const apiKey of apiKeys) {
      const isMatch = await bcrypt.compare(rawKey, apiKey.keyHash);
      if (isMatch) {
        // Check expiry
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
          return null;
        }

        // Check user status
        if (!apiKey.user.isActive) {
          return null;
        }

        // Update usage statistics
        await this.updateUsage(apiKey.id);

        return {
          apiKey,
          user: apiKey.user,
        };
      }
    }

    return null;
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(apiKeyId) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: {
        rateLimit: true,
        usageToday: true,
        lastUsed: true,
      },
    });

    if (!apiKey) {
      return { allowed: false, reason: 'API key not found' };
    }

    // Reset daily usage if it's a new day
    const lastUsedDate = apiKey.lastUsed ? new Date(apiKey.lastUsed).toDateString() : null;
    const today = new Date().toDateString();

    if (lastUsedDate !== today) {
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { usageToday: 0 },
      });
      return { allowed: true, remaining: apiKey.rateLimit };
    }

    // Check if under limit
    const remaining = apiKey.rateLimit - apiKey.usageToday;
    if (remaining <= 0) {
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)),
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Get all API keys for a user
   */
  async getUserAPIKeys(userId) {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        usageToday: true,
        totalUsage: true,
        lastUsed: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(key => ({
      ...key,
      keyPreview: `${API_KEY_PREFIX}...${key.id.toString().slice(-4)}`,
    }));
  }

  /**
   * Get API key by ID
   */
  async getAPIKeyById(keyId, userId) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        usageToday: true,
        totalUsage: true,
        lastUsed: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    return apiKey;
  }

  /**
   * Update API key
   */
  async updateAPIKey(keyId, userId, updates) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    const allowedUpdates = ['name', 'permissions', 'rateLimit', 'expiresAt', 'isActive'];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (key === 'expiresAt' && updates[key]) {
          filteredUpdates[key] = new Date(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: filteredUpdates,
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
      },
    });

    await this.logAuditEvent('API_KEY_UPDATED', userId, {
      keyId,
      changes: filteredUpdates,
    });

    return updatedKey;
  }

  /**
   * Revoke (deactivate) API key
   */
  async revokeAPIKey(keyId, userId) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    await this.logAuditEvent('API_KEY_REVOKED', userId, { keyId });

    logger.info(`API key revoked: ${keyId}`);

    return { message: 'API key revoked successfully' };
  }

  /**
   * Delete API key permanently
   */
  async deleteAPIKey(keyId, userId) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    await prisma.apiKey.delete({
      where: { id: keyId },
    });

    await this.logAuditEvent('API_KEY_DELETED', userId, { keyId });

    return { message: 'API key deleted successfully' };
  }

  /**
   * Regenerate API key (creates new key, deactivates old)
   */
  async regenerateAPIKey(keyId, userId) {
    const oldKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!oldKey) {
      throw new NotFoundError('API key not found');
    }

    // Deactivate old key
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    // Generate new key with same settings
    const newKey = await this.generateAPIKey(userId, {
      name: oldKey.name,
      permissions: oldKey.permissions,
      rateLimit: oldKey.rateLimit,
      expiresAt: oldKey.expiresAt,
    });

    await this.logAuditEvent('API_KEY_REGENERATED', userId, {
      oldKeyId: keyId,
      newKeyId: newKey.id,
    });

    return newKey;
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStatistics(keyId, userId) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
      select: {
        id: true,
        name: true,
        usageToday: true,
        totalUsage: true,
        rateLimit: true,
        lastUsed: true,
        createdAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    const daysActive = Math.ceil(
      (new Date() - new Date(apiKey.createdAt)) / (1000 * 60 * 60 * 24)
    );

    return {
      ...apiKey,
      averageUsagePerDay: daysActive > 0 ? Math.round(apiKey.totalUsage / daysActive) : 0,
      usagePercentageToday: Math.round((apiKey.usageToday / apiKey.rateLimit) * 100),
      daysActive,
    };
  }

  /**
   * Check if API key has permission
   */
  hasPermission(apiKey, requiredPermission) {
    const permissions = apiKey.permissions || [];
    if (permissions.includes('*')) return true;
    return permissions.includes(requiredPermission);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Generate raw API key
   */
  generateRawKey() {
    const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
    return `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;
  }

  /**
   * Update API key usage
   */
  async updateUsage(keyId) {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        usageToday: { increment: 1 },
        totalUsage: { increment: 1 },
        lastUsed: new Date(),
      },
    });
  }

  /**
   * Log audit event
   */
  async logAuditEvent(eventType, userId, details) {
    try {
      await prisma.systemLog.create({
        data: {
          level: 'info',
          message: eventType,
          userId,
          context: details,
        },
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }
}

module.exports = new APIKeyService();
