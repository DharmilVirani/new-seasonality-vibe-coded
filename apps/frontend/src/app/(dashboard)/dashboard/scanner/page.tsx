'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, ChevronLeft, ChevronUp,
  RefreshCw, Download,
  Search,
  Table2, Flame, Network,
  SlidersHorizontal
} from 'lucide-react';
import { analysisApi } from '@/lib/api';
import { cn, formatPercentage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';

interface YearOccurrence {
  year: number;
  tradingDay?: number;
  startDate: string;
  endDate: string;
  return?: number;
  totalReturn?: number;
  positive: boolean;
}

interface ScannerMatch {
  startDay: number;
  endDay: number;
  totalDays: number;
  sampleSize: number;
  accuracy: number;
  avgPnl: number;
  totalPnl: number;
  startDate?: string;
  endDate?: string;
  firstMatchDate?: string;
  lastMatchDate?: string;
  yearOccurrences?: YearOccurrence[];
}

interface ScannerResult {
  symbol: string;
  name: string;
  matchCount: number;
  matches: ScannerMatch[];
}

interface ScannerResponse {
  totalSymbols: number;
  matchedSymbols: number;
  results: ScannerResult[];
}

const Loading = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <div className="flex items-center justify-center">
    <RefreshCw className={cn("animate-spin text-emerald-600", size === 'lg' ? 'h-10 w-10' : 'h-6 w-6')} />
  </div>
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayToDate(day: number, month: number = 1, year: number = 2024): string {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let adjustedDay = day;
  let adjustedMonth = month;

  if (day > daysInMonth[month - 1]) {
    adjustedDay = daysInMonth[month - 1];
  }

  const dd = String(adjustedDay).padStart(2, '0');
  const mm = MONTHS[adjustedMonth - 1];
  const yyyy = String(year);

  return `${dd}/${mm}/${yyyy}`;
}

function getDateRange(
  startDay: number,
  endDay: number,
  startYear: number,
  endYear: number,
  selectedMonths: number[] = []
): { startDate: string; endDate: string } {
  // If no month selected, show "Day X" format (like old software)
  if (selectedMonths.length === 0) {
    const yearRange = startYear !== endYear ? `(${startYear}-${endYear})` : `(${startYear})`;
    return {
      startDate: `Day ${startDay} ${yearRange}`,
      endDate: `Day ${endDay} ${yearRange}`,
    };
  }

  // If months selected, use first month and show dates
  const month = selectedMonths[0];

  return {
    startDate: formatDayToDate(startDay, month, startYear),
    endDate: formatDayToDate(endDay, month, endYear),
  };
}

export default function ScannerPage() {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'heatmap' | 'cross'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [heatmapMetric, setHeatmapMetric] = useState<'accuracy' | 'totalPnl' | 'avgPnl'>('accuracy');
  const [minCrossSymbols, setMinCrossSymbols] = useState(2);

  // Filter state
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('2016-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [evenOddYears, setEvenOddYears] = useState<'All' | 'Even' | 'Odd' | 'Leap'>('All');
  const [specificMonths, setSpecificMonths] = useState<number[]>([]);
  const [specificExpiryWeeks, setSpecificExpiryWeeks] = useState<number[]>([]);
  const [specificMondayWeeks, setSpecificMondayWeeks] = useState<number[]>([]);
  const [trendType, setTrendType] = useState<'Bullish' | 'Bearish'>('Bullish');
  const [consecutiveDays, setConsecutiveDays] = useState(3);

  // Criteria filters (A, B, C, D)
  const [minAccuracy, setMinAccuracy] = useState(60);
  const [minTotalPnl, setMinTotalPnl] = useState(1.5);
  const [minSampleSize, setMinSampleSize] = useState(50);
  const [minAvgPnl, setMinAvgPnl] = useState(0.2);

  // Query operations
  const [op12, setOp12] = useState<'AND' | 'OR'>('OR');
  const [op23, setOp23] = useState<'AND' | 'OR'>('OR');
  const [op34, setOp34] = useState<'AND' | 'OR'>('OR');

  // Expand/collapse state - only ONE symbol and ONE match can be expanded at a time
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [expandedMatchIndex, setExpandedMatchIndex] = useState<number | null>(null);
  const [expandedMatchPage, setExpandedMatchPage] = useState(1);

  // Year occurrences filter toggle - default to positive only (more useful for traders)
  const [showPositiveOnly, setShowPositiveOnly] = useState(true);
  const [appliedScannerFiltersSignature, setAppliedScannerFiltersSignature] = useState<string | null>(null);

  // Toggle expand/collapse for a symbol (auto-collapses others)
  const toggleSymbolExpand = (symbol: string) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      setExpandedMatchIndex(null);
      setExpandedMatchPage(1);
    } else {
      setExpandedSymbol(symbol);
      setExpandedMatchIndex(null);
      setExpandedMatchPage(1);
    }
  };

  // Toggle expand/collapse for a match within expanded symbol (auto-collapses other matches)
  const toggleMatchExpand = (matchIndex: number) => {
    if (expandedMatchIndex === matchIndex) {
      setExpandedMatchIndex(null);
      setExpandedMatchPage(1);
    } else {
      setExpandedMatchIndex(matchIndex);
      setExpandedMatchPage(1);
    }
  };

  // Fetch available symbols
  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols;
    },
  });

  const availableSymbols = symbolsData || [];

  // Fetch scanner data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['scanner', selectedSymbols, startDate, endDate, evenOddYears, specificMonths,
      specificExpiryWeeks, specificMondayWeeks, trendType, consecutiveDays,
      minAccuracy, minTotalPnl, minSampleSize, minAvgPnl, op12, op23, op34],
    queryFn: async () => {
      const response = await analysisApi.scanner({
        symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
        startDate,
        endDate,
        filters: {
          evenOddYears,
          specificMonths,
          specificExpiryWeeksMonthly: specificExpiryWeeks,
          specificMondayWeeksMonthly: specificMondayWeeks,
        },
        trendType,
        consecutiveDays,
        criteria: {
          minAccuracy,
          minTotalPnl,
          minSampleSize,
          minAvgPnl,
          operations: {
            op12,
            op23,
            op34,
          },
        },
      });
      return response.data.data as ScannerResponse;
    },
    enabled: false,
    retry: 1,
  });

  const scannerData = data;
  const currentScannerFiltersSignature = useMemo(
    () =>
      JSON.stringify({
        selectedSymbols,
        startDate,
        endDate,
        evenOddYears,
        specificMonths,
        specificExpiryWeeks,
        specificMondayWeeks,
        trendType,
        consecutiveDays,
        minAccuracy,
        minTotalPnl,
        minSampleSize,
        minAvgPnl,
        op12,
        op23,
        op34,
      }),
    [
      selectedSymbols,
      startDate,
      endDate,
      evenOddYears,
      specificMonths,
      specificExpiryWeeks,
      specificMondayWeeks,
      trendType,
      consecutiveDays,
      minAccuracy,
      minTotalPnl,
      minSampleSize,
      minAvgPnl,
      op12,
      op23,
      op34,
    ]
  );
  const hasScanned = appliedScannerFiltersSignature !== null;
  const isScannerDirty = hasScanned && appliedScannerFiltersSignature !== currentScannerFiltersSignature;

  // Flatten all matches for pagination
  const allMatches = useMemo(() => {
    if (!scannerData?.results) return [];
    return scannerData.results.flatMap((result, rIdx) =>
      result.matches.map((match, mIdx) => ({
        ...match,
        symbol: result.symbol,
        rIdx,
        mIdx,
      }))
    );
  }, [scannerData]);

  // Aggregated data by symbol
  const aggregatedData = useMemo(() => {
    if (!scannerData?.results) return [];

    return scannerData.results.map(result => {
      const matches = result.matches;
      const totalSampleSize = matches.reduce((sum, m) => sum + (m.sampleSize || 0), 0);
      const avgAccuracy = matches.reduce((sum, m) => sum + (m.accuracy || 0), 0) / matches.length;
      const avgPnl = matches.reduce((sum, m) => sum + (m.avgPnl || 0), 0) / matches.length;
      const totalPnl = matches.reduce((sum, m) => sum + (m.totalPnl || 0), 0);

      // Get first and last date range
      const firstMatchDate = matches[0]?.startDate || `Day ${matches[0]?.startDay}`;
      const lastMatchDate = matches[matches.length - 1]?.endDate || `Day ${matches[matches.length - 1]?.endDay}`;
      const firstStartDate = matches[0]?.startDate || '';
      const firstEndDate = matches[0]?.endDate || '';
      const lastStartDate = matches[matches.length - 1]?.startDate || '';
      const lastEndDate = matches[matches.length - 1]?.endDate || '';

      // Format date range for display
      let dateRangeStr = '';
      if (firstStartDate && firstEndDate && lastStartDate && lastEndDate) {
        // Has actual dates - show dd/mm format
        dateRangeStr = `${firstStartDate.split('/')[0]}/${firstStartDate.split('/')[1]} - ${firstEndDate.split('/')[0]}/${firstEndDate.split('/')[1]} TO ${lastStartDate.split('/')[0]}/${lastStartDate.split('/')[1]} - ${lastEndDate.split('/')[0]}/${lastEndDate.split('/')[1]}`;
      } else {
        // No dates - show Day format
        dateRangeStr = `Day ${matches[0]?.startDay} - Day ${matches[0]?.endDay} TO Day ${matches[matches.length - 1]?.startDay} - Day ${matches[matches.length - 1]?.endDay}`;
      }

      return {
        symbol: result.symbol,
        name: result.name,
        matchCount: matches.length,
        matches: matches.map((m, idx) => ({ ...m, mIdx: idx })),
        totalSampleSize,
        avgAccuracy,
        avgPnl,
        totalPnl,
        dateRange: dateRangeStr,
        firstMatchDate,
        lastMatchDate,
      };
    });
  }, [scannerData]);

  // Paginated data (aggregated - one row per symbol)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return aggregatedData.slice(start, start + pageSize);
  }, [aggregatedData, currentPage, pageSize]);

  const totalPages = Math.ceil(aggregatedData.length / pageSize);

  // Computed stats for summary cards
  const stats = useMemo(() => {
    if (allMatches.length === 0) return null;

    const totalAccuracy = allMatches.reduce((sum, m) => sum + (m.accuracy || 0), 0);
    const totalPnl = allMatches.reduce((sum, m) => sum + (m.totalPnl || 0), 0);
    const avgPnl = allMatches.reduce((sum, m) => sum + (m.avgPnl || 0), 0);

    return {
      avgAccuracy: totalAccuracy / allMatches.length,
      avgTotalPnl: totalPnl / allMatches.length,
      avgPnl: avgPnl / allMatches.length,
    };
  }, [allMatches]);

  // Heatmap data - aggregated by symbol and startDay
  const heatmapData = useMemo(() => {
    if (!scannerData?.results) return [];

    const heatmap: Record<string, { accuracy: number[]; totalPnl: number[]; avgPnl: number[]; count: number }> = {};

    scannerData.results.forEach((result) => {
      result.matches.forEach((match) => {
        const key = `${result.symbol}-${match.startDay}-${match.endDay}`;
        if (!heatmap[key]) {
          heatmap[key] = { accuracy: [], totalPnl: [], avgPnl: [], count: 0 };
        }
        heatmap[key].accuracy.push(match.accuracy);
        heatmap[key].totalPnl.push(match.totalPnl);
        heatmap[key].avgPnl.push(match.avgPnl);
        heatmap[key].count++;
      });
    });

    return Object.entries(heatmap).map(([key, values]) => {
      const [symbol, startDay, endDay] = key.split('-');
      return {
        symbol,
        startDay: parseInt(startDay),
        endDay: parseInt(endDay),
        avgAccuracy: values.accuracy.reduce((a, b) => a + b, 0) / values.count,
        avgTotalPnl: values.totalPnl.reduce((a, b) => a + b, 0) / values.count,
        avgAvgPnl: values.avgPnl.reduce((a, b) => a + b, 0) / values.count,
        count: values.count,
      };
    });
  }, [scannerData]);

  // Cross-symbol patterns - group by similar pattern characteristics
  const crossSymbolPatterns = useMemo(() => {
    if (!scannerData?.results) return [];

    const patterns: Record<string, { symbols: string[]; matches: typeof scannerData.results[0]['matches'] }> = {};

    scannerData.results.forEach((result) => {
      result.matches.forEach((match) => {
        // Group by startDay, endDay, and accuracy range (within 5%)
        const accuracyRange = Math.floor(match.accuracy / 5) * 5;
        const key = `${match.startDay}-${match.endDay}-${accuracyRange}`;

        if (!patterns[key]) {
          patterns[key] = { symbols: [], matches: [] };
        }
        if (!patterns[key].symbols.includes(result.symbol)) {
          patterns[key].symbols.push(result.symbol);
        }
        patterns[key].matches.push(match);
      });
    });

    return Object.entries(patterns)
      .map(([key, data]) => {
        const [startDay, endDay] = key.split('-').map(Number);
        const avgAccuracy = data.matches.reduce((a, m) => a + m.accuracy, 0) / data.matches.length;
        const avgPnl = data.matches.reduce((a, m) => a + m.totalPnl, 0) / data.matches.length;

        return {
          startDay,
          endDay,
          symbols: data.symbols,
          symbolCount: data.symbols.length,
          avgAccuracy,
          avgPnl,
          matches: data.matches,
        };
      })
      .filter(p => p.symbolCount >= minCrossSymbols)
      .sort((a, b) => b.symbolCount - a.symbolCount);
  }, [scannerData, minCrossSymbols]);

  // Group heatmap by symbol for display
  const heatmapBySymbol = useMemo(() => {
    const bySymbol: Record<string, typeof heatmapData> = {};
    heatmapData.forEach(item => {
      if (!bySymbol[item.symbol]) bySymbol[item.symbol] = [];
      bySymbol[item.symbol].push(item);
    });
    return bySymbol;
  }, [heatmapData]);

  const handleScan = async () => {
    setAdvancedFiltersOpen(false);
    const response = await refetch();
    if (!response.error) {
      setAppliedScannerFiltersSignature(currentScannerFiltersSignature);
    }
  };

  const handleClearFilters = () => {
    setSelectedSymbols([]);
    setStartDate('2016-01-01');
    setEndDate('2025-12-31');
    setEvenOddYears('All');
    setSpecificMonths([]);
    setSpecificExpiryWeeks([]);
    setSpecificMondayWeeks([]);
    setTrendType('Bullish');
    setConsecutiveDays(3);
    setMinAccuracy(60);
    setMinTotalPnl(1.5);
    setMinSampleSize(50);
    setMinAvgPnl(0.2);
    setOp12('OR');
    setOp23('OR');
    setOp34('OR');
  };

  const getBestMatch = (result: ScannerResult) => {
    if (!result.matches || result.matches.length === 0) return null;
    return result.matches[0];
  };

  const downloadCSV = () => {
    if (!scannerData?.results) return;

    const headers = ['Symbol', 'Match #', 'Start Day', 'End Day', 'Total Days', 'Sample Size', 'Accuracy %', 'Avg PnL %', 'Total PnL %'];
    const rows: string[][] = [];

    scannerData.results.forEach((result) => {
      result.matches.forEach((match, mIdx) => {
        rows.push([
          result.symbol,
          (mIdx + 1).toString(),
          match.startDay.toString(),
          match.endDay.toString(),
          match.totalDays.toString(),
          match.sampleSize.toString(),
          match.accuracy.toFixed(2),
          match.avgPnl.toFixed(2),
          match.totalPnl.toFixed(2),
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'scanner_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-full bg-[#F8F9FB]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* HEADER */}
        <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-emerald-600" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                Symbol Scanner
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Pattern Discovery Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              SC
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1800px] mx-auto w-full">
          {/* Summary Cards */}
          {scannerData && stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Symbols Scanned</div>
                <div className="text-2xl font-bold text-slate-900">{scannerData.totalSymbols}</div>
              </div>
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Matches Found</div>
                <div className="text-2xl font-bold text-emerald-600">{scannerData.matchedSymbols}</div>
              </div>
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Avg Accuracy</div>
                <div className={cn(
                  "text-2xl font-bold",
                  stats.avgAccuracy >= 50 ? "text-emerald-600" : "text-red-600"
                )}>{stats.avgAccuracy.toFixed(1)}%</div>
              </div>
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Avg Total PnL</div>
                <div className={cn(
                  "text-2xl font-bold",
                  stats.avgTotalPnl >= 0 ? "text-emerald-600" : "text-red-600"
                )}>{stats.avgTotalPnl >= 0 ? '+' : ''}{stats.avgTotalPnl.toFixed(1)}%</div>
              </div>
            </div>
          )}

          {/* Compact Filter Row */}
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Symbol Select */}
            <div className="min-w-[140px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Symbol</label>
              <select
                value={selectedSymbols.length === 1 ? selectedSymbols[0] : ''}
                onChange={(e) => setSelectedSymbols(e.target.value ? [e.target.value] : [])}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400 bg-white"
              >
                <option value="">All Symbols</option>
                {availableSymbols.map((s: { symbol: string }) => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-slate-400 pb-1.5">→</span>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Year Type */}
            <div className="min-w-[100px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Year Type</label>
              <select
                value={evenOddYears}
                onChange={(e) => setEvenOddYears(e.target.value as any)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400 bg-white"
              >
                <option value="All">All Years</option>
                <option value="Even">Even</option>
                <option value="Odd">Odd</option>
                <option value="Leap">Leap</option>
              </select>
            </div>

            {/* Month */}
            <div className="min-w-[120px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">Month</label>
              <select
                value={specificMonths.join(',')}
                onChange={(e) => setSpecificMonths(e.target.value ? e.target.value.split(',').map(Number) : [])}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400 bg-white"
              >
                <option value="">All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            {/* Filter Button */}
            <Button
              onClick={() => setAdvancedFiltersOpen((open) => !open)}
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 ml-auto"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {advancedFiltersOpen ? 'Hide Filters' : 'Filters'}
              {advancedFiltersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Run Scanner</p>
                <p className="text-xs text-slate-500">Apply current filters and find matching symbols</p>
              </div>
              {isScannerDirty && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Filters changed
                </span>
              )}
            </div>
            <Button
              onClick={handleScan}
              disabled={isFetching}
              className="h-11 px-7 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RefreshCw className={cn("h-5 w-5 mr-2", isFetching && "animate-spin")} />
              {isFetching ? 'Scanning...' : 'Run Scanner'}
            </Button>
          </div>

          {advancedFiltersOpen && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Advanced Scanner Filters</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-slate-500 hover:text-slate-700"
                  onClick={() => setAdvancedFiltersOpen(false)}
                >
                  Collapse
                </Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Symbol Universe</div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 bg-white space-y-1">
                    {availableSymbols.map((symbol: { symbol: string; name: string }) => (
                      <label key={symbol.symbol} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSymbols.includes(symbol.symbol)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSymbols([...selectedSymbols, symbol.symbol]);
                            else setSelectedSymbols(selectedSymbols.filter(s => s !== symbol.symbol));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{symbol.symbol}</span>
                      </label>
                    ))}
                  </div>
                  {selectedSymbols.length > 0 && (
                    <button
                      onClick={() => setSelectedSymbols([])}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Clear symbol selection
                    </button>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Month & Week</div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Specific Months</label>
                    <MultiSelect
                      options={[
                        { value: 1, label: 'January' },
                        { value: 2, label: 'February' },
                        { value: 3, label: 'March' },
                        { value: 4, label: 'April' },
                        { value: 5, label: 'May' },
                        { value: 6, label: 'June' },
                        { value: 7, label: 'July' },
                        { value: 8, label: 'August' },
                        { value: 9, label: 'September' },
                        { value: 10, label: 'October' },
                        { value: 11, label: 'November' },
                        { value: 12, label: 'December' },
                      ]}
                      selected={specificMonths}
                      onChange={setSpecificMonths}
                      placeholder="All Months"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Expiry Week</label>
                    <MultiSelect
                      options={[
                        { value: 1, label: '1st Week' },
                        { value: 2, label: '2nd Week' },
                        { value: 3, label: '3rd Week' },
                        { value: 4, label: '4th Week' },
                        { value: 5, label: '5th Week' },
                      ]}
                      selected={specificExpiryWeeks}
                      onChange={setSpecificExpiryWeeks}
                      placeholder="All Weeks"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Monday Week</label>
                    <MultiSelect
                      options={[
                        { value: 1, label: '1st Week' },
                        { value: 2, label: '2nd Week' },
                        { value: 3, label: '3rd Week' },
                        { value: 4, label: '4th Week' },
                        { value: 5, label: '5th Week' },
                      ]}
                      selected={specificMondayWeeks}
                      onChange={setSpecificMondayWeeks}
                      placeholder="All Weeks"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Trend</div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Trend Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTrendType('Bullish')}
                        className={cn(
                          "flex-1 py-2 text-sm font-medium rounded-md border transition-colors",
                          trendType === 'Bullish'
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                        )}
                      >
                        Bullish
                      </button>
                      <button
                        onClick={() => setTrendType('Bearish')}
                        className={cn(
                          "flex-1 py-2 text-sm font-medium rounded-md border transition-colors",
                          trendType === 'Bearish'
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
                        )}
                      >
                        Bearish
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Consecutive Days</label>
                      <span className="text-xs font-bold text-slate-500">{consecutiveDays}</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={1}
                      value={consecutiveDays}
                      onChange={(e) => setConsecutiveDays(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Criteria + Query</div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">A Min Accuracy</label>
                      <span className="text-xs font-bold text-emerald-600">{minAccuracy}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={minAccuracy} onChange={(e) => setMinAccuracy(parseInt(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase">B Min Total PnL</label>
                      <span className="text-xs font-bold text-emerald-600">{minTotalPnl}%</span>
                    </div>
                    <input type="range" min={0} max={10} step={0.1} value={minTotalPnl} onChange={(e) => setMinTotalPnl(parseFloat(e.target.value))} className="w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">C Min Sample</label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={minSampleSize}
                        onChange={(e) => setMinSampleSize(parseInt(e.target.value) || 0)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">D Min Avg PnL</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={minAvgPnl}
                        onChange={(e) => setMinAvgPnl(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-400 bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-slate-600">A</span>
                    <select value={op12} onChange={(e) => setOp12(e.target.value as any)} className="px-2 py-1.5 border border-slate-200 rounded text-xs bg-white">
                      <option value="OR">OR</option><option value="AND">AND</option>
                    </select>
                    <span className="text-xs text-slate-600">B</span>
                    <select value={op23} onChange={(e) => setOp23(e.target.value as any)} className="px-2 py-1.5 border border-slate-200 rounded text-xs bg-white">
                      <option value="OR">OR</option><option value="AND">AND</option>
                    </select>
                    <span className="text-xs text-slate-600">C</span>
                    <select value={op34} onChange={(e) => setOp34(e.target.value as any)} className="px-2 py-1.5 border border-slate-200 rounded text-xs bg-white">
                      <option value="OR">OR</option><option value="AND">AND</option>
                    </select>
                    <span className="text-xs text-slate-600">D</span>
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <Button
                      onClick={handleClearFilters}
                      variant="outline"
                      size="sm"
                      className="h-8 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"
                    >
                      Clear Advanced
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading || isFetching ? (
            <div className="flex justify-center py-20">
              <Loading size="lg" />
            </div>
          ) : !hasScanned ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-500">Configure filters and click Scan.</p>
            </div>
          ) : scannerData && scannerData.results && scannerData.results.length > 0 ? (
            <div className="space-y-4">
              {/* View Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-2",
                      viewMode === 'table'
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-600 hover:bg-white/50"
                    )}
                  >
                    <Table2 className="h-4 w-4" />
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-2",
                      viewMode === 'heatmap'
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-600 hover:bg-white/50"
                    )}
                  >
                    <Flame className="h-4 w-4" />
                    Heatmap
                  </button>
                  <button
                    onClick={() => setViewMode('cross')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-2",
                      viewMode === 'cross'
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-600 hover:bg-white/50"
                    )}
                  >
                    <Network className="h-4 w-4" />
                    Cross-Symbol
                  </button>
                </div>
                {viewMode === 'table' && (
                  <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                )}
              </div>

              {/* TABLE VIEW */}
              {viewMode === 'table' && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-600 w-8"></th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">Symbol</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Matches</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Date Range</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Days</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Sample</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Accuracy</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Avg PnL</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Total PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedData.map((aggRow, idx) => {
                          const isSymbolExpanded = expandedSymbol === aggRow.symbol;
                          return (
                            <React.Fragment key={idx}>
                              {/* Summary Row */}
                              <tr className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <button
                                    onClick={() => toggleSymbolExpand(aggRow.symbol)}
                                    className="p-1 hover:bg-slate-100 rounded"
                                  >
                                    {isSymbolExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-slate-500" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-500" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900">{aggRow.symbol}</div>
                                </td>
                                <td className="py-3 px-4 text-right text-slate-600">
                                  {aggRow.matchCount}
                                </td>
                                <td className="py-3 px-4 text-right text-slate-500 text-[10px]">
                                  {aggRow.dateRange || `${aggRow.firstMatchDate} - ${aggRow.lastMatchDate}`}
                                </td>
                                <td className="py-3 px-4 text-right text-slate-600">
                                  {aggRow.matches[0]?.totalDays || 3}
                                </td>
                                <td className="py-3 px-4 text-right text-slate-600 font-medium">
                                  {aggRow.totalSampleSize}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className={cn(
                                    "font-medium",
                                    (aggRow.avgAccuracy ?? 0) >= 50 ? "text-emerald-600" : "text-red-600"
                                  )}>
                                    {formatPercentage(aggRow.avgAccuracy ?? 0)}
                                  </span>
                                </td>
                                <td className={cn(
                                  "py-3 px-4 text-right font-medium",
                                  (aggRow.avgPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                                )}>
                                  {formatPercentage(aggRow.avgPnl ?? 0)}
                                </td>
                                <td className={cn(
                                  "py-3 px-4 text-right font-bold",
                                  (aggRow.totalPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                                )}>
                                  {formatPercentage(aggRow.totalPnl ?? 0)}
                                </td>
                              </tr>

                              {/* Level 2: Match List (when symbol is expanded) */}
                              {isSymbolExpanded && aggRow.matches.map((match, mIdx) => {
                                const isMatchExpanded = expandedMatchIndex === mIdx;
                                const allYearOccurrences = match.yearOccurrences || [];
                                // Filter based on toggle
                                const filteredYearOccurrences = showPositiveOnly
                                  ? allYearOccurrences.filter(y => y.positive)
                                  : allYearOccurrences;
                                const yearsPerPage = 10;
                                const totalPages = Math.ceil(filteredYearOccurrences.length / yearsPerPage);
                                const paginatedYears = filteredYearOccurrences.slice(
                                  (expandedMatchPage - 1) * yearsPerPage,
                                  expandedMatchPage * yearsPerPage
                                );

                                return (
                                  <React.Fragment key={`${idx}-${mIdx}`}>
                                    {/* Match Row */}
                                    <tr className="bg-slate-50 hover:bg-slate-100">
                                      <td className="py-2 px-4 pl-4">
                                        <button
                                          onClick={() => toggleMatchExpand(mIdx)}
                                          className="p-0.5 hover:bg-slate-200 rounded"
                                        >
                                          {isMatchExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-slate-500" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-slate-500" />
                                          )}
                                        </button>
                                      </td>
                                      <td className="py-2 px-2 pl-2">
                                        <span className="text-slate-500 font-medium">
                                          {aggRow.symbol} - {mIdx + 1}.
                                        </span>
                                      </td>
                                      <td className="py-2 px-2"></td>
                                      <td className="py-2 px-2 text-right">
                                        <span className="text-emerald-600 font-bold text-sm">
                                          {match.startDate || `Day ${match.startDay}`} - {match.endDate || `Day ${match.endDay}`}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-right text-slate-600">
                                        {match.totalDays}
                                      </td>
                                      <td className="py-2 px-2 text-right text-slate-600 font-medium">
                                        {match.sampleSize}
                                      </td>
                                      <td className="py-2 px-2 text-right">
                                        <span className={cn(
                                          (match.accuracy ?? 0) >= 50 ? "text-emerald-600" : "text-red-600"
                                        )}>
                                          {formatPercentage(match.accuracy ?? 0)}
                                        </span>
                                      </td>
                                      <td className={cn(
                                        "py-2 px-2 text-right",
                                        (match.avgPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                                      )}>
                                        {formatPercentage(match.avgPnl ?? 0)}
                                      </td>
                                      <td className={cn(
                                        "py-2 px-2 text-right font-medium",
                                        (match.totalPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                                      )}>
                                        {formatPercentage(match.totalPnl ?? 0)}
                                      </td>
                                    </tr>

                                    {/* Level 3: Year Occurrences (when match is expanded) */}
                                    {isMatchExpanded && (
                                      <>
                                        {paginatedYears.map((yearData, yearIdx) => {
                                          const returnValue = yearData.totalReturn ?? 0;
                                          return (
                                            <tr key={`${idx}-${mIdx}-${yearIdx}`} className="bg-white hover:bg-slate-50">
                                              <td className="py-1 px-4"></td>
                                              <td className="py-1 px-2 pl-4 text-slate-400 text-xs">
                                                {yearData.year}
                                              </td>
                                              <td className="py-1 px-2 text-slate-500 text-xs" colSpan={2}>
                                                {yearData.startDate} - {yearData.endDate}
                                              </td>
                                              <td className="py-1 px-2 text-right text-slate-500 text-xs">
                                                {yearData.positive ? 'Positive' : 'Negative'}
                                              </td>
                                              <td className="py-1 px-2"></td>
                                              <td className={cn(
                                                "py-1 px-2 text-right font-medium text-xs",
                                                returnValue >= 0 ? "text-emerald-600" : "text-red-600"
                                              )}>
                                                {returnValue > 0 ? '+' : ''}{returnValue.toFixed(2)}%
                                              </td>
                                              <td className="py-1 px-2"></td>
                                            </tr>
                                          );
                                        })}

                                        {/* Pagination for years */}
                                        {totalPages > 1 && (
                                          <tr className="bg-slate-100">
                                            <td className="py-2 px-4" colSpan={9}>
                                              <div className="flex items-center justify-center gap-2">
                                                <button
                                                  onClick={() => setExpandedMatchPage(p => Math.max(1, p - 1))}
                                                  disabled={expandedMatchPage === 1}
                                                  className="px-2 py-1 text-xs bg-white border rounded disabled:opacity-50"
                                                >
                                                  Prev
                                                </button>
                                                <span className="text-xs text-slate-500">
                                                  {expandedMatchPage} / {totalPages}
                                                </span>
                                                <button
                                                  onClick={() => setExpandedMatchPage(p => Math.min(totalPages, p + 1))}
                                                  disabled={expandedMatchPage === totalPages}
                                                  className="px-2 py-1 text-xs bg-white border rounded disabled:opacity-50"
                                                >
                                                  Next
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, aggregatedData.length)} of {aggregatedData.length} symbols
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-slate-600 px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HEATMAP VIEW */}
              {viewMode === 'heatmap' && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 text-sm">Pattern Heatmap</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Metric:</span>
                      <select
                        value={heatmapMetric}
                        onChange={(e) => setHeatmapMetric(e.target.value as any)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded"
                      >
                        <option value="accuracy">Accuracy %</option>
                        <option value="totalPnl">Total PnL %</option>
                        <option value="avgPnl">Avg PnL %</option>
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-4">
                    <div className="space-y-6">
                      {Object.entries(heatmapBySymbol).slice(0, 20).map(([symbol, items]) => (
                        <div key={symbol}>
                          <div className="text-xs font-semibold text-slate-600 mb-2">{symbol}</div>
                          <div className="flex flex-wrap gap-1">
                            {items.sort((a, b) => a.startDay - b.startDay).map((item, idx) => {
                              const value = heatmapMetric === 'accuracy' ? item.avgAccuracy : heatmapMetric === 'totalPnl' ? item.avgTotalPnl : item.avgAvgPnl;
                              const intensity = Math.min(1, Math.abs(value) / (heatmapMetric === 'accuracy' ? 100 : 50));
                              return (
                                <div
                                  key={idx}
                                  className="w-10 h-10 rounded flex items-center justify-center text-[10px] font-medium cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                  style={{
                                    backgroundColor: heatmapMetric === 'accuracy'
                                      ? value >= 50 ? `rgba(16, 185, 129, ${intensity})` : `rgba(239, 68, 68, ${intensity})`
                                      : value >= 0 ? `rgba(16, 185, 129, ${intensity})` : `rgba(239, 68, 68, ${intensity})`,
                                    color: intensity > 0.5 ? 'white' : 'black',
                                  }}
                                  title={`Days ${item.startDay}-${item.endDay}: ${value.toFixed(1)}%`}
                                >
                                  {item.startDay}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CROSS-SYMBOL VIEW */}
              {viewMode === 'cross' && (
                <div className="space-y-4">
                  {/* Filter */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-600">Minimum symbols:</span>
                      <input
                        type="range"
                        min={2}
                        max={10}
                        value={minCrossSymbols}
                        onChange={(e) => setMinCrossSymbols(parseInt(e.target.value))}
                        className="w-32"
                      />
                      <span className="text-sm font-semibold text-emerald-600">{minCrossSymbols}+ symbols</span>
                    </div>
                  </div>

                  {/* Cross-Symbol Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {crossSymbolPatterns.slice(0, 20).map((pattern, idx) => (
                      <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:border-emerald-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">
                              Days {pattern.startDay} - {pattern.endDay}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Found in {pattern.symbolCount} symbols
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-lg font-bold",
                              pattern.avgAccuracy >= 50 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {pattern.avgAccuracy.toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-500">Accuracy</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs mb-3">
                          <span className="text-slate-500">Avg PnL:</span>
                          <span className={cn(
                            "font-semibold",
                            pattern.avgPnl >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatPercentage(pattern.avgPnl)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {pattern.symbols.map((sym, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {crossSymbolPatterns.length === 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                      <p className="text-slate-500">No cross-symbol patterns found. Try lowering the minimum symbols filter.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No results found. Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
