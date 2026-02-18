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
  
  // Debug logging
  console.log('Statistics Calculation:', {
    numberOfYears,
    cumulative,
    cumulativeReturn,
    cagr,
    maxDrawdown,
    recordCount: records.length
  });

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

    return result;
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

    // First get filtered daily data
    const dailyResult = await this.dailyAnalysis(symbol, params);
    const records = dailyResult.tableData;

    if (records.length === 0) {
      return {
        symbol,
        timeframe: 'daily-aggregate',
        aggregateField,
        aggregateType,
        data: [],
        meta: { processingTime: Date.now() - startTime, recordsAnalyzed: 0 }
      };
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

    // Fetch full records for grouping
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    const where = await buildDailyWhereClause(ticker.id, params);
    delete where._electionYears;
    delete where._specificMonth;

    let fullRecords = await prisma.dailySeasonalityData.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    fullRecords = applyComplexFilters(fullRecords, params);

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

    return result;
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

    return result;
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

    return result;
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

    return result;
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

    // Get full records with all fields for calculations
    const where = await buildDailyWhereClause(ticker.id, params);
    delete where._electionYears;
    delete where._specificMonth;

    let fullRecords = await prisma.dailySeasonalityData.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    fullRecords = applyComplexFilters(fullRecords, params);

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
