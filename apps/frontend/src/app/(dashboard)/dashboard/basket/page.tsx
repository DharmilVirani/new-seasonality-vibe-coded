'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { DateRangePicker } from '@/components/filters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RefreshCw, X } from 'lucide-react';
import { cn, formatNumber, formatPercentage } from '@/lib/utils';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';

const PRIMARY_COLOR = '#6366f1';

export default function BasketPage() {
  const { startDate, endDate } = useAnalysisStore();
  const [filterOpen, setFilterOpen] = useState(true);
  const [basketSymbols, setBasketSymbols] = useState<string[]>(['NIFTY', 'BANKNIFTY']);

  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols;
    },
  });

  const symbols = symbolsData || [];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['basket', basketSymbols, startDate, endDate],
    queryFn: async () => {
      const response = await analysisApi.basket({
        symbols: basketSymbols,
        startDate,
        endDate,
      });
      return response.data;
    },
    enabled: basketSymbols.length >= 2,
  });

  const addSymbol = (symbol: string) => {
    if (!basketSymbols.includes(symbol)) {
      setBasketSymbols([...basketSymbols, symbol]);
    }
  };

  const removeSymbol = (symbol: string) => {
    setBasketSymbols(basketSymbols.filter((s) => s !== symbol));
  };

  const result = data?.data;

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Basket Analysis</h1>
            <Button onClick={() => refetch()} disabled={isFetching || basketSymbols.length < 2}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Analyze Basket
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loading size="lg" />
            </div>
          ) : result ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Correlation Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th></th>
                          {result.symbols.map((s: string) => (
                            <th key={s}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.symbols.map((sym1: string) => (
                          <tr key={sym1}>
                            <td className="font-medium">{sym1}</td>
                            {result.symbols.map((sym2: string) => {
                              const corr = result.correlations?.[sym1]?.[sym2];
                              return (
                                <td
                                  key={sym2}
                                  className={cn(
                                    'text-center',
                                    corr === 1
                                      ? 'bg-primary/20'
                                      : corr > 0.7
                                      ? 'bg-green-100 text-green-800'
                                      : corr < -0.3
                                      ? 'bg-red-100 text-red-800'
                                      : ''
                                  )}
                                >
                                  {corr !== null ? formatNumber(corr, 4) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Individual Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.symbols.map((symbol: string) => {
                      const stats = result.individualStats?.[symbol];
                      if (!stats) return null;
                      return (
                        <div key={symbol} className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2">{symbol}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Count</span>
                              <span>{stats.allCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Avg Return</span>
                              <span className={cn(stats.avgReturnAll > 0 ? 'text-green-600' : 'text-red-600')}>
                                {formatPercentage(stats.avgReturnAll)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Accuracy</span>
                              <span>{formatNumber(stats.posAccuracy)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-20 text-center text-muted-foreground">
                {basketSymbols.length < 2
                  ? 'Add at least 2 symbols to analyze basket correlation'
                  : 'Click Analyze Basket to view correlation analysis'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={() => refetch()}
        isLoading={isFetching}
        title="Filters"
        subtitle="Configure Basket"
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Date Range" icon={<span className="text-sm">📅</span>} delay={0}>
          <DateRangePicker />
        </FilterSection>

        <FilterSection title="Basket Configuration" icon={<span className="text-sm">🧺</span>} delay={0.1}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Add Symbol to Basket</Label>
              <Select onValueChange={addSymbol}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select symbol to add" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {symbols
                    .filter((s: any) => !basketSymbols.includes(s.symbol))
                    .map((s: any) => (
                      <SelectItem key={s.symbol} value={s.symbol}>
                        {s.symbol}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Selected Symbols ({basketSymbols.length})</Label>
              <div className="flex flex-wrap gap-2">
                {basketSymbols.map((symbol) => (
                  <span
                    key={symbol}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm"
                  >
                    {symbol}
                    <button onClick={() => removeSymbol(symbol)} className="hover:text-indigo-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}
