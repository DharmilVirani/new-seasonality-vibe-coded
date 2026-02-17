'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Play,
  RefreshCw,
  Settings2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FilterConsoleProps {
  children: React.ReactNode;
  onApply: () => void;
  isLoading?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  icon?: React.ReactNode;
  primaryColor?: string;
}

export function FilterConsole({
  children,
  onApply,
  isLoading = false,
  isOpen,
  onToggle,
  title = "Filter Console",
  icon,
  primaryColor = "#f59e0b"
}: FilterConsoleProps) {
  const [filterWidth, setFilterWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !consoleRef.current) return;
    const rect = consoleRef.current.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    if (newWidth >= 260 && newWidth <= 450) {
      setFilterWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <>
      {/* Collapsed State - Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
            className="fixed left-[72px] top-24 z-40 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-r-lg shadow-md hover:shadow-lg transition-shadow group"
            style={{ 
              borderLeft: 'none',
            }}
          >
            <div 
              className="w-8 h-8 rounded-md flex items-center justify-center text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {icon || <Settings2 className="h-4 w-4" />}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-semibold text-slate-700">Filters</span>
              <span className="text-[10px] text-slate-400">Click to open</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Filter Console Sidebar */}
      <motion.aside
        ref={consoleRef}
        initial={false}
        animate={{ 
          width: isOpen ? filterWidth : 0,
          opacity: isOpen ? 1 : 0
        }}
        transition={{ 
          width: isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.2 }
        }}
        className={cn(
          "h-full bg-white border-r border-slate-200 flex flex-col overflow-hidden relative flex-shrink-0",
          isResizing && "select-none"
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-gradient-to-r from-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {icon || <Filter className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-800">{title}</h2>
              <p className="text-[10px] text-slate-400">Configure analysis</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors group"
            title="Hide filters"
          >
            <ChevronLeft className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 space-y-4">
            {children}
          </div>
        </div>

        {/* Apply Button Footer */}
        <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            onClick={onApply}
            disabled={isLoading}
            className="w-full text-white font-semibold py-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            style={{ backgroundColor: primaryColor }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = adjustColor(primaryColor, -20);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Play className="h-4 w-4 fill-current" />
                <span>Apply Filters</span>
              </div>
            )}
          </Button>
        </div>

        {/* Resize Handle */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10",
              isResizing ? "bg-slate-400" : "bg-transparent hover:bg-slate-300"
            )}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 -mr-2 h-12 cursor-col-resize" />
          </div>
        )}
      </motion.aside>
    </>
  );
}

// Filter Section Component
interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: string;
}

export function FilterSection({ 
  title, 
  children, 
  defaultOpen = true,
  icon,
  badge
}: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between transition-all duration-200",
          isOpen ? "bg-slate-50/80 border-b border-slate-100" : "bg-white hover:bg-slate-50"
        )}
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
              {icon}
            </div>
          )}
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-600 rounded">
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default FilterConsole;
