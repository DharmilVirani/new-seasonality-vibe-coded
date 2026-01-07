'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDate, formatPercentage } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

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
        <Button variant="outline" size="sm" onClick={downloadCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr key={idx}>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.open.toFixed(2)}</td>
                  <td>{row.high.toFixed(2)}</td>
                  <td>{row.low.toFixed(2)}</td>
                  <td>{row.close.toFixed(2)}</td>
                  <td
                    className={cn(
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
