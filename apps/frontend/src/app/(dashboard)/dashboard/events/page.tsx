'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Filter,
  ChevronDown, ChevronRight,
  RefreshCw,
  Zap,
  HelpCircle,
  LayoutGrid,
  Calendar,
  Flag,
  SlidersHorizontal
} from 'lucide-react';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore, filterDataByDayRange } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
import { EventCategorySummary } from '@/components/charts/EventCategorySummary';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  SymbolSelector,
  DateRangePicker
} from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/MetricTooltip';

const PRIMARY_COLOR = '#3b82f6';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-blue-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

// Tooltip Component
function InfoTooltip({ content }: { content: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
    setIsVisible(true);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        className="ml-1.5 inline-flex items-center justify-center"
        type="button"
      >
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600 transition-colors" />
      </button>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[9999] w-64 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl pointer-events-none"
            style={{
              left: `${position.x}px`,
              top: `${position.y - 10}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="relative">
              {content}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EventsPage() {
  const { selectedSymbols, startDate, endDate, chartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection, dayRangeSelection, clearDayRangeSelection } = useChartSelectionStore();
  const [filterOpen, setFilterOpen] = useState(true);
  const [activeTable, setActiveTable] = useState<'events' | 'categories'>('events');

  // Event-specific filters
  const [selectedEventName, setSelectedEventName] = useState<string>('HOLI');
  const [selectedCategory, setSelectedCategory] = useState<string>('FESTIVAL');
  const [selectedCountry, setSelectedCountry] = useState<string>('INDIA');
  const [windowBefore, setWindowBefore] = useState<number>(10);
  const [windowAfter, setWindowAfter] = useState<number>(10);
  const [entryPoint, setEntryPoint] = useState<'T-1_CLOSE' | 'T0_OPEN' | 'T0_CLOSE'>('T-1_CLOSE');
  const [exitPoint, setExitPoint] = useState<string>('T+10_CLOSE');
  const [minOccurrences, setMinOccurrences] = useState<number>(3);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('');

  // Fetch event categories
  const { data: categoriesData } = useQuery({
    queryKey: ['event-categories'],
    queryFn: async () => {
      const response = await analysisApi.eventCategories();
      const categories = response.data.data || [];
      const categoryNames = categories.map((c: any) => c.category);
      return Array.from(new Set(categoryNames)) as string[];
    },
  });

  // Fetch event names based on category
  const { data: eventNamesData } = useQuery({
    queryKey: ['event-names', selectedCategory, selectedCountry],
    queryFn: async () => {
      const response = await analysisApi.eventNames({
        category: selectedCategory || undefined,
        country: selectedCountry || undefined
      });
      const events = response.data.data || [];
      return events.map((e: any) => e.name);
    },
  });

  // Fetch event analysis
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['event-analysis', selectedSymbols, startDate, endDate, selectedEventName, selectedCategory, windowBefore, windowAfter, entryPoint, exitPoint, minOccurrences, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.events({
        symbol: selectedSymbols[0],
        eventName: selectedEventName || undefined,
        eventCategory: selectedCategory || undefined,
        country: selectedCountry,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        windowBefore,
        windowAfter,
        entryPoint,
        exitPoint,
        minOccurrences,
      });
      return response.data.data;
    },
    enabled: selectedSymbols.length > 0 && (!!selectedEventName || !!selectedCategory),
    retry: false,
  });

  // Fetch available symbols for compare dropdown
  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols;
    },
  });

  const availableSymbols = symbolsData || [];

  // Fetch comparison symbol data
  const { data: compareData } = useQuery({
    queryKey: ['event-analysis', compareSymbol, startDate, endDate, selectedEventName, selectedCategory, windowBefore, windowAfter, entryPoint, exitPoint, minOccurrences, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      if (!compareSymbol) return null;
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.events({
        symbol: compareSymbol,
        eventName: selectedEventName || undefined,
        eventCategory: selectedCategory || undefined,
        country: selectedCountry,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        windowBefore,
        windowAfter,
        entryPoint,
        exitPoint,
        minOccurrences,
      });
      return response.data.data;
    },
    enabled: compareMode && !!compareSymbol,
  });

  const compareStats = compareData?.aggregatedMetrics;

  // Compare main chart data - Superimposed Returns (compounded from T0)
  const compareMainChartData = useMemo(() => {
    if (!compareData?.averageEventCurve || compareData.averageEventCurve.length === 0) return [];

    const sorted = [...compareData.averageEventCurve].sort((a: any, b: any) => a.relativeDay - b.relativeDay);
    const t0Index = sorted.findIndex((p: any) => p.relativeDay === 0);
    if (t0Index === -1) return [];

    const multipliers = sorted.map((p: any) => ((Number(p.avgReturn) || 0) / 100) + 1);

    for (let i = t0Index + 1; i < multipliers.length; i++) {
      multipliers[i] = multipliers[i] * multipliers[i - 1];
    }
    for (let i = t0Index - 1; i >= 0; i--) {
      multipliers[i] = multipliers[i] * multipliers[i + 1];
    }

    return sorted.map((point: any, idx: number) => ({
      date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
      returnPercentage: Number(point.avgReturn) || 0,
      cumulative: Number(((multipliers[idx] - 1) * 100).toFixed(4)),
      relativeDay: point.relativeDay,
    }));
  }, [compareData?.averageEventCurve]);

  // Get selected day range from store (must be before compareFilteredCumulativeCurve)
  const selectedStartDay = dayRangeSelection.isActive ? (dayRangeSelection.startDay ?? 0) : null;
  const selectedEndDay = dayRangeSelection.isActive ? (dayRangeSelection.endDay ?? 0) : null;

  // Compare filtered cumulative curve - using compounded calculation
  const compareFilteredCumulativeCurve = useMemo(() => {
    if (!compareData?.averageEventCurve || !dayRangeSelection.isActive || selectedStartDay === null || selectedEndDay === null) {
      return [];
    }

    const filteredCurve = compareData.averageEventCurve
      .filter((point: any) => {
        const relDay = point.relativeDay;
        return relDay >= selectedStartDay && relDay <= selectedEndDay;
      })
      .sort((a: any, b: any) => a.relativeDay - b.relativeDay);

    if (filteredCurve.length === 0) return [];

    const t0Index = filteredCurve.findIndex((p: any) => p.relativeDay === 0);
    if (t0Index === -1) {
      let cumulative = 0;
      return filteredCurve.map((point: any) => {
        cumulative += Number(point.avgReturn) || 0;
        return {
          date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
          returnPercentage: Number(point.avgReturn) || 0,
          cumulative: Number(cumulative.toFixed(4)),
          relativeDay: point.relativeDay,
        };
      });
    }

    const multipliers = filteredCurve.map((p: any) => ((Number(p.avgReturn) || 0) / 100) + 1);

    for (let i = t0Index + 1; i < multipliers.length; i++) {
      multipliers[i] = multipliers[i] * multipliers[i - 1];
    }
    for (let i = t0Index - 1; i >= 0; i--) {
      multipliers[i] = multipliers[i] * multipliers[i + 1];
    }

    return filteredCurve.map((point: any, idx: number) => ({
      date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
      returnPercentage: Number(point.avgReturn) || 0,
      cumulative: Number(((multipliers[idx] - 1) * 100).toFixed(4)),
      relativeDay: point.relativeDay,
    }));
  }, [compareData?.averageEventCurve, dayRangeSelection.isActive, selectedStartDay, selectedEndDay]);

  const stats = data?.aggregatedMetrics;

  // Filtered stats based on day range selection
  const filteredStats = useMemo(() => {
    if (!data?.averageEventCurve || !dayRangeSelection.isActive || selectedStartDay === null || selectedEndDay === null) {
      return stats;
    }

    // Filter averageEventCurve for selected range
    const filteredCurve = data.averageEventCurve.filter((point: any) => {
      const relDay = point.relativeDay;
      return relDay >= selectedStartDay && relDay <= selectedEndDay;
    });

    if (filteredCurve.length === 0) return stats;

    // Calculate stats for filtered range
    const returns = filteredCurve.map((p: any) => Number(p.avgReturn) || 0);
    const totalReturn = returns.reduce((a: number, b: number) => a + b, 0);
    const avgReturn = totalReturn / returns.length;
    const winningDays = returns.filter((r: number) => r > 0).length;
    const winRate = (winningDays / returns.length) * 100;

    return {
      ...stats,
      avgReturn,
      winRate,
      totalReturn,
    };
  }, [data?.averageEventCurve, dayRangeSelection.isActive, selectedStartDay, selectedEndDay, stats]);

  // 1. Data for Main Chart - Superimposed Returns (compounded from T0 like old software)
  const mainChartData = useMemo(() => {
    if (!data?.averageEventCurve || data.averageEventCurve.length === 0) return [];

    // Sort by relativeDay
    const sorted = [...data.averageEventCurve].sort((a, b) => a.relativeDay - b.relativeDay);

    // Find T0 index (relativeDay = 0)
    const t0Index = sorted.findIndex((p: any) => p.relativeDay === 0);
    if (t0Index === -1) return [];

    // Convert average returns to multipliers
    const multipliers = sorted.map((p: any) => ((Number(p.avgReturn) || 0) / 100) + 1);

    // Compound from T0 outward (both forward and backward) - like old software
    // Start from T0 and compound forward
    for (let i = t0Index + 1; i < multipliers.length; i++) {
      multipliers[i] = multipliers[i] * multipliers[i - 1];
    }
    // Compound backward from T0
    for (let i = t0Index - 1; i >= 0; i--) {
      multipliers[i] = multipliers[i] * multipliers[i + 1];
    }

    // Convert back to percentages and create chart data
    return sorted.map((point: any, idx: number) => {
      const compoundedReturn = (multipliers[idx] - 1) * 100;
      return {
        date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
        returnPercentage: Number(point.avgReturn) || 0,
        cumulative: Number(compoundedReturn.toFixed(4)),
        relativeDay: point.relativeDay,
      };
    });
  }, [data?.averageEventCurve]);

  // Filtered main chart data based on selection
  const filteredMainChartData = useMemo(() => {
    if (!dayRangeSelection.isActive || selectedStartDay === null || selectedEndDay === null) {
      return mainChartData;
    }
    return mainChartData.filter((point: any) => {
      return point.relativeDay >= selectedStartDay && point.relativeDay <= selectedEndDay;
    });
  }, [mainChartData, dayRangeSelection.isActive, selectedStartDay, selectedEndDay]);

  // Calculate cumulative from filtered curve - using compounded calculation
  const filteredCumulativeCurve = useMemo(() => {
    if (!data?.averageEventCurve || !dayRangeSelection.isActive || selectedStartDay === null || selectedEndDay === null) {
      return [];
    }

    // Filter and sort by relativeDay
    const filteredCurve = data.averageEventCurve
      .filter((point: any) => {
        const relDay = point.relativeDay;
        return relDay >= selectedStartDay && relDay <= selectedEndDay;
      })
      .sort((a: any, b: any) => a.relativeDay - b.relativeDay);

    if (filteredCurve.length === 0) return [];

    // Find T0 index in filtered data
    const t0Index = filteredCurve.findIndex((p: any) => p.relativeDay === 0);
    if (t0Index === -1) {
      // If no T0 in range, just do simple cumulative
      let cumulative = 0;
      return filteredCurve.map((point: any) => {
        cumulative += Number(point.avgReturn) || 0;
        return {
          date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
          returnPercentage: Number(point.avgReturn) || 0,
          cumulative: Number(cumulative.toFixed(4)),
          relativeDay: point.relativeDay,
        };
      });
    }

    // Convert to multipliers and compound from T0
    const multipliers = filteredCurve.map((p: any) => ((Number(p.avgReturn) || 0) / 100) + 1);

    // Compound forward from T0
    for (let i = t0Index + 1; i < multipliers.length; i++) {
      multipliers[i] = multipliers[i] * multipliers[i - 1];
    }
    // Compound backward from T0
    for (let i = t0Index - 1; i >= 0; i--) {
      multipliers[i] = multipliers[i] * multipliers[i + 1];
    }

    // Convert back to percentages
    return filteredCurve.map((point: any, idx: number) => ({
      date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
      returnPercentage: Number(point.avgReturn) || 0,
      cumulative: Number(((multipliers[idx] - 1) * 100).toFixed(4)),
      relativeDay: point.relativeDay,
    }));
  }, [data?.averageEventCurve, dayRangeSelection.isActive, selectedStartDay, selectedEndDay]);

  // 2. Data for Cumulative Profit Panel - use filtered data when selection active
  const cumulativeProfitData = useMemo(() => {
    if (!data?.eventOccurrences) return [];

    // If day range is selected, use the filtered cumulative curve
    if (dayRangeSelection.isActive && filteredCumulativeCurve.length > 0) {
      // For events, show cumulative of average returns for selected range
      return filteredCumulativeCurve;
    }

    // Default: show all data
    const sortedEvents = [...data.eventOccurrences].sort((a: any, b: any) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

    let runningTotal = 0;
    return sortedEvents.map((event: any) => {
      const ret = Number(event.returnPercentage) || 0;
      runningTotal += ret;
      return {
        date: event.eventDate,
        cumulative: runningTotal,
        returnPercentage: ret
      };
    });
  }, [data?.eventOccurrences, dayRangeSelection.isActive, filteredCumulativeCurve]);

  // 3. Data for Pattern Returns Panel - use filtered data when selection active  
  const patternReturnsData = useMemo(() => {
    if (!data?.eventOccurrences) return [];

    // If day range is selected, use filtered curve data
    if (dayRangeSelection.isActive && filteredCumulativeCurve.length > 0) {
      return filteredCumulativeCurve.map((point: any) => ({
        date: point.date,
        returnPercentage: point.returnPercentage
      }));
    }

    // Default: show all events
    return [...data.eventOccurrences]
      .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .map((event: any) => ({
        date: event.eventDate,
        returnPercentage: Number(event.returnPercentage) || 0
      }));
  }, [data?.eventOccurrences, dayRangeSelection.isActive, filteredCumulativeCurve]);

  // Compare Cumulative Profit data
  const compareCumulativeProfitData = useMemo(() => {
    if (!compareData?.eventOccurrences) return [];

    if (dayRangeSelection.isActive && compareFilteredCumulativeCurve.length > 0) {
      return compareFilteredCumulativeCurve;
    }

    const sortedEvents = [...compareData.eventOccurrences].sort((a: any, b: any) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

    let runningTotal = 0;
    return sortedEvents.map((event: any) => {
      const ret = Number(event.returnPercentage) || 0;
      runningTotal += ret;
      return {
        date: event.eventDate,
        cumulative: runningTotal,
        returnPercentage: ret
      };
    });
  }, [compareData?.eventOccurrences, dayRangeSelection.isActive, compareFilteredCumulativeCurve]);

  // Compare Pattern Returns data
  const comparePatternReturnsData = useMemo(() => {
    if (!compareData?.eventOccurrences) return [];

    if (dayRangeSelection.isActive && compareFilteredCumulativeCurve.length > 0) {
      return compareFilteredCumulativeCurve.map((point: any) => ({
        date: point.date,
        returnPercentage: point.returnPercentage
      }));
    }

    return [...compareData.eventOccurrences]
      .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .map((event: any) => ({
        date: event.eventDate,
        returnPercentage: Number(event.returnPercentage) || 0
      }));
  }, [compareData?.eventOccurrences, dayRangeSelection.isActive, compareFilteredCumulativeCurve]);


  return (
    <div className="flex h-full bg-[#F8F9FB]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* HEADER */}
        <header className="flex-shrink-0 h-14 px-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!filterOpen && (
              <button
                onClick={() => setFilterOpen(true)}
                className="p-1.5 hover:bg-slate-50 rounded transition-colors mr-2"
              >
                <ChevronRight className="h-4 w-4 text-slate-400 rotate-180" />
              </button>
            )}
            <Zap className="h-5 w-5 text-blue-600 fill-blue-200" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                {selectedSymbols[0] || 'NIFTY'}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Event Analysis Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-slate-50 rounded-full transition-colors">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-slate-50 rounded-full transition-colors">
              <RefreshCw className="h-4 w-4 text-slate-400" />
            </button>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {selectedSymbols[0]?.charAt(0) || 'N'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5 max-w-[1600px] mx-auto w-full">

          {/* STATS STRIP */}
          {(dayRangeSelection.isActive ? filteredStats : stats) && (
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="TOTAL EVENTS"
                value={(dayRangeSelection.isActive ? filteredStats : stats)?.totalEvents?.toString() || '0'}
                trend="neutral"
                subValue={selectedEventName || selectedCategory || (dayRangeSelection.isActive ? `T+${selectedStartDay} to T+${selectedEndDay}` : 'All Events')}
                metricKey="eventCount"
                compareValue={compareMode && compareStats ? (compareStats.totalEvents || 0).toString() : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="WIN RATE"
                value={`${((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0).toFixed(1)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0) > 50 ? 'up' : 'down'}
                subValue={`${(dayRangeSelection.isActive ? filteredStats : stats)?.winningEvents || 0} wins`}
                metricKey="winRate"
                compareValue={compareMode && compareStats ?
                  `${((compareStats.winRate || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0)) > 0 ? '+' : ''}${(compareStats.winRate || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0)).toFixed(1)}%`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="AVG RETURN"
                value={`${((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturn || 0).toFixed(2)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturn || 0) >= 0 ? 'up' : 'down'}
                subValue={`Total: ${((dayRangeSelection.isActive ? filteredStats : stats)?.totalReturn || 0).toFixed(2)}%`}
                metricKey="avgReturn"
                compareValue={compareMode && compareStats ?
                  `${((compareStats.avgReturn || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturn || 0)) > 0 ? '+' : ''}${(compareStats.avgReturn || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturn || 0)).toFixed(2)}%`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="SHARPE RATIO"
                value={(dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio?.toFixed(2) || '0.00'}
                trend={(dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio ? ((dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio || 0) > 0 ? 'up' : 'down' : 'neutral'}
                subValue={(dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio ? ((dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio || 0) > 0 ? 'Good' : 'Poor' : 'N/A'}
                metricKey="sharpeRatio"
                compareValue={compareMode && compareStats ?
                  `${((compareStats.sharpeRatio || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio || 0)) > 0 ? '+' : ''}${(compareStats.sharpeRatio || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio || 0)).toFixed(2)}`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="PROFIT FACTOR"
                value={(dayRangeSelection.isActive ? filteredStats : stats)?.profitFactor?.toFixed(2) || '0.00'}
                trend={(dayRangeSelection.isActive ? filteredStats : stats)?.profitFactor ? ((dayRangeSelection.isActive ? filteredStats : stats)?.profitFactor || 0) > 1 ? 'up' : 'down' : 'neutral'}
                subValue={`Max DD: ${((dayRangeSelection.isActive ? filteredStats : stats)?.maxDrawdown || 0).toFixed(2)}%`}
                metricKey="maxDrawdown"
                compareValue={compareMode && compareStats ?
                  `${((compareStats.profitFactor || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.profitFactor || 0)) > 0 ? '+' : ''}${(compareStats.profitFactor || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.profitFactor || 0)).toFixed(2)}`
                  : undefined}
                compareLabel={compareSymbol}
              />
            </div>
          )}

          {/* MAIN CHART - Superimposed Returns */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px] overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center">
                <h3 className="font-semibold text-slate-800 text-sm">Superimposed Returns</h3>
                <InfoTooltip content="Shows the cumulative/compounded returns across all event occurrences. Each point represents the average return at that relative day, compounded from the start." />
              </div>
              {dayRangeSelection.isActive && (
                <button
                  onClick={() => clearDayRangeSelection()}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div className="flex-1 w-full relative p-4">
              {!data ? (
                <PlaceholderState />
              ) : (
                <CumulativeChartWithDragSelect
                  data={mainChartData}
                  chartScale={chartScale}
                  chartColor="#3b82f6"
                  isEventData={true}
                  compareData={compareMode && compareMainChartData.length > 0 ? compareMainChartData : undefined}
                  compareColor="#001d4bff"
                />
              )}
            </div>
          </div>

          {/* SECONDARY PANELS - Cumulative Profit & Pattern Returns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[300px]">
            {/* Cumulative Profit */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Cumulative Profit</h3>
                  <InfoTooltip content="Tracks the cumulative profit/loss over time if you had traded every occurrence of this event. An upward trend indicates consistent profitability." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {cumulativeProfitData.length > 0 ? (
                  <CumulativeChartWithDragSelect
                    data={cumulativeProfitData}
                    chartScale="linear"
                    chartColor="#3b82f6"
                    compareData={compareMode && compareCumulativeProfitData.length > 0 ? compareCumulativeProfitData : undefined}
                    compareColor="#001d4bff"
                    enableDragSelect={false}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>

            {/* Pattern Returns */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Pattern Returns</h3>
                  <InfoTooltip content="Distribution of returns for each event occurrence. Green bars show profitable trades, red bars show losses. Helps identify consistency and outliers in the pattern." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {patternReturnsData.length > 0 ? (
                  <ReturnBarChart
                    data={patternReturnsData}
                    symbol={selectedSymbols[0]}
                    config={{ title: '', height: 240 }}
                    color="#3b82f6"
                    compareData={compareMode && comparePatternReturnsData.length > 0 ? comparePatternReturnsData : undefined}
                    compareSymbol={compareMode ? compareSymbol : undefined}
                    compareColor="#001d4bff"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>
          </div>

          {/* DATA TABLE WITH TOGGLE */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            {/* TABLE TOGGLE */}
            <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50">
              {[
                { id: 'events', label: 'Event Occurrences' },
                { id: 'categories', label: 'Category Summary' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTable(tab.id as any)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium rounded-md transition-colors",
                    activeTable === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:shadow-sm"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TABLE CONTENT */}
            <div className="max-h-[500px] overflow-auto">
              {activeTable === 'events' && (
                <EventDataTable
                  data={data?.eventOccurrences || []}
                  symbol={selectedSymbols[0]}
                  mean={stats?.avgReturn || 0}
                  stdDev={stats?.stdDev || 1}
                />
              )}
              {activeTable === 'categories' && (
                <EventCategorySummary
                  data={data?.eventOccurrences || []}
                  defaultCategory={selectedCategory}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={() => refetch()}
        onClear={resetFilters}
        isLoading={isFetching}
        title="Event Filters"
        subtitle="Configure Analysis"
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Market Context" defaultOpen delay={0.1} icon={<LayoutGrid className="h-4 w-4" />}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Asset Class</label>
              <div className="text-xs font-medium text-slate-700 mb-2">Symbol</div>
              <SymbolSelector />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Compare" defaultOpen delay={0.02} icon={<SlidersHorizontal className="h-4 w-4" />}>
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="compareMode"
                checked={compareMode}
                onChange={(e) => {
                  setCompareMode(e.target.checked);
                  if (!e.target.checked) setCompareSymbol('');
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="compareMode" className="text-sm text-slate-700">Enable comparison</label>
            </div>

            {compareMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Compare Symbol</label>
                <Select value={compareSymbol} onValueChange={setCompareSymbol}>
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select symbol to compare" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSymbols.map((symbol: { symbol: string; name: string }) => (
                      <SelectItem key={symbol.symbol} value={symbol.symbol}>
                        {symbol.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </FilterSection>

        <FilterSection title="Time Ranges" defaultOpen delay={0.15} icon={<Calendar className="h-4 w-4" />}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(e.target.value, useAnalysisStore.getState().endDate)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(useAnalysisStore.getState().startDate, e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Event Selection" defaultOpen delay={0.2} icon={<Flag className="h-4 w-4" />}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIA">India</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="UK">UK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Category</label>
              <Select value={selectedCategory || undefined} onValueChange={(val) => {
                setSelectedCategory(val === 'ALL_CATEGORIES' ? '' : val);
                setSelectedEventName('');
              }}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CATEGORIES">All categories</SelectItem>
                  {categoriesData?.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Event Name</label>
              <Select value={selectedEventName || undefined} onValueChange={(val) => {
                setSelectedEventName(val === 'ALL_EVENTS' ? '' : val);
              }}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_EVENTS">All Events</SelectItem>
                  {eventNamesData?.map((name: string) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Analysis Parameters" defaultOpen delay={0.25} icon={<SlidersHorizontal className="h-4 w-4" />}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Days Before Event</label>
              <input
                type="number"
                value={windowBefore}
                onChange={(e) => setWindowBefore(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Days After Event</label>
              <input
                type="number"
                value={windowAfter}
                onChange={(e) => setWindowAfter(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Entry Point</label>
              <Select value={entryPoint} onValueChange={(val: 'T-1_CLOSE' | 'T0_OPEN' | 'T0_CLOSE') => setEntryPoint(val)}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select entry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T-1_CLOSE">T-1 Close</SelectItem>
                  <SelectItem value="T0_OPEN">T0 Open</SelectItem>
                  <SelectItem value="T0_CLOSE">T0 Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Exit Point</label>
              <Select value={exitPoint} onValueChange={setExitPoint}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select exit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T+1_CLOSE">T+1 Close</SelectItem>
                  <SelectItem value="T+2_CLOSE">T+2 Close</SelectItem>
                  <SelectItem value="T+3_CLOSE">T+3 Close</SelectItem>
                  <SelectItem value="T+5_CLOSE">T+5 Close</SelectItem>
                  <SelectItem value="T+10_CLOSE">T+10 Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Min Occurrences</label>
              <input
                type="number"
                value={minOccurrences}
                onChange={(e) => setMinOccurrences(Number(e.target.value))}
                min={1}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        </FilterSection>

      </RightFilterConsole>
    </div>
  );
}

function StatCard({ label, value, subValue, trend, metricKey, compareValue, compareLabel }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  metricKey?: string;
  compareValue?: string;
  compareLabel?: string;
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
        {label}
        {metricKey && <MetricTooltip metric={metricKey} />}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <div className={cn(
            "text-2xl font-bold",
            trend === 'up' ? "text-emerald-600" : trend === 'down' ? "text-red-600" : "text-slate-900"
          )}>{value}</div>
        </div>
        {subValue && (
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">
            {subValue}
          </div>
        )}
        {compareValue && (
          <div className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-slate-100">
            <span className="text-[10px] font-semibold text-red-600">{compareLabel || 'VS'}:</span>
            <span className="text-xs font-bold text-red-700">{compareValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EventDataTable({ data, symbol, mean, stdDev }: { data: any[], symbol: string, mean: number, stdDev: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-white text-slate-400 text-sm">
        No event data available
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
          <tr>
            <th className="px-5 py-3">Event Date</th>
            <th className="px-5 py-3">Symbol</th>
            <th className="px-5 py-3">Price</th>
            <th className="px-5 py-3">P&L %</th>
            <th className="px-5 py-3">Z-Score</th>
            <th className="px-5 py-3">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row: any, idx: number) => {
            const zScore = stdDev !== 0 ? ((row.returnPercentage || 0) - mean) / stdDev : 0;
            return (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors bg-white">
                <td className="px-5 py-3.5 text-slate-700 text-xs font-medium">
                  {new Date(row.eventDate).toISOString().split('T')[0]}
                </td>
                <td className="px-5 py-3.5 text-slate-900 font-semibold text-xs">{symbol}</td>
                <td className="px-5 py-3.5 text-slate-600 text-xs">{row.entryPrice?.toFixed(2)}</td>
                <td className="px-5 py-3.5">
                  <span className={cn(
                    "px-2 py-1 rounded font-semibold text-[11px]",
                    (row.returnPercentage || 0) >= 0
                      ? "bg-blue-50 text-blue-700"
                      : "bg-blue-100 text-blue-500"
                  )}>
                    {(row.returnPercentage || 0) > 0 ? '+' : ''}
                    {(row.returnPercentage || 0).toFixed(2)}%
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn(
                    "px-2 py-1 rounded font-semibold text-[11px]",
                    Math.abs(zScore) < 0.5 ? "bg-slate-50 text-slate-600" : "bg-orange-50 text-orange-700"
                  )}>
                    {zScore.toFixed(2)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-600 text-xs">
                  {row.holdingDays || 3} Days
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlaceholderState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
      <Zap className="h-12 w-12 mb-3 opacity-20" />
      <span className="text-sm font-medium">Select an event to analyze</span>
    </div>
  );
}
