/**
 * Permission Service
 * Role-Based Access Control (RBAC) System
 */
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const { AuthorizationError } = require('../utils/errors');

// Permission definitions
const PERMISSIONS = {
  // Analysis permissions
  'analysis:daily': { description: 'Access daily analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:weekly': { description: 'Access weekly analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:monthly': { description: 'Access monthly analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:yearly': { description: 'Access yearly analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:scenario': { description: 'Access scenario analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:election': { description: 'Access election analysis', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'analysis:scanner': { description: 'Access symbol scanner', tiers: ['basic', 'premium', 'enterprise'] },
  'analysis:backtester': { description: 'Access backtester', tiers: ['premium', 'enterprise'] },
  'analysis:phenomena': { description: 'Access phenomena detection', tiers: ['basic', 'premium', 'enterprise'] },
  'analysis:basket': { description: 'Access basket analysis', tiers: ['enterprise'] },
  
  // Data permissions
  'data:read': { description: 'Read market data', tiers: ['trial', 'basic', 'premium', 'enterprise'] },
  'data:export': { description: 'Export data to CSV', tiers: ['basic', 'premium', 'enterprise'] },
  'data:upload': { description: 'Upload CSV files', roles: ['admin', 'research'] },
  'data:manage': { description: 'Manage data records', roles: ['admin', 'research'] },
  
  // User permissions
  'users:read': { description: 'View user list', roles: ['admin'] },
  'users:create': { description: 'Create users', roles: ['admin'] },
  'users:update': { description: 'Update users', roles: ['admin'] },
  'users:delete': { description: 'Delete users', roles: ['admin'] },
  'users:manage-roles': { description: 'Manage user roles', roles: ['admin'] },
  'users:manage-subscriptions': { description: 'Manage subscriptions', roles: ['admin'] },
  
  // API permissions
  'api:access': { description: 'API access', tiers: ['basic', 'premium', 'enterprise'] },
  'api:unlimited': { description: 'Unlimited API calls', tiers: ['enterprise'] },
  
  // System permissions
  'system:logs': { description: 'View system logs', roles: ['admin'] },
  'system:config': { description: 'Manage system config', roles: ['admin'] },
  'system:monitoring': { description: 'Access monitoring', roles: ['admin', 'research'] },
};

// Role definitions with inherited permissions
const ROLES = {
  admin: {
    description: 'Full system access',
    permissions: ['*'], // All permissions
    inherits: [],
  },
  research: {
    description: 'Research team member',
    permissions: [
      'data:upload',
      'data:manage',
      'data:read',
      'data:export',
      'system:monitoring',
    ],
    inherits: ['user'],
  },
  user: {
    description: 'Regular user',
    permissions: [
      'data:read',
    ],
    inherits: [],
  },
  trial: {
    description: 'Trial user',
    permissions: [
      'data:read',
    ],
    inherits: [],
  },
};

// Feature access by subscription tier
const TIER_FEATURES = {
  trial: {
    maxSymbols: 5,
    maxApiCalls: 100,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election'],
    dataRetention: 30, // days
  },
  basic: {
    maxSymbols: 50,
    maxApiCalls: 500,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena'],
    dataRetention: 90,
  },
  premium: {
    maxSymbols: 200,
    maxApiCalls: 2000,
    features: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena', 'backtester'],
    dataRetention: 365,
  },
  enterprise: {
    maxSymbols: -1, // Unlimited
    maxApiCalls: 10000,
    features: ['*'], // All features
    dataRetention: -1, // Unlimited
  },
};

class PermissionService {
  /**
   * Check if user has a specific permission
   */
  hasPermission(user, permission) {
    if (!user) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // Check role-based permissions
    const rolePermissions = this.getRolePermissions(user.role);
    if (rolePermissions.includes('*') || rolePermissions.includes(permission)) {
      return true;
    }

    // Check tier-based permissions
    const permDef = PERMISSIONS[permission];
    if (permDef) {
      if (permDef.tiers && permDef.tiers.includes(user.subscriptionTier)) {
        return true;
      }
      if (permDef.roles && permDef.roles.includes(user.role)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has access to a feature
   */
  hasFeatureAccess(user, feature) {
    if (!user) return false;

    // Admin has all features
    if (user.role === 'admin') return true;

    const tierFeatures = TIER_FEATURES[user.subscriptionTier];
    if (!tierFeatures) return false;

    if (tierFeatures.features.includes('*')) return true;
    return tierFeatures.features.includes(feature);
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role) {
    const roleDef = ROLES[role];
    if (!roleDef) return [];

    let permissions = [...roleDef.permissions];

    // Add inherited permissions
    for (const inheritedRole of roleDef.inherits) {
      const inheritedPerms = this.getRolePermissions(inheritedRole);
      permissions = [...permissions, ...inheritedPerms];
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier) {
    return TIER_FEATURES[tier] || TIER_FEATURES.trial;
  }

  /**
   * Check if user is within symbol limit
   */
  isWithinSymbolLimit(user, symbolCount) {
    const limits = this.getTierLimits(user.subscriptionTier);
    if (limits.maxSymbols === -1) return true; // Unlimited
    return symbolCount <= limits.maxSymbols;
  }

  /**
   * Check if user is within API call limit
   */
  async isWithinApiLimit(user) {
    const limits = this.getTierLimits(user.subscriptionTier);
    
    // Get current usage
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { apiCallsToday: true },
    });

    if (!currentUser) return false;
    return currentUser.apiCallsToday < limits.maxApiCalls;
  }

  /**
   * Increment API call count
   */
  async incrementApiCalls(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        apiCallsToday: { increment: 1 },
        apiCallsThisMonth: { increment: 1 },
        lastApiCall: new Date(),
      },
    });
  }

  /**
   * Reset daily API calls (run via cron job)
   */
  async resetDailyApiCalls() {
    await prisma.user.updateMany({
      data: { apiCallsToday: 0 },
    });
    logger.info('Daily API call counts reset');
  }

  /**
   * Reset monthly API calls (run via cron job)
   */
  async resetMonthlyApiCalls() {
    await prisma.user.updateMany({
      data: { apiCallsThisMonth: 0 },
    });
    logger.info('Monthly API call counts reset');
  }

  /**
   * Get all available permissions
   */
  getAllPermissions() {
    return Object.entries(PERMISSIONS).map(([key, value]) => ({
      permission: key,
      ...value,
    }));
  }

  /**
   * Get all roles
   */
  getAllRoles() {
    return Object.entries(ROLES).map(([key, value]) => ({
      role: key,
      ...value,
    }));
  }

  /**
   * Get all tier features
   */
  getAllTierFeatures() {
    return Object.entries(TIER_FEATURES).map(([key, value]) => ({
      tier: key,
      ...value,
    }));
  }

  /**
   * Validate user can perform action
   */
  validateAccess(user, permission, feature = null) {
    if (!this.hasPermission(user, permission)) {
      throw new AuthorizationError(`Permission denied: ${permission}`);
    }

    if (feature && !this.hasFeatureAccess(user, feature)) {
      throw new AuthorizationError(`Feature not available in your subscription: ${feature}`);
    }

    return true;
  }

  /**
   * Get user's effective permissions
   */
  getUserPermissions(user) {
    if (!user) return [];

    const permissions = new Set();

    // Add role permissions
    const rolePerms = this.getRolePermissions(user.role);
    rolePerms.forEach(p => permissions.add(p));

    // Add tier-based permissions
    Object.entries(PERMISSIONS).forEach(([perm, def]) => {
      if (def.tiers && def.tiers.includes(user.subscriptionTier)) {
        permissions.add(perm);
      }
    });

    return Array.from(permissions);
  }

  /**
   * Get user's available features
   */
  getUserFeatures(user) {
    if (!user) return [];

    const tierFeatures = TIER_FEATURES[user.subscriptionTier];
    if (!tierFeatures) return [];

    if (tierFeatures.features.includes('*')) {
      return ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'backtester', 'phenomena', 'basket', 'charts'];
    }

    return tierFeatures.features;
  }
}

module.exports = new PermissionService();
