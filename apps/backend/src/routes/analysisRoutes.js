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
const {
  validate,
  scannerRequestSchema,
  basketCalendarSchema,
  basketTradingSchema,
  basketBestMonthlySchema,
  basketGroupCreateSchema,
  basketGroupUpdateSchema,
  basketGroupParamsSchema
} = require('../middleware/validation');
const { NotFoundError } = require('../utils/errors');
const AnalysisService = require('../services/AnalysisService');
const BasketAnalysisService = require('../services/BasketAnalysisService');
const PermissionService = require('../services/PermissionService');

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
          sector: true,
          exchange: true,
          currency: true,
          totalRecords: true,
          firstDataDate: true,
          lastDataDate: true,
          lastUpdated: true,
          _count: {
            select: {
              seasonalityData: true,
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
        count: symbols.length,
        symbols: symbols.map(ticker => ({
          id: ticker.id,
          symbol: ticker.symbol,
          name: ticker.name,
          sector: ticker.sector,
          exchange: ticker.exchange,
          currency: ticker.currency,
          totalRecords: ticker.totalRecords,
          firstDataDate: ticker.firstDataDate,
          lastDataDate: ticker.lastDataDate,
          lastUpdated: ticker.lastUpdated,
          hasData: ticker._count.seasonalityData > 0 ||
                   ticker._count.dailySeasonalityData > 0,
          dataAvailable: {
            basic: ticker._count.seasonalityData > 0,
            daily: ticker._count.dailySeasonalityData > 0,
            mondayWeekly: ticker._count.mondayWeeklyData > 0,
            expiryWeekly: ticker._count.expiryWeeklyData > 0,
            monthly: ticker._count.monthlySeasonalityData > 0,
            yearly: ticker._count.yearlySeasonalityData > 0
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
          timeframe: 'monday-weekly',
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
          timeframe: 'expiry-weekly',
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

// =====================================================
// POST ANALYSIS ENDPOINTS - Filtered Analysis with Statistics
// =====================================================

/**
 * POST /analysis/daily
 * Daily analysis with filters
 * 
 * Request body:
 * {
 *   "symbol": "NIFTY",
 *   "startDate": "2016-01-01",
 *   "endDate": "2025-12-31",
 *   "lastNDays": 0,
 *   "weekType": "expiry",
 *   "filters": {
 *     "yearFilters": { ... },
 *     "monthFilters": { ... },
 *     "weekFilters": { ... },
 *     "dayFilters": { ... },
 *     "outlierFilters": { ... }
 *   }
 * }
 */
router.post('/daily',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Daily analysis request for ${symbol}`, { params });

      const result = await AnalysisService.dailyAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Daily analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/daily/aggregate
 * Daily aggregate analysis (by weekday, calendar day, etc.)
 * 
 * Additional params:
 * - aggregateField: "weekday" | "CalenderYearDay" | "TradingYearDay" | "CalenderMonthDay" | "TradingMonthDay" | "MonthNumber"
 * - aggregateType: "total" | "avg" | "max" | "min"
 */
router.post('/daily/aggregate',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Daily aggregate analysis request for ${symbol}`, { params });

      const result = await AnalysisService.dailyAggregateAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Daily aggregate analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/weekly
 * Weekly analysis (Monday or Expiry based on weekType)
 * 
 * Request body:
 * {
 *   "symbol": "NIFTY",
 *   "weekType": "expiry" | "monday",
 *   "startDate": "2016-01-01",
 *   "endDate": "2025-12-31",
 *   "filters": { ... }
 * }
 */
router.post('/weekly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Weekly analysis request for ${symbol}`, { weekType: params.weekType });

      const result = await AnalysisService.weeklyAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Weekly analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/monthly
 * Monthly analysis with filters
 */
router.post('/monthly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Monthly analysis request for ${symbol}`);

      const result = await AnalysisService.monthlyAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Monthly analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/yearly
 * Yearly analysis with filters
 */
router.post('/yearly',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Yearly analysis request for ${symbol}`);

      const result = await AnalysisService.yearlyAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Yearly analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/scenario
 * Scenario analysis with multiple outputs:
 * - Historic Trending Days
 * - Trending Streak
 * - Momentum Ranking
 * - Watchlist Analysis
 */
router.post('/scenario',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol, ...params } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      logger.info(`Scenario analysis request for ${symbol}`);

      const result = await AnalysisService.scenarioAnalysis(symbol, params);

      res.json({
        success: true,
        data: {
          [symbol]: result
        }
      });
    } catch (error) {
      logger.error('Scenario analysis error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/cache/clear
 * Clear cache for a symbol (admin only)
 */
router.post('/cache/clear',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { symbol } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
      }

      await AnalysisService.clearSymbolCache(symbol);

      res.json({
        success: true,
        message: `Cache cleared for ${symbol}`
      });
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/scanner
 * Symbol Scanner - Find symbols with N consecutive trending days
 */
router.post('/scanner',
  authenticateToken,
  validate(scannerRequestSchema),
  async (req, res, next) => {
    try {
      const {
        symbols = [],
        startDate,
        endDate,
        filters = {},
        trendType = 'Bullish',
        consecutiveDays = 3,
        criteria = {},
        responseMode = 'full',
        maxRows = null
      } = req.body;

      logger.info('Scanner request received', {
        symbols,
        startDate,
        endDate,
        trendType,
        consecutiveDays,
        criteria
      });

      const result = await AnalysisService.scanner({
        symbols,
        startDate,
        endDate,
        filters,
        trendType,
        consecutiveDays,
        criteria,
        responseMode,
        maxRows
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Scanner error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/backtest/phenomena
 * Phenomena Backtester - Backtest trading based on phenomena days
 */
router.post('/backtest/phenomena',
  authenticateToken,
  async (req, res, next) => {
    try {
      const {
        symbol,
        startDate,
        endDate,
        evenOddYears = 'All',
        specificMonth = null,
        specificExpiryWeek = null,
        specificMondayWeek = null,
        initialCapital = 10000000,
        riskFreeRate = 5.4,
        tradeType = 'longTrades',
        brokerage = 0.04,
        phenomenaDaysStart = -5,
        phenomenaDaysEnd = 2,
        queryWeekdays = [],
        queryTradingDays = [],
        queryCalendarDays = [],
        heatmapType = 'TradingMonthDaysVsWeekdays',
        showAnnotation = false,
        inSampleStart,
        inSampleEnd,
        outSampleStart,
        outSampleEnd,
        walkForwardType = 'CalenderYearDay',
        walkForwardSymbols = [],
        includeTradeList = true,
        maxRows = null,
        responseMode = 'full'
      } = req.body;

      logger.info('Phenomena Backtest request received', {
        symbol,
        startDate,
        endDate,
        evenOddYears,
        specificMonth,
        phenomenaDaysStart,
        phenomenaDaysEnd,
        tradeType
      });

      const result = await AnalysisService.backtestPhenomena({
        symbol,
        startDate,
        endDate,
        evenOddYears,
        specificMonth,
        specificExpiryWeek,
        specificMondayWeek,
        initialCapital,
        riskFreeRate,
        tradeType,
        brokerage,
        phenomenaDaysStart,
        phenomenaDaysEnd,
        queryWeekdays,
        queryTradingDays,
        queryCalendarDays,
        heatmapType,
        showAnnotation,
        inSampleStart,
        inSampleEnd,
        outSampleStart,
        outSampleEnd,
        walkForwardType,
        walkForwardSymbols,
        includeTradeList,
        maxRows,
        responseMode
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Phenomena Backtest error', { error: error.message });
      next(error);
    }
  }
);

/**
 * GET /analysis/basket/groups
 * Basket group list for basket analysis
 */
router.get('/basket/groups',
  authenticateToken,
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const groups = await BasketAnalysisService.getAccessibleBasketGroups(req.user.id);
      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      logger.error('Basket groups error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/basket/groups
 * Create user basket
 */
router.post('/basket/groups',
  authenticateToken,
  validate(basketGroupCreateSchema),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const created = await BasketAnalysisService.createBasketGroup({
        userId: req.user.id,
        ...req.body,
      });
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error) {
      logger.error('Basket create error', { error: error.message });
      next(error);
    }
  }
);

/**
 * PATCH /analysis/basket/groups/:id
 * Update user basket
 */
router.patch('/basket/groups/:id',
  authenticateToken,
  validate(basketGroupParamsSchema, 'params'),
  validate(basketGroupUpdateSchema),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const updated = await BasketAnalysisService.updateBasketGroup({
        userId: req.user.id,
        basketGroupId: Number(req.params.id),
        ...req.body,
      });
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Basket update error', { error: error.message });
      next(error);
    }
  }
);

/**
 * DELETE /analysis/basket/groups/:id
 * Delete user basket
 */
router.delete('/basket/groups/:id',
  authenticateToken,
  validate(basketGroupParamsSchema, 'params'),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const result = await BasketAnalysisService.deleteBasketGroup({
        userId: req.user.id,
        basketGroupId: Number(req.params.id),
      });
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Basket delete error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/basket/calendar-day
 * Calendar day basket ranking
 */
router.post('/basket/calendar-day',
  authenticateToken,
  validate(basketCalendarSchema),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const result = await BasketAnalysisService.calendarDayAnalysis({
        ...req.body,
        userId: req.user.id,
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Basket calendar-day error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/basket/trading-day
 * Trading day basket ranking
 */
router.post('/basket/trading-day',
  authenticateToken,
  validate(basketTradingSchema),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const result = await BasketAnalysisService.tradingDayAnalysis({
        ...req.body,
        userId: req.user.id,
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Basket trading-day error', { error: error.message });
      next(error);
    }
  }
);

/**
 * POST /analysis/basket/best-monthly-returns
 * Best monthly return intervals across basket symbols
 */
router.post('/basket/best-monthly-returns',
  authenticateToken,
  validate(basketBestMonthlySchema),
  async (req, res, next) => {
    try {
      PermissionService.validateAccess(req.user, 'analysis:basket', 'basket');
      const result = await BasketAnalysisService.bestMonthlyReturns({
        ...req.body,
        userId: req.user.id,
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Basket best-monthly-returns error', { error: error.message });
      next(error);
    }
  }
);

module.exports = router;
