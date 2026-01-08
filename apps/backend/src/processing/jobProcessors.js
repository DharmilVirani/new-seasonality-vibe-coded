/**
 * Background Job Processors
 * BullMQ job handlers for heavy processing tasks
 */

const { Queue, Worker } = require('bullmq');
const Minio = require('minio');
const prisma = require('../utils/prisma');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');
const config = require('../config');
const { CSVProcessor } = require('./csvProcessor');
const { calculateAllDerivedFields } = require('./calculations');

// Initialize MinIO client - use INTERNAL endpoint for worker
const minioClient = new Minio.Client({
  endPoint: config.minio.internalEndpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

// Queue names
const QUEUE_NAMES = {
  CSV_PROCESSING: 'csv-processing',
  DERIVED_FIELDS: 'derived-fields',
  DATA_AGGREGATION: 'data-aggregation',
  CACHE_REFRESH: 'cache-refresh',
  DATA_CLEANUP: 'data-cleanup',
  BATCH_ANALYSIS: 'batch-analysis',
};

// Create queues
const queues = {};
for (const [key, name] of Object.entries(QUEUE_NAMES)) {
  queues[key] = new Queue(name, { connection: redis });
}

// =====================================================
// JOB PROCESSORS
// =====================================================

/**
 * Process CSV file from MinIO
 */
async function processCSVJob(job) {
  const { batchId, fileId, objectKey, options = {} } = job.data;
  
  logger.info('Starting CSV processing job', { jobId: job.id, fileId, objectKey });

  try {
    // Update file status
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: 'PROCESSING' },
    });

    // Download file from MinIO
    const stream = await minioClient.getObject(config.minio.bucket, objectKey);
    const chunks = [];
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const fileBuffer = Buffer.concat(chunks);
    const fileName = objectKey.split('/').pop();

    // Process CSV
    const processor = new CSVProcessor({
      batchSize: options.batchSize || 1000,
      calculateDerived: options.calculateDerived !== false,
    });

    const result = await processor.processUploadedFile(fileBuffer, fileName, {
      ...options,
      generateCalculatedData: true // Enable calculated data storage in DB
    });

    // Update progress
    await job.updateProgress(100);

    // Update file status
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        recordsProcessed: result.stats.insertedRows + result.stats.updatedRows,
        recordsSkipped: result.stats.skippedRows,
        recordsFailed: result.stats.errors.length,
        errorMessage: result.success ? null : result.error,
        errorDetails: result.stats.errors.length > 0 ? result.stats.errors : null,
        processedAt: new Date(),
      },
    });

    // Update batch progress
    await updateBatchProgress(batchId);

    logger.info('CSV processing job completed', { 
      jobId: job.id, 
      fileId,
      processed: result.stats.processedRows,
    });

    return result;

  } catch (error) {
    logger.error('CSV processing job failed', { jobId: job.id, fileId, error: error.message });

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        processedAt: new Date(),
      },
    });

    await updateBatchProgress(batchId);

    throw error;
  }
}

/**
 * Calculate derived fields for a symbol
 */
async function calculateDerivedFieldsJob(job) {
  const { tickerId, symbol, forceRecalculate = false } = job.data;

  logger.info('Starting derived fields calculation', { jobId: job.id, tickerId, symbol });

  try {
    // Fetch raw data
    const rawData = await prisma.seasonalityData.findMany({
      where: { tickerId },
      orderBy: { date: 'asc' },
    });

    if (rawData.length === 0) {
      logger.warn('No data found for ticker', { tickerId });
      return { success: false, message: 'No data found' };
    }

    // Calculate all derived fields
    const calculated = calculateAllDerivedFields(rawData);

    // Update progress
    await job.updateProgress(50);

    // Store calculated data (this would go to Phase 2 tables)
    // For now, we'll just return the calculated data
    
    logger.info('Derived fields calculation completed', {
      jobId: job.id,
      tickerId,
      dailyRecords: calculated.daily.length,
      weeklyRecords: calculated.mondayWeekly.length + calculated.expiryWeekly.length,
      monthlyRecords: calculated.monthly.length,
      yearlyRecords: calculated.yearly.length,
    });

    await job.updateProgress(100);

    return {
      success: true,
      tickerId,
      symbol,
      counts: {
        daily: calculated.daily.length,
        mondayWeekly: calculated.mondayWeekly.length,
        expiryWeekly: calculated.expiryWeekly.length,
        monthly: calculated.monthly.length,
        yearly: calculated.yearly.length,
      },
    };

  } catch (error) {
    logger.error('Derived fields calculation failed', { jobId: job.id, tickerId, error: error.message });
    throw error;
  }
}

/**
 * Aggregate data for analysis caching
 */
async function aggregateDataJob(job) {
  const { tickerId, symbol, timeframe, aggregationType } = job.data;

  logger.info('Starting data aggregation', { jobId: job.id, tickerId, timeframe });

  try {
    // Fetch data
    const data = await prisma.seasonalityData.findMany({
      where: { tickerId },
      orderBy: { date: 'asc' },
    });

    if (data.length === 0) {
      return { success: false, message: 'No data found' };
    }

    // Calculate derived fields
    const calculated = calculateAllDerivedFields(data);

    // Get the appropriate timeframe data
    let aggregatedData;
    switch (timeframe) {
      case 'weekly':
        aggregatedData = calculated.mondayWeekly;
        break;
      case 'monthly':
        aggregatedData = calculated.monthly;
        break;
      case 'yearly':
        aggregatedData = calculated.yearly;
        break;
      default:
        aggregatedData = calculated.daily;
    }

    // Cache the result
    const { cache } = require('../utils/redis');
    const cacheKey = `aggregated:${symbol}:${timeframe}:${aggregationType}`;
    await cache.set(cacheKey, aggregatedData, 3600); // 1 hour cache

    logger.info('Data aggregation completed', { jobId: job.id, tickerId, records: aggregatedData.length });

    return {
      success: true,
      tickerId,
      symbol,
      timeframe,
      recordCount: aggregatedData.length,
    };

  } catch (error) {
    logger.error('Data aggregation failed', { jobId: job.id, tickerId, error: error.message });
    throw error;
  }
}

/**
 * Refresh analysis cache for a symbol
 */
async function refreshCacheJob(job) {
  const { symbol, analysisTypes = ['daily', 'weekly', 'monthly', 'yearly'] } = job.data;

  logger.info('Starting cache refresh', { jobId: job.id, symbol });

  try {
    const { cache } = require('../utils/redis');

    // Clear existing cache
    for (const type of analysisTypes) {
      await cache.delPattern(`${type}:*${symbol}*`);
      await cache.delPattern(`aggregated:${symbol}:${type}:*`);
    }

    logger.info('Cache refresh completed', { jobId: job.id, symbol });

    return { success: true, symbol, clearedTypes: analysisTypes };

  } catch (error) {
    logger.error('Cache refresh failed', { jobId: job.id, symbol, error: error.message });
    throw error;
  }
}

/**
 * Clean up old data and logs
 */
async function cleanupDataJob(job) {
  const { olderThanDays = 30, cleanupTypes = ['logs', 'analysisResults'] } = job.data;

  logger.info('Starting data cleanup', { jobId: job.id, olderThanDays });

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const results = {};

    // Clean up old analysis results
    if (cleanupTypes.includes('analysisResults')) {
      const deletedResults = await prisma.analysisResult.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          isPublic: false,
        },
      });
      results.analysisResults = deletedResults.count;
    }

    // Clean up old system logs
    if (cleanupTypes.includes('logs')) {
      const deletedLogs = await prisma.systemLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          level: { in: ['debug', 'info'] },
        },
      });
      results.logs = deletedLogs.count;
    }

    // Clean up old upload batches
    if (cleanupTypes.includes('uploadBatches')) {
      const deletedBatches = await prisma.uploadBatch.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: ['COMPLETED', 'FAILED'] },
        },
      });
      results.uploadBatches = deletedBatches.count;
    }

    logger.info('Data cleanup completed', { jobId: job.id, results });

    return { success: true, results };

  } catch (error) {
    logger.error('Data cleanup failed', { jobId: job.id, error: error.message });
    throw error;
  }
}

/**
 * Batch analysis for multiple symbols
 */
async function batchAnalysisJob(job) {
  const { symbols, analysisType, params } = job.data;

  logger.info('Starting batch analysis', { jobId: job.id, symbolCount: symbols.length, analysisType });

  try {
    const AnalysisService = require('../services/AnalysisService');
    const results = {};
    let completed = 0;

    for (const symbol of symbols) {
      try {
        const result = await AnalysisService.getDailyAnalysis({
          symbols: [symbol],
          ...params,
        });
        results[symbol] = result[symbol];
      } catch (err) {
        results[symbol] = { error: err.message };
      }

      completed++;
      await job.updateProgress(Math.round((completed / symbols.length) * 100));
    }

    logger.info('Batch analysis completed', { jobId: job.id, symbolCount: symbols.length });

    return { success: true, results };

  } catch (error) {
    logger.error('Batch analysis failed', { jobId: job.id, error: error.message });
    throw error;
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Update batch progress after file processing
 */
async function updateBatchProgress(batchId) {
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: batchId },
    include: { files: true },
  });

  if (!batch) return;

  const completedFiles = batch.files.filter(f => 
    f.status === 'COMPLETED' || f.status === 'FAILED'
  ).length;

  const failedFiles = batch.files.filter(f => f.status === 'FAILED').length;
  const totalProcessed = batch.files.reduce((sum, f) => sum + f.recordsProcessed, 0);

  const isComplete = completedFiles === batch.totalFiles;
  let status = 'PROCESSING';
  
  if (isComplete) {
    if (failedFiles === batch.totalFiles) {
      status = 'FAILED';
    } else if (failedFiles > 0) {
      status = 'PARTIAL';
    } else {
      status = 'COMPLETED';
    }
  }

  // Collect error summary from failed files
  let errorSummary = null;
  if (failedFiles > 0) {
    const failedFileErrors = batch.files
      .filter(f => f.status === 'FAILED' && f.errorMessage)
      .map(f => `${f.originalName}: ${f.errorMessage}`)
      .slice(0, 5); // Limit to first 5 errors
    
    if (failedFileErrors.length > 0) {
      errorSummary = failedFileErrors.join('\n\n');
      if (failedFiles > 5) {
        errorSummary += `\n\n... and ${failedFiles - 5} more failed files`;
      }
    }
  }

  await prisma.uploadBatch.update({
    where: { id: batchId },
    data: {
      processedFiles: completedFiles,
      failedFiles,
      progressPercentage: (completedFiles / batch.totalFiles) * 100,
      totalRecordsProcessed: totalProcessed,
      status,
      errorSummary,
      completedAt: isComplete ? new Date() : null,
    },
  });
}

// =====================================================
// WORKER SETUP
// =====================================================

/**
 * Create and start all workers
 */
function startWorkers() {
  const workers = [];

  // CSV Processing Worker
  workers.push(new Worker(
    QUEUE_NAMES.CSV_PROCESSING,
    processCSVJob,
    {
      connection: redis,
      concurrency: 2,
      limiter: { max: 5, duration: 1000 },
    }
  ));

  // Derived Fields Worker
  workers.push(new Worker(
    QUEUE_NAMES.DERIVED_FIELDS,
    calculateDerivedFieldsJob,
    {
      connection: redis,
      concurrency: 3,
    }
  ));

  // Data Aggregation Worker
  workers.push(new Worker(
    QUEUE_NAMES.DATA_AGGREGATION,
    aggregateDataJob,
    {
      connection: redis,
      concurrency: 5,
    }
  ));

  // Cache Refresh Worker
  workers.push(new Worker(
    QUEUE_NAMES.CACHE_REFRESH,
    refreshCacheJob,
    {
      connection: redis,
      concurrency: 10,
    }
  ));

  // Data Cleanup Worker
  workers.push(new Worker(
    QUEUE_NAMES.DATA_CLEANUP,
    cleanupDataJob,
    {
      connection: redis,
      concurrency: 1,
    }
  ));

  // Batch Analysis Worker
  workers.push(new Worker(
    QUEUE_NAMES.BATCH_ANALYSIS,
    batchAnalysisJob,
    {
      connection: redis,
      concurrency: 2,
    }
  ));

  // Setup event handlers for all workers
  for (const worker of workers) {
    worker.on('completed', (job, result) => {
      logger.info('Job completed', { queue: worker.name, jobId: job.id });
    });

    worker.on('failed', (job, error) => {
      logger.error('Job failed', { queue: worker.name, jobId: job?.id, error: error.message });
    });

    worker.on('error', (error) => {
      logger.error('Worker error', { queue: worker.name, error: error.message });
    });
  }

  logger.info('All workers started', { workerCount: workers.length });

  return workers;
}

// =====================================================
// JOB SCHEDULING HELPERS
// =====================================================

/**
 * Add CSV processing job to queue
 */
async function addCSVProcessingJob(data, options = {}) {
  return queues.CSV_PROCESSING.add('process-csv', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    ...options,
  });
}

/**
 * Add derived fields calculation job
 */
async function addDerivedFieldsJob(data, options = {}) {
  return queues.DERIVED_FIELDS.add('calculate-derived', data, {
    attempts: 2,
    ...options,
  });
}

/**
 * Add cache refresh job
 */
async function addCacheRefreshJob(data, options = {}) {
  return queues.CACHE_REFRESH.add('refresh-cache', data, {
    attempts: 1,
    ...options,
  });
}

/**
 * Add cleanup job
 */
async function addCleanupJob(data, options = {}) {
  return queues.DATA_CLEANUP.add('cleanup', data, {
    attempts: 1,
    ...options,
  });
}

/**
 * Add batch analysis job
 */
async function addBatchAnalysisJob(data, options = {}) {
  return queues.BATCH_ANALYSIS.add('batch-analysis', data, {
    attempts: 2,
    ...options,
  });
}

module.exports = {
  QUEUE_NAMES,
  queues,
  startWorkers,
  addCSVProcessingJob,
  addDerivedFieldsJob,
  addCacheRefreshJob,
  addCleanupJob,
  addBatchAnalysisJob,
  // Individual processors for testing
  processCSVJob,
  calculateDerivedFieldsJob,
  aggregateDataJob,
  refreshCacheJob,
  cleanupDataJob,
  batchAnalysisJob,
};
