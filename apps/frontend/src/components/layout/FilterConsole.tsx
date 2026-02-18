'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  onClear?: () => void;
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
  onClear,
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
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Trigger resize for charts - fires AFTER sidebar animation completes
  const triggerChartResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Wait for sidebar animation to complete (350ms) then fire resize
    resizeTimeoutRef.current = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400); // Slightly longer than animation duration
  }, []);

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

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    triggerChartResize();
  }, [triggerChartResize]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseUp]);

  const handleToggle = () => {
    onToggle();
    triggerChartResize();
  };

  // Cleanup
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
      {/* Collapsed State - Floating Toggle Button - Smooth slide */}
      <button
        onClick={handleToggle}
        className="fixed left-[72px] top-24 z-40 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-r-lg shadow-md hover:shadow-lg transition-all duration-300 ease-out group"
        style={{
          borderLeft: 'none',
          transform: isOpen ? 'translateX(calc(-100% - 50px))' : 'translateX(0)',
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? 'none' : 'auto',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          {icon || <Settings2 className="h-4 w-4" />}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold text-slate-700">Filters</span>
          <span className="text-[10px] text-slate-400">Click to open</span>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
      </button>

      {/* Filter Console Sidebar - Ultra smooth width transition */}
      <aside
        ref={consoleRef}
        className={cn(
          "h-full bg-white border-r border-slate-200 flex flex-col overflow-hidden relative flex-shrink-0",
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
          className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-gradient-to-r from-white to-slate-50/50"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateX(0)' : 'translateX(-20px)',
            transition: isResizing 
              ? 'none' 
              : 'opacity 300ms ease 150ms, transform 350ms cubic-bezier(0.4, 0, 0.2, 1) 100ms',
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {icon || <Filter className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-slate-800 truncate">{title}</h2>
              <p className="text-[10px] text-slate-400 truncate">Configure analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onClear && (
              <button
                onClick={onClear}
                className="p-1.5 hover:bg-slate-100 rounded-md transition-colors group flex-shrink-0"
                title="Clear all filters"
              >
                <X className="h-4 w-4 text-slate-400 group-hover:text-red-500 transition-colors" />
              </button>
            )}
            <button
              onClick={handleToggle}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors group flex-shrink-0"
              title="Hide filters"
            >
              <ChevronLeft className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 250ms ease 200ms',
          }}
        >
          <div className="p-4 space-y-4">
            {children}
          </div>
        </div>

        {/* Apply Button Footer */}
        <div 
          className="flex-shrink-0 p-4 border-t border-slate-100 bg-slate-50/50 space-y-2"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: isResizing ? 'none' : 'opacity 250ms ease 250ms',
          }}
        >
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
          
          {onClear && (
            <Button
              onClick={onClear}
              disabled={isLoading}
              variant="outline"
              className="w-full py-2.5 rounded-lg border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" />
                <span>Clear Filters</span>
              </div>
            </Button>
          )}
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
      </aside>
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
        <div
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-3">
          {children}
        </div>
      )}
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
