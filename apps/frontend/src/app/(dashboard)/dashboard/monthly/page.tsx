'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, BarChart3, Activity, Filter,
  ChevronDown, Download, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Settings, LogOut, Calendar, Zap, HelpCircle
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore, filterDataByDayRange } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
import { ChartResizeWrapper } from '@/components/charts/ChartResizeWrapper';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, TAB_COLORS } from '@/lib/utils';

import {
  SymbolSelector,
  DateRangePicker,
  YearFilters,
  MonthFilters,
  OutlierFilters,
  SuperimposedChartFilter
} from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/MetricTooltip';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-purple-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

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
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-purple-600 transition-colors" />
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

const TAB_COLOR = TAB_COLORS.monthly;

function PlaceholderState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
      <Zap className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm font-medium">Select a symbol to begin analysis</p>
      <p className="text-xs mt-1 opacity-70">Choose filters and click analyze</p>
    </div>
  );
}

export default function MonthlyPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, filters, chartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection, dayRangeSelection } = useChartSelectionStore();
  const [monthType, setMonthType] = useState<'calendar' | 'expiry'>('calendar');
  const [filterOpen, setFilterOpen] = useState(true);

  // Chart mode toggle
  const [chartMode, setChartMode] = useState<'superimposed' | 'yearly' | 'aggregate'>('superimposed');
  const [aggregateType, setAggregateType] = useState<'total' | 'avg' | 'max' | 'min'>('avg');

  // Table tab state
  const [activeTableTab, setActiveTableTab] = useState<'historically' | 'summary' | 'yearly'>('historically');
  const [historicallyTrendingMonth, setHistoricallyTrendingMonth] = useState<string>('April');
  const [historicallyTrendingTrend, setHistoricallyTrendingTrend] = useState<'Bullish' | 'Bearish'>('Bullish');

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('');

  // Serialize filters for proper query key change detection
  const filtersKey = JSON.stringify(filters);

  // Fetch available symbols for compare dropdown
  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols || [];
    },
  });

  const availableSymbols = symbolsData || [];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['monthly-analysis', selectedSymbols, startDate, endDate, filtersKey, monthType, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.monthly({
        symbol: selectedSymbols[0],
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        monthType,
        filters,
        chartScale,
      });
      return response.data.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  // Compare symbol data
  const { data: compareData } = useQuery({
    queryKey: ['monthly-analysis', compareSymbol, startDate, endDate, filtersKey, monthType, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      if (!compareSymbol) return null;
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.monthly({
        symbol: compareSymbol,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        monthType,
        filters,
        chartScale,
      });
      return response.data.data;
    },
    enabled: compareMode && !!compareSymbol,
  });

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;
  const compareSymbolData = compareData?.[compareSymbol];

  // Filter data by day range if active (for superimposed chart selection)
  const filteredChartData = useMemo(() => {
    if (!symbolData?.chartData) return [];
    return filterDataByDayRange(symbolData.chartData, dayRangeSelection, filters.superimposedChartType || 'CalendarMonthDays');
  }, [symbolData?.chartData, dayRangeSelection, filters.superimposedChartType]);

  // Filtered compare chart data
  const filteredCompareChartData = useMemo(() => {
    if (!compareSymbolData?.chartData) return [];
    return filterDataByDayRange(compareSymbolData.chartData, dayRangeSelection, filters.superimposedChartType || 'CalendarMonthDays');
  }, [compareSymbolData?.chartData, dayRangeSelection, filters.superimposedChartType]);

  // Compare cumulative data
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

  // Filtered stats based on day range selection
  const filteredStats = useMemo(() => {
    if (!dayRangeSelection.isActive || filteredChartData.length === 0) {
      return stats;
    }

    const returns = filteredChartData.map((d: any) => d.returnPercentage || 0);
    if (returns.length === 0) return stats;

    const totalCount = returns.length;
    const positiveCount = returns.filter((r: number) => r > 0).length;
    const negativeCount = returns.filter((r: number) => r < 0).length;
    const winRate = (positiveCount / totalCount) * 100;
    const avgReturnAll = returns.reduce((a: number, b: number) => a + b, 0) / totalCount;
    const sumReturnAll = returns.reduce((a: number, b: number) => a + b, 0);

    return {
      ...stats,
      totalCount,
      positiveCount,
      negativeCount,
      winRate,
      avgReturnAll,
      sumReturnAll,
    };
  }, [stats, filteredChartData, dayRangeSelection.isActive]);

  // Prepare cumulative data using filtered data
  const cumulativeData = useMemo(() => {
    if (!filteredChartData.length) return [];
    let cumulative = 100;
    return filteredChartData.map((point: any) => {
      const returnPct = point.returnPercentage || 0;
      cumulative = cumulative * (1 + returnPct / 100);
      return {
        date: point.date,
        returnPercentage: returnPct,
        cumulative: Number(cumulative.toFixed(4)),
      };
    });
  }, [filteredChartData]);

  // Pattern Returns - shows different data based on drag selection state
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
      // Default: show monthly average returns (Jan-Dec)
      const monthGroups: Record<number, { returns: number[]; sum: number; count: number }> = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      sourceData.forEach((d: any) => {
        const month = new Date(d.date).getMonth();
        if (!monthGroups[month]) {
          monthGroups[month] = { returns: [], sum: 0, count: 0 };
        }
        const ret = d.returnPercentage || 0;
        monthGroups[month].returns.push(ret);
        monthGroups[month].sum += ret;
        monthGroups[month].count++;
      });

      return Array.from({ length: 12 }, (_, i) => {
        const data = monthGroups[i];
        const avgReturn = data ? data.sum / data.count : 0;
        return {
          date: `${monthNames[i]}`,
          returnPercentage: Number(avgReturn.toFixed(4)),
          monthLabel: monthNames[i],
        };
      });
    }
  }, [symbolData?.chartData, filteredChartData, dayRangeSelection.isActive]);

  // Compare Pattern Returns
  const comparePatternReturnsData = useMemo(() => {
    const compareSourceData = dayRangeSelection.isActive ? filteredCompareChartData : compareSymbolData?.chartData || [];
    if (!compareSourceData.length) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthGroups: Record<number, { returns: number[]; sum: number; count: number }> = {};

    compareSourceData.forEach((d: any) => {
      const month = new Date(d.date).getMonth();
      if (!monthGroups[month]) {
        monthGroups[month] = { returns: [], sum: 0, count: 0 };
      }
      const ret = d.returnPercentage || 0;
      monthGroups[month].returns.push(ret);
      monthGroups[month].sum += ret;
      monthGroups[month].count++;
    });

    return Array.from({ length: 12 }, (_, i) => {
      const data = monthGroups[i];
      const avgReturn = data ? data.sum / data.count : 0;
      return {
        date: `${monthNames[i]}`,
        returnPercentage: Number(avgReturn.toFixed(4)),
        monthLabel: monthNames[i],
      };
    });
  }, [compareSymbolData?.chartData, filteredCompareChartData, dayRangeSelection.isActive]);

  // Aggregate data for aggregate chart mode
  const aggregateData = useMemo(() => {
    if (!symbolData?.chartData) return [];

    const monthGroups: Record<number, number[]> = {};
    symbolData.chartData.forEach((d: any) => {
      const month = new Date(d.date).getMonth();
      if (!monthGroups[month]) monthGroups[month] = [];
      monthGroups[month].push(d.returnPercentage || 0);
    });

    const monthOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    return monthOrder.map(month => {
      const values = monthGroups[month] || [];
      let aggregatedValue: number;

      if (values.length === 0) {
        aggregatedValue = 0;
      } else {
        switch (aggregateType) {
          case 'total':
            aggregatedValue = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'max':
            aggregatedValue = Math.max(...values);
            break;
          case 'min':
            aggregatedValue = Math.min(...values);
            break;
          case 'avg':
          default:
            aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            break;
        }
      }

      return {
        month,
        value: aggregatedValue,
        count: values.length,
      };
    });
  }, [symbolData?.chartData, aggregateType]);

  // Month Summary Cards Data (Best, Worst, Consistent)
  const monthSummaryData = useMemo(() => {
    if (!symbolData?.chartData) return null;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthGroups: Record<number, { returns: number[]; sum: number; count: number; wins: number }> = {};

    symbolData.chartData.forEach((d: any) => {
      const month = new Date(d.date).getMonth();
      if (!monthGroups[month]) {
        monthGroups[month] = { returns: [], sum: 0, count: 0, wins: 0 };
      }
      const ret = d.returnPercentage || 0;
      monthGroups[month].returns.push(ret);
      monthGroups[month].sum += ret;
      monthGroups[month].count++;
      if (ret > 0) monthGroups[month].wins++;
    });

    const monthStats = Array.from({ length: 12 }, (_, i) => {
      const data = monthGroups[i];
      if (!data) return null;
      const avgReturn = data.sum / data.count;
      const winRate = (data.wins / data.count) * 100;
      return {
        month: i + 1,
        monthName: monthNames[i],
        avgReturn,
        winRate,
        totalCount: data.count,
        wins: data.wins,
      };
    }).filter(Boolean) as Array<{ month: number; monthName: string; avgReturn: number; winRate: number; totalCount: number; wins: number }>;

    // Find best month (highest avg return)
    const bestMonth = monthStats.reduce((best, current) =>
      current.avgReturn > best.avgReturn ? current : best, monthStats[0]);

    // Find worst month (lowest avg return)
    const worstMonth = monthStats.reduce((worst, current) =>
      current.avgReturn < worst.avgReturn ? current : worst, monthStats[0]);

    // Find consistent month (highest win rate)
    const consistentMonth = monthStats.reduce((best, current) =>
      current.winRate > best.winRate ? current : best, monthStats[0]);

    return { bestMonth, worstMonth, consistentMonth, allMonths: monthStats };
  }, [symbolData?.chartData]);

  // Historically Trending Months Table Data
  const historicallyTrendingData = useMemo(() => {
    if (!symbolData?.chartData) return [];

    const monthNameToIndex: Record<string, number> = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
      'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    const targetMonth = monthNameToIndex[historicallyTrendingMonth];

    const isBullish = historicallyTrendingTrend === 'Bullish';

    // Group by year
    const yearGroups: Record<number, any[]> = {};
    symbolData.chartData.forEach((d: any) => {
      const date = new Date(d.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      if (month === targetMonth) {
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(d);
      }
    });

    return Object.entries(yearGroups)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([year, data]) => {
        const avgReturn = data.reduce((sum, d) => sum + (d.returnPercentage || 0), 0) / data.length;
        const isPositive = avgReturn > 0;
        const matchesTrend = isBullish ? isPositive : !isPositive;
        return {
          year: parseInt(year),
          month: historicallyTrendingMonth,
          avgReturn,
          isPositive,
          matchesTrend,
        };
      })
      .filter(d => isBullish ? d.isPositive : !d.isPositive)
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [symbolData?.chartData, historicallyTrendingMonth, historicallyTrendingTrend]);

  // Monthly Summary Table Data
  const monthlySummaryData = useMemo(() => {
    if (!symbolData?.chartData) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthGroups: Record<number, { returns: number[]; sum: number; count: number; wins: number; losses: number }> = {};

    symbolData.chartData.forEach((d: any) => {
      const month = new Date(d.date).getMonth();
      if (!monthGroups[month]) {
        monthGroups[month] = { returns: [], sum: 0, count: 0, wins: 0, losses: 0 };
      }
      const ret = d.returnPercentage || 0;
      monthGroups[month].returns.push(ret);
      monthGroups[month].sum += ret;
      monthGroups[month].count++;
      if (ret > 0) monthGroups[month].wins++;
      else monthGroups[month].losses++;
    });

    return Array.from({ length: 12 }, (_, i) => {
      const data = monthGroups[i];
      if (!data) return null;
      const avgReturn = data.sum / data.count;
      const winRate = (data.wins / data.count) * 100;
      return {
        month: monthNames[i],
        avgReturn,
        winRate,
        positive: data.wins,
        negative: data.losses,
        total: data.count,
      };
    }).filter(Boolean);
  }, [symbolData?.chartData]);

  // Year on Year Returns Table Data
  const yearOnYearData = useMemo(() => {
    if (!symbolData?.chartData) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group by year first
    const yearGroups: Record<number, Record<number, number[]>> = {};

    symbolData.chartData.forEach((d: any) => {
      const date = new Date(d.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      if (!yearGroups[year]) {
        yearGroups[year] = {};
      }
      if (!yearGroups[year][month]) {
        yearGroups[year][month] = [];
      }
      yearGroups[year][month].push(d.returnPercentage || 0);
    });

    return Object.entries(yearGroups)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([year, months]) => {
        const returns: Record<string, number> = {};
        let yearlyTotal = 0;
        let yearlyCount = 0;

        monthNames.forEach((m, idx) => {
          const monthReturns = months[idx] || [];
          if (monthReturns.length > 0) {
            const avg = monthReturns.reduce((a, b) => a + b, 0) / monthReturns.length;
            returns[m] = avg;
            yearlyTotal += avg;
            yearlyCount++;
          } else {
            returns[m] = 0;
          }
        });

        return {
          year: parseInt(year),
          ...returns,
          yearlyTotal: yearlyCount > 0 ? yearlyTotal / yearlyCount : 0,
        };
      });
  }, [symbolData?.chartData]);

  // Download table data as CSV
  const downloadCSV = () => {
    if (!symbolData?.chartData) return;

    const csvData = symbolData.chartData.map((row: any) => ({
      Date: new Date(row.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      'Return %': row.returnPercentage?.toFixed(2),
      'Cumulative': row.cumulative?.toFixed(2),
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map((row: any) => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `${selectedSymbols[0]}_monthly_${monthType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const symbol = selectedSymbols[0] || 'NIFTY';

  return (
    <div className="flex h-full bg-[#F8F9FB]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* HEADER */}
        <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-purple-600 fill-purple-200" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                {symbol}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Monthly Analysis Engine</p>
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
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {symbol?.charAt(0) || 'N'}
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1800px] mx-auto w-full">

          {/* STATS STRIP */}
          {(dayRangeSelection.isActive ? filteredStats : stats) && (
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="TOTAL MONTHS"
                value={(dayRangeSelection.isActive ? filteredStats : stats)?.totalCount?.toString() || '0'}
                trend="neutral"
                subValue={`${(dayRangeSelection.isActive ? filteredStats : stats)?.positiveCount || 0} positive`}
                metricKey="totalCount"
                compareValue={compareMode && compareSymbolData?.statistics ? (compareSymbolData.statistics.totalCount || 0).toString() : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="WIN RATE"
                value={`${((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0).toFixed(1)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0) > 50 ? 'up' : 'down'}
                subValue={`${(dayRangeSelection.isActive ? filteredStats : stats)?.positiveCount || 0} wins`}
                metricKey="winRate"
                compareValue={compareMode && compareSymbolData?.statistics ?
                  `${((compareSymbolData.statistics.winRate || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.winRate || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.winRate || 0)).toFixed(1)}%`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="AVG RETURN"
                value={`${((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturnAll || 0).toFixed(2)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturnAll || 0) >= 0 ? 'up' : 'down'}
                subValue={`Median: ${(((dayRangeSelection.isActive ? filteredStats : stats)?.sumReturnAll || 0) / ((dayRangeSelection.isActive ? filteredStats : stats)?.totalCount || 1)).toFixed(2)}%`}
                metricKey="avgReturn"
                compareValue={compareMode && compareSymbolData?.statistics ?
                  `${((compareSymbolData.statistics.avgReturnAll || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturnAll || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.avgReturnAll || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.avgReturnAll || 0)).toFixed(2)}%`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="CAGR"
                value={`${((dayRangeSelection.isActive ? filteredStats : stats)?.cagr || 0).toFixed(2)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.cagr || 0) > 0 ? 'up' : 'down'}
                subValue={`Sharpe: ${((dayRangeSelection.isActive ? filteredStats : stats)?.sharpeRatio || 0).toFixed(2)}`}
                metricKey="cagr"
                compareValue={compareMode && compareSymbolData?.statistics ?
                  `${((compareSymbolData.statistics.cagr || 0) - ((dayRangeSelection.isActive ? filteredStats : stats)?.cagr || 0)) > 0 ? '+' : ''}${(compareSymbolData.statistics.cagr || 0 - ((dayRangeSelection.isActive ? filteredStats : stats)?.cagr || 0)).toFixed(2)}%`
                  : undefined}
                compareLabel={compareSymbol}
              />
              <StatCard
                label="MAX DD"
                value={`${Math.abs((dayRangeSelection.isActive ? filteredStats : stats)?.maxDrawdown || 0).toFixed(2)}%`}
                trend={((dayRangeSelection.isActive ? filteredStats : stats)?.maxDrawdown || 0) > -10 ? 'up' : 'down'}
                subValue={`StdDev: ${((dayRangeSelection.isActive ? filteredStats : stats)?.stdDev || 0).toFixed(2)}`}
                metricKey="maxDrawdown"
              />
            </div>
          )}

          {/* MAIN CHART - Chart Mode Toggle + Chart */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[450px] overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {chartMode === 'superimposed' ? 'Superimposed Pattern' : chartMode === 'yearly' ? 'Yearly Overlay' : `${aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1)} by Month`}
                </h3>
                <InfoTooltip content={chartMode === 'superimposed' ? "Shows average pattern across all years overlaid as a single compounded line. Click and drag to select a time range." : chartMode === 'yearly' ? "Shows each year's pattern overlaid on the same chart." : "Shows aggregated values (Total/Avg/Max/Min) for each month across all years."} />
              </div>
              <div className="flex items-center gap-3">
                {/* Chart Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                  <button
                    onClick={() => setChartMode('superimposed')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      chartMode === 'superimposed'
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    )}
                  >
                    Superimposed
                  </button>
                  <button
                    onClick={() => setChartMode('yearly')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      chartMode === 'yearly'
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    )}
                  >
                    Yearly
                  </button>
                  <button
                    onClick={() => setChartMode('aggregate')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      chartMode === 'aggregate'
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    )}
                  >
                    Aggregate
                  </button>
                </div>

                {/* Aggregate Type Selector (only show in aggregate mode) */}
                {chartMode === 'aggregate' && (
                  <select
                    value={aggregateType}
                    onChange={(e) => setAggregateType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-purple-400 bg-white"
                  >
                    <option value="avg">Average</option>
                    <option value="total">Total</option>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex-1 w-full relative p-4">
              <ChartResizeWrapper>
                {data ? (
                  chartMode === 'superimposed' ? (
                    <SuperimposedChartWithDragSelect
                      data={symbolData?.chartData || []}
                      symbol={symbol}
                      compareData={compareMode && compareSymbolData?.chartData ? compareSymbolData.chartData : undefined}
                      compareSymbol={compareMode ? compareSymbol : undefined}
                    />
                  ) : chartMode === 'yearly' ? (
                    <YearlyOverlayChart
                      data={symbolData?.chartData || []}
                      symbol={symbol}
                    />
                  ) : (
                    <AggregateChart
                      data={symbolData?.chartData || []}
                      aggregateType={aggregateType}
                    />
                  )
                ) : (
                  <PlaceholderState />
                )}
              </ChartResizeWrapper>
            </div>
          </div>

          {/* SECONDARY PANELS - Cumulative Return & Pattern Returns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[320px]">
            {/* Cumulative Return Chart */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Cumulative Returns</h3>
                  <InfoTooltip content="Cumulative compounded return over the selected period." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                <ChartResizeWrapper>
                  {data ? (
                    <CumulativeChartWithDragSelect
                      data={cumulativeData}
                      chartScale={chartScale}
                      chartColor={TAB_COLOR.accent}
                      enableDragSelect={false}
                      compareData={compareMode && compareCumulativeData.length > 0 ? compareCumulativeData : undefined}
                      compareColor="#580060ff"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                  )}
                </ChartResizeWrapper>
              </div>
            </div>

            {/* Pattern Returns */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {dayRangeSelection.isActive ? 'Yearly Pattern Returns' : 'Avg Return By Months (%)'}
                  </h3>
                  <InfoTooltip content={dayRangeSelection.isActive
                    ? "The bars show the gains and losses generated by the selected pattern in every single year of the time period under review."
                    : "Average return for each calendar month across all years in the selected time period."}
                  />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                <ChartResizeWrapper>
                  {patternReturnsData.length > 0 ? (
                    <ReturnBarChart
                      data={patternReturnsData}
                      symbol={symbol}
                      config={{ title: '', height: 240 }}
                      color={TAB_COLOR.accent}
                      chartLabel={dayRangeSelection.isActive ? 'year' : 'month'}
                      compareData={compareMode && comparePatternReturnsData.length > 0 ? comparePatternReturnsData : undefined}
                      compareSymbol={compareMode ? compareSymbol : undefined}
                      compareColor="#580060ff"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                  )}
                </ChartResizeWrapper>
              </div>
            </div>
          </div>

          {/* DATA TABLE SECTION */}
          <div className="space-y-4">
            {/* Month Summary Cards */}
            {monthSummaryData && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Best Month</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-bold text-emerald-600">{monthSummaryData.bestMonth.monthName}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Avg: {monthSummaryData.bestMonth.avgReturn.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Worst Month</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-bold text-red-600">{monthSummaryData.worstMonth.monthName}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Avg: {monthSummaryData.worstMonth.avgReturn.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Consistent</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-bold text-purple-600">{monthSummaryData.consistentMonth.monthName}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Win Rate: {monthSummaryData.consistentMonth.winRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Data Tables */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              {/* Table Tabs */}
              <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-1">
                  {[
                    { id: 'historically', label: 'Historically Trending' },
                    { id: 'summary', label: 'Monthly Summary' },
                    { id: 'yearly', label: 'Year on Year' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTableTab(tab.id as any)}
                      className={cn(
                        "px-4 py-2 text-xs font-medium rounded-md transition-colors",
                        activeTableTab === tab.id
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-white hover:shadow-sm"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Historically Trending Filters */}
              {activeTableTab === 'historically' && (
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Month:</label>
                    <Select value={historicallyTrendingMonth} onValueChange={setHistoricallyTrendingMonth}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white shadow-lg">
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Trend:</label>
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200">
                      <button
                        onClick={() => setHistoricallyTrendingTrend('Bullish')}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                          historicallyTrendingTrend === 'Bullish'
                            ? "bg-emerald-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        Bullish
                      </button>
                      <button
                        onClick={() => setHistoricallyTrendingTrend('Bearish')}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                          historicallyTrendingTrend === 'Bearish'
                            ? "bg-red-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        Bearish
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Content */}
              <div className="overflow-auto max-h-[400px]">
                {activeTableTab === 'historically' && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Avg Return %</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-700">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicallyTrendingData.map((row: any) => (
                        <tr key={row.year} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-700">{row.year}</td>
                          <td className="px-4 py-2 text-slate-600">{row.month}</td>
                          <td className={cn(
                            "px-4 py-2 text-right font-bold",
                            row.isPositive ? "text-green-600" : "text-red-600"
                          )}>
                            {row.avgReturn.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              row.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              {row.isPositive ? "Profit" : "Loss"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {historicallyTrendingData.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                            No data found for the selected filters
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'summary' && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Avg Return %</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Win Rate %</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Positive</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Negative</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummaryData.map((row: any) => (
                        <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-700">{row.month}</td>
                          <td className={cn(
                            "px-4 py-2 text-right font-bold",
                            row.avgReturn >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {row.avgReturn.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">{row.winRate.toFixed(1)}%</td>
                          <td className="px-4 py-2 text-right text-green-600">{row.positive}</td>
                          <td className="px-4 py-2 text-right text-red-600">{row.negative}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTableTab === 'yearly' && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                          <th key={m} className="px-2 py-3 text-center font-semibold text-slate-700">{m}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Yearly %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearOnYearData.map((row: any) => (
                        <tr key={row.year} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-700">{row.year}</td>
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                            <td key={m} className={cn(
                              "px-2 py-2 text-center text-xs font-medium",
                              row[m] > 0 ? "text-green-600" : row[m] < 0 ? "text-red-600" : "text-slate-400"
                            )}>
                              {row[m] !== 0 ? `${row[m].toFixed(2)}%` : '-'}
                            </td>
                          ))}
                          <td className={cn(
                            "px-4 py-2 text-right font-bold",
                            row.yearlyTotal > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {row.yearlyTotal.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                      {yearOnYearData.length === 0 && (
                        <tr>
                          <td colSpan={14} className="px-4 py-8 text-center text-slate-400">
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
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
        title="Filters"
        subtitle="Configure Analysis"
        primaryColor={TAB_COLOR.accent}
      >
        <FilterSection title="Symbol" defaultOpen delay={0}>
          <div className="pt-1">
            <SymbolSelector />
          </div>
        </FilterSection>

        <FilterSection title="Month Type" defaultOpen delay={0.02}>
          <div className="pt-1">
            <Select value={monthType} onValueChange={(v) => setMonthType(v as 'calendar' | 'expiry')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-lg">
                <SelectItem value="calendar">Calendar Month</SelectItem>
                <SelectItem value="expiry">Expiry Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterSection>

        <FilterSection title="Compare" defaultOpen delay={0.02}>
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
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="compareMode" className="text-sm text-slate-700">Enable comparison</label>
            </div>

            {compareMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Compare Symbol</label>
                <select
                  value={compareSymbol}
                  onChange={(e) => setCompareSymbol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white"
                >
                  <option value="">Select symbol to compare</option>
                  {availableSymbols.map((sym: any) => (
                    <option key={sym.symbol} value={sym.symbol}>
                      {sym.symbol}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </FilterSection>

        <FilterSection title="Time Range" defaultOpen delay={0.05}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(e.target.value, useAnalysisStore.getState().endDate)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(useAnalysisStore.getState().startDate, e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Year Filters" delay={0.1}>
          <YearFilters />
        </FilterSection>

        <FilterSection title="Month Filters" delay={0.15}>
          <MonthFilters />
        </FilterSection>

        <FilterSection title="Outlier Filters" delay={0.1}>
          <OutlierFilters />
        </FilterSection>

        <FilterSection title="Chart Type" delay={0.15}>
          <SuperimposedChartFilter />
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

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
            <span className="text-[10px] font-semibold text-purple-600">{compareLabel || 'VS'}:</span>
            <span className="text-xs font-bold text-purple-700">{compareValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Superimposed Chart with Drag-to-Select
function SuperimposedChartWithDragSelect({
  data,
  symbol,
  compareData,
  compareSymbol
}: {
  data: any[];
  symbol: string;
  compareData?: any[];
  compareSymbol?: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; month: number; value: number; avgReturn: number; compareValue?: number | null } | null>(null);
  const [selection, setSelection] = useState<{ startMonth: number | null; endMonth: number | null; isDragging: boolean }>({ startMonth: null, endMonth: null, isDragging: false });
  const { filters } = useAnalysisStore();
  const { setDayRangeSelection, clearDayRangeSelection } = useChartSelectionStore();

  const superimposedChartType = filters.superimposedChartType || 'CalendarMonthDays';

  // Process data for superimposed chart - grouped by months
  const superimposedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const dataWithMonthDays = data.map((d, idx) => {
      const date = new Date(d.date);
      let tradingMonthDay = 1;
      let calendarMonthDay = date.getDate();
      for (let i = 0; i < idx; i++) {
        const prevDate = new Date(data[i].date);
        if (prevDate.getFullYear() === date.getFullYear() && prevDate.getMonth() === date.getMonth()) tradingMonthDay++;
      }
      return { ...d, tradingMonthDay, calendarMonthDay };
    });

    const monthGroups: Record<number, number[]> = {};
    dataWithMonthDays.forEach((d: any) => {
      const date = new Date(d.date);
      let dayKey: number;
      switch (superimposedChartType) {
        case 'CalendarMonthDays':
          dayKey = date.getDate();
          break;
        case 'TradingMonthDays':
          dayKey = d.tradingMonthDay;
          break;
        default:
          dayKey = date.getDate();
      }
      const month = date.getMonth();
      if (!monthGroups[month]) monthGroups[month] = [];
      monthGroups[month].push(d.returnPercentage || 0);
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let compoundedValue = 1;

    return Array.from({ length: 12 }, (_, monthIdx) => {
      const monthData = monthGroups[monthIdx] || [];
      const avgReturn = monthData.length > 0
        ? monthData.reduce((sum, r) => sum + r, 0) / monthData.length
        : 0;

      compoundedValue = compoundedValue * (1 + avgReturn / 100);

      return {
        month: monthIdx + 1,
        monthName: monthNames[monthIdx],
        avgReturn,
        compoundedReturn: (compoundedValue - 1) * 100,
        count: monthData.length,
      };
    });
  }, [data, superimposedChartType]);

  useEffect(() => {
    if (!chartContainerRef.current || !superimposedData.length) return;

    try {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    } catch (e) {
      // Chart might already be disposed
      chartRef.current = null;
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
          color: '#9333EA',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#9333EA',
          style: 2,
        },
      },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false, axisDoubleClickReset: true },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#000000',
      topColor: 'rgba(147, 51, 234, 0.3)',
      bottomColor: 'rgba(147, 51, 234, 0.0)',
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;

    const chartData = superimposedData.map((d: any) => ({
      time: d.month as any,
      value: d.compoundedReturn,
      avgReturn: d.avgReturn,
    }));

    areaSeries.setData(chartData as any);

    // Add comparison symbol
    if (compareData && compareData.length > 0 && compareSymbol) {
      const compareMonthGroups: Record<number, number[]> = {};
      compareData.forEach((d: any) => {
        const date = new Date(d.date);
        const month = date.getMonth();
        if (!compareMonthGroups[month]) compareMonthGroups[month] = [];
        compareMonthGroups[month].push(d.returnPercentage || 0);
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let compoundedValue = 1;
      const compareChartData = Array.from({ length: 12 }, (_, monthIdx) => {
        const monthData = compareMonthGroups[monthIdx] || [];
        const avgReturn = monthData.length > 0
          ? monthData.reduce((sum, r) => sum + r, 0) / monthData.length
          : 0;
        compoundedValue = compoundedValue * (1 + avgReturn / 100);
        return {
          time: (monthIdx + 1) as any,
          value: (compoundedValue - 1) * 100,
        };
      });

      const compareSeries = chart.addLineSeries({
        color: '#00534cff',
        lineWidth: 3,
        title: compareSymbol,
      });
      compareSeries.setData(compareChartData as any);
    }

    chart.timeScale().fitContent();

    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[time - 1] || '';
      },
    });

    // Tooltip handler
    chart.subscribeCrosshairMove((param: any) => {
      if (!chartRef.current || !param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const dataPoint = param.seriesData.get(areaSeries);
      let compareValue: number | null = null;

      if (compareSymbol && compareData) {
        try {
          const compareSeries = chartRef.current.series().find((s: any) => s.name() === compareSymbol);
          if (compareSeries) {
            const compareDataPoint = param.seriesData.get(compareSeries);
            if (compareDataPoint) {
              compareValue = compareDataPoint.value;
            }
          }
        } catch (e) {
          // Chart might be disposed
        }
      }

      if (dataPoint) {
        const originalData = superimposedData.find((d: any) => d.month === param.time);

        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          month: param.time,
          value: dataPoint.value,
          avgReturn: originalData?.avgReturn || 0,
          compareValue,
        });
      }
    });

    const handleResize = () => {
      try {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      } catch (e) {
        // Chart might be disposed
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      try {
        chart.remove();
      } catch (e) {
        // Chart might already be disposed
      }
    };
  }, [superimposedData, compareData, compareSymbol]);

  // Drag to select handlers - same as daily page
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    try {
      const x = e.clientX - rect.left;
      const timeScale = chartRef.current.timeScale();
      const time = timeScale.coordinateToTime(x);

      if (time !== null) {
        setSelection({ startMonth: time as number, endMonth: time as number, isDragging: true });
      }
    } catch (err) {
      // Chart might be disposed
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selection.isDragging || !chartRef.current) return;

    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    try {
      const x = e.clientX - rect.left;
      const timeScale = chartRef.current.timeScale();
      const time = timeScale.coordinateToTime(x);

      if (time !== null) {
        setSelection(prev => ({ ...prev, endMonth: time as number }));
      }
    } catch (err) {
      // Chart might be disposed
    }
  };

  const handleMouseUp = () => {
    if (!selection.isDragging || !chartRef.current) return;

    try {
      if (selection.startMonth !== null && selection.endMonth !== null) {
        const minMonth = Math.min(selection.startMonth, selection.endMonth);
        const maxMonth = Math.max(selection.startMonth, selection.endMonth);

        setDayRangeSelection({
          startDay: minMonth,
          endDay: maxMonth,
          chartType: 'CalendarMonthDays',
          isActive: true,
        });
      }
    } catch (err) {
      // Chart might be disposed
    }

    setSelection(prev => ({ ...prev, isDragging: false }));
  };

  const clearSelection = () => {
    setSelection({ startMonth: null, endMonth: null, isDragging: false });
    clearDayRangeSelection();
  };

  // Calculate selection overlay position
  const getSelectionOverlay = () => {
    if (!chartRef.current || selection.startMonth === null || selection.endMonth === null) return null;

    try {
      const timeScale = chartRef.current.timeScale();
      const startX = timeScale.timeToCoordinate(selection.startMonth);
      const endX = timeScale.timeToCoordinate(selection.endMonth);

      if (startX === null || endX === null) return null;

      const left = Math.min(startX, endX);
      const width = Math.abs(endX - startX);

      return { left, width, display: width > 5 };
    } catch (err) {
      return null;
    }
  };

  const selectionOverlay = getSelectionOverlay();
  const isSelectionActive = selection.startMonth !== null && selection.endMonth !== null && !selection.isDragging && selectionOverlay?.display;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="h-full w-full relative">
      {/* Selection controls */}
      {isSelectionActive && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
            Months: {monthNames[Math.min(selection.startMonth!, selection.endMonth!) - 1]} - {monthNames[Math.max(selection.startMonth!, selection.endMonth!) - 1]}
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
          <span>Click and drag to select range</span>
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
              backgroundColor: 'rgba(147, 51, 234, 0.15)',
              borderLeft: '2px solid rgba(147, 51, 234, 0.8)',
              borderRight: '2px solid rgba(147, 51, 234, 0.8)',
            }}
          />
        )}

        {/* Tooltip (only show when not selecting) */}
        {tooltip && tooltip.visible && !selection.isDragging && (
          <div
            className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50"
            style={{
              left: `${tooltip.x + 10}px`,
              top: `${tooltip.y - 60}px`,
            }}
          >
            <div className="font-semibold text-slate-700 mb-1">{monthNames[tooltip.month - 1]}</div>
            <div className="text-purple-600 font-bold">
              {symbol}: {tooltip.value.toFixed(2)}%
            </div>
            {compareSymbol && tooltip.compareValue !== undefined && tooltip.compareValue !== null && (
              <div className="text-teal-600 font-bold">
                {compareSymbol}: {tooltip.compareValue.toFixed(2)}%
              </div>
            )}
            <div className="text-slate-600">
              Avg Monthly: {tooltip.avgReturn.toFixed(2)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Yearly Overlay Chart
function YearlyOverlayChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; data: any[] } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const yearGroups: Record<number, any[]> = {};
    data.forEach((d: any) => {
      const year = new Date(d.date).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push(d);
    });

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
      },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const colors = [
      '#9333EA', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
      '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#6366F1'
    ];

    const seriesMap = new Map();
    const years = Object.keys(yearGroups).map(Number).sort((a, b) => a - b);

    years.forEach((year, idx) => {
      const yearData = yearGroups[year];
      const color = colors[idx % colors.length];

      const lineSeries = chart.addLineSeries({
        color,
        lineWidth: 2,
        title: year.toString(),
      });

      let cumulative = 0;
      const chartData = yearData.map((d: any, i: number) => {
        cumulative += d.returnPercentage || 0;
        return {
          time: (i + 1) as any,
          value: cumulative,
          year,
          month: new Date(d.date).getMonth() + 1,
        };
      });

      lineSeries.setData(chartData as any);
      seriesMap.set(year, lineSeries);
    });

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[time - 1] || '';
      },
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const tooltipData: any[] = [];
      seriesMap.forEach((series, year) => {
        const dataPoint = param.seriesData.get(series);
        if (dataPoint) {
          tooltipData.push({
            year,
            value: dataPoint.value,
            color: colors[years.indexOf(year) % colors.length],
          });
        }
      });

      if (tooltipData.length > 0) {
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          data: tooltipData,
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
  }, [data]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50 max-h-64 overflow-y-auto"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 100}px`,
          }}
        >
          <div className="font-semibold text-slate-700 mb-2">All Years</div>
          {tooltip.data.map((d: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-slate-600">{d.year}:</span>
              </div>
              <span className="font-bold" style={{ color: d.color }}>
                {d.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Aggregate Chart
function AggregateChart({ data, aggregateType }: {
  data: any[];
  aggregateType: 'total' | 'avg' | 'max' | 'min';
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; month: string; value: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const monthGroups: Record<number, number[]> = {};
    data.forEach((d: any) => {
      const month = new Date(d.date).getMonth() + 1;
      if (!monthGroups[month]) {
        monthGroups[month] = [];
      }
      monthGroups[month].push(d.returnPercentage || 0);
    });

    const aggregateData = Object.keys(monthGroups).map(Number).sort((a, b) => a - b).map(month => {
      const values = monthGroups[month];
      let aggregateValue = 0;

      switch (aggregateType) {
        case 'total':
          aggregateValue = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'avg':
          aggregateValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'max':
          aggregateValue = Math.max(...values);
          break;
        case 'min':
          aggregateValue = Math.min(...values);
          break;
      }

      return {
        month,
        value: aggregateValue,
      };
    });

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
      },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const histogramSeries = chart.addHistogramSeries({
      color: '#9333EA',
      priceFormat: {
        type: 'price',
      },
    });

    const chartData = aggregateData.map((d: any) => ({
      time: d.month as any,
      value: d.value,
      color: d.value >= 0 ? '#10B981' : '#EF4444',
    }));

    histogramSeries.setData(chartData as any);
    chart.timeScale().fitContent();

    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[time - 1] || '';
      },
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const dataPoint = param.seriesData.get(histogramSeries);
      if (dataPoint) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          month: monthNames[param.time - 1],
          value: dataPoint.value,
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
  }, [data, aggregateType]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y - 50}px`,
          }}
        >
          <div className="font-semibold text-slate-700 mb-1">{tooltip.month}</div>
          <div className={cn(
            "font-bold",
            tooltip.value >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {aggregateType.toUpperCase()}: {tooltip.value.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

// Data Table Component
function SeasonalDataTable({ data }: { data: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const currentData = data.slice(startIdx, endIdx);

  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Return %</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  {new Date(row.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </td>
                <td className={cn(
                  "px-4 py-2 text-right font-semibold",
                  (row.returnPercentage || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {(row.returnPercentage || 0).toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700">
                  {(row.cumulative || 0).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing {startIdx + 1} to {Math.min(endIdx, data.length)} of {data.length} entries
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
