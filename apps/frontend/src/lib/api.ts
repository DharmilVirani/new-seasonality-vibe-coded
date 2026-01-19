import axios, { AxiosError, AxiosInstance } from 'axios';

// API base URL - append /api if it's a full URL
const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE_URL = baseUrl.startsWith('http') ? `${baseUrl}/api` : '/api';

console.log('API Configuration:', {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  baseUrl,
  API_BASE_URL
});

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Reduced to 30 seconds for auth requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    console.log('Making API request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      timeout: config.timeout
    });
    
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    console.log('API response received:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  async (error: AxiosError) => {
    console.error('API response error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      code: error.code
    });
    
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
  login: (email: string, password: string) => {
    console.log('authApi.login called with:', { email, password: '***' });
    console.log('Making request to:', `${API_BASE_URL}/auth/login`);
    return api.post('/auth/login', { email, password }, { timeout: 15000 });
  },
  register: (data: { email: string; password: string; name: string }) => {
    console.log('authApi.register called with:', { ...data, password: '***' });
    console.log('Making request to:', `${API_BASE_URL}/auth/register`);
    return api.post('/auth/register', data, { timeout: 15000 });
  },
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

  // Phenomena
  phenomena: (params: PhenomenaParams) => api.post('/analysis/phenomena', params),

  // Basket
  basket: (params: BasketParams) => api.post('/analysis/basket', params),

  // Chart Data
  chart: (params: ChartParams) => api.post('/analysis/chart', params),
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
}

export interface YearlyAnalysisParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  overlayType?: 'CalendarDays' | 'TradingDays';
}

export interface ScenarioParams {
  symbol: string;
  startDate: string;
  endDate: string;
  entryDay?: string;
  exitDay?: string;
  entryType?: 'Open' | 'Close';
  exitType?: 'Open' | 'Close';
  tradeType?: 'Long' | 'Short';
  returnType?: 'Percent' | 'Points';
}

export interface ScannerParams {
  symbols?: string[];
  startDate: string;
  endDate: string;
  filters?: FilterConfig;
  trendType?: string;
  consecutiveDays?: number;
  criteria?: Record<string, unknown>;
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

export interface ChartParams {
  symbol: string;
  startDate: string;
  endDate: string;
  chartType?: string;
}

export interface FilterConfig {
  yearFilters?: YearFilters;
  monthFilters?: MonthFilters;
  weekFilters?: WeekFilters;
  dayFilters?: DayFilters;
  outlierFilters?: OutlierFilters;
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
