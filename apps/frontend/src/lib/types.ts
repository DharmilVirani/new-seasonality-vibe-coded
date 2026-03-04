// Filter Configuration Types
export interface FilterConfig {
  yearFilters?: YearFilters;
  monthFilters?: MonthFilters;
  weekFilters?: WeekFilters;
  dayFilters?: DayFilters;
  outlierFilters?: OutlierFilters;
  specialDaysFilters?: SpecialDaysFilters;
  superimposedChartType?: 'CalendarYearDays' | 'TradingYearDays' | 'CalendarMonthDays' | 'TradingMonthDays' | 'Weekdays';
  weeklySuperimposedChartType?: 'YearlyWeeks' | 'MonthlyWeeks';
  electionChartTypes?: string[];
}

export interface YearFilters {
  positiveNegativeYears?: 'All' | 'Positive' | 'Negative';
  evenOddYears?: 'All' | 'Even' | 'Odd' | 'Leap' | 'Election';
  decadeYears?: number[];
  specificYears?: number[];
}

export interface MonthFilters {
  positiveNegativeMonths?: 'All' | 'Positive' | 'Negative';
  evenOddMonths?: 'All' | 'Even' | 'Odd';
  specificMonth?: number;
}

export interface WeekFilters {
  weekType?: 'monday' | 'expiry';
  positiveNegativeWeeks?: 'All' | 'Positive' | 'Negative';
  evenOddWeeksMonthly?: 'All' | 'Even' | 'Odd';
  evenOddWeeksYearly?: 'All' | 'Even' | 'Odd';
  specificWeekMonthly?: number;
}

export interface DayFilters {
  positiveNegativeDays?: 'All' | 'Positive' | 'Negative';
  weekdays?: string[];
  evenOddCalendarDaysMonthly?: 'All' | 'Even' | 'Odd';
  evenOddCalendarDaysYearly?: 'All' | 'Even' | 'Odd';
  evenOddTradingDaysMonthly?: 'All' | 'Even' | 'Odd';
  evenOddTradingDaysYearly?: 'All' | 'Even' | 'Odd';
}

export interface OutlierFilters {
  dailyPercentageRange?: { enabled: boolean; min: number; max: number };
  weeklyPercentageRange?: { enabled: boolean; min: number; max: number };
  monthlyPercentageRange?: { enabled: boolean; min: number; max: number };
  yearlyPercentageRange?: { enabled: boolean; min: number; max: number };
}

export interface SpecialDaysFilters {
  selectedDays?: string[]; // Array of special day names to filter by
}

// Analysis Response Types
export interface AnalysisResponse<T> {
  success: boolean;
  processingTime: number;
  data: T;
}

export interface SymbolData {
  symbol: string;
  data: DailyRecord[];
  statistics: Statistics;
  maxConsecutive: { maxPositive: number; maxNegative: number };
  dataTable: DataTableRow[];
}

export interface DailyRecord {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  returnPercentage: number;
  returnPoints: number;
}

export interface Statistics {
  allCount: number;
  avgReturnAll: number;
  sumReturnAll: number;
  posCount: number;
  posAccuracy: number;
  negCount: number;
  negAccuracy: number;
}

export interface DataTableRow {
  field: string;
  value: string | number;
  [key: string]: string | number;
}

// Symbol Types
export interface Symbol {
  symbol: string;
  name: string | null;
  sector: string | null;
  exchange: string | null;
  totalRecords: number;
  dateRange: {
    first: string | null;
    last: string | null;
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'research' | 'trial';
  subscriptionTier: 'trial' | 'basic' | 'premium' | 'enterprise';
  subscriptionExpiry: string | null;
}

// Scenario Types
export interface ScenarioParams {
  symbol: string;
  startDate: string;
  endDate: string;
  entryType: 'Open' | 'Close';
  exitType: 'Open' | 'Close';
  tradeType: 'Long' | 'Short';
  entryDay: string;
  exitDay: string;
  returnType: 'Percent' | 'Points';
}

// Scanner Types
export interface ScannerParams {
  symbols?: string[];
  startDate: string;
  endDate: string;
  filters?: FilterConfig;
  trendType: 'Bullish' | 'Bearish';
  consecutiveDays: number;
  criteria: ScannerCriteria;
  responseMode?: 'full' | 'summary';
  maxRows?: number;
}

export interface ScannerCriteria {
  minAccuracy?: number;
  minTotalPnl?: number;
  minSampleSize?: number;
  minAvgPnl?: number;
  operations?: {
    op12?: 'AND' | 'OR';
    op23?: 'AND' | 'OR';
    op34?: 'AND' | 'OR';
  };
}

// Backtest Types
export interface BacktestParams {
  symbol: string;
  startDate: string;
  endDate: string;
  entryConditions?: Record<string, unknown>;
  exitConditions?: Record<string, unknown>;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
}

// Phenomena Backtest Types
export interface BacktestPhenomenaParams {
  symbol: string;
  startDate: string;
  endDate: string;
  evenOddYears?: 'All' | 'Even' | 'Odd' | 'Leap';
  specificMonth?: number | null;
  specificExpiryWeek?: number | null;
  specificMondayWeek?: number | null;
  initialCapital?: number;
  riskFreeRate?: number;
  tradeType?: 'longTrades' | 'shortTrades';
  brokerage?: number;
  phenomenaDaysStart?: number;
  phenomenaDaysEnd?: number;
  queryWeekdays?: string[];
  queryTradingDays?: number[];
  queryCalendarDays?: number[];
  heatmapType?: 'TradingMonthDaysVsWeekdays' | 'CalenderMonthDaysVsWeekdays';
  showAnnotation?: boolean;
  inSampleStart?: string;
  inSampleEnd?: string;
  outSampleStart?: string;
  outSampleEnd?: string;
  walkForwardType?: string;
  walkForwardSymbols?: string[];
  includeTradeList?: boolean;
  maxRows?: number;
  responseMode?: 'full' | 'summary' | 'chartOnly';
}

// Phenomena Types
export interface PhenomenaParams {
  symbol: string;
  startDate: string;
  endDate: string;
  phenomenaType?: 'consecutive' | 'reversal' | 'breakout';
  threshold?: number;
  percentChange?: number;
}

// Basket Types
export interface BasketParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  weights?: Record<string, number>;
}

export interface BasketGroup {
  id: number;
  name: string;
  description?: string | null;
  symbolCount: number;
  symbols: string[];
  isSystem: boolean;
  isOwner: boolean;
}

export interface BasketCalendarParams {
  basketGroupId?: number;
  basketGroup?: string;
  startDate: string;
  endDate: string;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  calendarDay: number;
  holdingPeriod: number;
  trendType: 'Any' | 'Bullish' | 'Bearish';
  riskFreeInterestRate: number;
  topRanks: number;
  sortFirstBy: 'AvgPnl' | 'WinnerPct';
}

export interface BasketTradingParams {
  basketGroupId?: number;
  basketGroup?: string;
  startDate: string;
  endDate: string;
  month: 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun' | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';
  tradingDay: number;
  holdingPeriod: number;
  trendType: 'Any' | 'Bullish' | 'Bearish';
  riskFreeInterestRate: number;
  topRanks: number;
  sortFirstBy: 'AvgPnl' | 'WinnerPct';
}

export interface BasketBestMonthlyParams {
  basketGroupId?: number;
  basketGroup?: string;
  startDate: string;
  endDate: string;
  monthName: 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC';
  rankType: 'Bullish' | 'Bearish';
  intervalGapRange: number;
  totalReturns: number;
}

export interface BasketGroupCreateParams {
  name: string;
  description?: string | null;
  symbols: string[];
}

export interface BasketGroupUpdateParams {
  name?: string;
  description?: string | null;
  symbols?: string[];
}

// Chart Types
export interface ChartParams {
  symbol: string;
  startDate: string;
  endDate: string;
  chartType?: 'candlestick' | 'line' | 'bar';
}
