/**
 * Upload Routes
 * File upload handling for research team CSV uploads
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Minio = require('minio');
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

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

// Ensure bucket exists
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(config.minio.bucket);
    if (!exists) {
      await minioClient.makeBucket(config.minio.bucket);
      logger.info('MinIO bucket created', { bucket: config.minio.bucket });
    }
  } catch (error) {
    logger.error('MinIO bucket error', { error: error.message });
  }
};
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

      // In production, this would add a job to BullMQ
      // For now, we'll return immediately and process would happen via worker
      logger.info('Batch processing started', { batchId });

      res.json({
        success: true,
        message: 'Batch processing started',
        batchId,
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

module.exports = router;
