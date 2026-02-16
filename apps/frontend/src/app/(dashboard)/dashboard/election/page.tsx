'use client';

import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker } from '@/components/filters';
import { RefreshCw } from 'lucide-react';
import { cn, formatPercentage, formatNumber } from '@/lib/utils';

const electionTypes = [
  { key: 'All', label: 'All Years' },
  { key: 'Election', label: 'Election Years' },
  { key: 'PreElection', label: 'Pre-Election Years' },
  { key: 'PostElection', label: 'Post-Election Years' },
  { key: 'MidElection', label: 'Mid-Election Years' },
  { key: 'Modi', label: 'Modi Years' },
  { key: 'Current', label: 'Current Year' },
];

export default function ElectionPage() {
  const { selectedSymbols, startDate, endDate, filters } = useAnalysisStore();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['election-analysis', selectedSymbols, startDate, endDate, filters],
    queryFn: async () => {
      const response = await analysisApi.election({
        symbol: selectedSymbols[0],
        symbols: selectedSymbols,
        startDate,
        endDate,
        filters,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Election Analysis</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Analyze
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SymbolSelector />
            <DateRangePicker />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : data?.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {electionTypes.map(({ key, label }) => {
            const typeData = data.data[key]?.[selectedSymbols[0]];
            const stats = typeData?.statistics;
            
            if (!stats) return null;

            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Days</span>
                      <span className="font-medium">{stats.allCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Return</span>
                      <span className={cn('font-medium', stats.avgReturnAll > 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatPercentage(stats.avgReturnAll)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sum Return</span>
                      <span className={cn('font-medium', stats.sumReturnAll > 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatPercentage(stats.sumReturnAll)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Positive Days</span>
                      <span className="font-medium text-green-600">{stats.posCount} ({formatNumber(stats.posAccuracy)}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Negative Days</span>
                      <span className="font-medium text-red-600">{stats.negCount} ({formatNumber(stats.negAccuracy)}%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a symbol and click Analyze to view election cycle analysis
          </CardContent>
        </Card>
      )}
    </div>
  );
}
