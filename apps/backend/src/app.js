/**
 * Seasonality SaaS Backend API
 * Main Express Application
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const { logger, requestLogger } = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const prisma = require('./utils/prisma');

// Create Express app
const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
  app.use(requestLogger);
}

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// =====================================================
// ROUTES
// =====================================================

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Seasonality SaaS API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api',
  });
});

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server started`, {
        port: config.port,
        env: config.nodeEnv,
        pid: process.pid,
      });
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Seasonality SaaS API Server                          ║
║                                                           ║
║   Port: ${config.port}                                          ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║   API Docs: http://localhost:${config.port}/api                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        await prisma.$disconnect();
        logger.info('Database disconnected');
        
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;
