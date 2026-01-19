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
import type { ChartConfig } from './types';
import { cn } from '@/lib/utils';

interface ConsecutiveTrendData {
  startDate: string;
  endDate: string;
  days: number;
  direction: 'Bullish' | 'Bearish';
  totalReturn: number;
  avgReturn: number;
}

interface ConsecutiveTrendChartProps {
  data: ConsecutiveTrendData[];
  symbol: string;
  config?: ChartConfig;
}

export function ConsecutiveTrendChart({
  data,
  symbol,
  config = {},
}: ConsecutiveTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((d, idx) => ({
      ...d,
      idx: idx + 1,
      label: `${new Date(d.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
      isBullish: d.direction === 'Bullish',
    }));
  }, [data]);

  const chartConfig: ChartConfig = {
    title: `${symbol} - Consecutive Trend Patterns`,
    subtitle: `${data.length} patterns found`,
    height: 400,
    ...config,
  };

  return (
    <ChartWrapper config={chartConfig}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-card border rounded-lg p-3 shadow-lg">
                  <p className="font-medium">{d.direction} Pattern</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <span className="text-muted-foreground">Start:</span>
                    <span>{new Date(d.startDate).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">End:</span>
                    <span>{new Date(d.endDate).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">Days:</span>
                    <span>{d.days}</span>
                    <span className="text-muted-foreground">Total Return:</span>
                    <span className={cn(d.totalReturn >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.totalReturn >= 0 ? '+' : ''}{d.totalReturn?.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">Avg/Day:</span>
                    <span className={cn(d.avgReturn >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.avgReturn >= 0 ? '+' : ''}{d.avgReturn?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
          <Bar
            dataKey="totalReturn"
            name="Total Return %"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isBullish ? '#22c55e' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
