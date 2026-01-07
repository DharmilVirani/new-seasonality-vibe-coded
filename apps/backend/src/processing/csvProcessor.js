/**
 * CSV Processor Module
 * Main entry point for processing uploaded CSV files
 * Handles parsing, validation, transformation, and database insertion
 */

const { Readable } = require('stream');
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');
const { validateRequiredColumns, runDataQualityCheck } = require('./validators');
const { transformDataset, groupBySymbol, deduplicateByDate, toDatabaseFormat, batchData } = require('./transformers');
const { calculateAllDerivedFields } = require('./calculations');

/**
 * Parse CSV content to array of objects
 * @param {string} csvContent - Raw CSV string
 * @returns {Object} { headers, data }
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
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

  return { headers, data };
}

/**
 * Parse a single CSV line handling quoted values
 * @param {string} line 
 * @returns {Array<string>}
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
 * Main CSV Processor Class
 */
class CSVProcessor {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 1000,
      skipInvalid: options.skipInvalid !== false,
      calculateDerived: options.calculateDerived !== false,
      validateData: options.validateData !== false,
      ...options,
    };
    
    this.stats = {
      totalRows: 0,
      processedRows: 0,
      skippedRows: 0,
      insertedRows: 0,
      updatedRows: 0,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Process uploaded file buffer
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Original file name
   * @param {Object} options - Processing options
   * @returns {Object} Processing result
   */
  async processUploadedFile(fileBuffer, fileName, options = {}) {
    const startTime = Date.now();
    const { defaultSymbol, tickerId } = options;

    try {
      logger.info('Starting CSV processing', { fileName });

      // Step 1: Parse CSV
      const csvContent = fileBuffer.toString('utf-8');
      const { headers, data } = parseCSV(csvContent);
      this.stats.totalRows = data.length;

      logger.info('CSV parsed', { rows: data.length, columns: headers.length });

      // Step 2: Validate columns
      const columnValidation = validateRequiredColumns(headers, 'daily');
      if (!columnValidation.valid) {
        throw new Error(`Missing required columns: ${columnValidation.missingColumns.join(', ')}`);
      }

      // Step 3: Transform data
      const transformed = transformDataset(data, headers, {
        skipInvalid: this.options.skipInvalid,
        defaultSymbol,
      });

      this.stats.processedRows = transformed.data.length;
      this.stats.skippedRows = transformed.stats.skipped;
      this.stats.errors.push(...transformed.errors);

      logger.info('Data transformed', { 
        processed: transformed.data.length, 
        skipped: transformed.stats.skipped 
      });

      // Step 4: Validate data quality (optional)
      if (this.options.validateData) {
        const qualityCheck = runDataQualityCheck(transformed.data);
        if (!qualityCheck.overallValid) {
          this.stats.warnings.push(...qualityCheck.validation.warningDetails);
        }
        logger.info('Data quality check complete', qualityCheck.summary);
      }

      // Step 5: Group by symbol and process each
      const symbolGroups = groupBySymbol(transformed.data);
      const results = [];

      for (const [symbol, symbolData] of symbolGroups) {
        const result = await this.processSymbolData(symbol, symbolData, tickerId);
        results.push(result);
      }

      const processingTime = Date.now() - startTime;

      logger.info('CSV processing complete', {
        fileName,
        processingTime: `${processingTime}ms`,
        symbols: symbolGroups.size,
        totalInserted: this.stats.insertedRows,
      });

      return {
        success: true,
        fileName,
        processingTime,
        stats: this.stats,
        results,
      };

    } catch (error) {
      logger.error('CSV processing failed', { fileName, error: error.message });
      
      return {
        success: false,
        fileName,
        error: error.message,
        stats: this.stats,
      };
    }
  }

  /**
   * Process data for a single symbol
   * @param {string} symbol - Symbol name
   * @param {Array} data - Symbol data
   * @param {number} existingTickerId - Existing ticker ID (optional)
   * @returns {Object} Processing result for symbol
   */
  async processSymbolData(symbol, data, existingTickerId = null) {
    try {
      // Deduplicate by date
      const dedupedData = deduplicateByDate(data);

      // Get or create ticker
      let ticker;
      if (existingTickerId) {
        ticker = await prisma.ticker.findUnique({ where: { id: existingTickerId } });
      }
      
      if (!ticker) {
        ticker = await prisma.ticker.upsert({
          where: { symbol },
          update: {
            lastUpdated: new Date(),
          },
          create: {
            symbol,
            name: symbol,
            isActive: true,
          },
        });
      }

      // Calculate derived fields if enabled
      let processedData = dedupedData;
      if (this.options.calculateDerived) {
        const calculated = calculateAllDerivedFields(dedupedData);
        processedData = calculated.daily;
      }

      // Convert to database format
      const dbRecords = toDatabaseFormat(processedData, ticker.id);

      // Batch insert/update
      const batches = batchData(dbRecords, this.options.batchSize);
      let inserted = 0;
      let updated = 0;

      for (const batch of batches) {
        const result = await this.upsertBatch(batch);
        inserted += result.inserted;
        updated += result.updated;
      }

      this.stats.insertedRows += inserted;
      this.stats.updatedRows += updated;

      // Update ticker statistics
      await this.updateTickerStats(ticker.id);

      return {
        symbol,
        tickerId: ticker.id,
        recordCount: dedupedData.length,
        inserted,
        updated,
      };

    } catch (error) {
      logger.error('Symbol processing failed', { symbol, error: error.message });
      this.stats.errors.push({ symbol, error: error.message });
      
      return {
        symbol,
        error: error.message,
      };
    }
  }

  /**
   * Upsert a batch of records
   * @param {Array} batch - Batch of records
   * @returns {Object} { inserted, updated }
   */
  async upsertBatch(batch) {
    let inserted = 0;
    let updated = 0;

    // Use transaction for batch operations
    await prisma.$transaction(async (tx) => {
      for (const record of batch) {
        const existing = await tx.seasonalityData.findUnique({
          where: {
            date_tickerId: {
              date: record.date,
              tickerId: record.tickerId,
            },
          },
        });

        if (existing) {
          await tx.seasonalityData.update({
            where: { id: existing.id },
            data: {
              open: record.open,
              high: record.high,
              low: record.low,
              close: record.close,
              volume: record.volume,
              openInterest: record.openInterest,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          await tx.seasonalityData.create({
            data: record,
          });
          inserted++;
        }
      }
    });

    return { inserted, updated };
  }

  /**
   * Update ticker statistics after data import
   * @param {number} tickerId 
   */
  async updateTickerStats(tickerId) {
    const stats = await prisma.seasonalityData.aggregate({
      where: { tickerId },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true },
    });

    await prisma.ticker.update({
      where: { id: tickerId },
      data: {
        totalRecords: stats._count.id,
        firstDataDate: stats._min.date,
        lastDataDate: stats._max.date,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Process multiple files in batch
   * @param {Array<{buffer: Buffer, name: string}>} files 
   * @param {Function} progressCallback - Progress callback
   * @returns {Object} Batch processing result
   */
  async processBatch(files, progressCallback = null) {
    const results = [];
    let completed = 0;

    for (const file of files) {
      const result = await this.processUploadedFile(file.buffer, file.name);
      results.push(result);
      
      completed++;
      if (progressCallback) {
        progressCallback({
          completed,
          total: files.length,
          percentage: (completed / files.length) * 100,
          currentFile: file.name,
        });
      }
    }

    return {
      totalFiles: files.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results,
    };
  }
}

/**
 * Create a new CSV processor instance
 * @param {Object} options 
 * @returns {CSVProcessor}
 */
function createProcessor(options = {}) {
  return new CSVProcessor(options);
}

module.exports = {
  CSVProcessor,
  createProcessor,
  parseCSV,
  parseCSVLine,
};
