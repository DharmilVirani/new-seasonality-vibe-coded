'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import type { ChartConfig } from './types';
import { yearColors, electionColors } from './types';

type FieldType = 'CalendarYearDay' | 'TradingYearDay' | 'CalendarMonthDay' | 'TradingMonthDay' | 'Weekday';
type ElectionType = 'All Years' | 'Election Years' | 'Pre Election Years' | 'Post Election Years' | 'Mid Election Years' | 'Modi Years' | 'Current Year';

interface SuperimposedChartProps {
  data: Record<string, Array<{ field: number | string; cumulativeReturn: number }>>;
  symbols?: string[];
  electionTypes?: ElectionType[];
  fieldType: FieldType;
  config?: ChartConfig;
}

const fieldLabels: Record<FieldType, string> = {
  CalendarYearDay: 'Calendar Year Day',
  TradingYearDay: 'Trading Year Day',
  CalendarMonthDay: 'Calendar Month Day',
  TradingMonthDay: 'Trading Month Day',
  Weekday: 'Weekday',
};

export function SuperimposedChart({
  data,
  symbols = [],
  electionTypes = [],
  fieldType,
  config = {},
}: SuperimposedChartProps) {
  const series = Object.keys(data);
  const isElectionChart = electionTypes.length > 0;

  // Transform data for recharts
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    
    // Get all unique field values
    const allFields = new Set<number | string>();
    series.forEach((s) => {
      data[s]?.forEach((d) => allFields.add(d.field));
    });
    
    const sortedFields = Array.from(allFields).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
    
    return sortedFields.map((field) => {
      const point: { field: number | string; [key: string]: number | string } = { field };
      series.forEach((s) => {
        const match = data[s]?.find((d) => d.field === field);
        if (match) {
          point[s] = match.cumulativeReturn;
        }
      });
      return point;
    });
  }, [data, series]);

  const chartConfig: ChartConfig = {
    title: isElectionChart
      ? `Election Year Comparison - ${fieldLabels[fieldType]}`
      : `Symbol Comparison - ${fieldLabels[fieldType]}`,
    subtitle: isElectionChart
      ? electionTypes.join(', ')
      : symbols.join(', '),
    height: 600,
    ...config,
  };

  const getColor = (seriesName: string, idx: number): string => {
    if (isElectionChart && electionColors[seriesName]) {
      return electionColors[seriesName];
    }
    return yearColors[idx % yearColors.length];
  };

  const getLineStyle = (seriesName: string): string | undefined => {
    if (seriesName === 'Election Years') return '5 5';
    return undefined;
  };

  return (
    <ChartWrapper config={chartConfig}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="field"
            tick={{ fontSize: 10 }}
            label={{
              value: fieldLabels[fieldType],
              position: 'bottom',
              offset: 10,
            }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            label={{
              value: 'Cumulative Return %',
              angle: -90,
              position: 'insideLeft',
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-card border rounded-lg p-3 shadow-lg">
                  <p className="font-medium mb-2">{fieldLabels[fieldType]}: {label}</p>
                  <div className="space-y-1 text-sm">
                    {payload
                      .filter((p) => p.value !== undefined)
                      .sort((a, b) => (b.value as number) - (a.value as number))
                      .map((p, idx) => (
                        <div key={idx} className="flex justify-between gap-4">
                          <span style={{ color: p.color }}>{p.name}</span>
                          <span className={(p.value as number) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {(p.value as number)?.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ paddingTop: 20 }} />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
          
          {series.map((s, idx) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={getColor(s, idx)}
              strokeWidth={s === 'All Years' || s === symbols[0] ? 2.5 : 1.5}
              strokeDasharray={getLineStyle(s)}
              dot={false}
              name={s}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
