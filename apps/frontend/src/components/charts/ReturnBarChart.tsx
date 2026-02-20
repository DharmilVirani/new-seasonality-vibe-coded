'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
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
  color?: string;
  compareData?: ReturnData[];
  compareSymbol?: string;
  compareColor?: string;
  chartLabel?: 'month' | 'year' | 'day' | 'week';
}

export function ReturnBarChart({
  data,
  symbol,
  config = {},
  showCumulative = false,
  color = '#7c3aed',
  compareData,
  compareSymbol,
  compareColor = '#dc2626',
  chartLabel = 'day',
}: ReturnBarChartProps) {
  // Generate lighter shade for negative bars
  const lighterColor = color.length === 7
    ? color + '99' // Add alpha for lighter version
    : color;
  const lighterCompareColor = compareColor.length === 7
    ? compareColor + '99'
    : compareColor;

  const chartData = useMemo(() => {
    // For month/year view, data already has the label in date field
    // For day view, format as date string
    const dataMap = new Map();
    let cumulative = 0;

    data.forEach((d) => {
      cumulative += d.returnPercentage;
      let dateKey: string;
      
      if (chartLabel === 'month') {
        dateKey = String(d.date); // Already formatted as "Jan", "Feb", etc.
      } else if (chartLabel === 'year') {
        dateKey = String(d.date); // Already formatted as year "2010", "2011", etc.
      } else if (chartLabel === 'week') {
        dateKey = String(d.date); // Already formatted as "W1", "W2", etc.
      } else {
        // Daily view - format date
        dateKey = new Date(d.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        });
      }
      
      dataMap.set(dateKey, {
        date: dateKey,
        returnPercentage: d.returnPercentage,
        cumulativeReturn: cumulative,
        isPositive: d.returnPercentage >= 0,
      });
    });

    // Add compare data if provided
    if (compareData && compareData.length > 0) {
      let compareCumulative = 0;
      compareData.forEach((d) => {
        compareCumulative += d.returnPercentage;
        let dateKey: string;
        
        if (chartLabel === 'month') {
          dateKey = String(d.date);
        } else if (chartLabel === 'year') {
          dateKey = String(d.date);
        } else if (chartLabel === 'week') {
          dateKey = String(d.date);
        } else {
          dateKey = new Date(d.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
          });
        }
        const existing = dataMap.get(dateKey);
        if (existing) {
          existing.compareReturnPercentage = d.returnPercentage;
          existing.compareCumulativeReturn = compareCumulative;
          existing.isComparePositive = d.returnPercentage >= 0;
        } else {
          dataMap.set(dateKey, {
            date: dateKey,
            returnPercentage: null,
            cumulativeReturn: null,
            isPositive: null,
            compareReturnPercentage: d.returnPercentage,
            compareCumulativeReturn: compareCumulative,
            isComparePositive: d.returnPercentage >= 0,
          });
        }
      });
    }

    return Array.from(dataMap.values());
  }, [data, compareData, chartLabel]);

  const chartConfig: ChartConfig = {
    title: chartLabel === 'month' 
      ? `${symbol} - Monthly Avg Returns` 
      : chartLabel === 'year' 
        ? `${symbol} - Yearly Pattern Returns` 
        : `${symbol} - Daily Returns`,
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
                  {d.returnPercentage !== null && (
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">{symbol}: </span>
                      <span style={{ color: d.isPositive ? color : lighterColor }}>
                        {d.returnPercentage >= 0 ? '+' : ''}{d.returnPercentage?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {d.compareReturnPercentage !== undefined && d.compareReturnPercentage !== null && compareSymbol && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{compareSymbol}: </span>
                      <span style={{ color: d.isComparePositive ? compareColor : lighterCompareColor }}>
                        {d.compareReturnPercentage >= 0 ? '+' : ''}{d.compareReturnPercentage?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {showCumulative && d.cumulativeReturn !== null && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cumulative: </span>
                      <span style={{ color: d.cumulativeReturn >= 0 ? color : lighterColor }}>
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
            name={`${symbol} Return %`}
            radius={[2, 2, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isPositive ? color : lighterColor}
              />
            ))}
          </Bar>
          {compareData && compareData.length > 0 && (
            <Bar
              dataKey="compareReturnPercentage"
              name={`${compareSymbol} Return %`}
              radius={[2, 2, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`compare-cell-${index}`}
                  fill={entry.isComparePositive ? compareColor : lighterCompareColor}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
