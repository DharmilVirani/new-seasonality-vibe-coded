'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Play, Filter, 
  ChevronDown, ChevronRight, ChevronLeft,
  RefreshCw, Download,
  Search, Settings2,
  Table2, Flame, Network
} from 'lucide-react';
import { analysisApi } from '@/lib/api';
import { cn, formatPercentage, formatNumber, TAB_COLORS } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';

const TAB_COLOR = TAB_COLORS.scanner;

interface ScannerMatch {
  startDay: number;
  endDay: number;
  totalDays: number;
  sampleSize: number;
  accuracy: number;
  avgPnl: number;
  totalPnl: number;
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
        <Settings2 className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600 transition-colors" />
      </button>
      {isVisible && (
        <div
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
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  const [filterOpen, setFilterOpen] = useState(true);
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
  const [specificMonth, setSpecificMonth] = useState(0);
  const [specificExpiryWeek, setSpecificExpiryWeek] = useState(0);
  const [specificMondayWeek, setSpecificMondayWeek] = useState(0);
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
    queryKey: ['scanner', selectedSymbols, startDate, endDate, evenOddYears, specificMonth, 
                specificExpiryWeek, specificMondayWeek, trendType, consecutiveDays,
                minAccuracy, minTotalPnl, minSampleSize, minAvgPnl, op12, op23, op34],
    queryFn: async () => {
      console.log('Scanner request:', {
        symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
        startDate,
        endDate,
        filters: {
          evenOddYears,
          specificMonth,
          specificExpiryWeekMonthly: specificExpiryWeek,
          specificMondayWeekMonthly: specificMondayWeek,
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
      
      const response = await analysisApi.scanner({
        symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
        startDate,
        endDate,
        filters: {
          evenOddYears,
          specificMonth,
          specificExpiryWeekMonthly: specificExpiryWeek,
          specificMondayWeekMonthly: specificMondayWeek,
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
      console.log('Scanner response:', response.data);
      return response.data.data as ScannerResponse;
    },
    enabled: true, // Run on mount
    retry: 1,
  });

  const scannerData = data;

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

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allMatches.slice(start, start + pageSize);
  }, [allMatches, currentPage, pageSize]);

  const totalPages = Math.ceil(allMatches.length / pageSize);

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

  const handleScan = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setSelectedSymbols([]);
    setStartDate('2016-01-01');
    setEndDate('2025-12-31');
    setEvenOddYears('All');
    setSpecificMonth(0);
    setSpecificExpiryWeek(0);
    setSpecificMondayWeek(0);
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

  const totalPatterns = scannerData?.results?.reduce(
    (sum: number, r: ScannerResult) => sum + r.matchCount,
    0
  ) ?? 0;

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
            <Button
              onClick={handleScan}
              disabled={isFetching}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Scan
            </Button>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              SC
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1800px] mx-auto w-full">
          {/* Summary Cards */}
          {scannerData && stats && (
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Symbols Scanned</div>
                <div className="text-2xl font-bold text-slate-900">{scannerData.totalSymbols}</div>
              </div>
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Matches Found</div>
                <div className="text-2xl font-bold text-emerald-600">{scannerData.matchedSymbols}</div>
              </div>
              <div className="bg-white rounded-lg p-5 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Total Patterns</div>
                <div className="text-2xl font-bold text-slate-900">{totalPatterns}</div>
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

          {/* Loading State */}
          {isLoading || isFetching ? (
            <div className="flex justify-center py-20">
              <Loading size="lg" />
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
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">Symbol</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Match #</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Start Day</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">End Day</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Days</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Sample Size</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Accuracy</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Avg PnL</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Total PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedData.map((match, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-900">{match.symbol}</div>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-500">
                              {match.mIdx + 1}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-600">
                              Day {match.startDay}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-600">
                              Day {match.endDay}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-600">
                              {match.totalDays}
                            </td>
                            <td className="py-3 px-4 text-right text-slate-600">
                              {match.sampleSize}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={cn(
                                "font-medium",
                                (match.accuracy ?? 0) >= 50 ? "text-emerald-600" : "text-red-600"
                              )}>
                                {formatPercentage(match.accuracy ?? 0)}
                              </span>
                            </td>
                            <td className={cn(
                              "py-3 px-4 text-right font-medium",
                              (match.avgPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {formatPercentage(match.avgPnl ?? 0)}
                            </td>
                            <td className={cn(
                              "py-3 px-4 text-right font-bold",
                              (match.totalPnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {formatPercentage(match.totalPnl ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, allMatches.length)} of {allMatches.length} results
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

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={handleScan}
        onClear={handleClearFilters}
        isLoading={isFetching}
        title="Scanner Filters"
        subtitle="Configure Pattern Search"
        primaryColor={TAB_COLOR.accent}
      >
        <FilterSection title="Symbol" defaultOpen delay={0}>
          <div className="space-y-2 pt-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Select Symbols (leave empty for all)
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1">
              {availableSymbols.map((symbol: { symbol: string; name: string }) => (
                <label key={symbol.symbol} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(symbol.symbol)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSymbols([...selectedSymbols, symbol.symbol]);
                      } else {
                        setSelectedSymbols(selectedSymbols.filter(s => s !== symbol.symbol));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-700">{symbol.symbol}</span>
                </label>
              ))}
            </div>
            {selectedSymbols.length > 0 && (
              <button
                onClick={() => setSelectedSymbols([])}
                className="text-[10px] text-emerald-600 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </FilterSection>

        <FilterSection title="Date Range" defaultOpen delay={0.02}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Year Filters" delay={0.05}>
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Even/Odd Years</label>
                <InfoTooltip content="Filter by even years, odd years, leap years, or all years" />
              </div>
              <select
                value={evenOddYears}
                onChange={(e) => setEvenOddYears(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
              >
                <option value="All">All Years</option>
                <option value="Even">Even Years Only</option>
                <option value="Odd">Odd Years Only</option>
                <option value="Leap">Leap Years Only</option>
              </select>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Month & Week Filters" delay={0.1}>
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Specific Month</label>
                <span className="text-[10px] font-bold text-slate-400">{specificMonth === 0 ? 'Disabled' : specificMonth}</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={specificMonth}
                onChange={(e) => setSpecificMonth(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>Off</span>
                <span>Jan</span>
                <span>Dec</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Expiry Week (Monthly)</label>
                <span className="text-[10px] font-bold text-slate-400">{specificExpiryWeek === 0 ? 'Disabled' : specificExpiryWeek}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={specificExpiryWeek}
                onChange={(e) => setSpecificExpiryWeek(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>Off</span>
                <span>1st</span>
                <span>5th</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Monday Week (Monthly)</label>
                <span className="text-[10px] font-bold text-slate-400">{specificMondayWeek === 0 ? 'Disabled' : specificMondayWeek}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={specificMondayWeek}
                onChange={(e) => setSpecificMondayWeek(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>Off</span>
                <span>1st</span>
                <span>5th</span>
              </div>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Trend Settings" defaultOpen delay={0.15}>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Trend Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrendType('Bullish')}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium rounded-md border transition-colors",
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
                    "flex-1 py-2 text-xs font-medium rounded-md border transition-colors",
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
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Consecutive Days</label>
                <span className="text-[10px] font-bold text-slate-400">{consecutiveDays} days</span>
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
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>2</span>
                <span>10</span>
              </div>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Criteria Filters (A/B/C/D)" defaultOpen delay={0.2}>
          <div className="space-y-3 pt-1">
            {/* A: Minimum Accuracy */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">A - Min Accuracy (%)</label>
                <span className="text-[10px] font-bold text-emerald-600">{minAccuracy}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minAccuracy}
                onChange={(e) => setMinAccuracy(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* B: Minimum Total PnL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">B - Min Total PnL (%)</label>
                <span className="text-[10px] font-bold text-emerald-600">{minTotalPnl}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={minTotalPnl}
                onChange={(e) => setMinTotalPnl(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* C: Minimum Sample Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">C - Min Sample Size</label>
                <span className="text-[10px] font-bold text-emerald-600">{minSampleSize}</span>
              </div>
              <input
                type="number"
                min={0}
                step={10}
                value={minSampleSize}
                onChange={(e) => setMinSampleSize(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-emerald-400"
              />
            </div>

            {/* D: Minimum Average PnL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">D - Min Avg PnL (%)</label>
                <span className="text-[10px] font-bold text-emerald-600">{minAvgPnl}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={minAvgPnl}
                onChange={(e) => setMinAvgPnl(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Query Builder (Operations)" delay={0.25}>
          <div className="space-y-3 pt-1">
            <p className="text-[10px] text-slate-500">
              Combine criteria with AND/OR operations
            </p>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">A</span>
              <select
                value={op12}
                onChange={(e) => setOp12(e.target.value as any)}
                className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
              <span className="text-xs text-slate-600">B</span>
              <select
                value={op23}
                onChange={(e) => setOp23(e.target.value as any)}
                className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
              <span className="text-xs text-slate-600">C</span>
              <select
                value={op34}
                onChange={(e) => setOp34(e.target.value as any)}
                className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="OR">OR</option>
                <option value="AND">AND</option>
              </select>
              <span className="text-xs text-slate-600">D</span>
            </div>

            <div className="text-[9px] text-slate-400 mt-2">
              Current: A {op12} B {op23} C {op34} D
            </div>
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}
