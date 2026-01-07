/**
 * Data Validation Module
 * Validates CSV data and ensures data integrity
 */

/**
 * Required columns for different CSV types
 */
const REQUIRED_COLUMNS = {
  daily: ['date', 'open', 'high', 'low', 'close'],
  ohlcv: ['date', 'open', 'high', 'low', 'close', 'volume'],
  seasonality: ['date', 'symbol', 'open', 'high', 'low', 'close'],
};

/**
 * Optional columns that may be present
 */
const OPTIONAL_COLUMNS = [
  'ticker', 'symbol', 'volume', 'openinterest', 'oi', 'name',
  'weekday', 'returnpoints', 'returnpercentage',
];

/**
 * Column name normalization map
 */
const COLUMN_ALIASES = {
  'ticker': 'symbol',
  'oi': 'openInterest',
  'openinterest': 'openInterest',
  'vol': 'volume',
  'o': 'open',
  'h': 'high',
  'l': 'low',
  'c': 'close',
  'v': 'volume',
};

/**
 * Normalize column name to standard format
 * @param {string} columnName 
 * @returns {string}
 */
function normalizeColumnName(columnName) {
  const lower = columnName.toLowerCase().trim();
  return COLUMN_ALIASES[lower] || lower;
}

/**
 * Validate that required columns are present
 * @param {Array<string>} headers - CSV headers
 * @param {string} type - CSV type ('daily', 'ohlcv', 'seasonality')
 * @returns {Object} { valid, missingColumns, normalizedHeaders }
 */
function validateRequiredColumns(headers, type = 'daily') {
  const normalizedHeaders = headers.map(normalizeColumnName);
  const required = REQUIRED_COLUMNS[type] || REQUIRED_COLUMNS.daily;
  const missingColumns = required.filter(col => !normalizedHeaders.includes(col));

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    normalizedHeaders,
  };
}

/**
 * Validate a single data row
 * @param {Object} row - Data row object
 * @param {number} rowIndex - Row index for error reporting
 * @returns {Object} { valid, errors, warnings }
 */
function validateRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  // Validate date
  if (!row.date) {
    errors.push(`Row ${rowIndex}: Missing date`);
  } else {
    const date = new Date(row.date);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowIndex}: Invalid date format "${row.date}"`);
    }
  }

  // Validate OHLC values
  const ohlcFields = ['open', 'high', 'low', 'close'];
  for (const field of ohlcFields) {
    const value = parseFloat(row[field]);
    if (isNaN(value)) {
      errors.push(`Row ${rowIndex}: Invalid ${field} value "${row[field]}"`);
    } else if (value < 0) {
      warnings.push(`Row ${rowIndex}: Negative ${field} value ${value}`);
    }
  }

  // Validate OHLC logic
  const open = parseFloat(row.open);
  const high = parseFloat(row.high);
  const low = parseFloat(row.low);
  const close = parseFloat(row.close);

  if (!isNaN(high) && !isNaN(low) && high < low) {
    errors.push(`Row ${rowIndex}: High (${high}) is less than Low (${low})`);
  }

  if (!isNaN(open) && !isNaN(high) && open > high) {
    warnings.push(`Row ${rowIndex}: Open (${open}) is greater than High (${high})`);
  }

  if (!isNaN(open) && !isNaN(low) && open < low) {
    warnings.push(`Row ${rowIndex}: Open (${open}) is less than Low (${low})`);
  }

  if (!isNaN(close) && !isNaN(high) && close > high) {
    warnings.push(`Row ${rowIndex}: Close (${close}) is greater than High (${high})`);
  }

  if (!isNaN(close) && !isNaN(low) && close < low) {
    warnings.push(`Row ${rowIndex}: Close (${close}) is less than Low (${low})`);
  }

  // Validate volume if present
  if (row.volume !== undefined && row.volume !== null && row.volume !== '') {
    const volume = parseFloat(row.volume);
    if (isNaN(volume)) {
      warnings.push(`Row ${rowIndex}: Invalid volume value "${row.volume}"`);
    } else if (volume < 0) {
      warnings.push(`Row ${rowIndex}: Negative volume ${volume}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire dataset
 * @param {Array<Object>} data - Array of data rows
 * @returns {Object} { valid, totalErrors, totalWarnings, errorDetails, warningDetails }
 */
function validateDataset(data) {
  const allErrors = [];
  const allWarnings = [];
  let validRows = 0;
  let invalidRows = 0;

  for (let i = 0; i < data.length; i++) {
    const result = validateRow(data[i], i + 1);
    
    if (result.valid) {
      validRows++;
    } else {
      invalidRows++;
    }

    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    valid: invalidRows === 0,
    totalRows: data.length,
    validRows,
    invalidRows,
    totalErrors: allErrors.length,
    totalWarnings: allWarnings.length,
    errorDetails: allErrors.slice(0, 100), // Limit to first 100 errors
    warningDetails: allWarnings.slice(0, 100),
  };
}

/**
 * Check for duplicate dates in dataset
 * @param {Array<Object>} data - Array of data rows
 * @param {string} symbolField - Field name for symbol (optional)
 * @returns {Object} { hasDuplicates, duplicates }
 */
function checkDuplicateDates(data, symbolField = null) {
  const seen = new Map();
  const duplicates = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const dateStr = new Date(row.date).toISOString().split('T')[0];
    const symbol = symbolField ? row[symbolField] : 'default';
    const key = `${symbol}:${dateStr}`;

    if (seen.has(key)) {
      duplicates.push({
        date: dateStr,
        symbol,
        firstIndex: seen.get(key),
        duplicateIndex: i + 1,
      });
    } else {
      seen.set(key, i + 1);
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicateCount: duplicates.length,
    duplicates: duplicates.slice(0, 50), // Limit to first 50
  };
}

/**
 * Check for gaps in date sequence
 * @param {Array<Object>} data - Sorted array of data rows
 * @param {number} maxGapDays - Maximum allowed gap in days (default 5 for weekends)
 * @returns {Object} { hasGaps, gaps }
 */
function checkDateGaps(data, maxGapDays = 5) {
  const gaps = [];
  
  for (let i = 1; i < data.length; i++) {
    const prevDate = new Date(data[i - 1].date);
    const currDate = new Date(data[i].date);
    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays > maxGapDays) {
      gaps.push({
        fromDate: prevDate.toISOString().split('T')[0],
        toDate: currDate.toISOString().split('T')[0],
        gapDays: diffDays,
        index: i,
      });
    }
  }

  return {
    hasGaps: gaps.length > 0,
    gapCount: gaps.length,
    gaps: gaps.slice(0, 50),
  };
}

/**
 * Detect outliers in price data
 * @param {Array<Object>} data - Array of data rows
 * @param {number} threshold - Standard deviation threshold (default 3)
 * @returns {Object} { hasOutliers, outliers }
 */
function detectOutliers(data, threshold = 3) {
  const outliers = [];
  
  // Calculate returns
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    const prevClose = parseFloat(data[i - 1].close);
    const currClose = parseFloat(data[i].close);
    if (prevClose > 0) {
      returns.push({
        index: i,
        date: data[i].date,
        returnPct: ((currClose - prevClose) / prevClose) * 100,
      });
    }
  }

  if (returns.length === 0) {
    return { hasOutliers: false, outliers: [] };
  }

  // Calculate mean and standard deviation
  const mean = returns.reduce((sum, r) => sum + r.returnPct, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r.returnPct - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Find outliers
  for (const r of returns) {
    const zScore = Math.abs((r.returnPct - mean) / stdDev);
    if (zScore > threshold) {
      outliers.push({
        date: r.date,
        returnPct: parseFloat(r.returnPct.toFixed(2)),
        zScore: parseFloat(zScore.toFixed(2)),
        index: r.index,
      });
    }
  }

  return {
    hasOutliers: outliers.length > 0,
    outlierCount: outliers.length,
    outliers: outliers.slice(0, 50),
    statistics: {
      mean: parseFloat(mean.toFixed(4)),
      stdDev: parseFloat(stdDev.toFixed(4)),
      threshold,
    },
  };
}

/**
 * Comprehensive data quality check
 * @param {Array<Object>} data - Array of data rows
 * @param {Object} options - Validation options
 * @returns {Object} Complete validation report
 */
function runDataQualityCheck(data, options = {}) {
  const {
    symbolField = null,
    maxGapDays = 5,
    outlierThreshold = 3,
  } = options;

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  const validation = validateDataset(sortedData);
  const duplicates = checkDuplicateDates(sortedData, symbolField);
  const gaps = checkDateGaps(sortedData, maxGapDays);
  const outliers = detectOutliers(sortedData, outlierThreshold);

  const overallValid = validation.valid && !duplicates.hasDuplicates;

  return {
    overallValid,
    summary: {
      totalRows: data.length,
      validRows: validation.validRows,
      invalidRows: validation.invalidRows,
      duplicateCount: duplicates.duplicateCount,
      gapCount: gaps.gapCount,
      outlierCount: outliers.outlierCount,
    },
    validation,
    duplicates,
    gaps,
    outliers,
    dateRange: sortedData.length > 0 ? {
      start: new Date(sortedData[0].date).toISOString().split('T')[0],
      end: new Date(sortedData[sortedData.length - 1].date).toISOString().split('T')[0],
    } : null,
  };
}

module.exports = {
  REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS,
  COLUMN_ALIASES,
  normalizeColumnName,
  validateRequiredColumns,
  validateRow,
  validateDataset,
  checkDuplicateDates,
  checkDateGaps,
  detectOutliers,
  runDataQualityCheck,
};
