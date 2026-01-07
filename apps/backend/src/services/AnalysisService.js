/**
 * Analysis Service
 * High-level analysis operations combining data fetching, filtering, and calculations
 */
const prisma = require('../utils/prisma');
const { cache } = require('../utils/redis');
const { logger } = require('../utils/logger');
const FilterService = require('./FilterService');
const SeasonalityCalculationService = require('./SeasonalityCalculationService');
const { NotFoundError } = require('../utils/errors');

class AnalysisService {
  /**
   * Get ticker by symbol
   */
  static async getTickerBySymbol(symbol) {
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!ticker) {
      throw new NotFoundError(`Symbol ${symbol}`);
    }
    return ticker;
  }

  /**
   * Get all active tickers
   */
  static async getAllTickers() {
    return prisma.ticker.findMany({
      where: { isActive: true },
      orderBy: { symbol: 'asc' },
    });
  }

  /**
   * Fetch and process daily data for analysis
   */
  static async getDailyAnalysis(params) {
    const { symbols, startDate, endDate, lastNDays, filters, aggregateType, aggregateField, electionYearType } = params;

    const cacheKey = `daily:${JSON.stringify(params)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const results = {};

    for (const symbol of symbols) {
      try {
        const ticker = await this.getTickerBySymbol(symbol);
        
        // Fetch raw data
        const whereClause = FilterService.buildWhereClause(
          filters, ticker.id, startDate, endDate, lastNDays
        );

        let data = await prisma.seasonalityData.findMany({
          where: whereClause,
          orderBy: { date: 'asc' },
        });

        if (data.length === 0) {
          results[symbol] = { error: 'No data found', data: [] };
          continue;
        }

        // Calculate returns
        data = SeasonalityCalculationService.calculateDailyReturns(data);

        // Enrich with calculated fields
        data = SeasonalityCalculationService.enrichDataWithCalculatedFields(data);

        // Calculate trading days
        data = SeasonalityCalculationService.calculateTradingDays(data);

        // Apply in-memory filters
        data = FilterService.applyInMemoryFilters(data, filters);

        // Apply election year filter if specified
        if (electionYearType) {
          data = FilterService.filterByElectionYearType(data, electionYearType);
        }

        // Calculate statistics
        const returnValues = data.map(d => d.returnPercentage);
        const statistics = SeasonalityCalculationService.calculateStatistics(returnValues);
        const maxConsecutive = SeasonalityCalculationService.calculateMaxConsecutive(returnValues);

        // Calculate aggregate if requested
        let aggregateData = null;
        if (aggregateType && aggregateField) {
          aggregateData = SeasonalityCalculationService.calculateAggregateByField(
            data, aggregateField, aggregateType
          );
        }

        // Group by trading day for data table
        const groupedByTradingDay = SeasonalityCalculationService.groupAndCalculateStats(
          data, 'tradingDayMonth'
        );
        const dataTable = SeasonalityCalculationService.generateDataTable(groupedByTradingDay);

        results[symbol] = {
          symbol,
          ticker,
          data: data.map(d => ({
            date: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
            returnPoints: d.returnPoints,
            returnPercentage: d.returnPercentage,
            weekday: d.weekday,
            tradingDayMonth: d.tradingDayMonth,
          })),
          statistics,
          maxConsecutive,
          aggregateData,
          dataTable,
          recordCount: data.length,
          dateRange: {
            start: data[0]?.date,
            end: data[data.length - 1]?.date,
          },
        };
      } catch (error) {
        logger.error('Daily analysis error', { symbol, error: error.message });
        results[symbol] = { error: error.message, data: [] };
      }
    }

    await cache.set(cacheKey, results, 3600);
    return results;
  }

  /**
   * Get yearly overlay analysis
   */
  static async getYearlyOverlay(params) {
    const { symbols, startDate, endDate, filters, overlayType } = params;

    const cacheKey = `yearly-overlay:${JSON.stringify(params)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const results = {};

    for (const symbol of symbols) {
      try {
        const ticker = await this.getTickerBySymbol(symbol);
        
        const whereClause = FilterService.buildWhereClause(
          filters, ticker.id, startDate, endDate
        );

        let data = await prisma.seasonalityData.findMany({
          where: whereClause,
          orderBy: { date: 'asc' },
        });

        if (data.length === 0) {
          results[symbol] = { error: 'No data found', data: {} };
          continue;
        }

        // Calculate returns and enrich
        data = SeasonalityCalculationService.calculateDailyReturns(data);
        data = SeasonalityCalculationService.enrichDataWithCalculatedFields(data);
        data = SeasonalityCalculationService.calculateTradingDays(data);
        data = FilterService.applyInMemoryFilters(data, filters);

        // Calculate yearly overlay
        const yearlyData = SeasonalityCalculationService.calculateYearlyOverlay(data, overlayType);

        // Calculate cumulative returns per year
        const yearlyReturns = {};
        for (const [year, dayData] of Object.entries(yearlyData)) {
          const sortedDays = Object.entries(dayData)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([_, row]) => row);
          
          yearlyReturns[year] = SeasonalityCalculationService.calculateCumulativeReturns(sortedDays);
        }

        results[symbol] = {
          symbol,
          ticker,
          yearlyData: yearlyReturns,
          years: Object.keys(yearlyData).sort(),
        };
      } catch (error) {
        logger.error('Yearly overlay error', { symbol, error: error.message });
        results[symbol] = { error: error.message, data: {} };
      }
    }

    await cache.set(cacheKey, results, 3600);
    return results;
  }

  /**
   * Run symbol scanner
   * Finds symbols with consecutive trending days matching criteria
   */
  static async runScanner(params) {
    const {
      symbols,
      startDate,
      endDate,
      filters,
      trendType,
      consecutiveDays,
      criteria,
    } = params;

    const cacheKey = `scanner:${JSON.stringify(params)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Get all symbols if not specified
    let symbolList = symbols;
    if (!symbolList || symbolList.length === 0) {
      const tickers = await this.getAllTickers();
      symbolList = tickers.map(t => t.symbol);
    }

    const results = [];

    for (const symbol of symbolList) {
      try {
        const ticker = await this.getTickerBySymbol(symbol);
        
        const whereClause = FilterService.buildWhereClause(
          filters, ticker.id, startDate, endDate
        );

        let data = await prisma.seasonalityData.findMany({
          where: whereClause,
          orderBy: { date: 'asc' },
        });

        if (data.length === 0) continue;

        // Process data
        data = SeasonalityCalculationService.calculateDailyReturns(data);
        data = SeasonalityCalculationService.enrichDataWithCalculatedFields(data);
        data = SeasonalityCalculationService.calculateTradingDays(data);
        data = FilterService.applyInMemoryFilters(data, filters);

        // Group by trading day
        const groupedStats = SeasonalityCalculationService.groupAndCalculateStats(
          data, 'tradingDayMonth'
        );

        // Find consecutive trending days
        const matches = SeasonalityCalculationService.findConsecutiveTrendingDays(
          groupedStats,
          {
            trendType,
            consecutiveDays,
            ...criteria,
          }
        );

        // Add matches to results
        for (const match of matches) {
          results.push({
            symbol,
            ticker: ticker.name || symbol,
            startDay: match.days[0].day,
            endDay: match.days[match.days.length - 1].day,
            days: match.days,
            totalReturn: match.days.reduce((sum, d) => sum + d.avgReturnAll, 0),
            avgAccuracy: match.days.reduce((sum, d) => 
              sum + (trendType === 'Bullish' ? d.posAccuracy : d.negAccuracy), 0
            ) / match.days.length,
          });
        }
      } catch (error) {
        logger.error('Scanner error', { symbol, error: error.message });
      }
    }

    // Sort by total return
    results.sort((a, b) => Math.abs(b.totalReturn) - Math.abs(a.totalReturn));

    await cache.set(cacheKey, results, 1800); // 30 min cache
    return results;
  }

  /**
   * Calculate scenario analysis (day-to-day trading)
   */
  static async getScenarioAnalysis(params) {
    const {
      symbol,
      startDate,
      endDate,
      entryType,
      exitType,
      tradeType,
      entryDay,
      exitDay,
      returnType,
    } = params;

    const cacheKey = `scenario:${JSON.stringify(params)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const ticker = await this.getTickerBySymbol(symbol);

    let data = await prisma.seasonalityData.findMany({
      where: {
        tickerId: ticker.id,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });

    if (data.length === 0) {
      return { error: 'No data found', trades: [] };
    }

    // Enrich with weekday info
    data = SeasonalityCalculationService.enrichDataWithCalculatedFields(data);

    // Filter to only entry and exit days
    const filteredData = data.filter(d => 
      d.weekday === entryDay || d.weekday === exitDay
    );

    if (entryDay === exitDay) {
      return { error: 'Entry and exit day cannot be the same', trades: [] };
    }

    // Calculate day order
    const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
    const startDayNum = dayOrder[entryDay];
    const endDayNum = dayOrder[exitDay];
    const expectedDiff = endDayNum > startDayNum 
      ? endDayNum - startDayNum 
      : 7 - startDayNum + endDayNum;

    // Find valid trades
    const trades = [];
    for (let i = 0; i < filteredData.length - 1; i++) {
      const entry = filteredData[i];
      const exit = filteredData[i + 1];

      if (entry.weekday !== entryDay) continue;

      const entryDate = new Date(entry.date);
      const exitDate = new Date(exit.date);
      const daysDiff = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24));

      if (daysDiff !== expectedDiff) continue;

      const entryPrice = entryType === 'Open' ? entry.open : entry.close;
      const exitPrice = exitType === 'Open' ? exit.open : exit.close;

      let returnValue = exitPrice - entryPrice;
      if (returnType === 'Percent') {
        returnValue = (returnValue / entryPrice) * 100;
      }
      if (tradeType === 'Short') {
        returnValue *= -1;
      }

      trades.push({
        entryDate: entry.date,
        exitDate: exit.date,
        entryPrice,
        exitPrice,
        return: parseFloat(returnValue.toFixed(4)),
        year: entryDate.getFullYear(),
        month: entryDate.getMonth() + 1,
      });
    }

    // Calculate monthly pivot table
    const monthlyReturns = {};
    for (const trade of trades) {
      const key = `${trade.year}`;
      if (!monthlyReturns[key]) {
        monthlyReturns[key] = {};
      }
      const monthKey = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][trade.month - 1];
      if (!monthlyReturns[key][monthKey]) {
        monthlyReturns[key][monthKey] = 0;
      }
      monthlyReturns[key][monthKey] += trade.return;
    }

    // Calculate totals
    for (const year of Object.keys(monthlyReturns)) {
      monthlyReturns[year].Total = Object.values(monthlyReturns[year])
        .reduce((sum, val) => sum + val, 0);
    }

    // Calculate statistics
    const returns = trades.map(t => t.return);
    const statistics = SeasonalityCalculationService.calculateStatistics(returns);

    const result = {
      symbol,
      ticker,
      trades,
      monthlyReturns,
      statistics,
      tradeCount: trades.length,
      params: { entryDay, exitDay, entryType, exitType, tradeType, returnType },
    };

    await cache.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * Get recent performance metrics
   */
  static async getRecentPerformance(symbol, periods = { days: 5, weeks: 4, months: 3 }) {
    const ticker = await this.getTickerBySymbol(symbol);

    const data = await prisma.seasonalityData.findMany({
      where: { tickerId: ticker.id },
      orderBy: { date: 'desc' },
      take: 365, // Get last year of data
    });

    if (data.length < 2) {
      return { error: 'Insufficient data' };
    }

    // Reverse to chronological order
    data.reverse();

    // Calculate returns
    const withReturns = SeasonalityCalculationService.calculateDailyReturns(data);

    // Recent day return
    const recentDays = withReturns.slice(-periods.days - 1);
    const dayReturn = recentDays.length > 1
      ? ((recentDays[recentDays.length - 1].close - recentDays[0].close) / recentDays[0].close) * 100
      : 0;

    // Recent week return (approximate)
    const weekDays = periods.weeks * 5;
    const recentWeeks = withReturns.slice(-weekDays - 1);
    const weekReturn = recentWeeks.length > 1
      ? ((recentWeeks[recentWeeks.length - 1].close - recentWeeks[0].close) / recentWeeks[0].close) * 100
      : 0;

    // Recent month return (approximate)
    const monthDays = periods.months * 22;
    const recentMonths = withReturns.slice(-monthDays - 1);
    const monthReturn = recentMonths.length > 1
      ? ((recentMonths[recentMonths.length - 1].close - recentMonths[0].close) / recentMonths[0].close) * 100
      : 0;

    return {
      symbol,
      lastPrice: data[data.length - 1].close,
      lastDate: data[data.length - 1].date,
      returns: {
        [`${periods.days}d`]: parseFloat(dayReturn.toFixed(2)),
        [`${periods.weeks}w`]: parseFloat(weekReturn.toFixed(2)),
        [`${periods.months}m`]: parseFloat(monthReturn.toFixed(2)),
      },
    };
  }
}

module.exports = AnalysisService;
