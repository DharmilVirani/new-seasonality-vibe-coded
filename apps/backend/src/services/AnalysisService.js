/**
 * Analysis Service
 * Handles filtering, statistics calculation, and data processing for seasonality analysis
 */
const prisma = require('../utils/prisma');
const { cache } = require('../utils/redis');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Cache TTL: 24 hours in seconds
const CACHE_TTL = 24 * 60 * 60;

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(prefix, params) {
  const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
  return `analysis:${prefix}:${hash}`;
}

/**
 * Run async work with bounded concurrency and stable output ordering.
 */
async function runWithConcurrency(items, limit, worker) {
  const concurrency = Math.max(1, Math.min(limit || 1, items.length || 1));
  const results = new Array(items.length);
  let index = 0;

  const runWorker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

function applyResponseMode(result, params = {}) {
  const { responseMode = 'full', maxRows = null } = params;
  const normalizedMaxRows = Number.isFinite(Number(maxRows)) && Number(maxRows) > 0
    ? Math.floor(Number(maxRows))
    : null;

  if (result.tableData && normalizedMaxRows) {
    result.tableData = result.tableData.slice(0, normalizedMaxRows);
  }
  if (result.data && normalizedMaxRows) {
    result.data = result.data.slice(0, normalizedMaxRows);
  }

  if (responseMode === 'summary') {
    return {
      symbol: result.symbol,
      timeframe: result.timeframe,
      statistics: result.statistics,
      meta: result.meta
    };
  }

  if (responseMode === 'chartOnly') {
    return {
      symbol: result.symbol,
      timeframe: result.timeframe,
      statistics: result.statistics,
      chartData: result.chartData,
      meta: result.meta
    };
  }

  if (responseMode === 'tableOnly') {
    return {
      symbol: result.symbol,
      timeframe: result.timeframe,
      statistics: result.statistics,
      tableData: result.tableData || result.data || [],
      data: result.data || result.tableData || [],
      meta: result.meta
    };
  }

  return result;
}

/**
 * Calculate statistics from filtered data
 */
function calculateStatistics(records, returnField = 'returnPercentage') {
  if (!records || records.length === 0) {
    return {
      totalCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      avgReturnAll: 0,
      avgReturnPositive: 0,
      avgReturnNegative: 0,
      sumReturnAll: 0,
      sumReturnPositive: 0,
      sumReturnNegative: 0,
      cumulativeReturn: 0,
      winRate: 0,
      maxGain: 0,
      maxLoss: 0,
      maxDrawdown: 0,
      cagr: 0,
      sharpeRatio: 0,
      stdDev: 0
    };
  }

  const returns = records.map(r => r[returnField] || 0);
  const positiveReturns = returns.filter(r => r > 0);
  const negativeReturns = returns.filter(r => r < 0);

  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0;

  // Calculate compound cumulative return and track drawdown
  let cumulative = 1; // Start at 1 (100%)
  let peak = 1; // Track the highest point
  let maxDrawdown = 0; // Track maximum drawdown
  
  for (const ret of returns) {
    cumulative = cumulative * (1 + ret / 100);
    
    // Update peak if we've reached a new high
    if (cumulative > peak) {
      peak = cumulative;
    }
    
    // Calculate current drawdown from peak
    const drawdown = ((cumulative - peak) / peak) * 100;
    
    // Update max drawdown if current is worse
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  const cumulativeReturn = (cumulative - 1) * 100; // Convert to percentage

  // Calculate number of unique years
  const uniqueYears = new Set(records.map(r => new Date(r.date).getFullYear()));
  const numberOfYears = uniqueYears.size;

  // Calculate CAGR: ((ending_value / 100) ^ (1 / number_of_years)) - 1) * 100
  // cumulative is already the multiplier (e.g., 1.5 for 50% gain), so we use it directly
  let cagr = 0;
  if (numberOfYears > 0 && cumulative > 0) {
    cagr = (Math.pow(cumulative, 1 / numberOfYears) - 1) * 100;
  }
  
  // Calculate Standard Deviation
  const avgReturn = avg(returns);
  let stdDev = 0;
  if (returns.length > 1) {
    const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
    const sumSquaredDiffs = sum(squaredDiffs);
    stdDev = Math.sqrt(sumSquaredDiffs / returns.length);
  }

  // Calculate Sharpe Ratio: (avgReturn - riskFreeRate) / stdDev
  // Assuming risk-free rate of 0 for simplicity (can be parameterized later)
  const riskFreeRate = 0;
  let sharpeRatio = 0;
  if (stdDev !== 0) {
    sharpeRatio = (avgReturn - riskFreeRate) / stdDev;
  }

  return {
    totalCount: records.length,
    positiveCount: positiveReturns.length,
    negativeCount: negativeReturns.length,
    avgReturnAll: Number(avg(returns).toFixed(4)),
    avgReturnPositive: Number(avg(positiveReturns).toFixed(4)),
    avgReturnNegative: Number(avg(negativeReturns).toFixed(4)),
    sumReturnAll: Number(sum(returns).toFixed(4)),
    sumReturnPositive: Number(sum(positiveReturns).toFixed(4)),
    sumReturnNegative: Number(sum(negativeReturns).toFixed(4)),
    cumulativeReturn: Number(cumulativeReturn.toFixed(2)),
    winRate: Number(((positiveReturns.length / records.length) * 100).toFixed(2)),
    maxGain: Number(Math.max(...returns, 0).toFixed(4)),
    maxLoss: Number(Math.min(...returns, 0).toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    cagr: Number(cagr.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    stdDev: Number(stdDev.toFixed(4))
  };
}

/**
 * Calculate cumulative returns for chart data
 */
function calculateCumulativeReturns(records, returnField = 'returnPercentage') {
  let cumulative = 100; // Start at 100
  return records.map(record => {
    const returnPct = record[returnField] || 0;
    cumulative = cumulative * (1 + returnPct / 100);
    return {
      date: record.date,
      returnPercentage: record[returnField],
      cumulative: Number(cumulative.toFixed(4))
    };
  });
}

/**
 * Get election years for a specific category
 */
async function getElectionYears(category, country = 'INDIA') {
  const records = await prisma.electionYearCategory.findMany({
    where: { country, category },
    select: { year: true }
  });
  return records.map(r => r.year);
}

/**
 * Build WHERE clause for daily analysis filters
 */
async function buildDailyWhereClause(tickerId, params) {
  const { startDate, endDate, lastNDays, filters = {}, weekType = 'expiry' } = params;
  const where = { tickerId };

  // Date range filter
  if (lastNDays && lastNDays > 0) {
    // Will be handled separately with ORDER BY and LIMIT
  } else if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  // Year filters
  const yearFilters = filters.yearFilters || {};
  if (yearFilters.positiveNegativeYears === 'Positive') {
    where.positiveYear = true;
  } else if (yearFilters.positiveNegativeYears === 'Negative') {
    where.positiveYear = false;
  }

  if (yearFilters.evenOddYears === 'Even') {
    where.evenYear = true;
  } else if (yearFilters.evenOddYears === 'Odd') {
    where.evenYear = false;
  } else if (yearFilters.evenOddYears === 'Leap') {
    // Leap years: divisible by 4, except centuries not divisible by 400
    // This needs raw SQL, will handle in query
  } else if (yearFilters.evenOddYears === 'Election') {
    const electionYears = await getElectionYears('election');
    where.date = {
      ...where.date,
      // Will filter by year in raw query
    };
    where._electionYears = electionYears; // Custom marker for raw query
  }

  // Month filters
  const monthFilters = filters.monthFilters || {};
  if (monthFilters.positiveNegativeMonths === 'Positive') {
    where.positiveMonth = true;
  } else if (monthFilters.positiveNegativeMonths === 'Negative') {
    where.positiveMonth = false;
  }

  if (monthFilters.evenOddMonths === 'Even') {
    where.evenMonth = true;
  } else if (monthFilters.evenOddMonths === 'Odd') {
    where.evenMonth = false;
  }

  if (monthFilters.specificMonth && monthFilters.specificMonth > 0) {
    where._specificMonth = monthFilters.specificMonth; // Custom marker
  }

  // Week filters (based on weekType)
  const weekFilters = filters.weekFilters || {};
  if (weekType === 'expiry') {
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      where.positiveExpiryWeek = true;
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      where.positiveExpiryWeek = false;
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      where.evenExpiryWeekNumberMonthly = true;
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      where.evenExpiryWeekNumberMonthly = false;
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      where.evenExpiryWeekNumberYearly = true;
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      where.evenExpiryWeekNumberYearly = false;
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      where.expiryWeekNumberMonthly = weekFilters.specificWeekMonthly;
    }
  } else {
    // Monday week
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      where.positiveMondayWeek = true;
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      where.positiveMondayWeek = false;
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      where.evenMondayWeekNumberMonthly = true;
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      where.evenMondayWeekNumberMonthly = false;
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      where.evenMondayWeekNumberYearly = true;
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      where.evenMondayWeekNumberYearly = false;
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      where.mondayWeekNumberMonthly = weekFilters.specificWeekMonthly;
    }
  }

  // Day filters
  const dayFilters = filters.dayFilters || {};
  if (dayFilters.positiveNegativeDays === 'Positive') {
    where.positiveDay = true;
  } else if (dayFilters.positiveNegativeDays === 'Negative') {
    where.positiveDay = false;
  }

  if (dayFilters.weekdays && dayFilters.weekdays.length > 0 && dayFilters.weekdays.length < 5) {
    where.weekday = { in: dayFilters.weekdays };
  }

  if (dayFilters.evenOddCalendarDaysMonthly === 'Even') {
    where.evenCalendarMonthDay = true;
  } else if (dayFilters.evenOddCalendarDaysMonthly === 'Odd') {
    where.evenCalendarMonthDay = false;
  }

  if (dayFilters.evenOddCalendarDaysYearly === 'Even') {
    where.evenCalendarYearDay = true;
  } else if (dayFilters.evenOddCalendarDaysYearly === 'Odd') {
    where.evenCalendarYearDay = false;
  }

  if (dayFilters.evenOddTradingDaysMonthly === 'Even') {
    where.evenTradingMonthDay = true;
  } else if (dayFilters.evenOddTradingDaysMonthly === 'Odd') {
    where.evenTradingMonthDay = false;
  }

  if (dayFilters.evenOddTradingDaysYearly === 'Even') {
    where.evenTradingYearDay = true;
  } else if (dayFilters.evenOddTradingDaysYearly === 'Odd') {
    where.evenTradingYearDay = false;
  }

  // Outlier filters
  const outlierFilters = filters.outlierFilters || {};
  
  if (outlierFilters.dailyPercentageRange?.enabled) {
    where.returnPercentage = {
      gte: outlierFilters.dailyPercentageRange.min,
      lte: outlierFilters.dailyPercentageRange.max
    };
  }

  if (outlierFilters.weeklyPercentageRange?.enabled) {
    const weeklyField = weekType === 'expiry' ? 'expiryWeeklyReturnPercentage' : 'mondayWeeklyReturnPercentage';
    where[weeklyField] = {
      gte: outlierFilters.weeklyPercentageRange.min,
      lte: outlierFilters.weeklyPercentageRange.max
    };
  }

  if (outlierFilters.monthlyPercentageRange?.enabled) {
    where.monthlyReturnPercentage = {
      gte: outlierFilters.monthlyPercentageRange.min,
      lte: outlierFilters.monthlyPercentageRange.max
    };
  }

  if (outlierFilters.yearlyPercentageRange?.enabled) {
    where.yearlyReturnPercentage = {
      gte: outlierFilters.yearlyPercentageRange.min,
      lte: outlierFilters.yearlyPercentageRange.max
    };
  }

  return where;
}

/**
 * Filter records by decade years and other complex filters
 */
function applyComplexFilters(records, params) {
  const { filters = {} } = params;
  let filtered = [...records];

  // Decade years filter
  const decadeYears = filters.yearFilters?.decadeYears;
  if (decadeYears && decadeYears.length > 0 && decadeYears.length < 10) {
    const allowedDecadeDigits = decadeYears.map(d => d === 10 ? 0 : d);
    filtered = filtered.filter(r => {
      const year = new Date(r.date).getFullYear();
      const decadeDigit = year % 10;
      return allowedDecadeDigits.includes(decadeDigit);
    });
  }

  // Leap year filter
  if (filters.yearFilters?.evenOddYears === 'Leap') {
    filtered = filtered.filter(r => {
      const year = new Date(r.date).getFullYear();
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    });
  }

  // Specific month filter
  if (filters.monthFilters?.specificMonth > 0) {
    filtered = filtered.filter(r => {
      const month = new Date(r.date).getMonth() + 1;
      return month === filters.monthFilters.specificMonth;
    });
  }

  return filtered;
}

/**
 * Filter records by election years
 */
async function applyElectionYearFilter(records, category) {
  const electionYears = await getElectionYears(category);
  return records.filter(r => {
    const year = new Date(r.date).getFullYear();
    return electionYears.includes(year);
  });
}

class AnalysisService {
  /**
   * Daily Analysis - POST /analysis/daily
   */
  async dailyAnalysis(symbol, params) {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(`daily:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for daily analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Build where clause
    let where = await buildDailyWhereClause(ticker.id, params);
    
    // Remove custom markers before query
    const electionYears = where._electionYears;
    const specificMonth = where._specificMonth;
    delete where._electionYears;
    delete where._specificMonth;

    // Fetch data
    let records;
    if (params.lastNDays && params.lastNDays > 0) {
      records = await prisma.dailySeasonalityData.findMany({
        where: { tickerId: ticker.id },
        orderBy: { date: 'desc' },
        take: params.lastNDays
      });
      records = records.reverse(); // Oldest first
      
      // Apply other filters
      const filteredWhere = { ...where };
      delete filteredWhere.tickerId;
      delete filteredWhere.date;
      
      records = records.filter(r => {
        for (const [key, value] of Object.entries(filteredWhere)) {
          if (typeof value === 'object' && value !== null) {
            if (value.in && !value.in.includes(r[key])) return false;
            if (value.gte !== undefined && r[key] < value.gte) return false;
            if (value.lte !== undefined && r[key] > value.lte) return false;
          } else if (r[key] !== value) {
            return false;
          }
        }
        return true;
      });
    } else {
      records = await prisma.dailySeasonalityData.findMany({
        where,
        orderBy: { date: 'asc' }
      });
    }

    // Apply complex filters (decade years, leap years, specific month)
    records = applyComplexFilters(records, params);

    // Apply election year filter if needed
    if (electionYears) {
      records = records.filter(r => {
        const year = new Date(r.date).getFullYear();
        return electionYears.includes(year);
      });
    }

    // Calculate statistics
    const statistics = calculateStatistics(records);

    // Prepare chart data (cumulative returns)
    const chartData = calculateCumulativeReturns(records);

    // Prepare table data (full records with selected fields)
    const tableData = records.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      returnPercentage: r.returnPercentage,
      weekday: r.weekday,
      calendarYearDay: r.calendarYearDay,
      tradingYearDay: r.tradingYearDay,
      calendarMonthDay: r.calendarMonthDay,
      tradingMonthDay: r.tradingMonthDay,
      positiveDay: r.positiveDay
    }));

    const result = {
      symbol: ticker.symbol,
      timeframe: 'daily',
      statistics,
      chartData,
      tableData,
      // Frontend expects 'data' field for charts and tables
      data: tableData,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: records.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return applyResponseMode(result, params);
  }


  /**
   * Daily Aggregate Analysis - POST /analysis/daily/aggregate
   * Aggregates data by field (weekday, calendar day, trading day, month, etc.)
   */
  async dailyAggregateAnalysis(symbol, params) {
    const startTime = Date.now();
    const { aggregateField = 'weekday', aggregateType = 'avg' } = params;
    const cacheKey = generateCacheKey(`daily-aggregate:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for daily aggregate analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // First get filtered daily data (single source of truth to avoid redundant re-querying)
    const dailyResult = await this.dailyAnalysis(symbol, params);
    const fullRecords = dailyResult.tableData;

    if (fullRecords.length === 0) {
      return applyResponseMode({
        symbol,
        timeframe: 'daily-aggregate',
        aggregateField,
        aggregateType,
        data: [],
        meta: { processingTime: Date.now() - startTime, recordsAnalyzed: 0 }
      }, params);
    }

    // Group by aggregate field
    const fieldMapping = {
      'weekday': 'weekday',
      'CalenderYearDay': 'calendarYearDay',
      'TradingYearDay': 'tradingYearDay',
      'CalenderMonthDay': 'calendarMonthDay',
      'TradingMonthDay': 'tradingMonthDay',
      'MonthNumber': 'month'
    };

    const groupField = fieldMapping[aggregateField] || aggregateField;
    const groups = {};

    // Group records
    for (const record of fullRecords) {
      let key;
      if (groupField === 'month') {
        key = new Date(record.date).getMonth() + 1;
      } else if (groupField === 'calendarYearDay') {
        key = record.calendarYearDay;
      } else if (groupField === 'tradingYearDay') {
        key = record.tradingYearDay;
      } else if (groupField === 'calendarMonthDay') {
        key = record.calendarMonthDay;
      } else if (groupField === 'tradingMonthDay') {
        key = record.tradingMonthDay;
      } else {
        key = record[groupField];
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record.returnPercentage || 0);
    }

    // Calculate aggregates
    const aggregatedData = Object.entries(groups).map(([key, values]) => {
      const positiveValues = values.filter(v => v > 0);
      const negativeValues = values.filter(v => v < 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = values.length > 0 ? sum / values.length : 0;

      let value;
      switch (aggregateType) {
        case 'total':
        case 'sum':
          value = sum;
          break;
        case 'max':
          value = Math.max(...values);
          break;
        case 'min':
          value = Math.min(...values);
          break;
        case 'avg':
        default:
          value = avg;
      }

      return {
        [aggregateField]: key,
        value: Number(value.toFixed(4)),
        count: values.length,
        positiveCount: positiveValues.length,
        negativeCount: negativeValues.length,
        avgReturn: Number(avg.toFixed(4)),
        sumReturn: Number(sum.toFixed(4)),
        winRate: Number(((positiveValues.length / values.length) * 100).toFixed(2))
      };
    });

    // Sort by key
    aggregatedData.sort((a, b) => {
      const keyA = a[aggregateField];
      const keyB = b[aggregateField];
      if (typeof keyA === 'number') return keyA - keyB;
      return String(keyA).localeCompare(String(keyB));
    });

    const result = {
      symbol,
      timeframe: 'daily-aggregate',
      aggregateField,
      aggregateType,
      data: aggregatedData,
      statistics: calculateStatistics(fullRecords),
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: fullRecords.length,
        groupsCreated: aggregatedData.length
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return applyResponseMode(result, params);
  }

  /**
   * Weekly Analysis - POST /analysis/weekly
   * Uses monday_weekly_data or expiry_weekly_data based on weekType
   */
  async weeklyAnalysis(symbol, params) {
    const startTime = Date.now();
    const { weekType = 'expiry' } = params;
    const cacheKey = generateCacheKey(`weekly:${weekType}:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for weekly analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Build where clause
    const where = { tickerId: ticker.id };
    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      where.positiveYear = true;
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      where.positiveYear = false;
    }

    if (yearFilters.evenOddYears === 'Even') {
      where.evenYear = true;
    } else if (yearFilters.evenOddYears === 'Odd') {
      where.evenYear = false;
    }

    // Month filters
    const monthFilters = filters.monthFilters || {};
    if (monthFilters.positiveNegativeMonths === 'Positive') {
      where.positiveMonth = true;
    } else if (monthFilters.positiveNegativeMonths === 'Negative') {
      where.positiveMonth = false;
    }

    if (monthFilters.evenOddMonths === 'Even') {
      where.evenMonth = true;
    } else if (monthFilters.evenOddMonths === 'Odd') {
      where.evenMonth = false;
    }

    // Week filters
    const weekFilters = filters.weekFilters || {};
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      where.positiveWeek = true;
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      where.positiveWeek = false;
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      where.evenWeekNumberMonthly = true;
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      where.evenWeekNumberMonthly = false;
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      where.evenWeekNumberYearly = true;
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      where.evenWeekNumberYearly = false;
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      where.weekNumberMonthly = weekFilters.specificWeekMonthly;
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.weeklyPercentageRange?.enabled) {
      where.returnPercentage = {
        gte: outlierFilters.weeklyPercentageRange.min,
        lte: outlierFilters.weeklyPercentageRange.max
      };
    }

    if (outlierFilters.monthlyPercentageRange?.enabled) {
      where.monthlyReturnPercentage = {
        gte: outlierFilters.monthlyPercentageRange.min,
        lte: outlierFilters.monthlyPercentageRange.max
      };
    }

    if (outlierFilters.yearlyPercentageRange?.enabled) {
      where.yearlyReturnPercentage = {
        gte: outlierFilters.yearlyPercentageRange.min,
        lte: outlierFilters.yearlyPercentageRange.max
      };
    }

    // Select table based on weekType
    const model = weekType === 'expiry' ? prisma.expiryWeeklyData : prisma.mondayWeeklyData;

    let records = await model.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Apply complex filters
    records = applyComplexFilters(records, params);

    // Calculate statistics
    const statistics = calculateStatistics(records);

    // Prepare chart data
    const chartData = calculateCumulativeReturns(records);

    // Prepare table data
    const tableData = records.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      returnPercentage: r.returnPercentage,
      weekday: r.weekday,
      weekNumberMonthly: r.weekNumberMonthly,
      weekNumberYearly: r.weekNumberYearly,
      positiveWeek: r.positiveWeek
    }));

    const result = {
      symbol: ticker.symbol,
      timeframe: `${weekType}-weekly`,
      statistics,
      chartData,
      tableData,
      // Frontend expects 'data' field for charts and tables
      data: tableData,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: records.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return applyResponseMode(result, params);
  }


  /**
   * Monthly Analysis - POST /analysis/monthly
   */
  async monthlyAnalysis(symbol, params) {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(`monthly:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for monthly analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Build where clause
    const where = { tickerId: ticker.id };
    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      where.positiveYear = true;
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      where.positiveYear = false;
    }

    if (yearFilters.evenOddYears === 'Even') {
      where.evenYear = true;
    } else if (yearFilters.evenOddYears === 'Odd') {
      where.evenYear = false;
    }

    // Month filters
    const monthFilters = filters.monthFilters || {};
    if (monthFilters.positiveNegativeMonths === 'Positive') {
      where.positiveMonth = true;
    } else if (monthFilters.positiveNegativeMonths === 'Negative') {
      where.positiveMonth = false;
    }

    if (monthFilters.evenOddMonths === 'Even') {
      where.evenMonth = true;
    } else if (monthFilters.evenOddMonths === 'Odd') {
      where.evenMonth = false;
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.monthlyPercentageRange?.enabled) {
      where.returnPercentage = {
        gte: outlierFilters.monthlyPercentageRange.min,
        lte: outlierFilters.monthlyPercentageRange.max
      };
    }

    if (outlierFilters.yearlyPercentageRange?.enabled) {
      where.yearlyReturnPercentage = {
        gte: outlierFilters.yearlyPercentageRange.min,
        lte: outlierFilters.yearlyPercentageRange.max
      };
    }

    let records = await prisma.monthlySeasonalityData.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Apply complex filters
    records = applyComplexFilters(records, params);

    // Apply specific month filter
    if (monthFilters.specificMonth && monthFilters.specificMonth > 0) {
      records = records.filter(r => {
        const month = new Date(r.date).getMonth() + 1;
        return month === monthFilters.specificMonth;
      });
    }

    // Calculate statistics
    const statistics = calculateStatistics(records);

    // Prepare chart data
    const chartData = calculateCumulativeReturns(records);

    // Prepare table data
    const tableData = records.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      returnPercentage: r.returnPercentage,
      positiveMonth: r.positiveMonth,
      evenMonth: r.evenMonth
    }));

    const result = {
      symbol: ticker.symbol,
      timeframe: 'monthly',
      statistics,
      chartData,
      tableData,
      // Frontend expects 'data' field for charts and tables
      data: tableData,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: records.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return applyResponseMode(result, params);
  }

  /**
   * Yearly Analysis - POST /analysis/yearly
   */
  async yearlyAnalysis(symbol, params) {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(`yearly:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for yearly analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Build where clause
    const where = { tickerId: ticker.id };
    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      where.positiveYear = true;
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      where.positiveYear = false;
    }

    if (yearFilters.evenOddYears === 'Even') {
      where.evenYear = true;
    } else if (yearFilters.evenOddYears === 'Odd') {
      where.evenYear = false;
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.yearlyPercentageRange?.enabled) {
      where.returnPercentage = {
        gte: outlierFilters.yearlyPercentageRange.min,
        lte: outlierFilters.yearlyPercentageRange.max
      };
    }

    let records = await prisma.yearlySeasonalityData.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    // Apply complex filters (decade years, leap years, election years)
    records = applyComplexFilters(records, params);

    // Apply election year filter
    if (yearFilters.evenOddYears === 'Election') {
      const electionYears = await getElectionYears('election');
      records = records.filter(r => {
        const year = new Date(r.date).getFullYear();
        return electionYears.includes(year);
      });
    }

    // Calculate statistics
    const statistics = calculateStatistics(records);

    // Prepare chart data
    const chartData = calculateCumulativeReturns(records);

    // Prepare table data
    const tableData = records.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      returnPercentage: r.returnPercentage,
      positiveYear: r.positiveYear,
      evenYear: r.evenYear
    }));

    const result = {
      symbol: ticker.symbol,
      timeframe: 'yearly',
      statistics,
      chartData,
      tableData,
      // Frontend expects 'data' field for charts and tables
      data: tableData,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: records.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return applyResponseMode(result, params);
  }

  /**
   * Scenario Analysis - POST /analysis/scenario
   * Implements the 4 main scenario features:
   * 1. Historic Trending Days
   * 2. Trending Streak
   * 3. Momentum Ranking
   * 4. Watchlist Analysis
   */
  async scenarioAnalysis(symbol, params) {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(`scenario:${symbol}`, params);

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for scenario analysis: ${symbol}`);
      return { ...cached, fromCache: true };
    }

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Get filtered daily data first
    const dailyResult = await this.dailyAnalysis(symbol, params);
    const records = dailyResult.tableData;

    // Reuse already-filtered daily dataset to avoid duplicate database reads
    const fullRecords = dailyResult.tableData;

    // 1. Historic Trending Days
    const historicTrend = this.calculateHistoricTrend(
      fullRecords,
      params.historicTrendType || 'Bullish',
      params.consecutiveDays || 3,
      params.dayRange || 10
    );

    // 2. Trending Streak (placeholder - needs more complex logic)
    const trendingStreak = this.calculateTrendingStreak(
      fullRecords,
      params.trendingStreakValue || 5,
      params.trendingStreakType || 'less',
      params.trendingStreakPercent || 0
    );

    // 3. Momentum Ranking (placeholder - needs watchlist data)
    const momentumRanking = [];

    // 4. Watchlist Analysis (placeholder - needs watchlist data)
    const watchlistAnalysis = null;

    const result = {
      symbol: ticker.symbol,
      timeframe: 'scenario',
      historicTrend,
      trendingStreak,
      momentumRanking,
      watchlistAnalysis,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: fullRecords.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Calculate Historic Trending Days
   * Finds days after N consecutive bullish/bearish days
   * and calculates superimposed returns
   */
  calculateHistoricTrend(records, trendType, consecutiveDays, dayRange) {
    if (!records || records.length === 0) {
      return null;
    }

    // Get return points (we'll use returnPercentage as proxy)
    const returns = records.map(r => r.returnPercentage || 0);
    
    // Find consecutive trending days
    const trendingDates = [];
    let consecutiveCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const ret = returns[i];
      const isTrending = trendType === 'Bullish' ? ret > 0 : ret < 0;
      
      if (isTrending) {
        consecutiveCount++;
        if (consecutiveCount === consecutiveDays) {
          trendingDates.push(i);
          consecutiveCount = 0; // Reset to find next occurrence
        }
      } else {
        consecutiveCount = 0;
      }
    }

    // Calculate returns before and after each trending date
    const columns = [];
    for (let i = -dayRange; i < 0; i++) {
      columns.push(`T${i}`);
    }
    columns.push('T');
    for (let i = 1; i <= dayRange; i++) {
      columns.push(`T+${i}`);
    }

    const tableData = [];
    for (const trendIdx of trendingDates) {
      const row = { date: records[trendIdx].date };
      
      // Before days
      for (let i = -dayRange; i < 0; i++) {
        const idx = trendIdx + i;
        row[`T${i}`] = idx >= 0 ? (returns[idx] || 0).toFixed(2) : null;
      }
      
      // Current day
      row['T'] = (returns[trendIdx] || 0).toFixed(2);
      
      // After days
      for (let i = 1; i <= dayRange; i++) {
        const idx = trendIdx + i;
        row[`T+${i}`] = idx < returns.length ? (returns[idx] || 0).toFixed(2) : null;
      }
      
      tableData.push(row);
    }

    // Calculate statistics for each column
    const statistics = {};
    for (const col of columns) {
      const values = tableData.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
      if (values.length > 0) {
        const positiveValues = values.filter(v => v > 0);
        const negativeValues = values.filter(v => v < 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        
        statistics[col] = {
          count: values.length,
          positiveCount: positiveValues.length,
          negativeCount: negativeValues.length,
          avgReturn: Number(avg.toFixed(4)),
          sumReturn: Number(sum.toFixed(4))
        };
      }
    }

    // Calculate superimposed returns (compounded)
    const superimposedReturns = [];
    let cumulative = 1;
    for (const col of columns) {
      const avgReturn = statistics[col]?.avgReturn || 0;
      cumulative = cumulative * (1 + avgReturn / 100);
      superimposedReturns.push({
        day: col,
        value: Number(((cumulative - 1) * 100).toFixed(2))
      });
    }

    return {
      trendType,
      consecutiveDays,
      dayRange,
      columns,
      tableData: tableData.slice(0, 100), // Limit to 100 rows
      statistics,
      superimposedReturns,
      totalOccurrences: trendingDates.length
    };
  }

  /**
   * Calculate Trending Streak
   * Finds streaks of consecutive days with specific characteristics
   */
  calculateTrendingStreak(records, streakValue, streakType, percentThreshold) {
    if (!records || records.length === 0) {
      return [];
    }

    const streaks = [];
    let currentStreak = null;
    let streakCount = 0;

    for (let i = 0; i < records.length; i++) {
      const ret = records[i].returnPercentage || 0;
      const meetsCondition = streakType === 'more' ? ret > percentThreshold : ret < percentThreshold;

      if (meetsCondition) {
        if (!currentStreak) {
          currentStreak = {
            startDate: records[i].date,
            startClose: records[i].close,
            startIdx: i
          };
        }
        streakCount++;
      } else {
        if (currentStreak && streakCount >= streakValue) {
          const endIdx = i - 1;
          const percentChange = ((records[endIdx].close - currentStreak.startClose) / currentStreak.startClose) * 100;
          
          streaks.push({
            startDate: currentStreak.startDate,
            startClose: currentStreak.startClose,
            endDate: records[endIdx].date,
            endClose: records[endIdx].close,
            totalDays: streakCount,
            percentChange: Number(percentChange.toFixed(2))
          });
        }
        currentStreak = null;
        streakCount = 0;
      }
    }

    // Check last streak
    if (currentStreak && streakCount >= streakValue) {
      const endIdx = records.length - 1;
      const percentChange = ((records[endIdx].close - currentStreak.startClose) / currentStreak.startClose) * 100;
      
      streaks.push({
        startDate: currentStreak.startDate,
        startClose: currentStreak.startClose,
        endDate: records[endIdx].date,
        endClose: records[endIdx].close,
        totalDays: streakCount,
        percentChange: Number(percentChange.toFixed(2))
      });
    }

    return streaks;
  }

  /**
   * Symbol Scanner - Find symbols with N consecutive trending days
   */
  async scanner(params) {
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
    } = params;

    // Extract all filter options
    const {
      evenOddYears = 'All',       // All, Even, Odd, Leap
      specificMonths = [],        // [] = All, [1,2,3] = Jan-Mar
      specificExpiryWeeksMonthly = [], // [] = All, [1,2] = 1st and 2nd week
      specificMondayWeeksMonthly = [],  // [] = All, [1,2] = 1st and 2nd week
      yearFilters = {},
      monthFilters = {}
    } = filters;


    const {
      minAccuracy = 60,
      minTotalPnl = 1.5,
      minSampleSize = 50,
      minAvgPnl = 0.2,
      operations = { op12: 'OR', op23: 'OR', op34: 'OR' }
    } = criteria;


    // Get all tickers if no symbols specified
    let tickers;
    if (symbols.length > 0) {
      tickers = await prisma.ticker.findMany({
        where: {
          symbol: { in: symbols.map(s => s.toUpperCase()) },
          isActive: true
        },
        select: { id: true, symbol: true, name: true }
      });
    } else {
      tickers = await prisma.ticker.findMany({
        where: { isActive: true },
        select: { id: true, symbol: true, name: true },
        orderBy: { symbol: 'asc' }
      });
    }

    const results = [];
    const trendMultiplier = trendType === 'Bullish' ? 1 : -1;

    // Build filter conditions
    const buildFilterConditions = () => {
      const conditions = {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        },
        tradingMonthDay: { not: null }
      };

      // Positive/Negative Years filter
      if (yearFilters.positiveNegativeYears === 'Positive') {
        conditions.positiveYear = true;
      } else if (yearFilters.positiveNegativeYears === 'Negative') {
        conditions.positiveYear = false;
      }

      // Even/Odd Years filter
      if (evenOddYears === 'Even') {
        conditions.evenYear = true;
      } else if (evenOddYears === 'Odd') {
        conditions.evenYear = false;
      } else if (evenOddYears === 'Leap') {
        // Leap years - handled in application
      }

      // Decade Years filter (last digit of year)
      const decadeYears = yearFilters.decadeYears || [1,2,3,4,5,6,7,8,9,10];
      if (decadeYears.length < 10) {
        conditions._decadeYears = decadeYears; // Custom marker for application filter
      }

      // Positive/Negative Months filter
      if (monthFilters.positiveNegativeMonths === 'Positive') {
        conditions.positiveMonth = true;
      } else if (monthFilters.positiveNegativeMonths === 'Negative') {
        conditions.positiveMonth = false;
      }

      // Specific Months filter - handled in application (after fetch) to allow multiple months
      // Specific Expiry Week Monthly filter - handled in application (after fetch) to allow multiple weeks
      // Specific Monday Week Monthly filter - handled in application (after fetch) to allow multiple weeks

      return conditions;
    };

    const processTicker = async (ticker, tickerOrder) => {
      try {
        // Build the filter conditions
        const filterConditions = buildFilterConditions();
        filterConditions.tickerId = ticker.id;

        // Fetch daily data for the ticker
        const dailyData = await prisma.dailySeasonalityData.findMany({
          where: filterConditions,
          select: {
            date: true,
            tradingMonthDay: true,
            returnPercentage: true,
            positiveDay: true,
            evenYear: true,
            expiryWeekNumberMonthly: true,
            mondayWeekNumberMonthly: true,
            expiryWeeklyDate: true,
            mondayWeeklyDate: true
          },
          orderBy: { date: 'asc' }
        });

        // Apply Leap Year filter in application if needed
        let filteredData = dailyData;
        if (evenOddYears === 'Leap') {
          filteredData = dailyData.filter(d => {
            const year = new Date(d.date).getFullYear();
            return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
          });
        }

        // Apply Decade Years filter in application if needed
        const decadeYears = yearFilters.decadeYears || [1,2,3,4,5,6,7,8,9,10];
        if (decadeYears.length < 10) {
          filteredData = filteredData.filter(d => {
            const year = new Date(d.date).getFullYear();
            const lastDigit = year % 10;
            const decadeYear = lastDigit === 0 ? 10 : lastDigit;
            return decadeYears.includes(decadeYear);
          });
        }

        // Apply specific months filter in application if needed (supports multiple months)
        if (specificMonths.length > 0) {
          filteredData = filteredData.filter(d => {
            const month = new Date(d.date).getMonth() + 1; // 1-12
            return specificMonths.includes(month);
          });
        }

        // Apply specific expiry weeks filter in application if needed (supports multiple weeks)
        // Old-software parity:
        // 1) always filter by ExpiryWeekNumberMonthly
        // 2) if month filter is active, additionally match ExpiryWeeklyDate month
        if (specificExpiryWeeksMonthly.length > 0) {
          filteredData = filteredData.filter(d => {
            if (!d.expiryWeekNumberMonthly || !specificExpiryWeeksMonthly.includes(d.expiryWeekNumberMonthly)) {
              return false;
            }

            if (specificMonths.length > 0) {
              if (!d.expiryWeeklyDate) return false;
              const expiryMonth = new Date(d.expiryWeeklyDate).getMonth() + 1;
              return specificMonths.includes(expiryMonth);
            }

            return true;
          });
        }

        // Apply specific monday weeks filter in application if needed (supports multiple weeks)
        // Old-software parity:
        // 1) always filter by MondayWeekNumberMonthly
        // 2) if month filter is active, additionally match MondayWeeklyDate month
        if (specificMondayWeeksMonthly.length > 0) {
          filteredData = filteredData.filter(d => {
            if (!d.mondayWeekNumberMonthly || !specificMondayWeeksMonthly.includes(d.mondayWeekNumberMonthly)) {
              return false;
            }

            if (specificMonths.length > 0) {
              if (!d.mondayWeeklyDate) return false;
              const mondayMonth = new Date(d.mondayWeeklyDate).getMonth() + 1;
              return specificMonths.includes(mondayMonth);
            }

            return true;
          });
        }

        if (filteredData.length === 0) return null;

        // Group by tradingMonthDay and track actual dates with year and month
        const dayGroups = {};
        filteredData.forEach(record => {
          const day = record.tradingMonthDay;
          const date = new Date(record.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1; // 1-12
          const yearMonth = `${year}-${month}`;
          if (!dayGroups[day]) {
            dayGroups[day] = {
              day,
              returns: [],
              dates: [],
              years: [],
              months: [],
              yearMonths: [],
              positiveCount: 0,
              negativeCount: 0,
              totalCount: 0
            };
          }
          dayGroups[day].returns.push(record.returnPercentage || 0);
          dayGroups[day].dates.push(record.date);
          dayGroups[day].years.push(year);
          dayGroups[day].months.push(month);
          dayGroups[day].yearMonths.push(yearMonth);
          dayGroups[day].totalCount++;
          if ((record.returnPercentage || 0) > 0) {
            dayGroups[day].positiveCount++;
          } else if ((record.returnPercentage || 0) < 0) {
            dayGroups[day].negativeCount++;
          }
        });

        // Calculate stats for each trading day
        const dayStats = Object.values(dayGroups).map(group => {
          const sum = group.returns.reduce((a, b) => a + b, 0);
          const avg = sum / group.returns.length;
          const accuracy = group.totalCount > 0 ? (group.positiveCount / group.totalCount) * 100 : 0;
          
          // Sort dates to get first and last
          const validDates = group.dates.filter(d => d != null && d != undefined);
          const sortedDates = validDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          const firstDate = sortedDates[0] ? sortedDates[0] : null;
          const lastDate = sortedDates[sortedDates.length - 1] ? sortedDates[sortedDates.length - 1] : null;
          
          // Format date as dd/mm/yyyy
          const formatDate = (date) => {
            if (!date) return '';
            try {
              const d = new Date(date);
              if (isNaN(d.getTime())) return '';
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              return `${dd}/${mm}/${yyyy}`;
            } catch (e) {
              return '';
            }
          };

          // Build year occurrences array - take only ONE occurrence per year-month combination
          const yearMonthSeen = new Set();
          const yearList = [];
          
          group.dates.forEach((date, idx) => {
            const yearMonth = group.yearMonths[idx];
            const year = group.years[idx];
            const month = group.months[idx];
            const returnPct = group.returns[idx];
            
            // Only take first occurrence for each year-month
            if (!yearMonthSeen.has(yearMonth)) {
              yearMonthSeen.add(yearMonth);
              yearList.push({
                year,
                month,
                startDate: formatDate(date),
                endDate: formatDate(date), // Same as start for single day
                totalReturn: returnPct,
                positive: returnPct > 0
              });
            }
          });
          
          // Sort by year then month
          yearList.sort((a, b) => a.year - b.year || a.month - b.month);

          return {
            tradingDay: group.day,
            allCount: group.totalCount,
            avgReturnAll: avg,
            sumReturnAll: sum,
            positiveCount: group.positiveCount,
            negativeCount: group.negativeCount,
            positiveAccuracy: accuracy,
            negativeAccuracy: group.totalCount > 0 ? (group.negativeCount / group.totalCount) * 100 : 0,
            avgReturnPos: group.positiveCount > 0 
              ? group.returns.filter(r => r > 0).reduce((a, b) => a + b, 0) / group.positiveCount 
              : 0,
            avgReturnNeg: group.negativeCount > 0 
              ? group.returns.filter(r => r < 0).reduce((a, b) => a + b, 0) / group.negativeCount 
              : 0,
            firstDate: formatDate(firstDate),
            lastDate: formatDate(lastDate),
            yearOccurrences: yearList
          };
        }).sort((a, b) => a.tradingDay - b.tradingDay);

        // Find N consecutive trending days
        const matchingChunks = this.findConsecutiveTrendingDays(
          dayStats,
          consecutiveDays,
          minAccuracy,
          minTotalPnl,
          minSampleSize,
          minAvgPnl,
          trendMultiplier,
          operations
        );

        if (matchingChunks.length > 0) {
          return {
            symbol: ticker.symbol,
            name: ticker.name,
            _order: tickerOrder,
            matchCount: matchingChunks.length,
            matches: matchingChunks.map(chunk => ({
              startDay: chunk.startDay,
              endDay: chunk.endDay,
              totalDays: chunk.totalDays,
              sampleSize: chunk.sampleSize,
              accuracy: chunk.accuracy,
              avgPnl: chunk.avgPnl,
              totalPnl: chunk.totalPnl,
              startDate: chunk.startDate || '',
              endDate: chunk.endDate || '',
              firstMatchDate: chunk.firstMatchDate || '',
              lastMatchDate: chunk.lastMatchDate || '',
              yearOccurrences: chunk.yearOccurrences || []
            }))
          };
        }
        return null;
      } catch (error) {
        logger.error(`Scanner error for ${ticker.symbol}:`, error.message);
        return null;
      }
    };

    const processed = await runWithConcurrency(tickers, 6, processTicker);
    processed.forEach((entry) => {
      if (entry) results.push(entry);
    });

    // Sort by match count descending, then original ticker order to preserve deterministic tie behavior
    results.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a._order - b._order;
    });

    const normalizedMaxRows = Number.isFinite(Number(maxRows)) && Number(maxRows) > 0
      ? Math.floor(Number(maxRows))
      : null;
    const shapedResultsBase = responseMode === 'summary'
      ? results.map(({ symbol: s, name, matchCount }) => ({ symbol: s, name, matchCount }))
      : results.map(({ _order, ...rest }) => rest);
    const shapedResults = normalizedMaxRows ? shapedResultsBase.slice(0, normalizedMaxRows) : shapedResultsBase;

    return {
      totalSymbols: tickers.length,
      matchedSymbols: results.length,
      returnedRows: shapedResults.length,
      results: shapedResults
    };
  }

  /**
   * Find N consecutive trending days matching criteria
   */
  findConsecutiveTrendingDays(
    dayStats,
    consecutiveDays,
    minAccuracy,
    minTotalPnl,
    minSampleSize,
    minAvgPnl,
    trendMultiplier,
    operations
  ) {
    const chunks = [];
    let i = 0;

    while (i <= dayStats.length - consecutiveDays) {
      const chunk = dayStats.slice(i, i + consecutiveDays);
      
      // Check if all days in chunk have returns in the trending direction
      const allTrending = chunk.every(day => 
        (day.sumReturnAll * trendMultiplier) > 0
      );

      if (!allTrending) {
        i += 1;
        continue;
      }

      // Calculate aggregated stats
      // Old-software uses sum of "Avg Return All" across the chunk for threshold B.
      const totalPnl = chunk.reduce((sum, day) => sum + day.avgReturnAll, 0);
      const avgPnl = totalPnl / consecutiveDays;
      const avgAccuracy = chunk.reduce((sum, day) => sum + day.positiveAccuracy, 0) / consecutiveDays;

      // Apply criteria with operations - OLD SOFTWARE LOGIC: EACH day must exceed the threshold
      const accuracyCheck = chunk.every(day =>
        (trendMultiplier === 1 ? day.positiveAccuracy : day.negativeAccuracy) > minAccuracy
      );
      const totalPnlCheck = (totalPnl * trendMultiplier) > minTotalPnl;
      const sampleSizeCheck = chunk.every(day => day.allCount > minSampleSize);
      // Old scanner checks this raw against Avg Return All (no bearish sign inversion).
      const avgPnlCheck = chunk.every(day => day.avgReturnAll > minAvgPnl);

      let passes = false;
      if (operations.op12 === 'OR') {
        passes = accuracyCheck || totalPnlCheck;
      } else {
        passes = accuracyCheck && totalPnlCheck;
      }

      if (operations.op23 === 'OR') {
        passes = passes || sampleSizeCheck;
      } else {
        passes = passes && sampleSizeCheck;
      }

      if (operations.op34 === 'OR') {
        passes = passes || avgPnlCheck;
      } else {
        passes = passes && avgPnlCheck;
      }

      if (passes) {
        // For year occurrences - show ALL year-months (both positive and negative) to match old software
        // Show correct date range for the specific trading days
        const yearOccurrences = [];
        
        // Get all year-month combinations from the first day in chunk
        const firstDayYearMonths = chunk[0].yearOccurrences || [];
        
        firstDayYearMonths.forEach(firstDayYM => {
          const year = firstDayYM.year;
          const month = firstDayYM.month;
          let allPositive = true;
          let anyNegative = false;
          let totalReturn = 0;
          let startDate = '';
          let endDate = '';
          
          // Check each trading day in the chunk for this same year-month
          chunk.forEach(day => {
            const dayData = day.yearOccurrences?.find(y => y.year === year && y.month === month);
            if (!dayData) {
              allPositive = false;
              anyNegative = true;
            } else {
              totalReturn += dayData.totalReturn;
              if (dayData.totalReturn <= 0) {
                anyNegative = true;
              }
              if (!startDate) startDate = dayData.startDate;
              endDate = dayData.endDate;
            }
          });
          
          // Include ALL year-months (both positive and negative) - match old software
          yearOccurrences.push({
            year,
            month,
            startDate,
            endDate,
            totalReturn,
            positive: totalReturn > 0
          });
        });

        // Sort by year then month
        yearOccurrences.sort((a, b) => a.year - b.year || a.month - b.month);

        chunks.push({
          startDay: chunk[0].tradingDay,
          endDay: chunk[consecutiveDays - 1].tradingDay,
          totalDays: consecutiveDays,
          sampleSize: chunk[0].allCount, // Original count - matches old software
          accuracy: avgAccuracy,
          avgPnl,
          totalPnl,
          // Add actual dates for each match
          startDate: chunk[0].firstDate,
          endDate: chunk[chunk.length - 1].lastDate,
          firstMatchDate: chunk[0].firstDate,
          lastMatchDate: chunk[chunk.length - 1].lastDate,
          // Add year occurrences for drill-down - ALL year-months (positive + negative)
          yearOccurrences: yearOccurrences
        });
        // Old software skips overlapping windows once a match is found.
        i += consecutiveDays;
        continue;
      }
      i += 1;
    } // while

    return chunks;
  }

  /**
   * Phenomena Backtester
   * Backtest trading strategy based on phenomena days (days around month end)
   */
  async backtestPhenomena({
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
  }) {
    // Get ticker ID
    const ticker = await prisma.ticker.findUnique({
      where: { symbol }
    });

    if (!ticker) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    // Build where clause
    let where = {
      tickerId: ticker.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };

    // Don't apply year filters in Prisma - we'll filter in JavaScript to match old software exactly
    // Fetch all data first
    const data = await prisma.dailySeasonalityData.findMany({
      where,
      orderBy: { date: 'asc' },
      select: {
        date: true,
        close: true,
        open: true,
        high: true,
        low: true,
        weekday: true,
        calendarYearDay: true,
        tradingYearDay: true,
        calendarMonthDay: true,
        tradingMonthDay: true,
        returnPercentage: true,
        returnPoints: true,
        expiryWeekNumberMonthly: true,
        mondayWeekNumberMonthly: true,
        evenYear: true,
        evenMonth: true
      }
    });

    const applySharedBacktestFilters = (rows) => {
      let output = rows;

      if (specificMonth) {
        output = output.filter(d => {
          const month = new Date(d.date).getMonth() + 1;
          return month === specificMonth;
        });
      }

      if (evenOddYears === 'Leap') {
        output = output.filter(d => {
          const year = new Date(d.date).getFullYear();
          return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        });
      } else if (evenOddYears === 'Even') {
        output = output.filter(d => d.evenYear === true);
      } else if (evenOddYears === 'Odd') {
        output = output.filter(d => d.evenYear === false);
      }

      if (specificExpiryWeek) {
        output = output.filter(d => d.expiryWeekNumberMonthly === specificExpiryWeek);
      }

      if (specificMondayWeek) {
        output = output.filter(d => d.mondayWeekNumberMonthly === specificMondayWeek);
      }

      return output;
    };

    let filteredData = applySharedBacktestFilters(data);

    if (!filteredData || filteredData.length === 0) {
      return {
        initialCapital,
        finalCapital: initialCapital,
        totalReturn: 0,
        totalTrades: 0,
        tradeList: [],
        statisticsReport: [],
        queryOneData: [],
        heatmapData: [],
        walkForwardData: { chartType: walkForwardType, xAxisTitle: 'Days', yAxisTitle: 'Compounded Percentage Return', series: [] }
      };
    }

    // Find month-end dates - match old software logic exactly
    // Old: df[df['Date'].dt.month != df['Date'].shift(-1).dt.month][:-1]
    // This finds dates where next row's month is different, excludes last row
    const monthEndDates = [];
    for (let i = 0; i < filteredData.length - 1; i++) {
      const currentMonth = new Date(filteredData[i].date).getMonth();
      const nextMonth = new Date(filteredData[i + 1].date).getMonth();
      if (currentMonth !== nextMonth) {
        monthEndDates.push(filteredData[i].date);
      }
    }

    // Generate trades based on phenomena days
    const trades = [];
    
    // Old software requires phenomenaDaysEnd > 0
    if (phenomenaDaysEnd <= 0) {
      return {
        initialCapital,
        finalCapital: initialCapital,
        totalReturn: 0,
        totalTrades: 0,
        tradeList: [],
        statisticsReport: [],
        queryOneData: [],
        heatmapData: [],
        walkForwardData: { chartType: walkForwardType, xAxisTitle: 'Days', yAxisTitle: 'Compounded Percentage Return', series: [] }
      };
    }

    const minRequiredLength = phenomenaDaysStart < 1 
      ? Math.abs(phenomenaDaysStart) + phenomenaDaysEnd 
      : phenomenaDaysEnd - phenomenaDaysStart + 1;

    let tradeNumber = 0;
    let currentCapital = initialCapital;

    for (const monthEndDate of monthEndDates) {
      const monthEndIndex = filteredData.findIndex(d => d.date.getTime() === monthEndDate.getTime());
      if (monthEndIndex === -1) continue;

      let tradeData = [];
      
      if (phenomenaDaysStart < 0) {
        // Matching old software exactly:
        // df[df['Date'] <= monthLastDate][phenomenaDaysValueStart:]
        // - Get all rows where date <= monthEndDate
        // - Take rows from index start onwards (includes monthEndDate)
        // Then: df[df['Date'] > monthLastDate][0:phenomenaDaysValueEnd]
        // - Get first rows where date > monthEndDate
        
        const allBeforeOrOnMonthEnd = filteredData.filter(d => d.date <= monthEndDate);
        const beforeCount = Math.abs(phenomenaDaysStart);
        const beforeDays = allBeforeOrOnMonthEnd.slice(-beforeCount);
        
        const allAfterMonthEnd = filteredData.filter(d => d.date > monthEndDate);
        const afterDays = allAfterMonthEnd.slice(0, phenomenaDaysEnd);
        
        tradeData = [...beforeDays, ...afterDays];
      } else {
        // Positive start (>=1): get days after month end (matching old software)
        // Old: df[df['Date'] > monthLastDate][phenomenaDaysValueStart-1:phenomenaDaysValueEnd]
        const allAfterMonthEnd = filteredData.filter(d => d.date > monthEndDate);
        tradeData = allAfterMonthEnd.slice(phenomenaDaysStart - 1, phenomenaDaysEnd);
      }

      if (tradeData.length !== minRequiredLength || tradeData.length === 0) {
        continue;
      }

      tradeNumber++;
      
      const entryPrice = tradeData[0].close;
      const exitPrice = tradeData[tradeData.length - 1].close;
      const contracts = Math.floor(currentCapital / entryPrice);
      
      let profitPoints;
      if (tradeType === 'longTrades') {
        profitPoints = exitPrice - entryPrice;
      } else {
        profitPoints = entryPrice - exitPrice;
      }

      const profitValue = contracts * profitPoints;
      const profitPercentage = (profitPoints * 100) / entryPrice;

      // Match old software: brokerage is subtracted on points first, then scaled by contracts.
      const profitPointsWithBrokerage = profitPoints - ((entryPrice + exitPrice) * brokerage / 100);
      const netProfit = contracts * profitPointsWithBrokerage;
      const netProfitPercentage = (profitPointsWithBrokerage * 100) / entryPrice;
      
      currentCapital = currentCapital + netProfit;

      // Calculate MAE/MFE
      let lowestPrice = entryPrice;
      let highestPrice = entryPrice;
      for (let i = 1; i < tradeData.length; i++) {
        if (tradeType === 'longTrades') {
          lowestPrice = Math.min(lowestPrice, tradeData[i].low);
          highestPrice = Math.max(highestPrice, tradeData[i].high);
        } else {
          lowestPrice = Math.min(lowestPrice, tradeData[i].low);
          highestPrice = Math.max(highestPrice, tradeData[i].high);
        }
      }

      const maePoints = tradeType === 'longTrades' 
        ? lowestPrice - entryPrice 
        : entryPrice - highestPrice;
      const mfePoints = tradeType === 'longTrades'
        ? highestPrice - entryPrice
        : entryPrice - lowestPrice;

      trades.push({
        Number: tradeNumber,
        Symbol: symbol,
        Trade: tradeType === 'longTrades' ? 'Long' : 'Short',
        'Entry Date': new Date(tradeData[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        'Entry Price': entryPrice,
        'Exit Date': new Date(tradeData[tradeData.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        'Exit Price': exitPrice,
        Contracts: contracts,
        'Entry Value': entryPrice * contracts,
        'Exit Value': exitPrice * contracts,
        'Profit Points': profitPoints,
        'Profit Percentage': profitPercentage,
        'Profit Value': profitValue,
        'Profit Points(With Brokerage)': profitPointsWithBrokerage,
        'Profit Percentage(With Brokerage)': netProfitPercentage,
        'Profit Value(With Brokerage)': netProfit,
        'Cumulative Profit': 0, // Will calculate later
        'Cumulative Profit(With Brokerage)': 0,
        'Available Cash': currentCapital,
        'Bars Held': tradeData.length,
        'Profit/Bar': netProfit / tradeData.length,
        'MAE Points': maePoints,
        'MFE Points': mfePoints,
        'MAE Percentage': (maePoints * 100) / entryPrice,
        'MFE Percentage': (mfePoints * 100) / entryPrice,
        'Net Profit%': ((currentCapital - initialCapital) * 100) / initialCapital,
        'Max Profit%': 0, // Will calculate later
        'Max Available Cash': 0,
        'DD%': 0,
        'DD': 0
      });
    }

    // Calculate cumulative values
    let maxAvailableCash = initialCapital;
    let maxProfit = 0;
    for (let i = 0; i < trades.length; i++) {
      trades[i]['Cumulative Profit'] = trades[i]['Profit Value'];
      trades[i]['Cumulative Profit(With Brokerage)'] = trades[i]['Profit Value(With Brokerage)'];
      
      if (i > 0) {
        trades[i]['Cumulative Profit'] += trades[i - 1]['Cumulative Profit'];
        trades[i]['Cumulative Profit(With Brokerage)'] += trades[i - 1]['Cumulative Profit(With Brokerage)'];
      }
      
      maxAvailableCash = Math.max(maxAvailableCash, trades[i]['Available Cash']);
      maxProfit = Math.max(maxProfit, trades[i]['Net Profit%']);
      trades[i]['Max Available Cash'] = maxAvailableCash;
      trades[i]['Max Profit%'] = maxProfit;
      trades[i]['DD%'] = ((trades[i]['Available Cash'] / maxAvailableCash) - 1) * 100;
      trades[i]['DD'] = trades[i]['Available Cash'] - maxAvailableCash;
    }

    const maximumConsecutiveValues = (arr) => {
      let maximumPositiveCount = 0;
      let currentPositiveCount = 0;
      let maximumNegativeCount = 0;
      let currentNegativeCount = 0;

      for (const num of arr) {
        if (num > 0) {
          currentPositiveCount += 1;
          maximumPositiveCount = Math.max(maximumPositiveCount, currentPositiveCount);
          currentNegativeCount = 0;
        } else if (num < 0) {
          currentNegativeCount += 1;
          maximumNegativeCount = Math.max(maximumNegativeCount, currentNegativeCount);
          currentPositiveCount = 0;
        } else {
          currentPositiveCount = 0;
          currentNegativeCount = 0;
        }
      }

      return { maximumPositiveCount, maximumNegativeCount };
    };

    const formatPct = (value) => `${Number(value || 0).toFixed(2)}%`;
    const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
    const round2 = (v) => Number((v || 0).toFixed(2));
    const formatLargestTrade = (trade) => {
      if (!trade) return '0(0%)';
      return `${round2(trade['Profit Value(With Brokerage)'])}(${round2(trade['Profit Percentage(With Brokerage)'])}%)`;
    };

    // Old-software parity for rollup columns
    for (let i = 0; i < trades.length; i++) {
      trades[i]['Net Profit%'] = safeDiv(trades[i]['Available Cash'] * 100, initialCapital);
      trades[i]['Max Profit%'] = i === 0
        ? trades[i]['Net Profit%']
        : Math.max(trades[i - 1]['Max Profit%'], trades[i]['Net Profit%']);
      trades[i]['Max Available Cash'] = i === 0
        ? trades[i]['Available Cash']
        : Math.max(trades[i - 1]['Max Available Cash'], trades[i]['Available Cash']);
      trades[i]['DD%'] = safeDiv(trades[i]['Available Cash'] * 100, trades[i]['Max Available Cash']) - 100;
      trades[i]['DD'] = trades[i]['Available Cash'] - trades[i]['Max Available Cash'];
    }

    const finalCapital = trades.length > 0 ? trades[trades.length - 1]['Available Cash'] : initialCapital;
    const lastTrade = trades.length > 0 ? trades[trades.length - 1] : null;
    const endingCapital = Math.round(finalCapital);
    const netProfitValue = lastTrade ? Math.round(lastTrade['Cumulative Profit(With Brokerage)']) : 0;
    const netProfitPercentage = lastTrade ? safeDiv(lastTrade['Cumulative Profit(With Brokerage)'] * 100, initialCapital) : 0;
    const totalTransactionCosts = lastTrade
      ? Math.round(lastTrade['Cumulative Profit'] - lastTrade['Cumulative Profit(With Brokerage)'])
      : 0;

    let annualReturn = 0;
    if (trades.length > 0 && endingCapital > 0) {
      const parseDmy = (dateStr) => {
        const [dd, mm, yyyy] = String(dateStr).split('/');
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      };
      const start = parseDmy(trades[0]['Entry Date']);
      const end = parseDmy(trades[trades.length - 1]['Exit Date']);
      const durationInYears = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
      if (durationInYears > 0) {
        annualReturn = 100 * (Math.pow(10, Math.log10(endingCapital / initialCapital) / durationInYears) - 1);
      }
    }

    const winners = trades.filter(t => t['Profit Value(With Brokerage)'] > 0);
    const losers = trades.filter(t => t['Profit Value(With Brokerage)'] < 0);
    const totalTrades = trades.length;

    const avgProfitLoss = totalTrades > 0
      ? Math.round(trades.reduce((sum, t) => sum + t['Profit Value(With Brokerage)'], 0) / totalTrades)
      : 0;
    const avgProfitLossPct = totalTrades > 0
      ? trades.reduce((sum, t) => sum + t['Profit Percentage(With Brokerage)'], 0) / totalTrades
      : 0;
    const avgBarsHeld = totalTrades > 0
      ? trades.reduce((sum, t) => sum + t['Bars Held'], 0) / totalTrades
      : 0;

    const winnerTotalProfit = winners.reduce((sum, t) => sum + t['Profit Value(With Brokerage)'], 0);
    const winnerAvgProfit = winners.length > 0 ? winnerTotalProfit / winners.length : 0;
    const winnerAvgProfitPct = winners.length > 0
      ? winners.reduce((sum, t) => sum + t['Profit Percentage(With Brokerage)'], 0) / winners.length
      : 0;
    const winnerAvgBarsHeld = winners.length > 0
      ? winners.reduce((sum, t) => sum + t['Bars Held'], 0) / winners.length
      : 0;
    const largestWinTrade = winners.length > 0
      ? winners.reduce((best, t) => (t['Profit Value(With Brokerage)'] > best['Profit Value(With Brokerage)'] ? t : best), winners[0])
      : null;

    const loserTotalLoss = losers.reduce((sum, t) => sum + t['Profit Value(With Brokerage)'], 0);
    const loserAvgLoss = losers.length > 0 ? loserTotalLoss / losers.length : 0;
    const loserAvgLossPct = losers.length > 0
      ? losers.reduce((sum, t) => sum + t['Profit Percentage(With Brokerage)'], 0) / losers.length
      : 0;
    const loserAvgBarsHeld = losers.length > 0
      ? losers.reduce((sum, t) => sum + t['Bars Held'], 0) / losers.length
      : 0;
    const largestLossTrade = losers.length > 0
      ? losers.reduce((worst, t) => (t['Profit Value(With Brokerage)'] < worst['Profit Value(With Brokerage)'] ? t : worst), losers[0])
      : null;

    const { maximumPositiveCount, maximumNegativeCount } =
      maximumConsecutiveValues(trades.map(t => t['Profit Value(With Brokerage)']));

    const maximumTradeDrawdown = totalTrades > 0
      ? Number(Math.min(...trades.map(t => t['Profit Value(With Brokerage)'])).toFixed(2))
      : 0;
    const maximumTradeDrawdownPct = totalTrades > 0
      ? Number(trades.reduce((worst, t) =>
        t['Profit Value(With Brokerage)'] < worst['Profit Value(With Brokerage)'] ? t : worst
      )['Profit Percentage(With Brokerage)'].toFixed(2))
      : 0;
    const maximumSystemDrawdown = totalTrades > 0 ? Number(Math.min(...trades.map(t => t['DD'])).toFixed(2)) : 0;
    const maximumSystemDrawdownPct = totalTrades > 0 ? Number(Math.min(...trades.map(t => t['DD%'])).toFixed(2)) : 0;

    const recoveryFactor = maximumSystemDrawdown !== 0
      ? Number((-1 * netProfitValue / maximumSystemDrawdown).toFixed(2))
      : 0;
    const carByMdd = maximumSystemDrawdownPct !== 0
      ? Number((-1 * annualReturn / maximumSystemDrawdownPct).toFixed(2))
      : 0;
    const profitFactor = loserTotalLoss !== 0
      ? Number((-1 * winnerTotalProfit / loserTotalLoss).toFixed(2))
      : 0;
    const payoffRatio = loserAvgLoss !== 0
      ? Number((-1 * winnerAvgProfit / loserAvgLoss).toFixed(2))
      : 0;

    const statisticsReport = [
      { Parameters: 'Initial Capital', Values: Math.round(initialCapital) },
      { Parameters: 'Ending Capital', Values: endingCapital },
      { Parameters: 'Net Profit', Values: netProfitValue },
      { Parameters: 'Net Profit %', Values: formatPct(netProfitPercentage) },
      { Parameters: 'Annual Return %', Values: formatPct(annualReturn) },
      { Parameters: 'Total Transaction Costs', Values: totalTransactionCosts },
      { Parameters: 'Total Trades', Values: totalTrades },
      { Parameters: 'Average Profit/Loss', Values: avgProfitLoss },
      { Parameters: 'Average Profit/Loss %', Values: formatPct(avgProfitLossPct) },
      { Parameters: 'Average Bars Held', Values: Number(avgBarsHeld.toFixed(2)) },
      { Parameters: 'Total Wins', Values: `${winners.length}(${totalTrades > 0 ? ((winners.length / totalTrades) * 100).toFixed(2) : '0.00'}%)` },
      { Parameters: 'Total Profit', Values: Math.round(winnerTotalProfit) },
      { Parameters: 'Average Profit', Values: winners.length > 0 ? Math.round(winnerAvgProfit) : 0 },
      { Parameters: 'Average Profit %', Values: formatPct(winnerAvgProfitPct) },
      { Parameters: 'Average Bars Held in Profit', Values: Number(winnerAvgBarsHeld.toFixed(2)) },
      { Parameters: 'Maximum Consecutive Wins', Values: maximumPositiveCount },
      { Parameters: 'Largest Win', Values: formatLargestTrade(largestWinTrade) },
      { Parameters: 'Bars in Largest Win', Values: largestWinTrade ? largestWinTrade['Bars Held'] : 0 },
      { Parameters: 'Total Losses', Values: `${losers.length}(${totalTrades > 0 ? ((losers.length / totalTrades) * 100).toFixed(2) : '0.00'}%)` },
      { Parameters: 'Total Loss', Values: Math.round(loserTotalLoss) },
      { Parameters: 'Average Loss', Values: losers.length > 0 ? Math.round(loserAvgLoss) : 0 },
      { Parameters: 'Average Loss %', Values: formatPct(loserAvgLossPct) },
      { Parameters: 'Average Bars Held in Loss', Values: Number(loserAvgBarsHeld.toFixed(2)) },
      { Parameters: 'Maximum Consecutive Losses', Values: maximumNegativeCount },
      { Parameters: 'Largest Loss', Values: formatLargestTrade(largestLossTrade) },
      { Parameters: 'Bars in Largest Loss', Values: largestLossTrade ? largestLossTrade['Bars Held'] : 0 },
      { Parameters: 'Maximum Trade Drawdown', Values: maximumTradeDrawdown },
      { Parameters: 'Maximum Trade Drawdown %', Values: formatPct(maximumTradeDrawdownPct) },
      { Parameters: 'Maximum System Drawdown', Values: maximumSystemDrawdown },
      { Parameters: 'Maximum System Drawdown %', Values: formatPct(maximumSystemDrawdownPct) },
      { Parameters: 'Recovery Factor', Values: recoveryFactor },
      { Parameters: 'CAR/MaxDD', Values: carByMdd },
      { Parameters: 'Profit Factor', Values: profitFactor },
      { Parameters: 'Payoff Ratio', Values: payoffRatio }
    ];

    const getQueryStats = (returns) => {
      const valid = returns.filter(v => Number.isFinite(v));
      const allCount = valid.length;
      const sumReturnAll = valid.reduce((s, v) => s + v, 0);
      const avgReturnAll = allCount > 0 ? sumReturnAll / allCount : 0;
      const positives = valid.filter(v => v > 0);
      const negatives = valid.filter(v => v < 0);
      const posCount = positives.length;
      const negCount = negatives.length;
      const sumReturnPos = positives.reduce((s, v) => s + v, 0);
      const sumReturnNeg = negatives.reduce((s, v) => s + v, 0);
      return {
        allCount,
        avgReturnAll: round2(avgReturnAll),
        sumReturnAll: round2(sumReturnAll),
        positiveCount: posCount,
        positiveAccuracy: round2(allCount > 0 ? (posCount * 100) / allCount : 0),
        avgReturnPos: round2(posCount > 0 ? sumReturnPos / posCount : 0),
        sumReturnPos: round2(sumReturnPos),
        negativeCount: negCount,
        negativeAccuracy: round2(allCount > 0 ? (negCount * 100) / allCount : 0),
        avgReturnNeg: round2(negCount > 0 ? sumReturnNeg / negCount : 0),
        sumReturnNeg: round2(sumReturnNeg),
      };
    };

    const weekdayStats = getQueryStats(
      filteredData
        .filter(d => queryWeekdays.includes(d.weekday))
        .map(d => d.returnPercentage || 0)
    );
    const tradingDayStats = getQueryStats(
      filteredData
        .filter(d => queryTradingDays.includes(d.tradingMonthDay))
        .map(d => d.returnPercentage || 0)
    );
    const calendarDayStats = getQueryStats(
      filteredData
        .filter(d => queryCalendarDays.includes(d.calendarMonthDay))
        .map(d => d.returnPercentage || 0)
    );

    const queryOneData = [
      { Parameters: 'All Count', Weekday: weekdayStats.allCount, 'Trading Month Day': tradingDayStats.allCount, 'Calendar Month Day': calendarDayStats.allCount },
      { Parameters: 'Average Return of All', Weekday: weekdayStats.avgReturnAll, 'Trading Month Day': tradingDayStats.avgReturnAll, 'Calendar Month Day': calendarDayStats.avgReturnAll },
      { Parameters: 'Sum Return of All', Weekday: weekdayStats.sumReturnAll, 'Trading Month Day': tradingDayStats.sumReturnAll, 'Calendar Month Day': calendarDayStats.sumReturnAll },
      { Parameters: 'Positive Count', Weekday: weekdayStats.positiveCount, 'Trading Month Day': tradingDayStats.positiveCount, 'Calendar Month Day': calendarDayStats.positiveCount },
      { Parameters: 'Positive Accuracy', Weekday: weekdayStats.positiveAccuracy, 'Trading Month Day': tradingDayStats.positiveAccuracy, 'Calendar Month Day': calendarDayStats.positiveAccuracy },
      { Parameters: 'Average Return of Positive', Weekday: weekdayStats.avgReturnPos, 'Trading Month Day': tradingDayStats.avgReturnPos, 'Calendar Month Day': calendarDayStats.avgReturnPos },
      { Parameters: 'Sum Return of Positive', Weekday: weekdayStats.sumReturnPos, 'Trading Month Day': tradingDayStats.sumReturnPos, 'Calendar Month Day': calendarDayStats.sumReturnPos },
      { Parameters: 'Negative Count', Weekday: weekdayStats.negativeCount, 'Trading Month Day': tradingDayStats.negativeCount, 'Calendar Month Day': calendarDayStats.negativeCount },
      { Parameters: 'Negative Accuracy', Weekday: weekdayStats.negativeAccuracy, 'Trading Month Day': tradingDayStats.negativeAccuracy, 'Calendar Month Day': calendarDayStats.negativeAccuracy },
      { Parameters: 'Average Return of Negative', Weekday: weekdayStats.avgReturnNeg, 'Trading Month Day': tradingDayStats.avgReturnNeg, 'Calendar Month Day': calendarDayStats.avgReturnNeg },
      { Parameters: 'Sum Return of Negative', Weekday: weekdayStats.sumReturnNeg, 'Trading Month Day': tradingDayStats.sumReturnNeg, 'Calendar Month Day': calendarDayStats.sumReturnNeg },
    ];

    // Heatmap parity: fixed X axis ranges (1..23 trading days, 1..31 calendar days)
    const heatmapData = [];
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const xAxisType = heatmapType === 'TradingMonthDaysVsWeekdays' ? 'tradingMonthDay' : 'calendarMonthDay';
    const xAxisTitle = heatmapType === 'TradingMonthDaysVsWeekdays' ? 'Trading Month Days' : 'Calendar Month Days';
    const xAxisValues = heatmapType === 'TradingMonthDaysVsWeekdays'
      ? Array.from({ length: 23 }, (_, i) => i + 1)
      : Array.from({ length: 31 }, (_, i) => i + 1);
    const weekdaysReverse = [...weekdays].reverse();

    for (const weekday of weekdaysReverse) {
      const row = [];
      for (const xVal of xAxisValues) {
        const filtered = filteredData.filter(d => d.weekday === weekday && d[xAxisType] === xVal);
        const avgReturn = filtered.length > 0
          ? filtered.reduce((sum, d) => sum + (d.returnPercentage || 0), 0) / filtered.length
          : null;
        row.push(avgReturn === null ? null : Number(avgReturn.toFixed(2)));
      }
      heatmapData.push(row);
    }

    // Walk-forward superimposed chart data (in-sample), matching old compounding method.
    const fieldMap = {
      CalenderYearDay: 'calendarYearDay',
      TradingYearDay: 'tradingYearDay',
      CalenderMonthDay: 'calendarMonthDay',
      TradingMonthDay: 'tradingMonthDay',
      Weekday: 'weekday'
    };
    const walkForwardField = fieldMap[walkForwardType] || 'calendarYearDay';
    const inSampleStartDate = inSampleStart ? new Date(inSampleStart) : null;
    const inSampleEndDate = inSampleEnd ? new Date(inSampleEnd) : null;
    const outSampleStartDate = outSampleStart ? new Date(outSampleStart) : null;
    const outSampleEndDate = outSampleEnd ? new Date(outSampleEnd) : null;
    const normalizedSymbols = [...new Set(
      [symbol, ...(Array.isArray(walkForwardSymbols) ? walkForwardSymbols : [])]
        .filter(Boolean)
        .map(s => String(s).toUpperCase())
    )];
    const walkForwardTickers = await prisma.ticker.findMany({
      where: { symbol: { in: normalizedSymbols }, isActive: true },
      select: { id: true, symbol: true }
    });
    const walkForwardTickerBySymbol = new Map(walkForwardTickers.map(t => [t.symbol, t]));
    const walkForwardTickerIds = walkForwardTickers.map(t => t.id);
    const allWalkRows = walkForwardTickerIds.length > 0
      ? await prisma.dailySeasonalityData.findMany({
          where: {
            tickerId: { in: walkForwardTickerIds },
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          },
          orderBy: [{ tickerId: 'asc' }, { date: 'asc' }],
          select: {
            tickerId: true,
            date: true,
            weekday: true,
            calendarYearDay: true,
            tradingYearDay: true,
            calendarMonthDay: true,
            tradingMonthDay: true,
            returnPercentage: true,
            expiryWeekNumberMonthly: true,
            mondayWeekNumberMonthly: true,
            evenYear: true
          }
        })
      : [];
    const walkRowsByTickerId = new Map();
    allWalkRows.forEach((row) => {
      if (!walkRowsByTickerId.has(row.tickerId)) walkRowsByTickerId.set(row.tickerId, []);
      walkRowsByTickerId.get(row.tickerId).push(row);
    });
    const walkForwardSeries = [];

    for (const walkSymbol of normalizedSymbols) {
      const walkTicker = walkForwardTickerBySymbol.get(walkSymbol);
      if (!walkTicker) continue;
      const walkRows = walkRowsByTickerId.get(walkTicker.id) || [];
      const walkFiltered = applySharedBacktestFilters(walkRows);
      const inSampleData = walkFiltered.filter(d => {
        if (!inSampleStartDate || !inSampleEndDate) return true;
        return d.date >= inSampleStartDate && d.date <= inSampleEndDate;
      });
      const outSampleData = walkFiltered.filter(d => {
        if (!outSampleStartDate || !outSampleEndDate) return true;
        return d.date >= outSampleStartDate && d.date <= outSampleEndDate;
      });

      // Old-software parity: only plot when both in-sample and out-sample have data.
      if (!(inSampleData.length > 0 && outSampleData.length > 0)) continue;

      let walkForwardSeriesData = [];
      if (walkForwardField === 'weekday') {
        const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const grouped = weekdayOrder.map(day => {
          const values = inSampleData.filter(d => d.weekday === day).map(d => d.returnPercentage || 0);
          return {
            x: day,
            returnPercentage: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
          };
        });

        let compounded = 1;
        walkForwardSeriesData = grouped.map(row => {
          compounded *= (row.returnPercentage / 100) + 1;
          return {
            x: row.x,
            returnPercentage: Number(row.returnPercentage.toFixed(2)),
            superimposedReturn: Number(((compounded - 1) * 100).toFixed(2))
          };
        });
      } else {
        const groupedMap = new Map();
        for (const d of inSampleData) {
          const key = d[walkForwardField];
          if (key == null) continue;
          if (!groupedMap.has(key)) groupedMap.set(key, []);
          groupedMap.get(key).push(d.returnPercentage || 0);
        }
        const grouped = [...groupedMap.entries()]
          .map(([x, values]) => ({
            x: typeof x === 'number' ? x : String(x),
            returnPercentage: values.reduce((a, b) => a + b, 0) / values.length
          }))
          .sort((a, b) => Number(a.x) - Number(b.x));

        let compounded = 1;
        walkForwardSeriesData = grouped.map(row => {
          compounded *= (row.returnPercentage / 100) + 1;
          return {
            x: row.x,
            returnPercentage: Number(row.returnPercentage.toFixed(2)),
            superimposedReturn: Number(((compounded - 1) * 100).toFixed(2))
          };
        });
      }

      walkForwardSeries.push({
        name: `${walkSymbol} (In the Sample)`,
        data: walkForwardSeriesData
      });
    }

    const walkForwardData = {
      chartType: walkForwardType,
      xAxisTitle: 'Days',
      yAxisTitle: 'Compounded Percentage Return',
      series: walkForwardSeries
    };

    const normalizedMaxRows = Number.isFinite(Number(maxRows)) && Number(maxRows) > 0
      ? Math.floor(Number(maxRows))
      : null;
    const tradeListForResponse = includeTradeList
      ? (normalizedMaxRows ? trades.slice(0, normalizedMaxRows) : trades)
      : [];

    const baseResult = {
      initialCapital,
      finalCapital,
      totalReturn: Number(netProfitPercentage.toFixed(2)),
      totalTrades: trades.length,
      tradeList: tradeListForResponse,
      statisticsReport,
      queryOneData,
      heatmapData: {
        data: heatmapData,
        xAxis: xAxisValues,
        yAxis: weekdaysReverse,
        xAxisTitle,
        showAnnotation
      },
      walkForwardData
    };

    if (responseMode === 'summary') {
      return {
        initialCapital: baseResult.initialCapital,
        finalCapital: baseResult.finalCapital,
        totalReturn: baseResult.totalReturn,
        totalTrades: baseResult.totalTrades,
        statisticsReport: baseResult.statisticsReport
      };
    }

    if (responseMode === 'chartOnly') {
      return {
        initialCapital: baseResult.initialCapital,
        finalCapital: baseResult.finalCapital,
        totalReturn: baseResult.totalReturn,
        totalTrades: baseResult.totalTrades,
        heatmapData: baseResult.heatmapData,
        walkForwardData: baseResult.walkForwardData,
        queryOneData: baseResult.queryOneData
      };
    }

    return baseResult;
  }

  /**
   * Clear cache for a symbol (call when new data is uploaded)
   */
  async clearSymbolCache(symbol) {
    const patterns = [
      `analysis:daily:*${symbol}*`,
      `analysis:daily-aggregate:*${symbol}*`,
      `analysis:weekly:*${symbol}*`,
      `analysis:monthly:*${symbol}*`,
      `analysis:yearly:*${symbol}*`,
      `analysis:scenario:*${symbol}*`
    ];

    for (const pattern of patterns) {
      await cache.delPattern(pattern);
    }

    logger.info(`Cache cleared for symbol: ${symbol}`);
  }
}

module.exports = new AnalysisService();
