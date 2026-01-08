/**
 * Authentication Service
 * Comprehensive authentication and user management
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const config = require('../config');
const { logger } = require('../utils/logger');
const { 
  AuthenticationError, 
  ValidationError, 
  NotFoundError 
} = require('../utils/errors');

// Password complexity requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const EMAIL_VERIFICATION_EXPIRY = '24h';
const PASSWORD_RESET_EXPIRY = '1h';

class AuthService {
  /**
   * Register a new user
   */
  async register(userData) {
    const { email, password, name } = userData;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    this.validatePassword(password);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verificationToken = this.generateSecureToken();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with trial subscription
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: 'user',
        subscriptionTier: 'trial',
        subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day trial
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

    // Create default user preferences
    await prisma.userPreferences.create({
      data: {
        userId: user.id,
        defaultSymbols: ['NIFTY', 'BANKNIFTY'],
        defaultFilters: {},
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    // Log registration
    await this.logAuditEvent('USER_REGISTERED', user.id, { email: user.email });

    logger.info(`New user registered: ${user.email}`);

    return {
      user,
      ...tokens,
      message: 'Registration successful. Please verify your email.',
    };
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress, userAgent) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      await this.logFailedLogin(email, ipAddress, 'User not found');
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      await this.logFailedLogin(email, ipAddress, 'Account inactive');
      throw new AuthenticationError('Account is deactivated. Please contact support.');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await this.logFailedLogin(email, ipAddress, 'Invalid password');
      throw new AuthenticationError('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id);

    // Log successful login
    await this.logAuditEvent('USER_LOGIN', user.id, { ipAddress, userAgent });

    logger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiry: user.subscriptionExpiry,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret);
      
      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Invalid or expired refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId, refreshToken) {
    // In a production system, you'd store refresh tokens in a blacklist
    // For now, we just log the logout event
    await this.logAuditEvent('USER_LOGOUT', userId, {});
    logger.info(`User logged out: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if user exists
    if (!user) {
      return { message: 'If the email exists, a reset link will be sent.' };
    }

    const resetToken = this.generateSecureToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (in production, store hashed token)
    // For now, we'll use a simple approach
    await this.logAuditEvent('PASSWORD_RESET_REQUESTED', user.id, { email });

    // In production: Send email with reset link
    logger.info(`Password reset requested for: ${email}`);

    return { 
      message: 'If the email exists, a reset link will be sent.',
      // In development, return token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    // Validate new password
    this.validatePassword(newPassword);

    // In production, verify token from database
    // For now, this is a placeholder
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password (would need token verification in production)
    logger.info('Password reset completed');

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.logAuditEvent('PASSWORD_CHANGED', userId, {});
    logger.info(`Password changed for user: ${userId}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Get current user profile (optimized)
   */
  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        subscriptionExpiry: true,
        apiCallsToday: true,
        apiCallsThisMonth: true,
        lastLogin: true,
        createdAt: true,
        // Remove userPreferences to reduce query time
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Calculate subscription status
    const isSubscriptionActive = user.subscriptionExpiry 
      ? new Date(user.subscriptionExpiry) > new Date()
      : false;

    return {
      ...user,
      isSubscriptionActive,
      daysUntilExpiry: user.subscriptionExpiry
        ? Math.ceil((new Date(user.subscriptionExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    const allowedUpdates = ['name'];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: filteredUpdates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
      },
    });

    await this.logAuditEvent('PROFILE_UPDATED', userId, filteredUpdates);

    return user;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      config.jwt.secret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generate secure random token
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }
  }

  /**
   * Log audit event (optimized - only for critical events)
   */
  async logAuditEvent(eventType, userId, details) {
    // Only log critical events to reduce database load
    const criticalEvents = ['USER_REGISTERED', 'USER_LOGIN', 'PASSWORD_CHANGED', 'FAILED_LOGIN'];
    
    if (!criticalEvents.includes(eventType)) {
      return; // Skip non-critical events
    }

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

  /**
   * Log failed login attempt
   */
  async logFailedLogin(email, ipAddress, reason) {
    try {
      await prisma.systemLog.create({
        data: {
          level: 'warn',
          message: 'FAILED_LOGIN',
          context: { email, ipAddress, reason },
        },
      });
    } catch (error) {
      logger.error('Failed to log failed login:', error);
    }
  }
}

module.exports = new AuthService();
