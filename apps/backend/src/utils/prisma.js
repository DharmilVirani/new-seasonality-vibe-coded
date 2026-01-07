/**
 * Prisma Client Singleton
 * Ensures single database connection instance
 */
const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log slow queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    if (e.duration > 100) {
      logger.warn('Slow query detected', {
        query: e.query,
        duration: `${e.duration}ms`,
      });
    }
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma error', { error: e.message });
});

module.exports = prisma;
