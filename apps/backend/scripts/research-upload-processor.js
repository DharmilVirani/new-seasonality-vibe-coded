#!/usr/bin/env node

/**
 * Research Team Upload Processor
 * 
 * Processes seasonality.csv files uploaded by the research team
 * and populates WeeklySeasonalityData, MonthlySeasonalityData, and YearlySeasonalityData tables
 * 
 * Usage:
 *   node scripts/research-upload-processor.js --file path/to/seasonality.csv
 *   node scripts/research-upload-processor.js --batch-id upload-batch-123
 *   node scripts/research-upload-processor.js --symbol NIFTY --timeframe weekly
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { createReadStream } = require('fs');

const prisma = new PrismaClient();

class ResearchUploadProcessor {
  constructor() {
    this.processedRecords = 0;
    this.errorRecords = 0;
    this.startTime = Date.now();
  }

  /**
   * Process a single seasonality CSV file from research team
   * Expected format: Date,Ticker,Timeframe,Open,High,Low,Close,Volume,OpenInterest,ReturnPoints,ReturnPercentage,PositiveReturn,WeekType,EvenMonth,EvenYear,...
   */
  async processSeasonalityFile(filePath) {
    console.log(`🔄 Processing research file: ${filePath}`);
    
    const records = [];
    
    return new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', async () => {
          try {
            await this.processRecords(records);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  /**
   * Process records and insert into appropriate tables based on timeframe
   */
  async processRecords(records) {
    console.log(`📊 Processing ${records.length} records...`);
    
    const weeklyRecords = [];
    const monthlyRecords = [];
    const yearlyRecords = [];
    
    for (const record of records) {
      try {
        const processedRecord = await this.validateAndTransformRecord(record);
        
        switch (processedRecord.timeframe.toLowerCase()) {
          case 'weekly':
          case 'monday_weekly':
          case 'expiry_weekly':
            weeklyRecords.push(processedRecord);
            break;
          case 'monthly':
            monthlyRecords.push(processedRecord);
            break;
          case 'yearly':
            yearlyRecords.push(processedRecord);
            break;
          default:
            console.warn(`⚠️  Unknown timeframe: ${processedRecord.timeframe}`);
        }
      } catch (error) {
        console.error(`❌ Error processing record:`, error.message);
        this.errorRecords++;
      }
    }

    // Insert records in batches
    if (weeklyRecords.length > 0) {
      await this.insertWeeklyRecords(weeklyRecords);
    }
    
    if (monthlyRecords.length > 0) {
      await this.insertMonthlyRecords(monthlyRecords);
    }
    
    if (yearlyRecords.length > 0) {
      await this.insertYearlyRecords(yearlyRecords);
    }

    console.log(`✅ Processing complete:`);
    console.log(`   📈 Weekly records: ${weeklyRecords.length}`);
    console.log(`   📅 Monthly records: ${monthlyRecords.length}`);
    console.log(`   📆 Yearly records: ${yearlyRecords.length}`);
    console.log(`   ❌ Error records: ${this.errorRecords}`);
  }

  /**
   * Validate and transform a single record
   */
  async validateAndTransformRecord(record) {
    // Validate required fields
    const requiredFields = ['Date', 'Ticker', 'Timeframe', 'Open', 'High', 'Low', 'Close'];
    for (const field of requiredFields) {
      if (!record[field] || record[field].trim() === '') {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Get or create ticker
    const ticker = await this.getOrCreateTicker(record.Ticker.trim().toUpperCase());
    
    // Parse and validate date
    const date = new Date(record.Date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${record.Date}`);
    }

    // Transform record
    return {
      date,
      tickerId: ticker.id,
      timeframe: record.Timeframe.trim(),
      open: parseFloat(record.Open),
      high: parseFloat(record.High),
      low: parseFloat(record.Low),
      close: parseFloat(record.Close),
      volume: parseFloat(record.Volume || 0),
      openInterest: parseFloat(record.OpenInterest || 0),
      
      // Calculated fields from research team
      returnPoints: record.ReturnPoints ? parseFloat(record.ReturnPoints) : null,
      returnPercentage: record.ReturnPercentage ? parseFloat(record.ReturnPercentage) : null,
      positiveReturn: record.PositiveReturn ? record.PositiveReturn.toLowerCase() === 'true' : null,
      
      // Weekly specific fields
      weekType: record.WeekType ? record.WeekType.toLowerCase() : null,
      weekNumberMonthly: record.WeekNumberMonthly ? parseInt(record.WeekNumberMonthly) : null,
      weekNumberYearly: record.WeekNumberYearly ? parseInt(record.WeekNumberYearly) : null,
      evenWeekNumberMonthly: record.EvenWeekNumberMonthly ? record.EvenWeekNumberMonthly.toLowerCase() === 'true' : null,
      evenWeekNumberYearly: record.EvenWeekNumberYearly ? record.EvenWeekNumberYearly.toLowerCase() === 'true' : null,
      
      // Monthly/Yearly context fields
      evenMonth: record.EvenMonth ? record.EvenMonth.toLowerCase() === 'true' : null,
      evenYear: record.EvenYear ? record.EvenYear.toLowerCase() === 'true' : null,
      monthlyReturnPoints: record.MonthlyReturnPoints ? parseFloat(record.MonthlyReturnPoints) : null,
      monthlyReturnPercentage: record.MonthlyReturnPercentage ? parseFloat(record.MonthlyReturnPercentage) : null,
      positiveMonth: record.PositiveMonth ? record.PositiveMonth.toLowerCase() === 'true' : null,
      yearlyReturnPoints: record.YearlyReturnPoints ? parseFloat(record.YearlyReturnPoints) : null,
      yearlyReturnPercentage: record.YearlyReturnPercentage ? parseFloat(record.YearlyReturnPercentage) : null,
      positiveYear: record.PositiveYear ? record.PositiveYear.toLowerCase() === 'true' : null,
      
      // Additional fields
      weekday: record.Weekday ? record.Weekday.trim() : null,
    };
  }

  /**
   * Get existing ticker or create new one
   */
  async getOrCreateTicker(symbol) {
    let ticker = await prisma.ticker.findUnique({
      where: { symbol }
    });

    if (!ticker) {
      console.log(`📝 Creating new ticker: ${symbol}`);
      ticker = await prisma.ticker.create({
        data: {
          symbol,
          name: symbol, // Will be updated later with proper name
          isActive: true,
          dataSource: 'research_team'
        }
      });
    }

    return ticker;
  }

  /**
   * Insert weekly records in batches
   */
  async insertWeeklyRecords(records) {
    console.log(`📈 Inserting ${records.length} weekly records...`);
    
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await prisma.weeklySeasonalityData.createMany({
          data: batch.map(record => ({
            date: record.date,
            tickerId: record.tickerId,
            weekType: record.weekType || 'monday',
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
            volume: record.volume,
            openInterest: record.openInterest,
            weekday: record.weekday,
            weekNumberMonthly: record.weekNumberMonthly,
            weekNumberYearly: record.weekNumberYearly,
            evenWeekNumberMonthly: record.evenWeekNumberMonthly,
            evenWeekNumberYearly: record.evenWeekNumberYearly,
            returnPoints: record.returnPoints,
            returnPercentage: record.returnPercentage,
            positiveWeek: record.positiveReturn,
            evenMonth: record.evenMonth,
            monthlyReturnPoints: record.monthlyReturnPoints,
            monthlyReturnPercentage: record.monthlyReturnPercentage,
            positiveMonth: record.positiveMonth,
            evenYear: record.evenYear,
            yearlyReturnPoints: record.yearlyReturnPoints,
            yearlyReturnPercentage: record.yearlyReturnPercentage,
            positiveYear: record.positiveYear,
          })),
          skipDuplicates: true
        });
        
        this.processedRecords += batch.length;
        console.log(`   ✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      } catch (error) {
        console.error(`❌ Error inserting weekly batch:`, error.message);
        this.errorRecords += batch.length;
      }
    }
  }

  /**
   * Insert monthly records in batches
   */
  async insertMonthlyRecords(records) {
    console.log(`📅 Inserting ${records.length} monthly records...`);
    
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await prisma.monthlySeasonalityData.createMany({
          data: batch.map(record => ({
            date: record.date,
            tickerId: record.tickerId,
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
            volume: record.volume,
            openInterest: record.openInterest,
            weekday: record.weekday,
            evenMonth: record.evenMonth,
            returnPoints: record.returnPoints,
            returnPercentage: record.returnPercentage,
            positiveMonth: record.positiveReturn,
            evenYear: record.evenYear,
            yearlyReturnPoints: record.yearlyReturnPoints,
            yearlyReturnPercentage: record.yearlyReturnPercentage,
            positiveYear: record.positiveYear,
          })),
          skipDuplicates: true
        });
        
        this.processedRecords += batch.length;
        console.log(`   ✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      } catch (error) {
        console.error(`❌ Error inserting monthly batch:`, error.message);
        this.errorRecords += batch.length;
      }
    }
  }

  /**
   * Insert yearly records in batches
   */
  async insertYearlyRecords(records) {
    console.log(`📆 Inserting ${records.length} yearly records...`);
    
    const batchSize = 1000;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        await prisma.yearlySeasonalityData.createMany({
          data: batch.map(record => ({
            date: record.date,
            tickerId: record.tickerId,
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
            volume: record.volume,
            openInterest: record.openInterest,
            weekday: record.weekday,
            evenYear: record.evenYear,
            returnPoints: record.returnPoints,
            returnPercentage: record.returnPercentage,
            positiveYear: record.positiveReturn,
          })),
          skipDuplicates: true
        });
        
        this.processedRecords += batch.length;
        console.log(`   ✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      } catch (error) {
        console.error(`❌ Error inserting yearly batch:`, error.message);
        this.errorRecords += batch.length;
      }
    }
  }

  /**
   * Update ticker statistics after processing
   */
  async updateTickerStatistics() {
    console.log(`📊 Updating ticker statistics...`);
    
    const tickers = await prisma.ticker.findMany();
    
    for (const ticker of tickers) {
      // Count records across all timeframes
      const [seasonalityCount, weeklyCount, monthlyCount, yearlyCount] = await Promise.all([
        prisma.seasonalityData.count({ where: { tickerId: ticker.id } }),
        prisma.weeklySeasonalityData.count({ where: { tickerId: ticker.id } }),
        prisma.monthlySeasonalityData.count({ where: { tickerId: ticker.id } }),
        prisma.yearlySeasonalityData.count({ where: { tickerId: ticker.id } })
      ]);
      
      const totalRecords = seasonalityCount + weeklyCount + monthlyCount + yearlyCount;
      
      // Get date range from all tables
      const [seasonalityRange, weeklyRange, monthlyRange, yearlyRange] = await Promise.all([
        prisma.seasonalityData.aggregate({
          where: { tickerId: ticker.id },
          _min: { date: true },
          _max: { date: true }
        }),
        prisma.weeklySeasonalityData.aggregate({
          where: { tickerId: ticker.id },
          _min: { date: true },
          _max: { date: true }
        }),
        prisma.monthlySeasonalityData.aggregate({
          where: { tickerId: ticker.id },
          _min: { date: true },
          _max: { date: true }
        }),
        prisma.yearlySeasonalityData.aggregate({
          where: { tickerId: ticker.id },
          _min: { date: true },
          _max: { date: true }
        })
      ]);
      
      const allDates = [
        seasonalityRange._min.date,
        weeklyRange._min.date,
        monthlyRange._min.date,
        yearlyRange._min.date,
        seasonalityRange._max.date,
        weeklyRange._max.date,
        monthlyRange._max.date,
        yearlyRange._max.date
      ].filter(Boolean);
      
      const firstDataDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : null;
      const lastDataDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null;
      
      await prisma.ticker.update({
        where: { id: ticker.id },
        data: {
          totalRecords,
          firstDataDate,
          lastDataDate,
          lastUpdated: new Date()
        }
      });
    }
    
    console.log(`✅ Updated statistics for ${tickers.length} tickers`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const processor = new ResearchUploadProcessor();
  
  try {
    if (args.includes('--file')) {
      const fileIndex = args.indexOf('--file');
      const filePath = args[fileIndex + 1];
      
      if (!filePath) {
        throw new Error('Please provide a file path after --file');
      }
      
      await processor.processSeasonalityFile(filePath);
      await processor.updateTickerStatistics();
      
    } else if (args.includes('--help')) {
      console.log(`
Research Team Upload Processor

Usage:
  node scripts/research-upload-processor.js --file path/to/seasonality.csv
  node scripts/research-upload-processor.js --help

Options:
  --file <path>    Process a specific seasonality CSV file
  --help          Show this help message

Examples:
  node scripts/research-upload-processor.js --file uploads/NIFTY_seasonality.csv
      `);
    } else {
      throw new Error('Please specify --file option. Use --help for usage information.');
    }
    
    const duration = (Date.now() - processor.startTime) / 1000;
    console.log(`🎉 Processing completed in ${duration.toFixed(2)} seconds`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ResearchUploadProcessor };