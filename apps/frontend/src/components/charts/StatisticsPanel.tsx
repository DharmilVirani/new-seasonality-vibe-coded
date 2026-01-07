'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatPercentage, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, BarChart3, Target, Percent, Hash } from 'lucide-react';
import type { StatisticsData } from './types';

interface StatisticsPanelProps {
  statistics: StatisticsData;
  symbol: string;
  title?: string;
  compact?: boolean;
}

interface StatItemProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  colorClass?: string;
  subValue?: string;
}

function StatItem({ label, value, icon, colorClass, subValue }: StatItemProps) {
  return (
    <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
      {icon && <div className="mb-2 text-muted-foreground">{icon}</div>}
      <div className="text-xs text-muted-foreground text-center">{label}</div>
      <div className={cn('text-xl font-bold mt-1', colorClass)}>{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}

export function StatisticsPanel({
  statistics,
  symbol,
  title,
  compact = false,
}: StatisticsPanelProps) {
  const stats = statistics;

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-2 p-4 bg-card rounded-lg border">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Count</div>
          <div className="font-semibold">{stats.allCount}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Avg Return</div>
          <div className={cn('font-semibold', stats.avgReturnAll >= 0 ? 'text-green-600' : 'text-red-600')}>
            {formatPercentage(stats.avgReturnAll)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Positive</div>
          <div className="font-semibold text-green-600">
            {stats.posCount} ({formatNumber(stats.posAccuracy)}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Negative</div>
          <div className="font-semibold text-red-600">
            {stats.negCount} ({formatNumber(stats.negAccuracy)}%)
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title || `${symbol} Statistics`}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatItem
            label="Total Count"
            value={stats.allCount}
            icon={<Hash className="h-5 w-5" />}
          />
          <StatItem
            label="Average Return"
            value={formatPercentage(stats.avgReturnAll)}
            icon={<BarChart3 className="h-5 w-5" />}
            colorClass={stats.avgReturnAll >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <StatItem
            label="Sum Return"
            value={formatPercentage(stats.sumReturnAll)}
            icon={<Target className="h-5 w-5" />}
            colorClass={stats.sumReturnAll >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <StatItem
            label="Positive Days"
            value={stats.posCount}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            colorClass="text-green-600"
            subValue={`${formatNumber(stats.posAccuracy)}% accuracy`}
          />
          <StatItem
            label="Negative Days"
            value={stats.negCount}
            icon={<TrendingDown className="h-5 w-5 text-red-600" />}
            colorClass="text-red-600"
            subValue={`${formatNumber(stats.negAccuracy)}% accuracy`}
          />
        </div>

        {/* Detailed breakdown */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Positive Days Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Count:</span>
              <span>{stats.posCount}</span>
              <span className="text-muted-foreground">Avg Return:</span>
              <span className="text-green-600">{formatPercentage(stats.avgReturnPos)}</span>
              <span className="text-muted-foreground">Sum Return:</span>
              <span className="text-green-600">{formatPercentage(stats.sumReturnPos)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Negative Days Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Count:</span>
              <span>{stats.negCount}</span>
              <span className="text-muted-foreground">Avg Return:</span>
              <span className="text-red-600">{formatPercentage(stats.avgReturnNeg)}</span>
              <span className="text-muted-foreground">Sum Return:</span>
              <span className="text-red-600">{formatPercentage(stats.sumReturnNeg)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
