'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';

interface MonthlyReturnsMatrixProps {
  data: Record<string, Record<string, number>>;
  title?: string;
  showTotal?: boolean;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlyReturnsMatrix({
  data,
  title = 'Monthly Returns Matrix',
  showTotal = true,
}: MonthlyReturnsMatrixProps) {
  const years = Object.keys(data).sort((a, b) => parseInt(b) - parseInt(a));

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach((month) => {
      let sum = 0;
      let count = 0;
      years.forEach((year) => {
        if (data[year]?.[month] !== undefined) {
          sum += data[year][month];
          count++;
        }
      });
      totals[month] = count > 0 ? sum / count : 0;
    });
    return totals;
  }, [data, years]);

  const getColorClass = (value: number | undefined): string => {
    if (value === undefined) return '';
    if (value > 2) return 'bg-green-200 text-green-900';
    if (value > 0) return 'bg-green-100 text-green-800';
    if (value < -2) return 'bg-red-200 text-red-900';
    if (value < 0) return 'bg-red-100 text-red-800';
    return 'bg-gray-50';
  };

  const downloadCSV = () => {
    const headers = ['Year', ...months, 'Total'];
    const rows = years.map((year) => {
      const row = [year];
      months.forEach((month) => {
        row.push(data[year]?.[month]?.toFixed(2) || '');
      });
      row.push(data[year]?.Total?.toFixed(2) || '');
      return row;
    });
    
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monthly-returns.csv';
    a.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-semibold bg-muted">Year</th>
                {months.map((month) => (
                  <th key={month} className="p-2 text-center font-semibold bg-muted min-w-[60px]">
                    {month}
                  </th>
                ))}
                {showTotal && (
                  <th className="p-2 text-center font-semibold bg-muted min-w-[70px]">Total</th>
                )}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{year}</td>
                  {months.map((month) => {
                    const value = data[year]?.[month];
                    return (
                      <td
                        key={month}
                        className={cn('p-2 text-center', getColorClass(value))}
                      >
                        {value !== undefined ? formatPercentage(value) : '-'}
                      </td>
                    );
                  })}
                  {showTotal && (
                    <td
                      className={cn(
                        'p-2 text-center font-semibold',
                        getColorClass(data[year]?.Total)
                      )}
                    >
                      {data[year]?.Total !== undefined
                        ? formatPercentage(data[year].Total)
                        : '-'}
                    </td>
                  )}
                </tr>
              ))}
              
              {/* Average row */}
              <tr className="border-t-2 bg-muted/50">
                <td className="p-2 font-semibold">Average</td>
                {months.map((month) => (
                  <td
                    key={month}
                    className={cn('p-2 text-center font-semibold', getColorClass(columnTotals[month]))}
                  >
                    {formatPercentage(columnTotals[month])}
                  </td>
                ))}
                {showTotal && <td className="p-2"></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
