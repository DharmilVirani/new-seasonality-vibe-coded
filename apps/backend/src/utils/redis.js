/**
 * Redis Client Configuration
 * Used for caching and BullMQ job queues
 */
const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('./logger');

// Create Redis connection
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

// Cache helper functions
const cache = {
  async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Cache get error', { key, error: err.message });
      return null;
    }
  },

  async set(key, value, expireSeconds = 3600) {
    try {
      await redis.setex(key, expireSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Cache set error', { key, error: err.message });
      return false;
    }
  },

  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (err) {
      logger.error('Cache delete error', { key, error: err.message });
      return false;
    }
  },

  async delPattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (err) {
      logger.error('Cache delete pattern error', { pattern, error: err.message });
      return false;
    }
  },
};

module.exports = { redis, cache };
