/**
 * Analysis Routes
 * API endpoints for all 11 analysis modules
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth, requireSubscription } = require('../middleware/auth');
const { dynamicRateLimiter } = require('../middleware/rateLimit');
const { 
  validate, 
  dailyAnalysisSchema, 
  weeklyAnalysisSchema,
  monthlyAnalysisSchema,
  yearlyAnalysisSchema,
  scannerRequestSchema,
  scenarioRequestSchema,
  paginationSchema,
} = require('../middleware/validation');
const AnalysisService = require('../services/AnalysisService');
const { logger } = require('../utils/logger');

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(dynamicRateLimiter);

// =====================================================
// SYMBOL ENDPOINTS
// =====================================================

/**
 * GET /analysis/symbols
 * Get all available symbols
 */
router.get('/symbols', async (req, res, next) => {
  try {
    const tickers = await AnalysisService.getAllTickers();
    
    res.json({
      success: true,
      count: tickers.length,
      symbols: tickers.map(t => ({
        symbol: t.symbol,
        name: t.name,
        sector: t.sector,
        exchange: t.exchange,
        totalRecords: t.totalRecords,
        dateRange: {
          first: t.firstDataDate,
          last: t.lastDataDate,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analysis/symbols/:symbol
 * Get symbol details and recent performance
 */
router.get('/symbols/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const ticker = await AnalysisService.getTickerBySymbol(symbol);
    const performance = await AnalysisService.getRecentPerformance(symbol);

    res.json({
      success: true,
      ticker,
      performance,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 1. DAILY ANALYSIS
// =====================================================

/**
 * POST /analysis/daily
 * Daily timeframe analysis with comprehensive filters
 */
router.post('/daily', validate(dailyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const result = await AnalysisService.getDailyAnalysis(req.body);
    
    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /analysis/daily/aggregate
 * Aggregate daily data by field (trading day, weekday, etc.)
 */
router.post('/daily/aggregate', validate(dailyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { aggregateType = 'total', aggregateField = 'TradingMonthDay' } = req.body;
    
    const result = await AnalysisService.getDailyAnalysis({
      ...req.body,
      aggregateType,
      aggregateField,
    });

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 2. WEEKLY ANALYSIS
// =====================================================

/**
 * POST /analysis/weekly
 * Weekly timeframe analysis (Monday or Expiry based)
 */
router.post('/weekly', validate(weeklyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    // Weekly analysis uses daily data grouped by week
    // This will be fully implemented in Phase 2 with WeeklySeasonalityData
    const result = await AnalysisService.getDailyAnalysis({
      ...req.body,
      aggregateField: req.body.weekType === 'expiry' ? 'ExpiryWeekNumberMonthly' : 'WeekNumberMonthly',
      aggregateType: req.body.aggregateType || 'total',
    });

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      weekType: req.body.weekType,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 3. MONTHLY ANALYSIS
// =====================================================

/**
 * POST /analysis/monthly
 * Monthly timeframe analysis
 */
router.post('/monthly', validate(monthlyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const result = await AnalysisService.getDailyAnalysis({
      ...req.body,
      aggregateField: 'month',
      aggregateType: req.body.aggregateType || 'total',
    });

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 4. YEARLY ANALYSIS
// =====================================================

/**
 * POST /analysis/yearly
 * Yearly overlay analysis
 */
router.post('/yearly', validate(yearlyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const result = await AnalysisService.getYearlyOverlay(req.body);

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 5. SCENARIO ANALYSIS
// =====================================================

/**
 * POST /analysis/scenario
 * Day-to-day trading scenario analysis
 */
router.post('/scenario', validate(scenarioRequestSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const result = await AnalysisService.getScenarioAnalysis(req.body);

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 6. ELECTION ANALYSIS
// =====================================================

/**
 * POST /analysis/election
 * Election cycle impact analysis
 */
router.post('/election', validate(dailyAnalysisSchema), async (req, res, next) => {
  try {
    const startTime = Date.now();
    const electionTypes = ['All', 'Election', 'PreElection', 'PostElection', 'MidElection', 'Modi', 'Current'];
    
    const results = {};
    for (const electionType of electionTypes) {
      results[electionType] = await AnalysisService.getDailyAnalysis({
        ...req.body,
        electionYearType: electionType,
      });
    }

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// 7. SYMBOL SCANNER
// =====================================================

/**
 * POST /analysis/scanner
 * Multi-symbol scanner for consecutive trending days
 */
router.post('/scanner', 
  requireSubscription('basic', 'premium', 'enterprise'),
  validate(scannerRequestSchema), 
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const result = await AnalysisService.runScanner(req.body);

      res.json({
        success: true,
        processingTime: Date.now() - startTime,
        matchCount: result.length,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// 8. BACKTESTER (Premium Feature)
// =====================================================

/**
 * POST /analysis/backtest
 * Phenomena backtesting engine
 */
router.post('/backtest',
  requireSubscription('premium', 'enterprise'),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const {
        symbol,
        startDate,
        endDate,
        entryConditions,
        exitConditions,
        positionSize = 100,
        stopLoss,
        takeProfit,
      } = req.body;

      // Basic backtesting implementation
      // Full implementation would include more sophisticated logic
      const dailyResult = await AnalysisService.getDailyAnalysis({
        symbols: [symbol],
        startDate,
        endDate,
      });

      const data = dailyResult[symbol]?.data || [];
      
      // Simple backtest: buy on positive days, sell on negative
      let position = 0;
      let cash = 10000;
      let trades = [];
      
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
        
        // Entry: previous day was positive
        if (position === 0 && prev.returnPercentage > 0) {
          position = Math.floor(cash / curr.open);
          cash -= position * curr.open;
          trades.push({
            type: 'BUY',
            date: curr.date,
            price: curr.open,
            shares: position,
          });
        }
        // Exit: current day is negative
        else if (position > 0 && curr.returnPercentage < 0) {
          cash += position * curr.close;
          trades.push({
            type: 'SELL',
            date: curr.date,
            price: curr.close,
            shares: position,
            pnl: (curr.close - trades[trades.length - 1].price) * position,
          });
          position = 0;
        }
      }

      // Close any open position
      if (position > 0 && data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        cash += position * lastPrice;
      }

      const totalReturn = ((cash - 10000) / 10000) * 100;

      res.json({
        success: true,
        processingTime: Date.now() - startTime,
        data: {
          symbol,
          initialCapital: 10000,
          finalCapital: cash,
          totalReturn: parseFloat(totalReturn.toFixed(2)),
          tradeCount: trades.length,
          trades: trades.slice(-20), // Last 20 trades
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// 9. PHENOMENA DETECTION
// =====================================================

/**
 * POST /analysis/phenomena
 * Pattern recognition and phenomena detection
 */
router.post('/phenomena',
  requireSubscription('basic', 'premium', 'enterprise'),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const {
        symbol,
        startDate,
        endDate,
        phenomenaType = 'consecutive', // consecutive, reversal, breakout
        threshold = 3,
        percentChange = 0,
        lookAhead = { weeks: 1, months: 1, years: 1 },
      } = req.body;

      const dailyResult = await AnalysisService.getDailyAnalysis({
        symbols: [symbol],
        startDate,
        endDate,
      });

      const data = dailyResult[symbol]?.data || [];
      const phenomena = [];

      // Find consecutive trending days
      if (phenomenaType === 'consecutive') {
        let consecutiveCount = 0;
        let startIdx = 0;
        let isPositive = null;

        for (let i = 0; i < data.length; i++) {
          const isCurrentPositive = data[i].returnPercentage > percentChange;
          
          if (isPositive === null || isCurrentPositive === isPositive) {
            if (isPositive === null) {
              startIdx = i;
              isPositive = isCurrentPositive;
            }
            consecutiveCount++;
          } else {
            if (consecutiveCount >= threshold) {
              phenomena.push({
                startDate: data[startIdx].date,
                endDate: data[i - 1].date,
                days: consecutiveCount,
                direction: isPositive ? 'Bullish' : 'Bearish',
                totalReturn: data.slice(startIdx, i).reduce((sum, d) => sum + d.returnPercentage, 0),
              });
            }
            consecutiveCount = 1;
            startIdx = i;
            isPositive = isCurrentPositive;
          }
        }
      }

      res.json({
        success: true,
        processingTime: Date.now() - startTime,
        data: {
          symbol,
          phenomenaType,
          threshold,
          phenomenaCount: phenomena.length,
          phenomena,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// 10. BASKET ANALYSIS (Enterprise Feature)
// =====================================================

/**
 * POST /analysis/basket
 * Portfolio correlation and basket analysis
 */
router.post('/basket',
  requireSubscription('enterprise'),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const { symbols, startDate, endDate, weights } = req.body;

      if (!symbols || symbols.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 symbols required for basket analysis',
        });
      }

      const results = await AnalysisService.getDailyAnalysis({
        symbols,
        startDate,
        endDate,
      });

      // Calculate correlation matrix
      const correlations = {};
      for (const sym1 of symbols) {
        correlations[sym1] = {};
        for (const sym2 of symbols) {
          if (sym1 === sym2) {
            correlations[sym1][sym2] = 1;
          } else {
            // Simple correlation calculation
            const data1 = results[sym1]?.data || [];
            const data2 = results[sym2]?.data || [];
            
            // Align dates
            const dateMap1 = new Map(data1.map(d => [d.date.toISOString().split('T')[0], d.returnPercentage]));
            const dateMap2 = new Map(data2.map(d => [d.date.toISOString().split('T')[0], d.returnPercentage]));
            
            const commonDates = [...dateMap1.keys()].filter(d => dateMap2.has(d));
            
            if (commonDates.length > 10) {
              const returns1 = commonDates.map(d => dateMap1.get(d));
              const returns2 = commonDates.map(d => dateMap2.get(d));
              
              const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
              const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
              
              let numerator = 0;
              let denom1 = 0;
              let denom2 = 0;
              
              for (let i = 0; i < returns1.length; i++) {
                const diff1 = returns1[i] - mean1;
                const diff2 = returns2[i] - mean2;
                numerator += diff1 * diff2;
                denom1 += diff1 * diff1;
                denom2 += diff2 * diff2;
              }
              
              correlations[sym1][sym2] = parseFloat((numerator / Math.sqrt(denom1 * denom2)).toFixed(4));
            } else {
              correlations[sym1][sym2] = null;
            }
          }
        }
      }

      res.json({
        success: true,
        processingTime: Date.now() - startTime,
        data: {
          symbols,
          correlations,
          individualStats: Object.fromEntries(
            symbols.map(s => [s, results[s]?.statistics])
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// 11. CHART DATA
// =====================================================

/**
 * POST /analysis/chart
 * Get formatted chart data for visualization
 */
router.post('/chart', async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { symbol, startDate, endDate, chartType = 'candlestick' } = req.body;

    const result = await AnalysisService.getDailyAnalysis({
      symbols: [symbol],
      startDate,
      endDate,
    });

    const data = result[symbol]?.data || [];

    // Format for different chart types
    let chartData;
    switch (chartType) {
      case 'candlestick':
        chartData = data.map(d => ({
          x: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
        break;
      case 'line':
        chartData = data.map(d => ({
          x: d.date,
          y: d.close,
        }));
        break;
      case 'bar':
        chartData = data.map(d => ({
          x: d.date,
          y: d.returnPercentage,
          color: d.returnPercentage >= 0 ? 'green' : 'red',
        }));
        break;
      default:
        chartData = data;
    }

    res.json({
      success: true,
      processingTime: Date.now() - startTime,
      chartType,
      data: chartData,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
