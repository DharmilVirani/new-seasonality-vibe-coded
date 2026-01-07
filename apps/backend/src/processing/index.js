/**
 * Data Processing Pipeline - Main Export
 * 
 * This module exports all data processing components for the Seasonality SaaS.
 * Replicates the Python GenerateFiles.py logic in Node.js with optimizations.
 * 
 * Components:
 * - calculations: Financial calculations (40+ derived fields)
 * - validators: Data validation utilities
 * - transformers: Data transformation functions
 * - csvProcessor: Main CSV processing class
 * - filterEngine: Advanced 40+ filter engine
 * - jobProcessors: BullMQ background job handlers
 */

// Core calculation functions
const calculations = require('./calculations');

// Data validation utilities
const validators = require('./validators');

// Data transformation functions
const transformers = require('./transformers');

// CSV processing class
const { CSVProcessor, createProcessor, parseCSV, parseCSVLine } = require('./csvProcessor');

// Filter engine
const { FilterEngine, createFilterEngine, applyFilters, ELECTION_YEARS, MODI_YEARS } = require('./filterEngine');

// Background job processors
const jobProcessors = require('./jobProcessors');

module.exports = {
  // Calculations
  calculations,
  calculateAllDerivedFields: calculations.calculateAllDerivedFields,
  calculateReturns: calculations.calculateReturns,
  groupByMondayWeek: calculations.groupByMondayWeek,
  groupByExpiryWeek: calculations.groupByExpiryWeek,
  groupByMonth: calculations.groupByMonth,
  groupByYear: calculations.groupByYear,
  
  // Validators
  validators,
  validateRequiredColumns: validators.validateRequiredColumns,
  validateDataset: validators.validateDataset,
  runDataQualityCheck: validators.runDataQualityCheck,
  
  // Transformers
  transformers,
  transformDataset: transformers.transformDataset,
  groupBySymbol: transformers.groupBySymbol,
  toDatabaseFormat: transformers.toDatabaseFormat,
  
  // CSV Processor
  CSVProcessor,
  createProcessor,
  parseCSV,
  parseCSVLine,
  
  // Filter Engine
  FilterEngine,
  createFilterEngine,
  applyFilters,
  ELECTION_YEARS,
  MODI_YEARS,
  
  // Job Processors
  jobProcessors,
  startWorkers: jobProcessors.startWorkers,
  addCSVProcessingJob: jobProcessors.addCSVProcessingJob,
  addDerivedFieldsJob: jobProcessors.addDerivedFieldsJob,
  addCacheRefreshJob: jobProcessors.addCacheRefreshJob,
  addBatchAnalysisJob: jobProcessors.addBatchAnalysisJob,
  QUEUE_NAMES: jobProcessors.QUEUE_NAMES,
};
