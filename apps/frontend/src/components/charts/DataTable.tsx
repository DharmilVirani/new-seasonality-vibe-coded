'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDate, formatPercentage } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { MetricTooltip } from '@/components/ui/MetricTooltip';

interface DataTableProps {
  data: Array<{
    date: string | Date;
    open: number;
    high: number;
    low: number;
    close: number;
    returnPercentage?: number;
    [key: string]: unknown;
  }>;
  title?: string;
  pageSize?: number;
}

export function DataTable({ data, title = 'Data Table', pageSize = 20 }: DataTableProps) {
  const [page, setPage] = useState(0);
  
  if (!data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading data...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(page * pageSize, (page + 1) * pageSize);

  const downloadCSV = () => {
    const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Return %'];
    const rows = data.map((row) => [
      formatDate(row.date),
      row.open,
      row.high,
      row.low,
      row.close,
      row.returnPercentage?.toFixed(2) || '',
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seasonality-data.csv';
    a.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">
                  <span className="inline-flex items-center">
                    Date
                    <MetricTooltip metric="year" />
                  </span>
                </th>
                <th className="text-right">Open</th>
                <th className="text-right">High</th>
                <th className="text-right">Low</th>
                <th className="text-right">Close</th>
                <th className="text-right">
                  <span className="inline-flex items-center">
                    Return %
                    <MetricTooltip metric="returnPercentage" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr key={idx}>
                  <td>{formatDate(row.date)}</td>
                  <td className="text-right">{row.open.toFixed(2)}</td>
                  <td className="text-right">{row.high.toFixed(2)}</td>
                  <td className="text-right">{row.low.toFixed(2)}</td>
                  <td className="text-right">{row.close.toFixed(2)}</td>
                  <td
                    className={cn(
                      "text-right",
                      row.returnPercentage && row.returnPercentage > 0
                        ? 'text-green-600'
                        : row.returnPercentage && row.returnPercentage < 0
                        ? 'text-red-600'
                        : ''
                    )}
                  >
                    {row.returnPercentage !== undefined
                      ? formatPercentage(row.returnPercentage)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} ({data.length} records)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
