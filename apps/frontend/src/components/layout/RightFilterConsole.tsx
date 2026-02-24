'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  onClear?: () => void;
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
  onClear,
  isLoading = false,
  isOpen,
  onToggle,
  title = "Filters",
  subtitle = "Configure Analysis",
  primaryColor = "#2563eb"
}: RightFilterConsoleProps) {
  const [filterWidth, setFilterWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const triggerChartResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
  }, []);

  const handleToggle = () => {
    onToggle();
    triggerChartResize();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    triggerChartResize();
  }, [triggerChartResize]);

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
  }, [isResizing, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={handleToggle}
        className="fixed right-6 top-24 z-50 flex items-center gap-3 px-5 py-4 bg-white border-2 border-slate-300 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 ease-out"
        style={{
          transform: isOpen ? 'translateX(calc(100% + 120px))' : 'translateX(0)',
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'auto',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
          }}
        >
          <SlidersHorizontal className="h-6 w-6" />
        </div>
        <div className="flex flex-col items-start pr-2">
          <span className="text-base font-bold text-slate-800">{title}</span>
          <span className="text-xs text-slate-500 font-semibold">Open console</span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
      </button>

      {/* Right Filter Console */}
      <aside
        ref={consoleRef}
        className={cn(
          "h-full bg-white border-l-2 border-slate-200 flex flex-col overflow-hidden relative flex-shrink-0",
          isResizing && "select-none"
        )}
        style={{
          width: isOpen ? filterWidth : 0,
          opacity: isOpen ? 1 : 0,
          transition: isResizing 
            ? 'none' 
            : 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease 100ms',
          contain: 'layout style paint',
        }}
      >
        {/* Header */}
        <div 
          className="flex-shrink-0 h-20 border-b-2 border-slate-100 flex items-center justify-between px-6 bg-gradient-to-br from-white via-white to-slate-50/50"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateX(0)' : 'translateX(20px)',
            transition: isResizing 
              ? 'none' 
              : 'opacity 300ms ease 150ms, transform 350ms cubic-bezier(0.4, 0, 0.2, 1) 100ms',
          }}
        >
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
              }}
            >
              <Settings2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-slate-800 truncate">{title}</h2>
              <p className="text-xs text-slate-500 font-semibold truncate">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onClear && (
              <button
                onClick={onClear}
                className="p-2.5 hover:bg-red-50 rounded-xl transition-colors flex-shrink-0 border-2 border-transparent hover:border-red-200"
                title="Clear all filters"
              >
                <RefreshCw className="h-5 w-5 text-slate-500 hover:text-red-500 transition-colors" />
              </button>
            )}
            <button
              onClick={handleToggle}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0 border-2 border-transparent hover:border-slate-200"
              title="Hide filters"
            >
              <X className="h-5 w-5 text-slate-500 hover:text-slate-700 transition-colors" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 250ms ease 200ms',
          }}
        >
          <div className="p-6 space-y-5">
            {children}
          </div>
        </div>

        {/* Apply Button Footer */}
        <div 
          className="flex-shrink-0 p-6 border-t-2 border-slate-100 bg-gradient-to-t from-slate-50/80 to-white space-y-3"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 250ms ease 250ms',
          }}
        >
          <button
            onClick={onApply}
            disabled={isLoading}
            className="w-full rounded-xl font-bold py-4 px-5 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-base"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`,
            }}
          >
            <div className="flex items-center justify-center gap-3 text-white">
              {isLoading ? (
                <>
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="h-6 w-6 fill-current" />
                  <span>Apply Filters</span>
                </>
              )}
            </div>
          </button>
          
          {onClear && (
            <button
              onClick={onClear}
              disabled={isLoading}
              className="w-full rounded-xl font-bold py-3.5 px-5 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 text-sm"
            >
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5" />
                <span>Clear All Filters</span>
              </div>
            </button>
          )}
        </div>

        {/* Resize Handle */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-slate-300 transition-colors"
          />
        )}
      </aside>
    </>
  );
}

// Filter Section
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
    <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              {icon}
            </div>
          )}
          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            {title}
          </span>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-bold bg-slate-200 text-slate-700 rounded-md">
              {badge}
            </span>
          )}
        </div>
        <div 
          style={{ 
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </div>
      </button>
      
      {isOpen && (
        <div className="p-5 space-y-4 bg-slate-50/30">
          {children}
        </div>
      )}
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
