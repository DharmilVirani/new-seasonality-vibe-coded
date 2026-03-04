import axios, { AxiosError, AxiosInstance } from 'axios';

// API base URL - append /api if it's a full URL
const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE_URL = baseUrl.startsWith('http') ? `${baseUrl}/api` : '/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // Increased to 120 seconds for slow backend responses
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect for /auth/me - let checkAuth handle it
      const isAuthMeRequest = error.config?.url?.includes('/auth/me');

      if (!isAuthMeRequest && typeof window !== 'undefined') {
        // Token expired - redirect to login for other requests
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }, { timeout: 15000 }),
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data, { timeout: 15000 }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Analysis API
export const analysisApi = {
  // Symbols
  getSymbols: () => api.get('/analysis/symbols'),
  getSymbol: (symbol: string) => api.get(`/analysis/symbols/${symbol}`),

  // Daily Analysis
  daily: (params: DailyAnalysisParams) => api.post('/analysis/daily', params),
  dailyAggregate: (params: DailyAnalysisParams) =>
    api.post('/analysis/daily/aggregate', params),

  // Weekly Analysis
  weekly: (params: WeeklyAnalysisParams) => api.post('/analysis/weekly', params),

  // Monthly Analysis
  monthly: (params: MonthlyAnalysisParams) => api.post('/analysis/monthly', params),

  // Yearly Analysis
  yearly: (params: YearlyAnalysisParams) => api.post('/analysis/yearly', params),

  // Scenario Analysis
  scenario: (params: ScenarioParams) => api.post('/analysis/scenario', params),

  // Election Analysis
  election: (params: DailyAnalysisParams) => api.post('/analysis/election', params),

  // Scanner
  scanner: (params: ScannerParams) => api.post('/analysis/scanner', params),

  // Backtester
  backtest: (params: BacktestParams) => api.post('/analysis/backtest', params),

  // Phenomena Backtester
  backtestPhenomena: (params: BacktestPhenomenaParams) => api.post('/analysis/backtest/phenomena', params),

  // Phenomena
  phenomena: (params: PhenomenaParams) => api.post('/analysis/phenomena', params),

  // Basket
  getBasketGroups: () => api.get('/analysis/basket/groups'),
  createBasketGroup: (params: BasketGroupCreateParams) => api.post('/analysis/basket/groups', params),
  updateBasketGroup: (id: number, params: BasketGroupUpdateParams) => api.patch(`/analysis/basket/groups/${id}`, params),
  deleteBasketGroup: (id: number) => api.delete(`/analysis/basket/groups/${id}`),
  basketCalendarDay: (params: BasketCalendarParams) => api.post('/analysis/basket/calendar-day', params),
  basketTradingDay: (params: BasketTradingParams) => api.post('/analysis/basket/trading-day', params),
  basketBestMonthlyReturns: (params: BasketBestMonthlyParams) => api.post('/analysis/basket/best-monthly-returns', params),

  // Chart Data
  chart: (params: ChartParams) => api.post('/analysis/chart', params),

  // Event Analysis
  events: (params: EventAnalysisParams) => {
    // Transform frontend params to backend format
    const backendParams = {
      symbol: params.symbol,
      eventNames: params.eventName ? [params.eventName] : undefined,
      eventCategories: params.eventCategory ? [params.eventCategory] : undefined,
      country: params.country || 'INDIA',
      startDate: params.startDate,
      endDate: params.endDate,
      windowConfig: {
        daysBefore: params.windowBefore || 10,
        daysAfter: params.windowAfter || 10,
        includeEventDay: true
      },
      tradeConfig: {
        entryType: params.entryPoint || 'T-1_CLOSE',
        daysAfter: params.windowAfter || 10
      },
      filters: {
        minOccurrences: params.minOccurrences || 3
      }
    };
    return api.post('/analysis/events', backendParams);
  },
  eventCategories: () => api.get('/analysis/events/categories'),
  eventNames: (params?: { category?: string; country?: string }) =>
    api.get('/analysis/events/names', { params }),
  eventOccurrences: (name: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/analysis/events/occurrences/${encodeURIComponent(name)}`, { params }),
  eventCompare: (params: EventCompareParams) => api.post('/analysis/events/compare', params),
};

// Upload API
export const uploadApi = {
  // Standard batch upload
  createBatch: (formData: FormData) =>
    api.post('/upload/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listBatches: () => api.get('/upload/batches'),
  getBatch: (batchId: string) => api.get(`/upload/batches/${batchId}`),
  processBatch: (batchId: string) => api.post(`/upload/batches/${batchId}/process`),
  deleteBatch: (batchId: string) => api.delete(`/upload/batches/${batchId}`),

  // Bulk upload (for large file batches)
  getPresignedUrls: (files: { name: string; size: number }[]) =>
    api.post('/upload/bulk/presign', { files }),
  processBulk: (batchId: string, objectKeys: string[], fileNames: string[]) =>
    api.post('/upload/bulk/process', { batchId, objectKeys, fileNames }),
  getBulkStatus: (batchId: string) => api.get(`/upload/bulk/${batchId}/status`),
  retryBulk: (batchId: string) => api.post(`/upload/bulk/${batchId}/retry`),

  // Stats
  getStats: () => api.get('/upload/stats'),
};

export default api;

// Types
export interface DailyAnalysisParams {
  symbol: string;  // Single symbol for backend
  symbols?: string[];  // Keep for backward compatibility
  startDate: string;
  endDate: string;
  lastNDays?: number;
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
  aggregateType?: string;
  aggregateField?: string;
}

export interface WeeklyAnalysisParams {
  symbol: string;  // Single symbol for backend
  symbols?: string[];  // Keep for backward compatibility
  startDate: string;
  endDate: string;
  weekType: 'monday' | 'expiry';
  lastNDays?: number;
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
}

export interface MonthlyAnalysisParams {
  symbol: string;  // Single symbol for backend
  symbols?: string[];  // Keep for backward compatibility
  startDate: string;
  endDate: string;
  lastNDays?: number;
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
  aggregateType?: 'total' | 'average';
  monthType?: 'calendar' | 'expiry';
}

export interface YearlyAnalysisParams {
  symbol: string;  // Single symbol for backend
  symbols?: string[];  // Keep for backward compatibility
  startDate: string;
  endDate: string;
  yearType?: 'calendar' | 'expiry';
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
  overlayType?: 'CalendarDays' | 'TradingDays';
}

export interface ScenarioParams {
  symbol: string;
  startDate: string;
  endDate: string;
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
  historicTrendType?: 'Bullish' | 'Bearish';
  consecutiveDays?: number;
  dayRange?: number;
  // Trending Streak params
  trendingStreakValue?: number;
  trendingStreakType?: 'more' | 'less';
  trendingStreakPercent?: number;
  // Momentum Ranking params
  watchlist?: string;
  momentumTrendType?: number;
  atrPeriod?: number;
  recentDays1?: number;
  recentDays2?: number;
  recentMonths1?: number;
  recentMonths2?: number;
  // Watchlist Analysis params
  watchlistName?: string;
  recentWeek?: number;
  recentMonth1?: number;
  recentMonth2?: number;
  recentMonth3?: number;
}

export interface ScannerParams {
  symbols?: string[];
  startDate: string;
  endDate: string;
  filters?: FilterConfig;
  trendType?: string;
  consecutiveDays?: number;
  criteria?: Record<string, unknown>;
  responseMode?: 'full' | 'summary';
  maxRows?: number;
}

export interface BacktestParams {
  symbol: string;
  startDate: string;
  endDate: string;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PhenomenaParams {
  symbol: string;
  startDate: string;
  endDate: string;
  phenomenaType?: string;
  threshold?: number;
  percentChange?: number;
}

export interface BasketParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  weights?: Record<string, number>;
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

export interface ChartParams {
  symbol: string;
  startDate: string;
  endDate: string;
  chartType?: string;
}

export interface BasketGroupDto {
  id: number;
  name: string;
  description?: string | null;
  symbolCount: number;
  symbols: string[];
  isSystem: boolean;
  isOwner: boolean;
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

export interface FilterConfig {
  yearFilters?: YearFilters;
  monthFilters?: MonthFilters;
  weekFilters?: WeekFilters;
  dayFilters?: DayFilters;
  outlierFilters?: OutlierFilters;
  // Scanner-specific filters
  evenOddYears?: string;
  specificMonths?: number[];
  specificExpiryWeeksMonthly?: number[];
  specificMondayWeeksMonthly?: number[];
}

interface YearFilters {
  positiveNegativeYears?: 'All' | 'Positive' | 'Negative';
  evenOddYears?: 'All' | 'Even' | 'Odd' | 'Leap' | 'Election';
  decadeYears?: number[];
  specificYears?: number[];
}

interface MonthFilters {
  positiveNegativeMonths?: 'All' | 'Positive' | 'Negative';
  evenOddMonths?: 'All' | 'Even' | 'Odd';
  specificMonth?: number;
}

interface WeekFilters {
  weekType?: 'monday' | 'expiry';
  positiveNegativeWeeks?: 'All' | 'Positive' | 'Negative';
  evenOddWeeksMonthly?: 'All' | 'Even' | 'Odd';
  evenOddWeeksYearly?: 'All' | 'Even' | 'Odd';
  specificWeekMonthly?: number;
}

interface DayFilters {
  positiveNegativeDays?: 'All' | 'Positive' | 'Negative';
  weekdays?: string[];
  evenOddCalendarDaysMonthly?: 'All' | 'Even' | 'Odd';
  evenOddCalendarDaysYearly?: 'All' | 'Even' | 'Odd';
  evenOddTradingDaysMonthly?: 'All' | 'Even' | 'Odd';
  evenOddTradingDaysYearly?: 'All' | 'Even' | 'Odd';
}

interface OutlierFilters {
  dailyPercentageRange?: { enabled: boolean; min: number; max: number };
  weeklyPercentageRange?: { enabled: boolean; min: number; max: number };
  monthlyPercentageRange?: { enabled: boolean; min: number; max: number };
  yearlyPercentageRange?: { enabled: boolean; min: number; max: number };
}

export interface EventAnalysisParams {
  symbol: string;
  eventName?: string;
  eventCategory?: string;
  country?: string;
  startDate: string;
  endDate: string;
  windowBefore?: number;
  windowAfter?: number;
  entryPoint?: 'T-1_CLOSE' | 'T0_OPEN' | 'T0_CLOSE';
  exitPoint?: string;
  minOccurrences?: number;
}

export interface EventCompareParams {
  symbol: string;
  eventNames: string[];
  startDate: string;
  endDate: string;
}

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
