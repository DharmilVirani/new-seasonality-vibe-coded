'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker } from '@/components/filters';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function YearlyPage() {
  const { selectedSymbols, startDate, endDate } = useAnalysisStore();
  const [overlayType, setOverlayType] = useState<'CalendarDays' | 'TradingDays'>('CalendarDays');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['yearly-analysis', selectedSymbols, startDate, endDate, overlayType],
    queryFn: async () => {
      const response = await analysisApi.yearly({
        symbols: selectedSymbols,
        startDate,
        endDate,
        overlayType,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Yearly Overlay Analysis</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Overlay Type:</Label>
            <Select value={overlayType} onValueChange={(v) => setOverlayType(v as 'CalendarDays' | 'TradingDays')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CalendarDays">Calendar Days</SelectItem>
                <SelectItem value="TradingDays">Trading Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Analyze
          </Button>
        </div>
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
        <Card>
          <CardHeader>
            <CardTitle>{selectedSymbols[0]} - Yearly Overlay ({overlayType})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayNumber" type="number" domain={[1, overlayType === 'CalendarDays' ? 365 : 252]} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {Object.entries(data.data.yearlyData || {}).map(([year, yearData]: [string, any], idx) => (
                    <Line
                      key={year}
                      data={yearData}
                      dataKey="cumulativeReturn"
                      name={year}
                      stroke={colors[idx % colors.length]}
                      dot={false}
                      strokeWidth={year === new Date().getFullYear().toString() ? 3 : 1}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a symbol and click Analyze to view yearly overlay
          </CardContent>
        </Card>
      )}
    </div>
  );
}
