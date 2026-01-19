'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, BarChart3, Activity, Filter, 
  ChevronDown, Download, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Settings, LogOut
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { 
  SymbolSelector, 
  DateRangePicker, 
  YearFilters, 
  MonthFilters, 
  WeekFilters, 
  DayFilters, 
  OutlierFilters 
} from '@/components/filters';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-indigo-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

export default function DailyPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, filters, chartScale } = useAnalysisStore();
  const [activeTab, setActiveTab] = useState('chart');
  const [chartMode, setChartMode] = useState<'cumulative' | 'superimposed'>('cumulative');
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
    const newWidth = e.clientX - 64; // 64px is the nav sidebar width
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
    queryKey: ['daily-analysis', selectedSymbols, startDate, endDate, lastNDays, filters],
    queryFn: async () => {
      const response = await analysisApi.daily({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        lastNDays,
        filters,
        chartScale,
      });
      return response.data.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const symbolData = data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

  // Snapshot function to capture chart as image
  const handleSnapshot = async () => {
    if (!chartRef.current) return;
    
    try {
      // @ts-ignore - html2canvas types
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `${selectedSymbols[0]}_${chartMode}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
    }
  };

  // Export CSV function
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
    link.download = `${selectedSymbols[0]}_data_${new Date().toISOString().split('T')[0]}.csv`;
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
            <Filter className="h-4 w-4 text-indigo-600" />
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
            <WeekFilters weekType="expiry" />
          </FilterSection>

          <FilterSection title="Day Filters">
            <DayFilters />
          </FilterSection>

          {/* Risk Management */}
          <FilterSection title="Risk Management">
            <OutlierFilters />
          </FilterSection>
        </div>

        {/* Apply Filters Button */}
        <div className="flex-shrink-0 p-3 border-t border-slate-100">
          <Button 
            onClick={() => refetch()} 
            disabled={isFetching || selectedSymbols.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg"
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
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors group",
              isResizing && "bg-indigo-500"
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
              <Activity className="h-6 w-6 text-indigo-600" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedSymbols[0] || 'Select Symbol'}
                </h1>
                <p className="text-xs text-slate-500">Daily Analysis Engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">1H</span>
              <span className="text-indigo-600 font-bold">1D</span>
              <span className="text-slate-500 font-semibold">1W</span>
              <span className="text-slate-500 font-semibold">1M</span>
            </div>
            
            {/* User Profile Section */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
              <button
                onClick={() => {/* Add settings navigation */}}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => {
                  // Add logout logic
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

              {/* User Avatar */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={selectedSymbols[0] || 'User'}>
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
                label="AVG. ANNUAL RETURN"
                value={`${(stats.avgReturnAll || 0).toFixed(2)}%`}
                change="+2.1%"
                trend={(stats.avgReturnAll || 0) >= 0 ? 'up' : 'down'}
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
                subtitle={`Ø3 ${new Date().getFullYear()}`}
                trend="down"
              />
              <StatCard
                label="SHARPE RATIO"
                value="1.92"
                subtitle="Excellent"
                trend="up"
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
                {chartMode === 'cumulative' ? 'Seasonal Probability Matrix' : 'Superimposed Daily Chart'}
              </h3>
              <div className="flex items-center gap-2">
                {/* Chart Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartMode('cumulative')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                      chartMode === 'cumulative' 
                        ? "bg-white text-indigo-600 shadow-sm" 
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
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Superimposed
                  </button>
                </div>
                
                <div className="w-px h-6 bg-slate-200"></div>
                
                <button
                  onClick={() => setActiveTab('chart')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                    activeTab === 'chart' 
                      ? "bg-indigo-50 text-indigo-600" 
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
                      ? "bg-indigo-50 text-indigo-600" 
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
                        <ChartOnly 
                          data={symbolData.chartData} 
                          chartScale={chartScale}
                        />
                      ) : (
                        <SuperimposedChartView 
                          data={symbolData.chartData}
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

// Chart Component
function ChartOnly({ data, chartScale }: { 
  data: any[]; 
  chartScale: 'linear' | 'log';
}) {
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    return data.map((d: any, index: number) => {
      const date = new Date(d.date);
      return {
        ...d,
        originalIndex: index,
        fullDate: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        yearLabel: date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        year: date.getFullYear(),
        month: date.getMonth(),
        cumulativeReturn: d.cumulative || 0,
      };
    });
  }, [data]);

  // Visible data based on zoom
  const visibleData = useMemo(() => {
    const baseData = zoomDomain && chartData.length > 0 
      ? chartData.slice(zoomDomain.start, zoomDomain.end + 1)
      : chartData;
    
    return baseData.map((d, idx) => ({
      ...d,
      index: idx
    }));
  }, [chartData, zoomDomain]);

  // Calculate which indices should show year labels for visible data
  const yearTickIndices = useMemo(() => {
    const indices: number[] = [];
    const seenYears = new Set<number>();
    
    visibleData.forEach((d, idx) => {
      // Show label for January of each year
      if (d.month === 0 && !seenYears.has(d.year)) {
        seenYears.add(d.year);
        indices.push(idx);
      }
    });
    
    // If no January found, show labels at regular intervals
    if (indices.length === 0 && visibleData.length > 0) {
      const numLabels = Math.min(10, Math.ceil(visibleData.length / 200));
      const step = Math.floor(visibleData.length / numLabels);
      for (let i = 0; i < visibleData.length; i += step) {
        indices.push(i);
      }
      // Always include the last point
      if (indices[indices.length - 1] !== visibleData.length - 1) {
        indices.push(visibleData.length - 1);
      }
    }
    
    return indices;
  }, [visibleData]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || chartData.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Shift + scroll for horizontal panning
      if (e.shiftKey) {
        setZoomDomain((prev) => {
          const currentStart = prev?.start ?? 0;
          const currentEnd = prev?.end ?? chartData.length - 1;
          const currentRange = currentEnd - currentStart;
          
          // Pan amount based on scroll direction
          const panAmount = Math.round(currentRange * 0.1);
          const delta = e.deltaY > 0 ? panAmount : -panAmount;
          
          let newStart = currentStart + delta;
          let newEnd = currentEnd + delta;
          
          // Boundary checks
          if (newStart < 0) {
            newStart = 0;
            newEnd = currentRange;
          }
          if (newEnd >= chartData.length) {
            newEnd = chartData.length - 1;
            newStart = Math.max(0, newEnd - currentRange);
          }
          
          // If at full view, don't pan
          if (currentRange >= chartData.length) {
            return null;
          }
          
          return { start: newStart, end: newEnd };
        });
      } else {
        // Regular scroll for zoom
        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? 1 + zoomFactor : 1 - zoomFactor;
        
        setZoomDomain((prev) => {
          const currentStart = prev?.start ?? 0;
          const currentEnd = prev?.end ?? chartData.length - 1;
          const currentRange = currentEnd - currentStart;
          
          // Calculate new range
          const newRange = Math.max(50, Math.min(chartData.length, Math.round(currentRange * delta)));
          
          // Keep zoom centered
          const center = (currentStart + currentEnd) / 2;
          let newStart = Math.round(center - newRange / 2);
          let newEnd = Math.round(center + newRange / 2);
          
          // Boundary checks
          if (newStart < 0) {
            newStart = 0;
            newEnd = newRange;
          }
          if (newEnd >= chartData.length) {
            newEnd = chartData.length - 1;
            newStart = Math.max(0, newEnd - newRange);
          }
          
          // If fully zoomed out, reset
          if (newRange >= chartData.length) {
            return null;
          }
          
          return { start: newStart, end: newEnd };
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [chartData]);

  // Reset zoom on double click
  const handleDoubleClick = () => {
    setZoomDomain(null);
  };

  return (
    <div className="h-full w-full relative" ref={chartContainerRef} onDoubleClick={handleDoubleClick}>
      {zoomDomain && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
          Showing: {visibleData.length} of {chartData.length} points • Shift+Scroll to pan • Double-click to reset
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={visibleData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.25}/>
              <stop offset="100%" stopColor="#4F46E5" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
          <XAxis
            dataKey="index"
            ticks={yearTickIndices}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value) => {
              const point = visibleData[value];
              return point ? point.yearLabel : '';
            }}
          />
          <YAxis
            scale={chartScale}
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value: number) => `${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
            itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#4F46E5' }}
            labelStyle={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}
            formatter={(value: number) => [`${value.toFixed(2)}`, 'Cumulative']}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullDate;
              }
              return label;
            }}
          />
          <ReferenceLine y={100} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="cumulativeReturn"
            stroke="#4F46E5"
            strokeWidth={2}
            fill="url(#colorReturn)"
            activeDot={{ r: 4, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Seasonal Data Table
function SeasonalDataTable({ data }: { 
  data: any[]; 
}) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  if (!data) {
    return (
      <div className="text-center py-8 text-slate-500">
        Loading data...
      </div>
    );
  }
  
  if (!Array.isArray(data) || data.length === 0) {
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

// Superimposed Chart View - Shows average daily pattern across all years
function SuperimposedChartView({ data, symbol }: { data: any[]; symbol: string }) {
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);

  // Calculate average returns by day-of-year across all years
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Group by day-of-year and calculate average return
    const dayGroups: Record<number, number[]> = {};
    
    data.forEach((d) => {
      const date = new Date(d.date);
      const year = date.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (!dayGroups[dayOfYear]) {
        dayGroups[dayOfYear] = [];
      }
      
      // Use returnPercentage (daily change), not cumulative
      dayGroups[dayOfYear].push(d.returnPercentage || 0);
    });

    // Calculate average return for each day and compound it starting from 0
    const sortedDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);
    let compoundedValue = 0; // Start at 0%
    
    return sortedDays.map(day => {
      const avgReturn = dayGroups[day].reduce((sum, val) => sum + val, 0) / dayGroups[day].length;
      
      // Compound: (1 + previous%) * (1 + daily%) - 1
      compoundedValue = ((1 + compoundedValue / 100) * (1 + avgReturn / 100) - 1) * 100;
      
      return {
        day,
        avgReturn,
        compoundedReturn: compoundedValue,
        count: dayGroups[day].length
      };
    });
  }, [data]);

  const visibleData = useMemo(() => {
    if (!zoomDomain || chartData.length === 0) {
      return chartData;
    }
    return chartData.slice(zoomDomain.start, zoomDomain.end + 1);
  }, [chartData, zoomDomain]);

  // Handle mouse wheel zoom and pan
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || chartData.length === 0) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Shift + scroll for horizontal panning
      if (e.shiftKey) {
        setZoomDomain((prev) => {
          const currentStart = prev?.start ?? 0;
          const currentEnd = prev?.end ?? chartData.length - 1;
          const currentRange = currentEnd - currentStart;
          
          // Pan amount based on scroll direction
          const panAmount = Math.round(currentRange * 0.1);
          const delta = e.deltaY > 0 ? panAmount : -panAmount;
          
          let newStart = currentStart + delta;
          let newEnd = currentEnd + delta;
          
          // Boundary checks
          if (newStart < 0) {
            newStart = 0;
            newEnd = currentRange;
          }
          if (newEnd >= chartData.length) {
            newEnd = chartData.length - 1;
            newStart = Math.max(0, newEnd - currentRange);
          }
          
          // If at full view, don't pan
          if (currentRange >= chartData.length) {
            return null;
          }
          
          return { start: newStart, end: newEnd };
        });
      } else {
        // Regular scroll for zoom
        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? 1 + zoomFactor : 1 - zoomFactor;
        
        setZoomDomain((prev) => {
          const currentStart = prev?.start ?? 0;
          const currentEnd = prev?.end ?? chartData.length - 1;
          const currentRange = currentEnd - currentStart;
          
          const newRange = Math.max(50, Math.min(chartData.length, Math.round(currentRange * delta)));
          
          const center = (currentStart + currentEnd) / 2;
          let newStart = Math.round(center - newRange / 2);
          let newEnd = Math.round(center + newRange / 2);
          
          if (newStart < 0) {
            newStart = 0;
            newEnd = newRange;
          }
          if (newEnd >= chartData.length) {
            newEnd = chartData.length - 1;
            newStart = Math.max(0, newEnd - newRange);
          }
          
          if (newRange >= chartData.length) {
            return null;
          }
          
          return { start: newStart, end: newEnd };
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [chartData]);

  const handleDoubleClick = () => {
    setZoomDomain(null);
  };

  return (
    <div className="h-full w-full relative" ref={chartContainerRef} onDoubleClick={handleDoubleClick}>
      {zoomDomain && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
          Showing: {visibleData.length} of {chartData.length} days • Shift+Scroll to pan • Double-click to reset
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
        {symbol} - All Years
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={visibleData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="superimposedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0E7FF" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#E0E7FF" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            label={{ value: 'Days', position: 'insideBottom', offset: -5, style: { fontSize: 12, fontWeight: 700, fill: '#1e293b' } }}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value: number) => `${value.toFixed(2)}`}
            label={{ value: 'Compounded Percentage Return', angle: -90, position: 'insideLeft', style: { fontSize: 12, fontWeight: 700, fill: '#1e293b' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
            labelStyle={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}
            itemStyle={{ fontSize: 11, fontWeight: 600 }}
            formatter={(value: number, name: string) => {
              if (name === 'compoundedReturn') return [`${value.toFixed(2)}%`, 'YTD Return'];
              return [`${value.toFixed(2)}%`, 'Daily Change'];
            }}
            labelFormatter={(label) => `Day ${label}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
          
          <Area
            type="monotone"
            dataKey="compoundedReturn"
            stroke="#000000"
            strokeWidth={2}
            fill="url(#superimposedGradient)"
            dot={false}
            name="compoundedReturn"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
