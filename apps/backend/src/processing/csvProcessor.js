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
const { generateSymbolFiles } = require('./fileGenerator');

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
        throw new Error(columnValidation.errorMessage || 
          `Missing required columns: ${columnValidation.missingColumns.join(', ')}. ` +
          `Found columns: ${headers.join(', ')}. ` +
          `Required: Date, Close (or Ticker). Optional: Open, High, Low, Volume, OpenInterest`);
      }

      logger.info('Column validation passed', { 
        foundColumns: columnValidation.foundColumns,
        headers: headers 
      });

      // Step 3: PRE-VALIDATE ALL ROWS before any transformation
      // This ensures we reject the entire file if ANY row has invalid data
      const preValidationErrors = this.preValidateAllRows(data, headers, defaultSymbol);
      if (preValidationErrors.length > 0) {
        const errorSummary = preValidationErrors.slice(0, 10).join('; ');
        const totalErrors = preValidationErrors.length;
        throw new Error(
          `CSV validation failed with ${totalErrors} error(s). ` +
          `First errors: ${errorSummary}` +
          (totalErrors > 10 ? ` ... and ${totalErrors - 10} more errors` : '')
        );
      }

      logger.info('Pre-validation passed', { rows: data.length });

      // Step 4: Transform data (now safe since pre-validation passed)
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

      // Step 5: Validate data quality (optional)
      if (this.options.validateData) {
        const qualityCheck = runDataQualityCheck(transformed.data);
        if (!qualityCheck.overallValid) {
          this.stats.warnings.push(...qualityCheck.validation.warningDetails);
        }
        logger.info('Data quality check complete', qualityCheck.summary);
      }

      // Step 6: Group by symbol and process each
      const symbolGroups = groupBySymbol(transformed.data);
      const results = [];

      for (const [symbol, symbolData] of symbolGroups) {
        const result = await this.processSymbolData(symbol, symbolData, tickerId, options);
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
   * Pre-validate all rows before any processing
   * Returns array of error messages, empty if all valid
   * @param {Array} data - Raw CSV data rows
   * @param {Array} headers - CSV headers
   * @param {string} defaultSymbol - Default symbol if not in data
   * @returns {Array<string>} Array of error messages
   */
  preValidateAllRows(data, headers, defaultSymbol = null) {
    const errors = [];
    const { parseDate, parseNumber } = require('./transformers');
    const { normalizeColumnName } = require('./validators');
    
    // Normalize headers for lookup
    const normalizedHeaders = headers.map(h => normalizeColumnName(h));
    const dateIndex = normalizedHeaders.indexOf('date');
    const closeIndex = normalizedHeaders.indexOf('close');
    const tickerIndex = normalizedHeaders.indexOf('symbol') !== -1 
      ? normalizedHeaders.indexOf('symbol') 
      : normalizedHeaders.indexOf('ticker');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

      // Get values using original headers
      const dateValue = row[headers[dateIndex]];
      const closeValue = row[headers[closeIndex]];
      const tickerValue = tickerIndex >= 0 ? row[headers[tickerIndex]] : defaultSymbol;

      // Validate date - STRICT
      if (!dateValue || dateValue.trim() === '') {
        errors.push(`Row ${rowNum}: Missing date value`);
      } else {
        const parsedDate = parseDate(dateValue);
        if (!parsedDate) {
          errors.push(`Row ${rowNum}: Invalid date format "${dateValue}" (expected: DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD)`);
        }
      }

      // Validate close price - REQUIRED
      if (!closeValue || closeValue.trim() === '') {
        errors.push(`Row ${rowNum}: Missing close price`);
      } else {
        const closeNum = parseNumber(closeValue);
        if (isNaN(closeNum) || closeNum <= 0) {
          errors.push(`Row ${rowNum}: Invalid close price "${closeValue}" (must be a positive number)`);
        }
      }

      // Validate ticker/symbol if no default
      if (!tickerValue && !defaultSymbol) {
        errors.push(`Row ${rowNum}: Missing ticker/symbol`);
      }

      // Stop after 50 errors to avoid huge error messages
      if (errors.length >= 50) {
        errors.push(`... validation stopped after 50 errors`);
        break;
      }
    }

    return errors;
  }

  /**
   * Process data for a single symbol
   * @param {string} symbol - Symbol name
   * @param {Array} data - Symbol data
   * @param {number} existingTickerId - Existing ticker ID (optional)
   * @param {Object} options - Processing options
   * @returns {Object} Processing result for symbol
   */
  async processSymbolData(symbol, data, existingTickerId = null, options = {}) {
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

      // Convert to database format and store basic OHLCV data
      const dbRecords = toDatabaseFormat(dedupedData, ticker.id);
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

      // Generate calculated data and store in Phase 2 tables
      let calculatedCounts = null;
      logger.info('Checking generateCalculatedData option', { 
        symbol, 
        generateCalculatedData: options.generateCalculatedData,
        optionsKeys: Object.keys(options),
        dedupedDataLength: dedupedData.length
      });
      
      if (options.generateCalculatedData !== false) {
        logger.info('Starting calculated data generation', { symbol, recordCount: dedupedData.length });
        try {
          calculatedCounts = await this.generateAndStoreCalculatedData(ticker.id, symbol, dedupedData);
          
          logger.info('Generated calculated data', {
            symbol,
            daily: calculatedCounts.daily,
            mondayWeekly: calculatedCounts.mondayWeekly,
            expiryWeekly: calculatedCounts.expiryWeekly,
            monthly: calculatedCounts.monthly,
            yearly: calculatedCounts.yearly
          });
        } catch (calcError) {
          logger.error('Calculated data generation failed', { symbol, error: calcError.message, stack: calcError.stack });
          // Continue processing even if calculation fails
        }
      } else {
        logger.info('Skipping calculated data generation - disabled', { symbol });
      }

      // Update ticker statistics
      await this.updateTickerStats(ticker.id);

      return {
        symbol,
        tickerId: ticker.id,
        recordCount: dedupedData.length,
        inserted,
        updated,
        calculatedData: calculatedCounts
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

    // Use transaction for batch operations with extended timeout
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
    }, {
      maxWait: 300000,  // 5 minutes max wait
      timeout: 120000,  // 2 minutes timeout
    });

    return { inserted, updated };
  }

  /**
   * Generate calculated data and store in Phase 2 tables
   * @param {number} tickerId - Ticker ID
   * @param {string} symbol - Symbol name
   * @param {Array} dailyData - Daily data
   * @returns {Object} Counts of stored records
   */
  async generateAndStoreCalculatedData(tickerId, symbol, dailyData) {
    try {
      const { generateSymbolFiles } = require('./fileGenerator');
      
      // Generate calculated data using the same logic as Python
      const calculatedData = await generateSymbolFiles(dailyData, symbol);
      
      logger.info('Generated calculated data for storage', {
        symbol,
        daily: calculatedData.daily?.length || 0,
        mondayWeekly: calculatedData.mondayWeekly?.length || 0,
        expiryWeekly: calculatedData.expiryWeekly?.length || 0,
        monthly: calculatedData.monthly?.length || 0,
        yearly: calculatedData.yearly?.length || 0
      });
      
      // Store in Phase 2 tables
      const counts = {
        daily: 0,
        mondayWeekly: 0,
        expiryWeekly: 0,
        monthly: 0,
        yearly: 0
      };

      // Store Weekly Seasonality Data (Monday-based)
      if (calculatedData.mondayWeekly && calculatedData.mondayWeekly.length > 0) {
        logger.info('Storing Monday weekly data', { symbol, count: calculatedData.mondayWeekly.length });
        
        for (const record of calculatedData.mondayWeekly) {
          try {
            await prisma.weeklySeasonalityData.upsert({
              where: {
                date_tickerId_weekType: {
                  date: record.date,
                  tickerId: tickerId,
                  weekType: 'MONDAY'
                }
              },
              update: {
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                updatedAt: new Date()
              },
              create: {
                tickerId: tickerId,
                date: record.date,
                weekType: 'MONDAY',
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            counts.mondayWeekly++;
          } catch (error) {
            logger.error('Error storing Monday weekly record', { symbol, date: record.date, error: error.message });
          }
        }
      }

      // Store Weekly Seasonality Data (Expiry-based)
      if (calculatedData.expiryWeekly && calculatedData.expiryWeekly.length > 0) {
        logger.info('Storing Expiry weekly data', { symbol, count: calculatedData.expiryWeekly.length });
        
        for (const record of calculatedData.expiryWeekly) {
          try {
            await prisma.weeklySeasonalityData.upsert({
              where: {
                date_tickerId_weekType: {
                  date: record.date,
                  tickerId: tickerId,
                  weekType: 'EXPIRY'
                }
              },
              update: {
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                updatedAt: new Date()
              },
              create: {
                tickerId: tickerId,
                date: record.date,
                weekType: 'EXPIRY',
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                weekNumberMonthly: record.weekNumberMonthly || null,
                weekNumberYearly: record.weekNumberYearly || null,
                evenWeekNumberMonthly: record.evenWeekNumberMonthly || null,
                evenWeekNumberYearly: record.evenWeekNumberYearly || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveWeek: record.positiveWeek || null,
                evenMonth: record.evenMonth || null,
                monthlyReturnPoints: record.monthlyReturnPoints || null,
                monthlyReturnPercentage: record.monthlyReturnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            counts.expiryWeekly++;
          } catch (error) {
            logger.error('Error storing Expiry weekly record', { symbol, date: record.date, error: error.message });
          }
        }
      }

      // Store Monthly Seasonality Data
      if (calculatedData.monthly && calculatedData.monthly.length > 0) {
        logger.info('Storing Monthly data', { symbol, count: calculatedData.monthly.length });
        
        for (const record of calculatedData.monthly) {
          try {
            await prisma.monthlySeasonalityData.upsert({
              where: {
                date_tickerId: {
                  date: record.date,
                  tickerId: tickerId
                }
              },
              update: {
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenMonth: record.evenMonth || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                updatedAt: new Date()
              },
              create: {
                tickerId: tickerId,
                date: record.date,
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenMonth: record.evenMonth || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveMonth: record.positiveMonth || null,
                evenYear: record.evenYear || null,
                yearlyReturnPoints: record.yearlyReturnPoints || null,
                yearlyReturnPercentage: record.yearlyReturnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            counts.monthly++;
          } catch (error) {
            logger.error('Error storing Monthly record', { symbol, date: record.date, error: error.message });
          }
        }
      }

      // Store Yearly Seasonality Data
      if (calculatedData.yearly && calculatedData.yearly.length > 0) {
        logger.info('Storing Yearly data', { symbol, count: calculatedData.yearly.length });
        
        for (const record of calculatedData.yearly) {
          try {
            await prisma.yearlySeasonalityData.upsert({
              where: {
                date_tickerId: {
                  date: record.date,
                  tickerId: tickerId
                }
              },
              update: {
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenYear: record.evenYear || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveYear: record.positiveYear || null,
                updatedAt: new Date()
              },
              create: {
                tickerId: tickerId,
                date: record.date,
                open: record.open || 0,
                high: record.high || 0,
                low: record.low || 0,
                close: record.close || 0,
                volume: record.volume || 0,
                openInterest: record.openInterest || 0,
                weekday: record.weekday || null,
                evenYear: record.evenYear || null,
                returnPoints: record.returnPoints || null,
                returnPercentage: record.returnPercentage || null,
                positiveYear: record.positiveYear || null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });
            counts.yearly++;
          } catch (error) {
            logger.error('Error storing Yearly record', { symbol, date: record.date, error: error.message });
          }
        }
      }

      logger.info('Completed storing calculated data', { symbol, counts });
      return counts;

    } catch (error) {
      logger.error('Failed to generate and store calculated data', { symbol, error: error.message, stack: error.stack });
      throw error;
    }
  }
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
