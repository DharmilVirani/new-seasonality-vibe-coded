'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CalendarDays, TrendingUp, Download, Settings2,
  ChevronDown, RefreshCw, HelpCircle, Zap, BarChart3,
  Layers, LineChart, Calendar
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { ReturnBarChart, AggregateChart, CumulativeChartWithDragSelect } from '@/components/charts';
import { WeeklyDataTable } from '@/components/charts/WeeklyDataTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/MetricTooltip';

import { 
  SymbolSelector, 
  DateRangePicker, 
  YearFilters, 
  MonthFilters, 
  WeekFilters,
  SpecialDaysFilter,
  WeeklySuperimposedChartFilter
} from '@/components/filters';

const PRIMARY_COLOR = '#f59e0b';

// Info Tooltip Component
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
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-amber-600 transition-colors" />
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

// Placeholder State
function PlaceholderState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
      <Zap className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm font-medium">Select a symbol to begin analysis</p>
      <p className="text-xs mt-1 opacity-70">Choose filters and click analyze</p>
    </div>
  );
}

// Weekly Analytics Matrix Component
function WeeklyAnalyticsMatrix({ data, stats }: { data: any[]; stats: any }) {
  const distributionData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const weekGroups: Record<number, number[]> = {};
    data.forEach((d: any) => {
      const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
      if (!weekGroups[weekNum]) weekGroups[weekNum] = [];
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
    return sortedWeeks.map(weekNum => ({
      name: `W${weekNum}`,
      week: weekNum,
      count: weekGroups[weekNum].length,
      avgReturn: weekGroups[weekNum].reduce((a, b) => a + b, 0) / weekGroups[weekNum].length,
    }));
  }, [data]);

  const weeklyMetrics = useMemo(() => {
    if (!data || data.length === 0 || !stats) return [];

    const weekGroups: Record<number, number[]> = {};
    data.forEach((d: any) => {
      const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
      if (!weekGroups[weekNum]) weekGroups[weekNum] = [];
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    const weekStats = Object.entries(weekGroups).map(([week, returns]) => {
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const positive = returns.filter((r: number) => r > 0).length;
      return {
        week: parseInt(week),
        avgReturn: avg,
        winRate: (positive / returns.length) * 100,
        totalReturn: returns.reduce((a: number, b: number) => a + b, 0),
      };
    });

    if (weekStats.length === 0) return [];

    const bestWeek = weekStats.reduce((a, b) => a.avgReturn > b.avgReturn ? a : b);
    const worstWeek = weekStats.reduce((a, b) => a.avgReturn < b.avgReturn ? a : b);
    const mostConsistent = weekStats.reduce((a, b) => Math.abs(a.winRate - 50) < Math.abs(b.winRate - 50) ? a : b);

    return [
      { label: 'Best Week', value: `W${bestWeek.week}`, trend: 'up', subType: `${bestWeek.avgReturn.toFixed(2)}% avg` },
      { label: 'Worst Week', value: `W${worstWeek.week}`, trend: 'down', subType: `${worstWeek.avgReturn.toFixed(2)}% avg` },
      { label: 'Most Consistent', value: `W${mostConsistent.week}`, trend: mostConsistent.winRate > 50 ? 'up' : 'down', subType: `${mostConsistent.winRate.toFixed(1)}% win rate` },
      { label: 'CAGR', value: `${(stats.cagr || 0).toFixed(2)}%`, trend: (stats.cagr || 0) > 0 ? 'up' : 'down', subType: 'Annual Return' },
    ];
  }, [data, stats]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col h-full font-sans">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Analytics Matrix</h3>
        <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400">
          WEEKLY DISTRIBUTION
        </span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Week Distribution Chart */}
        <div className="flex-1 min-h-0 mb-4 relative">
          {distributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={distributionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                <linearGradient id="colorCountWeekly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RechartsTooltip
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-800">
                          <p className="font-bold mb-1">Week {payload[0]?.payload?.week}</p>
                          <p className="text-amber-300">Avg Return: {payload[0]?.payload?.avgReturn?.toFixed(2)}%</p>
                          <p className="text-slate-300">Samples: {payload[0]?.payload?.count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <XAxis dataKey="name" hide />
                <Area
                  type="monotone"
                  dataKey="avgReturn"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#colorCountWeekly)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 text-xs">No data</div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {weeklyMetrics.map((metric) => (
            <div key={metric.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{metric.label}</div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-lg font-bold",
                  metric.trend === 'up' ? "text-amber-600" : metric.trend === 'down' ? "text-rose-600" : "text-slate-800"
                )}>
                  {metric.value}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">{metric.subType}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale, setChartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection, clearTimeRangeSelection, dayRangeSelection } = useChartSelectionStore();
  const [weekType, setWeekType] = useState<'monday' | 'expiry'>('expiry');
  const [activeChart, setActiveChart] = useState<'superimposed' | 'aggregate'>('superimposed');
  const [aggregateType, setAggregateType] = useState<'total' | 'avg' | 'max' | 'min'>('avg');
  const [aggregateField, setAggregateField] = useState<'weekNumberYearly' | 'weekNumberMonthly'>('weekNumberYearly');
  const [filterOpen, setFilterOpen] = useState(true);
  
  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['weekly-analysis', selectedSymbols, startDate, endDate, filters, weekType, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      const dateRange = timeRangeSelection.isActive 
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };
      
      const response = await analysisApi.weekly({
        symbol: selectedSymbols[0],
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        weekType,
        filters,
        chartScale,
      });
      return response.data.data;
    },
    enabled: selectedSymbols.length > 0,
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
    queryKey: ['weekly-analysis', compareSymbol, startDate, endDate, filters, weekType, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      if (!compareSymbol) return null;
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.weekly({
        symbol: compareSymbol,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        weekType,
        filters,
        chartScale,
      });
      return response.data.data;
    },
    enabled: compareMode && !!compareSymbol,
  });

  const compareSymbolData = compareData?.[compareSymbol];

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

  // Filter data by day range if active (for superimposed chart selection)
  const filteredChartData = useMemo(() => {
    if (!symbolData?.chartData) return [];
    
    // If no selection, return all data
    if (!dayRangeSelection.isActive) {
      return symbolData.chartData;
    }
    
    // Filter by week number range
    const startWeek = dayRangeSelection.startDay ?? 1;
    const endWeek = dayRangeSelection.endDay ?? 52;
    
    return symbolData.chartData.filter((d: any) => {
      const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
      return weekNum >= startWeek && weekNum <= endWeek;
    });
  }, [symbolData?.chartData, dayRangeSelection.isActive, dayRangeSelection.startDay, dayRangeSelection.endDay]);

  // Prepare chart data using filtered data - recalculate cumulative from filtered subset
  const cumulativeData = useMemo(() => {
    const data = filteredChartData;
    if (!data || !data.length) return [];
    let cumulative = 100;
    return data.map((point: any) => {
      const returnPct = point.returnPercentage || 0;
      cumulative = cumulative * (1 + returnPct / 100);
      return {
        date: point.date,
        returnPercentage: returnPct,
        cumulative: Number(cumulative.toFixed(4)),
      };
    });
  }, [filteredChartData]);

  // Filter comparison data by day range if active
  const filteredCompareChartData = useMemo(() => {
    if (!compareSymbolData?.chartData) return [];
    
    // If no selection, return all data
    if (!dayRangeSelection.isActive) {
      return compareSymbolData.chartData;
    }
    
    // Filter by week number range
    const startWeek = dayRangeSelection.startDay ?? 1;
    const endWeek = dayRangeSelection.endDay ?? 52;
    
    return compareSymbolData.chartData.filter((d: any) => {
      const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
      return weekNum >= startWeek && weekNum <= endWeek;
    });
  }, [compareSymbolData?.chartData, dayRangeSelection.isActive, dayRangeSelection.startDay, dayRangeSelection.endDay]);

  // Compare cumulative data - recalculate cumulative from filtered subset
  const compareCumulativeData = useMemo(() => {
    if (!filteredCompareChartData.length) return [];
    let cumulative = 100;
    return filteredCompareChartData.map((point: any) => {
      const returnPct = point.returnPercentage || 0;
      cumulative = cumulative * (1 + returnPct / 100);
      return {
        date: point.date,
        returnPercentage: returnPct,
        cumulative: Number(cumulative.toFixed(4)),
      };
    });
  }, [filteredCompareChartData]);

  // Pattern Returns - shows different data based on drag selection state
  // Default: Weekly number average, With drag: Yearly pattern returns
  const patternReturnsData = useMemo(() => {
    const sourceData = dayRangeSelection.isActive ? filteredChartData : symbolData?.chartData || [];
    if (!sourceData.length) return [];

    if (dayRangeSelection.isActive) {
      // With drag select: show yearly pattern returns
      const yearlyGroups: Record<string, { returns: number[]; sum: number; count: number }> = {};
      
      sourceData.forEach((d: any) => {
        const year = new Date(d.date).getFullYear().toString();
        if (!yearlyGroups[year]) {
          yearlyGroups[year] = { returns: [], sum: 0, count: 0 };
        }
        const ret = d.returnPercentage || 0;
        yearlyGroups[year].returns.push(ret);
        yearlyGroups[year].sum += ret;
        yearlyGroups[year].count++;
      });

      return Object.entries(yearlyGroups)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([year, data]) => ({
          date: year,
          returnPercentage: Number((data.sum / data.count).toFixed(4)),
          yearLabel: year,
        }));
    } else {
      // Default: show weekly number average returns (exclude week 0)
      const weekGroups: Record<number, { returns: number[]; sum: number; count: number }> = {};
      
      sourceData.forEach((d: any) => {
        const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
        // Skip week 0 as it's not a valid week
        if (weekNum === 0) return;
        if (!weekGroups[weekNum]) {
          weekGroups[weekNum] = { returns: [], sum: 0, count: 0 };
        }
        const ret = d.returnPercentage || 0;
        weekGroups[weekNum].returns.push(ret);
        weekGroups[weekNum].sum += ret;
        weekGroups[weekNum].count++;
      });

      const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
      return sortedWeeks.map(weekNum => ({
        date: `W${weekNum}`,
        returnPercentage: Number((weekGroups[weekNum].sum / weekGroups[weekNum].count).toFixed(4)),
        weekLabel: weekNum,
      }));
    }
  }, [symbolData?.chartData, filteredChartData, dayRangeSelection.isActive]);

  // Compare pattern returns data - same logic as main symbol
  const comparePatternReturnsData = useMemo(() => {
    const compareSourceData = dayRangeSelection.isActive ? filteredCompareChartData : compareSymbolData?.chartData || [];
    if (!compareSourceData.length) return [];

    if (dayRangeSelection.isActive) {
      // With drag select: show yearly pattern returns
      const yearlyGroups: Record<string, { returns: number[]; sum: number; count: number }> = {};
      
      compareSourceData.forEach((d: any) => {
        const year = new Date(d.date).getFullYear().toString();
        if (!yearlyGroups[year]) {
          yearlyGroups[year] = { returns: [], sum: 0, count: 0 };
        }
        const ret = d.returnPercentage || 0;
        yearlyGroups[year].returns.push(ret);
        yearlyGroups[year].sum += ret;
        yearlyGroups[year].count++;
      });

      return Object.entries(yearlyGroups)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([year, data]) => ({
          date: year,
          returnPercentage: Number((data.sum / data.count).toFixed(4)),
          yearLabel: year,
        }));
    } else {
      // Default: show weekly number average returns (exclude week 0)
      const weekGroups: Record<number, { returns: number[]; sum: number; count: number }> = {};
      
      compareSourceData.forEach((d: any) => {
        const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
        // Skip week 0 as it's not a valid week
        if (weekNum === 0) return;
        if (!weekGroups[weekNum]) {
          weekGroups[weekNum] = { returns: [], sum: 0, count: 0 };
        }
        const ret = d.returnPercentage || 0;
        weekGroups[weekNum].returns.push(ret);
        weekGroups[weekNum].sum += ret;
        weekGroups[weekNum].count++;
      });

      const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
      return sortedWeeks.map(weekNum => ({
        date: `W${weekNum}`,
        returnPercentage: Number((weekGroups[weekNum].sum / weekGroups[weekNum].count).toFixed(4)),
        weekLabel: weekNum,
      }));
    }
  }, [compareSymbolData?.chartData, filteredCompareChartData, dayRangeSelection.isActive]);

  // Aggregate data for aggregate chart mode - grouped by week number
  const aggregateData = useMemo(() => {
    if (!symbolData?.tableData) return [];
    
    const weekGroups: Record<number, number[]> = {};
    
    symbolData.tableData.forEach((d: any) => {
      const weekNum = d[aggregateField] || 0;
      if (!weekGroups[weekNum]) weekGroups[weekNum] = [];
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });
    
    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
    return sortedWeeks.map(week => {
      const values = weekGroups[week] || [];
      const total = values.reduce((sum, val) => sum + val, 0);
      const avg = values.length > 0 ? total / values.length : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;
      const min = values.length > 0 ? Math.min(...values) : 0;
      const posCount = values.filter(v => v > 0).length;
      const negCount = values.filter(v => v <= 0).length;
      
      return {
        field: week,
        total,
        avg,
        max,
        min,
        count: values.length,
        posCount,
        negCount,
        posAccuracy: values.length > 0 ? (posCount / values.length) * 100 : 0,
        negAccuracy: values.length > 0 ? (negCount / values.length) * 100 : 0,
      };
    });
  }, [symbolData?.tableData, aggregateType, aggregateField]);

  // Transform raw table data into weekly statistics format
  const weeklyStatisticsData = useMemo(() => {
    if (!symbolData?.tableData || symbolData.tableData.length === 0) return [];

    const tableData = symbolData.tableData;
    const weekGroups: Record<number, number[]> = {};

    // Group returns by week number
    tableData.forEach((d: any) => {
      const weekNum = d.weekNumberYearly || d.weekNumberMonthly || 0;
      if (!weekGroups[weekNum]) weekGroups[weekNum] = [];
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    // Calculate statistics for each week
    return Object.entries(weekGroups).map(([week, returns]) => {
      const weekNum = parseInt(week);
      const allCount = returns.length;
      const avgReturnAll = returns.reduce((a, b) => a + b, 0) / allCount;
      const sumReturnAll = returns.reduce((a, b) => a + b, 0);

      const positiveReturns = returns.filter((r) => r > 0);
      const negativeReturns = returns.filter((r) => r <= 0);

      const posCount = positiveReturns.length;
      const negCount = negativeReturns.length;

      const avgReturnPos = posCount > 0 ? positiveReturns.reduce((a, b) => a + b, 0) / posCount : 0;
      const avgReturnNeg = negCount > 0 ? negativeReturns.reduce((a, b) => a + b, 0) / negCount : 0;

      const sumReturnPos = positiveReturns.reduce((a, b) => a + b, 0);
      const sumReturnNeg = negativeReturns.reduce((a, b) => a + b, 0);

      return {
        week: weekNum,
        allCount,
        avgReturnAll,
        sumReturnAll,
        posCount,
        posAccuracy: allCount > 0 ? (posCount / allCount) * 100 : 0,
        avgReturnPos,
        sumReturnPos,
        negCount,
        negAccuracy: allCount > 0 ? (negCount / allCount) * 100 : 0,
        avgReturnNeg,
        sumReturnNeg,
      };
    }).sort((a, b) => a.week - b.week);
  }, [symbolData?.tableData]);

  return (
    <div className="flex h-full bg-[#F8F9FB]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* Top Header */}
        <header className="flex-shrink-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: PRIMARY_COLOR }}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {selectedSymbols[0] || 'NIFTY'}
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                Weekly Analysis Engine ({weekType === 'monday' ? 'Monday' : 'Expiry'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Analyze
            </Button>
            <div 
              className="h-10 w-10 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-sm"
              style={{ backgroundColor: PRIMARY_COLOR }}
            >
              {selectedSymbols[0]?.charAt(0) || 'N'}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Strip */}
          {stats && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-5 gap-4"
            >
              <StatCard
                label="TOTAL WEEKS"
                value={stats.totalCount?.toString() || '0'}
                trend="neutral"
                subValue={`${stats.positiveCount || 0} positive`}
                metricKey="totalCount"
                compareValue={compareMode && compareSymbolData?.statistics ? (compareSymbolData.statistics.totalCount || 0).toString() : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
                subValue={`${stats.positiveCount || 0} wins`}
                metricKey="winRate"
                compareValue={compareMode && compareSymbolData?.statistics ? 
                  `${((compareSymbolData.statistics.winRate || 0) - (stats.winRate || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.winRate || 0 - (stats.winRate || 0)).toFixed(1)}%` 
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="AVG RETURN"
                value={`${(stats.avgReturnAll || 0).toFixed(2)}%`}
                trend={(stats.avgReturnAll || 0) >= 0 ? 'up' : 'down'}
                subValue={`Median: ${((stats.sumReturnAll || 0) / (stats.totalCount || 1)).toFixed(2)}%`}
                metricKey="avgReturn"
                compareValue={compareMode && compareSymbolData?.statistics ? 
                  `${((compareSymbolData.statistics.avgReturnAll || 0) - (stats.avgReturnAll || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.avgReturnAll || 0 - (stats.avgReturnAll || 0)).toFixed(2)}%` 
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="CAGR"
                value={`${(stats.cagr || 0).toFixed(2)}%`}
                trend={(stats.cagr || 0) > 0 ? 'up' : 'down'}
                subValue={`Sharpe: ${(stats.sharpeRatio || 0).toFixed(2)}`}
                metricKey="cagr"
                compareValue={compareMode && compareSymbolData?.statistics ? 
                  `${((compareSymbolData.statistics.cagr || 0) - (stats.cagr || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.cagr || 0 - (stats.cagr || 0)).toFixed(2)}%` 
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="MAX DD"
                value={`${Math.abs(stats.maxDrawdown || 0).toFixed(2)}%`}
                trend={(stats.maxDrawdown || 0) > -10 ? 'up' : 'down'}
                subValue={`StdDev: ${(stats.stdDev || 0).toFixed(2)}`}
                metricKey="maxDrawdown"
                compareValue={compareMode && compareSymbolData?.statistics ? 
                  `${((stats.maxDrawdown || 0) - (compareSymbolData.statistics.maxDrawdown || 0)) > 0 ? '+' : ''}${(Math.abs(stats.maxDrawdown || 0) - Math.abs(compareSymbolData.statistics.maxDrawdown || 0)).toFixed(2)}%` 
                  : undefined}
                compareLabel={compareSymbol}
              />
            </motion.div>
          )}

          {/* Chart Mode Selector */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 w-fit shadow-sm"
          >
            {[
              { id: 'superimposed', label: 'Superimposed' },
              { id: 'aggregate', label: 'Aggregate' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveChart(mode.id as any)}
                className={cn(
                  "px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200",
                  activeChart === mode.id
                    ? "text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-50"
                )}
                style={activeChart === mode.id ? { backgroundColor: PRIMARY_COLOR } : {}}
              >
                {mode.label}
              </button>
            ))}
          </motion.div>

          {/* Aggregate Type Selector (only show in aggregate mode) */}
          {activeChart === 'aggregate' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2 shadow-sm">
                <label className="text-xs font-semibold text-slate-600">Field:</label>
                <select
                  value={aggregateField}
                  onChange={(e) => setAggregateField(e.target.value as any)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-amber-400 bg-white"
                >
                  <option value="weekNumberYearly">Yearly Weeks</option>
                  <option value="weekNumberMonthly">Monthly Weeks</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2 shadow-sm">
                <label className="text-xs font-semibold text-slate-600">Type:</label>
                <select
                  value={aggregateType}
                  onChange={(e) => setAggregateType(e.target.value as any)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-amber-400 bg-white"
                >
                  <option value="avg">Average</option>
                  <option value="total">Total</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                </select>
              </div>
            </motion.div>
          )}

          {/* Main Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px] overflow-hidden"
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">
                  {activeChart === 'superimposed' && 'Superimposed Pattern'}
                  {activeChart === 'aggregate' && `Aggregate (${aggregateType === 'avg' ? 'Average' : aggregateType === 'total' ? 'Total' : aggregateType === 'max' ? 'Maximum' : 'Minimum'} by ${aggregateField === 'weekNumberYearly' ? 'Yearly Weeks' : 'Monthly Weeks'})`}
                </h3>
                <InfoTooltip content="Select different chart modes to visualize the data in different ways." />
              </div>
            </div>
            <div className="flex-1 w-full relative p-4">
              {!symbolData ? (
                <PlaceholderState />
              ) : activeChart === 'aggregate' ? (
                <AggregateChart
                  data={aggregateData}
                  symbol={selectedSymbols[0]}
                  aggregateType={aggregateType}
                  fieldType="Weekday"
                  config={{ title: '', height: 320 }}
                />
              ) : (
                <div className="h-full shadow-lg rounded-lg overflow-hidden">
                  <SuperimposedChart
                    data={symbolData.tableData}
                    symbol={selectedSymbols[0]}
                    compareData={compareMode && compareSymbolData?.tableData ? compareSymbolData.tableData : undefined}
                    compareSymbol={compareMode ? compareSymbol : undefined}
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* Secondary Panels - Cumulative & Pattern Returns */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="grid grid-cols-2 gap-6 h-[320px]"
          >
            {/* Cumulative Returns */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">Cumulative Returns</h3>
                  <InfoTooltip content="Shows cumulative returns over time. Drag on chart to filter a specific range." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {symbolData?.chartData?.length > 0 ? (
                  <CumulativeChartWithDragSelect
                    key={`cumulative-${dayRangeSelection.isActive}-${dayRangeSelection.startDay}-${dayRangeSelection.endDay}`}
                    data={cumulativeData}
                    chartScale="linear"
                    chartColor="#f59e0b"
                    compareData={compareMode && compareCumulativeData.length > 0 ? compareCumulativeData : undefined}
                    compareColor="#dc2626"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>

            {/* Pattern Returns */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">
                    {dayRangeSelection.isActive ? 'Yearly Pattern Returns' : 'Avg Return By Weeks (%)'}
                  </h3>
                  <InfoTooltip content={dayRangeSelection.isActive 
                    ? "The bars show the gains and losses generated by the selected pattern in every single year of the time period under review." 
                    : "Average return for each week number across all years in the selected time period."} 
                  />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {patternReturnsData.length > 0 ? (
                  <ReturnBarChart
                    key={`pattern-${dayRangeSelection.isActive}-${dayRangeSelection.startDay}-${dayRangeSelection.endDay}`}
                    data={patternReturnsData}
                    symbol={selectedSymbols[0]}
                    config={{ title: '', height: 240 }}
                    color="#f59e0b"
                    compareData={compareMode && comparePatternReturnsData.length > 0 ? comparePatternReturnsData : undefined}
                    compareSymbol={compareMode ? compareSymbol : undefined}
                    compareColor="#dc2626"
                    chartLabel={dayRangeSelection.isActive ? 'year' : 'week'}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>
          </motion.div>

          {/* DATA TABLE */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <WeeklyDataTable data={weeklyStatisticsData} title={`${selectedSymbols[0] || 'Symbol'} - Weekly Statistics`} />
          </motion.div>
        </div>
      </div>

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={() => refetch()}
        onClear={resetFilters}
        isLoading={isFetching}
        title="Filters"
        subtitle="Configure Analysis"
        primaryColor={PRIMARY_COLOR}
      >
        {/* Market Context */}
        <FilterSection 
          title="Market Context" 
          defaultOpen
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          delay={0}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Asset Class</label>
              <SymbolSelector />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Week Type</label>
              <Select value={weekType} onValueChange={(v) => setWeekType(v as 'monday' | 'expiry')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white shadow-lg">
                  <SelectItem value="monday">Monday Week</SelectItem>
                  <SelectItem value="expiry">Expiry Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FilterSection>

        {/* Compare */}
        <FilterSection 
          title="Compare" 
          defaultOpen
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          delay={0.02}
        >
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
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="compareMode" className="text-sm text-slate-700">Enable comparison</label>
            </div>
            
            {compareMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Compare Symbol</label>
                <select
                  value={compareSymbol}
                  onChange={(e) => setCompareSymbol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-white"
                >
                  <option value="">Select symbol to compare</option>
                  {availableSymbols.map((symbol: { symbol: string; name: string }) => (
                    <option key={symbol.symbol} value={symbol.symbol}>
                      {symbol.symbol}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </FilterSection>

        {/* Time Ranges */}
        <FilterSection 
          title="Time Ranges" 
          defaultOpen
          icon={<Calendar className="h-3.5 w-3.5" />}
          delay={0.05}
        >
          <DateRangePicker />
        </FilterSection>

        {/* Temporal Filters */}
        <FilterSection 
          title="Temporal Filters" 
          icon={<Layers className="h-3.5 w-3.5" />}
          badge={3}
          delay={0.1}
        >
          <div className="space-y-4">
            <YearFilters />
            <MonthFilters />
            <WeekFilters weekType={weekType} />
          </div>
        </FilterSection>

        {/* Advanced Filters */}
        <FilterSection 
          title="Advanced Filters" 
          icon={<LineChart className="h-3.5 w-3.5" />}
          delay={0.15}
        >
          <div className="space-y-4">
            <SpecialDaysFilter />
            <div className="pt-3 border-t border-slate-100">
              <WeeklySuperimposedChartFilter />
            </div>
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}

// Stat Card Component with Metric Tooltip and Comparison Support
function StatCard({ label, value, subValue, trend, metricKey, color, compareValue, compareLabel }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  metricKey?: keyof typeof METRIC_DEFINITIONS;
  color?: string;
  compareValue?: string;
  compareLabel?: string;
}) {
  const metricDef = metricKey ? METRIC_DEFINITIONS[metricKey] : undefined;
  const trendColor = color || (trend === 'up' ? '#f59e0b' : trend === 'down' ? '#dc2626' : undefined);
  
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors shadow-sm hover:shadow-md"
    >
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
        {label}
        {metricKey && <MetricTooltip metric={metricKey} />}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {trend && trend !== 'neutral' && (
            <div className={cn(
              "text-xs font-bold",
              trend === 'up' ? "text-amber-600" : "text-rose-600"
            )}>
              {trend === 'up' ? '↗' : '↘'}
            </div>
          )}
        </div>
        {compareValue && compareLabel && (
          <div className="text-[10px] font-semibold text-red-500 mt-0.5">
            {compareLabel}: {compareValue}
          </div>
        )}
        {subValue && (
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
            {subValue}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Superimposed Chart Component with Drag Select
function SuperimposedChart({ data, symbol, compareData, compareSymbol }: { 
  data: any[]; 
  symbol: string;
  compareData?: any[];
  compareSymbol?: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; week: number; value: number; avgReturn: number; compareValue?: number } | null>(null);
  const [selection, setSelection] = useState<{ startWeek: number | null; endWeek: number | null; isDragging: boolean }>({ startWeek: null, endWeek: null, isDragging: false });
  const { filters } = useAnalysisStore();
  const { setDayRangeSelection, clearDayRangeSelection } = useChartSelectionStore();
  
  const weeklySuperimposedChartType = filters.weeklySuperimposedChartType || 'YearlyWeeks';
  const electionChartTypes = filters.electionChartTypes || ['All Years'];

  const electionYears = {
    'Election Years': [1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019],
    'Pre Election Years': [1951, 1956, 1961, 1966, 1970, 1976, 1979, 1983, 1988, 1990, 1995, 1997, 1998, 2003, 2008, 2013, 2018],
    'Post Election Years': [1953, 1958, 1963, 1968, 1972, 1978, 1981, 1985, 1990, 1992, 1997, 1999, 2000, 2005, 2010, 2015, 2020],
    'Mid Election Years': [1954, 1955, 1959, 1960, 1964, 1965, 1969, 1973, 1974, 1975, 1982, 1986, 1987, 1993, 1994, 2001, 2002, 2006, 2007, 2011, 2012, 2016, 2017, 2021, 2022],
    'Modi Years': [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  };

  // Process data for superimposed chart
  const superimposedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let filteredData = [...data];
    
    if (!electionChartTypes.includes('All Years')) {
      filteredData = data.filter((d: any) => {
        const year = d.year || new Date(d.weekStartDate || d.date).getFullYear();
        const currentYear = new Date().getFullYear();
        
        return electionChartTypes.some(type => {
          if (type === 'Current Year') {
            return year === currentYear;
          } else if (electionYears[type as keyof typeof electionYears]) {
            return electionYears[type as keyof typeof electionYears].includes(year);
          }
          return false;
        });
      });
    }

    const weekGroups: Record<number, number[]> = {};
    const groupByField = weeklySuperimposedChartType === 'YearlyWeeks' ? 'weekNumberYearly' : 'weekNumberMonthly';
    
    filteredData.forEach((d: any) => {
      const weekNum = d[groupByField] || 0;
      // Skip week 0
      if (weekNum === 0) return;
      if (!weekGroups[weekNum]) {
        weekGroups[weekNum] = [];
      }
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 1;
    
    return sortedWeeks.map(weekNum => {
      const avgReturn = weekGroups[weekNum].reduce((sum, val) => sum + val, 0) / weekGroups[weekNum].length;
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      
      return {
        weekNumber: weekNum,
        avgReturn,
        compoundedReturn: (compoundedValue - 1) * 100,
      };
    });
  }, [data, weeklySuperimposedChartType, electionChartTypes]);

  useEffect(() => {
    if (!chartContainerRef.current || superimposedData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#f59e0b',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#f59e0b',
          style: 2,
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false, axisDoubleClickReset: true },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#000000',
      topColor: 'rgba(224, 231, 255, 0.4)',
      bottomColor: 'rgba(224, 231, 255, 0.0)',
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;

    const chartData = superimposedData.map((d: any) => ({
      time: d.weekNumber as any,
      value: d.compoundedReturn,
      avgReturn: d.avgReturn,
    }));

    areaSeries.setData(chartData as any);

    // Add comparison series if provided
    if (compareData && compareData.length > 0 && compareSymbol) {
      const groupByField = weeklySuperimposedChartType === 'YearlyWeeks' ? 'weekNumberYearly' : 'weekNumberMonthly';
      
      const compareWeekGroups: Record<number, number[]> = {};
      compareData.forEach((d: any) => {
        const weekNum = d[groupByField] || 0;
        if (weekNum === 0) return;
        if (!compareWeekGroups[weekNum]) {
          compareWeekGroups[weekNum] = [];
        }
        compareWeekGroups[weekNum].push(d.returnPercentage || 0);
      });

      const sortedCompareWeeks = Object.keys(compareWeekGroups).map(Number).sort((a, b) => a - b);
      let compoundedValue = 1;
      const compareChartData = sortedCompareWeeks.map(weekNum => {
        const avgReturn = compareWeekGroups[weekNum].reduce((sum, val) => sum + val, 0) / compareWeekGroups[weekNum].length;
        compoundedValue = compoundedValue * (1 + avgReturn / 100);
        return { time: weekNum as any, value: (compoundedValue - 1) * 100 };
      });

      const compareSeries = chart.addLineSeries({
        color: '#dc2626',
        lineWidth: 2,
      });
      compareSeries.setData(compareChartData);
    }

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        return `Week ${time}`;
      },
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const dataPoint = param.seriesData.get(areaSeries);
      if (dataPoint) {
        const originalData = superimposedData.find((d: any) => d.weekNumber === param.time);
        
        let compareValue: number | undefined;
        if (compareData && compareData.length > 0) {
          const compareSeriesData = param.seriesData;
          for (const [series, data] of compareSeriesData) {
            const value = (data as any)?.value;
            if (value !== undefined) {
              compareValue = value;
              break;
            }
          }
        }
        
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          week: param.time,
          value: dataPoint.value,
          avgReturn: originalData?.avgReturn || 0,
          compareValue,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [superimposedData, compareData, compareSymbol]);

  // Drag to select handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const timeScale = chartRef.current.timeScale();
    const time = timeScale.coordinateToTime(x);
    
    if (time !== null) {
      setSelection({ startWeek: time as number, endWeek: time as number, isDragging: true });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selection.isDragging || !chartRef.current) return;
    
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const timeScale = chartRef.current.timeScale();
    const time = timeScale.coordinateToTime(x);
    
    if (time !== null) {
      setSelection(prev => ({ ...prev, endWeek: time as number }));
    }
  };

  const handleMouseUp = () => {
    if (!selection.isDragging || !chartRef.current) return;
    
    if (selection.startWeek !== null && selection.endWeek !== null) {
      const minWeek = Math.min(selection.startWeek, selection.endWeek);
      const maxWeek = Math.max(selection.startWeek, selection.endWeek);
      
      setDayRangeSelection({
        startDay: minWeek,
        endDay: maxWeek,
        chartType: weeklySuperimposedChartType,
        isActive: true,
      });
    }
    
    setSelection(prev => ({ ...prev, isDragging: false }));
  };

  const clearSelection = () => {
    setSelection({ startWeek: null, endWeek: null, isDragging: false });
    clearDayRangeSelection();
  };

  // Calculate selection overlay position
  const getSelectionOverlay = () => {
    if (!chartRef.current || selection.startWeek === null || selection.endWeek === null) return null;
    
    const timeScale = chartRef.current.timeScale();
    const startX = timeScale.timeToCoordinate(selection.startWeek);
    const endX = timeScale.timeToCoordinate(selection.endWeek);
    
    if (startX === null || endX === null) return null;
    
    const left = Math.min(startX, endX);
    const width = Math.abs(endX - startX);
    
    return { left, width, display: width > 5 };
  };

  const selectionOverlay = getSelectionOverlay();
  const isSelectionActive = selection.startWeek !== null && selection.endWeek !== null && !selection.isDragging && selectionOverlay?.display;

  return (
    <div className="h-full w-full relative">
      {/* Selection controls */}
      {isSelectionActive && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
            Weeks: {Math.min(selection.startWeek!, selection.endWeek!)} - {Math.max(selection.startWeek!, selection.endWeek!)}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={clearSelection}
            className="bg-white hover:bg-red-50 border-red-200 text-red-600 hover:text-red-700"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Instruction hint */}
      {!selection.isDragging && !isSelectionActive && (
        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm px-3 py-1.5 text-xs text-slate-600 flex items-center gap-2">
          <span>Click and drag to select week range</span>
        </div>
      )}

      <div 
        ref={chartContainerRef} 
        className={cn("h-full w-full relative", selection.isDragging ? "cursor-col-resize" : "cursor-crosshair")}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Selection overlay */}
        {selectionOverlay?.display && (
          <div
            className={cn(
              "absolute top-0 bottom-0 pointer-events-none z-10",
              selection.isDragging ? "opacity-100" : "opacity-80"
            )}
            style={{
              left: `${selectionOverlay.left}px`,
              width: `${selectionOverlay.width}px`,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              borderLeft: '2px solid rgba(245, 158, 11, 0.8)',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      {tooltip && tooltip.visible && !selection.isDragging && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 60}px`,
          }}
        >
          <div className="font-semibold text-slate-700 mb-1">Week {tooltip.week}</div>
          <div className="text-amber-600 font-bold">
            {weeklySuperimposedChartType === 'YearlyWeeks' ? 'YTD' : 'MTD'} Return: {tooltip.value.toFixed(2)}%
          </div>
          <div className="text-slate-600">
            Avg Weekly: {tooltip.avgReturn.toFixed(2)}%
          </div>
          {tooltip.compareValue !== undefined && (
            <div className="text-red-600 font-bold mt-1">
              {compareSymbol}: {tooltip.compareValue.toFixed(2)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Yearly Overlay Chart Component
function YearlyOverlayChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; week: number; values: Array<{ year: string; value: number; color: string }> } | null>(null);
  const { filters } = useAnalysisStore();
  
  const electionChartTypes = filters.electionChartTypes || ['All Years'];

  const electionYears = {
    'Election Years': [1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019],
    'Pre Election Years': [1951, 1956, 1961, 1966, 1970, 1976, 1979, 1983, 1988, 1990, 1995, 1997, 1998, 2003, 2008, 2013, 2018],
    'Post Election Years': [1953, 1958, 1963, 1968, 1972, 1978, 1981, 1985, 1990, 1992, 1997, 1999, 2000, 2005, 2010, 2015, 2020],
    'Mid Election Years': [1954, 1955, 1959, 1960, 1964, 1965, 1969, 1973, 1974, 1975, 1982, 1986, 1987, 1993, 1994, 2001, 2002, 2006, 2007, 2011, 2012, 2016, 2017, 2021, 2022],
    'Modi Years': [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  };

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    let filteredData = [...data];
    
    if (!electionChartTypes.includes('All Years')) {
      filteredData = data.filter((d: any) => {
        const year = d.year || new Date(d.weekStartDate || d.date).getFullYear();
        const currentYear = new Date().getFullYear();
        
        return electionChartTypes.some(type => {
          if (type === 'Current Year') {
            return year === currentYear;
          } else if (electionYears[type as keyof typeof electionYears]) {
            return electionYears[type as keyof typeof electionYears].includes(year);
          }
          return false;
        });
      });
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#f59e0b',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#f59e0b',
          style: 2,
        },
      },
    });

    chartRef.current = chart;

    const yearGroups: Record<number, any[]> = {};
    filteredData.forEach((d: any) => {
      const year = new Date(d.date).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push({
        weekNumber: d.weekNumberYearly || 0,
        returnPercentage: d.returnPercentage || 0,
      });
    });

    const colors = [
      '#f59e0b', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
    ];

    const seriesMap = new Map();

    Object.entries(yearGroups).forEach(([year, yearData], index) => {
      const color = colors[index % colors.length];
      const lineSeries = chart.addLineSeries({
        color,
        lineWidth: 2,
        title: year,
      });

      const lineData = yearData.map((d: any) => ({
        time: d.weekNumber,
        value: d.returnPercentage,
      }));

      lineSeries.setData(lineData);
      seriesMap.set(lineSeries, { year, color });
    });

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        return `Week ${time}`;
      },
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const values: Array<{ year: string; value: number; color: string }> = [];
      
      seriesMap.forEach((info, series) => {
        const dataPoint = param.seriesData.get(series);
        if (dataPoint) {
          values.push({
            year: info.year,
            value: dataPoint.value,
            color: info.color,
          });
        }
      });

      if (values.length > 0) {
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          week: param.time,
          values,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, electionChartTypes]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50 max-h-64 overflow-y-auto"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 80}px`,
          }}
        >
          <div className="font-semibold text-slate-700 mb-2">Week {tooltip.week}</div>
          <div className="space-y-1">
            {tooltip.values.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600">{item.year}:</span>
                </div>
                <span className="font-bold" style={{ color: item.color }}>
                  {item.value.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Cumulative Chart - Simple version without drag select for weekly
function CumulativeChart({ 
  data, 
  chartScale = 'linear',
  chartColor = '#f59e0b',
  compareData,
  compareColor = '#dc2626'
}: { 
  data: any[]; 
  chartScale?: 'linear' | 'log';
  chartColor?: string;
  compareData?: any[];
  compareColor?: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; date: string; value: number; compareValue?: number | null } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: chartColor, style: 2 }, horzLine: { width: 1, color: chartColor, style: 2 } },
      rightPriceScale: {
        borderColor: '#e2e8f0',
      },
      timeScale: { 
        timeVisible: true, 
        secondsVisible: false,
        borderColor: '#e2e8f0',
      },
    });

    chartRef.current = chart;

    const chartData = data.map((d: any) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000) as any,
      value: d.cumulative || 0,
    }));

    const areaSeries = chart.addAreaSeries({
      lineColor: chartColor,
      topColor: `${chartColor}66`,
      bottomColor: `${chartColor}00`,
      lineWidth: 2,
    });

    areaSeries.setData(chartData);

    // Add comparison series if provided
    if (compareData && compareData.length > 0) {
      const compareChartData = compareData.map((d: any) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000) as any,
        value: d.cumulative || 0,
      }));

      const compareSeries = chart.addLineSeries({
        color: compareColor,
        lineWidth: 2,
      });
      compareSeries.setData(compareChartData);
    }

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const seriesData = param.seriesData;
      const firstSeries = seriesData.keys().next().value;
      
      if (firstSeries) {
        const dataPoint = seriesData.get(firstSeries);
        const cumulativeValue = dataPoint?.value ?? 0;
        
        let compareValue: number | null = null;
        if (compareData && compareData.length > 0) {
          const compareSeriesKey = seriesData.keys().next().value;
          if (compareSeriesKey) {
            const compareDataPoint = seriesData.get(compareSeriesKey);
            compareValue = compareDataPoint?.value ?? null;
          }
        }
        
        const dateStr = new Date(param.time * 1000).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          date: dateStr,
          value: cumulativeValue,
          compareValue,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, chartScale, chartColor, compareData, compareColor]);

  return (
    <div ref={chartContainerRef} className="w-full h-full relative">
      {tooltip && tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 50}px`,
          }}
        >
          <div className="font-semibold text-slate-700 mb-1">{tooltip.date}</div>
          <div className={`font-bold`} style={{ color: chartColor }}>
            Cumulative: {tooltip.value.toFixed(2)}%
          </div>
          {tooltip.compareValue !== null && tooltip.compareValue !== undefined && (
            <div className={`font-bold`} style={{ color: compareColor }}>
              Compare: {tooltip.compareValue.toFixed(2)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
