import { create } from 'zustand';
import type { FilterConfig, Symbol } from '@/lib/types';

interface AnalysisState {
  // Selected symbols
  selectedSymbols: string[];
  availableSymbols: Symbol[];
  
  // Date range
  startDate: string;
  endDate: string;
  lastNDays: number;
  
  // Filters
  filters: FilterConfig;
  
  // Chart settings
  chartScale: 'linear' | 'log';
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  setSelectedSymbols: (symbols: string[]) => void;
  setAvailableSymbols: (symbols: Symbol[]) => void;
  setDateRange: (start: string, end: string) => void;
  setLastNDays: (days: number) => void;
  setFilters: (filters: FilterConfig) => void;
  updateFilter: <K extends keyof FilterConfig>(
    category: K,
    updates: Partial<FilterConfig[K]>
  ) => void;
  resetFilters: () => void;
  setChartScale: (scale: 'linear' | 'log') => void;
  setIsLoading: (loading: boolean) => void;
}

const defaultFilters: FilterConfig = {
  yearFilters: {
    positiveNegativeYears: 'All',
    evenOddYears: 'All',
    decadeYears: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  monthFilters: {
    positiveNegativeMonths: 'All',
    evenOddMonths: 'All',
    specificMonth: 0,
  },
  weekFilters: {
    positiveNegativeWeeks: 'All',
    evenOddWeeksMonthly: 'All',
    evenOddWeeksYearly: 'All',
    specificWeekMonthly: 0,
  },
  dayFilters: {
    positiveNegativeDays: 'All',
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    evenOddCalendarDaysMonthly: 'All',
    evenOddTradingDaysMonthly: 'All',
  },
  outlierFilters: {
    dailyPercentageRange: { enabled: false, min: -5, max: 5 },
    weeklyPercentageRange: { enabled: false, min: -15, max: 15 },
    monthlyPercentageRange: { enabled: false, min: -25, max: 25 },
    yearlyPercentageRange: { enabled: false, min: -50, max: 50 },
  },
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  selectedSymbols: ['NIFTY'],
  availableSymbols: [],
  startDate: '2016-01-01',
  endDate: '2025-12-31',
  lastNDays: 0,
  filters: defaultFilters,
  chartScale: 'linear',
  isLoading: false,

  setSelectedSymbols: (symbols) => set({ selectedSymbols: symbols }),
  setAvailableSymbols: (symbols) => set({ availableSymbols: symbols }),
  setDateRange: (start, end) => set({ startDate: start, endDate: end }),
  setLastNDays: (days) => set({ lastNDays: days }),
  setFilters: (filters) => set({ filters }),
  updateFilter: (category, updates) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [category]: {
          ...state.filters[category],
          ...updates,
        },
      },
    })),
  resetFilters: () => set({ filters: defaultFilters }),
  setChartScale: (scale) => set({ chartScale: scale }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
