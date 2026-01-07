#!/usr/bin/env node

/**
 * Seasonality SaaS Data Migration Script
 * Migrates CSV data from old system to new PostgreSQL database
 * 
 * Usage: node data-migration.js [options]
 * Options:
 *   --symbols <symbols>  Comma-separated list of symbols to migrate (default: all)
 *   --timeframes <tf>    Comma-separated timeframes: daily,weekly,monthly,yearly (default: all)
 *   --batch-size <size>  Number of records to process in each batch (default: 1000)
 *   --parallel <count>   Number of parallel workers (default: 4)
 *   --validate           Validate data after migration
 *   --dry-run           Show what would be migrated without actually doing it
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const { createReadStream } = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Configuration
const CONFIG = {
    oldDataPath: path.join(__dirname, '../../../old-software/Symbols'),
    batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
    parallelWorkers: parseInt(process.env.PARALLEL_WORKERS) || 4,
    validateAfterMigration: process.env.VALIDATE === 'true',
    dryRun: process.env.DRY_RUN === 'true'
};

// File mappings
const FILE_MAPPINGS = {
    '1_Daily.csv': 'daily',
    '2_MondayWeekly.csv': 'weekly_monday',
    '3_ExpiryWeekly.csv': 'weekly_expiry',
    '4_Monthly.csv': 'monthly',
    '5_Yearly.csv': 'yearly'
};

class DataMigrationManager {
    constructor() {
        this.prisma = new PrismaClient();
        this.stats = {
            totalSymbols: 0,
            processedSymbols: 0,
            totalRecords: 0,
            processedRecords: 0,
            errors: [],
            startTime: Date.now()
        };
    }

    async initialize() {
        console.log('🚀 Initializing Seasonality SaaS Data Migration');
        console.log('================================================');
        
        // Test database connection
        try {
            await this.prisma.$connect();
            console.log('Database connection established');
        } catch (error) {
            console.error('Database connection failed:', error.message);
            process.exit(1);
        }

        // Check if old data directory exists
        try {
            await fs.access(CONFIG.oldDataPath);
            console.log('Old data directory found:', CONFIG.oldDataPath);
        } catch (error) {
            console.error('Old data directory not found:', CONFIG.oldDataPath);
            process.exit(1);
        }
    }

    async getAvailableSymbols() {
        try {
            const entries = await fs.readdir(CONFIG.oldDataPath, { withFileTypes: true });
            const symbols = entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .sort();
            
            console.log(`Found ${symbols.length} symbols in old data`);
            return symbols;
        } catch (error) {
            console.error('Error reading symbols directory:', error.message);
            throw error;
        }
    }

    async analyzeSymbolData(symbol) {
        const symbolPath = path.join(CONFIG.oldDataPath, symbol);
        const analysis = {
            symbol,
            files: {},
            totalRecords: 0,
            errors: []
        };

        for (const [fileName, timeframe] of Object.entries(FILE_MAPPINGS)) {
            const filePath = path.join(symbolPath, fileName);
            
            try {
                const stats = await fs.stat(filePath);
                const recordCount = await this.countCSVRecords(filePath);
                
                analysis.files[timeframe] = {
                    fileName,
                    filePath,
                    size: stats.size,
                    recordCount,
                    exists: true
                };
                
                analysis.totalRecords += recordCount;
            } catch (error) {
                analysis.files[timeframe] = {
                    fileName,
                    filePath,
                    exists: false,
                    error: error.message
                };
                analysis.errors.push(`${fileName}: ${error.message}`);
            }
        }

        return analysis;
    }

    async countCSVRecords(filePath) {
        return new Promise((resolve, reject) => {
            let count = 0;
            createReadStream(filePath)
                .pipe(csv())
                .on('data', () => count++)
                .on('end', () => resolve(count))
                .on('error', reject);
        });
    }

    async createOrUpdateTicker(symbol) {
        try {
            // Try to find existing ticker
            let ticker = await this.prisma.ticker.findUnique({
                where: { symbol }
            });

            if (!ticker) {
                // Create new ticker
                ticker = await this.prisma.ticker.create({
                    data: {
                        symbol,
                        name: this.getSymbolName(symbol),
                        sector: this.getSymbolSector(symbol),
                        exchange: this.getSymbolExchange(symbol),
                        isActive: true
                    }
                });
                console.log(`Created ticker: ${symbol}`);
            } else {
                console.log(`Using existing ticker: ${symbol}`);
            }

            return ticker;
        } catch (error) {
            console.error(`rror creating ticker ${symbol}:`, error.message);
            throw error;
        }
    }

    getSymbolName(symbol) {
        // Map symbol to full name (you can expand this mapping)
        const nameMapping = {
            'BANKNIFTY': 'Bank Nifty Index',
            'NIFTY': 'Nifty 50 Index',
            'SENSEX': 'BSE Sensex',
            'RELIANCE': 'Reliance Industries Limited',
            'TCS': 'Tata Consultancy Services',
            'INFY': 'Infosys Limited',
            // Add more mappings as needed
        };
        return nameMapping[symbol] || symbol;
    }

    getSymbolSector(symbol) {
        // Map symbol to sector (you can expand this mapping)
        const sectorMapping = {
            'BANKNIFTY': 'Index',
            'NIFTY': 'Index',
            'SENSEX': 'Index',
            'RELIANCE': 'Oil & Gas',
            'TCS': 'Information Technology',
            'INFY': 'Information Technology',
            // Add more mappings as needed
        };
        return sectorMapping[symbol] || 'Unknown';
    }

    getSymbolExchange(symbol) {
        // Most symbols are from NSE
        if (symbol.includes('NIFTY') || symbol === 'BANKNIFTY') {
            return 'NSE';
        }
        if (symbol === 'SENSEX') {
            return 'BSE';
        }
        return 'NSE'; // Default
    }

    async migrateDailyData(ticker, filePath) {
        console.log(`Migrating daily data for ${ticker.symbol}...`);
        
        const records = [];
        let processedCount = 0;

        return new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const record = this.transformDailyRecord(row, ticker.id);
                        if (record) {
                            records.push(record);
                            
                            // Process in batches
                            if (records.length >= CONFIG.batchSize) {
                                this.processBatch('daily', records.splice(0, CONFIG.batchSize))
                                    .then(count => {
                                        processedCount += count;
                                        console.log(`  Processed ${processedCount} daily records for ${ticker.symbol}`);
                                    })
                                    .catch(error => {
                                        console.error(`Batch processing error:`, error.message);
                                    });
                            }
                        }
                    } catch (error) {
                        console.error(`Error transforming daily record:`, error.message);
                    }
                })
                .on('end', async () => {
                    try {
                        // Process remaining records
                        if (records.length > 0) {
                            const count = await this.processBatch('daily', records);
                            processedCount += count;
                        }
                        
                        console.log(`Completed daily migration for ${ticker.symbol}: ${processedCount} records`);
                        resolve(processedCount);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    transformDailyRecord(row, tickerId) {
        try {
            // Parse date
            const date = new Date(row.Date);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${row.Date}`);
            }

            // Parse numeric fields with validation
            const parseFloat = (value) => {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
            };

            const parseBoolean = (value) => {
                if (value === 'TRUE' || value === 'True' || value === 'true') return true;
                if (value === 'FALSE' || value === 'False' || value === 'false') return false;
                return null;
            };

            const parseInt = (value) => {
                const parsed = parseInt(value);
                return isNaN(parsed) ? null : parsed;
            };

            return {
                date,
                tickerId,
                open: parseFloat(row.Open),
                high: parseFloat(row.High),
                low: parseFloat(row.Low),
                close: parseFloat(row.Close),
                volume: parseFloat(row.Volume) || 0,
                openInterest: parseFloat(row.OpenInterest) || 0,
                
                // Calculated fields
                returnPoints: parseFloat(row.ReturnPoints),
                returnPercentage: parseFloat(row.ReturnPercentage),
                positiveDay: parseBoolean(row.PositiveDay),
                
                // Date components
                weekday: row.Weekday || null,
                calendarMonthDay: parseInt(row.CalenderMonthDay),
                calendarYearDay: parseInt(row.CalenderYearDay),
                tradingMonthDay: parseInt(row.TradingMonthDay),
                tradingYearDay: parseInt(row.TradingYearDay),
                
                // Even/Odd classifications
                evenCalendarMonthDay: parseBoolean(row.EvenCalenderMonthDay),
                evenCalendarYearDay: parseBoolean(row.EvenCalenderYearDay),
                evenTradingMonthDay: parseBoolean(row.EvenTradingMonthDay),
                evenTradingYearDay: parseBoolean(row.EvenTradingYearDay),
                evenMonth: parseBoolean(row.EvenMonth),
                evenYear: parseBoolean(row.EvenYear)
            };
        } catch (error) {
            console.error(`❌ Error transforming daily record for date ${row.Date}:`, error.message);
            return null;
        }
    }

    async migrateWeeklyData(ticker, filePath, weekType) {
        console.log(`📊 Migrating ${weekType} weekly data for ${ticker.symbol}...`);
        
        const records = [];
        let processedCount = 0;

        return new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const record = this.transformWeeklyRecord(row, ticker.id, weekType);
                        if (record) {
                            records.push(record);
                            
                            if (records.length >= CONFIG.batchSize) {
                                this.processBatch('weekly', records.splice(0, CONFIG.batchSize))
                                    .then(count => {
                                        processedCount += count;
                                        console.log(`  📊 Processed ${processedCount} ${weekType} weekly records for ${ticker.symbol}`);
                                    })
                                    .catch(error => {
                                        console.error(`❌ Batch processing error:`, error.message);
                                    });
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Error transforming weekly record:`, error.message);
                    }
                })
                .on('end', async () => {
                    try {
                        if (records.length > 0) {
                            const count = await this.processBatch('weekly', records);
                            processedCount += count;
                        }
                        
                        console.log(`✅ Completed ${weekType} weekly migration for ${ticker.symbol}: ${processedCount} records`);
                        resolve(processedCount);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    transformWeeklyRecord(row, tickerId, weekType) {
        try {
            const date = new Date(row.Date);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${row.Date}`);
            }

            const parseFloat = (value) => {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
            };

            const parseBoolean = (value) => {
                if (value === 'TRUE' || value === 'True' || value === 'true') return true;
                if (value === 'FALSE' || value === 'False' || value === 'false') return false;
                return null;
            };

            const parseInt = (value) => {
                const parsed = parseInt(value);
                return isNaN(parsed) ? null : parsed;
            };

            return {
                date,
                tickerId,
                weekType: weekType === 'weekly_monday' ? 'monday' : 'expiry',
                open: parseFloat(row.Open),
                high: parseFloat(row.High),
                low: parseFloat(row.Low),
                close: parseFloat(row.Close),
                volume: parseFloat(row.Volume) || 0,
                openInterest: parseFloat(row.OpenInterest) || 0,
                
                // Week-specific fields
                weekNumberMonthly: parseInt(row.WeekNumberMonthly),
                weekNumberYearly: parseInt(row.WeekNumberYearly),
                evenWeekNumberMonthly: parseBoolean(row.EvenWeekNumberMonthly),
                evenWeekNumberYearly: parseBoolean(row.EvenWeekNumberYearly),
                
                // Calculated fields
                returnPoints: parseFloat(row.ReturnPoints),
                returnPercentage: parseFloat(row.ReturnPercentage),
                positiveWeek: parseBoolean(row.PositiveWeek),
                
                // Monthly/Yearly context
                evenMonth: parseBoolean(row.EvenMonth),
                monthlyReturnPoints: parseFloat(row.MonthlyReturnPoints),
                monthlyReturnPercentage: parseFloat(row.MonthlyReturnPercentage),
                positiveMonth: parseBoolean(row.PositiveMonth),
                evenYear: parseBoolean(row.EvenYear),
                yearlyReturnPoints: parseFloat(row.YearlyReturnPoints),
                yearlyReturnPercentage: parseFloat(row.YearlyReturnPercentage),
                positiveYear: parseBoolean(row.PositiveYear)
            };
        } catch (error) {
            console.error(`❌ Error transforming weekly record for date ${row.Date}:`, error.message);
            return null;
        }
    }

    async migrateMonthlyData(ticker, filePath) {
        console.log(`📅 Migrating monthly data for ${ticker.symbol}...`);
        
        const records = [];
        let processedCount = 0;

        return new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const record = this.transformMonthlyRecord(row, ticker.id);
                        if (record) {
                            records.push(record);
                            
                            if (records.length >= CONFIG.batchSize) {
                                this.processBatch('monthly', records.splice(0, CONFIG.batchSize))
                                    .then(count => {
                                        processedCount += count;
                                        console.log(`  📊 Processed ${processedCount} monthly records for ${ticker.symbol}`);
                                    })
                                    .catch(error => {
                                        console.error(`❌ Batch processing error:`, error.message);
                                    });
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Error transforming monthly record:`, error.message);
                    }
                })
                .on('end', async () => {
                    try {
                        if (records.length > 0) {
                            const count = await this.processBatch('monthly', records);
                            processedCount += count;
                        }
                        
                        console.log(`✅ Completed monthly migration for ${ticker.symbol}: ${processedCount} records`);
                        resolve(processedCount);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    transformMonthlyRecord(row, tickerId) {
        try {
            const date = new Date(row.Date);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${row.Date}`);
            }

            const parseFloat = (value) => {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
            };

            const parseBoolean = (value) => {
                if (value === 'TRUE' || value === 'True' || value === 'true') return true;
                if (value === 'FALSE' || value === 'False' || value === 'false') return false;
                return null;
            };

            return {
                date,
                tickerId,
                open: parseFloat(row.Open),
                high: parseFloat(row.High),
                low: parseFloat(row.Low),
                close: parseFloat(row.Close),
                volume: parseFloat(row.Volume) || 0,
                openInterest: parseFloat(row.OpenInterest) || 0,
                
                // Month-specific fields
                evenMonth: parseBoolean(row.EvenMonth),
                
                // Calculated fields
                returnPoints: parseFloat(row.ReturnPoints),
                returnPercentage: parseFloat(row.ReturnPercentage),
                positiveMonth: parseBoolean(row.PositiveMonth),
                
                // Yearly context
                evenYear: parseBoolean(row.EvenYear),
                yearlyReturnPoints: parseFloat(row.YearlyReturnPoints),
                yearlyReturnPercentage: parseFloat(row.YearlyReturnPercentage),
                positiveYear: parseBoolean(row.PositiveYear)
            };
        } catch (error) {
            console.error(`❌ Error transforming monthly record for date ${row.Date}:`, error.message);
            return null;
        }
    }

    async migrateYearlyData(ticker, filePath) {
        console.log(`📆 Migrating yearly data for ${ticker.symbol}...`);
        
        const records = [];
        let processedCount = 0;

        return new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const record = this.transformYearlyRecord(row, ticker.id);
                        if (record) {
                            records.push(record);
                            
                            if (records.length >= CONFIG.batchSize) {
                                this.processBatch('yearly', records.splice(0, CONFIG.batchSize))
                                    .then(count => {
                                        processedCount += count;
                                        console.log(`  📊 Processed ${processedCount} yearly records for ${ticker.symbol}`);
                                    })
                                    .catch(error => {
                                        console.error(`❌ Batch processing error:`, error.message);
                                    });
                            }
                        }
                    } catch (error) {
                        console.error(`❌ Error transforming yearly record:`, error.message);
                    }
                })
                .on('end', async () => {
                    try {
                        if (records.length > 0) {
                            const count = await this.processBatch('yearly', records);
                            processedCount += count;
                        }
                        
                        console.log(`✅ Completed yearly migration for ${ticker.symbol}: ${processedCount} records`);
                        resolve(processedCount);
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    transformYearlyRecord(row, tickerId) {
        try {
            const date = new Date(row.Date);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date: ${row.Date}`);
            }

            const parseFloat = (value) => {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
            };

            const parseBoolean = (value) => {
                if (value === 'TRUE' || value === 'True' || value === 'true') return true;
                if (value === 'FALSE' || value === 'False' || value === 'false') return false;
                return null;
            };

            return {
                date,
                tickerId,
                open: parseFloat(row.Open),
                high: parseFloat(row.High),
                low: parseFloat(row.Low),
                close: parseFloat(row.Close),
                volume: parseFloat(row.Volume) || 0,
                openInterest: parseFloat(row.OpenInterest) || 0,
                
                // Year-specific fields
                evenYear: parseBoolean(row.EvenYear),
                
                // Calculated fields
                returnPoints: parseFloat(row.ReturnPoints),
                returnPercentage: parseFloat(row.ReturnPercentage),
                positiveYear: parseBoolean(row.PositiveYear)
            };
        } catch (error) {
            console.error(`❌ Error transforming yearly record for date ${row.Date}:`, error.message);
            return null;
        }
    }

    async processBatch(dataType, records) {
        if (CONFIG.dryRun) {
            console.log(`🔍 DRY RUN: Would process ${records.length} ${dataType} records`);
            return records.length;
        }

        try {
            let result;
            
            switch (dataType) {
                case 'daily':
                    result = await this.prisma.dailyData.createMany({
                        data: records,
                        skipDuplicates: true
                    });
                    break;
                case 'weekly':
                    result = await this.prisma.weeklyData.createMany({
                        data: records,
                        skipDuplicates: true
                    });
                    break;
                case 'monthly':
                    result = await this.prisma.monthlyData.createMany({
                        data: records,
                        skipDuplicates: true
                    });
                    break;
                case 'yearly':
                    result = await this.prisma.yearlyData.createMany({
                        data: records,
                        skipDuplicates: true
                    });
                    break;
                default:
                    throw new Error(`Unknown data type: ${dataType}`);
            }
            
            return result.count;
        } catch (error) {
            console.error(`❌ Error processing ${dataType} batch:`, error.message);
            throw error;
        }
    }

    async migrateSymbol(symbol) {
        console.log(`\n🔄 Migrating symbol: ${symbol}`);
        console.log('================================');
        
        try {
            // Analyze symbol data first
            const analysis = await this.analyzeSymbolData(symbol);
            
            if (analysis.errors.length > 0) {
                console.log(`⚠️  Warnings for ${symbol}:`);
                analysis.errors.forEach(error => console.log(`   ${error}`));
            }

            // Create or update ticker
            const ticker = await this.createOrUpdateTicker(symbol);
            
            let totalRecords = 0;

            // Migrate each timeframe
            for (const [timeframe, fileInfo] of Object.entries(analysis.files)) {
                if (!fileInfo.exists) {
                    console.log(`⏭️  Skipping ${timeframe} (file not found)`);
                    continue;
                }

                try {
                    let recordCount = 0;
                    
                    switch (timeframe) {
                        case 'daily':
                            recordCount = await this.migrateDailyData(ticker, fileInfo.filePath);
                            break;
                        case 'weekly_monday':
                            recordCount = await this.migrateWeeklyData(ticker, fileInfo.filePath, 'weekly_monday');
                            break;
                        case 'weekly_expiry':
                            recordCount = await this.migrateWeeklyData(ticker, fileInfo.filePath, 'weekly_expiry');
                            break;
                        case 'monthly':
                            recordCount = await this.migrateMonthlyData(ticker, fileInfo.filePath);
                            break;
                        case 'yearly':
                            recordCount = await this.migrateYearlyData(ticker, fileInfo.filePath);
                            break;
                    }
                    
                    totalRecords += recordCount;
                } catch (error) {
                    console.error(`❌ Error migrating ${timeframe} for ${symbol}:`, error.message);
                    this.stats.errors.push({
                        symbol,
                        timeframe,
                        error: error.message
                    });
                }
            }

            // Update ticker statistics
            await this.updateTickerStatistics(ticker.id);
            
            console.log(`✅ Completed migration for ${symbol}: ${totalRecords} total records`);
            this.stats.processedSymbols++;
            this.stats.processedRecords += totalRecords;
            
        } catch (error) {
            console.error(`❌ Error migrating symbol ${symbol}:`, error.message);
            this.stats.errors.push({
                symbol,
                error: error.message
            });
        }
    }

    async updateTickerStatistics(tickerId) {
        try {
            // Get daily data statistics
            const dailyStats = await this.prisma.dailyData.aggregate({
                where: { tickerId },
                _count: { id: true },
                _min: { date: true },
                _max: { date: true }
            });

            // Update ticker with statistics
            await this.prisma.ticker.update({
                where: { id: tickerId },
                data: {
                    totalRecords: dailyStats._count.id,
                    firstDataDate: dailyStats._min.date,
                    lastDataDate: dailyStats._max.date,
                    lastUpdated: new Date()
                }
            });
        } catch (error) {
            console.error(`❌ Error updating ticker statistics:`, error.message);
        }
    }

    async runMigration(symbols = null, timeframes = null) {
        console.log('\n🚀 Starting Data Migration');
        console.log('==========================');
        
        // Get available symbols
        const availableSymbols = await this.getAvailableSymbols();
        const symbolsToMigrate = symbols ? symbols.filter(s => availableSymbols.includes(s)) : availableSymbols;
        
        this.stats.totalSymbols = symbolsToMigrate.length;
        
        console.log(`📊 Migration Plan:`);
        console.log(`   Symbols: ${symbolsToMigrate.length}`);
        console.log(`   Timeframes: ${timeframes ? timeframes.join(', ') : 'all'}`);
        console.log(`   Batch Size: ${CONFIG.batchSize}`);
        console.log(`   Parallel Workers: ${CONFIG.parallelWorkers}`);
        console.log(`   Dry Run: ${CONFIG.dryRun ? 'Yes' : 'No'}`);
        
        if (CONFIG.dryRun) {
            console.log('\n🔍 DRY RUN MODE - No data will be written to database');
        }

        // Process symbols
        for (const symbol of symbolsToMigrate) {
            await this.migrateSymbol(symbol);
            
            // Progress update
            const progress = (this.stats.processedSymbols / this.stats.totalSymbols * 100).toFixed(1);
            console.log(`\n📈 Progress: ${progress}% (${this.stats.processedSymbols}/${this.stats.totalSymbols} symbols)`);
        }

        // Final statistics
        await this.printFinalStatistics();
    }

    async printFinalStatistics() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        
        console.log('\nMigration Complete!');
        console.log('======================');
        console.log(`Duration: ${duration.toFixed(1)} seconds`);
        console.log(`Symbols Processed: ${this.stats.processedSymbols}/${this.stats.totalSymbols}`);
        console.log(`Records Processed: ${this.stats.processedRecords.toLocaleString()}`);
        console.log(`Records/Second: ${(this.stats.processedRecords / duration).toFixed(0)}`);
        
        if (this.stats.errors.length > 0) {
            console.log(`\nErrors: ${this.stats.errors.length}`);
            this.stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.symbol}: ${error.error}`);
            });
        }

        // Database statistics
        if (!CONFIG.dryRun) {
            console.log('\nDatabase Statistics:');
            
            const tickerCount = await this.prisma.ticker.count();
            const dailyCount = await this.prisma.dailyData.count();
            const weeklyCount = await this.prisma.weeklyData.count();
            const monthlyCount = await this.prisma.monthlyData.count();
            const yearlyCount = await this.prisma.yearlyData.count();
            
            console.log(`   Tickers: ${tickerCount.toLocaleString()}`);
            console.log(`   Daily Records: ${dailyCount.toLocaleString()}`);
            console.log(`   Weekly Records: ${weeklyCount.toLocaleString()}`);
            console.log(`   Monthly Records: ${monthlyCount.toLocaleString()}`);
            console.log(`   Yearly Records: ${yearlyCount.toLocaleString()}`);
            console.log(`   Total Records: ${(dailyCount + weeklyCount + monthlyCount + yearlyCount).toLocaleString()}`);
        }
    }

    async cleanup() {
        await this.prisma.$disconnect();
        console.log('\nDatabase connection closed');
    }
}

// Main execution
async function main() {
    const migrationManager = new DataMigrationManager();
    
    try {
        await migrationManager.initialize();
        
        // Parse command line arguments
        const args = process.argv.slice(2);
        const symbols = args.includes('--symbols') ? 
            args[args.indexOf('--symbols') + 1]?.split(',') : null;
        const timeframes = args.includes('--timeframes') ? 
            args[args.indexOf('--timeframes') + 1]?.split(',') : null;
        
        if (args.includes('--dry-run')) {
            CONFIG.dryRun = true;
        }
        
        if (args.includes('--batch-size')) {
            CONFIG.batchSize = parseInt(args[args.indexOf('--batch-size') + 1]) || CONFIG.batchSize;
        }
        
        await migrationManager.runMigration(symbols, timeframes);
        
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await migrationManager.cleanup();
    }
}

// Run if this is the main module
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DataMigrationManager };