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
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
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
  const { selectedSymbols, startDate, endDate, filters, chartScale, setChartScale } = useAnalysisStore();
  const { timeRangeSelection, clearTimeRangeSelection } = useChartSelectionStore();
  const [weekType, setWeekType] = useState<'monday' | 'expiry'>('expiry');
  const [activeChart, setActiveChart] = useState<'cumulative' | 'yearly'>('cumulative');
  const [filterOpen, setFilterOpen] = useState(true);

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

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

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
              { id: 'cumulative', label: 'Cumulative' },
              { id: 'yearly', label: 'Yearly' },
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

          {/* Main Chart + Analytics Matrix */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-3 gap-6 h-[420px]"
          >
            {/* Main Chart */}
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">
                    {activeChart === 'cumulative' && 'Cumulative Returns'}
                    {activeChart === 'yearly' && 'Yearly Overlay Pattern'}
                  </h3>
                  <InfoTooltip content="Select different chart modes to visualize the data in different ways." />
                </div>
              </div>
              <div className="flex-1 w-full relative p-4">
                {!symbolData ? (
                  <PlaceholderState />
                ) : activeChart === 'cumulative' ? (
                  <CumulativeChartWithDragSelect
                    data={symbolData.chartData}
                    chartScale="linear"
                    chartColor="#f59e0b"
                  />
                ) : (
                  <YearlyOverlayChart 
                    data={symbolData.tableData}
                    symbol={selectedSymbols[0]}
                  />
                )}
              </div>
            </div>

            {/* Analytics Matrix */}
            <div className="col-span-1 h-full">
              <WeeklyAnalyticsMatrix
                data={symbolData?.tableData || []}
                stats={stats}
              />
            </div>
          </motion.div>

          {/* Secondary Panels - Superimposed & Pattern Returns */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="grid grid-cols-2 gap-6 h-[320px]"
          >
            {/* Superimposed Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">Superimposed Pattern</h3>
                  <InfoTooltip content="Shows average pattern across all years overlaid as a single compounded line." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {symbolData ? (
                  <SuperimposedChart 
                    data={symbolData.tableData}
                    symbol={selectedSymbols[0]}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>

            {/* Weekly Returns */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-sm">Weekly Returns</h3>
                  <InfoTooltip content="Bar chart showing each week's return. Green = positive, Red = negative." />
                </div>
              </div>
              <div className="flex-1 w-full p-4 relative">
                {symbolData?.chartData?.length > 0 ? (
                  <ReturnBarChart
                    data={symbolData.chartData.map((d: any) => ({ date: d.date, returnPercentage: d.returnPercentage || 0 }))}
                    symbol={selectedSymbols[0]}
                    config={{ title: '', height: 240 }}
                    color="#f59e0b"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={() => refetch()}
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

// Stat Card Component with Metric Tooltip
function StatCard({ label, value, subValue, trend, metricKey }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  metricKey?: keyof typeof METRIC_DEFINITIONS;
}) {
  const metricDef = metricKey ? METRIC_DEFINITIONS[metricKey] : undefined;
  
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
        {subValue && (
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
            {subValue}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Superimposed Chart Component
function SuperimposedChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; week: number; value: number; avgReturn: number } | null>(null);
  const { filters } = useAnalysisStore();
  
  const weeklySuperimposedChartType = filters.weeklySuperimposedChartType || 'YearlyWeeks';
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

    const weekGroups: Record<number, number[]> = {};
    const groupByField = weeklySuperimposedChartType === 'YearlyWeeks' ? 'weekNumberYearly' : 'weekNumberMonthly';
    
    filteredData.forEach((d: any) => {
      const weekNum = d[groupByField] || 0;
      if (!weekGroups[weekNum]) {
        weekGroups[weekNum] = [];
      }
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 1;
    
    const superimposedData = sortedWeeks.map(weekNum => {
      const avgReturn = weekGroups[weekNum].reduce((sum, val) => sum + val, 0) / weekGroups[weekNum].length;
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      
      return {
        weekNumber: weekNum,
        avgReturn,
        compoundedReturn: (compoundedValue - 1) * 100,
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

    const chartData = superimposedData.map((d: any) => ({
      time: d.weekNumber as any,
      value: d.compoundedReturn,
      avgReturn: d.avgReturn,
    }));

    areaSeries.setData(chartData as any);
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
        
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          week: param.time,
          value: dataPoint.value,
          avgReturn: originalData?.avgReturn || 0,
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
  }, [data, weeklySuperimposedChartType, electionChartTypes]);

  return (
    <div ref={chartContainerRef} className="h-full w-full relative">
      {tooltip && tooltip.visible && (
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
