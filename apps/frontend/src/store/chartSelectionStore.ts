import { create } from 'zustand';
import { Time } from 'lightweight-charts';

export interface TimeRangeSelection {
  startTime: Time | null;
  endTime: Time | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

// For superimposed chart pattern selection (day-of-year filtering)
export interface DayRangeSelection {
  startDay: number | null;
  endDay: number | null;
  chartType: string | null;  // 'CalendarYearDays', 'TradingYearDays', etc.
  isActive: boolean;
}

interface ChartSelectionState {
  // Time range selection (for date-based filtering)
  timeRangeSelection: TimeRangeSelection;
  
  // Day range selection (for superimposed chart pattern filtering)
  dayRangeSelection: DayRangeSelection;
  
  // Actions
  setTimeRangeSelection: (selection: TimeRangeSelection) => void;
  clearTimeRangeSelection: () => void;
  
  setDayRangeSelection: (selection: DayRangeSelection) => void;
  clearDayRangeSelection: () => void;
  
  // Convert Time to Date string for API calls
  getDateRangeForAPI: () => { startDate: string | null; endDate: string | null };
}

const defaultTimeSelection: TimeRangeSelection = {
  startTime: null,
  endTime: null,
  startDate: null,
  endDate: null,
  isActive: false,
};

const defaultDaySelection: DayRangeSelection = {
  startDay: null,
  endDay: null,
  chartType: null,
  isActive: false,
};

export const useChartSelectionStore = create<ChartSelectionState>((set, get) => ({
  timeRangeSelection: defaultTimeSelection,
  dayRangeSelection: defaultDaySelection,

  setTimeRangeSelection: (selection) => {
    // Only calculate dates from time values if dates aren't already provided
    let startDate = selection.startDate;
    let endDate = selection.endDate;

    // Only recalculate if dates are not provided but time values are
    if (!startDate && selection.startTime !== null) {
      const timestamp = typeof selection.startTime === 'number' 
        ? selection.startTime * 1000 
        : new Date(selection.startTime as any).getTime();
      startDate = new Date(timestamp).toISOString().split('T')[0];
    }

    if (!endDate && selection.endTime !== null) {
      const timestamp = typeof selection.endTime === 'number' 
        ? selection.endTime * 1000 
        : new Date(selection.endTime as any).getTime();
      endDate = new Date(timestamp).toISOString().split('T')[0];
    }

    set({
      timeRangeSelection: {
        ...selection,
        startDate,
        endDate,
      },
    });
  },

  clearTimeRangeSelection: () => set({ timeRangeSelection: defaultTimeSelection }),

  setDayRangeSelection: (selection) => {
    set({ dayRangeSelection: selection });
  },

  clearDayRangeSelection: () => set({ dayRangeSelection: defaultDaySelection }),

  getDateRangeForAPI: () => {
    const { timeRangeSelection } = get();
    return {
      startDate: timeRangeSelection.startDate,
      endDate: timeRangeSelection.endDate,
    };
  },
}));

// Helper function to filter data by day range
export function filterDataByDayRange(
  data: any[], 
  dayRange: DayRangeSelection,
  superimposedChartType: string
): any[] {
  if (!dayRange.isActive || dayRange.startDay === null || dayRange.endDay === null) {
    return data;
  }

  const minDay = Math.min(dayRange.startDay, dayRange.endDay);
  const maxDay = Math.max(dayRange.startDay, dayRange.endDay);
  const chartType = dayRange.chartType || superimposedChartType;

  return data.filter((d: any) => {
    const date = new Date(d.date);
    let dayKey: number;
    
    switch (chartType) {
      case 'CalendarYearDays':
        const year = date.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        dayKey = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        break;
      case 'TradingYearDays':
        // Calculate trading day of year - need to count trading days up to this date
        dayKey = 1;
        for (let i = 0; i < data.indexOf(d); i++) {
          const prevDate = new Date(data[i].date);
          if (prevDate.getFullYear() === date.getFullYear()) dayKey++;
        }
        break;
      case 'CalendarMonthDays':
        dayKey = date.getDate();
        break;
      case 'TradingMonthDays':
        // Calculate trading day of month
        dayKey = 1;
        for (let i = 0; i < data.indexOf(d); i++) {
          const prevDate = new Date(data[i].date);
          if (prevDate.getFullYear() === date.getFullYear() && prevDate.getMonth() === date.getMonth()) {
            dayKey++;
          }
        }
        break;
      case 'Weekdays':
        dayKey = date.getDay();
        break;
      default:
        const yearD = date.getFullYear();
        const startOfYearD = new Date(yearD, 0, 1);
        dayKey = Math.floor((date.getTime() - startOfYearD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    return dayKey >= minDay && dayKey <= maxDay;
  });
}
