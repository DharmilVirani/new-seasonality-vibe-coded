/**
 * Application Configuration
 * Centralized configuration management
 */
require('dotenv').config();

module.exports = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  // MinIO - dual endpoint config
  minio: {
    // Internal endpoint for Docker network (worker/backend to MinIO)
    internalEndpoint: process.env.MINIO_INTERNAL_ENDPOINT || process.env.MINIO_ENDPOINT || 'minio',
    // External endpoint for browser access (presigned URLs)
    endpoint: process.env.MINIO_ENDPOINT || '192.168.4.30',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'admin12345',
    bucket: process.env.MINIO_BUCKET || 'seasonality-uploads',
    useSSL: process.env.MINIO_USE_SSL === 'true',
  },
  
  // Rate Limiting (per subscription tier)
  rateLimits: {
    trial: { windowMs: 60 * 60 * 1000, max: 100 },      // 100 requests/hour
    basic: { windowMs: 60 * 60 * 1000, max: 500 },      // 500 requests/hour
    premium: { windowMs: 60 * 60 * 1000, max: 2000 },   // 2000 requests/hour
    enterprise: { windowMs: 60 * 60 * 1000, max: 10000 }, // 10000 requests/hour
  },
  
  // Analysis defaults
  analysis: {
    maxSymbols: 50,           // Max symbols per request
    maxDateRange: 365 * 20,   // Max 20 years of data
    defaultDateRange: 365 * 5, // Default 5 years
    cacheExpiry: 60 * 60,     // 1 hour cache
  },
  
  // Pagination
  pagination: {
    defaultLimit: 100,
    maxLimit: 1000,
  },
};
