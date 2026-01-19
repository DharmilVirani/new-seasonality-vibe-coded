'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker, YearFilters, MonthFilters, WeekFilters } from '@/components/filters';
import { DataTable } from '@/components/charts';
import { Play, TrendingUp, TrendingDown, BarChart3, Target, Calendar, Percent, Hash, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';

export default function WeeklyPage() {
  const { selectedSymbols, startDate, endDate, filters, chartScale, setChartScale } = useAnalysisStore();
  const [weekType, setWeekType] = useState<'monday' | 'expiry'>('monday');
  const [activeTab, setActiveTab] = useState('chart');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['weekly-analysis', selectedSymbols, startDate, endDate, filters, weekType],
    queryFn: async () => {
      const response = await analysisApi.weekly({
        symbol: selectedSymbols[0],
        startDate,
        endDate,
        weekType,
        filters,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  const symbolData = data?.data?.[selectedSymbols[0]];
  const stats = symbolData?.statistics;

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
                Weekly Analysis ({weekType === 'monday' ? 'Monday' : 'Expiry'})
              </span>
            </div>
            
            {stats ? (
              <div className="flex items-center gap-6 flex-wrap">
                <StatsBox 
                  icon={<Hash className="h-4 w-4" />}
                  label="Records" 
                  value={stats.totalCount || stats.allCount || 0} 
                />
                <StatsBox 
                  icon={<Target className="h-4 w-4" />}
                  label="Win Rate" 
                  value={`${(stats.winRate || stats.posAccuracy || 0).toFixed(1)}%`}
                  valueColor={(stats.winRate || stats.posAccuracy || 0) > 50 ? 'text-green-600' : 'text-red-600'}
                />
                <StatsBox 
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Avg Return" 
                  value={`${(stats.avgReturnAll || 0).toFixed(2)}%`}
                  valueColor={(stats.avgReturnAll || 0) >= 0 ? 'text-green-600' : 'text-red-600'}
                />
                <StatsBox 
                  icon={<Percent className="h-4 w-4" />}
                  label="Total Return" 
                  value={`${(stats.sumReturnAll || 0).toFixed(2)}%`}
                  valueColor={(stats.sumReturnAll || 0) >= 0 ? 'text-green-600' : 'text-red-600'}
                />
                <div className="h-8 w-px bg-border" />
                <StatsBox 
                  icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                  label="Positive" 
                  value={stats.positiveCount || stats.posCount || 0}
                  valueColor="text-green-600"
                />
                <StatsBox 
                  icon={<TrendingDown className="h-4 w-4 text-red-600" />}
                  label="Negative" 
                  value={stats.negativeCount || stats.negCount || 0}
                  valueColor="text-red-600"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Run analysis to see statistics</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Chart Left, Filters Right */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Side - Chart Area */}
        <div className="flex-1 flex flex-col min-w-0 border rounded-lg bg-card overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b flex items-center justify-between bg-muted/30">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="chart" className="text-xs px-3">Chart</TabsTrigger>
                <TabsTrigger value="table" className="text-xs px-3">Data Table</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2">
              <Select value={chartScale} onValueChange={(v) => setChartScale(v as 'linear' | 'log')}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="log">Log</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Loading size="lg" />
                  <p className="text-sm text-muted-foreground">Analyzing data...</p>
                </div>
              </div>
            ) : symbolData ? (
              <>
                {activeTab === 'chart' && (
                  <div className="h-full min-h-[400px]">
                    <ChartOnly 
                      data={symbolData.data} 
                      chartScale={chartScale}
                      symbol={selectedSymbols[0]}
                    />
                  </div>
                )}
                {activeTab === 'table' && (
                  <DataTable data={symbolData.data} title="" />
                )}
              </>
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

              <FilterSection title="Week Type" icon={<Calendar className="h-4 w-4" />}>
                <Select value={weekType} onValueChange={(v) => setWeekType(v as 'monday' | 'expiry')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="monday">Monday Week</SelectItem>
                    <SelectItem value="expiry">Expiry Week</SelectItem>
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

              <FilterSection title="Month Filters">
                <MonthFilters />
              </FilterSection>

              <FilterSection title="Week Filters">
                <WeekFilters weekType={weekType} />
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

function StatsBox({ icon, label, value, valueColor }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`font-semibold text-sm ${valueColor || ''}`}>{value}</div>
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

function ChartOnly({ data, chartScale, symbol }: { 
  data: any[]; 
  chartScale: 'linear' | 'log';
  symbol: string;
}) {
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((d: any) => {
      cumulative += d.returnPercentage || 0;
      return {
        ...d,
        label: d.weekLabel || d.label || new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
        cumulativeReturn: parseFloat(cumulative.toFixed(2)),
      };
    });
  }, [data]);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorReturnWeekly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            scale={chartScale}
            domain={['auto', 'auto']}
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
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Cumulative Return']}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="cumulativeReturn"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#colorReturnWeekly)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
