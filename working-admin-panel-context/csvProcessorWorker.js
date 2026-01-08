// /**
//  * CSV Processor Worker Service - HIGH PERFORMANCE
//  * Processes 100 files in 2 minutes (1200 KB/s throughput)
//  * 
//  * Run this as a separate process: node src/services/csvProcessorWorker.js
//  */

// // Load environment variables FIRST
// require('dotenv').config();

// const fs = require('fs');
// const path = require('path');
// const Bull = require('bull');
// const { PrismaClient } = require('@prisma/client');
// const { parse } = require('csv-parse/sync');
// const { downloadToFile, deleteObject, BUCKETS } = require('../config/minio');

// // Use connection pooling for maximum performance
// const prisma = new PrismaClient({
//     log: [], // Disable logging for speed
// });

// // CRITICAL: Ultra-high concurrency configuration
// const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 50; // 50 concurrent jobs
// const BATCH_SIZE = parseInt(process.env.DB_BATCH_SIZE) || 5000; // Larger batches
// const TEMP_DIR = process.env.TEMP_DIR || '/tmp/seasonality-uploads';
// const MAX_RETRY_DELAY = 10000; // Fail fast

// // Ensure temp directory exists
// if (!fs.existsSync(TEMP_DIR)) {
//     fs.mkdirSync(TEMP_DIR, { recursive: true });
// }

// // Create Bull queue with aggressive settings for speed
// const processingQueue = new Bull('csv-processing', {
//     redis: {
//         host: process.env.REDIS_HOST || 'localhost',
//         port: parseInt(process.env.REDIS_PORT) || 6379,
//         retryStrategy: (times) => {
//             if (times > 1) return null; // Fail fast
//             return Math.min(times * 10, 100);
//         },
//         maxRetriesPerRequest: 1,
//         enableReadyCheck: false,
//         enableOfflineQueue: true,
//     },
//     settings: {
//         lockDuration: 60000, // 1 minute
//         stalledInterval: 60000,
//         maxStalledCount: 1,
//         guardInterval: 5000,
//         retryProcessDelay: 1000,
//     },
// });

// // Metrics tracking
// const metrics = {
//     processed: 0,
//     failed: 0,
//     startTime: Date.now(),
//     totalRecords: 0,
// };

// /**
//  * Parse date string to valid Date object
//  * Optimized for speed
//  */
// function parseDate(dateStr) {
//     if (!dateStr || dateStr.trim() === '') {
//         throw new Error('Empty date value');
//     }

//     const trimmed = dateStr.trim();

//     // Handle dd-mm-yyyy format (e.g., 24-12-2024)
//     const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
//     if (ddmmyyyyMatch) {
//         const [, day, month, year] = ddmmyyyyMatch;
//         const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
//         if (!isNaN(date.getTime())) {
//             return date;
//         }
//     }

//     // Handle dd/mm/yyyy format (e.g., 24/12/2024)
//     const ddmmyyyySlashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
//     if (ddmmyyyySlashMatch) {
//         const [, day, month, year] = ddmmyyyySlashMatch;
//         const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
//         if (!isNaN(date.getTime())) {
//             return date;
//         }
//     }

//     // Handle yyyy-mm-dd format (ISO format)
//     const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
//     if (yyyymmddMatch) {
//         const [, year, month, day] = yyyymmddMatch;
//         const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
//         if (!isNaN(date.getTime())) {
//             return date;
//         }
//     }

//     // Fallback: try standard JavaScript Date parsing
//     const date = new Date(trimmed);
//     if (!isNaN(date.getTime())) {
//         return date;
//     }

//     throw new Error(`Unable to parse date: "${dateStr}"`);
// }

// /**
//  * Normalize CSV column names - Optimized
//  */
// function normalizeColumnNames(headers) {
//     const columnMap = {
//         'date': 'date', 'Date': 'date', 'DATE': 'date',
//         'ticker': 'ticker', 'Ticker': 'ticker', 'TICKER': 'ticker',
//         'symbol': 'ticker', 'Symbol': 'ticker', 'SYMBOL': 'ticker',
//         'open': 'open', 'Open': 'open', 'OPEN': 'open',
//         'high': 'high', 'High': 'high', 'HIGH': 'high',
//         'low': 'low', 'Low': 'low', 'LOW': 'low',
//         'close': 'close', 'Close': 'close', 'CLOSE': 'close',
//         'volume': 'volume', 'Volume': 'volume', 'VOLUME': 'volume',
//         'openinterest': 'openInterest', 'OpenInterest': 'openInterest', 'OPENINTEREST': 'openInterest',
//         'open interest': 'openInterest',
//     };

//     return headers.map(h => columnMap[h] || h.toLowerCase().replace(/\s+/g, ''));
// }

// /**
//  * Detect CSV delimiter
//  */
// function detectDelimiter(content) {
//     const firstLine = content.split('\n')[0];
//     const tabCount = (firstLine.match(/\t/g) || []).length;
//     const commaCount = (firstLine.match(/,/g) || []).length;
//     const semicolonCount = (firstLine.match(/;/g) || []).length;

//     if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
//     if (semicolonCount > commaCount) return ';';
//     return ',';
// }

// /**
//  * Process a single CSV file - OPTIMIZED FOR SPEED
//  */
// async function processCSVFile(filePath, batchId, fileId) {
//     try {
//         // Read and parse CSV file
//         const fileContent = fs.readFileSync(filePath, 'utf-8');
//         const delimiter = detectDelimiter(fileContent);

//         const parsed = parse(fileContent, {
//             columns: false,
//             skip_empty_lines: true,
//             trim: true,
//             relax_quotes: true,
//             relax_column_count: true,
//             delimiter: delimiter,
//         });

//         if (parsed.length < 2) {
//             throw new Error('CSV file is empty');
//         }

//         // Normalize column names
//         const rawHeaders = parsed[0].map(h => h.trim());
//         const headers = normalizeColumnNames(rawHeaders);

//         // Required columns validation
//         const requiredColumns = ['date', 'ticker', 'close'];
//         const missingColumns = requiredColumns.filter(col => !headers.includes(col));
//         if (missingColumns.length > 0) {
//             throw new Error(`Missing columns: ${missingColumns.join(', ')}`);
//         }

//         // Create header index map for faster lookups
//         const headerIndexMap = {};
//         headers.forEach((header, index) => {
//             headerIndexMap[header] = index;
//         });

//         // Parse data rows - OPTIMIZED
//         const records = [];
//         for (let i = 1; i < parsed.length; i++) {
//             const row = parsed[i];
//             const dateIdx = headerIndexMap['date'];
//             const tickerIdx = headerIndexMap['ticker'];
//             const closeIdx = headerIndexMap['close'];

//             const date = row[dateIdx]?.trim();
//             const ticker = row[tickerIdx]?.trim();
//             const close = row[closeIdx]?.trim();

//             if (date && ticker && close) {
//                 records.push({
//                     date,
//                     ticker,
//                     open: row[headerIndexMap['open']]?.trim() || null,
//                     high: row[headerIndexMap['high']]?.trim() || null,
//                     low: row[headerIndexMap['low']]?.trim() || null,
//                     close,
//                     volume: row[headerIndexMap['volume']]?.trim() || null,
//                     openInterest: row[headerIndexMap['openInterest']]?.trim() || null,
//                 });
//             }
//         }

//         if (records.length === 0) {
//             throw new Error('No valid data records');
//         }

//         // Get or create tickers in bulk
//         const tickerSymbols = [...new Set(records.map(r => r.ticker))];
//         const tickerMap = {};

//         // Batch upsert tickers
//         for (const symbol of tickerSymbols) {
//             const ticker = await prisma.ticker.upsert({
//                 where: { symbol },
//                 update: {},
//                 create: { symbol },
//             });
//             tickerMap[symbol] = ticker.id;
//         }

//         // Transform data for database insertion
//         const seasonalityData = records.map((row) => ({
//             date: parseDate(row.date),
//             tickerId: tickerMap[row.ticker],
//             open: parseFloat(row.open) || parseFloat(row.close) || 0,
//             high: parseFloat(row.high) || parseFloat(row.close) || 0,
//             low: parseFloat(row.low) || parseFloat(row.close) || 0,
//             close: parseFloat(row.close) || 0,
//             volume: parseFloat(row.volume) || 0,
//             openInterest: parseFloat(row.openInterest) || 0,
//         }));

//         // Batch insert with upsert - CRITICAL FOR SPEED
//         let totalInserted = 0;
//         for (let i = 0; i < seasonalityData.length; i += BATCH_SIZE) {
//             const batch = seasonalityData.slice(i, i + BATCH_SIZE);

//             // Use raw SQL for bulk upsert if possible, otherwise use transaction
//             await prisma.$transaction(
//                 batch.map(row =>
//                     prisma.seasonalityData.upsert({
//                         where: {
//                             date_tickerId: {
//                                 date: row.date,
//                                 tickerId: row.tickerId,
//                             },
//                         },
//                         update: {
//                             open: row.open,
//                             high: row.high,
//                             low: row.low,
//                             close: row.close,
//                             volume: row.volume,
//                             openInterest: row.openInterest,
//                         },
//                         create: row,
//                     })
//                 ),
//                 {
//                     isolationLevel: 'ReadCommitted', // Faster isolation level
//                 }
//             );

//             totalInserted += batch.length;
//         }

//         return {
//             success: true,
//             recordsProcessed: records.length,
//             dataInserted: totalInserted,
//             tickersProcessed: tickerSymbols.length,
//         };

//     } catch (error) {
//         throw error;
//     }
// }

// /**
//  * Update batch and file status in database
//  */
// async function updateBatchStatus(batchId, fileId, status, error = null, recordsProcessed = 0) {
//     try {
//         await prisma.uploadedFile.update({
//             where: { id: fileId },
//             data: {
//                 status,
//                 recordsProcessed,
//                 error: error ? error.message.substring(0, 200) : null,
//                 processedAt: status === 'COMPLETED' ? new Date() : null,
//             },
//         });

//         const batch = await prisma.uploadBatch.findUnique({
//             where: { id: batchId },
//             include: { files: true },
//         });

//         if (!batch) return;

//         const processedCount = batch.files.filter(f => f.status === 'COMPLETED').length;
//         const failedCount = batch.files.filter(f => f.status === 'FAILED').length;

//         let newBatchStatus = batch.status;
//         if (processedCount + failedCount === batch.totalFiles) {
//             newBatchStatus = failedCount > 0 ? (processedCount > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
//         } else if (processedCount > 0 || failedCount > 0) {
//             newBatchStatus = 'PROCESSING';
//         }

//         await prisma.uploadBatch.update({
//             where: { id: batchId },
//             data: {
//                 status: newBatchStatus,
//                 processedFiles: processedCount,
//                 failedFiles: failedCount,
//             },
//         });

//     } catch (error) {
//         console.error('Error updating batch status:', error.message);
//     }
// }

// /**
//  * Process queue job
//  */
// async function processJob(job) {
//     const { objectKey, batchId, fileIndex, fileName } = job.data;
//     const tempFilePath = path.join(TEMP_DIR, `${Date.now()}_${fileIndex}_${fileName}`);

//     try {
//         const fileRecord = await prisma.uploadedFile.findFirst({
//             where: { batchId, objectKey },
//         });

//         if (fileRecord) {
//             await prisma.uploadedFile.update({
//                 where: { id: fileRecord.id },
//                 data: { status: 'PROCESSING' },
//             });
//         }

//         // Download file from MinIO
//         await downloadToFile(BUCKETS.UPLOADS, objectKey, tempFilePath);

//         // Process CSV file
//         const result = await processCSVFile(tempFilePath, batchId, fileRecord?.id);

//         // Update status to COMPLETED
//         await updateBatchStatus(batchId, fileRecord?.id, 'COMPLETED', null, result.recordsProcessed);

//         // Clean up temp file
//         if (fs.existsSync(tempFilePath)) {
//             fs.unlinkSync(tempFilePath);
//         }

//         // Delete from MinIO
//         try {
//             await deleteObject(BUCKETS.UPLOADS, objectKey);
//         } catch (deleteError) {
//             // Ignore deletion errors
//         }

//         metrics.processed++;
//         metrics.totalRecords += result.recordsProcessed;

//         return result;

//     } catch (error) {
//         console.error(`Error processing ${fileName}:`, error.message);

//         const fileRecord = await prisma.uploadedFile.findFirst({
//             where: { batchId, objectKey },
//         });
//         await updateBatchStatus(batchId, fileRecord?.id, 'FAILED', error);

//         if (fs.existsSync(tempFilePath)) {
//             fs.unlinkSync(tempFilePath);
//         }

//         metrics.failed++;
//         throw error;
//     }
// }

// // Configure worker with HIGH CONCURRENCY
// processingQueue.process(CONCURRENCY, async (job) => {
//     return await processJob(job);
// });

// // Event handlers
// processingQueue.on('completed', (job, result) => {
//     // Minimal logging for speed
// });

// processingQueue.on('failed', (job, error) => {
//     console.error(`Job ${job.id} failed:`, error.message);
// });

// processingQueue.on('error', (error) => {
//     if (!error.message.includes('ECONNREFUSED') && !error.message.includes('ETIMEDOUT')) {
//         console.error('Queue error:', error.message);
//     }
// });

// // Performance metrics
// setInterval(() => {
//     const elapsed = (Date.now() - metrics.startTime) / 1000;
//     const rate = elapsed > 0 ? (metrics.processed / elapsed).toFixed(2) : 0;
//     const recordsPerSec = elapsed > 0 ? (metrics.totalRecords / elapsed).toFixed(0) : 0;

//     console.log(`⚡ Processed: ${metrics.processed} files | Failed: ${metrics.failed} | Speed: ${rate}/sec | Records: ${recordsPerSec}/sec`);
// }, 30000); // Log every 30 seconds

// // Graceful shutdown
// async function shutdown() {
//     console.log('Shutting down worker...');
//     try {
//         await processingQueue.close();
//         await prisma.$disconnect();
//         process.exit(0);
//     } catch (error) {
//         console.error('Shutdown error:', error.message);
//         process.exit(1);
//     }
// }

// process.on('SIGTERM', shutdown);
// process.on('SIGINT', shutdown);

// // Start worker
// console.log(`========================================`);
// console.log(`⚡ HIGH-PERFORMANCE CSV WORKER STARTED`);
// console.log(`Concurrency: ${CONCURRENCY} jobs`);
// console.log(`Batch Size: ${BATCH_SIZE} records`);
// console.log(`Target: 100 files in 2 minutes`);
// console.log(`========================================`);

// module.exports = { processingQueue, processJob };


/**
 * CSV Processor Worker Service
 * Consumes jobs from BullMQ queue and processes CSV files from MinIO
 * 
 * Run this as a separate process: node src/services/csvProcessorWorker.js
 */

const fs = require('fs');
const path = require('path');
const Bull = require('bull');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const { downloadToFile, deleteObject, BUCKETS } = require('../config/minio');

const prisma = new PrismaClient();

// Configuration
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 5;
const BATCH_SIZE = parseInt(process.env.DB_BATCH_SIZE) || 1000;
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/seasonality-uploads';

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Create Bull queue
const processingQueue = new Bull('csv-processing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
    },
});

// Metrics tracking
const metrics = {
    processed: 0,
    failed: 0,
    startTime: Date.now(),
};

/**
 * Parse date string to valid Date object
 * Handles dd-mm-yyyy format from CSV files
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') {
        throw new Error('Empty date value');
    }

    const trimmed = dateStr.trim();

    // Handle dd-mm-yyyy format (e.g., 24-12-2024)
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Handle dd/mm/yyyy format (e.g., 24/12/2024)
    const ddmmyyyySlashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyySlashMatch) {
        const [, day, month, year] = ddmmyyyySlashMatch;
        const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Handle yyyy-mm-dd format (ISO format)
    const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Fallback: try standard JavaScript Date parsing
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date;
    }

    throw new Error(`Unable to parse date: "${dateStr}" (expected format: dd-mm-yyyy)`);
}

/**
 * Normalize CSV column names
 * Maps various column name formats to standard names
 */
function normalizeColumnNames(headers) {
    const columnMap = {
        'date': 'date',
        'Date': 'date',
        'DATE': 'date',
        'ticker': 'ticker',
        'Ticker': 'ticker',
        'TICKER': 'ticker',
        'symbol': 'ticker',
        'Symbol': 'ticker',
        'SYMBOL': 'ticker',
        'open': 'open',
        'Open': 'open',
        'OPEN': 'open',
        'high': 'high',
        'High': 'high',
        'HIGH': 'high',
        'low': 'low',
        'Low': 'low',
        'LOW': 'low',
        'close': 'close',
        'Close': 'close',
        'CLOSE': 'close',
        'volume': 'volume',
        'Volume': 'volume',
        'VOLUME': 'volume',
        'openinterest': 'openInterest',
        'OpenInterest': 'openInterest',
        'OPENINTEREST': 'openInterest',
        'open interest': 'openInterest',
    };

    return headers.map(h => columnMap[h] || h.toLowerCase().replace(/\s+/g, ''));
}

/**
 * Detect CSV delimiter
 */
function detectDelimiter(content) {
    const firstLine = content.split('\n')[0];

    // Count occurrences of common delimiters
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;

    // Return the most common delimiter
    if (tabCount > commaCount && tabCount > semicolonCount) {
        return '\t';
    } else if (semicolonCount > commaCount) {
        return ';';
    }
    return ',';
}

/**
 * Process a single CSV file
 */
async function processCSVFile(filePath, batchId, fileId) {
    const records = [];

    try {
        // Read and parse CSV file
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Detect delimiter
        const delimiter = detectDelimiter(fileContent);
        console.log(`Detected delimiter: ${delimiter === '\t' ? 'TAB' : delimiter === ',' ? 'COMMA' : 'SEMICOLON'}`);

        const parsed = parse(fileContent, {
            columns: false,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true,
            delimiter: delimiter,
        });

        console.log(`Parsed ${parsed.length} rows from CSV`);

        if (parsed.length < 2) {
            throw new Error(`CSV file is empty or has only header row. Parsed ${parsed.length} rows.`);
        }

        // Normalize column names
        const rawHeaders = parsed[0].map(h => h.trim());
        const headers = normalizeColumnNames(rawHeaders);

        // Required columns validation
        const requiredColumns = ['date', 'ticker', 'close'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }

        // Parse data rows
        for (let i = 1; i < parsed.length; i++) {
            const row = parsed[i];
            const record = {};

            headers.forEach((header, index) => {
                if (row[index] !== undefined) {
                    record[header] = row[index].trim();
                }
            });

            // Skip rows with missing required fields
            if (!record.date || !record.ticker || !record.close) {
                continue;
            }

            records.push(record);
        }

        if (records.length === 0) {
            throw new Error('No valid data records found in CSV');
        }

        // Get or create tickers
        const tickerSymbols = [...new Set(records.map(r => r.ticker))];
        const tickerResults = await Promise.all(
            tickerSymbols.map(symbol =>
                prisma.ticker.upsert({
                    where: { symbol },
                    update: {},
                    create: { symbol },
                })
            )
        );

        const tickerMap = {};
        tickerResults.forEach(t => {
            tickerMap[t.symbol] = t.id;
        });

        // Transform data for database insertion with proper date parsing
        const seasonalityData = records.map((row, index) => {
            try {
                const date = parseDate(row.date);

                return {
                    date,
                    tickerId: tickerMap[row.ticker],
                    open: parseFloat(row.open) || parseFloat(row.close) || 0,
                    high: parseFloat(row.high) || parseFloat(row.close) || 0,
                    low: parseFloat(row.low) || parseFloat(row.close) || 0,
                    close: parseFloat(row.close) || 0,
                    volume: parseFloat(row.volume) || 0,
                    openInterest: parseFloat(row.openInterest) || 0,
                };
            } catch (error) {
                throw new Error(`Row ${index + 2} (Ticker: ${row.ticker}): ${error.message}`);
            }
        });

        // Batch insert with upsert
        let totalInserted = 0;
        for (let i = 0; i < seasonalityData.length; i += BATCH_SIZE) {
            const batch = seasonalityData.slice(i, i + BATCH_SIZE);

            await prisma.$transaction(
                batch.map(row =>
                    prisma.seasonalityData.upsert({
                        where: {
                            date_tickerId: {
                                date: row.date,
                                tickerId: row.tickerId,
                            },
                        },
                        update: {
                            open: row.open,
                            high: row.high,
                            low: row.low,
                            close: row.close,
                            volume: row.volume,
                            openInterest: row.openInterest,
                        },
                        create: row,
                    })
                )
            );

            totalInserted += batch.length;
        }

        return {
            success: true,
            recordsProcessed: records.length,
            dataInserted: totalInserted,
            tickersProcessed: tickerSymbols.length,
        };

    } catch (error) {
        throw error;
    }
}

/**
 * Update batch and file status in database
 */
async function updateBatchStatus(batchId, fileId, status, error = null, recordsProcessed = 0) {
    try {
        // Update file status
        await prisma.uploadedFile.update({
            where: { id: fileId },
            data: {
                status,
                recordsProcessed,
                error: error ? error.message : null,
                processedAt: status === 'COMPLETED' ? new Date() : null,
            },
        });

        // Get current batch status
        const batch = await prisma.uploadBatch.findUnique({
            where: { id: batchId },
            include: { files: true },
        });

        if (!batch) return;

        const processedCount = batch.files.filter(f => f.status === 'COMPLETED').length;
        const failedCount = batch.files.filter(f => f.status === 'FAILED').length;
        const pendingCount = batch.files.filter(f => f.status === 'PENDING').length;

        // Determine batch status
        let newBatchStatus = batch.status;
        if (processedCount + failedCount === batch.totalFiles) {
            newBatchStatus = failedCount > 0 ? (processedCount > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
        } else if (processedCount > 0 || failedCount > 0) {
            newBatchStatus = 'PROCESSING';
        }

        // Update batch
        await prisma.uploadBatch.update({
            where: { id: batchId },
            data: {
                status: newBatchStatus,
                processedFiles: processedCount,
                failedFiles: failedCount,
            },
        });

    } catch (error) {
        console.error('Error updating batch status:', error.message);
    }
}

/**
 * Process queue job
 */
async function processJob(job) {
    const { objectKey, batchId, fileIndex, fileName, retry } = job.data;
    const tempFilePath = path.join(TEMP_DIR, `${Date.now()}_${fileIndex}_${fileName}`);

    console.log(`[${new Date().toISOString()}] Processing file: ${fileName} (Batch: ${batchId})`);

    try {
        // Update file status to PROCESSING
        const fileRecord = await prisma.uploadedFile.findFirst({
            where: { batchId, objectKey },
        });

        if (fileRecord) {
            await prisma.uploadedFile.update({
                where: { id: fileRecord.id },
                data: { status: 'PROCESSING' },
            });
        }

        // Download file from MinIO
        await downloadToFile(BUCKETS.UPLOADS, objectKey, tempFilePath);

        // Process CSV file
        const result = await processCSVFile(tempFilePath, batchId, fileRecord?.id);

        // Update status to COMPLETED
        await updateBatchStatus(batchId, fileRecord?.id, 'COMPLETED', null, result.recordsProcessed);

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        // Delete from MinIO (move to processed)
        try {
            await deleteObject(BUCKETS.UPLOADS, objectKey);
        } catch (deleteError) {
            console.warn(`Could not delete ${objectKey} from MinIO:`, deleteError.message);
        }

        metrics.processed++;
        console.log(`[${new Date().toISOString()}] Completed: ${fileName} - ${result.recordsProcessed} records`);

        return result;

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing ${fileName}:`, error.message);

        // Update status to FAILED
        const fileRecord = await prisma.uploadedFile.findFirst({
            where: { batchId, objectKey },
        });
        await updateBatchStatus(batchId, fileRecord?.id, 'FAILED', error);

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        metrics.failed++;
        throw error;
    }
}

// Configure worker
processingQueue.process(CONCURRENCY, async (job) => {
    return await processJob(job);
});

// Event handlers
processingQueue.on('completed', (job, result) => {
    console.log(`[COMPLETED] Job ${job.id}: ${result?.recordsProcessed || 0} records`);
});

processingQueue.on('failed', (job, error) => {
    console.error(`[FAILED] Job ${job.id}:`, error.message);
});

processingQueue.on('error', (error) => {
    console.error('[QUEUE ERROR]', error.message);
});

processingQueue.on('stalled', (job) => {
    console.warn(`[STALLED] Job ${job.id} - may need manual intervention`);
});

// Progress logging
setInterval(() => {
    const elapsed = (Date.now() - metrics.startTime) / 1000;
    const rate = elapsed > 0 ? (metrics.processed / elapsed).toFixed(2) : 0;

    console.log(`[STATS] Processed: ${metrics.processed}, Failed: ${metrics.failed}, Rate: ${rate}/sec`);
}, 60000); // Log every minute

// Graceful shutdown
async function shutdown() {
    console.log('Shutting down worker gracefully...');

    try {
        // Close queue connection
        await processingQueue.close();
        console.log('Queue connection closed');

        // Close database connection
        await prisma.$disconnect();
        console.log('Database connection closed');

        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error.message);
        process.exit(1);
    }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start worker
console.log(`========================================`);
console.log(`CSV Processor Worker Started`);
console.log(`Concurrency: ${CONCURRENCY}`);
console.log(`Batch Size: ${BATCH_SIZE}`);
console.log(`Queue: csv-processing`);
console.log(`========================================`);

module.exports = { processingQueue, processJob };