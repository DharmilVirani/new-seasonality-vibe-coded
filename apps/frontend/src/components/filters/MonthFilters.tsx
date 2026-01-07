'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

const months = [
  'Disable', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function MonthFilters() {
  const { filters, updateFilter } = useAnalysisStore();
  const monthFilters = filters.monthFilters || {};

  return (
    <div className="filter-section">
      <h3 className="text-lg font-semibold text-primary mb-4">Monthly Filters</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Positive/Negative Months</Label>
          <Select
            value={monthFilters.positiveNegativeMonths || 'All'}
            onValueChange={(value) => updateFilter('monthFilters', { positiveNegativeMonths: value as 'All' | 'Positive' | 'Negative' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Months</SelectItem>
              <SelectItem value="Positive">Positive Months only</SelectItem>
              <SelectItem value="Negative">Negative Months only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Months</Label>
          <Select
            value={monthFilters.evenOddMonths || 'All'}
            onValueChange={(value) => updateFilter('monthFilters', { evenOddMonths: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Months</SelectItem>
              <SelectItem value="Even">Even Months only</SelectItem>
              <SelectItem value="Odd">Odd Months only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label>Specific Month: {months[monthFilters.specificMonth || 0]}</Label>
        <Slider
          value={[monthFilters.specificMonth || 0]}
          onValueChange={([value]) => updateFilter('monthFilters', { specificMonth: value })}
          min={0}
          max={12}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          {months.map((m, i) => (
            <span key={i}>{m.slice(0, 1)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
