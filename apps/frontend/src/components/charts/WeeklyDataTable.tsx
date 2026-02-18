'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, HelpCircle } from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';

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

interface WeeklyStatistics {
  week: number;
  allCount: number;
  avgReturnAll: number;
  sumReturnAll: number;
  posCount: number;
  posAccuracy: number;
  avgReturnPos: number;
  sumReturnPos: number;
  negCount: number;
  negAccuracy: number;
  avgReturnNeg: number;
  sumReturnNeg: number;
}

interface WeeklyDataTableProps {
  data: WeeklyStatistics[];
  title?: string;
  viewMode?: 'yearly' | 'monthly';
  onViewModeChange?: (mode: 'yearly' | 'monthly') => void;
}

export function WeeklyDataTable({
  data,
  title = 'Weekly Statistics',
  viewMode: externalViewMode,
  onViewModeChange,
}: WeeklyDataTableProps) {
  const [internalViewMode, setInternalViewMode] = useState<'yearly' | 'monthly'>('yearly');
  
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // Calculate aggregate statistics for "All Weeks"
  const aggregateStats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalCount = data.reduce((sum, d) => sum + d.allCount, 0);
    const totalPosCount = data.reduce((sum, d) => sum + d.posCount, 0);
    const totalNegCount = data.reduce((sum, d) => sum + d.negCount, 0);
    
    // Weighted average calculations
    const weightedAvgReturn = totalCount > 0
      ? data.reduce((sum, d) => sum + d.avgReturnAll * d.allCount, 0) / totalCount
      : 0;
    
    const weightedAvgPos = totalPosCount > 0
      ? data.reduce((sum, d) => sum + d.avgReturnPos * d.posCount, 0) / totalPosCount
      : 0;
    
    const weightedAvgNeg = totalNegCount > 0
      ? data.reduce((sum, d) => sum + d.avgReturnNeg * d.negCount, 0) / totalNegCount
      : 0;

    return {
      allCount: totalCount,
      avgReturnAll: weightedAvgReturn,
      sumReturnAll: data.reduce((sum, d) => sum + d.sumReturnAll, 0),
      posCount: totalPosCount,
      posAccuracy: totalCount > 0 ? (totalPosCount / totalCount) * 100 : 0,
      avgReturnPos: weightedAvgPos,
      sumReturnPos: data.reduce((sum, d) => sum + d.sumReturnPos, 0),
      negCount: totalNegCount,
      negAccuracy: totalCount > 0 ? (totalNegCount / totalCount) * 100 : 0,
      avgReturnNeg: weightedAvgNeg,
      sumReturnNeg: data.reduce((sum, d) => sum + d.sumReturnNeg, 0),
    };
  }, [data]);

  // Filter and sort data based on view mode
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    if (viewMode === 'monthly') {
      // Monthly weeks are typically 1-5
      return data.filter(d => d.week >= 1 && d.week <= 5).sort((a, b) => a.week - b.week);
    }
    
    // Yearly weeks are 1-52
    return data.filter(d => d.week >= 1 && d.week <= 52).sort((a, b) => a.week - b.week);
  }, [data, viewMode]);

  const getReturnColorClass = (value: number): string => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-slate-600';
  };

  const getCountDisplay = (count: number, accuracy: number): string => {
    return `${count} (${formatPercentage(accuracy)})`;
  };

  const downloadCSV = () => {
    const headers = [
      'Week',
      'All Count',
      'Avg Return All',
      'Sum Return All',
      'Pos Count',
      'Avg Return Pos',
      'Sum Return Pos',
      'Neg Count',
      'Avg Return Neg',
      'Sum Return Neg',
    ];

    const rows = [
      // Aggregate row
      [
        'All Weeks',
        aggregateStats?.allCount ?? 0,
        aggregateStats?.avgReturnAll.toFixed(2) ?? 0,
        aggregateStats?.sumReturnAll.toFixed(2) ?? 0,
        aggregateStats?.posCount ?? 0,
        aggregateStats?.avgReturnPos.toFixed(2) ?? 0,
        aggregateStats?.sumReturnPos.toFixed(2) ?? 0,
        aggregateStats?.negCount ?? 0,
        aggregateStats?.avgReturnNeg.toFixed(2) ?? 0,
        aggregateStats?.sumReturnNeg.toFixed(2) ?? 0,
      ],
      // Individual rows
      ...filteredData.map((d) => [
        d.week,
        d.allCount,
        d.avgReturnAll.toFixed(2),
        d.sumReturnAll.toFixed(2),
        d.posCount,
        d.avgReturnPos.toFixed(2),
        d.sumReturnPos.toFixed(2),
        d.negCount,
        d.avgReturnNeg.toFixed(2),
        d.sumReturnNeg.toFixed(2),
      ]),
    ];

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-statistics-${viewMode}.csv`;
    a.click();
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            No weekly data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('yearly')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                viewMode === 'yearly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Yearly Weeks
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                viewMode === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Monthly Weeks
            </button>
          </div>
        </div>
        
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3 text-left font-semibold bg-slate-50 text-slate-700 sticky left-0 z-10">
                  <HeaderTooltip 
                    label="Week" 
                    formula="Week Number" 
                    description="Trading week of the year (1-52) or month (1-5)"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="All Count" 
                    formula="Total Occurrences" 
                    description="Number of times this week occurred in the data"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Avg Return All" 
                    formula="Σ(Returns) ÷ Count" 
                    description="Average return across all occurrences"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Sum Return All" 
                    formula="Σ(Returns)" 
                    description="Total compounded return for all occurrences"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Pos Count" 
                    formula="Count of Positive Returns" 
                    description="Number of profitable occurrences"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Avg Return Pos" 
                    formula="Σ(Positive Returns) ÷ Pos Count" 
                    description="Average return of only profitable periods"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Sum Return Pos" 
                    formula="Σ(Positive Returns)" 
                    description="Total return from profitable periods only"
                  />
                </th>
                <th className="p-3 text-center font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Neg Count" 
                    formula="Count of Negative Returns" 
                    description="Number of losing occurrences"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Avg Return Neg" 
                    formula="Σ(Negative Returns) ÷ Neg Count" 
                    description="Average return of only losing periods"
                  />
                </th>
                <th className="p-3 text-right font-semibold bg-slate-50 text-slate-700">
                  <HeaderTooltip 
                    label="Sum Return Neg" 
                    formula="Σ(Negative Returns)" 
                    description="Total return from losing periods only"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Aggregate Row */}
              {aggregateStats && (
                <tr className="border-b-2 border-slate-300 bg-amber-50/50 font-semibold">
                  <td className="p-3 sticky left-0 z-10 bg-amber-50/50 font-bold text-slate-900">
                    All Weeks
                  </td>
                  <td className="p-3 text-center text-slate-700">
                    {aggregateStats.allCount}
                  </td>
                  <td className={cn('p-3 text-right', getReturnColorClass(aggregateStats.avgReturnAll))}>
                    {formatPercentage(aggregateStats.avgReturnAll)}
                  </td>
                  <td className={cn('p-3 text-right', getReturnColorClass(aggregateStats.sumReturnAll))}>
                    {formatPercentage(aggregateStats.sumReturnAll)}
                  </td>
                  <td className="p-3 text-center text-green-600">
                    {getCountDisplay(aggregateStats.posCount, aggregateStats.posAccuracy)}
                  </td>
                  <td className="p-3 text-right text-green-600">
                    {formatPercentage(aggregateStats.avgReturnPos)}
                  </td>
                  <td className="p-3 text-right text-green-600">
                    {formatPercentage(aggregateStats.sumReturnPos)}
                  </td>
                  <td className="p-3 text-center text-red-600">
                    {getCountDisplay(aggregateStats.negCount, aggregateStats.negAccuracy)}
                  </td>
                  <td className="p-3 text-right text-red-600">
                    {formatPercentage(aggregateStats.avgReturnNeg)}
                  </td>
                  <td className="p-3 text-right text-red-600">
                    {formatPercentage(aggregateStats.sumReturnNeg)}
                  </td>
                </tr>
              )}
              
              {/* Individual Week Rows */}
              {filteredData.map((row) => (
                <tr key={row.week} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 sticky left-0 z-10 bg-white font-medium text-slate-900">
                    {viewMode === 'monthly' ? `Week ${row.week}` : `W${row.week}`}
                  </td>
                  <td className="p-3 text-center text-slate-600">
                    {row.allCount}
                  </td>
                  <td className={cn('p-3 text-right font-medium', getReturnColorClass(row.avgReturnAll))}>
                    {formatPercentage(row.avgReturnAll)}
                  </td>
                  <td className={cn('p-3 text-right', getReturnColorClass(row.sumReturnAll))}>
                    {formatPercentage(row.sumReturnAll)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-green-600">
                      {getCountDisplay(row.posCount, row.posAccuracy)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-green-600">
                    {formatPercentage(row.avgReturnPos)}
                  </td>
                  <td className="p-3 text-right text-green-600">
                    {formatPercentage(row.sumReturnPos)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-red-600">
                      {getCountDisplay(row.negCount, row.negAccuracy)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-red-600">
                    {formatPercentage(row.avgReturnNeg)}
                  </td>
                  <td className="p-3 text-right text-red-600">
                    {formatPercentage(row.sumReturnNeg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary footer */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredData.length} {viewMode === 'monthly' ? 'monthly' : 'yearly'} weeks
          </span>
          <span>
            {aggregateStats?.allCount ?? 0} total observations
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export type { WeeklyStatistics };
export default WeeklyDataTable;
