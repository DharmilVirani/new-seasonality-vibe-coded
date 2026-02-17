'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  SlidersHorizontal,
  ChevronRight,
  Play,
  RefreshCw,
  X,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RightFilterConsoleProps {
  children: React.ReactNode;
  onApply: () => void;
  isLoading?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  subtitle?: string;
  primaryColor?: string;
}

export function RightFilterConsole({
  children,
  onApply,
  isLoading = false,
  isOpen,
  onToggle,
  title = "Filters",
  subtitle = "Configure Analysis",
  primaryColor = "#f59e0b"
}: RightFilterConsoleProps) {
  const [filterWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    onToggle();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !consoleRef.current) return;
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  return (
    <>
      {/* Floating Toggle Button - CSS only */}
      <AnimatePresence>
        {!isOpen && (
          <button
            onClick={handleToggle}
            className="fixed right-6 top-24 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
              }}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start pr-2">
              <span className="text-sm font-bold text-slate-800">{title}</span>
              <span className="text-[10px] text-slate-400 font-medium">Open console</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </AnimatePresence>

      {/* Right Filter Console - No animation */}
      <aside
        ref={consoleRef}
        style={{ 
          width: isOpen ? filterWidth : 0,
          boxShadow: isOpen ? '-4px 0 24px rgba(0,0,0,0.04)' : 'none'
        }}
        className={cn(
          "h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden relative flex-shrink-0",
          isResizing && "select-none"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex-shrink-0 h-16 border-b border-slate-100 flex items-center justify-between px-5 bg-gradient-to-br from-white via-white to-slate-50/50",
          !isOpen && "opacity-0 pointer-events-none"
        )}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
              }}
            >
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-800">{title}</h2>
              <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
            </div>
          </div>
          
          <button
            onClick={handleToggle}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Hide filters"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
          </button>
        </div>

        {/* Filter Content */}
        <div className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent",
          !isOpen && "opacity-0 pointer-events-none"
        )}>
          <div className="p-5 space-y-4">
            {children}
          </div>
        </div>

        {/* Apply Button Footer */}
        <div className={cn(
          "flex-shrink-0 p-5 border-t border-slate-100 bg-gradient-to-t from-slate-50/80 to-white",
          !isOpen && "opacity-0 pointer-events-none"
        )}>
          <button
            onClick={onApply}
            disabled={isLoading}
            className="w-full rounded-xl font-semibold py-3.5 px-4 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
            }}
          >
            <div className="flex items-center justify-center gap-2 text-white">
              {isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  <span className="text-sm">Apply Filters</span>
                </>
              )}
            </div>
          </button>
        </div>

        {/* Resize Handle */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-slate-300 transition-colors"
          />
        )}
      </aside>
    </>
  );
}

// Filter Section - Simplified
interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: string | number;
  delay?: number;
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
    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3.5 flex items-center justify-between transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
              {icon}
            </div>
          )}
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {title}
          </span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-600 rounded-md">
              {badge}
            </span>
          )}
        </div>
        <div 
          className="transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <div className="p-4 space-y-3">
            {children}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default RightFilterConsole;
