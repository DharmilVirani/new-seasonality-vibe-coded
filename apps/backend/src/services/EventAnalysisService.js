/**
 * Event Analysis Service V2
 * Professional-grade Seasonax-style event study engine
 * 
 * KEY FEATURES:
 * - Hard T0 anchoring (event day is always exactly T0)
 * - Deterministic trading-day alignment
 * - Strict event window validation
 * - Stable average event curve
 * - Before/Event/After segmentation
 * - Robust error handling
 */

const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');

class EventAnalysisServiceV2 {
  /**
   * Main event analysis function
   */
  static async analyzeEvents(params) {
    const startTime = Date.now();
    
    try {
      // 1. Validate parameters
      this.validateParams(params);
      
      // 2. Get ticker
      const ticker = await this.getTicker(params.symbol);
      
      // 3. Get all trading days for the symbol (needed for deterministic alignment)
      const allTradingDays = await this.getAllTradingDays(ticker.id, params.startDate, params.endDate);
      
      if (allTradingDays.length === 0) {
        throw new Error('No trading data available for the specified date range');
      }
      
      // 4. Get event occurrences
      const rawEvents = await this.getEventOccurrences(params);
      
      if (rawEvents.length === 0) {
        throw new Error('No events found matching the specified criteria');
      }
      
      // 5. Build event windows with strict T0 anchoring
      const eventWindows = await this.buildEventWindows(
        rawEvents,
        allTradingDays,
        params.windowConfig
      );
      
      // 6. Validate and filter complete event windows
      const validEvents = this.validateEventWindows(
        eventWindows,
        params.windowConfig,
        params.tradeConfig
      );
      
      if (validEvents.length < (params.filters?.minOccurrences || 3)) {
        throw new Error(
          `Insufficient complete event windows. Found ${validEvents.length} valid events, ` +
          `minimum ${params.filters?.minOccurrences || 3} required. ` +
          `${eventWindows.length - validEvents.length} events were excluded due to incomplete data.`
        );
      }
      
      // 7. Calculate trades with deterministic entry/exit
      const trades = this.calculateEventTrades(validEvents, params.tradeConfig);
      
      // 8. Build average event curve (Seasonax-style)
      const averageEventCurve = this.buildAverageEventCurve(validEvents, params.windowConfig);
      
      // 9. Calculate segmented statistics (Before/Event/After)
      const segmentedStats = this.calculateSegmentedStatistics(validEvents, params.windowConfig);
      
      // 10. Calculate aggregated metrics
      const aggregatedMetrics = this.calculateAggregatedMetrics(trades);
      
      // 11. Generate equity curve
      const equityCurve = this.calculateEquityCurve(trades);
      
      const result = {
        success: true,
        data: {
          symbol: params.symbol,
          eventSummary: {
            totalEventsFound: rawEvents.length,
            validEvents: validEvents.length,
            excludedEvents: eventWindows.length - validEvents.length,
            exclusionReasons: this.getExclusionReasons(eventWindows, validEvents),
            dateRange: {
              start: params.startDate,
              end: params.endDate
            }
          },
          averageEventCurve,
          segmentedStats,
          eventOccurrences: trades,
          aggregatedMetrics,
          equityCurve
        },
        meta: {
          processingTime: Date.now() - startTime,
          windowConfig: params.windowConfig,
          tradeConfig: params.tradeConfig
        }
      };
      
      return result;
      
    } catch (error) {
      logger.error('Event analysis error:', error);
      throw error;
    }
  }
  
  /**
   * Validate input parameters
   */
  static validateParams(params) {
    if (!params.symbol) {
      throw new Error('Symbol is required');
    }
    if (!params.startDate || !params.endDate) {
      throw new Error('Date range is required');
    }
    if (!params.eventNames && !params.eventCategories) {
      throw new Error('Either eventNames or eventCategories must be provided');
    }
    
    // Validate window config
    const windowConfig = params.windowConfig || {};
    if (windowConfig.daysBefore < 0 || windowConfig.daysAfter < 0) {
      throw new Error('Window days must be non-negative');
    }
  }
  
  /**
   * Get ticker by symbol
   */
  static async getTicker(symbol) {
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() }
    });
    
    if (!ticker) {
      throw new Error(`Symbol ${symbol} not found`);
    }
    
    return ticker;
  }
  
  /**
   * Get all trading days for deterministic alignment
   * This is CRITICAL for proper T0 anchoring
   */
  static async getAllTradingDays(tickerId, startDate, endDate) {
    // Expand date range to ensure we have enough buffer for event windows
    const bufferDays = 60; // 60 calendar days buffer
    const expandedStart = new Date(startDate);
    expandedStart.setDate(expandedStart.getDate() - bufferDays);
    
    const expandedEnd = new Date(endDate);
    expandedEnd.setDate(expandedEnd.getDate() + bufferDays);
    
    const tradingDays = await prisma.dailySeasonalityData.findMany({
      where: {
        tickerId,
        date: {
          gte: expandedStart,
          lte: expandedEnd
        }
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
        returnPercentage: true
      }
    });
    
    // Create a map for O(1) lookup
    const tradingDayMap = new Map();
    tradingDays.forEach((day, index) => {
      const dateKey = this.getDateKey(day.date);
      tradingDayMap.set(dateKey, {
        ...day,
        tradingDayIndex: index
      });
    });
    
    return { tradingDays, tradingDayMap };
  }
  
  /**
   * Get event occurrences
   */
  static async getEventOccurrences(params) {
    const whereClause = {
      date: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate)
      }
    };
    
    if (params.eventNames && params.eventNames.length > 0) {
      whereClause.name = {
        in: params.eventNames.map(n => n.toUpperCase())
      };
    } else if (params.eventCategories && params.eventCategories.length > 0) {
      whereClause.category = {
        in: params.eventCategories.map(c => c.toUpperCase())
      };
    }
    
    if (params.country) {
      whereClause.country = params.country.toUpperCase();
    }
    
    const events = await prisma.specialDay.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });
    
    return events;
  }
  
  /**
   * Build event windows with strict T0 anchoring
   * This is the CORE of proper event analysis
   */
  static async buildEventWindows(rawEvents, allTradingDaysData, windowConfig) {
    const { daysBefore = 10, daysAfter = 10 } = windowConfig;
    const { tradingDays, tradingDayMap } = allTradingDaysData;
    
    const eventWindows = [];
    
    for (const event of rawEvents) {
      const eventDateKey = this.getDateKey(event.date);
      const eventDayData = tradingDayMap.get(eventDateKey);
      
      // CRITICAL: Event day must be a trading day
      if (!eventDayData) {
        eventWindows.push({
          event,
          isValid: false,
          exclusionReason: 'Event day is not a trading day',
          priceData: []
        });
        continue;
      }
      
      const eventIndex = eventDayData.tradingDayIndex;
      
      // Build deterministic window using trading day indices
      const windowStart = eventIndex - daysBefore;
      const windowEnd = eventIndex + daysAfter;
      
      // Check if we have enough data
      if (windowStart < 0 || windowEnd >= tradingDays.length) {
        eventWindows.push({
          event,
          isValid: false,
          exclusionReason: `Insufficient data: need ${daysBefore} days before and ${daysAfter} days after`,
          priceData: []
        });
        continue;
      }
      
      // Extract window data with HARD T0 anchoring
      const priceData = [];
      for (let i = windowStart; i <= windowEnd; i++) {
        const day = tradingDays[i];
        const relativeDay = i - eventIndex; // This is ALWAYS deterministic
        
        priceData.push({
          relativeDay,
          date: day.date,
          open: day.open,
          high: day.high,
          low: day.low,
          close: day.close,
          volume: day.volume,
          returnPercentage: day.returnPercentage || 0,
          isEventDay: relativeDay === 0 // HARD ANCHOR
        });
      }
      
      eventWindows.push({
        event,
        eventDate: event.date,
        eventName: event.name,
        year: event.year,
        category: event.category,
        isValid: true,
        priceData,
        t0Index: eventIndex
      });
    }
    
    return eventWindows;
  }
  
  /**
   * Validate event windows for completeness
   */
  static validateEventWindows(eventWindows, windowConfig, tradeConfig) {
    const { daysBefore, daysAfter } = windowConfig;
    const validEvents = [];
    
    for (const eventWindow of eventWindows) {
      if (!eventWindow.isValid) {
        continue;
      }
      
      // Parse entry/exit requirements
      const entryDay = this.parseTradePoint(tradeConfig.entryType);
      const exitDay = this.parseExitPoint(tradeConfig.daysAfter);
      
      // Verify required days exist
      const hasT0 = eventWindow.priceData.some(d => d.relativeDay === 0);
      const hasEntry = eventWindow.priceData.some(d => d.relativeDay === entryDay.relativeDay);
      const hasExit = eventWindow.priceData.some(d => d.relativeDay === exitDay);
      
      if (!hasT0) {
        eventWindow.isValid = false;
        eventWindow.exclusionReason = 'Missing T0 (event day)';
        continue;
      }
      
      if (!hasEntry) {
        eventWindow.isValid = false;
        eventWindow.exclusionReason = `Missing entry day (${tradeConfig.entryType})`;
        continue;
      }
      
      if (!hasExit) {
        eventWindow.isValid = false;
        eventWindow.exclusionReason = `Missing exit day (T+${tradeConfig.daysAfter})`;
        continue;
      }
      
      // Verify window completeness
      const expectedDays = daysBefore + daysAfter + 1;
      if (eventWindow.priceData.length < expectedDays) {
        eventWindow.isValid = false;
        eventWindow.exclusionReason = `Incomplete window: has ${eventWindow.priceData.length} days, needs ${expectedDays}`;
        continue;
      }
      
      validEvents.push(eventWindow);
    }
    
    return validEvents;
  }
  
  /**
   * Parse trade entry point (e.g., "T-1_CLOSE", "T0_OPEN")
   */
  static parseTradePoint(entryType) {
    const match = entryType.match(/T([+-]?\d+)_(\w+)/);
    if (!match) {
      return { relativeDay: -1, priceField: 'close' };
    }
    
    return {
      relativeDay: parseInt(match[1]),
      priceField: match[2].toLowerCase()
    };
  }
  
  /**
   * Parse exit point
   */
  static parseExitPoint(daysAfter) {
    return parseInt(daysAfter);
  }
  
  /**
   * Calculate event trades with deterministic entry/exit
   */
  static calculateEventTrades(validEvents, tradeConfig) {
    const entryPoint = this.parseTradePoint(tradeConfig.entryType);
    const exitDay = this.parseExitPoint(tradeConfig.daysAfter);
    
    const trades = [];
    
    for (const eventWindow of validEvents) {
      const entryDayData = eventWindow.priceData.find(d => d.relativeDay === entryPoint.relativeDay);
      const exitDayData = eventWindow.priceData.find(d => d.relativeDay === exitDay);
      
      if (!entryDayData || !exitDayData) {
        continue; // Should not happen after validation
      }
      
      const entryPrice = entryDayData[entryPoint.priceField];
      const exitPrice = exitDayData.close;
      
      // Calculate return
      const absoluteReturn = exitPrice - entryPrice;
      const returnPercentage = (absoluteReturn / entryPrice) * 100;
      
      // Calculate MFE/MAE in the holding period
      const holdingPeriod = eventWindow.priceData.filter(
        d => d.relativeDay >= entryPoint.relativeDay && d.relativeDay <= exitDay
      );
      
      const maxPrice = Math.max(...holdingPeriod.map(d => d.high));
      const minPrice = Math.min(...holdingPeriod.map(d => d.low));
      
      const mfe = ((maxPrice - entryPrice) / entryPrice) * 100;
      const mae = ((minPrice - entryPrice) / entryPrice) * 100;
      
      trades.push({
        eventName: eventWindow.eventName,
        eventDate: eventWindow.eventDate,
        year: eventWindow.year,
        category: eventWindow.category,
        entryDate: entryDayData.date,
        entryPrice,
        exitDate: exitDayData.date,
        exitPrice,
        absoluteReturn,
        returnPercentage,
        mfe,
        mae,
        holdingDays: exitDay - entryPoint.relativeDay,
        isProfitable: returnPercentage > 0
      });
    }
    
    return trades;
  }
  
  /**
   * Build average event curve (Seasonax-style)
   * Per-relative-day aggregation with proper counting
   */
  static buildAverageEventCurve(validEvents, windowConfig) {
    const { daysBefore, daysAfter } = windowConfig;
    const relativeDayMap = new Map();
    
    // Initialize all expected relative days
    for (let day = -daysBefore; day <= daysAfter; day++) {
      relativeDayMap.set(day, {
        relativeDay: day,
        returns: [],
        isEventDay: day === 0
      });
    }
    
    // Collect returns for each relative day
    validEvents.forEach(eventWindow => {
      eventWindow.priceData.forEach(dayData => {
        const bucket = relativeDayMap.get(dayData.relativeDay);
        if (bucket) {
          bucket.returns.push(dayData.returnPercentage);
        }
      });
    });
    
    // Calculate statistics for each relative day
    const averageCurve = [];
    for (const [relativeDay, bucket] of relativeDayMap.entries()) {
      if (bucket.returns.length === 0) {
        continue; // Skip days with no data
      }
      
      averageCurve.push({
        relativeDay,
        avgReturn: this.mean(bucket.returns),
        medianReturn: this.median(bucket.returns),
        stdDev: this.standardDeviation(bucket.returns),
        count: bucket.returns.length,
        minReturn: Math.min(...bucket.returns),
        maxReturn: Math.max(...bucket.returns),
        isEventDay: bucket.isEventDay
      });
    }
    
    return averageCurve.sort((a, b) => a.relativeDay - b.relativeDay);
  }
  
  /**
   * Calculate segmented statistics (Before/Event/After)
   */
  static calculateSegmentedStatistics(validEvents, windowConfig) {
    const preEventReturns = [];
    const eventDayReturns = [];
    const postEventReturns = [];
    
    validEvents.forEach(eventWindow => {
      eventWindow.priceData.forEach(dayData => {
        if (dayData.relativeDay < 0) {
          preEventReturns.push(dayData.returnPercentage);
        } else if (dayData.relativeDay === 0) {
          eventDayReturns.push(dayData.returnPercentage);
        } else {
          postEventReturns.push(dayData.returnPercentage);
        }
      });
    });
    
    return {
      preEvent: this.calculateSegmentStats(preEventReturns, 'Pre-Event'),
      eventDay: this.calculateSegmentStats(eventDayReturns, 'Event Day'),
      postEvent: this.calculateSegmentStats(postEventReturns, 'Post-Event')
    };
  }
  
  /**
   * Calculate statistics for a segment
   */
  static calculateSegmentStats(returns, label) {
    if (returns.length === 0) {
      return {
        label,
        count: 0,
        avgReturn: 0,
        medianReturn: 0,
        stdDev: 0,
        winRate: 0
      };
    }
    
    const positiveReturns = returns.filter(r => r > 0);
    
    return {
      label,
      count: returns.length,
      avgReturn: parseFloat(this.mean(returns).toFixed(4)),
      medianReturn: parseFloat(this.median(returns).toFixed(4)),
      stdDev: parseFloat(this.standardDeviation(returns).toFixed(4)),
      winRate: parseFloat(((positiveReturns.length / returns.length) * 100).toFixed(2))
    };
  }
  
  /**
   * Calculate aggregated metrics
   */
  static calculateAggregatedMetrics(trades) {
    if (trades.length === 0) {
      return null;
    }
    
    const returns = trades.map(t => t.returnPercentage);
    const profitableTrades = trades.filter(t => t.isProfitable);
    const losingTrades = trades.filter(t => !t.isProfitable);
    
    const winRate = (profitableTrades.length / trades.length) * 100;
    const avgReturn = this.mean(returns);
    const medianReturn = this.median(returns);
    const stdDev = this.standardDeviation(returns);
    
    // Profit factor
    const grossProfit = profitableTrades.reduce((sum, t) => sum + t.returnPercentage, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.returnPercentage, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    
    // Sharpe ratio
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    // Sortino ratio
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDeviation = downsideReturns.length > 0 
      ? this.standardDeviation(downsideReturns) 
      : stdDev;
    const sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
    
    // Best/Worst
    const bestTrade = trades.reduce((best, t) => 
      t.returnPercentage > best.returnPercentage ? t : best
    );
    const worstTrade = trades.reduce((worst, t) => 
      t.returnPercentage < worst.returnPercentage ? t : worst
    );

    // Max Drawdown calculation using equity curve
    let equity = 100;
    let peakEquity = 100;
    let maxDrawdown = 0;
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.eventDate) - new Date(b.eventDate)
    );
    for (const trade of sortedTrades) {
      equity = equity * (1 + trade.returnPercentage / 100);
      if (equity > peakEquity) {
        peakEquity = equity;
      }
      const drawdown = (peakEquity - equity) / peakEquity * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalEvents: trades.length,
      winningEvents: profitableTrades.length,
      losingEvents: losingTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      medianReturn: parseFloat(medianReturn.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      bestEvent: {
        date: bestTrade.eventDate,
        return: parseFloat(bestTrade.returnPercentage.toFixed(2))
      },
      worstEvent: {
        date: worstTrade.eventDate,
        return: parseFloat(worstTrade.returnPercentage.toFixed(2))
      },
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2))
    };
  }
  
  /**
   * Calculate equity curve
   */
  static calculateEquityCurve(trades) {
    let equity = 100;
    const curve = [{ eventDate: null, equity: 100 }];
    
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.eventDate) - new Date(b.eventDate)
    );
    
    sortedTrades.forEach(trade => {
      equity = equity * (1 + trade.returnPercentage / 100);
      curve.push({
        eventDate: trade.eventDate,
        eventName: trade.eventName,
        equity: parseFloat(equity.toFixed(2)),
        return: trade.returnPercentage
      });
    });
    
    return curve;
  }
  
  /**
   * Get exclusion reasons summary
   */
  static getExclusionReasons(allWindows, validWindows) {
    const excluded = allWindows.filter(w => !w.isValid);
    const reasons = {};
    
    excluded.forEach(w => {
      const reason = w.exclusionReason || 'Unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    
    return reasons;
  }
  
  /**
   * Get date key for consistent date comparison
   */
  static getDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  
  // Statistical helper functions
  static mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  static median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  static standardDeviation(values) {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}

module.exports = EventAnalysisServiceV2;
