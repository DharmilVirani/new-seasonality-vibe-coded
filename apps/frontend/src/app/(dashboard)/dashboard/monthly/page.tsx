'use client';

import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker, YearFilters } from '@/components/filters';
import { SeasonalityChart, StatisticsCard, DataTable } from '@/components/charts';
import { RefreshCw } from 'lucide-react';

export default function MonthlyPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale } = useAnalysisStore();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['monthly-analysis', selectedSymbols, startDate, endDate, filters],
    queryFn: async () => {
      const response = await analysisApi.monthly({
        symbols: selectedSymbols,
        startDate,
        endDate,
        filters,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const symbolData = data?.data?.[selectedSymbols[0]];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monthly Analysis</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Analyze
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SymbolSelector />
            <DateRangePicker />
          </div>
          <YearFilters />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : symbolData ? (
        <div className="space-y-6">
          <StatisticsCard statistics={symbolData.statistics} symbol={selectedSymbols[0]} />
          <SeasonalityChart data={symbolData.data} title={`${selectedSymbols[0]} - Monthly Chart`} chartScale={chartScale} />
          <DataTable data={symbolData.data} title={`${selectedSymbols[0]} - Monthly Data`} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a symbol and click Analyze to view monthly data
          </CardContent>
        </Card>
      )}
    </div>
  );
}
