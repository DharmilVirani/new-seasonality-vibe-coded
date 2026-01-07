'use client';

import { useMemo } from 'react';
import { ChartWrapper } from './ChartWrapper';
import type { ChartConfig, HeatmapCell } from './types';
import { cn } from '@/lib/utils';

interface HeatmapChartProps {
  data: HeatmapCell[];
  xLabels: string[];
  yLabels: string[];
  title?: string;
  config?: ChartConfig;
  colorScale?: 'diverging' | 'sequential';
  valueFormat?: 'percentage' | 'decimal' | 'integer';
}

export function HeatmapChart({
  data,
  xLabels,
  yLabels,
  title = 'Heatmap',
  config = {},
  colorScale = 'diverging',
  valueFormat = 'decimal',
}: HeatmapChartProps) {
  // Create a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((cell) => {
      map.set(`${cell.x}-${cell.y}`, cell.value);
    });
    return map;
  }, [data]);

  // Calculate min/max for color scaling
  const [minValue, maxValue] = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => v !== null && !isNaN(v));
    return [Math.min(...values), Math.max(...values)];
  }, [data]);

  // Get color based on value
  const getColor = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return '#f3f4f6';
    
    if (colorScale === 'diverging') {
      // Red-White-Green scale for correlation/returns
      if (value === 1) return '#3b82f6'; // Perfect correlation (diagonal)
      if (value > 0) {
        const intensity = Math.min(value / maxValue, 1);
        const green = Math.round(200 + intensity * 55);
        const red = Math.round(255 - intensity * 100);
        return `rgb(${red}, ${green}, ${red})`;
      } else {
        const intensity = Math.min(Math.abs(value) / Math.abs(minValue), 1);
        const red = Math.round(200 + intensity * 55);
        const green = Math.round(255 - intensity * 100);
        return `rgb(${red}, ${green}, ${green})`;
      }
    } else {
      // Sequential blue scale
      const intensity = (value - minValue) / (maxValue - minValue);
      const blue = Math.round(100 + intensity * 155);
      return `rgb(${255 - intensity * 100}, ${255 - intensity * 100}, ${blue})`;
    }
  };

  const formatValue = (value: number | undefined): string => {
    if (value === undefined || isNaN(value)) return '-';
    switch (valueFormat) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'integer':
        return Math.round(value).toString();
      default:
        return value.toFixed(2);
    }
  };

  const chartConfig: ChartConfig = {
    title,
    height: Math.max(400, yLabels.length * 40 + 100),
    ...config,
  };

  return (
    <ChartWrapper config={chartConfig}>
      <div className="p-4 overflow-auto h-full">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-sm font-medium text-muted-foreground"></th>
              {xLabels.map((label) => (
                <th
                  key={label}
                  className="p-2 text-sm font-medium text-center min-w-[60px]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map((yLabel) => (
              <tr key={yLabel}>
                <td className="p-2 text-sm font-medium text-right pr-4">
                  {yLabel}
                </td>
                {xLabels.map((xLabel) => {
                  const value = dataMap.get(`${xLabel}-${yLabel}`);
                  return (
                    <td
                      key={`${xLabel}-${yLabel}`}
                      className="p-1"
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center h-10 rounded text-sm font-medium transition-all hover:scale-105',
                          value === 1 && 'ring-2 ring-primary'
                        )}
                        style={{ backgroundColor: getColor(value) }}
                        title={`${yLabel} vs ${xLabel}: ${formatValue(value)}`}
                      >
                        {formatValue(value)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Color legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor(minValue) }} />
            <span>{formatValue(minValue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getColor(maxValue) }} />
            <span>{formatValue(maxValue)}</span>
          </div>
        </div>
      </div>
    </ChartWrapper>
  );
}
