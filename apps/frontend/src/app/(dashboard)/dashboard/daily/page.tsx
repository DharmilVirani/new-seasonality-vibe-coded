'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker, YearFilters, MonthFilters, WeekFilters, DayFilters, OutlierFilters } from '@/components/filters';
import { SeasonalityChart, StatisticsCard, DataTable } from '@/components/charts';
import { RefreshCw } from 'lucide-react';

export default function DailyPage() {
  const { selectedSymbols, startDate, endDate, lastNDays, filters, chartScale, setChartScale } = useAnalysisStore();
  const [showFilters, setShowFilters] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['daily-analysis', selectedSymbols, startDate, endDate, lastNDays, filters],
    queryFn: async () => {
      const response = await analysisApi.daily({
        symbols: selectedSymbols,
        startDate,
        endDate,
        lastNDays,
        filters,
        chartScale,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const symbolData = data?.data?.[selectedSymbols[0]];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Analysis</h1>
        <div className="flex items-center gap-4">
          <Select value={chartScale} onValueChange={(v) => setChartScale(v as 'linear' | 'log')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="log">Log</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Analyze
          </Button>
        </div>
      </div>

      {showFilters && (
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
            <MonthFilters />
            <WeekFilters weekType="expiry" />
            <WeekFilters weekType="monday" />
            <DayFilters />
            <OutlierFilters />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : symbolData ? (
        <div className="space-y-6">
          <StatisticsCard statistics={symbolData.statistics} symbol={selectedSymbols[0]} />
          <SeasonalityChart data={symbolData.data} title={`${selectedSymbols[0]} - Filtered Daily Chart`} chartScale={chartScale} />
          <DataTable data={symbolData.data} title={`${selectedSymbols[0]} - Daily Data`} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a symbol and click Analyze to view data
          </CardContent>
        </Card>
      )}
    </div>
  );
}
