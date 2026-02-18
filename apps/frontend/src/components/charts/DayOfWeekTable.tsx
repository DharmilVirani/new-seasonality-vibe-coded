'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatPercentage } from '@/lib/utils';
import { Download, TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Simple black tooltip for table headers
function HeaderTooltip({ label, formula, description }: { label: string; formula: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {label}
      <HelpCircle className="h-3 w-3 text-slate-300 hover:text-slate-500" />
      {isVisible && (
        <div className="fixed z-[9999] bg-black text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap">
          <div className="font-semibold mb-1">{label}</div>
          <div className="text-slate-300">{formula}</div>
          <div className="text-slate-400 text-[10px] mt-1">{description}</div>
        </div>
      )}
    </span>
  );
}

interface DayOfWeekStats {
  day: string;
  dayNumber: number;
  count: number;
  avgReturn: number;
  totalReturn: number;
  positiveCount: number;
  negativeCount: number;
  winRate: number;
  avgPositiveReturn: number;
  avgNegativeReturn: number;
  bestReturn: number;
  worstReturn: number;
}

interface DayOfWeekTableProps {
  data: any[];
  symbol: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function DayOfWeekTable({ data, symbol }: DayOfWeekTableProps) {
  const dayStats = useMemo(() => {
    if (!data || data.length === 0) return [];

    const dayGroups: Record<number, number[]> = {};
    
    data.forEach((d: any) => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Only track Monday-Friday (1-5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (!dayGroups[dayOfWeek]) dayGroups[dayOfWeek] = [];
        dayGroups[dayOfWeek].push(d.returnPercentage || 0);
      }
    });

    return Object.entries(dayGroups).map(([dayNum, returns]) => {
      const dayNumber = parseInt(dayNum);
      const count = returns.length;
      const avgReturn = returns.reduce((a, b) => a + b, 0) / count;
      const totalReturn = returns.reduce((a, b) => a + b, 0);
      const positiveReturns = returns.filter(r => r > 0);
      const negativeReturns = returns.filter(r => r <= 0);
      const positiveCount = positiveReturns.length;
      const negativeCount = negativeReturns.length;
      const winRate = (positiveCount / count) * 100;
      const avgPositiveReturn = positiveCount > 0 
        ? positiveReturns.reduce((a, b) => a + b, 0) / positiveCount 
        : 0;
      const avgNegativeReturn = negativeCount > 0 
        ? negativeReturns.reduce((a, b) => a + b, 0) / negativeCount 
        : 0;
      
      return {
        day: DAYS_OF_WEEK[dayNumber - 1],
        dayNumber,
        count,
        avgReturn,
        totalReturn,
        positiveCount,
        negativeCount,
        winRate,
        avgPositiveReturn,
        avgNegativeReturn,
        bestReturn: Math.max(...returns),
        worstReturn: Math.min(...returns),
      };
    }).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [data]);

  const downloadCSV = () => {
    const headers = [
      'Day',
      'Count',
      'Avg Return',
      'Total Return',
      'Win Rate',
      'Positive Count',
      'Avg Positive',
      'Negative Count',
      'Avg Negative',
      'Best Return',
      'Worst Return',
    ];

    const rows = dayStats.map((d) => [
      d.day,
      d.count,
      d.avgReturn.toFixed(2),
      d.totalReturn.toFixed(2),
      d.winRate.toFixed(1),
      d.positiveCount,
      d.avgPositiveReturn.toFixed(2),
      d.negativeCount,
      d.avgNegativeReturn.toFixed(2),
      d.bestReturn.toFixed(2),
      d.worstReturn.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}-day-of-week-stats.csv`;
    a.click();
  };

  if (dayStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Day of Week Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            No daily data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find best and worst performing days
  const bestDay = dayStats.reduce((a, b) => a.avgReturn > b.avgReturn ? a : b);
  const worstDay = dayStats.reduce((a, b) => a.avgReturn < b.avgReturn ? a : b);
  const mostConsistent = dayStats.reduce((a, b) => 
    Math.abs(a.winRate - 50) < Math.abs(b.winRate - 50) ? a : b
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg">Day of Week Statistics</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Performance analysis by weekday
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Best Day</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{bestDay.day}</div>
            <div className="text-sm text-emerald-600 font-medium">
              {formatPercentage(bestDay.avgReturn)} avg
            </div>
          </div>
          
          <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Worst Day</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{worstDay.day}</div>
            <div className="text-sm text-rose-600 font-medium">
              {formatPercentage(worstDay.avgReturn)} avg
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Minus className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Most Consistent</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{mostConsistent.day}</div>
            <div className="text-sm text-amber-600 font-medium">
              {mostConsistent.winRate.toFixed(1)}% win rate
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3 text-left font-semibold bg-slate-50 text-slate-700 sticky left-0 z-10">
                  <HeaderTooltip
                    label="Day"
                    formula="Day of Week"
                    description="Trading day (Monday-Friday)"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Count"
                    formula="Total Occurrences"
                    description="Number of times this day occurred"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Avg Return"
                    formula="Σ(Returns) ÷ Count"
                    description="Average return for this day"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Total Return"
                    formula="Σ(Returns)"
                    description="Total compounded return for this day"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Win Rate"
                    formula="(Positives ÷ Total) × 100"
                    description="Percentage of profitable occurrences"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Pos/Neg"
                    formula="Positive ÷ Negative"
                    description="Ratio of wins to losses"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Avg Pos"
                    formula="Σ(Positive) ÷ Pos Count"
                    description="Average return on winning days"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Avg Neg"
                    formula="Σ(Negative) ÷ Neg Count"
                    description="Average return on losing days"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Best"
                    formula="Maximum Return"
                    description="Best single day return"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip
                    label="Worst"
                    formula="Minimum Return"
                    description="Worst single day return"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {dayStats.map((row) => (
                <tr 
                  key={row.day} 
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50/50",
                    row.day === bestDay.day && "bg-emerald-50/30",
                    row.day === worstDay.day && "bg-rose-50/30"
                  )}
                >
                  <td className="p-3 sticky left-0 z-10 bg-white font-medium text-slate-900">
                    {row.day}
                  </td>
                  <td className="p-3 text-center text-slate-600">
                    {row.count}
                  </td>
                  <td className={cn(
                    'p-3 text-right font-semibold',
                    row.avgReturn > 0 ? 'text-emerald-600' : row.avgReturn < 0 ? 'text-rose-600' : 'text-slate-600'
                  )}>
                    {formatPercentage(row.avgReturn)}
                  </td>
                  <td className={cn(
                    'p-3 text-right',
                    row.totalReturn > 0 ? 'text-emerald-600' : row.totalReturn < 0 ? 'text-rose-600' : 'text-slate-600'
                  )}>
                    {formatPercentage(row.totalReturn)}
                  </td>
                  <td className="p-3 text-center">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      row.winRate > 50 ? 'bg-emerald-100 text-emerald-700' : 
                      row.winRate < 50 ? 'bg-rose-100 text-rose-700' : 
                      'bg-slate-100 text-slate-700'
                    )}>
                      {row.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-center text-slate-600">
                    <span className="text-emerald-600">{row.positiveCount}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-600">{row.negativeCount}</span>
                  </td>
                  <td className="p-3 text-right text-emerald-600">
                    {formatPercentage(row.avgPositiveReturn)}
                  </td>
                  <td className="p-3 text-right text-rose-600">
                    {formatPercentage(row.avgNegativeReturn)}
                  </td>
                  <td className="p-3 text-right text-emerald-600 font-medium">
                    {formatPercentage(row.bestReturn)}
                  </td>
                  <td className="p-3 text-right text-rose-600 font-medium">
                    {formatPercentage(row.worstReturn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default DayOfWeekTable;
