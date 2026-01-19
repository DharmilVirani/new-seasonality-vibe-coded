'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker, YearFilters } from '@/components/filters';
import { Play, BarChart3, Calendar, Activity, Layers } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const yearCount = data?.data?.yearlyData ? Object.keys(data.data.yearlyData).length : 0;

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Stats Bar - Full Width at Top */}
      <div className="flex-shrink-0 border rounded-lg bg-card mx-4 mt-4">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">{selectedSymbols[0] || 'Select Symbol'}</h1>
              <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded">
                Yearly Overlay ({overlayType === 'CalendarDays' ? 'Calendar' : 'Trading'} Days)
              </span>
            </div>
            
            {yearCount > 0 ? (
              <div className="flex items-center gap-6">
                <StatsBox 
                  icon={<Layers className="h-4 w-4" />}
                  label="Years" 
                  value={yearCount} 
                />
                <StatsBox 
                  icon={<Calendar className="h-4 w-4" />}
                  label="Day Range" 
                  value={overlayType === 'CalendarDays' ? '1-365' : '1-252'} 
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Run analysis to see yearly overlay</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Chart Left, Filters Right */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Side - Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-card overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b flex items-center justify-between bg-muted/30">
            <h2 className="font-semibold text-sm">Yearly Overlay Chart</h2>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loading size="lg" />
                  <p className="text-sm text-muted-foreground">Analyzing data...</p>
                </div>
              </div>
            ) : data?.data?.yearlyData ? (
              <div className="h-full min-h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dayNumber" 
                      type="number" 
                      domain={[1, overlayType === 'CalendarDays' ? 365 : 252]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => `${value}%`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
                    />
                    <Legend />
                    {Object.entries(data.data.yearlyData).map(([year, yearData]: [string, any], idx) => (
                      <Line
                        key={year}
                        data={yearData}
                        dataKey="cumulativeReturn"
                        name={year}
                        stroke={colors[idx % colors.length]}
                        dot={false}
                        strokeWidth={year === new Date().getFullYear().toString() ? 3 : 1.5}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">No Data</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select a symbol and click Run Analysis
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Filters Panel */}
        <div className="w-72 flex-shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b bg-muted/30">
            <h2 className="font-semibold text-sm">Filters</h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              <FilterSection title="Symbol" icon={<BarChart3 className="h-4 w-4" />}>
                <SymbolSelector />
              </FilterSection>

              <FilterSection title="Overlay Type" icon={<Layers className="h-4 w-4" />}>
                <Select value={overlayType} onValueChange={(v) => setOverlayType(v as 'CalendarDays' | 'TradingDays')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="CalendarDays">Calendar Days</SelectItem>
                    <SelectItem value="TradingDays">Trading Days</SelectItem>
                  </SelectContent>
                </Select>
              </FilterSection>

              <FilterSection title="Date Range" icon={<Calendar className="h-4 w-4" />}>
                <DateRangePicker />
              </FilterSection>

              <Separator />

              <FilterSection title="Year Filters">
                <YearFilters />
              </FilterSection>
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 p-4 border-t bg-muted/30">
            <Button 
              onClick={() => refetch()} 
              disabled={isFetching || selectedSymbols.length === 0}
              className="w-full"
            >
              <Play className={`h-4 w-4 mr-2 ${isFetching ? 'animate-pulse' : ''}`} />
              {isFetching ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBox({ icon, label, value }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
    </div>
  );
}

function FilterSection({ title, icon, children }: { 
  title: string; 
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
