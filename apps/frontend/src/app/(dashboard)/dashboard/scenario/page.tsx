'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, BarChart3, Activity, 
  ChevronDown, ChevronRight, ChevronLeft,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Settings, LogOut, TrendingUp, TrendingDown,
  LayoutGrid,
  Calendar,
  Filter,
  Shield,
  LineChart,
  SlidersHorizontal
} from 'lucide-react';

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
  DayFilters,
  OutlierFilters
} from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';

const PRIMARY_COLOR = '#eab308';

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-yellow-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

export default function ScenarioPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale, resetFilters } = useAnalysisStore();
  const [activeSection, setActiveSection] = useState<'historic' | 'streak' | 'momentum' | 'watchlist'>('historic');
  const [filterOpen, setFilterOpen] = useState(true);

  // Scenario-specific state
  const [historicTrendType, setHistoricTrendType] = useState<'Bullish' | 'Bearish'>('Bullish');
  const [consecutiveDays, setConsecutiveDays] = useState(3);
  const [dayRange, setDayRange] = useState(10);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['scenario-analysis', selectedSymbols, startDate, endDate, filters, historicTrendType, consecutiveDays, dayRange],
    queryFn: async () => {
      const response = await analysisApi.scenario({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        filters,
        chartScale,
        historicTrendType,
        consecutiveDays,
        dayRange,
      });
      return response.data.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const symbolData = data?.[selectedSymbols[0]];

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* TOP HEADER */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {!filterOpen && (
              <button 
                onClick={() => setFilterOpen(true)}
                className="p-2 hover:bg-slate-100 rounded"
              >
                <ChevronLeft className="h-5 w-5 text-slate-400" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-yellow-600" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {selectedSymbols[0] || 'Select Symbol'}
                </h1>
                <p className="text-xs text-slate-500">Scenario Analysis Engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
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

              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={selectedSymbols[0] || 'User'}>
                {selectedSymbols[0]?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* SECTION TABS */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('historic')}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
                activeSection === 'historic' 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Historic Trending Days
            </button>
            <button
              onClick={() => setActiveSection('streak')}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
                activeSection === 'streak' 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Trending Streak
            </button>
            <button
              onClick={() => setActiveSection('momentum')}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
                activeSection === 'momentum' 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Momentum Ranking
            </button>
            <button
              onClick={() => setActiveSection('watchlist')}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
                activeSection === 'watchlist' 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              Watchlist Analysis
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="h-full bg-white rounded-lg border border-slate-200 p-4">
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
                  <p className="mt-4 text-sm text-slate-500">Loading scenario data...</p>
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
                  {activeSection === 'historic' && <HistoricTrendingSection data={symbolData.historicTrend} />}
                  {activeSection === 'streak' && <TrendingStreakSection data={symbolData.trendingStreak} />}
                  {activeSection === 'momentum' && <MomentumRankingSection data={symbolData.momentumRanking} />}
                  {activeSection === 'watchlist' && <WatchlistAnalysisSection data={symbolData.watchlistAnalysis} />}
                </motion.div>
              )}
            </AnimatePresence>
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
        title="Scenario Filters"
        subtitle="Configure Analysis"
        primaryColor={PRIMARY_COLOR}
      >
        {/* Market Context */}
        <FilterSection title="Market Context" defaultOpen delay={0.1} icon={<LayoutGrid className="h-4 w-4" />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Asset Class</label>
              <SymbolSelector />
            </div>
          </div>
        </FilterSection>

        {/* Time Ranges */}
        <FilterSection title="Time Ranges" defaultOpen delay={0.15} icon={<Calendar className="h-4 w-4" />}>
          <div className="space-y-3">
            <DateRangePicker />
          </div>
        </FilterSection>

        {/* Year Filters */}
        <FilterSection title="Year Filters" delay={0.2} icon={<Filter className="h-4 w-4" />}>
          <YearFilters />
        </FilterSection>

        {/* Month Filters */}
        <FilterSection title="Month Filters" delay={0.22} icon={<Filter className="h-4 w-4" />}>
          <MonthFilters />
        </FilterSection>

        {/* Week Filters */}
        <FilterSection title="Week Filters" delay={0.24} icon={<Filter className="h-4 w-4" />}>
          <WeekFilters />
        </FilterSection>

        {/* Day Filters */}
        <FilterSection title="Day Filters" delay={0.26} icon={<Filter className="h-4 w-4" />}>
          <DayFilters />
        </FilterSection>

        {/* Risk Management */}
        <FilterSection title="Risk Management" delay={0.28} icon={<Shield className="h-4 w-4" />}>
          <OutlierFilters />
        </FilterSection>

        {/* Historic Trend Settings */}
        <FilterSection title="Historic Trend Settings" delay={0.3} icon={<LineChart className="h-4 w-4" />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Trend Type</label>
              <Select value={historicTrendType} onValueChange={(v) => setHistoricTrendType(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white shadow-lg">
                  <SelectItem value="Bullish">Bullish</SelectItem>
                  <SelectItem value="Bearish">Bearish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Consecutive Days: {consecutiveDays}</label>
              <input
                type="range"
                min="2"
                max="10"
                value={consecutiveDays}
                onChange={(e) => setConsecutiveDays(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Day Range: {dayRange}</label>
              <input
                type="range"
                min="5"
                max="25"
                step="5"
                value={dayRange}
                onChange={(e) => setDayRange(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}

// Historic Trending Days Section
function HistoricTrendingSection({ data }: { data: any }) {
  if (!data) return <div className="text-center text-slate-500">No data available</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Historically Trending Days</h3>
      <p className="text-sm text-slate-600">
        Analysis of days following {data.consecutiveDays} consecutive {data.trendType.toLowerCase()} days
      </p>
      
      {/* Chart placeholder */}
      <div className="h-96 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
        <p className="text-slate-400">Superimposed Returns Chart</p>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
              {data.columns?.map((col: string, idx: number) => (
                <th key={idx} className="px-3 py-2 text-right font-semibold text-slate-700">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tableData?.slice(0, 10).map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{row.date}</td>
                {data.columns?.map((col: string, colIdx: number) => (
                  <td key={colIdx} className="px-3 py-2 text-right">{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Trending Streak Section
function TrendingStreakSection({ data }: { data: any }) {
  if (!data) return <div className="text-center text-slate-500">No data available</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Trending Days Streak</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Start Date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Start Close</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">End Date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">End Close</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Total Days</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">% Change</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{row.startDate}</td>
                <td className="px-3 py-2 text-right">{row.startClose}</td>
                <td className="px-3 py-2">{row.endDate}</td>
                <td className="px-3 py-2 text-right">{row.endClose}</td>
                <td className="px-3 py-2 text-right">{row.totalDays}</td>
                <td className={cn(
                  "px-3 py-2 text-right font-semibold",
                  row.percentChange > 0 ? "text-green-600" : "text-red-600"
                )}>
                  {row.percentChange > 0 ? '+' : ''}{row.percentChange}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Momentum Ranking Section
function MomentumRankingSection({ data }: { data: any }) {
  if (!data) return <div className="text-center text-slate-500">No data available</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Momentum Ranking</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Rank</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Symbol</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">1 Day</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">1 Week</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">1 Month</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Avg Rank</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                <td className="px-3 py-2 font-medium">{row.symbol}</td>
                <td className="px-3 py-2 text-right">{row.rank1Day}</td>
                <td className="px-3 py-2 text-right">{row.rank1Week}</td>
                <td className="px-3 py-2 text-right">{row.rank1Month}</td>
                <td className="px-3 py-2 text-right font-semibold">{row.avgRank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Watchlist Analysis Section
function WatchlistAnalysisSection({ data }: { data: any }) {
  if (!data) return <div className="text-center text-slate-500">No data available</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Watchlist Analysis</h3>
      
      {/* Bar chart placeholder */}
      <div className="h-96 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
        <p className="text-slate-400">Watchlist Return Percentage Chart</p>
      </div>
    </div>
  );
}
