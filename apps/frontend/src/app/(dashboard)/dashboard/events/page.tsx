'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Filter,
  ChevronDown, ChevronRight,
  RefreshCw,
  Zap,
  HelpCircle
} from 'lucide-react';

import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { CumulativeChartWithDragSelect, ReturnBarChart } from '@/components/charts';
import { AnalyticsMatrix } from '@/components/analytics/AnalyticsMatrix';
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
        <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-violet-600 transition-colors" />
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
  const { selectedSymbols, startDate, endDate, chartScale } = useAnalysisStore();
  const { timeRangeSelection } = useChartSelectionStore();
  const [filterOpen, setFilterOpen] = useState(true);
  const [filterWidth, setFilterWidth] = useState(260);
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
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 400) {
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

  const stats = data?.aggregatedMetrics;

  // 1. Data for Main Chart (Average Event Pattern)
  const mainChartData = useMemo(() => {
    if (!data?.averageEventCurve) return [];
    return data.averageEventCurve.map((point: any) => ({
      date: `T${point.relativeDay >= 0 ? '+' : ''}${point.relativeDay}`,
      returnPercentage: Number(point.avgReturn) || 0,
      cumulative: Number(point.avgReturn) || 0,
      relativeDay: point.relativeDay,
    }));
  }, [data?.averageEventCurve]);

  // 2. Data for Cumulative Profit Panel
  const cumulativeProfitData = useMemo(() => {
    if (!data?.eventOccurrences) return [];

    const sortedEvents = [...data.eventOccurrences].sort((a: any, b: any) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

    let runningTotal = 0;
    return sortedEvents.map((event: any) => {
      const ret = Number(event.returnPercent) || 0;
      runningTotal += ret;
      return {
        date: event.eventDate,
        cumulative: runningTotal,
        returnPercentage: ret
      };
    });
  }, [data?.eventOccurrences]);

  // 3. Data for Pattern Returns Panel
  const patternReturnsData = useMemo(() => {
    if (!data?.eventOccurrences) return [];
    return [...data.eventOccurrences]
      .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .map((event: any) => ({
        date: event.eventDate,
        returnPercentage: Number(event.returnPercent) || 0
      }));
  }, [data?.eventOccurrences]);


  return (
    <div className="flex h-full bg-[#F8F9FB]" style={{ userSelect: isResizing ? 'none' : 'auto' }}>

      {/* LEFT SIDEBAR - FILTER CONSOLE */}
      <aside
        style={{
          width: filterOpen ? filterWidth : 0,
          transition: isResizing ? 'none' : 'width 0.3s ease-out'
        }}
        className="bg-white border-r border-slate-200 flex flex-col overflow-hidden relative flex-shrink-0 z-20"
      >
        <div className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-white">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-xs text-slate-600 uppercase tracking-wide">Event Filters</h2>
          </div>
          <button
            onClick={() => setFilterOpen(false)}
            className="p-1 hover:bg-slate-50 rounded transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <FilterSection title="Market Context" defaultOpen>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Asset Class</label>
                <div className="text-xs font-medium text-slate-700 mb-2">Symbol</div>
                <SymbolSelector />
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Time Ranges" defaultOpen>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Last N Days (0 to disable)</label>
                  <span className="text-[10px] font-bold text-slate-400">0</span>
                </div>
                <input
                  type="number"
                  value={0}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none bg-slate-50 text-slate-400"
                />
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Event Selection" defaultOpen>
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
        </div>

        <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-white">
          <Button
            onClick={() => refetch()}
            disabled={isFetching || selectedSymbols.length === 0 || (!selectedEventName && !selectedCategory)}
            className="w-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white font-semibold text-xs h-10 rounded-lg shadow-sm transition-all uppercase tracking-wide"
          >
            {isFetching ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Analyzing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5 fill-current" />
                Analyze Events
              </div>
            )}
          </Button>
        </div>

        {/* Resize Handle */}
        {filterOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-violet-300 transition-colors z-30",
              isResizing && "bg-violet-400"
            )}
          />
        )}
      </aside>

      {/* CENTER MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden min-w-0">

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
            <Zap className="h-5 w-5 text-violet-600 fill-violet-200" />
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
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {selectedSymbols[0]?.charAt(0) || 'N'}
            </div>
          </div>
        </header>

        <div className="p-6 space-y-5 max-w-[1600px] mx-auto w-full">

          {/* STATS STRIP */}
          {stats && (
            <div className="grid grid-cols-5 gap-4">
              <StatCard
                label="TOTAL EVENTS"
                value={stats.totalEvents?.toString() || '0'}
                trend="neutral"
                subValue={selectedEventName || 'HOLI'}
                tooltip="The total number of times this event occurred in the selected date range. Each occurrence represents a trading opportunity based on the event."
              />
              <StatCard
                label="WIN RATE"
                value={`${(stats.winRate || 0).toFixed(1)}%`}
                trend={(stats.winRate || 0) > 50 ? 'up' : 'down'}
                subValue={`${stats.winningEvents || 0} wins`}
                tooltip="Percentage of event occurrences that resulted in positive returns. A win rate above 50% indicates the event tends to move the market favorably."
              />
              <StatCard
                label="AVG RETURN"
                value={`${(stats.avgReturn || 0).toFixed(2)}%`}
                trend={(stats.avgReturn || 0) >= 0 ? 'up' : 'down'}
                subValue={`Median: ${(stats.medianReturn || 0).toFixed(2)}%`}
                tooltip="The average percentage return across all event occurrences. This shows the typical profit or loss you can expect when trading around this event."
              />
              <StatCard
                label="SHARPE RATIO"
                value={(stats.sharpeRatio || 0).toFixed(2)}
                trend={(stats.sharpeRatio || 0) > 0 ? 'up' : 'down'}
                subValue={stats.sharpeRatio > 1 ? 'Good' : 'Poor'}
                tooltip="Risk-adjusted return metric. Values above 1 are considered good, above 2 are very good. It measures how much return you get per unit of risk taken."
              />
              <StatCard
                label="PROFIT FACTOR"
                value={(stats.profitFactor || 0).toFixed(2)}
                trend={(stats.profitFactor || 0) > 1 ? 'up' : 'down'}
                subValue={`Max DD: ${(stats.maxDrawdown || 0).toFixed(2)}%`}
                tooltip="Ratio of gross profits to gross losses. A value above 1 means total profits exceed total losses. Higher values indicate more profitable trading patterns."
              />
            </div>
          )}

          {/* MAIN CHART - Average Event Pattern & Analytics Matrix */}
          <div className="grid grid-cols-3 gap-5 h-[400px]">
            <div className="col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Average Event Pattern</h3>
                  <InfoTooltip content="Shows the average price movement pattern across all event occurrences. The X-axis represents days relative to the event (T0), and the Y-axis shows the cumulative return percentage." />
                </div>
              </div>
              <div className="flex-1 w-full relative p-4">
                {!data ? (
                  <PlaceholderState />
                ) : (
                  <CumulativeChartWithDragSelect
                    data={mainChartData}
                    chartScale={chartScale}
                  />
                )}
              </div>
            </div>

            <div className="col-span-1 h-full">
              <AnalyticsMatrix
                data={data?.eventOccurrences || []}
                stats={stats}
              />
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
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">No Data</div>
                )}
              </div>
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <EventDataTable
              data={data?.eventOccurrences || []}
              symbol={selectedSymbols[0]}
              mean={stats?.avgReturn || 0}
              stdDev={stats?.stdDev || 1}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, trend, tooltip }: {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
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

function FilterSection({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-slate-50/50 hover:bg-slate-100/50 flex items-center justify-between transition-colors outline-none"
      >
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{title}</span>
        <ChevronDown className={cn(
          "h-3 w-3 text-slate-400 transition-transform duration-200",
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
            <div className="p-3 bg-white border-t border-slate-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            const zScore = stdDev !== 0 ? ((row.returnPercent || 0) - mean) / stdDev : 0;
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
                    (row.returnPercent || 0) >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  )}>
                    {(row.returnPercent || 0) > 0 ? '+' : ''}
                    {(row.returnPercent || 0).toFixed(2)}%
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