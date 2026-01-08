/**
 * Phase 2 Migration Script
 * Migrates calculated data from old-software CSV files to database tables:
 * - 1_Daily.csv → DailySeasonalityData
 * - 2_MondayWeekly.csv → MondayWeeklyData
 * - 3_ExpiryWeekly.csv → ExpiryWeeklyData
 * - 4_Monthly.csv → MonthlySeasonalityData
 * - 5_Yearly.csv → YearlySeasonalityData
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Path to old-software symbols directory
const SYMBOLS_DIR = path.join(__dirname, '../../../old-software/Symbols');

/**
 * Parse CSV file to array of objects
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      data.push(row);
    }
  }
  
  return data;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse float value
 */
function parseFloat2(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse int value
 */
function parseInt2(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse boolean value from Python output
 */
function parseBool(value) {
  if (value === '' || value === null || value === undefined) return null;
  const lower = String(value).toLowerCase().trim();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return null;
}

/**
 * Get all symbol directories
 */
function getSymbolDirs() {
  if (!fs.existsSync(SYMBOLS_DIR)) {
    console.error(`Symbols directory not found: ${SYMBOLS_DIR}`);
    return [];
  }
  
  return fs.readdirSync(SYMBOLS_DIR)
    .filter(name => {
      const fullPath = path.join(SYMBOLS_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    });
}

/**
 * Migrate Daily data (1_Daily.csv)
 */
async function migrateDailyData(symbol, tickerId) {
  const filePath = path.join(SYMBOLS_DIR, symbol, '1_Daily.csv');
  if (!fs.existsSync(filePath)) {
    console.log(`1_Daily.csv not found for ${symbol}`);
    return 0;
  }
  
  const data = parseCSV(filePath);
  let count = 0;
  
  for (const row of data) {
    const date = parseDate(row.Date);
    if (!date) continue;
    
    try {
      await prisma.dailySeasonalityData.upsert({
        where: {
          date_tickerId: { date, tickerId }
        },
        update: {
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          calendarMonthDay: parseInt2(row.CalenderMonthDay),
          calendarYearDay: parseInt2(row.CalenderYearDay),
          tradingMonthDay: parseInt2(row.TradingMonthDay),
          tradingYearDay: parseInt2(row.TradingYearDay),
          evenCalendarMonthDay: parseBool(row.EvenCalenderMonthDay),
          evenCalendarYearDay: parseBool(row.EvenCalenderYearDay),
          evenTradingMonthDay: parseBool(row.EvenTradingMonthDay),
          evenTradingYearDay: parseBool(row.EvenTradingYearDay),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveDay: parseBool(row.PositiveDay),
          mondayWeeklyDate: parseDate(row.MondayWeeklyDate),
          mondayWeekNumberMonthly: parseInt2(row.MondayWeekNumberMonthly),
          mondayWeekNumberYearly: parseInt2(row.MondayWeekNumberYearly),
          evenMondayWeekNumberMonthly: parseBool(row.EvenMondayWeekNumberMonthly),
          evenMondayWeekNumberYearly: parseBool(row.EvenMondayWeekNumberYearly),
          mondayWeeklyReturnPoints: parseFloat2(row.MondayWeeklyReturnPoints),
          mondayWeeklyReturnPercentage: parseFloat2(row.MondayWeeklyReturnPercentage),
          positiveMondayWeek: parseBool(row.PositiveMondayWeek),
          expiryWeeklyDate: parseDate(row.ExpiryWeeklyDate),
          expiryWeekNumberMonthly: parseInt2(row.ExpiryWeekNumberMonthly),
          expiryWeekNumberYearly: parseInt2(row.ExpiryWeekNumberYearly),
          evenExpiryWeekNumberMonthly: parseBool(row.EvenExpiryWeekNumberMonthly),
          evenExpiryWeekNumberYearly: parseBool(row.EvenExpiryWeekNumberYearly),
          expiryWeeklyReturnPoints: parseFloat2(row.ExpiryWeeklyReturnPoints),
          expiryWeeklyReturnPercentage: parseFloat2(row.ExpiryWeeklyReturnPercentage),
          positiveExpiryWeek: parseBool(row.PositiveExpiryWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear),
          updatedAt: new Date()
        },
        create: {
          tickerId,
          date,
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          calendarMonthDay: parseInt2(row.CalenderMonthDay),
          calendarYearDay: parseInt2(row.CalenderYearDay),
          tradingMonthDay: parseInt2(row.TradingMonthDay),
          tradingYearDay: parseInt2(row.TradingYearDay),
          evenCalendarMonthDay: parseBool(row.EvenCalenderMonthDay),
          evenCalendarYearDay: parseBool(row.EvenCalenderYearDay),
          evenTradingMonthDay: parseBool(row.EvenTradingMonthDay),
          evenTradingYearDay: parseBool(row.EvenTradingYearDay),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveDay: parseBool(row.PositiveDay),
          mondayWeeklyDate: parseDate(row.MondayWeeklyDate),
          mondayWeekNumberMonthly: parseInt2(row.MondayWeekNumberMonthly),
          mondayWeekNumberYearly: parseInt2(row.MondayWeekNumberYearly),
          evenMondayWeekNumberMonthly: parseBool(row.EvenMondayWeekNumberMonthly),
          evenMondayWeekNumberYearly: parseBool(row.EvenMondayWeekNumberYearly),
          mondayWeeklyReturnPoints: parseFloat2(row.MondayWeeklyReturnPoints),
          mondayWeeklyReturnPercentage: parseFloat2(row.MondayWeeklyReturnPercentage),
          positiveMondayWeek: parseBool(row.PositiveMondayWeek),
          expiryWeeklyDate: parseDate(row.ExpiryWeeklyDate),
          expiryWeekNumberMonthly: parseInt2(row.ExpiryWeekNumberMonthly),
          expiryWeekNumberYearly: parseInt2(row.ExpiryWeekNumberYearly),
          evenExpiryWeekNumberMonthly: parseBool(row.EvenExpiryWeekNumberMonthly),
          evenExpiryWeekNumberYearly: parseBool(row.EvenExpiryWeekNumberYearly),
          expiryWeeklyReturnPoints: parseFloat2(row.ExpiryWeeklyReturnPoints),
          expiryWeeklyReturnPercentage: parseFloat2(row.ExpiryWeeklyReturnPercentage),
          positiveExpiryWeek: parseBool(row.PositiveExpiryWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear)
        }
      });
      count++;
    } catch (error) {
      // Skip errors silently
    }
  }
  
  return count;
}

/**
 * Migrate Monday Weekly data (2_MondayWeekly.csv)
 */
async function migrateMondayWeeklyData(symbol, tickerId) {
  const filePath = path.join(SYMBOLS_DIR, symbol, '2_MondayWeekly.csv');
  if (!fs.existsSync(filePath)) {
    console.log(` 2_MondayWeekly.csv not found for ${symbol}`);
    return 0;
  }
  
  const data = parseCSV(filePath);
  let count = 0;
  
  for (const row of data) {
    const date = parseDate(row.Date);
    if (!date) continue;
    
    try {
      await prisma.mondayWeeklyData.upsert({
        where: {
          date_tickerId: { date, tickerId }
        },
        update: {
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          weekNumberMonthly: parseInt2(row.WeekNumberMonthly),
          weekNumberYearly: parseInt2(row.WeekNumberYearly),
          evenWeekNumberMonthly: parseBool(row.EvenWeekNumberMonthly),
          evenWeekNumberYearly: parseBool(row.EvenWeekNumberYearly),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveWeek: parseBool(row.PositiveWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear),
          updatedAt: new Date()
        },
        create: {
          tickerId,
          date,
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          weekNumberMonthly: parseInt2(row.WeekNumberMonthly),
          weekNumberYearly: parseInt2(row.WeekNumberYearly),
          evenWeekNumberMonthly: parseBool(row.EvenWeekNumberMonthly),
          evenWeekNumberYearly: parseBool(row.EvenWeekNumberYearly),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveWeek: parseBool(row.PositiveWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear)
        }
      });
      count++;
    } catch (error) {
      // Skip errors silently
    }
  }
  
  return count;
}

/**
 * Migrate Expiry Weekly data (3_ExpiryWeekly.csv)
 */
async function migrateExpiryWeeklyData(symbol, tickerId) {
  const filePath = path.join(SYMBOLS_DIR, symbol, '3_ExpiryWeekly.csv');
  if (!fs.existsSync(filePath)) {
    console.log(`  3_ExpiryWeekly.csv not found for ${symbol}`);
    return 0;
  }
  
  const data = parseCSV(filePath);
  let count = 0;
  
  for (const row of data) {
    const date = parseDate(row.Date);
    if (!date) continue;
    
    try {
      await prisma.expiryWeeklyData.upsert({
        where: {
          date_tickerId: { date, tickerId }
        },
        update: {
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          startDate: parseDate(row.StartDate),
          weekNumberMonthly: parseInt2(row.WeekNumberMonthly),
          weekNumberYearly: parseInt2(row.WeekNumberYearly),
          evenWeekNumberMonthly: parseBool(row.EvenWeekNumberMonthly),
          evenWeekNumberYearly: parseBool(row.EvenWeekNumberYearly),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveWeek: parseBool(row.PositiveWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear),
          updatedAt: new Date()
        },
        create: {
          tickerId,
          date,
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          startDate: parseDate(row.StartDate),
          weekNumberMonthly: parseInt2(row.WeekNumberMonthly),
          weekNumberYearly: parseInt2(row.WeekNumberYearly),
          evenWeekNumberMonthly: parseBool(row.EvenWeekNumberMonthly),
          evenWeekNumberYearly: parseBool(row.EvenWeekNumberYearly),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveWeek: parseBool(row.PositiveWeek),
          evenMonth: parseBool(row.EvenMonth),
          monthlyReturnPoints: parseFloat2(row.MonthlyReturnPoints),
          monthlyReturnPercentage: parseFloat2(row.MonthlyReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear)
        }
      });
      count++;
    } catch (error) {
      // Skip errors silently
    }
  }
  
  return count;
}

/**
 * Migrate Monthly data (4_Monthly.csv)
 */
async function migrateMonthlyData(symbol, tickerId) {
  const filePath = path.join(SYMBOLS_DIR, symbol, '4_Monthly.csv');
  if (!fs.existsSync(filePath)) {
    console.log(`  4_Monthly.csv not found for ${symbol}`);
    return 0;
  }
  
  const data = parseCSV(filePath);
  let count = 0;
  
  for (const row of data) {
    const date = parseDate(row.Date);
    if (!date) continue;
    
    try {
      await prisma.monthlySeasonalityData.upsert({
        where: {
          date_tickerId: { date, tickerId }
        },
        update: {
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          evenMonth: parseBool(row.EvenMonth),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear),
          updatedAt: new Date()
        },
        create: {
          tickerId,
          date,
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          evenMonth: parseBool(row.EvenMonth),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveMonth: parseBool(row.PositiveMonth),
          evenYear: parseBool(row.EvenYear),
          yearlyReturnPoints: parseFloat2(row.YearlyReturnPoints),
          yearlyReturnPercentage: parseFloat2(row.YearlyReturnPercentage),
          positiveYear: parseBool(row.PositiveYear)
        }
      });
      count++;
    } catch (error) {
      // Skip errors silently
    }
  }
  
  return count;
}

/**
 * Migrate Yearly data (5_Yearly.csv)
 */
async function migrateYearlyData(symbol, tickerId) {
  const filePath = path.join(SYMBOLS_DIR, symbol, '5_Yearly.csv');
  if (!fs.existsSync(filePath)) {
    console.log(`  5_Yearly.csv not found for ${symbol}`);
    return 0;
  }
  
  const data = parseCSV(filePath);
  let count = 0;
  
  for (const row of data) {
    const date = parseDate(row.Date);
    if (!date) continue;
    
    try {
      await prisma.yearlySeasonalityData.upsert({
        where: {
          date_tickerId: { date, tickerId }
        },
        update: {
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          evenYear: parseBool(row.EvenYear),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveYear: parseBool(row.PositiveYear),
          updatedAt: new Date()
        },
        create: {
          tickerId,
          date,
          open: parseFloat2(row.Open) || 0,
          high: parseFloat2(row.High) || 0,
          low: parseFloat2(row.Low) || 0,
          close: parseFloat2(row.Close) || 0,
          volume: parseFloat2(row.Volume) || 0,
          openInterest: parseFloat2(row.OpenInterest) || 0,
          weekday: row.Weekday || null,
          evenYear: parseBool(row.EvenYear),
          returnPoints: parseFloat2(row.ReturnPoints),
          returnPercentage: parseFloat2(row.ReturnPercentage),
          positiveYear: parseBool(row.PositiveYear)
        }
      });
      count++;
    } catch (error) {
      // Skip errors silently
    }
  }
  
  return count;
}

/**
 * Main migration function
 */
async function runPhase2Migration() {
  console.log('Starting Phase 2 Migration...\n');
  console.log('This will migrate calculated data from old-software CSV files to database tables.\n');
  
  const symbols = getSymbolDirs();
  console.log(`Found ${symbols.length} symbols to migrate\n`);
  
  const totals = {
    daily: 0,
    mondayWeekly: 0,
    expiryWeekly: 0,
    monthly: 0,
    yearly: 0
  };
  
  for (const symbol of symbols) {
    console.log(`\nProcessing ${symbol}...`);
    
    // Get or create ticker
    let ticker = await prisma.ticker.findUnique({ where: { symbol } });
    
    if (!ticker) {
      ticker = await prisma.ticker.create({
        data: {
          symbol,
          name: symbol,
          isActive: true
        }
      });
      console.log(`Created ticker: ${symbol}`);
    }
    
    // Migrate all 5 file types
    const dailyCount = await migrateDailyData(symbol, ticker.id);
    const mondayWeeklyCount = await migrateMondayWeeklyData(symbol, ticker.id);
    const expiryWeeklyCount = await migrateExpiryWeeklyData(symbol, ticker.id);
    const monthlyCount = await migrateMonthlyData(symbol, ticker.id);
    const yearlyCount = await migrateYearlyData(symbol, ticker.id);
    
    console.log(`Daily: ${dailyCount}, MondayWeekly: ${mondayWeeklyCount}, ExpiryWeekly: ${expiryWeeklyCount}, Monthly: ${monthlyCount}, Yearly: ${yearlyCount}`);
    
    totals.daily += dailyCount;
    totals.mondayWeekly += mondayWeeklyCount;
    totals.expiryWeekly += expiryWeeklyCount;
    totals.monthly += monthlyCount;
    totals.yearly += yearlyCount;
  }
  
  // Print final summary
  console.log('\n\n========================================');
  console.log('MIGRATION COMPLETE - FINAL COUNTS:');
  console.log('========================================');
  console.log(`DailySeasonalityData: ${totals.daily}`);
  console.log(`MondayWeeklyData: ${totals.mondayWeekly}`);
  console.log(`ExpiryWeeklyData: ${totals.expiryWeekly}`);
  console.log(`MonthlySeasonalityData: ${totals.monthly}`);
  console.log(`YearlySeasonalityData: ${totals.yearly}`);
  console.log('========================================\n');
  
  // Verify with database counts
  console.log('🔍 Verifying database counts...');
  const dbCounts = {
    daily: await prisma.dailySeasonalityData.count(),
    mondayWeekly: await prisma.mondayWeeklyData.count(),
    expiryWeekly: await prisma.expiryWeeklyData.count(),
    monthly: await prisma.monthlySeasonalityData.count(),
    yearly: await prisma.yearlySeasonalityData.count()
  };
  
  console.log(`DailySeasonalityData: ${dbCounts.daily}`);
  console.log(`MondayWeeklyData: ${dbCounts.mondayWeekly}`);
  console.log(`ExpiryWeeklyData: ${dbCounts.expiryWeekly}`);
  console.log(`MonthlySeasonalityData: ${dbCounts.monthly}`);
  console.log(`YearlySeasonalityData: ${dbCounts.yearly}`);
  
  console.log('\nPhase 2 Migration Complete!');
}

// Run migration
runPhase2Migration()
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
