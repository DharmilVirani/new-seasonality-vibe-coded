/**
 * Upload Routes
 * File upload handling for research team CSV uploads
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Minio = require('minio');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const config = require('../config');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../utils/errors');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10, // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only CSV files are allowed'));
    }
  },
});

// Initialize MinIO client - uses INTERNAL endpoint for Docker network access
const minioClient = new Minio.Client({
  endPoint: config.minio.internalEndpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: 'us-east-1',
  pathStyle: true,
});

// Create a second client for generating presigned URLs with EXTERNAL endpoint
const minioClientExternal = new Minio.Client({
  endPoint: config.minio.endpoint, // External IP: 192.168.4.30
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: 'us-east-1',
  pathStyle: true,
});

/**
 * Generate presigned URL using EXTERNAL client (like your working version)
 */
async function getPresignedPutUrl(bucketName, objectKey, expiry = 3600) {
  try {
    // Use EXTERNAL client for presigned URLs (browser needs to access this)
    const url = await minioClientExternal.presignedPutObject(bucketName, objectKey, expiry);
    logger.info(`Generated presigned PUT URL for ${objectKey} using ${config.minio.endpoint}`);
    return url;
  } catch (error) {
    logger.error('Error generating presigned PUT URL:', error.message);
    throw error;
  }
}

// Ensure bucket exists
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(config.minio.bucket);
    if (!exists) {
      await minioClient.makeBucket(config.minio.bucket, 'us-east-1');
      logger.info('MinIO bucket created', { bucket: config.minio.bucket });
      
      // Set bucket policy and CORS like your working version
      await setBucketPolicy(config.minio.bucket);
      await setBucketCORS(config.minio.bucket);
    } else {
      // Bucket exists, ensure CORS is set
      await setBucketCORS(config.minio.bucket);
    }
  } catch (error) {
    logger.error('MinIO bucket error', { error: error.message });
  }
};

/**
 * Set bucket policy to allow public uploads (for presigned URLs)
 */
async function setBucketPolicy(bucketName) {
  const policy = {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetBucketLocation', 's3:ListBucket'],
      Resource: [`arn:aws:s3:::${bucketName}`]
    }, {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:PutObject', 's3:GetObject'],
      Resource: [`arn:aws:s3:::${bucketName}/*`]
    }]
  };

  try {
    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    logger.info(`Bucket policy set for '${bucketName}'`);
  } catch (error) {
    logger.warn(`Could not set bucket policy for '${bucketName}':`, error.message);
  }
}

/**
 * Set CORS configuration for bucket
 */
async function setBucketCORS(bucketName) {
  const corsConfig = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
<AllowedOrigin>*</AllowedOrigin>
<AllowedMethod>GET</AllowedMethod>
<AllowedMethod>PUT</AllowedMethod>
<AllowedMethod>POST</AllowedMethod>
<AllowedMethod>DELETE</AllowedMethod>
<AllowedMethod>HEAD</AllowedMethod>
<AllowedHeader>*</AllowedHeader>
<ExposeHeader>ETag</ExposeHeader>
<ExposeHeader>Content-Length</ExposeHeader>
</CORSRule>
</CORSConfiguration>`;

  try {
    await minioClient.setBucketCors(bucketName, corsConfig);
    logger.info(`CORS configured for '${bucketName}'`);
  } catch (error) {
    logger.warn(`Could not set CORS for '${bucketName}':`, error.message);
  }
}
ensureBucket();

/**
 * POST /upload/batch
 * Create a new upload batch and upload files
 */
router.post('/batch',
  authenticateToken,
  requireRole('admin', 'research'),
  upload.array('files', 10),
  async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const files = req.files;

      if (!files || files.length === 0) {
        throw new ValidationError('No files uploaded');
      }

      // Create batch record
      const batch = await prisma.uploadBatch.create({
        data: {
          userId: req.user.id,
          name: name || `Batch ${new Date().toISOString()}`,
          description,
          totalFiles: files.length,
          status: 'PENDING',
        },
      });

      // Upload files to MinIO and create file records
      const uploadedFiles = [];
      for (const file of files) {
        const objectKey = `uploads/${batch.id}/${uuidv4()}-${file.originalname}`;
        
        await minioClient.putObject(
          config.minio.bucket,
          objectKey,
          file.buffer,
          file.size,
          { 'Content-Type': 'text/csv' }
        );

        const uploadedFile = await prisma.uploadedFile.create({
          data: {
            batchId: batch.id,
            originalName: file.originalname,
            objectKey,
            fileSize: file.size,
            mimeType: file.mimetype,
            status: 'PENDING',
          },
        });

        uploadedFiles.push(uploadedFile);
      }

      logger.info('Upload batch created', { 
        batchId: batch.id, 
        fileCount: files.length,
        userId: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        batch: {
          id: batch.id,
          name: batch.name,
          totalFiles: batch.totalFiles,
          status: batch.status,
        },
        files: uploadedFiles.map(f => ({
          id: f.id,
          name: f.originalName,
          size: f.fileSize,
          status: f.status,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /upload/batches
 * List all upload batches for the user
 */
router.get('/batches',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (page - 1) * limit;

      const where = {
        userId: req.user.id,
      };
      if (status) {
        where.status = status;
      }

      const [batches, total] = await Promise.all([
        prisma.uploadBatch.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
          include: {
            _count: {
              select: { files: true },
            },
          },
        }),
        prisma.uploadBatch.count({ where }),
      ]);

      res.json({
        success: true,
        batches: batches.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          status: b.status,
          totalFiles: b.totalFiles,
          processedFiles: b.processedFiles,
          failedFiles: b.failedFiles,
          progressPercentage: b.progressPercentage,
          totalRecordsProcessed: b.totalRecordsProcessed,
          createdAt: b.createdAt,
          completedAt: b.completedAt,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /upload/batches/:batchId
 * Get batch details with files
 */
router.get('/batches/:batchId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: {
          files: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      res.json({
        success: true,
        batch: {
          id: batch.id,
          name: batch.name,
          description: batch.description,
          status: batch.status,
          totalFiles: batch.totalFiles,
          processedFiles: batch.processedFiles,
          failedFiles: batch.failedFiles,
          progressPercentage: batch.progressPercentage,
          totalRecordsProcessed: batch.totalRecordsProcessed,
          errorSummary: batch.errorSummary,
          createdAt: batch.createdAt,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
          files: batch.files.map(f => ({
            id: f.id,
            name: f.originalName,
            size: f.fileSize,
            status: f.status,
            recordsProcessed: f.recordsProcessed,
            recordsSkipped: f.recordsSkipped,
            recordsFailed: f.recordsFailed,
            errorMessage: f.errorMessage,
            processedAt: f.processedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /upload/batches/:batchId/process
 * Start processing a batch (triggers background job)
 */
router.post('/batches/:batchId/process',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: { files: true },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      if (batch.status !== 'PENDING') {
        throw new ValidationError(`Batch is already ${batch.status.toLowerCase()}`);
      }

      // Update batch status
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Add jobs to BullMQ queue for each file
      const { addCSVProcessingJob } = require('../processing');
      
      for (const file of batch.files) {
        await addCSVProcessingJob({
          batchId: batch.id,
          fileId: file.id,
          objectKey: file.objectKey,
          fileName: file.originalName,
          options: {
            batchSize: 1000,
            calculateDerived: false, // Phase 1: just OHLCV data
          },
        });
        
        logger.info('CSV processing job queued', { 
          batchId, 
          fileId: file.id, 
          fileName: file.originalName 
        });
      }

      logger.info('Batch processing started', { 
        batchId, 
        fileCount: batch.files.length 
      });

      res.json({
        success: true,
        message: 'Batch processing started',
        batchId,
        filesQueued: batch.files.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /upload/batches/:batchId
 * Delete a batch and its files
 */
router.delete('/batches/:batchId',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: { files: true },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      // Delete files from MinIO
      for (const file of batch.files) {
        try {
          await minioClient.removeObject(config.minio.bucket, file.objectKey);
        } catch (err) {
          logger.warn('Failed to delete file from MinIO', { 
            objectKey: file.objectKey, 
            error: err.message 
          });
        }
      }

      // Delete batch (cascades to files)
      await prisma.uploadBatch.delete({
        where: { id: batchId },
      });

      logger.info('Batch deleted', { batchId });

      res.json({
        success: true,
        message: 'Batch deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// BULK UPLOAD ENDPOINTS (for large file batches)
// =====================================================

/**
 * POST /upload/bulk/presign
 * Get presigned URLs for bulk file upload to MinIO
 */
router.post('/bulk/presign',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { files } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new ValidationError('No files specified');
      }

      if (files.length > 500) {
        throw new ValidationError('Maximum 500 files per upload batch');
      }

      // Create batch record
      const batch = await prisma.uploadBatch.create({
        data: {
          userId: req.user.id,
          name: `Bulk Upload ${new Date().toISOString()}`,
          totalFiles: files.length,
          status: 'PENDING',
        },
      });

      // Generate presigned URLs for each file
      const presignedFiles = [];
      for (const file of files) {
        const objectKey = `uploads/${batch.id}/${uuidv4()}-${file.name}`;
        
        // Generate presigned PUT URL using EXTERNAL client (like your working version)
        const uploadUrl = await getPresignedPutUrl(config.minio.bucket, objectKey, 3600);
        
        logger.info('Generated presigned URL', { objectKey, url: uploadUrl.substring(0, 100) + '...' });

        // Create file record
        await prisma.uploadedFile.create({
          data: {
            batchId: batch.id,
            originalName: file.name,
            objectKey,
            fileSize: file.size || 0,
            mimeType: 'text/csv',
            status: 'PENDING',
          },
        });

        presignedFiles.push({
          fileName: file.name,
          objectKey,
          uploadUrl,
        });
      }

      logger.info('Bulk upload presigned URLs generated', {
        batchId: batch.id,
        fileCount: files.length,
        userId: req.user.id,
      });

      res.json({
        success: true,
        data: {
          batchId: batch.id,
          files: presignedFiles,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /upload/bulk/process
 * Start processing uploaded files after bulk upload
 */
router.post('/bulk/process',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { batchId, objectKeys, fileNames } = req.body;

      if (!batchId) {
        throw new ValidationError('Batch ID is required');
      }

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: { files: true },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      // Update batch status
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Add jobs to BullMQ queue for each file
      const { addCSVProcessingJob } = require('../processing');
      
      for (let i = 0; i < batch.files.length; i++) {
        const file = batch.files[i];
        
        await addCSVProcessingJob({
          batchId: batch.id,
          fileId: file.id,
          objectKey: file.objectKey,
          fileName: file.originalName,
          fileIndex: i,
          options: {
            batchSize: 1000,
            calculateDerived: false,
          },
        });
      }

      logger.info('Bulk processing started', {
        batchId,
        fileCount: batch.files.length,
      });

      res.json({
        success: true,
        data: {
          batchId,
          filesQueued: batch.files.length,
          status: 'PROCESSING',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /upload/bulk/:batchId/status
 * Get bulk upload batch status with file details
 */
router.get('/bulk/:batchId/status',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: {
          files: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      // Calculate progress
      const completedFiles = batch.files.filter(f => 
        f.status === 'COMPLETED' || f.status === 'FAILED'
      ).length;
      const progress = batch.totalFiles > 0 
        ? (completedFiles / batch.totalFiles) * 100 
        : 0;

      res.json({
        success: true,
        data: {
          batchId: batch.id,
          status: batch.status,
          totalFiles: batch.totalFiles,
          processedFiles: batch.processedFiles,
          failedFiles: batch.failedFiles,
          pendingFiles: batch.totalFiles - completedFiles,
          progress,
          files: batch.files.map(f => ({
            id: f.id,
            fileName: f.originalName,
            status: f.status,
            recordsProcessed: f.recordsProcessed,
            error: f.errorMessage,
            processedAt: f.processedAt,
          })),
          createdAt: batch.createdAt,
          startedAt: batch.startedAt,
          completedAt: batch.completedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /upload/bulk/:batchId/retry
 * Retry failed files in a batch
 */
router.post('/bulk/:batchId/retry',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { batchId } = req.params;

      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
        include: {
          files: {
            where: { status: 'FAILED' },
          },
        },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      if (batch.files.length === 0) {
        throw new ValidationError('No failed files to retry');
      }

      // Reset failed files to pending
      await prisma.uploadedFile.updateMany({
        where: {
          batchId,
          status: 'FAILED',
        },
        data: {
          status: 'PENDING',
          errorMessage: null,
          errorDetails: null,
        },
      });

      // Update batch status
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: 'PROCESSING',
          failedFiles: 0,
        },
      });

      // Re-queue failed files
      const { addCSVProcessingJob } = require('../processing');
      
      for (const file of batch.files) {
        await addCSVProcessingJob({
          batchId: batch.id,
          fileId: file.id,
          objectKey: file.objectKey,
          fileName: file.originalName,
          retry: true,
          options: {
            batchSize: 1000,
            calculateDerived: false,
          },
        });
      }

      logger.info('Retry processing started', {
        batchId,
        retryCount: batch.files.length,
      });

      res.json({
        success: true,
        message: 'Retry processing started',
        filesRetrying: batch.files.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /upload/stats
 * Get upload statistics
 */
router.get('/stats',
  authenticateToken,
  async (req, res, next) => {
    try {
      const [totalTickers, totalData, recentBatches] = await Promise.all([
        prisma.ticker.count(),
        prisma.seasonalityData.count(),
        prisma.uploadBatch.findMany({
          where: { userId: req.user.id },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            totalFiles: true,
            processedFiles: true,
            totalRecordsProcessed: true,
            createdAt: true,
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalTickers,
          totalDataEntries: totalData,
          averageEntriesPerTicker: totalTickers > 0 ? Math.round(totalData / totalTickers) : 0,
          recentBatches,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /upload/validate
 * Validate CSV file before upload (checks format, columns, sample data)
 */
router.post('/validate',
  authenticateToken,
  requireRole('admin', 'research'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const file = req.file;

      if (!file) {
        throw new ValidationError('No file provided');
      }

      // Parse CSV content
      const csvContent = file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new ValidationError('CSV file is empty or has no data rows');
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Check required columns
      const { validateRequiredColumns, SUPPORTED_DATE_FORMATS } = require('../processing/validators');
      const columnValidation = validateRequiredColumns(headers, 'daily');

      if (!columnValidation.valid) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Missing required columns',
          details: {
            missingColumns: columnValidation.missingColumns,
            foundColumns: headers,
            requiredColumns: ['date', 'close'],
            optionalColumns: ['ticker', 'open', 'high', 'low', 'volume', 'openinterest'],
            supportedDateFormats: SUPPORTED_DATE_FORMATS,
          },
          message: `Missing required columns: ${columnValidation.missingColumns.join(', ')}. ` +
            `Found columns: ${headers.join(', ')}. ` +
            `Required: Date, Close (or Ticker for multi-symbol files). ` +
            `Optional: Open, High, Low, Volume, OpenInterest. ` +
            `If Open is empty, Close value will be used.`,
        });
      }

      // Parse sample rows to validate data format
      const sampleSize = Math.min(5, lines.length - 1);
      const sampleRows = [];
      const errors = [];

      for (let i = 1; i <= sampleSize; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        sampleRows.push(row);

        // Validate date format
        const dateValue = row.date || row.Date || row.DATE;
        if (dateValue) {
          const { parseDate } = require('../processing/transformers');
          const parsedDate = parseDate(dateValue);
          if (!parsedDate) {
            errors.push(`Row ${i}: Invalid date format "${dateValue}". Supported formats: ${SUPPORTED_DATE_FORMATS.join(', ')}`);
          }
        } else {
          errors.push(`Row ${i}: Missing date value`);
        }

        // Validate close price
        const closeValue = row.close || row.Close || row.CLOSE;
        if (!closeValue || isNaN(parseFloat(closeValue))) {
          errors.push(`Row ${i}: Invalid or missing close price "${closeValue}"`);
        }
      }

      const totalRows = lines.length - 1;
      const isValid = errors.length === 0;

      logger.info('CSV validation completed', {
        fileName: file.originalname,
        valid: isValid,
        totalRows,
        errorCount: errors.length,
      });

      res.json({
        success: true,
        valid: isValid,
        fileName: file.originalname,
        fileSize: file.size,
        totalRows,
        columns: {
          found: headers,
          required: ['date', 'close'],
          optional: ['ticker', 'open', 'high', 'low', 'volume', 'openinterest'],
          hasTickerColumn: headers.includes('ticker') || headers.includes('symbol'),
        },
        sampleData: sampleRows,
        errors: errors.length > 0 ? errors : null,
        supportedDateFormats: SUPPORTED_DATE_FORMATS,
        notes: [
          'If Open column is empty, Close value will be used',
          'If High column is empty, Close value will be used',
          'If Low column is empty, Close value will be used',
          'Volume and OpenInterest default to 0 if not provided',
        ],
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
/**
 * PUT /upload/direct/:batchId/:objectKey
 * Direct file upload endpoint (bypasses presigned URLs)
 */
router.put('/direct/:batchId/:objectKey',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { batchId, objectKey } = req.params;
      const decodedObjectKey = decodeURIComponent(objectKey);

      // Verify batch belongs to user
      const batch = await prisma.uploadBatch.findFirst({
        where: {
          id: batchId,
          userId: req.user.id,
        },
      });

      if (!batch) {
        throw new NotFoundError('Batch');
      }

      // Verify file record exists
      const fileRecord = await prisma.uploadedFile.findFirst({
        where: {
          batchId,
          objectKey: decodedObjectKey,
        },
      });

      if (!fileRecord) {
        throw new NotFoundError('File record');
      }

      // Upload file to MinIO
      await minioClient.putObject(
        config.minio.bucket,
        decodedObjectKey,
        req,
        undefined,
        { 'Content-Type': 'text/csv' }
      );

      logger.info('Direct file upload successful', { 
        batchId, 
        objectKey: decodedObjectKey,
        userId: req.user.id 
      });

      res.json({
        success: true,
        message: 'File uploaded successfully',
        objectKey: decodedObjectKey,
      });
    } catch (error) {
      next(error);
    }
  }
);