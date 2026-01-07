/**
 * Seasonality Calculation Service
 * Core calculation engine replicating Python analysis logic
 * Based on helper.py functions: getDataTableStatistics, getDataTableForPlot, etc.
 */
const prisma = require('../utils/prisma');
const { cache } = require('../utils/redis');
const { logger } = require('../utils/logger');
const FilterService = require('./FilterService');

class SeasonalityCalculationService {
  /**
   * Calculate daily returns from OHLCV data
   * Returns: { date, open, high, low, close, volume, returnPoints, returnPercentage }
   */
  static calculateDailyReturns(data) {
    if (data.length < 2) return data;

    const result = [];
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      const previous = i > 0 ? data[i - 1] : null;

      const returnPoints = previous ? current.close - previous.close : 0;
      const returnPercentage = previous && previous.close !== 0 
        ? ((current.close - previous.close) / previous.close) * 100 
        : 0;

      result.push({
        ...current,
        returnPoints: parseFloat(returnPoints.toFixed(2)),
        returnPercentage: parseFloat(returnPercentage.toFixed(4)),
        positiveDay: returnPercentage > 0,
      });
    }

    return result;
  }

  /**
   * Calculate statistics for a set of return values
   * Replicates getDataTableStatistics from helper.py
   */
  static calculateStatistics(returnValues) {
    if (!returnValues || returnValues.length === 0) {
      return {
        allCount: 0,
        avgReturnAll: 0,
        sumReturnAll: 0,
        posCount: 0,
        avgReturnPos: 0,
        sumReturnPos: 0,
        negCount: 0,
        avgReturnNeg: 0,
        sumReturnNeg: 0,
        posAccuracy: 0,
        negAccuracy: 0,
      };
    }

    const positiveReturns = returnValues.filter(v => v > 0);
    const negativeReturns = returnValues.filter(v => v < 0);

    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0;

    const allCount = returnValues.length;
    const posCount = positiveReturns.length;
    const negCount = negativeReturns.length;

    return {
      allCount,
      avgReturnAll: parseFloat(avg(returnValues).toFixed(4)),
      sumReturnAll: parseFloat(sum(returnValues).toFixed(4)),
      posCount,
      avgReturnPos: parseFloat(avg(positiveReturns).toFixed(4)),
      sumReturnPos: parseFloat(sum(positiveReturns).toFixed(4)),
      negCount,
      avgReturnNeg: parseFloat(avg(negativeReturns).toFixed(4)),
      sumReturnNeg: parseFloat(sum(negativeReturns).toFixed(4)),
      posAccuracy: allCount > 0 ? parseFloat(((posCount / allCount) * 100).toFixed(2)) : 0,
      negAccuracy: allCount > 0 ? parseFloat(((negCount / allCount) * 100).toFixed(2)) : 0,
    };
  }

  /**
   * Group data by a field and calculate statistics for each group
   */
  static groupAndCalculateStats(data, groupByField, valueField = 'returnPercentage') {
    const groups = {};

    for (const row of data) {
      const key = row[groupByField];
      if (key === undefined || key === null) continue;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row[valueField]);
    }

    const result = {};
    for (const [key, values] of Object.entries(groups)) {
      result[key] = this.calculateStatistics(values);
    }

    return result;
  }

  /**
   * Calculate aggregate statistics by field
   * Replicates aggregate chart functionality
   */
  static calculateAggregateByField(data, field, aggregateType = 'total') {
    const grouped = this.groupAndCalculateStats(data, field);
    
    const result = Object.entries(grouped).map(([key, stats]) => {
      let value;
      switch (aggregateType) {
        case 'total':
          value = stats.sumReturnAll;
          break;
        case 'avg':
          value = stats.avgReturnAll;
          break;
        case 'max':
          value = Math.max(stats.avgReturnPos, 0);
          break;
        case 'min':
          value = Math.min(stats.avgReturnNeg, 0);
          break;
        default:
          value = stats.sumReturnAll;
      }

      return {
        label: key,
        value: parseFloat(value.toFixed(4)),
        ...stats,
      };
    });

    return result.sort((a, b) => {
      const aNum = parseInt(a.label);
      const bNum = parseInt(b.label);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Calculate yearly overlay data
   * Groups data by year and aligns by day of year
   */
  static calculateYearlyOverlay(data, overlayType = 'CalendarDays') {
    const yearlyData = {};

    for (const row of data) {
      const date = new Date(row.date);
      const year = date.getFullYear();
      
      let dayIndex;
      if (overlayType === 'CalendarDays') {
        const startOfYear = new Date(year, 0, 1);
        dayIndex = Math.ceil((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Trading days - need to count only trading days
        dayIndex = row.tradingYearDay || this.getTradingDayOfYear(data, row);
      }

      if (!yearlyData[year]) {
        yearlyData[year] = {};
      }
      yearlyData[year][dayIndex] = row;
    }

    return yearlyData;
  }

  /**
   * Calculate cumulative returns for a dataset
   */
  static calculateCumulativeReturns(data, startValue = 100) {
    if (data.length === 0) return [];

    let cumulative = startValue;
    return data.map(row => {
      cumulative = cumulative * (1 + (row.returnPercentage || 0) / 100);
      return {
        ...row,
        cumulativeReturn: parseFloat(cumulative.toFixed(4)),
        cumulativeReturnPercent: parseFloat(((cumulative - startValue) / startValue * 100).toFixed(4)),
      };
    });
  }

  /**
   * Find consecutive trending days
   * Replicates getNConsecutiveSequanceIndexFromList from helper.py
   */
  static findConsecutiveTrendingDays(dataTable, options) {
    const {
      trendType = 'Bullish',
      consecutiveDays = 3,
      minAccuracy = 60,
      minTotalPnl = 1.5,
      minSampleSize = 50,
      minAvgPnl = 0.2,
      op12 = 'OR',
      op23 = 'OR',
      op34 = 'OR',
    } = options;

    const trendMultiplier = trendType === 'Bullish' ? 1 : -1;
    const results = [];

    const entries = Object.entries(dataTable);
    let idx = 0;

    while (idx <= entries.length - consecutiveDays) {
      const chunk = entries.slice(idx, idx + consecutiveDays);
      
      // Check if all days in chunk have same trend direction
      const allSameTrend = chunk.every(([_, stats]) => 
        (stats.sumReturnAll * trendMultiplier) > 0
      );

      if (!allSameTrend) {
        idx++;
        continue;
      }

      // Check advanced criteria
      const accuracyField = trendType === 'Bullish' ? 'posAccuracy' : 'negAccuracy';
      
      const minAccuracyCheck = chunk.every(([_, stats]) => 
        stats[accuracyField] > minAccuracy
      );

      const totalAvgPnl = chunk.reduce((sum, [_, stats]) => sum + stats.avgReturnAll, 0);
      const totalPnlCheck = (totalAvgPnl * trendMultiplier) > minTotalPnl;

      const minSampleCheck = chunk.every(([_, stats]) => 
        stats.allCount > minSampleSize
      );

      const individualPnlCheck = chunk.every(([_, stats]) => 
        (stats.avgReturnAll * trendMultiplier) > minAvgPnl
      );

      // Apply logical operations
      let advancedCheck = op12 === 'OR' 
        ? (minAccuracyCheck || totalPnlCheck)
        : (minAccuracyCheck && totalPnlCheck);
      
      advancedCheck = op23 === 'OR'
        ? (advancedCheck || minSampleCheck)
        : (advancedCheck && minSampleCheck);
      
      advancedCheck = op34 === 'OR'
        ? (advancedCheck || individualPnlCheck)
        : (advancedCheck && individualPnlCheck);

      if (advancedCheck) {
        results.push({
          startIndex: idx,
          endIndex: idx + consecutiveDays - 1,
          days: chunk.map(([key, stats]) => ({
            day: key,
            ...stats,
          })),
        });
        idx += consecutiveDays;
      } else {
        idx++;
      }
    }

    return results;
  }

  /**
   * Calculate maximum consecutive positive/negative days
   * Replicates maximumConsecutiveValues from helper.py
   */
  static calculateMaxConsecutive(returnValues) {
    let maxPositive = 0, currentPositive = 0;
    let maxNegative = 0, currentNegative = 0;

    for (const value of returnValues) {
      if (value > 0) {
        currentPositive++;
        maxPositive = Math.max(maxPositive, currentPositive);
        currentNegative = 0;
      } else if (value < 0) {
        currentNegative++;
        maxNegative = Math.max(maxNegative, currentNegative);
        currentPositive = 0;
      } else {
        currentPositive = 0;
        currentNegative = 0;
      }
    }

    return { maxPositive, maxNegative };
  }

  /**
   * Generate data table for display
   * Replicates getDataTableForPlot from helper.py
   */
  static generateDataTable(groupedStats) {
    const rows = [];

    for (const [key, stats] of Object.entries(groupedStats)) {
      rows.push({
        index: key,
        'All Count': stats.allCount,
        'Avg Return All': stats.avgReturnAll,
        'Sum Return All': stats.sumReturnAll,
        'Pos Count': `${stats.posCount}(${stats.posAccuracy}%)`,
        'Avg Return Pos': stats.avgReturnPos,
        'Sum Return Pos': stats.sumReturnPos,
        'Neg Count': `${stats.negCount}(${stats.negAccuracy}%)`,
        'Avg Return Neg': stats.avgReturnNeg,
        'Sum Return Neg': stats.sumReturnNeg,
      });
    }

    return rows;
  }

  /**
   * Calculate week number (monthly or yearly)
   */
  static getWeekNumber(date, type = 'monthly') {
    const d = new Date(date);
    
    if (type === 'monthly') {
      return Math.ceil(d.getDate() / 7);
    } else {
      // Yearly week number
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
      return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }
  }

  /**
   * Get weekday name
   */
  static getWeekdayName(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date).getDay()];
  }

  /**
   * Enrich data with calculated fields
   * Adds fields needed for filtering and analysis
   */
  static enrichDataWithCalculatedFields(data) {
    return data.map((row, index) => {
      const date = new Date(row.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();
      const dayOfWeek = date.getDay();
      
      // Calculate day of year
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.ceil((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

      return {
        ...row,
        year,
        month,
        dayOfMonth,
        dayOfYear,
        weekday: this.getWeekdayName(date),
        weekNumberMonthly: this.getWeekNumber(date, 'monthly'),
        weekNumberYearly: this.getWeekNumber(date, 'yearly'),
        evenYear: year % 2 === 0,
        evenMonth: month % 2 === 0,
        evenDayOfMonth: dayOfMonth % 2 === 0,
        evenDayOfYear: dayOfYear % 2 === 0,
        isLeapYear: (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0),
        isElectionYear: FilterService.getElectionYearType(year) === 'Election',
        electionYearType: FilterService.getElectionYearType(year),
      };
    });
  }

  /**
   * Calculate trading day number within month/year
   * Requires sorted data
   */
  static calculateTradingDays(data) {
    const result = [];
    let tradingDayMonth = 0;
    let tradingDayYear = 0;
    let currentMonth = null;
    let currentYear = null;

    for (const row of data) {
      const date = new Date(row.date);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (year !== currentYear) {
        currentYear = year;
        tradingDayYear = 0;
      }

      if (month !== currentMonth || year !== currentYear) {
        currentMonth = month;
        tradingDayMonth = 0;
      }

      tradingDayMonth++;
      tradingDayYear++;

      result.push({
        ...row,
        tradingDayMonth,
        tradingDayYear,
        evenTradingDayMonth: tradingDayMonth % 2 === 0,
        evenTradingDayYear: tradingDayYear % 2 === 0,
      });
    }

    return result;
  }
}

module.exports = SeasonalityCalculationService;
