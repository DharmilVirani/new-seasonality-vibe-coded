/**
 * User Management Service
 * Admin user management, roles, and subscriptions
 */
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const { 
  ValidationError, 
  NotFoundError,
  AuthorizationError 
} = require('../utils/errors');

// Subscription tier limits
const TIER_LIMITS = {
  trial: {
    apiCallsPerHour: 100,
    apiCallsPerMonth: 1000,
    maxSymbols: 5,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election'],
  },
  basic: {
    apiCallsPerHour: 500,
    apiCallsPerMonth: 10000,
    maxSymbols: 50,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena'],
  },
  premium: {
    apiCallsPerHour: 2000,
    apiCallsPerMonth: 50000,
    maxSymbols: 200,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena', 'backtester'],
  },
  enterprise: {
    apiCallsPerHour: 10000,
    apiCallsPerMonth: 500000,
    maxSymbols: -1, // Unlimited
    features: ['*'], // All features
  },
};

// Role hierarchy
const ROLE_HIERARCHY = {
  admin: 4,
  research: 3,
  user: 2,
  trial: 1,
};

class UserService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(options = {}) {
    const { page = 1, limit = 20, role, subscriptionTier, isActive, search } = options;
    const skip = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (subscriptionTier) where.subscriptionTier = subscriptionTier;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          subscriptionTier: true,
          subscriptionExpiry: true,
          isActive: true,
          apiCallsToday: true,
          apiCallsThisMonth: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        subscriptionExpiry: true,
        isActive: true,
        apiCallsToday: true,
        apiCallsThisMonth: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        userPreferences: true,
        apiKeys: {
          select: {
            id: true,
            name: true,
            isActive: true,
            lastUsed: true,
            totalUsage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Create user (admin only)
   */
  async createUser(userData, createdBy) {
    const { email, name, password, role, subscriptionTier, subscriptionExpiry } = userData;

    // Validate role assignment
    if (role && !this.canAssignRole(createdBy.role, role)) {
      throw new AuthorizationError('Cannot assign this role');
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: role || 'user',
        subscriptionTier: subscriptionTier || 'trial',
        subscriptionExpiry: subscriptionExpiry ? new Date(subscriptionExpiry) : null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        subscriptionExpiry: true,
        createdAt: true,
      },
    });

    // Create default preferences
    await prisma.userPreferences.create({
      data: {
        userId: user.id,
        defaultSymbols: ['NIFTY', 'BANKNIFTY'],
        defaultFilters: {},
      },
    });

    // Log audit event
    await this.logAuditEvent('USER_CREATED', createdBy.id, {
      createdUserId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info(`User created by admin: ${user.email}`);

    return user;
  }

  /**
   * Update user (admin only)
   */
  async updateUser(userId, updates, updatedBy) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Validate role change
    if (updates.role && !this.canAssignRole(updatedBy.role, updates.role)) {
      throw new AuthorizationError('Cannot assign this role');
    }

    // Prevent self-demotion for admins
    if (userId === updatedBy.id && updates.role && updates.role !== 'admin') {
      throw new ValidationError('Cannot demote yourself');
    }

    const allowedUpdates = ['name', 'role', 'subscriptionTier', 'subscriptionExpiry', 'isActive'];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (key === 'subscriptionExpiry' && updates[key]) {
          filteredUpdates[key] = new Date(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: filteredUpdates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        subscriptionExpiry: true,
        isActive: true,
      },
    });

    // Log audit event
    await this.logAuditEvent('USER_UPDATED', updatedBy.id, {
      targetUserId: userId,
      changes: filteredUpdates,
    });

    logger.info(`User updated: ${userId} by ${updatedBy.id}`);

    return updatedUser;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole, updatedBy) {
    if (!this.canAssignRole(updatedBy.role, newRole)) {
      throw new AuthorizationError('Cannot assign this role');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    await this.logAuditEvent('ROLE_CHANGED', updatedBy.id, {
      targetUserId: userId,
      newRole,
    });

    return user;
  }

  /**
   * Manage subscription
   */
  async manageSubscription(userId, subscriptionData, updatedBy) {
    const { tier, expiryDate, extend } = subscriptionData;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    let newExpiry;
    if (extend && user.subscriptionExpiry) {
      // Extend from current expiry
      const currentExpiry = new Date(user.subscriptionExpiry);
      const extensionDays = this.getTierDuration(tier);
      newExpiry = new Date(currentExpiry.getTime() + extensionDays * 24 * 60 * 60 * 1000);
    } else if (expiryDate) {
      newExpiry = new Date(expiryDate);
    } else {
      // Default duration based on tier
      const durationDays = this.getTierDuration(tier);
      newExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        subscriptionExpiry: newExpiry,
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        subscriptionExpiry: true,
      },
    });

    await this.logAuditEvent('SUBSCRIPTION_CHANGED', updatedBy.id, {
      targetUserId: userId,
      newTier: tier,
      newExpiry,
    });

    logger.info(`Subscription updated for user ${userId}: ${tier} until ${newExpiry}`);

    return updatedUser;
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId, deactivatedBy) {
    if (userId === deactivatedBy.id) {
      throw new ValidationError('Cannot deactivate yourself');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    // Deactivate all API keys
    await prisma.apiKey.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    await this.logAuditEvent('USER_DEACTIVATED', deactivatedBy.id, {
      targetUserId: userId,
    });

    return user;
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId, reactivatedBy) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    await this.logAuditEvent('USER_REACTIVATED', reactivatedBy.id, {
      targetUserId: userId,
    });

    return user;
  }

  /**
   * Delete user (soft delete by deactivation)
   */
  async deleteUser(userId, deletedBy) {
    return this.deactivateUser(userId, deletedBy);
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    const [
      totalUsers,
      activeUsers,
      trialUsers,
      basicUsers,
      premiumUsers,
      enterpriseUsers,
      newUsersToday,
      newUsersThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { subscriptionTier: 'trial' } }),
      prisma.user.count({ where: { subscriptionTier: 'basic' } }),
      prisma.user.count({ where: { subscriptionTier: 'premium' } }),
      prisma.user.count({ where: { subscriptionTier: 'enterprise' } }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      byTier: {
        trial: trialUsers,
        basic: basicUsers,
        premium: premiumUsers,
        enterprise: enterpriseUsers,
      },
      newUsers: {
        today: newUsersToday,
        thisMonth: newUsersThisMonth,
      },
    };
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier) {
    return TIER_LIMITS[tier] || TIER_LIMITS.trial;
  }

  /**
   * Check if user has feature access
   */
  hasFeatureAccess(tier, feature) {
    const limits = TIER_LIMITS[tier];
    if (!limits) return false;
    if (limits.features.includes('*')) return true;
    return limits.features.includes(feature);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Check if user can assign a role
   */
  canAssignRole(assignerRole, targetRole) {
    const assignerLevel = ROLE_HIERARCHY[assignerRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
    return assignerLevel > targetLevel;
  }

  /**
   * Get default subscription duration in days
   */
  getTierDuration(tier) {
    const durations = {
      trial: 7,
      basic: 30,
      premium: 30,
      enterprise: 365,
    };
    return durations[tier] || 30;
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

module.exports = new UserService();
