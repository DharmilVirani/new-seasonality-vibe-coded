'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import type { ChartConfig, AggregateData } from './types';
import { cn } from '@/lib/utils';

type AggregateType = 'total' | 'avg' | 'max' | 'min';
type FieldType = 'CalendarYearDay' | 'TradingYearDay' | 'CalendarMonthDay' | 'TradingMonthDay' | 'Weekday' | 'Month';

interface AggregateChartProps {
  data: AggregateData[];
  symbol: string;
  aggregateType: AggregateType;
  fieldType: FieldType;
  config?: ChartConfig;
}

const fieldLabels: Record<FieldType, string> = {
  CalendarYearDay: 'Calendar Year Days',
  TradingYearDay: 'Trading Year Days',
  CalendarMonthDay: 'Calendar Month Days',
  TradingMonthDay: 'Trading Month Days',
  Weekday: 'Weekdays',
  Month: 'Months',
};

const aggregateLabels: Record<AggregateType, string> = {
  total: 'Total Return',
  avg: 'Average Return',
  max: 'Maximum Return',
  min: 'Minimum Return',
};

export function AggregateChart({
  data,
  symbol,
  aggregateType,
  fieldType,
  config = {},
}: AggregateChartProps) {
  console.log('AggregateChart data:', data, 'aggregateType:', aggregateType);
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return (data as any[]).map((d) => {
      const value = d.value !== undefined ? d.value : (d[aggregateType] || 0);
      return {
        ...d,
        field: d.weekday || d.field || d.month || d.day || '',
        value: value,
        isPositive: value >= 0,
      };
    });
  }, [data, aggregateType]);

  const chartConfig: ChartConfig = {
    title: `${symbol} - ${aggregateLabels[aggregateType]} by ${fieldLabels[fieldType]}`,
    height: 500,
    ...config,
  };

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        No aggregate data available
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="field"
            tick={{ fontSize: 10 }}
            angle={fieldType.includes('Day') ? -45 : 0}
            textAnchor={fieldType.includes('Day') ? 'end' : 'middle'}
            height={60}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(2)}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-card border rounded-lg p-3 shadow-lg">
                  <p className="font-medium">{d.field}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <span className="text-muted-foreground">Value:</span>
                    <span className={cn(d.value >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.value?.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">Count:</span>
                    <span>{d.count}</span>
                  </div>
                </div>
              );
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={2} />
          <Bar
            dataKey="value"
            name={aggregateLabels[aggregateType]}
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
