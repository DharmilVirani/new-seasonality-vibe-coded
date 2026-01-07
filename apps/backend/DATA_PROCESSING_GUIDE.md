# Data Processing Pipeline Guide

Complete documentation for the Seasonality SaaS data processing pipeline.

## Overview

The data processing pipeline replicates the Python `GenerateFiles.py` logic in Node.js, calculating 40+ derived fields for seasonality analysis. It handles CSV uploads, data validation, financial calculations, and background job processing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Processing Pipeline                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  CSV Upload  │───▶│  Validators  │───▶│ Transformers │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                 │                │
│                                                 ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Database   │◀───│ Calculations │◀───│ CSV Processor│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Background Job Processors                │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │       │
│  │  │CSV Jobs │ │Derived  │ │Cache    │ │Cleanup  │    │       │
│  │  │         │ │Fields   │ │Refresh  │ │Jobs     │    │       │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CSV Processor (`csvProcessor.js`)

Main entry point for processing uploaded CSV files.

```javascript
const { createProcessor } = require('./processing');

// Create processor with options
const processor = createProcessor({
  batchSize: 1000,        // Records per batch insert
  skipInvalid: true,      // Skip invalid rows
  calculateDerived: true, // Calculate all derived fields
  validateData: true,     // Run data quality checks
});

// Process a file
const result = await processor.processUploadedFile(
  fileBuffer,
  'NIFTY_daily.csv',
  { defaultSymbol: 'NIFTY' }
);

console.log(result);
// {
//   success: true,
//   fileName: 'NIFTY_daily.csv',
//   processingTime: 1234,
//   stats: {
//     totalRows: 5000,
//     processedRows: 4998,
//     skippedRows: 2,
//     insertedRows: 4500,
//     updatedRows: 498,
//     errors: [],
//     warnings: []
//   }
// }
```

### 2. Calculations (`calculations.js`)

Replicates all Python pandas calculations for 40+ derived fields.

#### Daily Fields
- `calendarMonthDay` - Day of month (1-31)
- `calendarYearDay` - Day of year (1-366)
- `tradingMonthDay` - Trading day within month
- `tradingYearDay` - Trading day within year
- `returnPoints` - Close - Previous Close
- `returnPercentage` - Return as percentage
- `positiveDay` - Boolean: return > 0
- `evenCalendarMonthDay`, `evenCalendarYearDay`
- `evenTradingMonthDay`, `evenTradingYearDay`

#### Weekly Fields (Monday & Expiry)
- `mondayWeekNumberMonthly` - Week number within month
- `mondayWeekNumberYearly` - Week number within year
- `mondayWeeklyReturnPoints`, `mondayWeeklyReturnPercentage`
- `positiveMondayWeek`
- Same fields for Expiry (Thursday) weeks

#### Monthly Fields
- `evenMonth` - Boolean: month % 2 == 0
- `monthlyReturnPoints`, `monthlyReturnPercentage`
- `positiveMonth`

#### Yearly Fields
- `evenYear` - Boolean: year % 2 == 0
- `yearlyReturnPoints`, `yearlyReturnPercentage`
- `positiveYear`

```javascript
const { calculateAllDerivedFields } = require('./processing');

// Calculate all derived fields from raw OHLCV data
const rawData = [
  { date: '2024-01-02', open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  { date: '2024-01-03', open: 104, high: 108, low: 103, close: 107, volume: 1200 },
  // ... more data
];

const calculated = calculateAllDerivedFields(rawData);

console.log(calculated);
// {
//   daily: [...],        // Daily data with all derived fields
//   mondayWeekly: [...], // Monday-based weekly aggregations
//   expiryWeekly: [...], // Thursday-based weekly aggregations
//   monthly: [...],      // Monthly aggregations
//   yearly: [...]        // Yearly aggregations
// }
```

### 3. Filter Engine (`filterEngine.js`)

Implements all 40+ filter combinations from the old Python system.

```javascript
const { createFilterEngine, applyFilters } = require('./processing');

// Method 1: Fluent API
const engine = createFilterEngine(data);
const filtered = engine
  .filterByDateRange({ startDate: '2020-01-01', endDate: '2024-12-31' })
  .applyYearFilters({ evenOdd: 'Even', positiveNegative: 'Positive' })
  .applyMonthFilters({ specificMonth: 1 }) // January only
  .applyDayFilters({ weekdays: ['Monday', 'Tuesday'] })
  .getData();

// Method 2: Config object
const filterConfig = {
  dateRange: { startDate: '2020-01-01', endDate: '2024-12-31' },
  yearFilters: {
    evenOdd: 'Even',           // 'All', 'Even', 'Odd', 'Leap', 'Election'
    positiveNegative: 'All',   // 'All', 'Positive', 'Negative'
    decadeYears: [1, 2, 3],    // Last digit of year
    specificYears: [2020, 2022, 2024],
  },
  monthFilters: {
    evenOdd: 'All',
    positiveNegative: 'Positive',
    specificMonth: 0,          // 0 = all, 1-12 = specific month
  },
  expiryWeekFilters: {
    positiveNegative: 'All',
    evenOddMonthly: 'All',
    specificWeekMonthly: 0,    // 0 = all, 1-5 = specific week
    evenOddYearly: 'All',
  },
  mondayWeekFilters: {
    // Same structure as expiryWeekFilters
  },
  dayFilters: {
    positiveNegative: 'All',
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    evenOddCalendarMonthly: 'All',
    evenOddCalendarYearly: 'All',
    evenOddTradingMonthly: 'All',
    evenOddTradingYearly: 'All',
    specificTradingDays: [],
    specificCalendarDays: [],
  },
  outlierFilters: {
    daily: { enabled: true, min: -10, max: 10 },
    mondayWeekly: { enabled: false, min: -15, max: 15 },
    expiryWeekly: { enabled: false, min: -15, max: 15 },
    monthly: { enabled: false, min: -20, max: 20 },
    yearly: { enabled: false, min: -50, max: 50 },
  },
  electionYearType: 'All', // 'All', 'Election', 'PreElection', 'PostElection', 'MidElection', 'Modi'
};

const result = applyFilters(data, filterConfig);
```

### 4. Validators (`validators.js`)

Data validation utilities for ensuring data quality.

```javascript
const { 
  validateRequiredColumns, 
  validateDataset, 
  runDataQualityCheck 
} = require('./processing');

// Validate CSV columns
const columnCheck = validateRequiredColumns(headers, 'daily');
// { valid: true, missingColumns: [], normalizedHeaders: [...] }

// Validate entire dataset
const datasetCheck = validateDataset(data);
// {
//   valid: true,
//   totalRows: 5000,
//   validRows: 4998,
//   invalidRows: 2,
//   totalErrors: 2,
//   totalWarnings: 5,
//   errorDetails: [...],
//   warningDetails: [...]
// }

// Comprehensive quality check
const qualityReport = runDataQualityCheck(data, {
  symbolField: 'symbol',
  maxGapDays: 5,
  outlierThreshold: 3,
});
// {
//   overallValid: true,
//   summary: { totalRows, validRows, duplicateCount, gapCount, outlierCount },
//   validation: {...},
//   duplicates: {...},
//   gaps: {...},
//   outliers: {...},
//   dateRange: { start, end }
// }
```

### 5. Transformers (`transformers.js`)

Data transformation functions for normalizing CSV data.

```javascript
const { 
  transformDataset, 
  groupBySymbol, 
  deduplicateByDate,
  toDatabaseFormat 
} = require('./processing');

// Transform raw CSV data
const transformed = transformDataset(rawData, headers, {
  skipInvalid: true,
  defaultSymbol: 'NIFTY',
});

// Group by symbol
const symbolGroups = groupBySymbol(transformed.data);
// Map { 'NIFTY' => [...], 'BANKNIFTY' => [...] }

// Remove duplicate dates
const deduped = deduplicateByDate(data);

// Convert to database format
const dbRecords = toDatabaseFormat(data, tickerId);
```

### 6. Job Processors (`jobProcessors.js`)

BullMQ background job handlers for heavy processing.

```javascript
const { 
  startWorkers,
  addCSVProcessingJob,
  addDerivedFieldsJob,
  addCacheRefreshJob,
  QUEUE_NAMES 
} = require('./processing');

// Start all workers (typically in worker.js)
const workers = startWorkers();

// Add jobs to queues
await addCSVProcessingJob({
  batchId: 'batch-123',
  fileId: 'file-456',
  objectKey: 'uploads/NIFTY_daily.csv',
  options: { calculateDerived: true },
});

await addDerivedFieldsJob({
  tickerId: 1,
  symbol: 'NIFTY',
  forceRecalculate: false,
});

await addCacheRefreshJob({
  symbol: 'NIFTY',
  analysisTypes: ['daily', 'weekly', 'monthly'],
});
```

## CSV File Format

### Required Columns
- `date` - Date in format DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY
- `open` - Opening price
- `high` - High price
- `low` - Low price
- `close` - Closing price

### Optional Columns
- `symbol` / `ticker` - Symbol name
- `volume` / `vol` - Trading volume
- `openinterest` / `oi` - Open interest

### Example CSV
```csv
Date,Symbol,Open,High,Low,Close,Volume,OpenInterest
02-01-2024,NIFTY,21700.50,21850.00,21650.25,21800.75,125000000,0
03-01-2024,NIFTY,21800.75,21950.00,21750.00,21900.50,130000000,0
```

## API Endpoints

### Upload CSV Files
```http
POST /api/upload/csv
Content-Type: multipart/form-data

files: [file1.csv, file2.csv]
options: { "calculateDerived": true }
```

### Check Upload Status
```http
GET /api/upload/batch/:batchId
```

### Get Processing Progress
```http
GET /api/upload/batch/:batchId/progress
```

## Performance Optimization

### Batch Processing
- Default batch size: 1000 records
- Configurable via `batchSize` option
- Uses database transactions for atomicity

### Memory Management
- Streams large files instead of loading entirely
- Processes in batches to limit memory usage
- Garbage collection friendly

### Concurrency
- CSV processing: 2 concurrent jobs
- Derived fields: 3 concurrent jobs
- Cache refresh: 10 concurrent jobs

### Caching
- Calculated results cached in Redis
- 1-hour default TTL
- Pattern-based cache invalidation

## Error Handling

### Validation Errors
```javascript
{
  success: false,
  error: 'Missing required columns: date, close',
  stats: {
    totalRows: 0,
    processedRows: 0,
    errors: [{ row: 0, error: 'Missing required columns' }]
  }
}
```

### Processing Errors
```javascript
{
  success: false,
  error: 'Invalid date format at row 150',
  stats: {
    totalRows: 5000,
    processedRows: 149,
    skippedRows: 1,
    errors: [{ row: 150, error: 'Invalid date format "invalid-date"' }]
  }
}
```

## Python to JavaScript Mapping

| Python (pandas) | JavaScript |
|-----------------|------------|
| `df.resample('W-SUN')` | `groupByMondayWeek()` |
| `df.resample('W-THU')` | `groupByExpiryWeek()` |
| `df.resample('M')` | `groupByMonth()` |
| `df.resample('Y')` | `groupByYear()` |
| `df['Close'].shift(1)` | Previous record in sorted array |
| `df.apply(lambda)` | `array.map()` |
| `df.groupby()` | `Map` with grouping logic |

## Testing

### Unit Tests
```bash
npm run test:processing
```

### Integration Tests
```bash
npm run test:integration
```

### Accuracy Validation
Compare output with Python system:
```bash
npm run validate:calculations -- --symbol NIFTY --compare ./python_output/
```

## Troubleshooting

### Common Issues

1. **Date parsing errors**
   - Ensure dates are in supported format
   - Check for timezone issues

2. **Memory issues with large files**
   - Reduce batch size
   - Process files sequentially

3. **Calculation mismatches**
   - Verify data is sorted by date
   - Check for duplicate dates

4. **Job queue backlog**
   - Increase worker concurrency
   - Check Redis connection

### Debug Mode
```javascript
const processor = createProcessor({
  debug: true,
  logLevel: 'verbose',
});
```

## Migration from Python

1. Export existing data from Python system
2. Validate CSV format matches requirements
3. Run test import with small dataset
4. Compare calculations with Python output
5. Full migration with progress monitoring
