#!/usr/bin/env node

/**
 * Post-Migration Calculation Script
 * Calculates derived fields for migrated OHLCV data
 * 
 * This script computes:
 * - Return points and percentages
 * - Date components (weekday, calendar/trading days)
 * - Even/Odd classifications
 * - Positive/Negative flags
 * 
 * Usage: node calculate-derived-fields.js [options]
 * Options:
 *   --symbols <symbols>  Comma-separated list of symbols (default: all)
 *   --batch-size <size>  Number of records to process in each batch (default: 1000)
 *   --timeframes <tf>    Comma-separated timeframes: daily,weekly,monthly,yearly (default: daily)
 *   --dry-run           Show what would be calculated without updating
 */

const { PrismaClient } = require('@prisma/client');

class DerivedFieldsCalculator {
    constructor() {
        this.prisma = new PrismaClient();
        this.stats = {
            totalRecords: 0,
            processedRecords: 0,
            errors: [],
            startTime: Date.now()
        };
    }

    async initialize() {
        console.log('Initializing Derived Fields Calculator');
        console.log('==========================================');
        
        try {
            await this.prisma.$connect();
            console.log('Database connection established');
        } catch (error) {
            console.error('Database connection failed:', error.message);
            process.exit(1);
        }
    }

    async calculateDailyDerivedFields(symbols = null, batchSize = 1000, dryRun = false) {
        console.log('\nCalculating Daily Derived Fields...');
        
        // Get tickers to process
        const whereClause = symbols ? { symbol: { in: symbols } } : {};
        const tickers = await this.prisma.ticker.findMany({
            where: whereClause,
            select: { id: true, symbol: true }
        });

        console.log(`Processing ${tickers.length} tickers`);

        for (const ticker of tickers) {
            console.log(`\nProcessing ${ticker.symbol}...`);
            
            try {
                // Get all daily data for this ticker, ordered by date
                const dailyData = await this.prisma.dailyData.findMany({
                    where: { tickerId: ticker.id },
                    orderBy: { date: 'asc' },
                    select: {
                        id: true,
                        date: true,
                        open: true,
                        high: true,
                        low: true,
                        close: true,
                        volume: true,
                        openInterest: true
                    }
                });

                if (dailyData.length === 0) {
                    console.log(`No data found for ${ticker.symbol}`);
                    continue;
                }

                console.log(`Found ${dailyData.length} daily records for ${ticker.symbol}`);

                // Calculate derived fields
                const updates = [];
                let previousClose = null;

                for (let i = 0; i < dailyData.length; i++) {
                    const record = dailyData[i];
                    const date = new Date(record.date);
                    
                    // Calculate return fields
                    let returnPoints = null;
                    let returnPercentage = null;
                    let positiveDay = null;

                    if (previousClose !== null && previousClose !== 0) {
                        returnPoints = record.close - previousClose;
                        returnPercentage = (returnPoints / previousClose) * 100;
                        positiveDay = returnPercentage > 0;
                    }

                    // Calculate date components
                    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
                    const calendarMonthDay = date.getDate();
                    const calendarYearDay = this.getYearDay(date);
                    
                    // Calculate trading days (position in the dataset)
                    const tradingMonthDay = this.getTradingMonthDay(dailyData, i);
                    const tradingYearDay = this.getTradingYearDay(dailyData, i);

                    // Calculate even/odd classifications
                    const evenCalendarMonthDay = calendarMonthDay % 2 === 0;
                    const evenCalendarYearDay = calendarYearDay % 2 === 0;
                    const evenTradingMonthDay = tradingMonthDay % 2 === 0;
                    const evenTradingYearDay = tradingYearDay % 2 === 0;
                    const evenMonth = (date.getMonth() + 1) % 2 === 0;
                    const evenYear = date.getFullYear() % 2 === 0;

                    updates.push({
                        id: record.id,
                        returnPoints,
                        returnPercentage,
                        positiveDay,
                        weekday,
                        calendarMonthDay,
                        calendarYearDay,
                        tradingMonthDay,
                        tradingYearDay,
                        evenCalendarMonthDay,
                        evenCalendarYearDay,
                        evenTradingMonthDay,
                        evenTradingYearDay,
                        evenMonth,
                        evenYear
                    });

                    previousClose = record.close;

                    // Process in batches
                    if (updates.length >= batchSize) {
                        await this.processBatch('daily', updates, dryRun);
                        updates.length = 0; // Clear array
                    }
                }

                // Process remaining updates
                if (updates.length > 0) {
                    await this.processBatch('daily', updates, dryRun);
                }

                console.log(`Completed ${ticker.symbol}: ${dailyData.length} records processed`);
                this.stats.processedRecords += dailyData.length;

            } catch (error) {
                console.error(`Error processing ${ticker.symbol}:`, error.message);
                this.stats.errors.push({
                    ticker: ticker.symbol,
                    error: error.message
                });
            }
        }
    }

    async processBatch(timeframe, updates, dryRun = false) {
        if (dryRun) {
            console.log(`DRY RUN: Would update ${updates.length} ${timeframe} records`);
            return;
        }

        try {
            // Use transaction for batch updates
            await this.prisma.$transaction(async (tx) => {
                for (const update of updates) {
                    const { id, ...data } = update;
                    
                    switch (timeframe) {
                        case 'daily':
                            await tx.dailyData.update({
                                where: { id },
                                data
                            });
                            break;
                        case 'weekly':
                            await tx.weeklyData.update({
                                where: { id },
                                data
                            });
                            break;
                        case 'monthly':
                            await tx.monthlyData.update({
                                where: { id },
                                data
                            });
                            break;
                        case 'yearly':
                            await tx.yearlyData.update({
                                where: { id },
                                data
                            });
                            break;
                    }
                }
            });

            console.log(`  Updated ${updates.length} ${timeframe} records`);
        } catch (error) {
            console.error(`Error updating ${timeframe} batch:`, error.message);
            throw error;
        }
    }

    getYearDay(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    getTradingMonthDay(allData, currentIndex) {
        const currentDate = new Date(allData[currentIndex].date);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        let tradingDay = 1;
        for (let i = 0; i < currentIndex; i++) {
            const recordDate = new Date(allData[i].date);
            if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                tradingDay++;
            }
        }
        
        return tradingDay;
    }

    getTradingYearDay(allData, currentIndex) {
        const currentDate = new Date(allData[currentIndex].date);
        const currentYear = currentDate.getFullYear();
        
        let tradingDay = 1;
        for (let i = 0; i < currentIndex; i++) {
            const recordDate = new Date(allData[i].date);
            if (recordDate.getFullYear() === currentYear) {
                tradingDay++;
            }
        }
        
        return tradingDay;
    }

    async calculateWeeklyDerivedFields(symbols = null, batchSize = 1000, dryRun = false) {
        console.log('\nCalculating Weekly Derived Fields...');
        
        // Get tickers to process
        const whereClause = symbols ? { symbol: { in: symbols } } : {};
        const tickers = await this.prisma.ticker.findMany({
            where: whereClause,
            select: { id: true, symbol: true }
        });

        for (const ticker of tickers) {
            console.log(`\ Processing weekly data for ${ticker.symbol}...`);
            
            try {
                // Get all weekly data for this ticker, ordered by date
                const weeklyData = await this.prisma.weeklyData.findMany({
                    where: { tickerId: ticker.id },
                    orderBy: { date: 'asc' },
                    select: {
                        id: true,
                        date: true,
                        weekType: true,
                        open: true,
                        close: true
                    }
                });

                if (weeklyData.length === 0) {
                    console.log(`No weekly data found for ${ticker.symbol}`);
                    continue;
                }

                const updates = [];
                const mondayData = weeklyData.filter(w => w.weekType === 'monday');
                const expiryData = weeklyData.filter(w => w.weekType === 'expiry');

                // Process Monday weekly data
                let previousClose = null;
                for (let i = 0; i < mondayData.length; i++) {
                    const record = mondayData[i];
                    const date = new Date(record.date);
                    
                    let returnPoints = null;
                    let returnPercentage = null;
                    let positiveWeek = null;

                    if (previousClose !== null && previousClose !== 0) {
                        returnPoints = record.close - previousClose;
                        returnPercentage = (returnPoints / previousClose) * 100;
                        positiveWeek = returnPercentage > 0;
                    }

                    // Calculate week numbers
                    const weekNumberMonthly = this.getWeekOfMonth(date);
                    const weekNumberYearly = this.getWeekOfYear(date);
                    const evenWeekNumberMonthly = weekNumberMonthly % 2 === 0;
                    const evenWeekNumberYearly = weekNumberYearly % 2 === 0;

                    updates.push({
                        id: record.id,
                        returnPoints,
                        returnPercentage,
                        positiveWeek,
                        weekNumberMonthly,
                        weekNumberYearly,
                        evenWeekNumberMonthly,
                        evenWeekNumberYearly,
                        evenMonth: (date.getMonth() + 1) % 2 === 0,
                        evenYear: date.getFullYear() % 2 === 0
                    });

                    previousClose = record.close;
                }

                // Process Expiry weekly data similarly
                previousClose = null;
                for (let i = 0; i < expiryData.length; i++) {
                    const record = expiryData[i];
                    const date = new Date(record.date);
                    
                    let returnPoints = null;
                    let returnPercentage = null;
                    let positiveWeek = null;

                    if (previousClose !== null && previousClose !== 0) {
                        returnPoints = record.close - previousClose;
                        returnPercentage = (returnPoints / previousClose) * 100;
                        positiveWeek = returnPercentage > 0;
                    }

                    const weekNumberMonthly = this.getWeekOfMonth(date);
                    const weekNumberYearly = this.getWeekOfYear(date);

                    updates.push({
                        id: record.id,
                        returnPoints,
                        returnPercentage,
                        positiveWeek,
                        weekNumberMonthly,
                        weekNumberYearly,
                        evenWeekNumberMonthly: weekNumberMonthly % 2 === 0,
                        evenWeekNumberYearly: weekNumberYearly % 2 === 0,
                        evenMonth: (date.getMonth() + 1) % 2 === 0,
                        evenYear: date.getFullYear() % 2 === 0
                    });

                    previousClose = record.close;
                }

                // Process updates in batches
                for (let i = 0; i < updates.length; i += batchSize) {
                    const batch = updates.slice(i, i + batchSize);
                    await this.processBatch('weekly', batch, dryRun);
                }

                console.log(`Completed weekly calculations for ${ticker.symbol}: ${updates.length} records`);

            } catch (error) {
                console.error(`Error processing weekly data for ${ticker.symbol}:`, error.message);
                this.stats.errors.push({
                    ticker: ticker.symbol,
                    timeframe: 'weekly',
                    error: error.message
                });
            }
        }
    }

    getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstWeekday = firstDay.getDay();
        const offsetDate = date.getDate() + firstWeekday - 1;
        return Math.floor(offsetDate / 7) + 1;
    }

    getWeekOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }

    async runCalculations(options = {}) {
        const {
            symbols = null,
            timeframes = ['daily'],
            batchSize = 1000,
            dryRun = false
        } = options;

        console.log('\n🧮 Starting Derived Fields Calculation');
        console.log('======================================');
        console.log(`📊 Symbols: ${symbols ? symbols.join(', ') : 'All'}`);
        console.log(`⏱️  Timeframes: ${timeframes.join(', ')}`);
        console.log(`📦 Batch Size: ${batchSize}`);
        console.log(`🔍 Dry Run: ${dryRun ? 'Yes' : 'No'}`);

        if (timeframes.includes('daily')) {
            await this.calculateDailyDerivedFields(symbols, batchSize, dryRun);
        }

        if (timeframes.includes('weekly')) {
            await this.calculateWeeklyDerivedFields(symbols, batchSize, dryRun);
        }

        // Add monthly and yearly calculations as needed
        // if (timeframes.includes('monthly')) {
        //     await this.calculateMonthlyDerivedFields(symbols, batchSize, dryRun);
        // }

        // if (timeframes.includes('yearly')) {
        //     await this.calculateYearlyDerivedFields(symbols, batchSize, dryRun);
        // }

        await this.printFinalStatistics();
    }

    async printFinalStatistics() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        
        console.log('\n🎉 Calculation Complete!');
        console.log('========================');
        console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
        console.log(`📊 Records Processed: ${this.stats.processedRecords.toLocaleString()}`);
        console.log(`⚡ Records/Second: ${(this.stats.processedRecords / duration).toFixed(0)}`);
        
        if (this.stats.errors.length > 0) {
            console.log(`\n❌ Errors: ${this.stats.errors.length}`);
            this.stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.ticker} (${error.timeframe || 'daily'}): ${error.error}`);
            });
        }

        // Validation queries
        console.log('\nValidation Results:');
        
        const dailyStats = await this.prisma.dailyData.aggregate({
            _count: { id: true },
            _avg: { returnPercentage: true },
            where: { returnPercentage: { not: null } }
        });
        
        console.log(`   Daily records with calculated returns: ${dailyStats._count.id.toLocaleString()}`);
        console.log(`   Average daily return: ${dailyStats._avg.returnPercentage?.toFixed(4)}%`);

        const positiveCount = await this.prisma.dailyData.count({
            where: { positiveDay: true }
        });
        
        const negativeCount = await this.prisma.dailyData.count({
            where: { positiveDay: false }
        });

        console.log(`   Positive days: ${positiveCount.toLocaleString()}`);
        console.log(`   Negative days: ${negativeCount.toLocaleString()}`);
        
        if (positiveCount + negativeCount > 0) {
            const accuracy = (positiveCount / (positiveCount + negativeCount)) * 100;
            console.log(`   Overall accuracy: ${accuracy.toFixed(2)}%`);
        }
    }

    async cleanup() {
        await this.prisma.$disconnect();
        console.log('\nDatabase connection closed');
    }
}

// Main execution
async function main() {
    const calculator = new DerivedFieldsCalculator();
    
    try {
        await calculator.initialize();
        
        // Parse command line arguments
        const args = process.argv.slice(2);
        const symbols = args.includes('--symbols') ? 
            args[args.indexOf('--symbols') + 1]?.split(',') : null;
        const timeframes = args.includes('--timeframes') ? 
            args[args.indexOf('--timeframes') + 1]?.split(',') : ['daily'];
        const batchSize = args.includes('--batch-size') ? 
            parseInt(args[args.indexOf('--batch-size') + 1]) || 1000 : 1000;
        const dryRun = args.includes('--dry-run');
        
        await calculator.runCalculations({
            symbols,
            timeframes,
            batchSize,
            dryRun
        });
        
    } catch (error) {
        console.error('Calculation failed:', error.message);
        process.exit(1);
    } finally {
        await calculator.cleanup();
    }
}

// Run if this is the main module
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DerivedFieldsCalculator };