'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatPercentage, formatNumber } from '@/lib/utils';
import type { Statistics } from '@/lib/types';

interface StatisticsCardProps {
  statistics?: Statistics | null;
  symbol: string;
}

export function StatisticsCard({ statistics, symbol }: StatisticsCardProps) {
  if (!statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{symbol} Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No statistics available
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: 'Total Count', value: statistics.allCount ?? 0 },
    { label: 'Avg Return', value: formatPercentage(statistics.avgReturnAll ?? 0), isReturn: true },
    { label: 'Sum Return', value: formatPercentage(statistics.sumReturnAll ?? 0), isReturn: true },
    { label: 'Positive Days', value: statistics.posCount ?? 0 },
    { label: 'Positive Accuracy', value: `${formatNumber(statistics.posAccuracy ?? 0)}%` },
    { label: 'Negative Days', value: statistics.negCount ?? 0 },
    { label: 'Negative Accuracy', value: `${formatNumber(statistics.negAccuracy ?? 0)}%` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{symbol} Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div
                className={cn(
                  'text-xl font-semibold mt-1',
                  stat.isReturn && typeof stat.value === 'string' && stat.value.startsWith('+')
                    ? 'text-green-600'
                    : stat.isReturn && typeof stat.value === 'string' && stat.value.startsWith('-')
                    ? 'text-red-600'
                    : ''
                )}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
