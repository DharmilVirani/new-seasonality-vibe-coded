'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatPercentage } from '@/lib/utils';
import { Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventCategoryStats {
  category: string;
  count: number;
  avgReturn: number;
  totalReturn: number;
  winRate: number;
  positiveCount: number;
  negativeCount: number;
  avgPositiveReturn: number;
  avgNegativeReturn: number;
  bestReturn: number;
  worstReturn: number;
  sharpeRatio: number;
}

interface EventCategorySummaryProps {
  data: any[];
  defaultCategory?: string;
}

export function EventCategorySummary({ data, defaultCategory }: EventCategorySummaryProps) {
  const categoryStats = useMemo(() => {
    if (!data || data.length === 0) return [];

    const categoryGroups: Record<string, number[]> = {};
    
    data.forEach((event: any) => {
      const category = event.eventCategory || event.category || defaultCategory || 'Uncategorized';
      if (!categoryGroups[category]) categoryGroups[category] = [];
      categoryGroups[category].push(event.returnPercentage || 0);
    });

    return Object.entries(categoryGroups).map(([category, returns]) => {
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
      
      // Calculate Sharpe-like ratio (simplified)
      const variance = returns.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / count;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;
      
      return {
        category,
        count,
        avgReturn,
        totalReturn,
        winRate,
        positiveCount,
        negativeCount,
        avgPositiveReturn,
        avgNegativeReturn,
        bestReturn: Math.max(...returns),
        worstReturn: Math.min(...returns),
        sharpeRatio,
      };
    }).sort((a, b) => b.avgReturn - a.avgReturn); // Sort by avg return descending
  }, [data]);

  const downloadCSV = () => {
    const headers = [
      'Category',
      'Count',
      'Avg Return',
      'Total Return',
      'Win Rate',
      'Pos Count',
      'Avg Pos',
      'Neg Count',
      'Avg Neg',
      'Best Return',
      'Worst Return',
      'Sharpe Ratio',
    ];

    const rows = categoryStats.map((cat) => [
      cat.category,
      cat.count,
      cat.avgReturn.toFixed(2),
      cat.totalReturn.toFixed(2),
      cat.winRate.toFixed(1),
      cat.positiveCount,
      cat.avgPositiveReturn.toFixed(2),
      cat.negativeCount,
      cat.avgNegativeReturn.toFixed(2),
      cat.bestReturn.toFixed(2),
      cat.worstReturn.toFixed(2),
      cat.sharpeRatio.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event-category-summary.csv';
    a.click();
  };

  if (categoryStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Category Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            No event data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find best and worst categories
  const bestCategory = categoryStats.reduce((a, b) => a.avgReturn > b.avgReturn ? a : b);
  const worstCategory = categoryStats.reduce((a, b) => a.avgReturn < b.avgReturn ? a : b);
  const mostConsistent = categoryStats.reduce((a, b) => 
    Math.abs(a.winRate - 50) < Math.abs(b.winRate - 50) ? a : b
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg">Event Category Summary</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Performance analysis by event category
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
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <div className="flex items-center gap-2 text-violet-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Best Category</span>
            </div>
            <div className="text-lg font-bold text-slate-900 truncate">{bestCategory.category}</div>
            <div className="text-sm text-violet-600 font-medium">
              {formatPercentage(bestCategory.avgReturn)} avg
            </div>
          </div>
          
          <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Worst Category</span>
            </div>
            <div className="text-lg font-bold text-slate-900 truncate">{worstCategory.category}</div>
            <div className="text-sm text-rose-600 font-medium">
              {formatPercentage(worstCategory.avgReturn)} avg
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Categories</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{categoryStats.length}</div>
            <div className="text-sm text-amber-600 font-medium">
              {data.length} total events
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3 text-left font-semibold bg-slate-50 text-slate-700 sticky left-0 z-10 min-w-[150px]">
                  Category
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  Events
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Avg Return
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Total Return
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  Win Rate
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  Pos/Neg
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Avg Pos
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Avg Neg
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Best
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Worst
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  Sharpe
                </th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map((row) => (
                <tr 
                  key={row.category} 
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50/50",
                    row.category === bestCategory.category && "bg-violet-50/30",
                    row.category === worstCategory.category && "bg-rose-50/30"
                  )}
                >
                  <td className="p-3 sticky left-0 z-10 bg-white font-medium text-slate-900 min-w-[150px]">
                    {row.category}
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
                  <td className="p-3 text-right text-slate-600">
                    {row.sharpeRatio.toFixed(2)}
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

export default EventCategorySummary;
