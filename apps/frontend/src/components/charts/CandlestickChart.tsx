'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
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
import type { OHLCData, ChartConfig } from './types';
import { cn } from '@/lib/utils';

interface CandlestickChartProps {
  data: OHLCData[];
  symbol: string;
  config?: ChartConfig;
  showVolume?: boolean;
  scale?: 'linear' | 'log';
}

// Custom candlestick shape
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const isPositive = payload.close >= payload.open;
  const color = isPositive ? '#22c55e' : '#ef4444';
  
  const bodyTop = Math.min(payload.open, payload.close);
  const bodyBottom = Math.max(payload.open, payload.close);
  const bodyHeight = Math.abs(payload.close - payload.open);
  
  // Scale calculations
  const yScale = height / (payload.high - payload.low);
  const wickTop = (payload.high - Math.max(payload.open, payload.close)) * yScale;
  const wickBottom = (Math.min(payload.open, payload.close) - payload.low) * yScale;
  const bodyY = (payload.high - Math.max(payload.open, payload.close)) * yScale;
  const scaledBodyHeight = bodyHeight * yScale;

  return (
    <g>
      {/* Upper wick */}
      <line
        x1={x + width / 2}
        y1={y}
        x2={x + width / 2}
        y2={y + wickTop}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + 2}
        y={y + bodyY}
        width={width - 4}
        height={Math.max(scaledBodyHeight, 1)}
        fill={isPositive ? color : color}
        stroke={color}
      />
      {/* Lower wick */}
      <line
        x1={x + width / 2}
        y1={y + bodyY + scaledBodyHeight}
        x2={x + width / 2}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

export function CandlestickChart({
  data,
  symbol,
  config = {},
  showVolume = false,
  scale = 'linear',
}: CandlestickChartProps) {
  const chartData = useMemo(() => {
    return data.map((d, idx) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      idx,
      range: d.high - d.low,
      isPositive: d.close >= d.open,
      change: idx > 0 ? ((d.close - data[idx - 1].close) / data[idx - 1].close) * 100 : 0,
    }));
  }, [data]);

  const [minPrice, maxPrice] = useMemo(() => {
    const prices = data.flatMap((d) => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [data]);

  const chartConfig: ChartConfig = {
    title: `${symbol} - Candlestick Chart`,
    height: 500,
    ...config,
  };

  return (
    <ChartWrapper config={chartConfig}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            scale={scale}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => v.toFixed(0)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-card border rounded-lg p-3 shadow-lg">
                  <p className="font-medium">{d.date}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <span className="text-muted-foreground">Open:</span>
                    <span>{d.open?.toFixed(2)}</span>
                    <span className="text-muted-foreground">High:</span>
                    <span className="text-green-600">{d.high?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Low:</span>
                    <span className="text-red-600">{d.low?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Close:</span>
                    <span className={cn(d.isPositive ? 'text-green-600' : 'text-red-600')}>
                      {d.close?.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">Change:</span>
                    <span className={cn(d.change >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {d.change >= 0 ? '+' : ''}{d.change?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend />
          
          {/* High-Low range as bar */}
          <Bar
            dataKey="high"
            fill="transparent"
            stroke="none"
            shape={(props: any) => {
              const { x, width, payload } = props;
              const isPositive = payload.close >= payload.open;
              const color = isPositive ? '#22c55e' : '#ef4444';
              
              return (
                <g>
                  {/* Wick line */}
                  <line
                    x1={x + width / 2}
                    y1={props.y}
                    x2={x + width / 2}
                    y2={props.y + props.height}
                    stroke={color}
                    strokeWidth={1}
                  />
                </g>
              );
            }}
          />
          
          {/* Close price line for reference */}
          <Line
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={1}
            dot={false}
            name="Close"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
