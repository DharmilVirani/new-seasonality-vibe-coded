/**
 * BullMQ Worker
 * Background job processor for CSV uploads and heavy computations
 * 
 * Uses the new processing pipeline from src/processing/
 */
require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const { redis } = require('../utils/redis');
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const config = require('../config');

// Import new processing pipeline
const {
  startWorkers: startProcessingWorkers,
  QUEUE_NAMES,
  addCSVProcessingJob,
  addDerivedFieldsJob,
  addCacheRefreshJob,
  addCleanupJob,
  addBatchAnalysisJob,
} = require('../processing');

// Legacy queue names for backward compatibility
const LEGACY_QUEUES = {
  CSV_PROCESSING: 'csv-processing',
  ANALYSIS_CACHE: 'analysis-cache',
  DATA_CLEANUP: 'data-cleanup',
};

// Create legacy queues for backward compatibility
const csvQueue = new Queue(LEGACY_QUEUES.CSV_PROCESSING, { connection: redis });
const cacheQueue = new Queue(LEGACY_QUEUES.ANALYSIS_CACHE, { connection: redis });
const cleanupQueue = new Queue(LEGACY_QUEUES.DATA_CLEANUP, { connection: redis });

/**
 * Start all workers
 * Uses the new processing pipeline workers
 */
function startAllWorkers() {
  logger.info('Starting background workers...');
  
  // Start new processing pipeline workers
  const processingWorkers = startProcessingWorkers();
  
  logger.info('All workers started', {
    processingWorkers: processingWorkers.length,
    queues: Object.values(QUEUE_NAMES),
  });
  
  return processingWorkers;
}

// Start workers if running as main process
if (require.main === module) {
  const workers = startAllWorkers();
  
  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    
    for (const worker of workers) {
      await worker.close();
    }
    
    await prisma.$disconnect();
    
    logger.info('Workers shut down');
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Export for use in routes
module.exports = {
  // Legacy queues (backward compatibility)
  csvQueue,
  cacheQueue,
  cleanupQueue,
  QUEUES: LEGACY_QUEUES,
  
  // New processing pipeline
  QUEUE_NAMES,
  startAllWorkers,
  
  // Job scheduling helpers
  addCSVProcessingJob,
  addDerivedFieldsJob,
  addCacheRefreshJob,
  addCleanupJob,
  addBatchAnalysisJob,
};
