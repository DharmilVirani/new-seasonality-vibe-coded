import axios, { AxiosError, AxiosInstance } from 'axios';

// API base URL - append /api if it's a full URL
const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
const API_BASE_URL = baseUrl.startsWith('http') ? `${baseUrl}/api` : '/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired - try refresh or redirect to login
      if (typeof window !== 'undefined') {
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
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
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
  createBatch: (formData: FormData) =>
    api.post('/upload/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listBatches: () => api.get('/upload/batches'),
  getBatch: (batchId: string) => api.get(`/upload/batches/${batchId}`),
  processBatch: (batchId: string) => api.post(`/upload/batches/${batchId}/process`),
};

export default api;

// Types
export interface DailyAnalysisParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  lastNDays?: number;
  filters?: FilterConfig;
  chartScale?: 'linear' | 'log';
  aggregateType?: string;
  aggregateField?: string;
}

export interface WeeklyAnalysisParams extends DailyAnalysisParams {
  weekType: 'monday' | 'expiry';
}

export interface MonthlyAnalysisParams extends DailyAnalysisParams {
  aggregateType?: 'total' | 'average';
}

export interface YearlyAnalysisParams {
  symbols: string[];
  startDate: string;
  endDate: string;
  overlayType?: 'CalendarDays' | 'TradingDays';
}
