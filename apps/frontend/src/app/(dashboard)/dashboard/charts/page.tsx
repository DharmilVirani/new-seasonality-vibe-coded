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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function ChartsPage() {
  const { selectedSymbols, startDate, endDate } = useAnalysisStore();
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'bar'>('line');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['chart-data', selectedSymbols[0], startDate, endDate, chartType],
    queryFn: async () => {
      const response = await analysisApi.chart({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        chartType,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const chartData = data?.data?.map((d: any) => ({
    ...d,
    x: new Date(d.x).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Charts</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Chart Type:</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as 'candlestick' | 'line' | 'bar')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="candlestick">Candlestick</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Load Chart
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
      ) : chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{selectedSymbols[0]} - {chartType === 'line' ? 'Price' : chartType === 'bar' ? 'Returns' : 'OHLC'} Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={0} stroke="#666" />
                    <Bar
                      dataKey="y"
                      name="Return %"
                      fill="#3b82f6"
                    />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    {chartType === 'candlestick' ? (
                      <>
                        <Line type="monotone" dataKey="high" stroke="#22c55e" dot={false} name="High" />
                        <Line type="monotone" dataKey="low" stroke="#ef4444" dot={false} name="Low" />
                        <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} name="Close" />
                      </>
                    ) : (
                      <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={false} name="Close" />
                    )}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a symbol and click Load Chart
          </CardContent>
        </Card>
      )}
    </div>
  );
}
