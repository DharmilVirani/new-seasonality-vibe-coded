/**
 * Upload Service - Handles file upload processing and database operations
 *
 * Dependencies:
 * npm install @prisma/client
 * npm install --save-dev prisma
 *
 * Then run: npx prisma generate
 */

const csvService = require('./csvService')
const prisma = require('../config/database')

class UploadService {
    /**
     * Process uploaded CSV file
     * Main entry point for file upload processing
     * @param {Object} file - Uploaded file object from multer
     * @returns {Promise<Object>} Processing result with statistics
     * @throws {Error} If processing fails
     */
    async processUploadedFile(file) {
        try {
            // Validate and process CSV records
            const { records, warnings } = csvService.processCSV(file.buffer)

            console.log(`Processing ${records.length} records from ${file.originalname}`)

            // Store data in database with transaction
            const result = await this.storeProcessedData(records)

            // Attach warnings if any
            if (warnings && warnings.length > 0) {
                result.warnings = warnings
            }

            return result
        } catch (error) {
            console.error('Error processing uploaded file:', error)
            throw error
        }
    }

    /**
     * Group records by ticker symbol for efficient batch processing
     * @param {Array} records - Validated records array
     * @returns {Object} Records grouped by ticker symbol
     */
    groupRecordsByTicker(records) {
        const grouped = {}

        records.forEach((record) => {
            const ticker = record.ticker
            if (!grouped[ticker]) {
                grouped[ticker] = []
            }
            grouped[ticker].push(record)
        })

        return grouped
    }

    /**
     * Create data entries in batches to handle large datasets
     * Prevents timeout issues with large inserts
     * @param {Object} tx - Prisma transaction client
     * @param {Array} dataToCreate - Array of data objects to insert
     * @param {number} batchSize - Number of records per batch (default: 1000)
     * @returns {Promise<number>} Total number of records created
     */
    async createInBatches(tx, dataToCreate, batchSize = 1000) {
        let totalCreated = 0

        // Process in batches
        for (let i = 0; i < dataToCreate.length; i += batchSize) {
            const batch = dataToCreate.slice(i, i + batchSize)

            console.log(
                `Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dataToCreate.length / batchSize)}`
            )

            const result = await tx.seasonalityData.createMany({
                data: batch,
                skipDuplicates: true, // Skip records with duplicate (date, tickerId) combination
            })

            totalCreated += result.count
        }

        return totalCreated
    }

    /**
     * Store processed data in database with transaction safety
     * Ensures all-or-nothing database updates
     * @param {Array} records - Validated and processed records
     * @returns {Promise<Object>} Storage result with detailed statistics
     * @throws {Error} If all tickers fail to process
     */
    async storeProcessedData(records) {
        return await prisma.$transaction(
            async (tx) => {
                const result = {
                    recordsProcessed: records.length,
                    tickersFound: 0,
                    tickersCreated: 0,
                    tickersUpdated: 0,
                    dataEntriesCreated: 0,
                    duplicatesSkipped: 0,
                    errors: [],
                    processingDetails: [],
                }

                // Group records by ticker for efficient processing
                const recordsByTicker = this.groupRecordsByTicker(records)
                const tickerSymbols = Object.keys(recordsByTicker)
                result.tickersFound = tickerSymbols.length

                console.log(`Processing ${result.tickersFound} unique tickers`)

                // Process each ticker
                for (const tickerSymbol of tickerSymbols) {
                    const tickerRecords = recordsByTicker[tickerSymbol]

                    try {
                        console.log(`Processing ticker: ${tickerSymbol} (${tickerRecords.length} records)`)

                        // Find or create ticker
                        let ticker = await tx.ticker.findUnique({
                            where: { symbol: tickerSymbol },
                        })

                        if (!ticker) {
                            ticker = await tx.ticker.create({
                                data: {
                                    symbol: tickerSymbol,
                                },
                            })
                            result.tickersCreated++
                            console.log(`Created new ticker: ${tickerSymbol}`)
                        } else {
                            result.tickersUpdated++
                            console.log(`Using existing ticker: ${tickerSymbol}`)
                        }

                        // Count existing records before insertion
                        const beforeCount = await tx.seasonalityData.count({
                            where: { tickerId: ticker.id },
                        })

                        // Prepare data for bulk insert
                        const dataToCreate = tickerRecords.map((record) => ({
                            date: record.date,
                            open: record.open,
                            high: record.high,
                            low: record.low,
                            close: record.close,
                            volume: record.volume,
                            openInterest: record.openInterest,
                            tickerId: ticker.id,
                        }))

                        // Bulk create seasonality data in batches
                        await this.createInBatches(tx, dataToCreate)

                        // Count records after insertion to calculate actual created count
                        const afterCount = await tx.seasonalityData.count({
                            where: { tickerId: ticker.id },
                        })

                        const actualCreated = afterCount - beforeCount
                        const duplicates = dataToCreate.length - actualCreated

                        result.dataEntriesCreated += actualCreated
                        result.duplicatesSkipped += duplicates

                        // Add processing details for this ticker
                        result.processingDetails.push({
                            ticker: tickerSymbol,
                            recordsProcessed: tickerRecords.length,
                            recordsCreated: actualCreated,
                            duplicatesSkipped: duplicates,
                        })

                        console.log(
                            `Ticker ${tickerSymbol}: ${actualCreated} created, ${duplicates} duplicates skipped`
                        )
                    } catch (error) {
                        console.error(`Error processing ticker ${tickerSymbol}:`, error)

                        result.errors.push({
                            ticker: tickerSymbol,
                            recordCount: tickerRecords.length,
                            error: error.message,
                        })

                        // Continue processing other tickers instead of failing completely
                    }
                }

                // If all tickers failed, throw error to rollback transaction
                if (result.errors.length === result.tickersFound && result.errors.length > 0) {
                    const errorSummary = result.errors.map((e) => `${e.ticker}: ${e.error}`).join('\n')
                    throw new Error(`All tickers failed to process:\n${errorSummary}`)
                }

                return result
            },
            {
                maxWait: 3000000, 
                timeout: 120000, 
            }
        )
    }

    /**
     * Get overall upload statistics from database
     * @returns {Promise<Object>} Statistics summary
     */
    async getUploadStats() {
        try {
            const [totalTickers, totalData, latestUploads] = await Promise.all([
                // Count total tickers
                prisma.ticker.count(),

                // Count total data entries
                prisma.seasonalityData.count(),

                // Get recent uploads (last 10 tickers updated)
                prisma.ticker.findMany({
                    take: 10,
                    orderBy: {
                        updatedAt: 'desc',
                    },
                    select: {
                        symbol: true,
                        updatedAt: true,
                        _count: {
                            select: {
                                seasonalityData: true,
                            },
                        },
                    },
                }),
            ])

            return {
                totalTickers,
                totalDataEntries: totalData,
                averageEntriesPerTicker: totalTickers > 0 ? Math.round(totalData / totalTickers) : 0,
                recentUploads: latestUploads.map((ticker) => ({
                    symbol: ticker.symbol,
                    dataEntries: ticker._count.seasonalityData,
                    lastUpdated: ticker.updatedAt,
                })),
            }
        } catch (error) {
            console.error('Error fetching upload stats:', error)
            throw new Error(`Failed to fetch statistics: ${error.message}`)
        }
    }

    /**
     * Get detailed information for a specific ticker
     * @param {string} tickerSymbol - Ticker symbol to query
     * @returns {Promise<Object>} Ticker details
     */
    async getTickerDetails(tickerSymbol) {
        try {
            const ticker = await prisma.ticker.findUnique({
                where: {
                    symbol: tickerSymbol.toUpperCase(),
                },
                include: {
                    _count: {
                        select: {
                            seasonalityData: true,
                        },
                    },
                    seasonalityData: {
                        take: 1,
                        orderBy: {
                            date: 'desc',
                        },
                    },
                },
            })

            if (!ticker) {
                throw new Error(`Ticker ${tickerSymbol} not found`)
            }

            // Get date range
            const [oldest, newest] = await Promise.all([
                prisma.seasonalityData.findFirst({
                    where: { tickerId: ticker.id },
                    orderBy: { date: 'asc' },
                    select: { date: true },
                }),
                prisma.seasonalityData.findFirst({
                    where: { tickerId: ticker.id },
                    orderBy: { date: 'desc' },
                    select: { date: true },
                }),
            ])

            return {
                symbol: ticker.symbol,
                totalEntries: ticker._count.seasonalityData,
                dateRange: {
                    from: oldest?.date,
                    to: newest?.date,
                },
                lastUpdated: ticker.updatedAt,
                latestData: ticker.seasonalityData[0] || null,
            }
        } catch (error) {
            console.error('Error fetching ticker details:', error)
            throw error
        }
    }

    /**
     * Delete all data for a specific ticker
     * @param {string} tickerSymbol - Ticker symbol to delete
     * @returns {Promise<Object>} Deletion result
     * @throws {Error} If ticker not found
     */
    async deleteTickerData(tickerSymbol) {
        return await prisma.$transaction(async (tx) => {
            const sanitizedSymbol = tickerSymbol.trim().toUpperCase()

            // Find ticker
            const ticker = await tx.ticker.findUnique({
                where: { symbol: sanitizedSymbol },
                include: {
                    _count: {
                        select: {
                            seasonalityData: true,
                        },
                    },
                },
            })

            if (!ticker) {
                throw new Error(`Ticker ${sanitizedSymbol} not found`)
            }

            const dataCount = ticker._count.seasonalityData

            // Delete all seasonality data for this ticker
            await tx.seasonalityData.deleteMany({
                where: { tickerId: ticker.id },
            })

            // Delete the ticker itself
            await tx.ticker.delete({
                where: { id: ticker.id },
            })

            console.log(`Deleted ticker ${sanitizedSymbol} and ${dataCount} data entries`)

            return {
                ticker: sanitizedSymbol,
                dataEntriesDeleted: dataCount,
            }
        })
    }

    /**
     * Delete all data (use with caution!)
     * @returns {Promise<Object>} Deletion result
     */
    async deleteAllData() {
        return await prisma.$transaction(async (tx) => {
            // Count before deletion
            const [tickerCount, dataCount] = await Promise.all([tx.ticker.count(), tx.seasonalityData.count()])

            // Delete all data
            await tx.seasonalityData.deleteMany({})
            await tx.ticker.deleteMany({})

            console.log(`Deleted all data: ${tickerCount} tickers, ${dataCount} entries`)

            return {
                tickersDeleted: tickerCount,
                dataEntriesDeleted: dataCount,
            }
        })
    }

    /**
     * Update existing data for a ticker (upsert behavior)
     * @param {string} tickerSymbol - Ticker symbol
     * @param {Array} records - New records to upsert
     * @returns {Promise<Object>} Update result
     */
    async updateTickerData(tickerSymbol, records) {
        return await prisma.$transaction(async (tx) => {
            const sanitizedSymbol = tickerSymbol.trim().toUpperCase()

            // Find or create ticker
            let ticker = await tx.ticker.findUnique({
                where: { symbol: sanitizedSymbol },
            })

            if (!ticker) {
                ticker = await tx.ticker.create({
                    data: { symbol: sanitizedSymbol },
                })
            }

            let created = 0
            let updated = 0

            // Process each record
            for (const record of records) {
                const result = await tx.seasonalityData.upsert({
                    where: {
                        date_tickerId: {
                            date: record.date,
                            tickerId: ticker.id,
                        },
                    },
                    update: {
                        open: record.open,
                        high: record.high,
                        low: record.low,
                        close: record.close,
                        volume: record.volume,
                        openInterest: record.openInterest,
                    },
                    create: {
                        date: record.date,
                        open: record.open,
                        high: record.high,
                        low: record.low,
                        close: record.close,
                        volume: record.volume,
                        openInterest: record.openInterest,
                        tickerId: ticker.id,
                    },
                })

                // Check if it was created or updated
                const existing = await tx.seasonalityData.findFirst({
                    where: {
                        date: record.date,
                        tickerId: ticker.id,
                        updatedAt: { lt: new Date() },
                    },
                })

                if (existing) {
                    updated++
                } else {
                    created++
                }
            }

            return {
                ticker: sanitizedSymbol,
                recordsCreated: created,
                recordsUpdated: updated,
            }
        })
    }
}

module.exports = new UploadService()
