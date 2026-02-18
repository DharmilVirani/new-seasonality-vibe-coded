'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, BarChart3, Activity, Filter, 
  ChevronDown, Download, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Settings, LogOut, Calendar
} from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

import { 
  SymbolSelector, 
  DateRangePicker, 
  YearFilters, 
  MonthFilters,
  OutlierFilters
} from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/MetricTooltip';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-purple-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

const PRIMARY_COLOR = '#8b5cf6';

export default function MonthlyPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale, resetFilters } = useAnalysisStore();
  const { timeRangeSelection, clearTimeRangeSelection } = useChartSelectionStore();
  const [monthType, setMonthType] = useState<'calendar' | 'expiry'>('calendar');
  const [activeTab, setActiveTab] = useState('chart');
  const [chartMode, setChartMode] = useState<'cumulative' | 'yearly-overlay' | 'aggregate'>('cumulative');
  const [aggregateType, setAggregateType] = useState<'total' | 'avg' | 'max' | 'min'>('total');
  const [filterOpen, setFilterOpen] = useState(true);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['monthly-analysis', selectedSymbols, startDate, endDate, filters, monthType, timeRangeSelection.startDate, timeRangeSelection.endDate],
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

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

  const handleSnapshot = async () => {
    if (!chartRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        background: '#ffffff',
        scale: 2,
        logging: false,
      } as any);
      
      const link = document.createElement('a');
      link.download = `${selectedSymbols[0]}_monthly_${monthType}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    }
  };

  const handleExportCSV = () => {
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

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* TOP HEADER */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedSymbols[0] || 'Select Symbol'}
                </h1>
                <p className="text-xs text-slate-500">Monthly Analysis Engine ({monthType === 'calendar' ? 'Calendar' : 'Expiry'})</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Selection indicator */}
            {timeRangeSelection.isActive && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-xs font-semibold text-purple-700">
                  {timeRangeSelection.startDate} → {timeRangeSelection.endDate}
                </div>
                <button
                  onClick={clearTimeRangeSelection}
                  className="text-purple-600 hover:text-purple-800 font-bold"
                  title="Clear selection"
                >
                  ✕
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">1H</span>
              <span className="text-slate-500 font-semibold">1D</span>
              <span className="text-slate-500 font-semibold">1W</span>
              <span className="text-purple-600 font-bold">1M</span>
            </div>
            
            {/* User Profile Section */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
              <button
                onClick={() => {}}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('accessToken');
                    window.location.href = '/login';
                  }
                }}
                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>

              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={selectedSymbols[0] || 'User'}>
                {selectedSymbols[0]?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* STATISTICS CARDS */}
        {stats && (
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="CAGR"
                value={`${(stats.cagr || 0).toFixed(2)}%`}
                subtitle={`Avg: ${(stats.avgReturnAll || 0).toFixed(2)}%`}
                trend={(stats.cagr || 0) >= 0 ? 'up' : 'down'}
                metricKey="cagr"
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                subtitle="Hist. Avg"
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
                metricKey="winRate"
              />
              <StatCard
                label="MAX DRAWDOWN"
                value={`${(stats.maxDrawdown || 0).toFixed(2)}%`}
                subtitle={`Max Gain: ${(stats.maxGain || 0).toFixed(2)}%`}
                trend="down"
                metricKey="maxDrawdown"
              />
              <StatCard
                label="SHARPE RATIO"
                value={(stats.sharpeRatio || 0).toFixed(2)}
                subtitle={
                  stats.sharpeRatio > 2 ? 'Excellent' :
                  stats.sharpeRatio > 1 ? 'Good' :
                  stats.sharpeRatio > 0 ? 'Fair' : 'Poor'
                }
                trend={(stats.sharpeRatio || 0) > 0 ? 'up' : 'down'}
                metricKey="sharpeRatio"
              />
            </div>
          </div>
        )}

        {/* CHART AREA */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-4 max-w-[1800px] mx-auto">
            {/* Chart Mode Selector */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 w-fit">
              {[
                { id: 'cumulative', label: 'Cumulative' },
                { id: 'yearly-overlay', label: 'Yearly' },
                { id: 'aggregate', label: 'Aggregate' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setChartMode(mode.id as any)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium rounded-md transition-colors",
                    chartMode === mode.id
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Aggregate Controls */}
            {chartMode === 'aggregate' && (
              <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-3 w-fit">
                <Select value={aggregateType} onValueChange={(v) => setAggregateType(v as any)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white shadow-lg">
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                    <SelectItem value="max">Maximum</SelectItem>
                    <SelectItem value="min">Minimum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Main Chart + Analytics Matrix */}
            <div className="grid grid-cols-3 gap-4 h-[420px]">
              {/* Main Chart */}
              <div className="col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center">
                    <h3 className="font-semibold text-slate-800 text-sm">
                      {chartMode === 'cumulative' && 'Cumulative Returns'}
                      {chartMode === 'yearly-overlay' && 'Yearly Overlay'}
                      {chartMode === 'aggregate' && `${aggregateType.charAt(0).toUpperCase() + aggregateType.slice(1)} by Month`}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('chart')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                        activeTab === 'chart' 
                          ? "bg-purple-50 text-purple-600" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setActiveTab('table')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                        activeTab === 'table' 
                          ? "bg-purple-50 text-purple-600" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Data
                    </button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleSnapshot}
                      disabled={!symbolData}
                    >
                      SNAPSHOT
                    </Button>
                  </div>
                </div>
                <div className="flex-1 w-full relative p-4" ref={chartRef}>
                  {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <Loading size="lg" />
                      <p className="mt-4 text-sm text-slate-500">Loading market data...</p>
                    </div>
                  ) : !symbolData ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <BarChart3 className="h-16 w-16 text-slate-200 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700">System Idle</h3>
                      <p className="text-sm text-slate-500 mt-2">Configure filters and click Apply Filters</p>
                    </div>
                  ) : activeTab === 'table' ? (
                    <SeasonalDataTable data={symbolData.chartData} />
                  ) : chartMode === 'cumulative' ? (
                    <CumulativeChartWithDragSelect 
                      data={symbolData.chartData} 
                      chartScale={chartScale}
                      onRangeSelected={(start, end) => {
                        console.log('📊 Monthly - Range selected:', start, 'to', end);
                      }}
                    />
                  ) : chartMode === 'aggregate' ? (
                    <AggregateChart 
                      data={symbolData.chartData}
                      aggregateType={aggregateType}
                    />
                  ) : (
                    <YearlyOverlayChart 
                      data={symbolData.chartData}
                      symbol={selectedSymbols[0]}
                    />
                  )}
                </div>
              </div>

              {/* Analytics Matrix */}
              <div className="col-span-1 h-full">
                <MonthlyAnalyticsMatrix
                  data={symbolData?.chartData || []}
                  stats={stats}
                />
              </div>
            </div>

            {/* Secondary Panels - Superimposed & Pattern Returns */}
            <div className="grid grid-cols-2 gap-4 h-[300px]">
              {/* Superimposed Chart */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Superimposed Pattern</h3>
                </div>
                <div className="flex-1 w-full p-4 relative">
                  {symbolData ? (
                    <SuperimposedChart 
                      data={symbolData.chartData}
                      symbol={selectedSymbols[0]}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                  )}
                </div>
              </div>

              {/* Monthly Returns */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Monthly Returns</h3>
                </div>
                <div className="flex-1 w-full p-4 relative">
                {symbolData?.chartData?.length > 0 ? (
                  <ReturnBarChart
                    data={symbolData.chartData.map((d: any) => ({ date: d.date, returnPercentage: d.returnPercentage || 0 }))}
                    symbol={selectedSymbols[0]}
                    config={{ title: '', height: 240 }}
                    color="#8b5cf6"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
                </div>
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
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Market Context" defaultOpen delay={0}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Asset Class</label>
              <SymbolSelector />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Month Type</label>
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
          </div>
        </FilterSection>

        <FilterSection title="Time Ranges" defaultOpen delay={0.05}>
          <div className="space-y-3">
            <DateRangePicker />
          </div>
        </FilterSection>

        <FilterSection title="Year Filters" delay={0.1}>
          <YearFilters />
        </FilterSection>

        <FilterSection title="Month Filters" delay={0.15}>
          <MonthFilters />
        </FilterSection>

        <FilterSection title="Risk Management" delay={0.1}>
          <OutlierFilters />
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, subtitle, change, trend, metricKey }: {
  label: string;
  value: string;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down';
  metricKey?: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center">
        {label}
        {metricKey && <MetricTooltip metric={metricKey} />}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-bold text-slate-900">{value}</div>
        {change && (
          <div className={cn(
            "text-xs font-semibold flex items-center gap-1",
            trend === 'up' ? "text-green-600" : "text-red-600"
          )}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {change}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

// Cumulative Chart Component
function CumulativeChart({ data, chartScale }: { 
  data: any[]; 
  chartScale: 'linear' | 'log';
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; date: string; value: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

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
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#9333EA',
      topColor: 'rgba(147, 51, 234, 0.4)',
      bottomColor: 'rgba(147, 51, 234, 0.0)',
      lineWidth: 2,
    });

    const chartData = data.map((d: any) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000) as any,
      value: d.cumulative || 0,
      originalDate: d.date,
    }));

    areaSeries.setData(chartData);
    chart.timeScale().fitContent();

    // Tooltip handler
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const dataPoint = param.seriesData.get(areaSeries);
      if (dataPoint) {
        const dateStr = new Date(param.time * 1000).toLocaleDateString('en-IN', { 
          month: 'short', 
          year: 'numeric' 
        });
        
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          date: dateStr,
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
  }, [data, chartScale]);

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
          <div className="text-purple-600 font-bold">
            Cumulative: {tooltip.value.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

// Superimposed Chart - Shows average pattern across all years
function SuperimposedChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; month: number; value: number; avgReturn: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Group by month (1-12)
    const monthGroups: Record<number, number[]> = {};
    
    data.forEach((d: any) => {
      const month = new Date(d.date).getMonth() + 1; // 1-12
      if (!monthGroups[month]) {
        monthGroups[month] = [];
      }
      monthGroups[month].push(d.returnPercentage || 0);
    });

    // Calculate average return for each month and compound it
    const sortedMonths = Object.keys(monthGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 1; // Start at 1 (100%)
    
    const superimposedData = sortedMonths.map(month => {
      const avgReturn = monthGroups[month].reduce((sum, val) => sum + val, 0) / monthGroups[month].length;
      
      // Compound: multiply by (1 + avgReturn/100)
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      
      return {
        month,
        avgReturn,
        compoundedReturn: (compoundedValue - 1) * 100, // Convert back to percentage
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
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#000000',
      topColor: 'rgba(224, 231, 255, 0.4)',
      bottomColor: 'rgba(224, 231, 255, 0.0)',
      lineWidth: 2,
    });

    const chartData = superimposedData.map((d: any) => ({
      time: d.month as any,
      value: d.compoundedReturn,
      avgReturn: d.avgReturn,
    }));

    areaSeries.setData(chartData as any);
    
    // Configure time scale to show month names
    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[time - 1] || '';
      },
    });

    // Tooltip handler
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const dataPoint = param.seriesData.get(areaSeries);
      if (dataPoint) {
        const originalData = superimposedData.find((d: any) => d.month === param.time);
        
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          month: param.time,
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
  }, [data]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
          <div className="font-semibold text-slate-700 mb-1">{monthNames[tooltip.month - 1]}</div>
          <div className="text-purple-600 font-bold">
            YTD Return: {tooltip.value.toFixed(2)}%
          </div>
          <div className="text-slate-600">
            Avg Monthly: {tooltip.avgReturn.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

// Yearly Overlay Chart - Each year's pattern overlaid
function YearlyOverlayChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; data: any[] } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Group data by year
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

    // Color palette for different years
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

      // Calculate cumulative returns for this year
      let cumulative = 0;
      const chartData = yearData.map((d: any, i: number) => {
        cumulative += d.returnPercentage || 0;
        return {
          time: (i + 1) as any, // Month number 1-12
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

    // Tooltip handler
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

// Aggregate Chart - Shows total/avg/max/min by month
function AggregateChart({ data, aggregateType }: { 
  data: any[]; 
  aggregateType: 'total' | 'avg' | 'max' | 'min';
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; month: string; value: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Group by month
    const monthGroups: Record<number, number[]> = {};
    data.forEach((d: any) => {
      const month = new Date(d.date).getMonth() + 1;
      if (!monthGroups[month]) {
        monthGroups[month] = [];
      }
      monthGroups[month].push(d.returnPercentage || 0);
    });

    // Calculate aggregate values
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

    // Tooltip handler
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

// Monthly Analytics Matrix Component
function MonthlyAnalyticsMatrix({ data, stats }: { data: any[]; stats: any }) {
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

  const metrics = [
    { label: 'CAGR', value: `${(stats?.cagr || 0).toFixed(2)}%`, trend: (stats?.cagr || 0) > 0 ? 'up' : 'down', subType: 'Annual Return' },
    { label: 'Avg Return', value: `${(stats?.avgReturnAll || 0).toFixed(2)}%`, trend: (stats?.avgReturnAll || 0) > 0 ? 'up' : 'down', subType: 'Per Month' },
    { label: 'Total P/L', value: `${(stats?.cumulativeReturn || 0).toFixed(2)}%`, trend: (stats?.cumulativeReturn || 0) > 0 ? 'up' : 'down', subType: stats?.cumulativeReturn >= 0 ? 'Profit' : 'Loss' },
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
                  <linearGradient id="colorCountMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RechartsTooltip
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-800">
                          <p className="font-bold mb-1">Return: {payload[0]?.payload?.range}%</p>
                          <p className="text-purple-300">Count: {payload[0]?.value}</p>
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
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorCountMonthly)"
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
                  metric.trend === 'up' ? "text-purple-600" : metric.trend === 'down' ? "text-rose-600" : "text-slate-800"
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

// Data Table Component
function SeasonalDataTable({ data }: { data: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const currentData = data.slice(startIdx, endIdx);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Return %</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-700">Cumulative</th>
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
