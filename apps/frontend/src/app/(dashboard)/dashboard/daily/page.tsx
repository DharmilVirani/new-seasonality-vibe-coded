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
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
import { AnalyticsMatrix } from '@/components/analytics/AnalyticsMatrix';
import { AggregateChart } from '@/components/charts/AggregateChart';
import { ChartResizeWrapper } from '@/components/charts/ChartResizeWrapper';
import { DayOfWeekTable } from '@/components/charts/DayOfWeekTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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

export default function DailyPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, filters, chartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection } = useChartSelectionStore();
  const [filterOpen, setFilterOpen] = useState(true);

  // Chart mode selection
  const [activeChart, setActiveChart] = useState<'cumulative' | 'yearly' | 'aggregate'>('cumulative');
  
  // Aggregate chart settings
  const [aggregateField, setAggregateField] = useState<'weekday' | 'CalendarYearDay' | 'TradingYearDay' | 'CalendarMonthDay' | 'TradingMonthDay' | 'Month'>('weekday');
  const [aggregateType, setAggregateType] = useState<'total' | 'avg' | 'max' | 'min'>('avg');
  
  // Data table toggle
  const [activeTable, setActiveTable] = useState<'daily' | 'dayOfWeek' | 'monthly' | 'yearly' | 'statistics'>('daily');

  // Fetch daily analysis data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-analysis', selectedSymbols, startDate, endDate, lastNDays, filters, timeRangeSelection.startDate, timeRangeSelection.endDate],
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

  // Fetch aggregate data
  const { data: aggregateData } = useQuery({
    queryKey: ['daily-aggregate', selectedSymbols, startDate, endDate, filters, aggregateField, aggregateType],
    queryFn: async () => {
      const symbolKey = selectedSymbols[0];
      const response = await analysisApi.dailyAggregate({
        symbol: symbolKey,
        startDate,
        endDate,
        lastNDays,
        filters,
        aggregateField,
        aggregateType,
      });
      return response.data.data[symbolKey]?.data || [];
    },
    enabled: selectedSymbols.length > 0 && activeChart === 'aggregate',
  });

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

  // Prepare chart data
  const cumulativeData = useMemo(() => {
    if (!symbolData?.chartData) return [];
    return symbolData.chartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
      cumulative: point.cumulative || 0,
    }));
  }, [symbolData?.chartData]);

  // Pattern returns data (for bar chart)
  const patternReturnsData = useMemo(() => {
    if (!symbolData?.chartData) return [];
    return symbolData.chartData.map((point: any) => ({
      date: point.date,
      returnPercentage: point.returnPercentage || 0,
    }));
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
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
                subValue={`${stats.positiveCount || 0} wins`}
                metricKey="winRate"
              />
              <StatCard
                label="AVG RETURN"
                value={`${(stats.avgReturnAll || 0).toFixed(2)}%`}
                trend={(stats.avgReturnAll || 0) >= 0 ? 'up' : 'down'}
                subValue={`Median: ${((stats.sumReturnAll || 0) / (stats.totalCount || 1)).toFixed(2)}%`}
                metricKey="avgReturn"
              />
              <StatCard
                label="CAGR"
                value={`${(stats.cagr || 0).toFixed(2)}%`}
                trend={(stats.cagr || 0) > 0 ? 'up' : 'down'}
                subValue={`Sharpe: ${(stats.sharpeRatio || 0).toFixed(2)}`}
                metricKey="cagr"
              />
              <StatCard
                label="MAX DD"
                value={`${Math.abs(stats.maxDrawdown || 0).toFixed(2)}%`}
                trend={(stats.maxDrawdown || 0) > -10 ? 'up' : 'down'}
                subValue={`StdDev: ${(stats.stdDev || 0).toFixed(2)}`}
                metricKey="maxDrawdown"
              />
            </div>
          )}

          {/* CHART MODE SELECTOR */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 w-fit">
            {[
              { id: 'cumulative', label: 'Cumulative' },
              { id: 'yearly', label: 'Yearly' },
              { id: 'aggregate', label: 'Aggregate' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveChart(mode.id as any)}
                className={cn(
                  "px-4 py-2 text-xs font-medium rounded-md transition-colors",
                  activeChart === mode.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* AGGREGATE CHART CONTROLS */}
          {activeChart === 'aggregate' && (
            <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Field:</label>
                <Select value={aggregateField} onValueChange={(v) => setAggregateField(v as any)}>
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">Weekday</SelectItem>
                    <SelectItem value="CalendarYearDay">Calendar Year Day</SelectItem>
                    <SelectItem value="TradingYearDay">Trading Year Day</SelectItem>
                    <SelectItem value="CalendarMonthDay">Calendar Month Day</SelectItem>
                    <SelectItem value="TradingMonthDay">Trading Month Day</SelectItem>
                    <SelectItem value="Month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Type:</label>
                <Select value={aggregateType} onValueChange={(v) => setAggregateType(v as any)}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* MAIN CHART + ANALYTICS MATRIX */}
          <div className="grid grid-cols-3 gap-5 h-[400px]">
            <div className="col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {activeChart === 'cumulative' && 'Cumulative Returns'}
                    {activeChart === 'yearly' && 'Yearly Overlay'}
                    {activeChart === 'aggregate' && `${aggregateType === 'avg' ? 'Average' : aggregateType} Returns by ${aggregateField}`}
                  </h3>
                  <InfoTooltip content="Select different chart modes to visualize the data in different ways." />
                </div>
              </div>
              <div className="flex-1 w-full relative p-4">
                <ChartResizeWrapper>
                  {!data ? (
                    <PlaceholderState />
                  ) : activeChart === 'cumulative' ? (
                    <CumulativeChartWithDragSelect
                      data={cumulativeData}
                      chartScale={chartScale}
                      chartColor="#10b981"
                    />
                  ) : activeChart === 'yearly' ? (
                    <YearlyOverlayChart
                      data={symbolData?.chartData || []}
                      symbol={symbol}
                    />
                  ) : activeChart === 'aggregate' && aggregateData && aggregateData.length > 0 ? (
                    <AggregateChart
                      data={aggregateData}
                      symbol={symbol}
                      aggregateType={aggregateType}
                      fieldType={aggregateField.replace(/^[a-z]/, (c) => c.toUpperCase()) as any}
                      config={{ height: 320 }}
                    />
                  ) : (
                    <CumulativeChartWithDragSelect
                      data={cumulativeData}
                      chartScale={chartScale}
                      chartColor="#10b981"
                    />
                  )}
                </ChartResizeWrapper>
              </div>
            </div>

            {/* ANALYTICS MATRIX */}
            <div className="col-span-1 h-full">
              <DailyAnalyticsMatrix
                data={symbolData?.chartData || []}
                stats={stats}
              />
            </div>
          </div>

          {/* SECONDARY PANELS - Superimposed & Pattern Returns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[300px]">
            {/* Superimposed Chart */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Superimposed Pattern</h3>
                  <InfoTooltip content="Shows average pattern across all years overlaid as a single compounded line." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                <ChartResizeWrapper>
                  {data ? (
                    <SuperimposedChart
                      data={symbolData?.chartData || []}
                      symbol={symbol}
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
            <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50">
              {[
                { id: 'daily', label: 'Daily Data' },
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

            {/* TABLE CONTENT */}
            <div className="max-h-[400px] overflow-auto">
              {activeTable === 'daily' && (
                <DailyDataTable 
                  data={symbolData?.tableData || []} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'dayOfWeek' && (
                <DayOfWeekTable 
                  data={symbolData?.tableData || []} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'monthly' && (
                <MonthlySummaryTable 
                  data={symbolData?.tableData || []} 
                  symbol={symbol} 
                />
              )}
              {activeTable === 'yearly' && (
                <YearlySummaryTable 
                  data={symbolData?.tableData || []} 
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

function StatCard({ label, value, subValue, trend, metricKey }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  metricKey?: string;
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
      </div>
    </div>
  );
}

// Daily Analytics Matrix Component
function DailyAnalyticsMatrix({ data, stats }: { data: any[]; stats: any }) {
  // Calculate distribution data
  const distributionData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const returns = data.map(d => d.returnPercentage || 0);
    const min = Math.floor(Math.min(...returns));
    const max = Math.ceil(Math.max(...returns));

    const binCount = Math.min(20, Math.max(5, data.length));
    const range = max - min || 1;
    const binSize = range / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => {
      const binStart = min + i * binSize;
      return {
        name: binStart.toFixed(1),
        count: 0,
        range: `${binStart.toFixed(1)} to ${(binStart + binSize).toFixed(1)}`
      };
    });

    returns.forEach(r => {
      const binIndex = Math.min(Math.floor((r - min) / binSize), binCount - 1);
      if (binIndex >= 0 && bins[binIndex]) {
        bins[binIndex].count++;
      }
    });

    return bins;
  }, [data]);

  // Calculate metrics
  const annualizedReturn = useMemo(() => {
    if (!stats?.cagr) return 0;
    return stats.cagr;
  }, [stats]);

  const totalProfit = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum: number, d: any) => sum + (d.returnPercentage || 0), 0);
  }, [data]);

  const metrics = [
    { label: 'CAGR', value: `${annualizedReturn.toFixed(2)}%`, trend: annualizedReturn > 0 ? 'up' : 'down', subType: 'Annual Return' },
    { label: 'Avg Return', value: `${(stats?.avgReturnAll || 0).toFixed(2)}%`, trend: (stats?.avgReturnAll || 0) > 0 ? 'up' : 'down', subType: 'Per Day' },
    { label: 'Total P/L', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}%`, trend: totalProfit > 0 ? 'up' : 'down', subType: totalProfit >= 0 ? 'Profit' : 'Loss' },
    { label: 'Win %', value: `${(stats?.winRate || 0).toFixed(1)}%`, trend: (stats?.winRate || 0) > 50 ? 'up' : 'down', subType: `${stats?.positiveCount || 0}/${stats?.totalCount || 0}` },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col h-full font-sans">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Analytics Matrix</h3>
        <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400">
          DISTRIBUTION
        </span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Distribution Chart */}
        <div className="flex-1 min-h-0 mb-4 relative">
          {distributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={distributionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCountDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RechartsTooltip
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-800">
                          <p className="font-bold mb-1">Return: {payload[0]?.payload?.range}%</p>
                          <p className="text-emerald-300">Count: {payload[0]?.value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <XAxis dataKey="name" hide />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorCountDaily)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 text-xs">No data</div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{metric.label}</div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-lg font-bold",
                  metric.trend === 'up' ? "text-emerald-600" : metric.trend === 'down' ? "text-rose-600" : "text-slate-800"
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

// Superimposed Chart - Shows average pattern across all years (ONE line)
function SuperimposedChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; day: number; value: number; avgReturn: number } | null>(null);
  const { filters } = useAnalysisStore();
  
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
    const superimposedData = sortedDays.map(day => {
      const avgReturn = dayGroups[day].reduce((sum, val) => sum + val, 0) / dayGroups[day].length;
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      return { day, avgReturn, compoundedReturn: (compoundedValue - 1) * 100 };
    });

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      crosshair: { mode: 1, vertLine: { width: 1, color: '#10b981', style: 2 }, horzLine: { width: 1, color: '#10b981', style: 2 } },
      timeScale: { timeVisible: false, secondsVisible: false },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#000000',
      topColor: 'rgba(16, 185, 129, 0.4)',
      bottomColor: 'rgba(16, 185, 129, 0.0)',
      lineWidth: 2,
    });

    const chartData = superimposedData.map((d: any) => ({ time: d.day, value: d.compoundedReturn, avgReturn: d.avgReturn }));
    areaSeries.setData(chartData);
    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({ tickMarkFormatter: (time: any) => `Day ${time}` });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) { setTooltip(null); return; }
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
  }, [data, superimposedChartType, electionChartTypes]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
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
