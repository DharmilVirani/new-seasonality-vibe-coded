'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Download } from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';

interface MonthlyVsYearlyTableProps {
  data: Array<{
    date: string;
    returnPercentage?: number;
    [key: string]: unknown;
  }>;
  symbol: string;
}

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function MonthlyVsYearlyTable({ data, symbol }: MonthlyVsYearlyTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [dayRange, setDayRange] = useState<[number, number]>([1, 5]);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const tableData = useMemo(() => {
    if (!data || data.length === 0) return { rows: [], columns: [] };

    const targetMonth = selectedMonth;
    const [startDay, endDay] = dayRange;
    const totalDays = endDay - startDay + 1;

    // Group data by year and get first occurrence of target month
    const firstDayOfMonthByYear: Record<string, { date: string; index: number; returnPercentage?: number }> = {};
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedData.forEach((row: any, idx: number) => {
      const date = new Date(row.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      if (month === targetMonth && !firstDayOfMonthByYear[year]) {
        firstDayOfMonthByYear[year] = {
          date: row.date,
          index: idx,
          returnPercentage: row.returnPercentage
        };
      }
    });

    // For each year, get returns for the day range after first day of month
    const rows = Object.entries(firstDayOfMonthByYear)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .map(([year, firstDay]) => {
        const returns: number[] = [];
        
        // Get returns for the range of days
        for (let i = startDay - 1; i < endDay; i++) {
          const dayIndex = firstDay.index + i + 1;
          if (dayIndex < sortedData.length) {
            returns.push(sortedData[dayIndex].returnPercentage || 0);
          } else {
            returns.push(0);
          }
        }

        // Calculate cumulative return for the range
        const cumulativeReturn = returns.reduce((a, b) => a + b, 0);
        const avg = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        
        return {
          year,
          returns,
          cumulative: cumulativeReturn,
          avg,
          count: returns.length,
        };
      });

    // Generate column headers: Year, T+1, T+2, ..., Cumulative, Avg, Count
    const columns = ['Year', ...Array.from({ length: totalDays }, (_, i) => `T+${startDay + i}`), 'Cumulative', 'Avg', 'Count'];

    return { rows, columns, totalDays, startDay };
  }, [data, selectedMonth, dayRange]);

  const totalPages = Math.ceil(tableData.rows.length / pageSize);
  const paginatedRows = tableData.rows.slice(page * pageSize, (page + 1) * pageSize);

  const getColorClass = (value: number): string => {
    if (value > 2) return 'bg-green-100 text-green-800';
    if (value > 0) return 'bg-green-50 text-green-700';
    if (value < -2) return 'bg-red-100 text-red-800';
    if (value < 0) return 'bg-red-50 text-red-700';
    return 'text-slate-600';
  };

  const downloadCSV = () => {
    const [startDay, endDay] = dayRange;
    const totalDays = endDay - startDay + 1;
    const headers = ['Year', ...Array.from({ length: totalDays }, (_, i) => `T+${startDay + i}`), 'Cumulative', 'Average', 'Count'];
    const rows = paginatedRows.map((row: any) => [
      row.year,
      ...row.returns.map((r: number) => r.toFixed(2)),
      row.cumulative.toFixed(2),
      row.avg.toFixed(2),
      row.count,
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_monthly_vs_yearly_${months[selectedMonth - 1].label}.csv`;
    a.click();
  };

  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">No data available</div>;
  }

  return (
    <div className="p-4">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Month:</span>
          <Select value={String(selectedMonth)} onValueChange={(v) => { setSelectedMonth(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Days Range:</span>
          <div className="w-48">
            <Slider
              value={dayRange}
              onValueChange={(v) => { setDayRange(v as [number, number]); setPage(0); }}
              min={1}
              max={20}
              step={1}
            />
          </div>
          <span className="text-sm text-slate-500 w-16">
            T+{dayRange[0]} to T+{dayRange[1]}
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={downloadCSV} className="ml-auto">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              {tableData.columns?.map((col) => (
                <th key={col} className="px-3 py-2 text-center font-semibold text-slate-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row: any) => (
              <tr key={row.year} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-center font-medium text-slate-700">{row.year}</td>
                {Array.from({ length: tableData.totalDays || 1 }).map((_, i) => (
                  <td key={i} className={cn("px-3 py-2 text-center", getColorClass(row.returns[i] || 0))}>
                    {row.returns[i]?.toFixed(2) || '-'}
                  </td>
                ))}
                <td className={cn("px-3 py-2 text-center font-medium", getColorClass(row.cumulative))}>
                  {row.cumulative.toFixed(2)}
                </td>
                <td className={cn("px-3 py-2 text-center font-medium", getColorClass(row.avg))}>
                  {row.avg.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, tableData.rows.length)} of {tableData.rows.length} years
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
