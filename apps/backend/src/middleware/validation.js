/**
 * Input Validation Middleware
 * Zod-based validation schemas and middleware
 */
const { z } = require('zod');
const { ValidationError } = require('../utils/errors');

// =====================================================
// COMMON SCHEMAS
// =====================================================

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// =====================================================
// ANALYSIS FILTER SCHEMAS (Replicating old Python system)
// =====================================================

const yearFiltersSchema = z.object({
  positiveNegativeYears: z.enum(['All', 'Positive', 'Negative']).default('All'),
  evenOddYears: z.enum(['All', 'Even', 'Odd', 'Leap', 'Election']).default('All'),
  decadeYears: z.array(z.number().int().min(1).max(10)).default([1,2,3,4,5,6,7,8,9,10]),
  specificYears: z.array(z.number().int().min(1900).max(2100)).optional(),
});

const monthFiltersSchema = z.object({
  positiveNegativeMonths: z.enum(['All', 'Positive', 'Negative']).default('All'),
  evenOddMonths: z.enum(['All', 'Even', 'Odd']).default('All'),
  specificMonth: z.number().int().min(0).max(12).default(0), // 0 = all months
});

const weekFiltersSchema = z.object({
  weekType: z.enum(['monday', 'expiry']).default('monday'),
  positiveNegativeWeeks: z.enum(['All', 'Positive', 'Negative']).default('All'),
  evenOddWeeksMonthly: z.enum(['All', 'Even', 'Odd']).default('All'),
  evenOddWeeksYearly: z.enum(['All', 'Even', 'Odd']).default('All'),
  specificWeekMonthly: z.number().int().min(0).max(5).default(0), // 0 = all weeks
});

const dayFiltersSchema = z.object({
  positiveNegativeDays: z.enum(['All', 'Positive', 'Negative']).default('All'),
  weekdays: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  evenOddCalendarDaysMonthly: z.enum(['All', 'Even', 'Odd']).default('All'),
  evenOddCalendarDaysYearly: z.enum(['All', 'Even', 'Odd']).default('All'),
  evenOddTradingDaysMonthly: z.enum(['All', 'Even', 'Odd']).default('All'),
  evenOddTradingDaysYearly: z.enum(['All', 'Even', 'Odd']).default('All'),
});

const outlierFiltersSchema = z.object({
  dailyPercentageRange: z.object({
    enabled: z.boolean().default(false),
    min: z.number().default(-5),
    max: z.number().default(5),
  }).optional(),
  weeklyPercentageRange: z.object({
    enabled: z.boolean().default(false),
    min: z.number().default(-15),
    max: z.number().default(15),
  }).optional(),
  monthlyPercentageRange: z.object({
    enabled: z.boolean().default(false),
    min: z.number().default(-25),
    max: z.number().default(25),
  }).optional(),
  yearlyPercentageRange: z.object({
    enabled: z.boolean().default(false),
    min: z.number().default(-50),
    max: z.number().default(50),
  }).optional(),
});

// Combined filters schema
const analysisFiltersSchema = z.object({
  yearFilters: yearFiltersSchema.optional(),
  monthFilters: monthFiltersSchema.optional(),
  weekFilters: weekFiltersSchema.optional(),
  dayFilters: dayFiltersSchema.optional(),
  outlierFilters: outlierFiltersSchema.optional(),
});

// =====================================================
// API REQUEST SCHEMAS
// =====================================================

const analysisRequestSchema = z.object({
  symbols: z.array(z.string().min(1).max(50)).min(1).max(50),
  startDate: dateSchema,
  endDate: dateSchema,
  lastNDays: z.number().int().min(0).optional(), // 0 = use date range
  filters: analysisFiltersSchema.optional(),
  chartScale: z.enum(['linear', 'log']).default('linear'),
});

const dailyAnalysisSchema = analysisRequestSchema.extend({
  aggregateType: z.enum(['total', 'avg', 'max', 'min']).optional(),
  aggregateField: z.enum(['TradingMonthDay', 'TradingYearDay', 'CalendarMonthDay', 'CalendarYearDay', 'Weekday']).optional(),
  electionYearType: z.enum(['All', 'Election', 'PreElection', 'PostElection', 'MidElection', 'Modi', 'Current']).optional(),
});

const weeklyAnalysisSchema = analysisRequestSchema.extend({
  weekType: z.enum(['monday', 'expiry']).default('monday'),
  aggregateType: z.enum(['total', 'avg', 'max', 'min']).optional(),
  aggregateField: z.enum(['WeekNumberMonthly', 'WeekNumberYearly']).optional(),
});

const monthlyAnalysisSchema = analysisRequestSchema.extend({
  aggregateType: z.enum(['total', 'avg', 'max', 'min']).optional(),
});

const yearlyAnalysisSchema = analysisRequestSchema.extend({
  overlayType: z.enum(['CalendarDays', 'TradingDays']).default('CalendarDays'),
});

const scannerRequestSchema = z.object({
  symbols: z.array(z.string()).optional(), // Empty = all symbols
  startDate: dateSchema,
  endDate: dateSchema,
  filters: z.object({
    evenOddYears: z.enum(['All', 'Even', 'Odd', 'Leap']).default('All'),
    specificMonth: z.number().int().min(0).max(12).default(0),
    specificExpiryWeek: z.number().int().min(0).max(5).default(0),
    specificMondayWeek: z.number().int().min(0).max(5).default(0),
  }).optional(),
  trendType: z.enum(['Bullish', 'Bearish']).default('Bullish'),
  consecutiveDays: z.number().int().min(2).max(10).default(3),
  criteria: z.object({
    minAccuracy: z.number().min(0).max(100).default(60),
    minTotalPnl: z.number().min(0).default(1.5),
    minSampleSize: z.number().int().min(0).default(50),
    minAvgPnl: z.number().min(0).default(0.2),
    operations: z.object({
      op12: z.enum(['AND', 'OR']).default('OR'),
      op23: z.enum(['AND', 'OR']).default('OR'),
      op34: z.enum(['AND', 'OR']).default('OR'),
    }).optional(),
  }).optional(),
});

const scenarioRequestSchema = z.object({
  symbol: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  entryType: z.enum(['Open', 'Close']).default('Close'),
  exitType: z.enum(['Open', 'Close']).default('Close'),
  tradeType: z.enum(['Long', 'Short']).default('Long'),
  entryDay: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  exitDay: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  returnType: z.enum(['Percent', 'Points']).default('Percent'),
});

// =====================================================
// AUTH SCHEMAS
// =====================================================

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// =====================================================
// VALIDATION MIDDLEWARE
// =====================================================

/**
 * Create validation middleware for a schema
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'query' ? req.query : 
                   source === 'params' ? req.params : req.body;
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      
      // Replace with validated data
      if (source === 'body') req.body = result.data;
      else if (source === 'query') req.query = result.data;
      else if (source === 'params') req.params = result.data;
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  // Schemas
  analysisRequestSchema,
  dailyAnalysisSchema,
  weeklyAnalysisSchema,
  monthlyAnalysisSchema,
  yearlyAnalysisSchema,
  scannerRequestSchema,
  scenarioRequestSchema,
  registerSchema,
  loginSchema,
  paginationSchema,
  analysisFiltersSchema,
  // Middleware
  validate,
};
