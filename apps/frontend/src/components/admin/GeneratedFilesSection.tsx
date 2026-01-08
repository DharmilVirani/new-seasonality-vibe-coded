'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { 
  Database, Search, Calendar, 
  BarChart3, TrendingUp, Archive, ExternalLink, Eye, Trash2
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
    color: 'text-blue-600'
  },
  mondayWeekly: {
    name: 'Monday Weekly',
    description: 'Monday-based weekly aggregations',
    icon: BarChart3,
    color: 'text-green-600'
  },
  expiryWeekly: {
    name: 'Expiry Weekly',
    description: 'Expiry-based weekly aggregations',
    icon: BarChart3,
    color: 'text-teal-600'
  },
  monthly: {
    name: 'Monthly Data',
    description: 'Monthly aggregation with returns',
    icon: TrendingUp,
    color: 'text-purple-600'
  },
  yearly: {
    name: 'Yearly Data',
    description: 'Yearly aggregation with returns',
    icon: Archive,
    color: 'text-orange-600'
  }
};

export function CalculatedDataSection() {
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTab, setViewerTab] = useState('daily');

  // Fetch analysis stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['analysis-stats'],
    queryFn: async () => {
      const response = await api.get('/analysis/stats');
      return response.data.data;
    },
  });

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
        // Use a more gentle refresh approach
        // Wait a bit for the success message to show, then reload
        setTimeout(() => {
          window.location.href = window.location.pathname;
        }, 2000);
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to delete ticker');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Symbols</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loading size="sm" /> : statsData?.totalSymbols || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Records</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.daily?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Records</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.weekly?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loading size="sm" /> : statsData?.recordCounts?.total?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Symbol Search */}
      <Card>
        <CardHeader>
          <CardTitle>View Calculated Data</CardTitle>
          <CardDescription>
            Search for a symbol to view its calculated seasonality data (Daily, Weekly, Monthly, Yearly)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Enter symbol (e.g., RELIANCE, NIFTY)"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSymbol()}
              className="flex-1"
            />
            <Button onClick={handleSearchSymbol} disabled={!searchSymbol.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Symbol Data */}
      {selectedSymbol && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Data for {selectedSymbol}</CardTitle>
                <CardDescription>Available calculated data</CardDescription>
              </div>
              <Button
                onClick={() => handleDeleteTicker(selectedSymbol)}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Ticker
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {symbolLoading ? (
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            ) : symbolData ? (
              <div className="space-y-6">
                {/* Symbol Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Records</div>
                    <div className="text-lg font-semibold">{symbolData.totalRecords?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Date Range</div>
                    <div className="text-lg font-semibold">
                      {symbolData.firstDataDate ? new Date(symbolData.firstDataDate).toLocaleDateString() : 'N/A'} - {symbolData.lastDataDate ? new Date(symbolData.lastDataDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Updated</div>
                    <div className="text-lg font-semibold">
                      {symbolData.lastUpdated ? new Date(symbolData.lastUpdated).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Data Availability */}
                <div className="space-y-3">
                  {Object.entries(TIMEFRAME_INFO).map(([timeframe, info]) => {
                    const count = symbolData.dataAvailable?.[timeframe as keyof typeof symbolData.dataAvailable] || 0;
                    const Icon = info.icon;
                    
                    return (
                      <div key={timeframe} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Icon className={cn("h-5 w-5", info.color)} />
                          <div>
                            <div className="font-medium">{info.name}</div>
                            <div className="text-sm text-muted-foreground">{info.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {count.toLocaleString()} records available
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleViewData(selectedSymbol, timeframe)}
                          variant="outline"
                          size="sm"
                          disabled={count === 0}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Data
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Latest Data Preview */}
                {symbolData.latestData && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Latest Data Points</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(symbolData.latestData).map(([timeframe, data]) => {
                        if (!data) return null;
                        
                        const info = TIMEFRAME_INFO[timeframe as keyof typeof TIMEFRAME_INFO];
                        if (!info) return null;
                        const Icon = info.icon;
                        const record = data as LatestDataRecord;
                        
                        return (
                          <div key={timeframe} className="p-3 border rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                              <Icon className={cn("h-4 w-4", info.color)} />
                              <span className="font-medium text-sm">{info.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Date:</span> {new Date(record.date).toLocaleDateString()}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Close:</span> {record.close}
                              </div>
                              {record.returnPercentage !== null && (
                                <div>
                                  <span className="text-muted-foreground">Return:</span> 
                                  <span className={cn(
                                    "ml-1",
                                    record.returnPercentage > 0 ? "text-green-600" : "text-red-600"
                                  )}>
                                    {record.returnPercentage}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No calculated data found for {selectedSymbol}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recently Updated Symbols */}
      {statsData?.recentlyUpdated?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Updated Symbols</CardTitle>
            <CardDescription>Latest data processing activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statsData.recentlyUpdated.map((symbol: any) => (
                <div key={symbol.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Database className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">{symbol.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {symbol.totalRecords?.toLocaleString()} records • Updated {new Date(symbol.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelectedSymbol(symbol.symbol)}
                    variant="ghost"
                    size="sm"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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