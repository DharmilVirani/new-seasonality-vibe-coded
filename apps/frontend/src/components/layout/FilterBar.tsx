'use client';

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  X,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';

interface FilterBarProps {
  isOpen: boolean;
  onToggle: () => void;
  onApply: () => void;
  onClear: () => void;
  isLoading?: boolean;
  primaryColor?: string;
  children: React.ReactNode;
}

export function FilterBar({
  isOpen,
  onToggle,
  onApply,
  onClear,
  isLoading = false,
  primaryColor = '#10b981',
  children
}: FilterBarProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = () => {
    setIsAnimating(true);
    onToggle();
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Bar - Always Visible */}
      <div 
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
          "hover:bg-slate-50 border-b border-slate-100",
          isOpen && "bg-slate-50"
        )}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-gradient-to-br from-emerald-500 to-emerald-600"
          )}>
            <Filter className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
            <p className="text-[10px] text-slate-400">Configure pattern search</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            onClick={onApply}
            disabled={isLoading}
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">Run Scanner</span>
          </Button>
          
          <button
            onClick={handleToggle}
            className={cn(
              "ml-2 p-2 rounded-lg transition-all duration-200",
              "hover:bg-slate-100 text-slate-500",
              isOpen && "rotate-180"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 bg-slate-50/50">
          {children}
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100">
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Clear all filters
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Collapse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export FilterSection for backward compatibility
export { FilterSection } from './RightFilterConsole';

export default FilterBar;
