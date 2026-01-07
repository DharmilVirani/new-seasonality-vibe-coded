/**
 * Data Transformation Module
 * Transforms raw CSV data into normalized format for database storage
 */

const { normalizeColumnName } = require('./validators');

/**
 * Parse date string to Date object
 * Supports multiple date formats
 * @param {string} dateStr 
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try common formats
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // DD-MM-YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/,
    // DD/MM/YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    // MM/DD/YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    // YYYY/MM/DD
    /^(\d{4})\/(\d{2})\/(\d{2})$/,
  ];

  const str = dateStr.trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD-MM-YYYY format (common in Indian data)
  const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try DD/MM/YYYY format
  const ddmmyyyySlash = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyySlash) {
    const [, day, month, year] = ddmmyyyySlash;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback to native Date parsing
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse numeric value with fallback
 * @param {any} value 
 * @param {number} defaultValue 
 * @returns {number}
 */
function parseNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  // Remove commas and whitespace
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? defaultValue : num;
}

/**
 * Parse boolean value
 * @param {any} value 
 * @returns {boolean}
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}

/**
 * Transform raw CSV row to normalized format
 * @param {Object} rawRow - Raw CSV row with original column names
 * @param {Array<string>} headers - Original headers
 * @returns {Object} Normalized row
 */
function transformRow(rawRow, headers) {
  const normalized = {};

  // Map each column to normalized name
  for (const header of headers) {
    const normalizedName = normalizeColumnName(header);
    normalized[normalizedName] = rawRow[header];
  }

  // Parse and validate specific fields
  return {
    date: parseDate(normalized.date),
    symbol: (normalized.symbol || normalized.ticker || '').toUpperCase().trim(),
    open: parseNumber(normalized.open),
    high: parseNumber(normalized.high),
    low: parseNumber(normalized.low),
    close: parseNumber(normalized.close),
    volume: parseNumber(normalized.volume, 0),
    openInterest: parseNumber(normalized.openInterest || normalized.oi, 0),
    // Preserve any additional fields
    ...Object.fromEntries(
      Object.entries(normalized)
        .filter(([key]) => !['date', 'symbol', 'ticker', 'open', 'high', 'low', 'close', 'volume', 'openInterest', 'oi'].includes(key))
    ),
  };
}

/**
 * Transform entire CSV dataset
 * @param {Array<Object>} rawData - Raw CSV data
 * @param {Array<string>} headers - CSV headers
 * @param {Object} options - Transform options
 * @returns {Object} { data, errors, stats }
 */
function transformDataset(rawData, headers, options = {}) {
  const {
    skipInvalid = true,
    defaultSymbol = null,
  } = options;

  const transformed = [];
  const errors = [];
  let skipped = 0;

  for (let i = 0; i < rawData.length; i++) {
    try {
      const row = transformRow(rawData[i], headers);

      // Validate essential fields
      if (!row.date) {
        if (skipInvalid) {
          skipped++;
          errors.push({ row: i + 1, error: 'Invalid or missing date' });
          continue;
        }
      }

      // Apply default symbol if not present
      if (!row.symbol && defaultSymbol) {
        row.symbol = defaultSymbol;
      }

      // Validate OHLC
      if (row.open <= 0 || row.high <= 0 || row.low <= 0 || row.close <= 0) {
        if (skipInvalid) {
          skipped++;
          errors.push({ row: i + 1, error: 'Invalid OHLC values' });
          continue;
        }
      }

      transformed.push(row);
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
      if (skipInvalid) {
        skipped++;
      }
    }
  }

  return {
    data: transformed,
    errors: errors.slice(0, 100),
    stats: {
      total: rawData.length,
      transformed: transformed.length,
      skipped,
      errorCount: errors.length,
    },
  };
}

/**
 * Group transformed data by symbol
 * @param {Array<Object>} data - Transformed data
 * @returns {Map<string, Array>} Map of symbol to data array
 */
function groupBySymbol(data) {
  const groups = new Map();

  for (const row of data) {
    const symbol = row.symbol || 'UNKNOWN';
    if (!groups.has(symbol)) {
      groups.set(symbol, []);
    }
    groups.get(symbol).push(row);
  }

  // Sort each group by date
  for (const [symbol, rows] of groups) {
    rows.sort((a, b) => a.date - b.date);
  }

  return groups;
}

/**
 * Deduplicate data by date (keep latest)
 * @param {Array<Object>} data - Sorted data array
 * @returns {Array<Object>} Deduplicated data
 */
function deduplicateByDate(data) {
  const seen = new Map();

  for (const row of data) {
    const dateKey = row.date.toISOString().split('T')[0];
    seen.set(dateKey, row); // Later entries overwrite earlier ones
  }

  return Array.from(seen.values()).sort((a, b) => a.date - b.date);
}

/**
 * Fill missing dates with interpolated values
 * @param {Array<Object>} data - Sorted data array
 * @param {Object} options - Fill options
 * @returns {Array<Object>} Data with filled gaps
 */
function fillMissingDates(data, options = {}) {
  const {
    fillMethod = 'forward', // 'forward', 'backward', 'interpolate'
    maxGapDays = 5,
  } = options;

  if (data.length < 2) return data;

  const filled = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const prevDate = new Date(data[i - 1].date);
    const currDate = new Date(data[i].date);
    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

    // Fill gaps (skip weekends - 2 days is normal)
    if (diffDays > 1 && diffDays <= maxGapDays) {
      for (let d = 1; d < diffDays; d++) {
        const fillDate = new Date(prevDate);
        fillDate.setDate(fillDate.getDate() + d);

        // Skip weekends
        if (fillDate.getDay() === 0 || fillDate.getDay() === 6) continue;

        let fillRow;
        if (fillMethod === 'forward') {
          fillRow = { ...data[i - 1], date: fillDate };
        } else if (fillMethod === 'backward') {
          fillRow = { ...data[i], date: fillDate };
        } else {
          // Interpolate
          const ratio = d / diffDays;
          fillRow = {
            date: fillDate,
            symbol: data[i].symbol,
            open: data[i - 1].open + (data[i].open - data[i - 1].open) * ratio,
            high: Math.max(data[i - 1].high, data[i].high),
            low: Math.min(data[i - 1].low, data[i].low),
            close: data[i - 1].close + (data[i].close - data[i - 1].close) * ratio,
            volume: 0,
            openInterest: data[i - 1].openInterest,
          };
        }

        filled.push(fillRow);
      }
    }

    filled.push(data[i]);
  }

  return filled;
}

/**
 * Convert data to database-ready format
 * @param {Array<Object>} data - Transformed data
 * @param {number} tickerId - Ticker ID for foreign key
 * @returns {Array<Object>} Database-ready records
 */
function toDatabaseFormat(data, tickerId) {
  return data.map(row => ({
    date: row.date,
    tickerId,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume || 0,
    openInterest: row.openInterest || 0,
  }));
}

/**
 * Batch data for efficient database insertion
 * @param {Array<Object>} data - Data to batch
 * @param {number} batchSize - Size of each batch
 * @returns {Array<Array>} Array of batches
 */
function batchData(data, batchSize = 1000) {
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  return batches;
}

module.exports = {
  parseDate,
  parseNumber,
  parseBoolean,
  transformRow,
  transformDataset,
  groupBySymbol,
  deduplicateByDate,
  fillMissingDates,
  toDatabaseFormat,
  batchData,
};
