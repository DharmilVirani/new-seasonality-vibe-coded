'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { DateRangePicker, YearFilters, MonthFilters } from '@/components/filters';
import { Label } from '@/components/ui/label';
import { RefreshCw, Search } from 'lucide-react';
import { cn, formatPercentage, formatNumber } from '@/lib/utils';

export default function ScannerPage() {
  const { startDate, endDate, filters } = useAnalysisStore();
  const [trendType, setTrendType] = useState<'Bullish' | 'Bearish'>('Bullish');
  const [consecutiveDays, setConsecutiveDays] = useState(3);
  const [minAccuracy, setMinAccuracy] = useState(60);
  const [minTotalPnl, setMinTotalPnl] = useState(1.5);
  const [minSampleSize, setMinSampleSize] = useState(50);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['scanner', startDate, endDate, filters, trendType, consecutiveDays, minAccuracy, minTotalPnl, minSampleSize],
    queryFn: async () => {
      const response = await analysisApi.scanner({
        startDate,
        endDate,
        filters,
        trendType,
        consecutiveDays,
        criteria: {
          minAccuracy,
          minTotalPnl,
          minSampleSize,
        },
      });
      return response.data;
    },
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Symbol Scanner</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <Search className={`h-4 w-4 mr-2`} />
          {isFetching ? 'Scanning...' : 'Scan'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scanner Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <DateRangePicker />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Trend Type</Label>
              <Select value={trendType} onValueChange={(v) => setTrendType(v as 'Bullish' | 'Bearish')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bullish">Bullish</SelectItem>
                  <SelectItem value="Bearish">Bearish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consecutive Days</Label>
              <Input type="number" min={1} max={10} value={consecutiveDays} onChange={(e) => setConsecutiveDays(parseInt(e.target.value) || 3)} />
            </div>
            <div className="space-y-2">
              <Label>Min Accuracy %</Label>
              <Input type="number" min={0} max={100} value={minAccuracy} onChange={(e) => setMinAccuracy(parseInt(e.target.value) || 60)} />
            </div>
            <div className="space-y-2">
              <Label>Min Total PnL %</Label>
              <Input type="number" step={0.1} value={minTotalPnl} onChange={(e) => setMinTotalPnl(parseFloat(e.target.value) || 1.5)} />
            </div>
            <div className="space-y-2">
              <Label>Min Sample Size</Label>
              <Input type="number" min={1} value={minSampleSize} onChange={(e) => setMinSampleSize(parseInt(e.target.value) || 50)} />
            </div>
          </div>
          <YearFilters />
          <MonthFilters />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Results ({data.matchCount} matches)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Start Date</th>
                    <th>Days</th>
                    <th>Sample Size</th>
                    <th>Accuracy</th>
                    <th>Avg PnL</th>
                    <th>Total PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((result: any, idx: number) => (
                    <tr key={idx}>
                      <td className="font-medium">{result.symbol}</td>
                      <td>{result.startDate}</td>
                      <td>{result.consecutiveDays}</td>
                      <td>{result.sampleSize}</td>
                      <td className={cn(result.accuracy >= 60 ? 'text-green-600' : 'text-red-600')}>
                        {formatNumber(result.accuracy)}%
                      </td>
                      <td className={cn(result.avgPnl > 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatPercentage(result.avgPnl)}
                      </td>
                      <td className={cn(result.totalPnl > 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatPercentage(result.totalPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : data?.data ? (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            No matches found. Try adjusting your criteria.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Configure criteria and click Scan to find patterns
          </CardContent>
        </Card>
      )}
    </div>
  );
}
