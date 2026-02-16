
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Loader2, 
  Table as TableIcon, 
  Calendar, 
  Hash, 
  FileSpreadsheet,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// Helper function to format date as dd/mm/yyyy
const formatDate = (dateString: string | Date): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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

  useEffect(() => {
    setPage(1);
  }, [timeframe]);

  const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG.daily;

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

  const totalPages = data?.pagination?.totalPages || 1;
  const totalRecords = data?.pagination?.total || 0;
  const records = data?.records || [];
  const columns = records.length > 0 ? Object.keys(records[0]).filter(k => k !== 'id' && k !== 'tickerId') : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          {/* Enhanced Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-md mt-7" 
            onClick={onClose} 
          />
          
          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative mt-7 bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full max-w-[90vw] h-[85vh] flex flex-col overflow-hidden border border-slate-200/50"
          >
            {/* Header - Glassmorphism style */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl z-20">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <TableIcon className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {symbol}
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {config.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mt-1.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-slate-400" />
                      {totalRecords.toLocaleString()} Records
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Updated {formatDate(new Date())}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                <Button 
                  variant="outline" 
                  onClick={handleDownloadCSV}
                  className="hidden sm:flex rounded-xl h-11 px-5 border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all active:scale-95"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <button 
                  onClick={onClose}
                  className="group h-11 w-11 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                >
                  <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
                </button>
              </div>
            </div>

            {/* Main Table Area */}
            <div className="flex-1 overflow-auto bg-slate-50/30 relative custom-scrollbar">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-4"
                  >
                    <div className="relative">
                       <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                       <div className="absolute inset-0 blur-xl bg-indigo-400/20 animate-pulse rounded-full"></div>
                    </div>
                    <p className="text-slate-500 font-semibold tracking-wide uppercase text-xs">Synchronizing Market Data...</p>
                  </motion.div>
                ) : error ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-4"
                  >
                    <div className="p-5 bg-rose-50 rounded-[2rem] text-rose-500 border border-rose-100">
                      <AlertCircle className="h-10 w-10" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-900 text-lg">System Error</p>
                      <p className="text-slate-500 max-w-xs mx-auto mt-1">We couldn't retrieve the market records. Please check your connection.</p>
                    </div>
                    <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">Try Again</Button>
                  </motion.div>
                ) : records.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-4"
                  >
                    <div className="p-6 bg-slate-100 rounded-[2rem] text-slate-300">
                      <FileSpreadsheet className="h-12 w-12" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">No Data Points</p>
                      <p className="text-slate-400 mt-1">The requested timeframe is currently empty.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="data"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="min-w-full"
                  >
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200/60 bg-white/90 backdrop-blur text-center w-20">
                            #
                          </th>
                          {columns.map(col => (
                            <th key={col} className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200/60 bg-white/90 backdrop-blur whitespace-nowrap text-left">
                              {formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {records.map((record: any, idx: number) => (
                          <motion.tr 
                            key={idx}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(idx * 0.01, 0.5) }}
                            className="group hover:bg-slate-50/80 transition-all border-b border-slate-100"
                          >
                            <td className="px-6 py-4 text-xs text-slate-400 text-center font-mono group-hover:text-indigo-400 transition-colors">
                              {((page - 1) * PAGE_SIZE + idx + 1).toString().padStart(3, '0')}
                            </td>
                            {columns.map(col => (
                              <td key={col} className="px-6 py-4 whitespace-nowrap border-b border-slate-50">
                                {formatCellValue(record[col], col)}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 border-t border-slate-100 bg-white z-20">
              <div className="text-sm font-medium text-slate-500 mb-4 sm:mb-0">
                <span className="text-slate-400 mr-2">Displaying</span> 
                <span className="text-slate-900 font-bold">{((page - 1) * PAGE_SIZE) + 1}</span> 
                <span className="text-slate-400 mx-1">-</span> 
                <span className="text-slate-900 font-bold">{Math.min(page * PAGE_SIZE, totalRecords)}</span> 
                <span className="text-slate-400 ml-2 font-normal">out of {totalRecords.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <PaginationButton 
                    onClick={() => setPage(1)} 
                    disabled={page === 1} 
                    icon={<ChevronsLeft className="h-4 w-4" />} 
                  />
                  <PaginationButton 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1} 
                    icon={<ChevronLeft className="h-4 w-4" />} 
                  />
                </div>
                
                <div className="flex items-center gap-2 px-4 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm min-w-[5rem] justify-center shadow-sm">
                  {page} <span className="text-indigo-300 font-medium px-1">/</span> {totalPages}
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <PaginationButton 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page >= totalPages} 
                    icon={<ChevronRight className="h-4 w-4" />} 
                  />
                  <PaginationButton 
                    onClick={() => setPage(totalPages)} 
                    disabled={page >= totalPages} 
                    icon={<ChevronsRight className="h-4 w-4" />} 
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Internal Helper Components
function PaginationButton({ onClick, disabled, icon }: { onClick: () => void, disabled: boolean, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 flex items-center justify-center rounded-lg bg-white text-slate-500 border border-slate-200/50 shadow-sm hover:text-indigo-600 hover:border-indigo-100 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
    >
      {icon}
    </button>
  );
}

function formatColumnName(col: string): string {
  return col
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatCellValue(value: any, column: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-200">/</span>;
  
  if (column.toLowerCase().includes('date') || column === 'createdAt' || column === 'updatedAt') {
    try {
      const date = new Date(value);
      return (
        <div className="flex items-center gap-2">
          <span className="text-slate-600 font-medium">
            {formatDate(date)}
          </span>
        </div>
      );
    } catch {
      return String(value);
    }
  }
  
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
        True
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase">
        False
      </span>
    );
  }
  
  if (typeof value === 'number') {
    const isStat = column.toLowerCase().includes('percentage') || column.toLowerCase().includes('return') || column.toLowerCase().includes('change');
    
    if (isStat) {
      const isPositive = value > 0;
      const isNegative = value < 0;
      const formatted = value.toFixed(2);
      
      if (isPositive) return <span className="text-emerald-600 font-bold font-mono">+{formatted}</span>;
      if (isNegative) return <span className="text-rose-600 font-bold font-mono">{formatted}</span>;
      return <span className="text-slate-400 font-mono">{formatted}</span>;
    }
    
    const formattedNum = Number.isInteger(value) 
      ? (value > 9999 ? value.toLocaleString() : value) 
      : value.toFixed(2);

    return <span className="text-slate-700 font-mono font-medium">{formattedNum}</span>;
  }
  
  return <span className="text-slate-600 font-medium">{String(value)}</span>;
}
