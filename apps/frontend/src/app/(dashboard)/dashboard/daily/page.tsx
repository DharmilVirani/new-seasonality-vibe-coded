'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Filter, 
  ChevronDown, ChevronRight,
  RefreshCw,
  Zap, HelpCircle, Download
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';
  
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore, filterDataByDayRange } from '@/store/chartSelectionStore';
import { ReturnBarChart } from '@/components/charts';
import { ChartResizeWrapper } from '@/components/charts/ChartResizeWrapper';
import { DayOfWeekTable } from '@/components/charts/DayOfWeekTable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { 
  SymbolSelector, 
  DateRangePicker, 
  YearFilters, 
  MonthFilters, 
  WeekFilters, 
  DayFilters, 
  OutlierFilters,
  SuperimposedChartFilter
} from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/MetricTooltip';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-emerald-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
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
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600 transition-colors" />
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

const PRIMARY_COLOR = '#10b981';

function PlaceholderState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
      <Zap className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm font-medium">Select a symbol to begin analysis</p>
      <p className="text-xs mt-1 opacity-70">Choose filters and click analyze</p>
    </div>
  );
}

// Download table data as CSV
function downloadTableData(
  tableType: string,
  data: any[],
  stats: any,
  symbol: string
) {
  let csvContent = '';
  let filename = '';
  
  switch (tableType) {
    case 'dayOfWeek':
      filename = `${symbol}_day_of_week_analysis.csv`;
      // Group by day of week
      const dayGroups: Record<string, any[]> = {};
      data.forEach((row: any) => {
        const day = row.weekday || 'Unknown';
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push(row);
      });
      
      csvContent = 'Day,Count,Avg Return %,Win Rate %,Total Return %\n';
      Object.entries(dayGroups).forEach(([day, rows]) => {
        const returns = rows.map((r: any) => r.returnPercentage || 0);
        const avgReturn = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
        const positiveCount = returns.filter((r: number) => r > 0).length;
        const winRate = (positiveCount / returns.length) * 100;
        const totalReturn = returns.reduce((a: number, b: number) => a + b, 0);
        csvContent += `${day},${rows.length},${avgReturn.toFixed(2)}%,${winRate.toFixed(1)}%,${totalReturn.toFixed(2)}%\n`;
      });
      break;
      
    case 'monthly':
      filename = `${symbol}_monthly_summary.csv`;
      const monthGroups: Record<string, any[]> = {};
      data.forEach((row: any) => {
        const month = new Date(row.date).toISOString().slice(0, 7);
        if (!monthGroups[month]) monthGroups[month] = [];
        monthGroups[month].push(row);
      });
      
      csvContent = 'Month,Days,Avg Return %,Total Return %,Win Rate %\n';
      Object.entries(monthGroups)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([month, rows]) => {
          const returns = rows.map((r: any) => r.returnPercentage || 0);
          const avgReturn = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
          const positiveCount = returns.filter((r: number) => r > 0).length;
          const winRate = (positiveCount / returns.length) * 100;
          const totalReturn = returns.reduce((a: number, b: number) => a + b, 0);
          const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          csvContent += `${monthLabel},${rows.length},${avgReturn.toFixed(2)}%,${totalReturn.toFixed(2)}%,${winRate.toFixed(1)}%\n`;
        });
      break;
      
    case 'yearly':
      filename = `${symbol}_yearly_summary.csv`;
      const yearGroups: Record<string, any[]> = {};
      data.forEach((row: any) => {
        const year = new Date(row.date).getFullYear().toString();
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(row);
      });
      
      csvContent = 'Year,Days,Avg Return %,Total Return %,Win Rate %\n';
      Object.entries(yearGroups)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
        .forEach(([year, rows]) => {
          const returns = rows.map((r: any) => r.returnPercentage || 0);
          const avgReturn = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
          const positiveCount = returns.filter((r: number) => r > 0).length;
          const winRate = (positiveCount / returns.length) * 100;
          const totalReturn = returns.reduce((a: number, b: number) => a + b, 0);
          csvContent += `${year},${rows.length},${avgReturn.toFixed(2)}%,${totalReturn.toFixed(2)}%,${winRate.toFixed(1)}%\n`;
        });
      break;
      
    case 'statistics':
      filename = `${symbol}_statistics.csv`;
      if (stats) {
        csvContent = 'Metric,Value\n';
        csvContent += `Total Days,${stats.totalCount || 0}\n`;
        csvContent += `Positive Days,${stats.positiveCount || 0}\n`;
        csvContent += `Negative Days,${stats.negativeCount || 0}\n`;
        csvContent += `Win Rate,${(stats.winRate || 0).toFixed(2)}%\n`;
        csvContent += `Average Return (All),${(stats.avgReturnAll || 0).toFixed(4)}%\n`;
        csvContent += `Average Return (Positive),${(stats.avgReturnPositive || 0).toFixed(4)}%\n`;
        csvContent += `Average Return (Negative),${(stats.avgReturnNegative || 0).toFixed(4)}%\n`;
        csvContent += `Cumulative Return,${(stats.cumulativeReturn || 0).toFixed(2)}%\n`;
        csvContent += `CAGR,${(stats.cagr || 0).toFixed(2)}%\n`;
        csvContent += `Sharpe Ratio,${(stats.sharpeRatio || 0).toFixed(2)}\n`;
        csvContent += `Standard Deviation,${(stats.stdDev || 0).toFixed(2)}\n`;
        csvContent += `Max Gain,${(stats.maxGain || 0).toFixed(2)}%\n`;
        csvContent += `Max Loss,${(stats.maxLoss || 0).toFixed(2)}%\n`;
        csvContent += `Max Drawdown,${(stats.maxDrawdown || 0).toFixed(2)}%\n`;
      }
      break;
      
    default:
      return;
  }
  
  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function DailyPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, filters, chartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection, dayRangeSelection } = useChartSelectionStore();
  const [filterOpen, setFilterOpen] = useState(true);
  
  // Chart mode toggle
  const [chartMode, setChartMode] = useState<'superimposed' | 'aggregate'>('superimposed');
  const [aggregateType, setAggregateType] = useState<'total' | 'avg' | 'max' | 'min'>('avg');
  
  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState('');
  
  // Data table toggle
  const [activeTable, setActiveTable] = useState<'dayOfWeek' | 'monthly' | 'yearly' | 'statistics'>('dayOfWeek');

  // Serialize filters for proper query key change detection
  const filtersKey = JSON.stringify(filters);

  // Fetch daily analysis data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-analysis', selectedSymbols, startDate, endDate, lastNDays, filtersKey, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      const dateRange = timeRangeSelection.isActive 
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };
      
      const response = await analysisApi.daily({
        symbol: selectedSymbols[0],
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        lastNDays,
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
    queryKey: ['daily-analysis', compareSymbol, startDate, endDate, lastNDays, filtersKey, timeRangeSelection.startDate, timeRangeSelection.endDate],
    queryFn: async () => {
      if (!compareSymbol) return null;
      const dateRange = timeRangeSelection.isActive
        ? { startDate: timeRangeSelection.startDate || startDate, endDate: timeRangeSelection.endDate || endDate }
        : { startDate, endDate };

      const response = await analysisApi.daily({
        symbol: compareSymbol,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        lastNDays,
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
    return filterDataByDayRange(symbolData.chartData, dayRangeSelection, filters.superimposedChartType || 'CalendarYearDays');
  }, [symbolData?.chartData, dayRangeSelection, filters.superimposedChartType]);

  // Prepare chart data using filtered data
  const cumulativeData = useMemo(() => {
    if (!filteredChartData.length) return [];
    return filteredChartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
      cumulative: point.cumulative || 0,
    }));
  }, [filteredChartData]);

  // Pattern returns data (for bar chart) using filtered data
  const patternReturnsData = useMemo(() => {
    if (!filteredChartData.length) return [];
    return filteredChartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
    }));
  }, [filteredChartData]);

  // Filter comparison data by day range if active
  const filteredCompareChartData = useMemo(() => {
    if (!compareSymbolData?.chartData) return [];
    return filterDataByDayRange(compareSymbolData.chartData, dayRangeSelection, filters.superimposedChartType || 'CalendarYearDays');
  }, [compareSymbolData?.chartData, dayRangeSelection, filters.superimposedChartType]);

  // Compare cumulative data
  const compareCumulativeData = useMemo(() => {
    if (!filteredCompareChartData.length) return [];
    return filteredCompareChartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
      cumulative: point.cumulative || 0,
    }));
  }, [filteredCompareChartData]);

  // Compare pattern returns data
  const comparePatternReturnsData = useMemo(() => {
    if (!filteredCompareChartData.length) return [];
    return filteredCompareChartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
    }));
  }, [filteredCompareChartData]);

  // Aggregate data for aggregate chart mode - grouped by weekday (Mon-Fri only)
  const aggregateData = useMemo(() => {
    if (!symbolData?.chartData) return [];
    
    // Group data by weekday (0-6, where 0=Sunday, 1=Monday, etc.)
    const groups: Record<number, number[]> = {};
    
    symbolData.chartData.forEach((d: any) => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay(); // 0-6
      
      // Only include Monday-Friday (1-5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (!groups[dayOfWeek]) groups[dayOfWeek] = [];
        groups[dayOfWeek].push(d.returnPercentage || 0);
      }
    });
    
    // Calculate aggregate values for Mon-Fri
    const weekdayOrder = [1, 2, 3, 4, 5]; // Mon, Tue, Wed, Thu, Fri
    return weekdayOrder.map(day => {
      const values = groups[day] || [];
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
        day,
        value: aggregatedValue,
        count: values.length,
      };
    });
  }, [symbolData?.chartData, aggregateType]);

  // Pattern detection - analyze statistically significant patterns
  const patternAlerts = useMemo(() => {
    if (!symbolData?.chartData?.length) return [];
    
    const alerts: { type: 'positive' | 'negative' | 'neutral'; message: string; detail: string }[] = [];
    const data = symbolData.chartData;
    
    // Analyze by day of week
    const dayGroups: Record<string, { returns: number[]; count: number }> = {};
    data.forEach((d: any) => {
      const day = d.weekday || 'Unknown';
      if (!dayGroups[day]) dayGroups[day] = { returns: [], count: 0 };
      dayGroups[day].returns.push(d.returnPercentage || 0);
      dayGroups[day].count++;
    });
    
    const overallWinRate = (data.filter((d: any) => (d.returnPercentage || 0) > 0).length / data.length) * 100;
    
    Object.entries(dayGroups).forEach(([day, group]) => {
      const winRate = (group.returns.filter(r => r > 0).length / group.returns.length) * 100;
      const avgReturn = group.returns.reduce((a, b) => a + b, 0) / group.returns.length;
      
      // Significant win rate deviation (more than 10% above/below overall)
      if (winRate > overallWinRate + 10 && group.count > 20) {
        alerts.push({
          type: 'positive',
          message: `${day} shows strong performance`,
          detail: `Win rate: ${winRate.toFixed(1)}% (+${(winRate - overallWinRate).toFixed(1)}% vs average)`
        });
      } else if (winRate < overallWinRate - 10 && group.count > 20) {
        alerts.push({
          type: 'negative',
          message: `${day} underperforms`,
          detail: `Win rate: ${winRate.toFixed(1)}% (${(winRate - overallWinRate).toFixed(1)}% vs average)`
        });
      }
      
      // Strong positive/negative average returns
      if (avgReturn > 0.15 && group.count > 20) {
        alerts.push({
          type: 'positive',
          message: `${day} has positive average returns`,
          detail: `Avg return: +${avgReturn.toFixed(2)}% (${group.count} occurrences)`
        });
      } else if (avgReturn < -0.15 && group.count > 20) {
        alerts.push({
          type: 'negative',
          message: `${day} has negative average returns`,
          detail: `Avg return: ${avgReturn.toFixed(2)}% (${group.count} occurrences)`
        });
      }
    });
    
    // Analyze by month
    const monthGroups: Record<number, { returns: number[]; count: number }> = {};
    data.forEach((d: any) => {
      const month = new Date(d.date).getMonth();
      if (!monthGroups[month]) monthGroups[month] = { returns: [], count: 0 };
      monthGroups[month].returns.push(d.returnPercentage || 0);
      monthGroups[month].count++;
    });
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    Object.entries(monthGroups).forEach(([month, group]) => {
      const winRate = (group.returns.filter(r => r > 0).length / group.returns.length) * 100;
      const avgReturn = group.returns.reduce((a, b) => a + b, 0) / group.returns.length;
      
      if (winRate > overallWinRate + 12 && group.count > 30) {
        alerts.push({
          type: 'positive',
          message: `${monthNames[parseInt(month)]} outperforms`,
          detail: `Win rate: ${winRate.toFixed(1)}% (+${(winRate - overallWinRate).toFixed(1)}% vs average)`
        });
      } else if (winRate < overallWinRate - 12 && group.count > 30) {
        alerts.push({
          type: 'negative',
          message: `${monthNames[parseInt(month)]} underperforms`,
          detail: `Win rate: ${winRate.toFixed(1)}% (${(winRate - overallWinRate).toFixed(1)}% vs average)`
        });
      }
    });
    
    // Sort by significance (positive first, then by impact)
    return alerts.sort((a, b) => {
      if (a.type === 'positive' && b.type !== 'positive') return -1;
      if (a.type !== 'positive' && b.type === 'positive') return 1;
      if (a.type === 'negative' && b.type === 'neutral') return -1;
      if (a.type === 'neutral' && b.type === 'negative') return 1;
      return 0;
    }).slice(0, 6); // Limit to 6 alerts
  }, [symbolData?.chartData]);

  const symbol = selectedSymbols[0] || 'NIFTY';

  return (
    <div className="flex h-full bg-[#F8F9FB]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* HEADER */}
        <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-emerald-600 fill-emerald-200" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                {symbol}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Daily Analysis Engine</p>
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
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {symbol?.charAt(0) || 'N'}
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1800px] mx-auto w-full">

          {/* STATS STRIP - Using events page style */}
          {stats && (
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="TOTAL DAYS"
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
            </div>
          )}

          {/* PATTERN ALERTS */}
          {patternAlerts.length > 0 && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="font-semibold text-amber-800 text-sm">Pattern Alerts</h3>
                <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">{patternAlerts.length}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {patternAlerts.map((alert, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "rounded-lg p-3 border text-xs",
                      alert.type === 'positive' 
                        ? "bg-emerald-50 border-emerald-200" 
                        : alert.type === 'negative'
                          ? "bg-red-50 border-red-200"
                          : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "font-semibold mb-1",
                      alert.type === 'positive' ? "text-emerald-700" : alert.type === 'negative' ? "text-red-700" : "text-slate-700"
                    )}>
                      {alert.message}
                    </div>
                    <div className={cn(
                      "text-[11px]",
                      alert.type === 'positive' ? "text-emerald-600" : alert.type === 'negative' ? "text-red-600" : "text-slate-500"
                    )}>
                      {alert.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MAIN CHART - Chart Mode Toggle + Chart */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[450px] overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {chartMode === 'superimposed' ? 'Superimposed Pattern' : `${aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1)} by Day`}
                </h3>
                <InfoTooltip content={chartMode === 'superimposed' ? "Shows average pattern across all years overlaid as a single compounded line. Click and drag to select a time range." : "Shows aggregated values (Total/Avg/Max/Min) for each day across all years."} />
              </div>
              <div className="flex items-center gap-3">
                {/* Chart Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                  <button
                    onClick={() => setChartMode('superimposed')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      chartMode === 'superimposed'
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    )}
                  >
                    Superimposed
                  </button>
                  <button
                    onClick={() => setChartMode('aggregate')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      chartMode === 'aggregate'
                        ? "bg-emerald-600 text-white shadow-sm"
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
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-emerald-400 bg-white"
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
                  ) : (
                    <AggregateChart
                      data={aggregateData}
                      aggregateType={aggregateType}
                      chartType={filters.superimposedChartType || 'CalendarYearDays'}
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
                    <CumulativeChart
                      data={cumulativeData}
                      chartScale={chartScale}
                      chartColor="#10b981"
                      compareData={compareMode && compareCumulativeData.length > 0 ? compareCumulativeData : undefined}
                      compareColor="#dc2626"
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
                  <h3 className="font-semibold text-slate-800 text-sm">Daily Returns</h3>
                  <InfoTooltip content="Bar chart showing each trading day's return. Green = positive, Red = negative." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                <ChartResizeWrapper>
                  {patternReturnsData.length > 0 ? (
                    <ReturnBarChart
                      data={patternReturnsData}
                      symbol={symbol}
                      config={{ title: '', height: 240 }}
                      color="#10b981"
                      compareData={compareMode && comparePatternReturnsData.length > 0 ? comparePatternReturnsData : undefined}
                      compareSymbol={compareMode ? compareSymbol : undefined}
                      compareColor="#dc2626"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                  )}
                </ChartResizeWrapper>
              </div>
            </div>
          </div>

          {/* DATA TABLE WITH TOGGLE */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            {/* TABLE TOGGLE */}
            <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-1">
                {[
                  { id: 'dayOfWeek', label: 'Day of Week' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly' },
                  { id: 'statistics', label: 'Statistics' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTable(tab.id as any)}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-md transition-colors",
                      activeTable === tab.id
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:shadow-sm"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* Download Button */}
              <button
                onClick={() => downloadTableData(activeTable, filteredChartData, stats, symbol)}
                disabled={!filteredChartData.length && activeTable !== 'statistics'}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  filteredChartData.length || activeTable === 'statistics'
                    ? "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>

            {/* TABLE CONTENT */}
            <div className="max-h-[400px] overflow-auto">
              {activeTable === 'dayOfWeek' && (
                <DayOfWeekTable 
                  data={filteredChartData} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'monthly' && (
                <MonthlySummaryTable 
                  data={filteredChartData} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'yearly' && (
                <YearlySummaryTable 
                  data={filteredChartData} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'statistics' && (
                <StatisticsTable stats={stats} symbol={symbol} />
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
        title="Filters"
        subtitle="Configure Analysis"
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Symbol" defaultOpen delay={0}>
          <div className="pt-1">
            <SymbolSelector />
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
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="compareMode" className="text-sm text-slate-700">Enable comparison</label>
            </div>
            
            {compareMode && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Compare Symbol</label>
                <select
                  value={compareSymbol}
                  onChange={(e) => setCompareSymbol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
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

        <FilterSection title="Time Range" defaultOpen delay={0.05}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(e.target.value, useAnalysisStore.getState().endDate)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => useAnalysisStore.getState().setDateRange(useAnalysisStore.getState().startDate, e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Last N Days</label>
                <span className="text-[10px] font-bold text-slate-400">{lastNDays}</span>
              </div>
              <input
                type="number"
                value={lastNDays}
                onChange={(e) => useAnalysisStore.getState().setLastNDays(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
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

        <FilterSection title="Week Filters" delay={0.1}>
          <WeekFilters />
        </FilterSection>

        <FilterSection title="Day Filters" delay={0.15}>
          <DayFilters />
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
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {trend && trend !== 'neutral' && (
            <div className={cn(
              "text-xs font-semibold",
              trend === 'up' ? "text-emerald-600" : "text-rose-600"
            )}>
              {trend === 'up' ? '↗' : '↘'}
            </div>
          )}
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

// Daily Data Table
function DailyDataTable({ data, symbol }: { data: any[]; symbol: string }) {
  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 sticky top-0">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Open</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">High</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Low</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Close</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Return %</th>
          <th className="px-4 py-3 text-center font-semibold text-slate-600">Day</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.slice(0, 100).map((row: any, idx: number) => (
          <tr key={idx} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-700">
              {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
            <td className="px-4 py-2 text-right text-slate-600">{row.open?.toFixed(2)}</td>
            <td className="px-4 py-2 text-right text-slate-600">{row.high?.toFixed(2)}</td>
            <td className="px-4 py-2 text-right text-slate-600">{row.low?.toFixed(2)}</td>
            <td className="px-4 py-2 text-right text-slate-600">{row.close?.toFixed(2)}</td>
            <td className={cn(
              "px-4 py-2 text-right font-medium",
              (row.returnPercentage || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {(row.returnPercentage || 0).toFixed(2)}%
            </td>
            <td className="px-4 py-2 text-center text-slate-500">{row.weekday}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Monthly Summary Table
function MonthlySummaryTable({ data, symbol }: { data: any[]; symbol: string }) {
  const monthlyData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const groups: Record<string, any[]> = {};
    data.forEach((row: any) => {
      const month = new Date(row.date).toISOString().slice(0, 7); // YYYY-MM
      if (!groups[month]) groups[month] = [];
      groups[month].push(row);
    });

    return Object.entries(groups).map(([month, rows]) => {
      const returns = rows.map((r: any) => r.returnPercentage || 0);
      const positive = returns.filter((r: number) => r > 0).length;
      return {
        month,
        count: rows.length,
        avgReturn: returns.reduce((a: number, b: number) => a + b, 0) / returns.length,
        positiveCount: positive,
        winRate: (positive / returns.length) * 100,
        totalReturn: returns.reduce((a: number, b: number) => a + b, 0),
      };
    }).sort((a, b) => b.month.localeCompare(a.month));
  }, [data]);

  if (monthlyData.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 sticky top-0">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-600">Month</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Days</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Avg Return</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Total Return</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Win Rate</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {monthlyData.map((row, idx) => (
          <tr key={idx} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-700 font-medium">
              {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </td>
            <td className="px-4 py-2 text-right text-slate-600">{row.count}</td>
            <td className={cn(
              "px-4 py-2 text-right font-medium",
              row.avgReturn >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {row.avgReturn.toFixed(2)}%
            </td>
            <td className={cn(
              "px-4 py-2 text-right font-medium",
              row.totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {row.totalReturn.toFixed(2)}%
            </td>
            <td className="px-4 py-2 text-right text-slate-600">{row.winRate.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Yearly Summary Table
function YearlySummaryTable({ data, symbol }: { data: any[]; symbol: string }) {
  const yearlyData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const groups: Record<string, any[]> = {};
    data.forEach((row: any) => {
      const year = new Date(row.date).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(row);
    });

    return Object.entries(groups).map(([year, rows]) => {
      const returns = rows.map((r: any) => r.returnPercentage || 0);
      const positive = returns.filter((r: number) => r > 0).length;
      return {
        year,
        count: rows.length,
        avgReturn: returns.reduce((a: number, b: number) => a + b, 0) / returns.length,
        positiveCount: positive,
        winRate: (positive / returns.length) * 100,
        totalReturn: returns.reduce((a: number, b: number) => a + b, 0),
      };
    }).sort((a, b) => parseInt(b.year) - parseInt(a.year));
  }, [data]);

  if (yearlyData.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-50 sticky top-0">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-600">Year</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Days</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Avg Return</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Total Return</th>
          <th className="px-4 py-3 text-right font-semibold text-slate-600">Win Rate</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {yearlyData.map((row, idx) => (
          <tr key={idx} className="hover:bg-slate-50">
            <td className="px-4 py-2 text-slate-700 font-medium">{row.year}</td>
            <td className="px-4 py-2 text-right text-slate-600">{row.count}</td>
            <td className={cn(
              "px-4 py-2 text-right font-medium",
              row.avgReturn >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {row.avgReturn.toFixed(2)}%
            </td>
            <td className={cn(
              "px-4 py-2 text-right font-medium",
              row.totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {row.totalReturn.toFixed(2)}%
            </td>
            <td className="px-4 py-2 text-right text-slate-600">{row.winRate.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Statistics Summary Table
function StatisticsTable({ stats, symbol }: { stats: any; symbol: string }) {
  if (!stats) {
    return <div className="p-8 text-center text-slate-400 text-sm">No statistics available</div>;
  }

  const statItems = [
    { label: 'Total Days', value: stats.totalCount || 0 },
    { label: 'Positive Days', value: stats.positiveCount || 0 },
    { label: 'Negative Days', value: stats.negativeCount || 0 },
    { label: 'Win Rate', value: `${(stats.winRate || 0).toFixed(2)}%`, highlight: (stats.winRate || 0) > 50 },
    { label: 'Average Return (All)', value: `${(stats.avgReturnAll || 0).toFixed(4)}%`, highlight: (stats.avgReturnAll || 0) > 0 },
    { label: 'Average Return (Positive)', value: `${(stats.avgReturnPositive || 0).toFixed(4)}%` },
    { label: 'Average Return (Negative)', value: `${(stats.avgReturnNegative || 0).toFixed(4)}%` },
    { label: 'Cumulative Return', value: `${(stats.cumulativeReturn || 0).toFixed(2)}%`, highlight: (stats.cumulativeReturn || 0) > 0 },
    { label: 'CAGR', value: `${(stats.cagr || 0).toFixed(2)}%`, highlight: (stats.cagr || 0) > 0 },
    { label: 'Sharpe Ratio', value: (stats.sharpeRatio || 0).toFixed(2), highlight: (stats.sharpeRatio || 0) > 1 },
    { label: 'Standard Deviation', value: (stats.stdDev || 0).toFixed(2) },
    { label: 'Max Gain', value: `${(stats.maxGain || 0).toFixed(2)}%` },
    { label: 'Max Loss', value: `${(stats.maxLoss || 0).toFixed(2)}%` },
    { label: 'Max Drawdown', value: `${(stats.maxDrawdown || 0).toFixed(2)}%`, highlight: (stats.maxDrawdown || 0) > -10 },
  ];

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item, idx) => (
          <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{item.label}</div>
            <div className={cn(
              "text-lg font-bold",
              item.highlight === undefined ? "text-slate-800" :
              item.highlight ? "text-emerald-600" : "text-rose-600"
            )}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Cumulative Chart - Simple version without drag select
function CumulativeChart({ 
  data, 
  chartScale = 'linear',
  chartColor = '#10b981',
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
      timeScale: { timeVisible: true, secondsVisible: false },
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

      const dateStr = new Date(param.time * 1000).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // Get data from all series
      const seriesData = param.seriesData;
      let mainValue = 0;
      let compareValue: number | null = null;
      let seriesIndex = 0;
      
      for (const [series, dataPoint] of seriesData.entries()) {
        if (seriesIndex === 0) {
          mainValue = dataPoint?.value ?? 0;
        } else if (seriesIndex === 1) {
          compareValue = dataPoint?.value ?? null;
        }
        seriesIndex++;
      }

      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        date: dateStr,
        value: mainValue,
        compareValue: compareValue,
      });
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
  }, [data, chartScale, chartColor]);

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
          <div className="font-semibold text-slate-700 mb-1">{tooltip.date}</div>
          <div className="font-bold" style={{ color: chartColor }}>
            Main: {tooltip.value.toFixed(2)}%
          </div>
          {tooltip.compareValue !== null && tooltip.compareValue !== undefined && (
            <div className="font-bold" style={{ color: compareColor }}>
              Compare: {tooltip.compareValue.toFixed(2)}%
            </div>
          )}
        </div>
      )}
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
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; day: number; value: number; avgReturn: number } | null>(null);
  const [selection, setSelection] = useState<{ startDay: number | null; endDay: number | null; isDragging: boolean }>({ startDay: null, endDay: null, isDragging: false });
  const { filters, setDateRange } = useAnalysisStore();
  const { setDayRangeSelection, clearDayRangeSelection } = useChartSelectionStore();
  
  const superimposedChartType = filters.superimposedChartType || 'CalendarYearDays';
  const electionChartTypes = filters.electionChartTypes || ['All Years'];

  const electionYears: Record<string, number[]> = {
    'Election Years': [1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019],
    'Pre Election Years': [1951, 1956, 1961, 1966, 1970, 1976, 1979, 1983, 1988, 1990, 1995, 1997, 1998, 2003, 2008, 2013, 2018],
    'Post Election Years': [1953, 1958, 1963, 1968, 1972, 1978, 1981, 1985, 1990, 1992, 1997, 1999, 2000, 2005, 2010, 2015, 2020],
    'Mid Election Years': [1954, 1955, 1959, 1960, 1964, 1965, 1969, 1973, 1974, 1975, 1982, 1986, 1987, 1993, 1994, 2001, 2002, 2006, 2007, 2011, 2012, 2016, 2017, 2021, 2022],
    'Modi Years': [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  };

  const yearRange = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const years = data.map((d: any) => new Date(d.date).getFullYear());
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const uniqueYears = new Set(years);
    return { minYear, maxYear, yearCount: uniqueYears.size };
  }, [data]);

  // Process data for superimposed chart - grouped by months
  const superimposedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let filteredData = [...data];
    
    if (!electionChartTypes.includes('All Years')) {
      filteredData = data.filter((d: any) => {
        const year = new Date(d.date).getFullYear();
        const currentYear = new Date().getFullYear();
        return electionChartTypes.some(type => {
          if (type === 'Current Year') return year === currentYear;
          else if (electionYears[type]) return electionYears[type].includes(year);
          return false;
        });
      });
    }

    const dataWithTradingDays = filteredData.map((d, idx) => {
      const date = new Date(d.date);
      let tradingYearDay = 1;
      let tradingMonthDay = 1;
      for (let i = 0; i < idx; i++) {
        const prevDate = new Date(filteredData[i].date);
        if (prevDate.getFullYear() === date.getFullYear()) tradingYearDay++;
        if (prevDate.getFullYear() === date.getFullYear() && prevDate.getMonth() === date.getMonth()) tradingMonthDay++;
      }
      return { ...d, tradingYearDay, tradingMonthDay };
    });

    const dayGroups: Record<number, number[]> = {};
    dataWithTradingDays.forEach((d: any) => {
      const date = new Date(d.date);
      let dayKey: number;
      switch (superimposedChartType) {
        case 'CalendarYearDays':
          const year = date.getFullYear();
          const startOfYear = new Date(year, 0, 1);
          dayKey = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          break;
        case 'TradingYearDays':
          dayKey = d.tradingYearDay;
          break;
        case 'CalendarMonthDays':
          dayKey = date.getDate();
          break;
        case 'TradingMonthDays':
          dayKey = d.tradingMonthDay;
          break;
        case 'Weekdays':
          dayKey = date.getDay();
          break;
        default:
          const yearD = date.getFullYear();
          const startOfYearD = new Date(yearD, 0, 1);
          dayKey = Math.floor((date.getTime() - startOfYearD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
      if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
      dayGroups[dayKey].push(d.returnPercentage || 0);
    });

    const sortedDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 1;
    return sortedDays.map(day => {
      const avgReturn = dayGroups[day].reduce((sum, val) => sum + val, 0) / dayGroups[day].length;
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      return { day, avgReturn, compoundedReturn: (compoundedValue - 1) * 100 };
    });
  }, [data, superimposedChartType, electionChartTypes]);

  useEffect(() => {
    if (!chartContainerRef.current || superimposedData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: '#10b981', style: 2 }, horzLine: { width: 1, color: '#10b981', style: 2 } },
      timeScale: { timeVisible: false, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false, axisDoubleClickReset: true },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#000000',
      topColor: 'rgba(16, 185, 129, 0.4)',
      bottomColor: 'rgba(16, 185, 129, 0.0)',
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;

    const chartData = superimposedData.map((d: any) => ({ time: d.day, value: d.compoundedReturn, avgReturn: d.avgReturn }));
    areaSeries.setData(chartData);

    // Add comparison symbol - calculate superimposed pattern (same as main symbol)
    if (compareData && compareData.length > 0 && compareSymbol) {
      // Group compare data by day (same calculation as superimposedData)
      const compareDayGroups: Record<number, number[]> = {};
      compareData.forEach((d: any) => {
        const date = new Date(d.date);
        let dayKey: number;
        switch (superimposedChartType) {
          case 'CalendarYearDays':
            const year = date.getFullYear();
            const startOfYear = new Date(year, 0, 1);
            dayKey = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            break;
          case 'TradingYearDays':
            // Calculate trading day
            let tradingDay = 1;
            for (let i = 0; i < compareData.indexOf(d); i++) {
              const prevDate = new Date(compareData[i].date);
              if (prevDate.getFullYear() === date.getFullYear()) tradingDay++;
            }
            dayKey = tradingDay;
            break;
          case 'CalendarMonthDays':
            dayKey = date.getDate();
            break;
          case 'TradingMonthDays':
            let tradingMonthDay = 1;
            for (let i = 0; i < compareData.indexOf(d); i++) {
              const prevDate = new Date(compareData[i].date);
              if (prevDate.getFullYear() === date.getFullYear() && prevDate.getMonth() === date.getMonth()) {
                tradingMonthDay++;
              }
            }
            dayKey = tradingMonthDay;
            break;
          case 'Weekdays':
            dayKey = date.getDay();
            break;
          default:
            const yearD = date.getFullYear();
            const startOfYearD = new Date(yearD, 0, 1);
            dayKey = Math.floor((date.getTime() - startOfYearD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        if (!compareDayGroups[dayKey]) compareDayGroups[dayKey] = [];
        compareDayGroups[dayKey].push(d.returnPercentage || 0);
      });

      // Calculate superimposed pattern (same logic as main symbol)
      const sortedDays = Object.keys(compareDayGroups).map(Number).sort((a, b) => a - b);
      let compoundedValue = 1;
      const compareLineData = sortedDays.map(day => {
        const avgReturn = compareDayGroups[day].reduce((sum, val) => sum + val, 0) / compareDayGroups[day].length;
        compoundedValue = compoundedValue * (1 + avgReturn / 100);
        return { time: day as any, value: (compoundedValue - 1) * 100 };
      });
      
      const compareSeries = chart.addLineSeries({ 
        color: '#dc2626',
        lineWidth: 3, 
        title: compareSymbol,
      });
      compareSeries.setData(compareLineData);
    }

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({ tickMarkFormatter: (time: any) => `Day ${time}` });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) { 
        setTooltip(null); 
        return; 
      }
      const dataPoint = param.seriesData.get(areaSeries);
      if (dataPoint) {
        const originalData = superimposedData.find((d: any) => d.day === param.time);
        setTooltip({ visible: true, x: param.point.x, y: param.point.y, day: param.time, value: dataPoint.value, avgReturn: originalData?.avgReturn || 0 });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
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
      setSelection({ startDay: time as number, endDay: time as number, isDragging: true });
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
      setSelection(prev => ({ ...prev, endDay: time as number }));
    }
  };

  const handleMouseUp = () => {
    if (!selection.isDragging || !chartRef.current) return;
    
    if (selection.startDay !== null && selection.endDay !== null) {
      // Calculate day range from the selection
      const minDay = Math.min(selection.startDay, selection.endDay);
      const maxDay = Math.max(selection.startDay, selection.endDay);
      
      // Set the day range selection for client-side filtering
      setDayRangeSelection({
        startDay: minDay,
        endDay: maxDay,
        chartType: superimposedChartType,
        isActive: true,
      });
    }
    
    setSelection(prev => ({ ...prev, isDragging: false }));
  };

  const clearSelection = () => {
    setSelection({ startDay: null, endDay: null, isDragging: false });
    clearDayRangeSelection();
  };

  // Calculate selection overlay position
  const getSelectionOverlay = () => {
    if (!chartRef.current || selection.startDay === null || selection.endDay === null) return null;
    
    const timeScale = chartRef.current.timeScale();
    const startX = timeScale.timeToCoordinate(selection.startDay);
    const endX = timeScale.timeToCoordinate(selection.endDay);
    
    if (startX === null || endX === null) return null;
    
    const left = Math.min(startX, endX);
    const width = Math.abs(endX - startX);
    
    return { left, width, display: width > 5 };
  };

  const selectionOverlay = getSelectionOverlay();
  const isSelectionActive = selection.startDay !== null && selection.endDay !== null && !selection.isDragging && selectionOverlay?.display;

  return (
    <div className="h-full w-full relative">
      {/* Selection controls */}
      {isSelectionActive && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
            Days: {Math.min(selection.startDay!, selection.endDay!)} - {Math.max(selection.startDay!, selection.endDay!)}
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
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              borderLeft: '2px solid rgba(16, 185, 129, 0.8)',
              borderRight: '2px solid rgba(16, 185, 129, 0.8)',
            }}
          />
        )}

        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 mt-10">
          {symbol} - {superimposedChartType.replace(/([A-Z])/g, ' $1').trim()} - {yearRange ? `${yearRange.yearCount} Years (${yearRange.minYear}-${yearRange.maxYear})` : 'All Years'}
        </div>
        
        {tooltip && tooltip.visible && (
          <div className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50" style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y - 60}px` }}>
            <div className="font-semibold text-slate-700 mb-1">
              {superimposedChartType === 'Weekdays' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][tooltip.day] : `Day ${tooltip.day}`}
            </div>
            <div className="text-emerald-600 font-bold">Compounded: {tooltip.value.toFixed(2)}%</div>
            <div className="text-slate-600">Avg Daily: {tooltip.avgReturn.toFixed(2)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Yearly Overlay Chart - Shows each year's pattern overlaid (MULTIPLE lines)
function YearlyOverlayChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; day: number; values: Array<{ year: string; value: number; color: string }> } | null>(null);
  const { filters } = useAnalysisStore();
  const electionChartTypes = filters.electionChartTypes || ['All Years'];

  const electionYears: Record<string, number[]> = {
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
        const year = new Date(d.date).getFullYear();
        const currentYear = new Date().getFullYear();
        return electionChartTypes.some(type => {
          if (type === 'Current Year') return year === currentYear;
          else if (electionYears[type]) return electionYears[type].includes(year);
          return false;
        });
      });
    }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: '#10b981', style: 2 }, horzLine: { width: 1, color: '#10b981', style: 2 } },
    });

    chartRef.current = chart;

    const yearGroups: Record<number, any[]> = {};
    filteredData.forEach((d: any) => {
      const date = new Date(d.date);
      const year = date.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push({ dayOfYear, returnPercentage: d.returnPercentage || 0 });
    });

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];
    const seriesMap = new Map();

    Object.entries(yearGroups).forEach(([year, yearData], index) => {
      const color = colors[index % colors.length];
      const lineSeries = chart.addLineSeries({ color, lineWidth: 2, title: year });
      const lineData = yearData.map((d: any) => ({ time: d.dayOfYear, value: d.returnPercentage }));
      lineSeries.setData(lineData);
      seriesMap.set(lineSeries, { year, color });
    });

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({ tickMarkFormatter: (time: any) => `Day ${time}` });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) { setTooltip(null); return; }
      const values: Array<{ year: string; value: number; color: string }> = [];
      seriesMap.forEach((info, series) => {
        const dataPoint = param.seriesData.get(series);
        if (dataPoint) values.push({ year: info.year, value: dataPoint.value, color: info.color });
      });
      if (values.length > 0) setTooltip({ visible: true, x: param.point.x, y: param.point.y, day: param.time, values });
    });

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [data, electionChartTypes]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
        <div className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50 max-h-64 overflow-y-auto" style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y - 80}px` }}>
          <div className="font-semibold text-slate-700 mb-2">Day {tooltip.day}</div>
          <div className="space-y-1">
            {tooltip.values.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.year}:</span>
                </div>
                <span className="font-bold" style={{ color: item.color }}>{item.value.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Aggregate Chart - Shows aggregated values (Total/Avg/Max/Min) by day
function AggregateChart({ 
  data, 
  aggregateType = 'avg',
  chartType = 'CalendarYearDays'
}: { 
  data: any[]; 
  aggregateType?: 'total' | 'avg' | 'max' | 'min';
  chartType?: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; day: number; value: number; count: number } | null>(null);
  
  // Weekday names for tooltips (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)
  const weekdayNames: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
  };

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: '#10b981', style: 2 }, horzLine: { width: 1, color: '#10b981', style: 2 } },
      timeScale: { timeVisible: false, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });

    chartRef.current = chart;

    // Use different colors based on aggregate type
    const colorMap: Record<string, string> = {
      'avg': '#10b981',
      'total': '#3b82f6',
      'max': '#f59e0b',
      'min': '#ef4444',
    };
    const lineColor = colorMap[aggregateType] || '#10b981';

    const histogramSeries = chart.addHistogramSeries({
      color: lineColor,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    const chartData = data.map((d: any) => ({
      time: d.day,
      value: d.value,
      color: d.value >= 0 ? lineColor : '#ef4444',
    }));

    histogramSeries.setData(chartData);
    chart.timeScale().fitContent();
    
    // Weekday names for x-axis (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri)
    const xAxisWeekdayNames: Record<number, string> = {
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
    };
    (chart.timeScale() as any).applyOptions({ 
      tickMarkFormatter: (time: any) => xAxisWeekdayNames[time] || `Day ${time}`
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) { 
        setTooltip(null); 
        return; 
      }
      const dataPoint = param.seriesData.get(histogramSeries);
      if (dataPoint) {
        const originalData = data.find((d: any) => d.day === param.time);
        setTooltip({ 
          visible: true, 
          x: param.point.x, 
          y: param.point.y, 
          day: param.time, 
          value: dataPoint.value,
          count: originalData?.count || 0,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [data, aggregateType]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
        <div className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50" style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y - 60}px` }}>
          <div className="font-semibold text-slate-700 mb-1">
            {weekdayNames[tooltip.day] || `Day ${tooltip.day}`}
          </div>
          <div className="text-emerald-600 font-bold">{aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1)}: {tooltip.value.toFixed(2)}%</div>
          <div className="text-slate-500 text-[10px]">Based on {tooltip.count} occurrences</div>
        </div>
      )}
    </div>
  );
}
