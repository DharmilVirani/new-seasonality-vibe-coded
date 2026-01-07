'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker } from '@/components/filters';
import { Label } from '@/components/ui/label';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatPercentage, formatCurrency } from '@/lib/utils';

export default function BacktesterPage() {
  const { selectedSymbols, startDate, endDate } = useAnalysisStore();
  const [positionSize, setPositionSize] = useState(100);
  const [stopLoss, setStopLoss] = useState(2);
  const [takeProfit, setTakeProfit] = useState(5);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['backtest', selectedSymbols[0], startDate, endDate, positionSize, stopLoss, takeProfit],
    queryFn: async () => {
      const response = await analysisApi.backtest({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        positionSize,
        stopLoss,
        takeProfit,
      });
      return response.data;
    },
    enabled: false,
  });

  const result = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backtester</h1>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Run Backtest
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backtest Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SymbolSelector />
            <DateRangePicker />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Position Size (%)</Label>
              <Input type="number" min={1} max={100} value={positionSize} onChange={(e) => setPositionSize(parseInt(e.target.value) || 100)} />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss (%)</Label>
              <Input type="number" min={0} step={0.5} value={stopLoss} onChange={(e) => setStopLoss(parseFloat(e.target.value) || 2)} />
            </div>
            <div className="space-y-2">
              <Label>Take Profit (%)</Label>
              <Input type="number" min={0} step={0.5} value={takeProfit} onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 5)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loading size="lg" />
        </div>
      ) : result ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Initial Capital</div>
                <div className="text-2xl font-bold">{formatCurrency(result.initialCapital)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Final Capital</div>
                <div className="text-2xl font-bold">{formatCurrency(result.finalCapital)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Return</div>
                <div className={cn('text-2xl font-bold', result.totalReturn > 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatPercentage(result.totalReturn)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Trades</div>
                <div className="text-2xl font-bold">{result.tradeCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Price</th>
                      <th>Shares</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades?.map((trade: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <span className={cn('flex items-center gap-1', trade.type === 'BUY' ? 'text-green-600' : 'text-red-600')}>
                            {trade.type === 'BUY' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {trade.type}
                          </span>
                        </td>
                        <td>{new Date(trade.date).toLocaleDateString()}</td>
                        <td>{trade.price?.toFixed(2)}</td>
                        <td>{trade.shares}</td>
                        <td className={cn(trade.pnl > 0 ? 'text-green-600' : trade.pnl < 0 ? 'text-red-600' : '')}>
                          {trade.pnl ? formatCurrency(trade.pnl) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            Configure settings and click Run Backtest
          </CardContent>
        </Card>
      )}
    </div>
  );
}
