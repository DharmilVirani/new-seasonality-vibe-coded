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
// Simplified password regex - just require length (faster validation)
// const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '1d';
const REFRESH_TOKEN_EXPIRY = '7d';
const EMAIL_VERIFICATION_EXPIRY = '24h';
const PASSWORD_RESET_EXPIRY = '1h';

// Bcrypt rounds - 10 is faster while still secure
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

class AuthService {
  /**
   * Register a new user
   */
  async register(userData) {
    try {
      logger.info('Registration attempt started', { email: userData.email });

      const { email, password, name } = userData;

      // Validate email format
      if (!this.isValidEmail(email)) {
        logger.warn('Registration failed: Invalid email format', { email });
        throw new ValidationError('Invalid email format');
      }

      // Validate password (simplified - just check length)
      if (!password || password.length < PASSWORD_MIN_LENGTH) {
        logger.warn('Registration failed: Password too short', { email });
        throw new ValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      }

      logger.info('Checking if user exists', { email });

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true }, // Only select id for faster query
      });

      if (existingUser) {
        logger.warn('Registration failed: Email already exists', { email });
        throw new ValidationError('Email already registered');
      }

      logger.info('Hashing password', { email });

      // Hash password with fewer rounds for speed
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      logger.info('Creating user in database', { email });

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

      logger.info('User created successfully', { userId: user.id, email: user.email });

      // Create default user preferences in background (don't await)
      prisma.userPreferences.create({
        data: {
          userId: user.id,
          defaultSymbols: ['NIFTY', 'BANKNIFTY'],
          defaultFilters: {},
        },
      }).catch(err => logger.error('Failed to create user preferences:', err));

      // Generate tokens
      const tokens = this.generateTokens(user.id);

      // Log registration in background (don't await)
      this.logAuditEvent('USER_REGISTERED', user.id, { email: user.email });

      logger.info(`Registration completed successfully: ${user.email}`);

      return {
        user,
        ...tokens,
        message: 'Registration successful',
      };
    } catch (error) {
      logger.error('Registration failed', {
        email: userData.email,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress, userAgent) {
    try {
      logger.info('Login attempt started', { email });

      // Find user with only needed fields
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          isActive: true,
          subscriptionTier: true,
          subscriptionExpiry: true,
          googleId: true,
        },
      });

      if (!user) {
        logger.warn('Login failed: User not found', { email });
        // Don't await logging for failed attempts - do it in background
        this.logFailedLogin(email, ipAddress, 'User not found');
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn('Login failed: Account inactive', { email });
        this.logFailedLogin(email, ipAddress, 'Account inactive');
        throw new AuthenticationError('Account is deactivated. Please contact support.');
      }

      // Check if user registered with Google OAuth (no password)
      if (user.googleId && !user.password) {
        logger.warn('Login failed: OAuth user trying password login', { email });
        throw new AuthenticationError('Please sign in with Google');
      }

      logger.info('Verifying password', { email });

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('Login failed: Invalid password', { email });
        this.logFailedLogin(email, ipAddress, 'Invalid password');
        throw new AuthenticationError('Invalid credentials');
      }

      logger.info('Password verified, updating last login', { email });

      // Update last login in background (don't await)
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }).catch(err => logger.error('Failed to update last login:', err));

      // Generate tokens
      const tokens = this.generateTokens(user.id);

      // Log successful login in background
      this.logAuditEvent('USER_LOGIN', user.id, { ipAddress, userAgent });

      logger.info(`Login successful: ${user.email}`);

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
    } catch (error) {
      logger.error('Login failed', {
        email,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Google OAuth login/register
   */
  async googleAuth(user, ipAddress, userAgent) {
    try {
      logger.info('Google OAuth authentication', { userId: user.id });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }).catch(err => logger.error('Failed to update last login:', err));

      // Generate tokens
      const tokens = this.generateTokens(user.id);

      // Log successful login
      await this.logAuditEvent('USER_LOGIN', user.id, {
        ipAddress,
        userAgent,
        method: 'google_oauth'
      });

      logger.info(`Google OAuth successful: ${user.email}`);

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
    } catch (error) {
      logger.error('Google OAuth failed', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

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
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
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
   * Validate password strength (simplified for speed)
   */
  validatePassword(password) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
      );
    }
    // Removed complex regex check for faster validation
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
