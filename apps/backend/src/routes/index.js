/**
 * Route Index
 * Combines all route modules
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const analysisRoutes = require('./analysisRoutes');
const uploadRoutes = require('./uploadRoutes');
const filesRoutes = require('./filesRoutes');
const specialDaysRoutes = require('./specialDays');

// Health check
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await require('../utils/prisma').$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// API info
router.get('/', (req, res) => {
  res.json({
    name: 'Seasonality SaaS API',
    version: '1.0.0',
    description: 'Comprehensive seasonality analysis API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      analysis: '/api/analysis',
      upload: '/api/upload',
      files: '/api/files',
      specialDays: '/api/special-days',
    },
    documentation: '/api/docs',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/analysis', analysisRoutes);
router.use('/upload', uploadRoutes);
router.use('/files', filesRoutes);
router.use('/special-days', specialDaysRoutes);

module.exports = router;
