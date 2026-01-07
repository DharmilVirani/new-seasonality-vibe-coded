'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

export function OutlierFilters() {
  const { filters, updateFilter } = useAnalysisStore();
  const outlierFilters = filters.outlierFilters || {};

  const updateRange = (
    key: 'dailyPercentageRange' | 'weeklyPercentageRange' | 'monthlyPercentageRange' | 'yearlyPercentageRange',
    updates: Partial<{ enabled: boolean; min: number; max: number }>
  ) => {
    updateFilter('outlierFilters', {
      [key]: {
        ...outlierFilters[key],
        ...updates,
      },
    });
  };

  const ranges = [
    { key: 'dailyPercentageRange' as const, label: 'Daily', min: -5, max: 5 },
    { key: 'weeklyPercentageRange' as const, label: 'Weekly', min: -15, max: 15 },
    { key: 'monthlyPercentageRange' as const, label: 'Monthly', min: -25, max: 25 },
    { key: 'yearlyPercentageRange' as const, label: 'Yearly', min: -50, max: 50 },
  ];

  return (
    <div className="filter-section">
      <h3 className="text-lg font-semibold text-primary mb-4">
        Percentage Change Range - Remove Outliers
      </h3>
      
      <div className="grid grid-cols-2 gap-6">
        {ranges.map(({ key, label, min, max }) => {
          const range = outlierFilters[key] || { enabled: false, min, max };
          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch
                  checked={range.enabled}
                  onCheckedChange={(enabled) => updateRange(key, { enabled })}
                />
              </div>
              <Slider
                value={[range.min, range.max]}
                onValueChange={([newMin, newMax]) => updateRange(key, { min: newMin, max: newMax })}
                min={min}
                max={max}
                step={1}
                disabled={!range.enabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{range.min}%</span>
                <span>{range.max}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
