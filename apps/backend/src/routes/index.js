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

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
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
    },
    documentation: '/api/docs',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/analysis', analysisRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;
