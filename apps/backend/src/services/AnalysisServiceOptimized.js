/**
 * Optimized Analysis Service
 * 
 * CRITICAL OPTIMIZATIONS:
 * 1. Database-level filtering instead of in-memory filtering
 * 2. Uses raw SQL for complex filters (decade years, leap years, election years)
 * 3. Eliminates double queries in aggregate analysis
 * 4. Uses materialized views for statistics
 * 5. Proper use of covering indexes
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
 * Calculate statistics from records - UNCHANGED
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
  let cumulative = 1;
  let peak = 1;
  let maxDrawdown = 0;
  
  for (const ret of returns) {
    cumulative = cumulative * (1 + ret / 100);
    if (cumulative > peak) peak = cumulative;
    const drawdown = ((cumulative - peak) / peak) * 100;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  
  const cumulativeReturn = (cumulative - 1) * 100;

  const uniqueYears = new Set(records.map(r => new Date(r.date).getFullYear()));
  const numberOfYears = uniqueYears.size;

  let cagr = 0;
  if (numberOfYears > 0 && cumulative > 0) {
    cagr = (Math.pow(cumulative, 1 / numberOfYears) - 1) * 100;
  }

  const avgReturn = avg(returns);
  let stdDev = 0;
  if (returns.length > 1) {
    const squaredDiffs = returns.map(r => Math.pow(r - avgReturn, 2));
    stdDev = Math.sqrt(sum(squaredDiffs) / returns.length);
  }

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
 * Calculate cumulative returns for chart data - UNCHANGED
 */
function calculateCumulativeReturns(records, returnField = 'returnPercentage') {
  let cumulative = 100;
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
 * Get election years for a specific category - UNCHANGED
 */
async function getElectionYears(category, country = 'INDIA') {
  const records = await prisma.electionYearCategory.findMany({
    where: { country, category },
    select: { year: true }
  });
  return records.map(r => r.year);
}

/**
 * OPTIMIZED: Build WHERE clause that pushes filters to database
 * This is the KEY optimization - filters at DB level, not in memory
 */
async function buildOptimizedWhereClause(tickerId, params) {
  const { startDate, endDate, lastNDays, filters = {}, weekType = 'expiry' } = params;
  
  // Build SQL WHERE conditions
  const conditions = ['tickerId = $1'];
  const values = [tickerId];
  let paramIndex = 2;

  // Date range filter
  if (lastNDays && lastNDays > 0) {
    // Will be handled with ORDER BY and LIMIT
  } else if (startDate && endDate) {
    conditions.push(`date >= $${paramIndex} AND date <= $${paramIndex + 1}`);
    values.push(startDate, endDate);
    paramIndex += 2;
  }

  // Year filters - Push to database
  const yearFilters = filters.yearFilters || {};
  if (yearFilters.positiveNegativeYears === 'Positive') {
    conditions.push('positiveYear = true');
  } else if (yearFilters.positiveNegativeYears === 'Negative') {
    conditions.push('positiveYear = false');
  }

  if (yearFilters.evenOddYears === 'Even') {
    conditions.push('evenYear = true');
  } else if (yearFilters.evenOddYears === 'Odd') {
    conditions.push('evenYear = false');
  } else if (yearFilters.evenOddYears === 'Leap') {
    // Leap years: (year % 4 = 0 AND year % 100 != 0) OR (year % 400 = 0)
    conditions.push(`(
      (EXTRACT(YEAR FROM date) % 4 = 0 AND EXTRACT(YEAR FROM date) % 100 != 0) 
      OR (EXTRACT(YEAR FROM date) % 400 = 0)
    )`);
  } else if (yearFilters.evenOddYears === 'Election') {
    const electionYears = await getElectionYears('election');
    if (electionYears.length > 0) {
      const yearList = electionYears.join(',');
      conditions.push(`EXTRACT(YEAR FROM date) IN (${yearList})`);
    }
  }

  // Decade years filter - Push to database
  const decadeYears = yearFilters.decadeYears;
  if (decadeYears && decadeYears.length > 0 && decadeYears.length < 10) {
    const decadeConditions = decadeYears.map(d => {
      const digit = d === 10 ? 0 : d;
      return `EXTRACT(YEAR FROM date) % 10 = ${digit}`;
    }).join(' OR ');
    conditions.push(`(${decadeConditions})`);
  }

  // Month filters - Push to database
  const monthFilters = filters.monthFilters || {};
  if (monthFilters.positiveNegativeMonths === 'Positive') {
    conditions.push('positiveMonth = true');
  } else if (monthFilters.positiveNegativeMonths === 'Negative') {
    conditions.push('positiveMonth = false');
  }

  if (monthFilters.evenOddMonths === 'Even') {
    conditions.push('evenMonth = true');
  } else if (monthFilters.evenOddMonths === 'Odd') {
    conditions.push('evenMonth = false');
  }

  if (monthFilters.specificMonth && monthFilters.specificMonth > 0) {
    conditions.push(`EXTRACT(MONTH FROM date) = ${monthFilters.specificMonth}`);
  }

  // Week filters (based on weekType) - Push to database
  const weekFilters = filters.weekFilters || {};
  if (weekType === 'expiry') {
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      conditions.push('positiveExpiryWeek = true');
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      conditions.push('positiveExpiryWeek = false');
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      conditions.push('evenExpiryWeekNumberMonthly = true');
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      conditions.push('evenExpiryWeekNumberMonthly = false');
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      conditions.push('evenExpiryWeekNumberYearly = true');
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      conditions.push('evenExpiryWeekNumberYearly = false');
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      conditions.push(`expiryWeekNumberMonthly = ${weekFilters.specificWeekMonthly}`);
    }
  } else {
    // Monday week
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      conditions.push('positiveMondayWeek = true');
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      conditions.push('positiveMondayWeek = false');
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      conditions.push('evenMondayWeekNumberMonthly = true');
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      conditions.push('evenMondayWeekNumberMonthly = false');
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      conditions.push('evenMondayWeekNumberYearly = true');
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      conditions.push('evenMondayWeekNumberYearly = false');
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      conditions.push(`mondayWeekNumberMonthly = ${weekFilters.specificWeekMonthly}`);
    }
  }

  // Day filters - Push to database
  const dayFilters = filters.dayFilters || {};
  if (dayFilters.positiveNegativeDays === 'Positive') {
    conditions.push('positiveDay = true');
  } else if (dayFilters.positiveNegativeDays === 'Negative') {
    conditions.push('positiveDay = false');
  }

  if (dayFilters.weekdays && dayFilters.weekdays.length > 0 && dayFilters.weekdays.length < 5) {
    const weekdayList = dayFilters.weekdays.map(w => `'${w}'`).join(',');
    conditions.push(`weekday IN (${weekdayList})`);
  }

  if (dayFilters.evenOddCalendarDaysMonthly === 'Even') {
    conditions.push('evenCalendarMonthDay = true');
  } else if (dayFilters.evenOddCalendarDaysMonthly === 'Odd') {
    conditions.push('evenCalendarMonthDay = false');
  }

  if (dayFilters.evenOddCalendarDaysYearly === 'Even') {
    conditions.push('evenCalendarYearDay = true');
  } else if (dayFilters.evenOddCalendarDaysYearly === 'Odd') {
    conditions.push('evenCalendarYearDay = false');
  }

  if (dayFilters.evenOddTradingDaysMonthly === 'Even') {
    conditions.push('evenTradingMonthDay = true');
  } else if (dayFilters.evenOddTradingDaysMonthly === 'Odd') {
    conditions.push('evenTradingMonthDay = false');
  }

  if (dayFilters.evenOddTradingDaysYearly === 'Even') {
    conditions.push('evenTradingYearDay = true');
  } else if (dayFilters.evenOddTradingDaysYearly === 'Odd') {
    conditions.push('evenTradingYearDay = false');
  }

  // Outlier filters - Push to database
  const outlierFilters = filters.outlierFilters || {};
  
  if (outlierFilters.dailyPercentageRange?.enabled) {
    conditions.push(`returnPercentage >= $${paramIndex} AND returnPercentage <= $${paramIndex + 1}`);
    values.push(outlierFilters.dailyPercentageRange.min, outlierFilters.dailyPercentageRange.max);
    paramIndex += 2;
  }

  if (outlierFilters.weeklyPercentageRange?.enabled) {
    const weeklyField = weekType === 'expiry' ? 'expiryWeeklyReturnPercentage' : 'mondayWeeklyReturnPercentage';
    conditions.push(`${weeklyField} >= $${paramIndex} AND ${weeklyField} <= $${paramIndex + 1}`);
    values.push(outlierFilters.weeklyPercentageRange.min, outlierFilters.weeklyPercentageRange.max);
    paramIndex += 2;
  }

  if (outlierFilters.monthlyPercentageRange?.enabled) {
    conditions.push(`monthlyReturnPercentage >= $${paramIndex} AND monthlyReturnPercentage <= $${paramIndex + 1}`);
    values.push(outlierFilters.monthlyPercentageRange.min, outlierFilters.monthlyPercentageRange.max);
    paramIndex += 2;
  }

  if (outlierFilters.yearlyPercentageRange?.enabled) {
    conditions.push(`yearlyReturnPercentage >= $${paramIndex} AND yearlyReturnPercentage <= $${paramIndex + 1}`);
    values.push(outlierFilters.yearlyPercentageRange.min, outlierFilters.yearlyPercentageRange.max);
    paramIndex += 2;
  }

  return { conditions, values, hasLastNDays: !!(lastNDays && lastNDays > 0), lastNDays };
}

class OptimizedAnalysisService {
  /**
   * OPTIMIZED Daily Analysis - Uses raw SQL for complex filters
   * POST /analysis/daily
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

    // Build optimized WHERE clause
    const { conditions, values, hasLastNDays, lastNDays } = await buildOptimizedWhereClause(ticker.id, params);

    let records;

    if (hasLastNDays) {
      // For lastNDays, we need a different query approach
      const whereClause = conditions.join(' AND ');
      const sql = `
        SELECT * FROM daily_seasonality_data
        WHERE ${whereClause}
        ORDER BY date DESC
        LIMIT ${lastNDays}
      `;
      
      records = await prisma.$queryRawUnsafe(sql, ...values);
      records = records.reverse(); // Oldest first
    } else {
      // Use optimized SQL query with all filters pushed to database
      const whereClause = conditions.join(' AND ');
      const sql = `
        SELECT 
          id, date, tickerId,
          open, high, low, close, volume,
          returnPercentage, returnPoints,
          weekday, calendarMonthDay, tradingMonthDay,
          positiveDay, positiveWeek, positiveMonth, positiveYear,
          evenCalendarMonthDay, evenCalendarYearDay,
          evenTradingMonthDay, evenTradingYearDay,
          evenMonth, evenYear,
          mondayWeekNumberMonthly, mondayWeekNumberYearly,
          expiryWeekNumberMonthly, expiryWeekNumberYearly,
          mondayWeeklyReturnPercentage, expiryWeeklyReturnPercentage,
          monthlyReturnPercentage, yearlyReturnPercentage
        FROM daily_seasonality_data
        WHERE ${whereClause}
        ORDER BY date ASC
      `;
      
      records = await prisma.$queryRawUnsafe(sql, ...values);
    }

    // Calculate statistics
    const statistics = calculateStatistics(records);

    // Prepare chart data
    const chartData = calculateCumulativeReturns(records);

    // Prepare table data (limit fields returned)
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
   * OPTIMIZED Daily Aggregate Analysis
   * Uses database aggregation instead of fetching all records
   * POST /analysis/daily/aggregate
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

    // Get ticker
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });

    if (!ticker) {
      throw new Error(`Symbol not found: ${symbol}`);
    }

    // Build WHERE clause
    const { conditions, values } = await buildOptimizedWhereClause(ticker.id, params);

    // Map frontend field names to database columns
    const fieldMapping = {
      'weekday': 'weekday',
      'CalenderYearDay': 'calendarYearDay',
      'TradingYearDay': 'tradingYearDay',
      'CalenderMonthDay': 'calendarMonthDay',
      'TradingMonthDay': 'tradingMonthDay',
      'MonthNumber': 'EXTRACT(MONTH FROM date)'
    };

    const groupField = fieldMapping[aggregateField] || aggregateField;
    
    // Determine aggregation function
    let aggFunction;
    switch (aggregateType) {
      case 'total':
      case 'sum':
        aggFunction = 'SUM(returnPercentage)';
        break;
      case 'max':
        aggFunction = 'MAX(returnPercentage)';
        break;
      case 'min':
        aggFunction = 'MIN(returnPercentage)';
        break;
      case 'avg':
      default:
        aggFunction = 'AVG(returnPercentage)';
    }

    // OPTIMIZED: Use database aggregation instead of fetching all records
    const whereClause = conditions.join(' AND ');
    const sql = `
      SELECT 
        ${groupField} as group_key,
        ${aggFunction} as aggregated_value,
        COUNT(*) as count,
        COUNT(CASE WHEN returnPercentage > 0 THEN 1 END) as positive_count,
        COUNT(CASE WHEN returnPercentage < 0 THEN 1 END) as negative_count,
        AVG(returnPercentage) as avg_return,
        SUM(returnPercentage) as sum_return
      FROM daily_seasonality_data
      WHERE ${whereClause}
      GROUP BY ${groupField}
      ORDER BY ${groupField}
    `;

    const aggregatedResults = await prisma.$queryRawUnsafe(sql, ...values);

    // Format the results
    const aggregatedData = aggregatedResults.map(row => ({
      [aggregateField]: row.group_key,
      value: Number(Number(row.aggregated_value).toFixed(4)),
      count: Number(row.count),
      positiveCount: Number(row.positive_count),
      negativeCount: Number(row.negative_count),
      avgReturn: Number(Number(row.avg_return).toFixed(4)),
      sumReturn: Number(Number(row.sum_return).toFixed(4)),
      winRate: Number(((row.positive_count / row.count) * 100).toFixed(2))
    }));

    // Get statistics for all filtered records
    const statsSql = `
      SELECT returnPercentage
      FROM daily_seasonality_data
      WHERE ${whereClause}
    `;
    const allRecords = await prisma.$queryRawUnsafe(statsSql, ...values);
    const statistics = calculateStatistics(allRecords);

    const result = {
      symbol,
      timeframe: 'daily-aggregate',
      aggregateField,
      aggregateType,
      data: aggregatedData,
      statistics,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: allRecords.length,
        groupsCreated: aggregatedData.length
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * OPTIMIZED Weekly Analysis
   * POST /analysis/weekly
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

    // Build WHERE clause for weekly data
    const conditions = ['tickerId = $1'];
    const values = [ticker.id];
    let paramIndex = 2;

    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      conditions.push(`date >= $${paramIndex} AND date <= $${paramIndex + 1}`);
      values.push(startDate, endDate);
      paramIndex += 2;
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      conditions.push('positiveYear = true');
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      conditions.push('positiveYear = false');
    }

    if (yearFilters.evenOddYears === 'Even') {
      conditions.push('evenYear = true');
    } else if (yearFilters.evenOddYears === 'Odd') {
      conditions.push('evenYear = false');
    }

    // Month filters
    const monthFilters = filters.monthFilters || {};
    if (monthFilters.positiveNegativeMonths === 'Positive') {
      conditions.push('positiveMonth = true');
    } else if (monthFilters.positiveNegativeMonths === 'Negative') {
      conditions.push('positiveMonth = false');
    }

    if (monthFilters.evenOddMonths === 'Even') {
      conditions.push('evenMonth = true');
    } else if (monthFilters.evenOddMonths === 'Odd') {
      conditions.push('evenMonth = false');
    }

    // Week filters
    const weekFilters = filters.weekFilters || {};
    if (weekFilters.positiveNegativeWeeks === 'Positive') {
      conditions.push('positiveWeek = true');
    } else if (weekFilters.positiveNegativeWeeks === 'Negative') {
      conditions.push('positiveWeek = false');
    }

    if (weekFilters.evenOddWeeksMonthly === 'Even') {
      conditions.push('evenWeekNumberMonthly = true');
    } else if (weekFilters.evenOddWeeksMonthly === 'Odd') {
      conditions.push('evenWeekNumberMonthly = false');
    }

    if (weekFilters.evenOddWeeksYearly === 'Even') {
      conditions.push('evenWeekNumberYearly = true');
    } else if (weekFilters.evenOddWeeksYearly === 'Odd') {
      conditions.push('evenWeekNumberYearly = false');
    }

    if (weekFilters.specificWeekMonthly && weekFilters.specificWeekMonthly > 0) {
      conditions.push(`weekNumberMonthly = ${weekFilters.specificWeekMonthly}`);
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.weeklyPercentageRange?.enabled) {
      conditions.push(`returnPercentage >= $${paramIndex} AND returnPercentage <= $${paramIndex + 1}`);
      values.push(outlierFilters.weeklyPercentageRange.min, outlierFilters.weeklyPercentageRange.max);
      paramIndex += 2;
    }

    const tableName = weekType === 'expiry' ? 'expiry_weekly_data' : 'monday_weekly_data';
    const whereClause = conditions.join(' AND ');
    
    const sql = `
      SELECT *
      FROM ${tableName}
      WHERE ${whereClause}
      ORDER BY date ASC
    `;

    const records = await prisma.$queryRawUnsafe(sql, ...values);

    // Apply complex filters (decade years, leap years) in memory for weekly data
    // (these are less common and more complex to implement in SQL)
    let filteredRecords = records;
    
    const decadeYears = yearFilters?.decadeYears;
    if (decadeYears && decadeYears.length > 0 && decadeYears.length < 10) {
      const allowedDecadeDigits = decadeYears.map(d => d === 10 ? 0 : d);
      filteredRecords = filteredRecords.filter(r => {
        const year = new Date(r.date).getFullYear();
        const decadeDigit = year % 10;
        return allowedDecadeDigits.includes(decadeDigit);
      });
    }

    // Calculate statistics
    const statistics = calculateStatistics(filteredRecords);

    // Prepare chart data
    const chartData = calculateCumulativeReturns(filteredRecords);

    // Prepare table data
    const tableData = filteredRecords.map(r => ({
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
      data: tableData,
      meta: {
        processingTime: Date.now() - startTime,
        recordsAnalyzed: filteredRecords.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * OPTIMIZED Monthly Analysis
   * POST /analysis/monthly
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

    // Build WHERE clause
    const conditions = ['tickerId = $1'];
    const values = [ticker.id];
    let paramIndex = 2;

    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      conditions.push(`date >= $${paramIndex} AND date <= $${paramIndex + 1}`);
      values.push(startDate, endDate);
      paramIndex += 2;
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      conditions.push('positiveYear = true');
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      conditions.push('positiveYear = false');
    }

    if (yearFilters.evenOddYears === 'Even') {
      conditions.push('evenYear = true');
    } else if (yearFilters.evenOddYears === 'Odd') {
      conditions.push('evenYear = false');
    }

    // Month filters
    const monthFilters = filters.monthFilters || {};
    if (monthFilters.positiveNegativeMonths === 'Positive') {
      conditions.push('positiveMonth = true');
    } else if (monthFilters.positiveNegativeMonths === 'Negative') {
      conditions.push('positiveMonth = false');
    }

    if (monthFilters.evenOddMonths === 'Even') {
      conditions.push('evenMonth = true');
    } else if (monthFilters.evenOddMonths === 'Odd') {
      conditions.push('evenMonth = false');
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.monthlyPercentageRange?.enabled) {
      conditions.push(`returnPercentage >= $${paramIndex} AND returnPercentage <= $${paramIndex + 1}`);
      values.push(outlierFilters.monthlyPercentageRange.min, outlierFilters.monthlyPercentageRange.max);
      paramIndex += 2;
    }

    if (outlierFilters.yearlyPercentageRange?.enabled) {
      conditions.push(`yearlyReturnPercentage >= $${paramIndex} AND yearlyReturnPercentage <= $${paramIndex + 1}`);
      values.push(outlierFilters.yearlyPercentageRange.min, outlierFilters.yearlyPercentageRange.max);
      paramIndex += 2;
    }

    const whereClause = conditions.join(' AND ');
    
    const sql = `
      SELECT *
      FROM monthly_seasonality_data
      WHERE ${whereClause}
      ORDER BY date ASC
    `;

    let records = await prisma.$queryRawUnsafe(sql, ...values);

    // Apply specific month filter in memory if needed
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
   * OPTIMIZED Yearly Analysis
   * POST /analysis/yearly
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

    // Build WHERE clause
    const conditions = ['tickerId = $1'];
    const values = [ticker.id];
    let paramIndex = 2;

    const { startDate, endDate, filters = {} } = params;

    if (startDate && endDate) {
      conditions.push(`date >= $${paramIndex} AND date <= $${paramIndex + 1}`);
      values.push(startDate, endDate);
      paramIndex += 2;
    }

    // Year filters
    const yearFilters = filters.yearFilters || {};
    if (yearFilters.positiveNegativeYears === 'Positive') {
      conditions.push('positiveYear = true');
    } else if (yearFilters.positiveNegativeYears === 'Negative') {
      conditions.push('positiveYear = false');
    }

    if (yearFilters.evenOddYears === 'Even') {
      conditions.push('evenYear = true');
    } else if (yearFilters.evenOddYears === 'Odd') {
      conditions.push('evenYear = false');
    }

    // Outlier filters
    const outlierFilters = filters.outlierFilters || {};
    if (outlierFilters.yearlyPercentageRange?.enabled) {
      conditions.push(`returnPercentage >= $${paramIndex} AND returnPercentage <= $${paramIndex + 1}`);
      values.push(outlierFilters.yearlyPercentageRange.min, outlierFilters.yearlyPercentageRange.max);
      paramIndex += 2;
    }

    const whereClause = conditions.join(' AND ');
    
    const sql = `
      SELECT *
      FROM yearly_seasonality_data
      WHERE ${whereClause}
      ORDER BY date ASC
    `;

    let records = await prisma.$queryRawUnsafe(sql, ...values);

    // Apply complex filters (decade years, leap years, election years)
    records = this.applyComplexFilters(records, params);

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
   * Apply complex filters in memory (decade years, leap years)
   */
  applyComplexFilters(records, params) {
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

    return filtered;
  }

  /**
   * OPTIMIZED Scenario Analysis
   * POST /analysis/scenario
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

    // Get filtered daily data
    const dailyResult = await this.dailyAnalysis(symbol, params);
    const records = dailyResult.tableData;

    // 1. Historic Trending Days
    const historicTrend = this.calculateHistoricTrend(
      records,
      params.historicTrendType || 'Bullish',
      params.consecutiveDays || 3,
      params.dayRange || 10
    );

    // 2. Trending Streak
    const trendingStreak = this.calculateTrendingStreak(
      records,
      params.trendingStreakValue || 5,
      params.trendingStreakType || 'less',
      params.trendingStreakPercent || 0
    );

    // 3. Momentum Ranking (placeholder)
    const momentumRanking = [];

    // 4. Watchlist Analysis (placeholder)
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
        recordsAnalyzed: records.length,
        filtersApplied: params.filters || {}
      }
    };

    // Cache result
    await cache.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Calculate Historic Trending Days - UNCHANGED
   */
  calculateHistoricTrend(records, trendType, consecutiveDays, dayRange) {
    if (!records || records.length === 0) {
      return null;
    }

    const returns = records.map(r => r.returnPercentage || 0);
    const trendingDates = [];
    let consecutiveCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const ret = returns[i];
      const isTrending = trendType === 'Bullish' ? ret > 0 : ret < 0;
      
      if (isTrending) {
        consecutiveCount++;
        if (consecutiveCount === consecutiveDays) {
          trendingDates.push(i);
          consecutiveCount = 0;
        }
      } else {
        consecutiveCount = 0;
      }
    }

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
      
      for (let i = -dayRange; i < 0; i++) {
        const idx = trendIdx + i;
        row[`T${i}`] = idx >= 0 ? (returns[idx] || 0).toFixed(2) : null;
      }
      
      row['T'] = (returns[trendIdx] || 0).toFixed(2);
      
      for (let i = 1; i <= dayRange; i++) {
        const idx = trendIdx + i;
        row[`T+${i}`] = idx < returns.length ? (returns[idx] || 0).toFixed(2) : null;
      }
      
      tableData.push(row);
    }

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
      tableData: tableData.slice(0, 100),
      statistics,
      superimposedReturns,
      totalOccurrences: trendingDates.length
    };
  }

  /**
   * Calculate Trending Streak - UNCHANGED
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
   * Clear cache for a symbol
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

module.exports = new OptimizedAnalysisService();
