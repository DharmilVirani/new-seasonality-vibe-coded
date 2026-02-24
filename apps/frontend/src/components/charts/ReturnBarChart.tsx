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
import { RETURN_COLORS } from '@/lib/utils';

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
  useSemanticColors?: boolean;
}

export function ReturnBarChart({
  data,
  symbol,
  config = {},
  showCumulative = false,
  color,
  compareData,
  compareSymbol,
  compareColor,
  chartLabel = 'day',
  useSemanticColors = true,
}: ReturnBarChartProps) {
  const positiveColor = RETURN_COLORS.positive;
  const negativeColor = RETURN_COLORS.negative;
  
  const primaryPositiveColor = color || positiveColor;
  const primaryNegativeColor = color ? color + '99' : negativeColor;
  
  const comparePositiveColor = compareColor || RETURN_COLORS.compare;
  const compareNegativeColor = compareColor ? compareColor + '99' : negativeColor;

  const chartData = useMemo(() => {
    const dataMap = new Map();
    let cumulative = 0;

    data.forEach((d) => {
      cumulative += d.returnPercentage;
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
      
      dataMap.set(dateKey, {
        date: dateKey,
        returnPercentage: d.returnPercentage,
        cumulativeReturn: cumulative,
        isPositive: d.returnPercentage >= 0,
      });
    });

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

  const getBarColor = (isPositive: boolean | null, isCompare: boolean = false) => {
    if (useSemanticColors) {
      if (isCompare) {
        return isPositive ? comparePositiveColor : compareNegativeColor;
      }
      return isPositive ? positiveColor : negativeColor;
    }
    if (isCompare) {
      return isPositive ? (compareColor || RETURN_COLORS.compare) : (compareColor ? compareColor + '99' : negativeColor);
    }
    return isPositive ? (color || positiveColor) : (color ? color + '99' : negativeColor);
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
                      <span style={{ color: d.isPositive ? positiveColor : negativeColor }}>
                        {d.returnPercentage >= 0 ? '+' : ''}{d.returnPercentage?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {d.compareReturnPercentage !== undefined && d.compareReturnPercentage !== null && compareSymbol && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{compareSymbol}: </span>
                      <span style={{ color: d.isComparePositive ? comparePositiveColor : negativeColor }}>
                        {d.compareReturnPercentage >= 0 ? '+' : ''}{d.compareReturnPercentage?.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {showCumulative && d.cumulativeReturn !== null && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cumulative: </span>
                      <span style={{ color: d.cumulativeReturn >= 0 ? positiveColor : negativeColor }}>
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
                fill={getBarColor(entry.isPositive)}
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
                  fill={getBarColor(entry.isComparePositive, true)}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
