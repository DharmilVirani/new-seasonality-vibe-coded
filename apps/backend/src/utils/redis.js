/**
 * Redis Client Configuration
 * Used for caching and BullMQ job queues
 */
const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('./logger');

// Log Redis configuration for debugging
logger.info('Redis configuration', {
  host: config.redis.host,
  port: config.redis.port,
  hasPassword: !!config.redis.password,
});

// Create Redis connection
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis connection failed after 10 retries');
      return null;
    }
    const delay = Math.min(times * 500, 5000);
    logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected', { host: config.redis.host, port: config.redis.port });
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message, host: config.redis.host });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
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
