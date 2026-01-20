'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const months = [
  'Disable', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthFiltersProps {
  isCompact?: boolean;
}

export function MonthFilters({ isCompact = false }: MonthFiltersProps) {
  const { filters, updateFilter } = useAnalysisStore();
  const monthFilters = filters.monthFilters || {};

  return (
    <div className="filter-section">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Positive/Negative</Label>
          <Select
            value={monthFilters.positiveNegativeMonths || 'All'}
            onValueChange={(value) => updateFilter('monthFilters', { positiveNegativeMonths: value as 'All' | 'Positive' | 'Negative' })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Even/Odd</Label>
          <Select
            value={monthFilters.evenOddMonths || 'All'}
            onValueChange={(value) => updateFilter('monthFilters', { evenOddMonths: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Even">Even</SelectItem>
              <SelectItem value="Odd">Odd</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Specific Month</Label>
          <Select
            value={String(monthFilters.specificMonth || 0)}
            onValueChange={(value) => updateFilter('monthFilters', { specificMonth: parseInt(value) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {months.map((month, index) => (
                <SelectItem key={index} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
