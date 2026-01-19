'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {Button}  from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { 
  Database, Search, Calendar, 
  BarChart3, TrendingUp, Archive, ExternalLink, Eye, Trash2,
  Clock, ArrowRight, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { DataViewerModal } from './DataViewerModal';

interface LatestDataRecord {
  date: string;
  close: number;
  returnPercentage: number | null;
}

const TIMEFRAME_INFO = {
  daily: {
    name: 'Daily Data',
    description: 'OHLCV data with calculated fields',
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100'
  },
  mondayWeekly: {
    name: 'Monday Weekly',
    description: 'Monday-based weekly aggregations',
    icon: BarChart3,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100'
  },
  expiryWeekly: {
    name: 'Expiry Weekly',
    description: 'Expiry-based weekly aggregations',
    icon: BarChart3,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-100'
  },
  monthly: {
    name: 'Monthly Data',
    description: 'Monthly aggregation with returns',
    icon: TrendingUp,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100'
  },
  yearly: {
    name: 'Yearly Data',
    description: 'Yearly aggregation with returns',
    icon: Archive,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-100'
  }
};
const formatDate = (dateString: string | Date): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
export function CalculatedDataSection() {
  const [searchSymbol, setSearchSymbol] = useState('');
  const queryClient = useQueryClient();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTab, setViewerTab] = useState('daily');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch analysis stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['analysis-stats'],
    queryFn: async () => {
      const response = await api.get('/analysis/stats');
      return response.data.data;
    },
  });

  // Fetch all symbols for autocomplete
  const { data: allSymbols } = useQuery({
    queryKey: ['all-symbols'],
    queryFn: async () => {
      const response = await api.get('/analysis/symbols');
      // Extract just the symbol names from the response
      return (response.data.data || []).map((s: any) => s.symbol);
    },
  });

  // Filter symbols based on search input
  const filteredSymbols = searchSymbol.trim().length > 0 
    ? (allSymbols || []).filter((s: string) => 
        s.toLowerCase().includes(searchSymbol.toLowerCase())
      ).slice(0, 8) // Limit to 8 suggestions
    : [];

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered symbols change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredSymbols.length]);

  // Fetch symbol data
  const { data: symbolData, isLoading: symbolLoading } = useQuery({
    queryKey: ['symbol-analysis', selectedSymbol],
    queryFn: async () => {
      if (!selectedSymbol) return null;
      const response = await api.get(`/analysis/symbols/${selectedSymbol}/summary`);
      return response.data.data;
    },
    enabled: !!selectedSymbol,
  });

  const handleSearchSymbol = async () => {
    if (!searchSymbol.trim()) {
      toast.error('Please enter a symbol');
      return;
    }
    setSelectedSymbol(searchSymbol.toUpperCase().trim());
    setShowSuggestions(false);
  };

  const handleSelectSuggestion = (symbol: string) => {
    setSearchSymbol(symbol);
    setSelectedSymbol(symbol);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSymbols.length === 0) {
      if (e.key === 'Enter') handleSearchSymbol();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSymbols.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSymbols.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectSuggestion(filteredSymbols[highlightedIndex]);
        } else {
          handleSearchSymbol();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleViewData = async (symbol: string, timeframe: string) => {
    setSelectedSymbol(symbol);
    setViewerTab(timeframe);
    setViewerOpen(true);
  };

  const handleDeleteTicker = async (symbol: string) => {
    if (!confirm(`Are you sure you want to delete ${symbol} and ALL its data from all tables? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.delete(`/analysis/symbols/${symbol}`);
      if (response.data.success) {
        toast.success(`${symbol} deleted successfully. ${response.data.data.totalDeleted} records removed.`);
        setSelectedSymbol(null);
        setSearchSymbol('');
        // Use a more gentle refresh approach
        queryClient.invalidateQueries({ queryKey: ['analysis-stats'] });
        queryClient.invalidateQueries({ queryKey: ['all-symbols'] });

      }
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to delete ticker');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Symbols</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">
                  {statsLoading ? <Loading size="sm" /> : statsData?.totalSymbols || 0}
                </h3>
              </div>
              <div className="rounded-full bg-blue-50 p-3">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Daily Records</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">
                  {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.daily?.toLocaleString() || 0}
                </h3>
              </div>
              <div className="rounded-full bg-indigo-50 p-3">
                <Calendar className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Weekly Records</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">
                  {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.weekly?.toLocaleString() || 0}
                </h3>
              </div>
              <div className="rounded-full bg-emerald-50 p-3">
                <BarChart3 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Records</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">
                  {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.total?.toLocaleString() || 0}
                </h3>
              </div>
              <div className="rounded-full bg-orange-50 p-3">
                <ExternalLink className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Search Card */}
          <Card className="border-0 shadow-lg shadow-slate-200/40 ring-1 ring-slate-200">
            <CardHeader className="border-b border-slate-50 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Data Explorer</CardTitle>
                  <CardDescription>Search and analyze processed symbol data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 z-10" />
                  <Input
                    ref={inputRef}
                    placeholder="Enter symbol (e.g., RELIANCE, NIFTY)"
                    value={searchSymbol}
                    onChange={(e) => {
                      setSearchSymbol(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 h-12 text-lg"
                  />
                  {/* Autocomplete Dropdown */}
                  {showSuggestions && filteredSymbols.length > 0 && (
                    <div 
                      ref={suggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden"
                    >
                      {filteredSymbols.map((symbol: string, index: number) => (
                        <button
                          key={symbol}
                          onClick={() => handleSelectSuggestion(symbol)}
                          className={cn(
                            "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors",
                            index === highlightedIndex 
                              ? "bg-indigo-50 text-indigo-700" 
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                            {symbol.substring(0, 2)}
                          </div>
                          <span className="font-medium">
                            {/* Highlight matching text */}
                            {symbol.split(new RegExp(`(${searchSymbol})`, 'gi')).map((part, i) => 
                              part.toLowerCase() === searchSymbol.toLowerCase() 
                                ? <span key={i} className="text-indigo-600 font-semibold">{part}</span>
                                : part
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleSearchSymbol} 
                  disabled={!searchSymbol.trim()}
                  className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Symbol Data View */}
          {selectedSymbol && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                   <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                      {selectedSymbol.substring(0, 2)}
                   </div>
                   <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedSymbol}</h2>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                         <Activity className="h-3 w-3" />
                         Analysis Data
                      </p>
                   </div>
                </div>
                <Button
                  onClick={() => handleDeleteTicker(selectedSymbol)}
                  variant="ghost"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Ticker
                </Button>
              </div>

              {symbolLoading ? (
                <div className="flex justify-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <Loading />
                </div>
              ) : symbolData ? (
                <div className="space-y-8">
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Records</div>
                      <div className="text-2xl font-bold text-slate-900">{symbolData.totalRecords?.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Date Range</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatDate(symbolData.firstDataDate)} 
                        <span className="text-slate-400 mx-2">→</span> 
                        {formatDate(symbolData.lastDataDate)}
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Last Updated</div>
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-emerald-500" />
                        {formatDate(symbolData.lastUpdated)}
                      </div>
                    </div>
                  </div>

                  {/* Available Timeframes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(TIMEFRAME_INFO).map(([timeframe, info]) => {
                      const count = symbolData.dataAvailable?.[timeframe as keyof typeof symbolData.dataAvailable] || 0;
                      const Icon = info.icon;
                      
                      return (
                        <Card key={timeframe} className={cn(
                          "border transition-all hover:shadow-md",
                          info.borderColor,
                          count > 0 ? "bg-white" : "bg-slate-50 opacity-80"
                        )}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className={cn("p-2.5 rounded-lg", info.bgColor)}>
                                <Icon className={cn("h-5 w-5", info.color)} />
                              </div>
                              {count > 0 && (
                                <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium bg-white border shadow-sm", info.color)}>
                                  Available
                                </span>
                              )}
                            </div>
                            
                            <h3 className="font-bold text-slate-900">{info.name}</h3>
                            <p className="text-xs text-slate-500 mb-4 h-5">{info.description}</p>
                            
                            <div className="flex items-center justify-between mt-auto">
                               <div className="text-xs font-semibold text-slate-600">
                                 {count.toLocaleString()} records
                               </div>
                               <Button
                                 onClick={() => handleViewData(selectedSymbol, timeframe)}
                                 variant="ghost"
                                 size="sm"
                                 disabled={count === 0}
                                 className="h-8 hover:bg-slate-100"
                               >
                                 View Data <ArrowRight className="h-3 w-3 ml-1" />
                               </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Latest Data Preview */}
                  {symbolData.latestData && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6">
                        <CardTitle className="text-base font-semibold">Latest Market Data</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                 <tr>
                                    <th className="px-6 py-3 text-left">Timeframe</th>
                                    <th className="px-6 py-3 text-left">Date</th>
                                    <th className="px-6 py-3 text-right">Close Price</th>
                                    <th className="px-6 py-3 text-right">Return %</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {Object.entries(symbolData.latestData).map(([timeframe, data]) => {
                                    if (!data) return null;
                                    const info = TIMEFRAME_INFO[timeframe as keyof typeof TIMEFRAME_INFO];
                                    if (!info) return null;
                                    const record = data as LatestDataRecord;
                                    const Icon = info.icon;

                                    return (
                                       <tr key={timeframe} className="hover:bg-slate-50/50">
                                          <td className="px-6 py-4">
                                             <div className="flex items-center gap-2">
                                                <Icon className={cn("h-4 w-4", info.color)} />
                                                <span className="font-medium text-slate-700">{info.name}</span>
                                             </div>
                                          </td>
                                          <td className="px-6 py-4 text-slate-600">
                                             {new Date(record.date).toLocaleDateString()}
                                          </td>
                                          <td className="px-6 py-4 text-right font-mono text-slate-700">
                                             {record.close.toFixed(2)}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                             {record.returnPercentage !== null ? (
                                                <span className={cn(
                                                   "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                                   record.returnPercentage >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                )}>
                                                   {record.returnPercentage > 0 ? '+' : ''}{record.returnPercentage}%
                                                </span>
                                             ) : <span className="text-slate-300">-</span>}
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No calculated data found for {selectedSymbol}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Recent Updates */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg shadow-slate-200/40 ring-1 ring-slate-200 h-full flex flex-col bg-white">
            <CardHeader className="bg-white border-b border-slate-50 py-5 px-6">
              <div className="flex items-center gap-2">
                 <Activity className="h-5 w-5 text-emerald-600" />
                 <CardTitle className="text-base font-bold text-slate-800">Recently Updated</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               {statsData?.recentlyUpdated?.length > 0 ? (
                 <div className="space-y-4">
                   {statsData.recentlyUpdated.map((symbol: any) => (
                     <div 
                        key={symbol.symbol} 
                        onClick={() => setSelectedSymbol(symbol.symbol)}
                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/30 transition-all cursor-pointer"
                     >
                       <div className="flex items-center space-x-3">
                         <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                           {symbol.symbol.substring(0, 1)}
                         </div>
                         <div className="min-w-0">
                           <div className="font-semibold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{symbol.symbol}</div>
                           <div className="text-[10px] text-slate-400 flex items-center gap-1">
                             <Clock className="h-3 w-3" />
                             {formatDate(symbol.lastUpdated)}
                           </div>
                         </div>
                       </div>
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-7 w-7 p-0 text-slate-300 group-hover:text-indigo-600"
                       >
                         <Eye className="h-4 w-4" />
                       </Button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-8 text-xs text-slate-400 italic">
                    No recent updates
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Viewer Modal */}
      {selectedSymbol && (
        <DataViewerModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          symbol={selectedSymbol}
          timeframe={viewerTab}
        />
      )}
    </div>
  );
}