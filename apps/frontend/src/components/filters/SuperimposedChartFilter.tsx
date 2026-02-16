'use client';

import React from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export function SuperimposedChartFilter() {
  const { filters, setFilters } = useAnalysisStore();

  const superimposedChartType = filters.superimposedChartType || 'CalendarYearDays';
  const electionChartTypes = filters.electionChartTypes || ['All Years'];

  const handleChartTypeChange = (value: string) => {
    setFilters({
      ...filters,
      superimposedChartType: value as 'CalendarYearDays' | 'TradingYearDays' | 'CalendarMonthDays' | 'TradingMonthDays' | 'Weekdays',
    });
  };

  const handleElectionTypeToggle = (value: string) => {
    const currentTypes = [...electionChartTypes];
    const index = currentTypes.indexOf(value);
    
    if (index > -1) {
      // Remove if already selected (but keep at least one)
      if (currentTypes.length > 1) {
        currentTypes.splice(index, 1);
      }
    } else {
      // Add if not selected
      currentTypes.push(value);
    }
    
    setFilters({
      ...filters,
      electionChartTypes: currentTypes,
    });
  };

  const electionTypes = [
    'All Years',
    'Election Years',
    'Pre Election Years',
    'Post Election Years',
    'Mid Election Years',
    'Current Year',
    'Modi Years',
  ];

  return (
    <div className="space-y-3">
      {/* Superimposed Chart Type */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">
          Superimposed Chart Type
        </Label>
        <Select
          value={superimposedChartType}
          onValueChange={handleChartTypeChange}
        >
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="CalendarYearDays">Calendar Year Days</SelectItem>
            <SelectItem value="TradingYearDays">Trading Year Days</SelectItem>
            <SelectItem value="CalendarMonthDays">Calendar Month Days</SelectItem>
            <SelectItem value="TradingMonthDays">Trading Month Days</SelectItem>
            <SelectItem value="Weekdays">Weekdays</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-slate-500 italic">
          (Applies to Superimposed chart only)
        </p>
      </div>

      {/* Election Chart Type */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-600">
          Year Filter (All Charts)
        </Label>
        <div className="flex flex-wrap gap-3">
          {electionTypes.map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={electionChartTypes.includes(type)}
                onCheckedChange={() => handleElectionTypeToggle(type)}
              />
              <span className="text-xs">{type}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
