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
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      value: d[aggregateType],
      isPositive: d[aggregateType] >= 0,
    }));
  }, [data, aggregateType]);

  const chartConfig: ChartConfig = {
    title: `${symbol} - ${aggregateLabels[aggregateType]} by ${fieldLabels[fieldType]}`,
    height: 500,
    ...config,
  };

  return (
    <ChartWrapper config={chartConfig}>
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
                  <p className="font-medium">{fieldLabels[fieldType]}: {d.field}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <span className="text-muted-foreground">Total:</span>
                    <span className={cn(d.total >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.total?.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">Average:</span>
                    <span className={cn(d.avg >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.avg?.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">Count:</span>
                    <span>{d.count}</span>
                    <span className="text-muted-foreground">Positive:</span>
                    <span className="text-green-600">{d.posCount} ({d.posAccuracy?.toFixed(1)}%)</span>
                    <span className="text-muted-foreground">Negative:</span>
                    <span className="text-red-600">{d.negCount} ({d.negAccuracy?.toFixed(1)}%)</span>
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
                fill={entry.isPositive ? '#22c55e' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
