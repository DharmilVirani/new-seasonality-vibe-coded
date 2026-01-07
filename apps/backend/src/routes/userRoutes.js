/**
 * User Management Routes
 * Admin user management, roles, and subscriptions
 */
const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const APIKeyService = require('../services/APIKeyService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { z } = require('zod');

// Validation schemas (flat - not nested in body)
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(['admin', 'user', 'research', 'trial']).optional(),
  subscriptionTier: z.enum(['trial', 'basic', 'premium', 'enterprise']).optional(),
  subscriptionExpiry: z.string().datetime().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['admin', 'user', 'research', 'trial']).optional(),
  subscriptionTier: z.enum(['trial', 'basic', 'premium', 'enterprise']).optional(),
  subscriptionExpiry: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

const subscriptionSchema = z.object({
  tier: z.enum(['trial', 'basic', 'premium', 'enterprise']),
  expiryDate: z.string().datetime().optional(),
  extend: z.boolean().optional(),
});

const apiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Apply authentication to all routes
router.use(authenticateToken);

// =====================================================
// USER MANAGEMENT (Admin only)
// =====================================================

/**
 * GET /users
 * Get all users (admin only)
 */
router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { page, limit, role, subscriptionTier, isActive, search } = req.query;
    
    const result = await UserService.getAllUsers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      role,
      subscriptionTier,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/statistics
 * Get user statistics (admin only)
 */
router.get('/statistics', requireRole('admin'), async (req, res, next) => {
  try {
    const statistics = await UserService.getUserStatistics();
    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/:id
 * Get user by ID (admin only)
 */
router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const user = await UserService.getUserById(parseInt(req.params.id));
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users
 * Create new user (admin only)
 */
router.post('/', requireRole('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await UserService.createUser(req.body, req.user);
    res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id
 * Update user (admin only)
 */
router.put('/:id', requireRole('admin'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const user = await UserService.updateUser(parseInt(req.params.id), req.body, req.user);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id/role
 * Update user role (admin only)
 */
router.put('/:id/role', requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await UserService.updateUserRole(parseInt(req.params.id), role, req.user);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id/subscription
 * Manage user subscription (admin only)
 */
router.put('/:id/subscription', requireRole('admin'), validate(subscriptionSchema), async (req, res, next) => {
  try {
    const user = await UserService.manageSubscription(parseInt(req.params.id), req.body, req.user);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/:id/deactivate
 * Deactivate user (admin only)
 */
router.post('/:id/deactivate', requireRole('admin'), async (req, res, next) => {
  try {
    const user = await UserService.deactivateUser(parseInt(req.params.id), req.user);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/:id/reactivate
 * Reactivate user (admin only)
 */
router.post('/:id/reactivate', requireRole('admin'), async (req, res, next) => {
  try {
    const user = await UserService.reactivateUser(parseInt(req.params.id), req.user);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/:id
 * Delete user (admin only)
 */
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await UserService.deleteUser(parseInt(req.params.id), req.user);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// API KEY MANAGEMENT (User's own keys)
// =====================================================

/**
 * GET /users/me/api-keys
 * Get current user's API keys
 */
router.get('/me/api-keys', async (req, res, next) => {
  try {
    const apiKeys = await APIKeyService.getUserAPIKeys(req.user.id);
    res.json({
      success: true,
      apiKeys,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/me/api-keys
 * Generate new API key for current user
 */
router.post('/me/api-keys', validate(apiKeySchema), async (req, res, next) => {
  try {
    const apiKey = await APIKeyService.generateAPIKey(req.user.id, req.body);
    res.status(201).json({
      success: true,
      apiKey,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/me/api-keys/:keyId
 * Get specific API key
 */
router.get('/me/api-keys/:keyId', async (req, res, next) => {
  try {
    const apiKey = await APIKeyService.getAPIKeyById(parseInt(req.params.keyId), req.user.id);
    res.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/me/api-keys/:keyId/usage
 * Get API key usage statistics
 */
router.get('/me/api-keys/:keyId/usage', async (req, res, next) => {
  try {
    const usage = await APIKeyService.getUsageStatistics(parseInt(req.params.keyId), req.user.id);
    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/me/api-keys/:keyId
 * Update API key
 */
router.put('/me/api-keys/:keyId', validate(apiKeySchema), async (req, res, next) => {
  try {
    const apiKey = await APIKeyService.updateAPIKey(parseInt(req.params.keyId), req.user.id, req.body);
    res.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/me/api-keys/:keyId/regenerate
 * Regenerate API key
 */
router.post('/me/api-keys/:keyId/regenerate', async (req, res, next) => {
  try {
    const apiKey = await APIKeyService.regenerateAPIKey(parseInt(req.params.keyId), req.user.id);
    res.json({
      success: true,
      apiKey,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/me/api-keys/:keyId/revoke
 * Revoke API key
 */
router.post('/me/api-keys/:keyId/revoke', async (req, res, next) => {
  try {
    const result = await APIKeyService.revokeAPIKey(parseInt(req.params.keyId), req.user.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/me/api-keys/:keyId
 * Delete API key
 */
router.delete('/me/api-keys/:keyId', async (req, res, next) => {
  try {
    const result = await APIKeyService.deleteAPIKey(parseInt(req.params.keyId), req.user.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
