/**
 * Generated Files Routes
 * API endpoints for accessing generated analysis files
 */
const express = require('express');
const router = express.Router();
const Minio = require('minio');
const prisma = require('../utils/prisma');
const config = require('../config');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { NotFoundError } = require('../utils/errors');

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: config.minio.internalEndpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

/**
 * GET /files/symbols/:symbol
 * List all generated files for a symbol
 */
router.get('/symbols/:symbol',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      // Find ticker
      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() },
        include: {
          generatedFiles: {
            orderBy: { fileType: 'asc' }
          }
        }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          files: ticker.generatedFiles.map(file => ({
            id: file.id,
            type: file.fileType,
            fileName: file.fileName,
            recordCount: file.recordCount,
            generatedAt: file.generatedAt,
            downloadUrl: `/api/files/download/${file.id}`
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /files/download/:fileId
 * Download a specific generated file
 */
router.get('/download/:fileId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;

      // Find file record
      const file = await prisma.generatedFile.findUnique({
        where: { id: parseInt(fileId) },
        include: { ticker: true }
      });

      if (!file) {
        throw new NotFoundError('File');
      }

      // Get file from MinIO
      const bucketName = 'generated-files';
      const stream = await minioClient.getObject(bucketName, file.objectKey);

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

      // Stream file to response
      stream.pipe(res);

      logger.info('File downloaded', {
        fileId,
        symbol: file.ticker.symbol,
        fileName: file.fileName,
        userId: req.user.id
      });

    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new NotFoundError('File not found in storage');
      }
      next(error);
    }
  }
);

/**
 * GET /files/symbols/:symbol/download/:fileType
 * Download a specific file type for a symbol
 */
router.get('/symbols/:symbol/download/:fileType',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, fileType } = req.params;

      // Find file
      const file = await prisma.generatedFile.findFirst({
        where: {
          ticker: { symbol: symbol.toUpperCase() },
          fileType: fileType.toUpperCase()
        },
        include: { ticker: true }
      });

      if (!file) {
        throw new NotFoundError('File');
      }

      // Get file from MinIO
      const bucketName = 'generated-files';
      const stream = await minioClient.getObject(bucketName, file.objectKey);

      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

      // Stream file to response
      stream.pipe(res);

      logger.info('File downloaded by type', {
        symbol,
        fileType,
        fileName: file.fileName,
        userId: req.user.id
      });

    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new NotFoundError('File not found in storage');
      }
      next(error);
    }
  }
);

/**
 * GET /files/symbols/:symbol/download/all
 * Download all files for a symbol as a ZIP
 */
router.get('/symbols/:symbol/download/all',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const archiver = require('archiver');

      // Find ticker and files
      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() },
        include: {
          generatedFiles: {
            orderBy: { fileType: 'asc' }
          }
        }
      });

      if (!ticker || ticker.generatedFiles.length === 0) {
        throw new NotFoundError('Files');
      }

      // Set response headers for ZIP
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_analysis_files.zip"`);

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      // Add each file to the archive
      const bucketName = 'generated-files';
      for (const file of ticker.generatedFiles) {
        try {
          const stream = await minioClient.getObject(bucketName, file.objectKey);
          archive.append(stream, { name: file.fileName });
        } catch (err) {
          logger.warn('Failed to add file to archive', { 
            fileId: file.id, 
            fileName: file.fileName, 
            error: err.message 
          });
        }
      }

      // Finalize the archive
      await archive.finalize();

      logger.info('ZIP archive downloaded', {
        symbol,
        fileCount: ticker.generatedFiles.length,
        userId: req.user.id
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /files/stats
 * Get file generation statistics
 */
router.get('/stats',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const [totalFiles, filesByType, recentFiles] = await Promise.all([
        prisma.generatedFile.count(),
        prisma.generatedFile.groupBy({
          by: ['fileType'],
          _count: { id: true }
        }),
        prisma.generatedFile.findMany({
          take: 10,
          orderBy: { generatedAt: 'desc' },
          include: { ticker: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalFiles,
          filesByType: filesByType.reduce((acc, item) => {
            acc[item.fileType] = item._count.id;
            return acc;
          }, {}),
          recentFiles: recentFiles.map(file => ({
            id: file.id,
            symbol: file.ticker.symbol,
            type: file.fileType,
            fileName: file.fileName,
            recordCount: file.recordCount,
            generatedAt: file.generatedAt
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /files/:fileId
 * Delete a generated file
 */
router.delete('/:fileId',
  authenticateToken,
  requireRole('admin', 'research'),
  async (req, res, next) => {
    try {
      const { fileId } = req.params;

      // Find file
      const file = await prisma.generatedFile.findUnique({
        where: { id: parseInt(fileId) },
        include: { ticker: true }
      });

      if (!file) {
        throw new NotFoundError('File');
      }

      // Delete from MinIO
      const bucketName = 'generated-files';
      try {
        await minioClient.removeObject(bucketName, file.objectKey);
      } catch (err) {
        logger.warn('Failed to delete file from MinIO', { 
          fileId, 
          objectKey: file.objectKey, 
          error: err.message 
        });
      }

      // Delete from database
      await prisma.generatedFile.delete({
        where: { id: parseInt(fileId) }
      });

      logger.info('Generated file deleted', {
        fileId,
        symbol: file.ticker.symbol,
        fileName: file.fileName,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;