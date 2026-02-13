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
import type { ChartConfig, ReturnData } from './types';

interface ReturnBarChartProps {
  data: ReturnData[];
  symbol: string;
  config?: ChartConfig;
  showCumulative?: boolean;
}

export function ReturnBarChart({
  data,
  symbol,
  config = {},
  showCumulative = false,
}: ReturnBarChartProps) {
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      cumulative += d.returnPercentage;
      return {
        ...d,
        date: new Date(d.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
        cumulativeReturn: cumulative,
        isPositive: d.returnPercentage >= 0,
      };
    });
  }, [data]);

  const chartConfig: ChartConfig = {
    title: `${symbol} - Daily Returns`,
    height: 400,
    ...config,
  };

  return (
    <ChartWrapper config={chartConfig}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9 }}
            interval="preserveStartEnd"
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
                  <p className="font-medium">{d.date}</p>
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Return: </span>
                    <span className={d.isPositive ? 'text-violet-600' : 'text-violet-400'}>
                      {d.returnPercentage >= 0 ? '+' : ''}{d.returnPercentage?.toFixed(2)}%
                    </span>
                  </div>
                  {showCumulative && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cumulative: </span>
                      <span className={d.cumulativeReturn >= 0 ? 'text-violet-600' : 'text-violet-400'}>
                        {d.cumulativeReturn >= 0 ? '+' : ''}{d.cumulativeReturn?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
          <Bar
            dataKey="returnPercentage"
            name="Daily Return %"
            radius={[2, 2, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? '#7c3aed' : '#a78bfa'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
