/**
 * File Generator Module
 * JavaScript implementation of Python GenerateFiles.py and GenerateMultipleFiles.py
 * Generates 5 analysis files from uploaded seasonality data:
 * 1. 1_Daily.csv - Enhanced daily data with calculated fields
 * 2. 2_MondayWeekly.csv - Monday-based weekly aggregation
 * 3. 3_ExpiryWeekly.csv - Expiry-based weekly aggregation
 * 4. 4_Monthly.csv - Monthly aggregation
 * 5. 5_Yearly.csv - Yearly aggregation
 */

const { logger } = require('../utils/logger');

/**
 * Column aggregation logic for resampling
 */
const COLUMN_LOGIC = {
  ticker: 'first',
  open: 'first',
  high: 'max',
  low: 'min',
  close: 'last',
  volume: 'sum',
  openInterest: 'last',
  weekday: 'first'
};

/**
 * Main file generator class
 */
class FileGenerator {
  constructor() {
    this.symbolDailyData = [];
    this.symbolMondayWeeklyData = [];
    this.symbolExpiryWeeklyData = [];
    this.symbolMonthlyData = [];
    this.symbolYearlyData = [];
  }

  /**
   * Generate all 5 files from daily data
   * @param {Array} dailyData - Array of daily OHLCV records
   * @param {string} symbol - Symbol name
   * @returns {Object} Generated file data
   */
  async generateFiles(dailyData, symbol) {
    try {
      logger.info('Starting file generation', { symbol, records: dailyData.length });

      // Step 1: Prepare and format daily data
      this.symbolDailyData = this.prepareDailyData(dailyData);

      // Step 2: Generate timeframe aggregations
      this.symbolMondayWeeklyData = this.generateMondayWeeklyData();
      this.symbolExpiryWeeklyData = this.generateExpiryWeeklyData();
      this.symbolMonthlyData = this.generateMonthlyData();
      this.symbolYearlyData = this.generateYearlyData();

      // Step 3: Calculate derived fields for each timeframe
      this.calculateYearlyFields();
      this.calculateMonthlyFields();
      this.calculateMondayWeeklyFields();
      this.calculateExpiryWeeklyFields();
      this.calculateDailyFields();

      logger.info('File generation completed', {
        symbol,
        daily: this.symbolDailyData.length,
        mondayWeekly: this.symbolMondayWeeklyData.length,
        expiryWeekly: this.symbolExpiryWeeklyData.length,
        monthly: this.symbolMonthlyData.length,
        yearly: this.symbolYearlyData.length
      });

      return {
        daily: this.symbolDailyData,
        mondayWeekly: this.symbolMondayWeeklyData,
        expiryWeekly: this.symbolExpiryWeeklyData,
        monthly: this.symbolMonthlyData,
        yearly: this.symbolYearlyData
      };

    } catch (error) {
      logger.error('File generation failed', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Prepare and format daily data
   * @param {Array} rawData - Raw daily data
   * @returns {Array} Formatted daily data
   */
  prepareDailyData(rawData) {
    return rawData.map(record => ({
      date: new Date(record.date),
      ticker: record.ticker || record.symbol,
      open: parseFloat(record.open),
      high: parseFloat(record.high),
      low: parseFloat(record.low),
      close: parseFloat(record.close),
      volume: parseInt(record.volume),
      openInterest: parseInt(record.openInterest || 0),
      weekday: new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })
    })).sort((a, b) => a.date - b.date);
  }

  /**
   * Generate Monday-based weekly data (W-SUN with Monday start)
   * @returns {Array} Monday weekly data
   */
  generateMondayWeeklyData() {
    const weeklyData = new Map();

    this.symbolDailyData.forEach(record => {
      // Get Monday of the week (start of week)
      const monday = this.getMondayOfWeek(record.date);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          date: monday,
          ticker: record.ticker,
          open: record.open,
          high: record.high,
          low: record.low,
          close: record.close,
          volume: record.volume,
          openInterest: record.openInterest,
          weekday: 'Monday'
        });
      } else {
        const existing = weeklyData.get(weekKey);
        existing.high = Math.max(existing.high, record.high);
        existing.low = Math.min(existing.low, record.low);
        existing.close = record.close; // Last close
        existing.volume += record.volume;
        existing.openInterest = record.openInterest; // Last open interest
      }
    });

    return Array.from(weeklyData.values()).sort((a, b) => a.date - b.date);
  }

  /**
   * Generate Expiry-based weekly data (W-THU with Friday end)
   * @returns {Array} Expiry weekly data
   */
  generateExpiryWeeklyData() {
    const weeklyData = new Map();

    this.symbolDailyData.forEach(record => {
      // Get Friday of the week (end of expiry week)
      const friday = this.getFridayOfWeek(record.date);
      const weekKey = friday.toISOString().split('T')[0];

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          date: friday,
          startDate: this.getStartOfExpiryWeek(friday),
          ticker: record.ticker,
          open: record.open,
          high: record.high,
          low: record.low,
          close: record.close,
          volume: record.volume,
          openInterest: record.openInterest,
          weekday: 'Friday'
        });
      } else {
        const existing = weeklyData.get(weekKey);
        existing.high = Math.max(existing.high, record.high);
        existing.low = Math.min(existing.low, record.low);
        existing.close = record.close; // Last close
        existing.volume += record.volume;
        existing.openInterest = record.openInterest; // Last open interest
      }
    });

    return Array.from(weeklyData.values()).sort((a, b) => a.date - b.date);
  }

  /**
   * Generate monthly data
   * @returns {Array} Monthly data
   */
  generateMonthlyData() {
    const monthlyData = new Map();

    this.symbolDailyData.forEach(record => {
      const monthKey = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = new Date(record.date.getFullYear(), record.date.getMonth(), 1);

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          date: monthStart,
          ticker: record.ticker,
          open: record.open,
          high: record.high,
          low: record.low,
          close: record.close,
          volume: record.volume,
          openInterest: record.openInterest,
          weekday: monthStart.toLocaleDateString('en-US', { weekday: 'long' })
        });
      } else {
        const existing = monthlyData.get(monthKey);
        existing.high = Math.max(existing.high, record.high);
        existing.low = Math.min(existing.low, record.low);
        existing.close = record.close; // Last close
        existing.volume += record.volume;
        existing.openInterest = record.openInterest; // Last open interest
      }
    });

    return Array.from(monthlyData.values()).sort((a, b) => a.date - b.date);
  }

  /**
   * Generate yearly data
   * @returns {Array} Yearly data
   */
  generateYearlyData() {
    const yearlyData = new Map();

    this.symbolDailyData.forEach(record => {
      const yearKey = record.date.getFullYear().toString();
      const yearStart = new Date(record.date.getFullYear(), 0, 1);

      if (!yearlyData.has(yearKey)) {
        yearlyData.set(yearKey, {
          date: yearStart,
          ticker: record.ticker,
          open: record.open,
          high: record.high,
          low: record.low,
          close: record.close,
          volume: record.volume,
          openInterest: record.openInterest,
          weekday: yearStart.toLocaleDateString('en-US', { weekday: 'long' })
        });
      } else {
        const existing = yearlyData.get(yearKey);
        existing.high = Math.max(existing.high, record.high);
        existing.low = Math.min(existing.low, record.low);
        existing.close = record.close; // Last close
        existing.volume += record.volume;
        existing.openInterest = record.openInterest; // Last open interest
      }
    });

    return Array.from(yearlyData.values()).sort((a, b) => a.date - b.date);
  }

  /**
   * Calculate yearly derived fields
   */
  calculateYearlyFields() {
    for (let i = 0; i < this.symbolYearlyData.length; i++) {
      const record = this.symbolYearlyData[i];
      
      // Even year
      record.evenYear = (record.date.getFullYear() % 2) === 0;
      
      // Return calculations
      if (i > 0) {
        const prevRecord = this.symbolYearlyData[i - 1];
        record.returnPoints = record.close - prevRecord.close;
        record.returnPercentage = Math.round((record.returnPoints / prevRecord.close) * 100 * 100) / 100;
      } else {
        record.returnPoints = null;
        record.returnPercentage = null;
      }
      
      record.positiveYear = record.returnPoints > 0;
    }
  }

  /**
   * Calculate monthly derived fields
   */
  calculateMonthlyFields() {
    for (let i = 0; i < this.symbolMonthlyData.length; i++) {
      const record = this.symbolMonthlyData[i];
      
      // Even month
      record.evenMonth = (record.date.getMonth() + 1) % 2 === 0;
      
      // Return calculations
      if (i > 0) {
        const prevRecord = this.symbolMonthlyData[i - 1];
        record.returnPoints = record.close - prevRecord.close;
        record.returnPercentage = Math.round((record.returnPoints / prevRecord.close) * 100 * 100) / 100;
      } else {
        record.returnPoints = null;
        record.returnPercentage = null;
      }
      
      record.positiveMonth = record.returnPoints > 0;
      
      // Yearly returns
      const yearlyReturns = this.getYearlyReturns(record);
      record.evenYear = (record.date.getFullYear() % 2) === 0;
      record.yearlyReturnPoints = yearlyReturns.returnPoints;
      record.yearlyReturnPercentage = yearlyReturns.returnPercentage;
      record.positiveYear = yearlyReturns.returnPoints > 0;
    }
  }

  /**
   * Calculate Monday weekly derived fields
   */
  calculateMondayWeeklyFields() {
    // Calculate week numbers
    for (let i = 0; i < this.symbolMondayWeeklyData.length; i++) {
      const record = this.symbolMondayWeeklyData[i];
      
      if (i === 0) {
        record.weekNumberMonthly = null;
        record.weekNumberYearly = null;
      } else {
        const prevRecord = this.symbolMondayWeeklyData[i - 1];
        
        // Monthly week number
        if (record.date.getMonth() !== prevRecord.date.getMonth()) {
          record.weekNumberMonthly = 1;
        } else {
          record.weekNumberMonthly = (prevRecord.weekNumberMonthly || 0) + 1;
        }
        
        // Yearly week number
        if (record.date.getFullYear() !== prevRecord.date.getFullYear()) {
          record.weekNumberYearly = 1;
        } else {
          record.weekNumberYearly = (prevRecord.weekNumberYearly || 0) + 1;
        }
      }
      
      // Even week numbers
      record.evenWeekNumberMonthly = record.weekNumberMonthly ? (record.weekNumberMonthly % 2) === 0 : null;
      record.evenWeekNumberYearly = record.weekNumberYearly ? (record.weekNumberYearly % 2) === 0 : null;
      
      // Return calculations
      if (i > 0) {
        const prevRecord = this.symbolMondayWeeklyData[i - 1];
        record.returnPoints = record.close - prevRecord.close;
        record.returnPercentage = Math.round((record.returnPoints / prevRecord.close) * 100 * 100) / 100;
      } else {
        record.returnPoints = null;
        record.returnPercentage = null;
      }
      
      record.positiveWeek = record.returnPoints > 0;
      
      // Monthly returns
      const monthlyReturns = this.getMonthlyReturns(record);
      record.evenMonth = (record.date.getMonth() + 1) % 2 === 0;
      record.monthlyReturnPoints = monthlyReturns.returnPoints;
      record.monthlyReturnPercentage = monthlyReturns.returnPercentage;
      record.positiveMonth = monthlyReturns.returnPoints > 0;
      
      // Yearly returns
      const yearlyReturns = this.getYearlyReturns(record);
      record.evenYear = (record.date.getFullYear() % 2) === 0;
      record.yearlyReturnPoints = yearlyReturns.returnPoints;
      record.yearlyReturnPercentage = yearlyReturns.returnPercentage;
      record.positiveYear = yearlyReturns.returnPoints > 0;
    }
  }

  /**
   * Calculate Expiry weekly derived fields
   */
  calculateExpiryWeeklyFields() {
    // Calculate week numbers
    for (let i = 0; i < this.symbolExpiryWeeklyData.length; i++) {
      const record = this.symbolExpiryWeeklyData[i];
      
      if (i === 0) {
        record.weekNumberMonthly = null;
        record.weekNumberYearly = null;
      } else {
        const prevRecord = this.symbolExpiryWeeklyData[i - 1];
        
        // Monthly week number
        if (record.date.getMonth() !== prevRecord.date.getMonth()) {
          record.weekNumberMonthly = 1;
        } else {
          record.weekNumberMonthly = (prevRecord.weekNumberMonthly || 0) + 1;
        }
        
        // Yearly week number
        if (record.date.getFullYear() !== prevRecord.date.getFullYear()) {
          record.weekNumberYearly = 1;
        } else {
          record.weekNumberYearly = (prevRecord.weekNumberYearly || 0) + 1;
        }
      }
      
      // Even week numbers
      record.evenWeekNumberMonthly = record.weekNumberMonthly ? (record.weekNumberMonthly % 2) === 0 : null;
      record.evenWeekNumberYearly = record.weekNumberYearly ? (record.weekNumberYearly % 2) === 0 : null;
      
      // Return calculations
      if (i > 0) {
        const prevRecord = this.symbolExpiryWeeklyData[i - 1];
        record.returnPoints = record.close - prevRecord.close;
        record.returnPercentage = Math.round((record.returnPoints / prevRecord.close) * 100 * 100) / 100;
      } else {
        record.returnPoints = null;
        record.returnPercentage = null;
      }
      
      record.positiveWeek = record.returnPoints > 0;
      
      // Monthly returns
      const monthlyReturns = this.getMonthlyReturns(record);
      record.evenMonth = (record.date.getMonth() + 1) % 2 === 0;
      record.monthlyReturnPoints = monthlyReturns.returnPoints;
      record.monthlyReturnPercentage = monthlyReturns.returnPercentage;
      record.positiveMonth = monthlyReturns.returnPoints > 0;
      
      // Yearly returns
      const yearlyReturns = this.getYearlyReturns(record);
      record.evenYear = (record.date.getFullYear() % 2) === 0;
      record.yearlyReturnPoints = yearlyReturns.returnPoints;
      record.yearlyReturnPercentage = yearlyReturns.returnPercentage;
      record.positiveYear = yearlyReturns.returnPoints > 0;
    }
  }

  /**
   * Calculate daily derived fields
   */
  calculateDailyFields() {
    for (let i = 0; i < this.symbolDailyData.length; i++) {
      const record = this.symbolDailyData[i];
      
      // Calendar day fields
      record.calendarMonthDay = record.date.getDate();
      record.calendarYearDay = this.getDayOfYear(record.date);
      
      // Trading day fields
      if (i === 0) {
        record.tradingMonthDay = null;
        record.tradingYearDay = null;
      } else {
        const prevRecord = this.symbolDailyData[i - 1];
        
        // Trading month day
        if (record.date.getMonth() !== prevRecord.date.getMonth()) {
          record.tradingMonthDay = 1;
        } else {
          record.tradingMonthDay = (prevRecord.tradingMonthDay || 0) + 1;
        }
        
        // Trading year day
        if (record.date.getFullYear() !== prevRecord.date.getFullYear()) {
          record.tradingYearDay = 1;
        } else {
          record.tradingYearDay = (prevRecord.tradingYearDay || 0) + 1;
        }
      }
      
      // Even day fields
      record.evenCalendarMonthDay = (record.calendarMonthDay % 2) === 0;
      record.evenCalendarYearDay = (record.calendarYearDay % 2) === 0;
      record.evenTradingMonthDay = record.tradingMonthDay ? (record.tradingMonthDay % 2) === 0 : null;
      record.evenTradingYearDay = record.tradingYearDay ? (record.tradingYearDay % 2) === 0 : null;
      
      // Return calculations
      if (i > 0) {
        const prevRecord = this.symbolDailyData[i - 1];
        record.returnPoints = record.close - prevRecord.close;
        record.returnPercentage = Math.round((record.returnPoints / prevRecord.close) * 100 * 100) / 100;
      } else {
        record.returnPoints = null;
        record.returnPercentage = null;
      }
      
      record.positiveDay = record.returnPoints > 0;
      
      // Monday weekly calculations
      record.mondayWeeklyDate = this.getMondayOfWeek(record.date);
      const mondayWeeklyData = this.getMondayWeeklyData(record);
      record.mondayWeekNumberMonthly = mondayWeeklyData.weekNumberMonthly;
      record.mondayWeekNumberYearly = mondayWeeklyData.weekNumberYearly;
      record.evenMondayWeekNumberMonthly = mondayWeeklyData.weekNumberMonthly ? (mondayWeeklyData.weekNumberMonthly % 2) === 0 : null;
      record.evenMondayWeekNumberYearly = mondayWeeklyData.weekNumberYearly ? (mondayWeeklyData.weekNumberYearly % 2) === 0 : null;
      record.mondayWeeklyReturnPoints = mondayWeeklyData.returnPoints;
      record.mondayWeeklyReturnPercentage = mondayWeeklyData.returnPercentage;
      record.positiveMondayWeek = mondayWeeklyData.returnPoints > 0;
      
      // Expiry weekly calculations
      record.expiryWeeklyDate = this.getFridayOfWeek(record.date);
      const expiryWeeklyData = this.getExpiryWeeklyData(record);
      record.expiryWeekNumberMonthly = expiryWeeklyData.weekNumberMonthly;
      record.expiryWeekNumberYearly = expiryWeeklyData.weekNumberYearly;
      record.evenExpiryWeekNumberMonthly = expiryWeeklyData.weekNumberMonthly ? (expiryWeeklyData.weekNumberMonthly % 2) === 0 : null;
      record.evenExpiryWeekNumberYearly = expiryWeeklyData.weekNumberYearly ? (expiryWeeklyData.weekNumberYearly % 2) === 0 : null;
      record.expiryWeeklyReturnPoints = expiryWeeklyData.returnPoints;
      record.expiryWeeklyReturnPercentage = expiryWeeklyData.returnPercentage;
      record.positiveExpiryWeek = expiryWeeklyData.returnPoints > 0;
      
      // Monthly returns
      const monthlyReturns = this.getMonthlyReturns(record);
      record.evenMonth = (record.date.getMonth() + 1) % 2 === 0;
      record.monthlyReturnPoints = monthlyReturns.returnPoints;
      record.monthlyReturnPercentage = monthlyReturns.returnPercentage;
      record.positiveMonth = monthlyReturns.returnPoints > 0;
      
      // Yearly returns
      const yearlyReturns = this.getYearlyReturns(record);
      record.evenYear = (record.date.getFullYear() % 2) === 0;
      record.yearlyReturnPoints = yearlyReturns.returnPoints;
      record.yearlyReturnPercentage = yearlyReturns.returnPercentage;
      record.positiveYear = yearlyReturns.returnPoints > 0;
    }
  }

  // Helper methods
  getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  getFridayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 5) { // If it's Friday
      return new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000); // Add 6 days
    } else {
      const diff = 5 - day; // Days until Friday
      return new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
    }
  }

  getStartOfExpiryWeek(friday) {
    return new Date(friday.getTime() - 6 * 24 * 60 * 60 * 1000);
  }

  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  getYearlyReturns(record) {
    const yearStart = new Date(record.date.getFullYear(), 0, 1);
    const yearlyRecord = this.symbolYearlyData.find(y => y.date.getTime() === yearStart.getTime());
    
    if (yearlyRecord) {
      return {
        returnPoints: yearlyRecord.returnPoints,
        returnPercentage: yearlyRecord.returnPercentage
      };
    }
    
    return { returnPoints: null, returnPercentage: null };
  }

  getMonthlyReturns(record) {
    const monthStart = new Date(record.date.getFullYear(), record.date.getMonth(), 1);
    const monthlyRecord = this.symbolMonthlyData.find(m => m.date.getTime() === monthStart.getTime());
    
    if (monthlyRecord) {
      return {
        returnPoints: monthlyRecord.returnPoints,
        returnPercentage: monthlyRecord.returnPercentage
      };
    }
    
    return { returnPoints: null, returnPercentage: null };
  }

  getMondayWeeklyData(record) {
    const mondayDate = this.getMondayOfWeek(record.date);
    const weeklyRecord = this.symbolMondayWeeklyData.find(w => w.date.getTime() === mondayDate.getTime());
    
    if (weeklyRecord) {
      return {
        returnPoints: weeklyRecord.returnPoints,
        returnPercentage: weeklyRecord.returnPercentage,
        weekNumberMonthly: weeklyRecord.weekNumberMonthly,
        weekNumberYearly: weeklyRecord.weekNumberYearly
      };
    }
    
    return { returnPoints: null, returnPercentage: null, weekNumberMonthly: null, weekNumberYearly: null };
  }

  getExpiryWeeklyData(record) {
    const fridayDate = this.getFridayOfWeek(record.date);
    const weeklyRecord = this.symbolExpiryWeeklyData.find(w => w.date.getTime() === fridayDate.getTime());
    
    if (weeklyRecord) {
      return {
        returnPoints: weeklyRecord.returnPoints,
        returnPercentage: weeklyRecord.returnPercentage,
        weekNumberMonthly: weeklyRecord.weekNumberMonthly,
        weekNumberYearly: weeklyRecord.weekNumberYearly
      };
    }
    
    return { returnPoints: null, returnPercentage: null, weekNumberMonthly: null, weekNumberYearly: null };
  }

  /**
   * Convert data to CSV format
   * @param {Array} data - Data array
   * @returns {string} CSV string
   */
  toCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return value.toISOString().split('T')[0];
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

/**
 * Generate files for a symbol
 * @param {Array} dailyData - Daily OHLCV data
 * @param {string} symbol - Symbol name
 * @returns {Object} Generated files data
 */
async function generateSymbolFiles(dailyData, symbol) {
  const generator = new FileGenerator();
  return await generator.generateFiles(dailyData, symbol);
}

module.exports = {
  FileGenerator,
  generateSymbolFiles
};