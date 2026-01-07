/**
 * Authentication Routes
 * User registration, login, and profile management
 */
const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { z } = require('zod');
const { logger } = require('../utils/logger');

// Validation schemas (flat - not nested in body)
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
});

// =====================================================
// PUBLIC ROUTES
// =====================================================

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.login(email, password, ipAddress, userAgent);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    const tokens = await AuthService.refreshToken(refreshToken);
    res.json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await AuthService.requestPasswordReset(email);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    const result = await AuthService.resetPassword(token, newPassword);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PROTECTED ROUTES
// =====================================================

/**
 * POST /auth/logout
 * Logout user
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await AuthService.logout(req.user.id, refreshToken);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const profile = await AuthService.getProfile(req.user.id);
    res.json({
      success: true,
      user: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await AuthService.updateProfile(req.user.id, req.body);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/permissions
 * Get current user's permissions and features
 */
router.get('/permissions', authenticateToken, async (req, res, next) => {
  try {
    const PermissionService = require('../services/PermissionService');
    
    const permissions = PermissionService.getUserPermissions(req.user);
    const features = PermissionService.getUserFeatures(req.user);
    const limits = PermissionService.getTierLimits(req.user.subscriptionTier);

    res.json({
      success: true,
      role: req.user.role,
      subscriptionTier: req.user.subscriptionTier,
      permissions,
      features,
      limits,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
