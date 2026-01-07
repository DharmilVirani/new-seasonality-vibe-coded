/**
 * Rate Limiting Middleware
 * Per-user rate limiting based on subscription tier
 */
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { RateLimitError } = require('../utils/errors');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

/**
 * Custom rate limit store using Redis
 */
class RedisStore {
  constructor() {
    this.prefix = 'rl:';
  }

  async increment(key) {
    const redisKey = this.prefix + key;
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, 3600); // 1 hour window
    }
    return {
      totalHits: current,
      resetTime: new Date(Date.now() + 3600000),
    };
  }

  async decrement(key) {
    const redisKey = this.prefix + key;
    await redis.decr(redisKey);
  }

  async resetKey(key) {
    const redisKey = this.prefix + key;
    await redis.del(redisKey);
  }
}

/**
 * Get rate limit based on user's subscription tier
 */
const getRateLimitForTier = (tier) => {
  return config.rateLimits[tier] || config.rateLimits.trial;
};

/**
 * Dynamic rate limiter based on subscription
 */
const dynamicRateLimiter = (req, res, next) => {
  const tier = req.user?.subscriptionTier || 'trial';
  const limits = getRateLimitForTier(tier);

  const limiter = rateLimit({
    windowMs: limits.windowMs,
    max: limits.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id?.toString() || req.ip;
    },
    handler: (req, res, next) => {
      logger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        tier,
      });
      next(new RateLimitError(`Rate limit exceeded. Upgrade to ${tier === 'trial' ? 'basic' : 'premium'} for higher limits.`));
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    },
  });

  return limiter(req, res, next);
};

/**
 * Strict rate limiter for sensitive endpoints (login, register)
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res, next) => {
    logger.warn('Strict rate limit exceeded', { ip: req.ip });
    next(new RateLimitError('Too many attempts. Please try again later.'));
  },
});

/**
 * API endpoint rate limiter
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  handler: (req, res, next) => {
    next(new RateLimitError('Too many requests. Please slow down.'));
  },
});

module.exports = {
  dynamicRateLimiter,
  strictRateLimiter,
  apiRateLimiter,
  getRateLimitForTier,
};
