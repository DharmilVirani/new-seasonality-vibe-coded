'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDate, formatPercentage } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Download, HelpCircle } from 'lucide-react';

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
                  <HeaderTooltip 
                    label="Date" 
                    formula="Trading Date" 
                    description="The date of the trading session"
                  />
                </th>
                <th className="text-right">
                  <HeaderTooltip 
                    label="Open" 
                    formula="Opening Price" 
                    description="Price at market open"
                  />
                </th>
                <th className="text-right">
                  <HeaderTooltip 
                    label="High" 
                    formula="Highest Price" 
                    description="Maximum price reached during the day"
                  />
                </th>
                <th className="text-right">
                  <HeaderTooltip 
                    label="Low" 
                    formula="Lowest Price" 
                    description="Minimum price reached during the day"
                  />
                </th>
                <th className="text-right">
                  <HeaderTooltip 
                    label="Close" 
                    formula="Closing Price" 
                    description="Price at market close"
                  />
                </th>
                <th className="text-right">
                  <HeaderTooltip 
                    label="Return %" 
                    formula="(Close - Prev Close) ÷ Prev Close × 100" 
                    description="Percentage change from previous close"
                  />
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
