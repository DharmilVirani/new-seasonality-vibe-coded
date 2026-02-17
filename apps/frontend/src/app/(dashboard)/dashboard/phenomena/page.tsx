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
import { SymbolSelector, DateRangePicker } from '@/components/filters';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';

const PRIMARY_COLOR = '#14b8a6';

export default function PhenomenaPage() {
  const { selectedSymbols, startDate, endDate } = useAnalysisStore();
  const [filterOpen, setFilterOpen] = useState(true);
  const [phenomenaType, setPhenomenaType] = useState<'consecutive' | 'reversal' | 'breakout'>('consecutive');
  const [threshold, setThreshold] = useState(3);
  const [percentChange, setPercentChange] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['phenomena', selectedSymbols[0], startDate, endDate, phenomenaType, threshold, percentChange],
    queryFn: async () => {
      const response = await analysisApi.phenomena({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        phenomenaType,
        threshold,
        percentChange,
      });
      return response.data;
    },
    enabled: false,
  });

  const result = data?.data;

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Phenomena Detection</h1>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <Sparkles className={`h-4 w-4 mr-2`} />
              {isFetching ? 'Detecting...' : 'Detect Patterns'}
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
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.phenomenaCount}</div>
                      <div className="text-sm text-muted-foreground">Patterns Found</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.phenomenaType}</div>
                      <div className="text-sm text-muted-foreground">Pattern Type</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{result.threshold}+</div>
                      <div className="text-sm text-muted-foreground">Days Threshold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {result.phenomena && result.phenomena.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detected Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Days</th>
                            <th>Direction</th>
                            <th>Total Return</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.phenomena.map((p: any, idx: number) => (
                            <tr key={idx}>
                              <td>{new Date(p.startDate).toLocaleDateString()}</td>
                              <td>{new Date(p.endDate).toLocaleDateString()}</td>
                              <td>{p.days}</td>
                              <td className={cn(p.direction === 'Bullish' ? 'text-green-600' : 'text-red-600')}>
                                {p.direction}
                              </td>
                              <td className={cn(p.totalReturn > 0 ? 'text-green-600' : 'text-red-600')}>
                                {formatPercentage(p.totalReturn)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-20 text-center text-muted-foreground">
                Configure settings and click Detect Patterns
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
        subtitle="Configure Detection"
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Symbol Selection" icon={<span className="text-sm">📈</span>} delay={0}>
          <SymbolSelector />
        </FilterSection>

        <FilterSection title="Date Range" icon={<span className="text-sm">📅</span>} delay={0.1}>
          <DateRangePicker />
        </FilterSection>

        <FilterSection title="Detection Settings" icon={<span className="text-sm">🔍</span>} delay={0.2}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Phenomena Type</Label>
              <Select value={phenomenaType} onValueChange={(v) => setPhenomenaType(v as 'consecutive' | 'reversal' | 'breakout')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="consecutive">Consecutive Days</SelectItem>
                  <SelectItem value="reversal">Reversal Patterns</SelectItem>
                  <SelectItem value="breakout">Breakout Patterns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Threshold (Days)</Label>
              <Input 
                type="number" 
                min={2} 
                max={20} 
                value={threshold} 
                onChange={(e) => setThreshold(parseInt(e.target.value) || 3)} 
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Min % Change</Label>
              <Input 
                type="number" 
                step={0.1} 
                value={percentChange} 
                onChange={(e) => setPercentChange(parseFloat(e.target.value) || 0)} 
                className="h-9"
              />
            </div>
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}
