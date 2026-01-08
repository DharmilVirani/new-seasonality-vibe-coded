'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface DataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
}

const TIMEFRAME_CONFIG: Record<string, { name: string; endpoint: string }> = {
  daily: { name: 'Daily Data', endpoint: 'daily' },
  mondayWeekly: { name: 'Monday Weekly', endpoint: 'monday-weekly' },
  expiryWeekly: { name: 'Expiry Weekly', endpoint: 'expiry-weekly' },
  monthly: { name: 'Monthly Data', endpoint: 'monthly' },
  yearly: { name: 'Yearly Data', endpoint: 'yearly' },
};

const PAGE_SIZE = 100;

export function DataViewerModal({ isOpen, onClose, symbol, timeframe }: DataViewerModalProps) {
  const [page, setPage] = useState(1);

  // Reset page when timeframe changes
  useEffect(() => {
    setPage(1);
  }, [timeframe]);

  const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG.daily;

  // Fetch data for the timeframe
  const { data, isLoading, error } = useQuery({
    queryKey: ['table-data', symbol, timeframe, page],
    queryFn: async () => {
      const response = await api.get(`/analysis/symbols/${symbol}/${config.endpoint}`, {
        params: { page, limit: PAGE_SIZE }
      });
      return response.data.data;
    },
    enabled: isOpen && !!symbol,
  });

  const handleDownloadCSV = async () => {
    try {
      const response = await api.get(`/analysis/symbols/${symbol}/${config.endpoint}/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${symbol}_${timeframe}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (!isOpen) return null;

  const totalPages = data?.pagination?.totalPages || 1;
  const totalRecords = data?.pagination?.total || 0;
  const records = data?.records || [];

  // Get column headers from first record
  const columns = records.length > 0 ? Object.keys(records[0]).filter(k => k !== 'id' && k !== 'tickerId') : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">{symbol} - {config.name}</h2>
            <p className="text-sm text-gray-500">{totalRecords.toLocaleString()} total records</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              Failed to load data
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available for this timeframe
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 border">#</th>
                    {columns.map(col => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 border whitespace-nowrap">
                        {formatColumnName(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border text-gray-500">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      {columns.map(col => (
                        <td key={col} className="px-3 py-2 border whitespace-nowrap">
                          {formatCellValue(record[col], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatColumnName(col: string): string {
  return col
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatCellValue(value: any, column: string): string {
  if (value === null || value === undefined) return '-';
  
  if (column.toLowerCase().includes('date') || column === 'createdAt' || column === 'updatedAt') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  
  if (typeof value === 'number') {
    if (column.toLowerCase().includes('percentage') || column.toLowerCase().includes('return')) {
      return value.toFixed(2) + '%';
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }
  
  return String(value);
}
