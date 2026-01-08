/**
 * Analysis Routes
 * API endpoints for accessing calculated seasonality data
 * Updated for new schema with separate tables:
 * - DailySeasonalityData
 * - MondayWeeklyData
 * - ExpiryWeeklyData
 * - MonthlySeasonalityData
 * - YearlySeasonalityData
 */
const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * GET /analysis/symbols
 * List all available symbols with data
 */
router.get('/symbols',
  authenticateToken,
  async (req, res, next) => {
    try {
      const symbols = await prisma.ticker.findMany({
        where: { isActive: true },
        select: {
          id: true,
          symbol: true,
          name: true,
          totalRecords: true,
          firstDataDate: true,
          lastDataDate: true,
          lastUpdated: true,
          _count: {
            select: {
              dailySeasonalityData: true,
              mondayWeeklyData: true,
              expiryWeeklyData: true,
              monthlySeasonalityData: true,
              yearlySeasonalityData: true
            }
          }
        },
        orderBy: { symbol: 'asc' }
      });

      res.json({
        success: true,
        data: symbols.map(ticker => ({
          id: ticker.id,
          symbol: ticker.symbol,
          name: ticker.name,
          totalRecords: ticker.totalRecords,
          firstDataDate: ticker.firstDataDate,
          lastDataDate: ticker.lastDataDate,
          lastUpdated: ticker.lastUpdated,
          dataAvailable: {
            daily: ticker._count.dailySeasonalityData,
            mondayWeekly: ticker._count.mondayWeeklyData,
            expiryWeekly: ticker._count.expiryWeeklyData,
            monthly: ticker._count.monthlySeasonalityData,
            yearly: ticker._count.yearlySeasonalityData
          }
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/daily
 * Get daily calculated data for a symbol
 */
router.get('/symbols/:symbol/daily',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const [records, total] = await Promise.all([
        prisma.dailySeasonalityData.findMany({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          take: parseInt(limit),
          skip
        }),
        prisma.dailySeasonalityData.count({ where: { tickerId: ticker.id } })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          timeframe: 'daily',
          records,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/monday-weekly
 * Get Monday weekly data for a symbol
 */
router.get('/symbols/:symbol/monday-weekly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const [records, total] = await Promise.all([
        prisma.mondayWeeklyData.findMany({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          take: parseInt(limit),
          skip
        }),
        prisma.mondayWeeklyData.count({ where: { tickerId: ticker.id } })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          timeframe: 'mondayWeekly',
          records,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/expiry-weekly
 * Get Expiry weekly data for a symbol
 */
router.get('/symbols/:symbol/expiry-weekly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const [records, total] = await Promise.all([
        prisma.expiryWeeklyData.findMany({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          take: parseInt(limit),
          skip
        }),
        prisma.expiryWeeklyData.count({ where: { tickerId: ticker.id } })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          timeframe: 'expiryWeekly',
          records,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/monthly
 * Get monthly data for a symbol
 */
router.get('/symbols/:symbol/monthly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const [records, total] = await Promise.all([
        prisma.monthlySeasonalityData.findMany({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          take: parseInt(limit),
          skip
        }),
        prisma.monthlySeasonalityData.count({ where: { tickerId: ticker.id } })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          timeframe: 'monthly',
          records,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/yearly
 * Get yearly data for a symbol
 */
router.get('/symbols/:symbol/yearly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      const { page = 1, limit = 100 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const [records, total] = await Promise.all([
        prisma.yearlySeasonalityData.findMany({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          take: parseInt(limit),
          skip
        }),
        prisma.yearlySeasonalityData.count({ where: { tickerId: ticker.id } })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          timeframe: 'yearly',
          records,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/summary
 * Get summary statistics for a symbol across all timeframes
 */
router.get('/symbols/:symbol/summary',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;
      logger.info(`Fetching summary for symbol: ${symbol}`);

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() },
        include: {
          _count: {
            select: {
              dailySeasonalityData: true,
              mondayWeeklyData: true,
              expiryWeeklyData: true,
              monthlySeasonalityData: true,
              yearlySeasonalityData: true
            }
          }
        }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      logger.info(`Ticker found: ${ticker.symbol}, daily count: ${ticker._count.dailySeasonalityData}`);

      // Get date range from daily data (oldest and newest)
      const [oldestDaily, newestDaily] = await Promise.all([
        prisma.dailySeasonalityData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'asc' },
          select: { date: true }
        }),
        prisma.dailySeasonalityData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' },
          select: { date: true }
        })
      ]);

      logger.info(`Date range: ${oldestDaily?.date} to ${newestDaily?.date}`);

      // Get latest data from each timeframe
      const [latestDaily, latestMondayWeekly, latestExpiryWeekly, latestMonthly, latestYearly] = await Promise.all([
        prisma.dailySeasonalityData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' }
        }),
        prisma.mondayWeeklyData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' }
        }),
        prisma.expiryWeeklyData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' }
        }),
        prisma.monthlySeasonalityData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' }
        }),
        prisma.yearlySeasonalityData.findFirst({
          where: { tickerId: ticker.id },
          orderBy: { date: 'desc' }
        })
      ]);

      res.json({
        success: true,
        data: {
          symbol: ticker.symbol,
          name: ticker.name,
          // Use daily data count as total records
          totalRecords: ticker._count.dailySeasonalityData,
          // Use date range from daily data
          firstDataDate: oldestDaily?.date || null,
          lastDataDate: newestDaily?.date || null,
          lastUpdated: newestDaily?.date || ticker.lastUpdated,
          dataAvailable: {
            daily: ticker._count.dailySeasonalityData,
            mondayWeekly: ticker._count.mondayWeeklyData,
            expiryWeekly: ticker._count.expiryWeeklyData,
            monthly: ticker._count.monthlySeasonalityData,
            yearly: ticker._count.yearlySeasonalityData
          },
          latestData: {
            daily: latestDaily,
            mondayWeekly: latestMondayWeekly,
            expiryWeekly: latestExpiryWeekly,
            monthly: latestMonthly,
            yearly: latestYearly
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/stats
 * Get overall analysis statistics
 */
router.get('/stats',
  authenticateToken,
  async (req, res, next) => {
    try {
      const [
        totalSymbols,
        dailyCount,
        mondayWeeklyCount,
        expiryWeeklyCount,
        monthlyCount,
        yearlyCount,
        recentSymbols
      ] = await Promise.all([
        prisma.ticker.count({ where: { isActive: true } }),
        prisma.dailySeasonalityData.count(),
        prisma.mondayWeeklyData.count(),
        prisma.expiryWeeklyData.count(),
        prisma.monthlySeasonalityData.count(),
        prisma.yearlySeasonalityData.count(),
        prisma.ticker.findMany({
          where: { isActive: true },
          orderBy: { lastUpdated: 'desc' },
          take: 10,
          select: {
            symbol: true,
            name: true,
            totalRecords: true,
            lastUpdated: true
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalSymbols,
          recordCounts: {
            daily: dailyCount,
            mondayWeekly: mondayWeeklyCount,
            expiryWeekly: expiryWeeklyCount,
            monthly: monthlyCount,
            yearly: yearlyCount,
            total: dailyCount + mondayWeeklyCount + expiryWeeklyCount + monthlyCount + yearlyCount
          },
          recentlyUpdated: recentSymbols
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// CSV EXPORT ENDPOINTS
// =====================================================

/**
 * DELETE /analysis/symbols/:symbol
 * Delete a ticker and ALL its related data from all tables
 */
router.delete('/symbols/:symbol',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      logger.info(`Deleting ticker and all related data: ${symbol}`, { tickerId: ticker.id });

      // Delete from all related tables (order matters due to foreign keys)
      const deleteCounts = {};

      // Delete from calculated data tables
      deleteCounts.dailySeasonalityData = (await prisma.dailySeasonalityData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      deleteCounts.mondayWeeklyData = (await prisma.mondayWeeklyData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      deleteCounts.expiryWeeklyData = (await prisma.expiryWeeklyData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      deleteCounts.monthlySeasonalityData = (await prisma.monthlySeasonalityData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      deleteCounts.yearlySeasonalityData = (await prisma.yearlySeasonalityData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      // Delete from raw data table
      deleteCounts.seasonalityData = (await prisma.seasonalityData.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      // Delete generated files records
      deleteCounts.generatedFiles = (await prisma.generatedFile.deleteMany({
        where: { tickerId: ticker.id }
      })).count;

      // Finally delete the ticker
      await prisma.ticker.delete({
        where: { id: ticker.id }
      });

      logger.info(`Ticker deleted successfully: ${symbol}`, { deleteCounts });

      res.json({
        success: true,
        message: `Ticker ${symbol} and all related data deleted successfully`,
        data: {
          symbol: symbol.toUpperCase(),
          deletedRecords: deleteCounts,
          totalDeleted: Object.values(deleteCounts).reduce((a, b) => a + b, 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper function to convert records to CSV
 */
function recordsToCSV(records) {
  if (!records || records.length === 0) return '';
  
  // Get headers from first record, excluding internal fields
  const excludeFields = ['id', 'tickerId', 'createdAt', 'updatedAt'];
  const headers = Object.keys(records[0]).filter(k => !excludeFields.includes(k));
  
  // Create CSV content
  const csvRows = [headers.join(',')];
  
  for (const record of records) {
    const values = headers.map(header => {
      let value = record[header];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString().split('T')[0];
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * GET /analysis/symbols/:symbol/daily/export
 * Export daily data as CSV
 */
router.get('/symbols/:symbol/daily/export',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const records = await prisma.dailySeasonalityData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      const csv = recordsToCSV(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_daily.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/monday-weekly/export
 * Export Monday weekly data as CSV
 */
router.get('/symbols/:symbol/monday-weekly/export',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const records = await prisma.mondayWeeklyData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      const csv = recordsToCSV(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_monday_weekly.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/expiry-weekly/export
 * Export Expiry weekly data as CSV
 */
router.get('/symbols/:symbol/expiry-weekly/export',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const records = await prisma.expiryWeeklyData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      const csv = recordsToCSV(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_expiry_weekly.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/monthly/export
 * Export monthly data as CSV
 */
router.get('/symbols/:symbol/monthly/export',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const records = await prisma.monthlySeasonalityData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      const csv = recordsToCSV(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_monthly.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /analysis/symbols/:symbol/yearly/export
 * Export yearly data as CSV
 */
router.get('/symbols/:symbol/yearly/export',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.params;

      const ticker = await prisma.ticker.findUnique({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!ticker) {
        throw new NotFoundError('Symbol');
      }

      const records = await prisma.yearlySeasonalityData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'asc' }
      });

      const csv = recordsToCSV(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${symbol}_yearly.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
