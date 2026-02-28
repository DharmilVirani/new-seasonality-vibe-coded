'use client';

import React, { useState } from 'react';
import {
  Filter,
  ChevronDown,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FilterRowProps {
  onOpenFilters: () => void;
  children: React.ReactNode;
}

export function FilterRow({ onOpenFilters, children }: FilterRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      {children}
      <div className="h-8 w-px bg-slate-200 mx-1" />
      <Button
        onClick={onOpenFilters}
        variant="outline"
        size="sm"
        className="gap-2 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </Button>
    </div>
  );
}

export default FilterRow;
