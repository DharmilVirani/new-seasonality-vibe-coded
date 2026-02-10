'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, BarChart3, Activity, Filter, 
  ChevronDown, Download, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Settings, LogOut, Zap, Calendar
} from 'lucide-react';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { 
  SymbolSelector, 
  DateRangePicker
} from '@/components/filters';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-violet-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

export default function EventsPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, chartScale } = useAnalysisStore();
  const { timeRangeSelection, clearTimeRangeSelection } = useChartSelectionStore();
  const [activeTab, setActiveTab] = useState('chart');
  const [filterOpen, setFilterOpen] = useState(true);
  const [filterWidth, setFilterWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // Event-specific filters
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('INDIA');
  const [windowBefore, setWindowBefore] = useState<number>(10);
  const [windowAfter, setWindowAfter] = useState<number>(10);
  const [entryPoint, setEntryPoint] = useState<'T-1_CLOSE' | 'T0_OPEN' | 'T0_CLOSE'>('T-1_CLOSE');
  const [exitPoint, setExitPoint] = useState<string>('T+10_CLOSE');
  const [minOccurrences, setMinOccurrences] = useState<number>(3);

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

  // Fetch event categories
  const { data: categoriesData } = useQuery({
    queryKey: ['event-categories'],
    queryFn: async () => {
      const response = await analysisApi.eventCategories();
      // Extract unique categories from the response
      const categories = response.data.data || [];
      const uniqueCategories = [...new Set(categories.map((c: any) => c.category))];
      return uniqueCategories;
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
      // Extract event names from the response
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
  });

  const stats = data?.statistics;
  const chartData = data?.averageEventCurve || [];

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
            <Filter className="h-4 w-4 text-violet-600" />
            <h2 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Event Filters</h2>
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

          {/* Event Selection */}
          <FilterSection title="Event Selection" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Country</label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-full">
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
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
                <Select value={selectedCategory} onValueChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedEventName(''); // Reset event name when category changes
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categoriesData?.map((cat: string) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Event Name</label>
                <Select value={selectedEventName} onValueChange={setSelectedEventName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Events</SelectItem>
                    {eventNamesData?.map((name: string) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>

          {/* Event Window */}
          <FilterSection title="Event Window">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Days Before Event: {windowBefore}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={windowBefore}
                  onChange={(e) => setWindowBefore(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Days After Event: {windowAfter}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={windowAfter}
                  onChange={(e) => setWindowAfter(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </FilterSection>

          {/* Trade Configuration */}
          <FilterSection title="Trade Configuration">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Entry Point</label>
                <Select value={entryPoint} onValueChange={(val: any) => setEntryPoint(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T-1_CLOSE">T-1 Close</SelectItem>
                    <SelectItem value="T0_OPEN">T0 Open</SelectItem>
                    <SelectItem value="T0_CLOSE">T0 Close</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Exit Point</label>
                <input
                  type="text"
                  value={exitPoint}
                  onChange={(e) => setExitPoint(e.target.value)}
                  placeholder="e.g., T+10_CLOSE"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Min Occurrences: {minOccurrences}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={minOccurrences}
                  onChange={(e) => setMinOccurrences(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Apply Filters Button */}
        <div className="flex-shrink-0 p-3 border-t border-slate-100">
          <Button 
            onClick={() => refetch()} 
            disabled={isFetching || selectedSymbols.length === 0 || (!selectedEventName && !selectedCategory)}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-lg"
          >
            {isFetching ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-current" />
                ANALYZE EVENTS
              </div>
            )}
          </Button>
        </div>

        {/* RESIZE HANDLE */}
        {filterOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-400 transition-colors group",
              isResizing && "bg-violet-500"
            )}
          >
            <div className="absolute right-0 top-0 bottom-0 w-4 -mr-2" />
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
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
              <Zap className="h-6 w-6 text-violet-600" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedSymbols[0] || 'Select Symbol'}
                </h1>
                <p className="text-xs text-slate-500">Event Analysis Engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Selection indicator */}
            {timeRangeSelection.isActive && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="text-xs font-semibold text-violet-700">
                  📅 {timeRangeSelection.startDate} → {timeRangeSelection.endDate}
                </div>
                <button
                  onClick={clearTimeRangeSelection}
                  className="text-violet-600 hover:text-violet-800 font-bold"
                  title="Clear selection"
                >
                  ✕
                </button>
              </div>
            )}
            
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

              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={selectedSymbols[0] || 'User'}>
                {selectedSymbols[0]?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* STATISTICS CARDS */}
        {stats && (
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="TOTAL EVENTS"
                value={stats.totalEvents?.toString() || '0'}
                subtitle={`${selectedEventName || selectedCategory || 'All'}`}
                trend="up"
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                subtitle={`${stats.winningEvents || 0} wins`}
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
              />
              <StatCard
                label="AVG RETURN"
                value={`${(stats.avgReturn || 0).toFixed(2)}%`}
                subtitle={`Median: ${(stats.medianReturn || 0).toFixed(2)}%`}
                trend={(stats.avgReturn || 0) >= 0 ? 'up' : 'down'}
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
              <StatCard
                label="PROFIT FACTOR"
                value={(stats.profitFactor || 0).toFixed(2)}
                subtitle={`Max DD: ${(stats.maxDrawdown || 0).toFixed(2)}%`}
                trend={(stats.profitFactor || 0) > 1 ? 'up' : 'down'}
              />
            </div>
          </div>
        )}

        {/* CHART AREA */}
        <div className={cn("flex-1 p-4", activeTab === 'data' ? 'overflow-visible' : 'overflow-hidden')}>
          <div className="h-full bg-white rounded-lg border border-slate-200 flex flex-col">
            {/* Chart Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">
                Average Event Pattern
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('chart')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                    activeTab === 'chart' 
                      ? "bg-violet-50 text-violet-600" 
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
                      ? "bg-violet-50 text-violet-600" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Data
                </button>
              </div>
            </div>

            {/* Chart Content */}
            <div className={cn("flex-1 p-4", activeTab === 'data' ? 'overflow-visible' : 'overflow-hidden')}>
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
                    <p className="mt-4 text-sm text-slate-500">Analyzing events...</p>
                  </motion.div>
                ) : !data || !selectedEventName && !selectedCategory ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center"
                  >
                    <Calendar className="h-16 w-16 text-slate-200 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">Select an Event</h3>
                    <p className="text-sm text-slate-500 mt-2">Choose an event or category to analyze</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="content"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    {activeTab === 'chart' ? (
                      <CumulativeChartWithDragSelect 
                        data={chartData} 
                        chartScale={chartScale}
                        onRangeSelected={(start, end) => {
                          console.log('📊 Events - Range selected:', start, 'to', end);
                        }}
                      />
                    ) : (
                      <EventDataTable data={data?.eventOccurrences || []} />
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
function StatCard({ label, value, subtitle, trend }: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-bold text-slate-900">{value}</div>
        {trend && (
          <div className={cn(
            "text-xs font-semibold flex items-center gap-1",
            trend === 'up' ? "text-green-600" : "text-red-600"
          )}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
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

// Event Data Table Component
function EventDataTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">No event data available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Event Date</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Entry Price</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700">Exit Price</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-700">Return %</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-700">MFE %</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-700">MAE %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, idx: number) => (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2">{new Date(row.eventDate).toLocaleDateString()}</td>
              <td className="px-4 py-2">{row.entryPrice?.toFixed(2)}</td>
              <td className="px-4 py-2">{row.exitPrice?.toFixed(2)}</td>
              <td className={cn(
                "px-4 py-2 text-right font-semibold",
                (row.returnPercent || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {(row.returnPercent || 0).toFixed(2)}%
              </td>
              <td className="px-4 py-2 text-right text-green-600">
                {(row.mfe || 0).toFixed(2)}%
              </td>
              <td className="px-4 py-2 text-right text-red-600">
                {(row.mae || 0).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
