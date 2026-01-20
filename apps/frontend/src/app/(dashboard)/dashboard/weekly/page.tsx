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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { 
  SymbolSelector, 
  DateRangePicker, 
  YearFilters, 
  MonthFilters, 
  WeekFilters,
  SpecialDaysFilter
} from '@/components/filters';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-emerald-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

export default function WeeklyPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale, setChartScale } = useAnalysisStore();
  const [weekType, setWeekType] = useState<'monday' | 'expiry'>('expiry');
  const [activeTab, setActiveTab] = useState('chart');
  const [chartMode, setChartMode] = useState<'cumulative' | 'superimposed' | 'yearly-overlay'>('cumulative');
  const [filterOpen, setFilterOpen] = useState(true);
  const [filterWidth, setFilterWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX - 64;
    if (newWidth >= 200 && newWidth <= 500) {
      setFilterWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['weekly-analysis', selectedSymbols, startDate, endDate, filters, weekType],
    queryFn: async () => {
      const response = await analysisApi.weekly({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
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

  // Snapshot function
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
      link.download = `${selectedSymbols[0]}_weekly_${weekType}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!symbolData?.chartData) return;
    
    const csvData = symbolData.chartData.map((row: any) => ({
      Date: new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Return %': row.returnPercentage?.toFixed(2),
      'Cumulative': row.cumulative?.toFixed(2),
    }));
    
    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map((row: any) => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `${selectedSymbols[0]}_weekly_${weekType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  return (
    <div className="flex h-full bg-slate-50" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
      {/* LEFT SIDEBAR - FILTER CONSOLE */}
      <aside 
        style={{ 
          width: filterOpen ? filterWidth : 0,
          transition: isResizing ? 'none' : 'width 0.3s ease-out'
        }}
        className="bg-white border-r border-slate-200 flex flex-col overflow-hidden relative"
      >
        <div className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Filter Console</h2>
          </div>
          <button 
            onClick={() => setFilterOpen(false)}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Market Context */}
          <FilterSection title="Market Context" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Asset Class</label>
                <SymbolSelector />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Week Type</label>
                <Select value={weekType} onValueChange={(v) => setWeekType(v as 'monday' | 'expiry')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="monday">Monday Week</SelectItem>
                    <SelectItem value="expiry">Expiry Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>

          {/* Time Ranges */}
          <FilterSection title="Time Ranges" defaultOpen>
            <div className="space-y-3">
              <DateRangePicker />
            </div>
          </FilterSection>

          {/* Temporal Filters */}
          <FilterSection title="Year Filters">
            <YearFilters />
          </FilterSection>

          <FilterSection title="Month Filters">
            <MonthFilters />
          </FilterSection>

          <FilterSection title="Week Filters">
            <WeekFilters weekType={weekType} />
          </FilterSection>

          {/* Advanced Filters */}
          <FilterSection title="Advanced Filters">
            <SpecialDaysFilter />
          </FilterSection>
        </div>

        {/* Apply Filters Button */}
        <div className="flex-shrink-0 p-3 border-t border-slate-100">
          <Button 
            onClick={() => refetch()} 
            disabled={isFetching || selectedSymbols.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg"
          >
            {isFetching ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Computing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-current" />
                APPLY FILTERS
              </div>
            )}
          </Button>
        </div>

        {/* RESIZE HANDLE */}
        {filterOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-400 transition-colors group",
              isResizing && "bg-emerald-500"
            )}
          >
            <div className="absolute right-0 top-0 bottom-0 w-4 -mr-2" />
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {!filterOpen && (
              <button 
                onClick={() => setFilterOpen(true)}
                className="p-2 hover:bg-slate-100 rounded"
              >
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-emerald-600" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedSymbols[0] || 'Select Symbol'}
                </h1>
                <p className="text-xs text-slate-500">Weekly Analysis Engine ({weekType === 'monday' ? 'Monday' : 'Expiry'})</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">1H</span>
              <span className="text-slate-500 font-semibold">1D</span>
              <span className="text-emerald-600 font-bold">1W</span>
              <span className="text-slate-500 font-semibold">1M</span>
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

              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={selectedSymbols[0] || 'User'}>
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
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                subtitle="Hist. Avg"
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
              />
              <StatCard
                label="MAX DRAWDOWN"
                value={`${(stats.maxLoss || 0).toFixed(2)}%`}
                subtitle={`Max Gain: ${(stats.maxGain || 0).toFixed(2)}%`}
                trend="down"
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
              />
            </div>
          </div>
        )}

        {/* CHART AREA */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full bg-white rounded-lg border border-slate-200 flex flex-col">
            {/* Chart Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">
                {chartMode === 'cumulative' ? 'Cumulative Returns' : 
                 chartMode === 'superimposed' ? 'Superimposed Pattern' : 
                 'Yearly Overlay Pattern'}
              </h3>
              <div className="flex items-center gap-2">
                {/* Chart Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartMode('cumulative')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                      chartMode === 'cumulative' 
                        ? "bg-white text-emerald-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Cumulative
                  </button>
                  <button
                    onClick={() => setChartMode('superimposed')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                      chartMode === 'superimposed' 
                        ? "bg-white text-emerald-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Superimposed
                  </button>
                  <button
                    onClick={() => setChartMode('yearly-overlay')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                      chartMode === 'yearly-overlay' 
                        ? "bg-white text-emerald-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Yearly Overlay
                  </button>
                </div>
                
                <div className="w-px h-6 bg-slate-200"></div>
                
                <button
                  onClick={() => setActiveTab('chart')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                    activeTab === 'chart' 
                      ? "bg-emerald-50 text-emerald-600" 
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
                      ? "bg-emerald-50 text-emerald-600" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Data
                </button>
                
                {activeTab === 'chart' ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSnapshot}
                    disabled={!symbolData}
                  >
                    SNAPSHOT
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={!symbolData}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>

            {/* Chart Content */}
            <div className="flex-1 p-4 overflow-hidden" ref={chartRef}>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center"
                  >
                    <Loading size="lg" />
                    <p className="mt-4 text-sm text-slate-500">Loading market data...</p>
                  </motion.div>
                ) : !symbolData ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center"
                  >
                    <BarChart3 className="h-16 w-16 text-slate-200 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">System Idle</h3>
                    <p className="text-sm text-slate-500 mt-2">Configure filters and click Apply Filters</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="content"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    {activeTab === 'chart' ? (
                      chartMode === 'cumulative' ? (
                        <CumulativeChart 
                          data={symbolData.chartData} 
                          chartScale={chartScale}
                        />
                      ) : chartMode === 'superimposed' ? (
                        <SuperimposedChart 
                          data={symbolData.tableData}
                          symbol={selectedSymbols[0]}
                        />
                      ) : (
                        <YearlyOverlayChart 
                          data={symbolData.tableData}
                          symbol={selectedSymbols[0]}
                        />
                      )
                    ) : (
                      <SeasonalDataTable data={symbolData.chartData} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, subtitle, change, trend }: {
  label: string;
  value: string;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
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

// Filter Section Component
function FilterSection({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
      >
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-white">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Superimposed Chart - Shows average pattern across all years
function SuperimposedChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; week: number; value: number; avgReturn: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Group by week number yearly and calculate average returns
    const weekGroups: Record<number, number[]> = {};
    
    data.forEach((d: any) => {
      const weekNum = d.weekNumberYearly || 0;
      if (!weekGroups[weekNum]) {
        weekGroups[weekNum] = [];
      }
      weekGroups[weekNum].push(d.returnPercentage || 0);
    });

    // Calculate average return for each week and compound it
    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 1; // Start at 1 (100%)
    
    const superimposedData = sortedWeeks.map(weekNum => {
      const avgReturn = weekGroups[weekNum].reduce((sum, val) => sum + val, 0) / weekGroups[weekNum].length;
      
      // Compound: multiply by (1 + avgReturn/100)
      compoundedValue = compoundedValue * (1 + avgReturn / 100);
      
      return {
        weekNumber: weekNum,
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
          color: '#10b981',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#10b981',
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
    
    // Configure time scale to show week numbers
    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        return `Week ${time}`;
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
  }, [data]);

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
          <div className="text-emerald-600 font-bold">
            YTD Return: {tooltip.value.toFixed(2)}%
          </div>
          <div className="text-slate-600">
            Avg Weekly: {tooltip.avgReturn.toFixed(2)}%
          </div>
        </div>
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
          color: '#10b981',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#10b981',
          style: 2,
        },
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#10b981',
      topColor: 'rgba(16, 185, 129, 0.4)',
      bottomColor: 'rgba(16, 185, 129, 0.0)',
      lineWidth: 2,
    });

    const chartData = data.map((d: any) => ({
      time: (new Date(d.date).getTime() / 1000) as any,
      value: d.cumulative || 0,
    }));

    areaSeries.setData(chartData as any);
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
          day: '2-digit', 
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
          <div className="text-emerald-600 font-bold">
            Cumulative: {tooltip.value.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// Yearly Overlay Chart - Shows each year's pattern overlaid
function YearlyOverlayChart({ data, symbol }: { data: any[]; symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; week: number; values: Array<{ year: string; value: number; color: string }> } | null>(null);

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
          color: '#10b981',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#10b981',
          style: 2,
        },
      },
    });

    chartRef.current = chart;

    // Group data by year
    const yearGroups: Record<number, any[]> = {};
    data.forEach((d: any) => {
      const year = new Date(d.date).getFullYear();
      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }
      yearGroups[year].push({
        weekNumber: d.weekNumberYearly || 0,
        returnPercentage: d.returnPercentage || 0,
      });
    });

    // Create a line series for each year
    const colors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
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

    // Configure time scale to show week numbers
    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => {
        return `Week ${time}`;
      },
    });

    // Tooltip handler
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
  }, [data]);

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

// Seasonal Data Table
function SeasonalDataTable({ data }: { 
  data: any[]; 
}) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No data available
      </div>
    );
  }
  
  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
              <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Return %</th>
              <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Cumulative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm font-medium text-slate-900">
                  {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className={`px-4 py-2 text-sm font-semibold ${row.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {row.returnPercentage?.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-sm text-slate-600">{row.cumulative?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex-shrink-0 p-4 border-t flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {page + 1} of {totalPages} ({data.length} records)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
