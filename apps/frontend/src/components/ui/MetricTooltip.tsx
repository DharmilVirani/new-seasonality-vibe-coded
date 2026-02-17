'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const defaultMetrics: Record<string, { label: string; formula: string }> = {
  avgReturn: { label: 'Average Return', formula: 'Sum ÷ Count' },
  sumReturn: { label: 'Total Return', formula: 'Product(1+r) - 1' },
  cagr: { label: 'CAGR', formula: '(End/Start)^(1/years) - 1' },
  maxDrawdown: { label: 'Max Drawdown', formula: '(Peak - Trough) ÷ Peak' },
  winRate: { label: 'Win Rate', formula: 'Wins ÷ Total × 100' },
  lossRate: { label: 'Loss Rate', formula: 'Losses ÷ Total × 100' },
  stdDev: { label: 'Std Dev', formula: '√Variance' },
  volatility: { label: 'Volatility', formula: 'σ × √periods' },
  sharpeRatio: { label: 'Sharpe', formula: 'Return ÷ Risk' },
  sortinoRatio: { label: 'Sortino', formula: 'Return ÷ Downside' },
  totalCount: { label: 'Total', formula: 'Count of periods' },
  positiveCount: { label: 'Profitable', formula: 'Count of wins' },
  negativeCount: { label: 'Unprofitable', formula: 'Count of losses' },
  eventCount: { label: 'Events', formula: 'Occurrence count' },
  weekNumber: { label: 'Week', formula: 'ISO week (1-52)' },
  monthNumber: { label: 'Month', formula: 'Calendar month (1-12)' },
  year: { label: 'Year', formula: 'Calendar year' },
  returnPercentage: { label: 'Return %', formula: '(Close-Open)÷Open×100' },
  median: { label: 'Median', formula: 'Middle value' },
  consecutiveWins: { label: 'Win Streak', formula: 'Max consecutive +' },
  consecutiveLosses: { label: 'Loss Streak', formula: 'Max consecutive -' },
};

export const METRIC_DEFINITIONS = defaultMetrics;

interface MetricTooltipProps {
  metric: string;
  className?: string;
}

export function MetricTooltip({ metric, className }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const content = defaultMetrics[metric];
  
  if (!content) return null;

  return (
    <span 
      className={cn("relative inline-flex items-center", className)}
      style={{ position: 'relative' }}
    >
      <HelpCircle 
        className="h-3.5 w-3.5 text-slate-400 hover:text-amber-600 cursor-help ml-1"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />
      
      {isVisible && (
        <div 
          className="fixed z-[9999] bg-black text-white text-xs px-2 py-1.5 rounded shadow-lg pointer-events-none"
          style={{
            bottom: 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            whiteSpace: 'nowrap',
            maxWidth: '300px'
          }}
        >
          <div className="font-medium">{content.label}</div>
          <div className="text-slate-300 text-[10px]">{content.formula}</div>
        </div>
      )}
    </span>
  );
}

export function TableHeaderTooltip({ metricKey, className }: { metricKey: string; className?: string }) {
  return <MetricTooltip metric={metricKey} className={className} />;
}

export default MetricTooltip;
