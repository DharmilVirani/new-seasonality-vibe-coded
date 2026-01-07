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
import { cn, formatPercentage } from '@/lib/utils';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ScenarioPage() {
  const { selectedSymbols, startDate, endDate } = useAnalysisStore();
  const [entryDay, setEntryDay] = useState('Monday');
  const [exitDay, setExitDay] = useState('Friday');
  const [entryType, setEntryType] = useState<'Open' | 'Close'>('Close');
  const [exitType, setExitType] = useState<'Open' | 'Close'>('Close');
  const [tradeType, setTradeType] = useState<'Long' | 'Short'>('Long');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['scenario-analysis', selectedSymbols[0], startDate, endDate, entryDay, exitDay, entryType, exitType, tradeType],
    queryFn: async () => {
      const response = await analysisApi.scenario({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        entryDay,
        exitDay,
        entryType,
        exitType,
        tradeType,
        returnType: 'Percent',
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scenario Analysis</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Analyze
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SymbolSelector />
            <DateRangePicker />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Entry Day</Label>
              <Select value={entryDay} onValueChange={setEntryDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {weekdays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exit Day</Label>
              <Select value={exitDay} onValueChange={setExitDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {weekdays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as 'Open' | 'Close')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Close">Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exit Type</Label>
              <Select value={exitType} onValueChange={(v) => setExitType(v as 'Open' | 'Close')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Close">Close</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trade Type</Label>
              <Select value={tradeType} onValueChange={(v) => setTradeType(v as 'Long' | 'Short')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : data?.data?.monthlyReturns ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Returns Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    {months.map(m => <th key={m}>{m}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.data.monthlyReturns).map(([year, monthData]: [string, any]) => (
                    <tr key={year}>
                      <td className="font-medium">{year}</td>
                      {months.map(m => (
                        <td key={m} className={cn(
                          monthData[m] > 0 ? 'text-green-600' : monthData[m] < 0 ? 'text-red-600' : ''
                        )}>
                          {monthData[m] !== undefined ? formatPercentage(monthData[m]) : '-'}
                        </td>
                      ))}
                      <td className={cn(
                        'font-semibold',
                        monthData.Total > 0 ? 'text-green-600' : monthData.Total < 0 ? 'text-red-600' : ''
                      )}>
                        {formatPercentage(monthData.Total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Configure your trade setup and click Analyze
          </CardContent>
        </Card>
      )}
    </div>
  );
}
