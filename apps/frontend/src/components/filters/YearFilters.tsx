'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export function YearFilters() {
  const { filters, updateFilter } = useAnalysisStore();
  const yearFilters = filters.yearFilters || {};

  const decadeYears = yearFilters.decadeYears || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const toggleDecadeYear = (year: number) => {
    const newYears = decadeYears.includes(year)
      ? decadeYears.filter((y) => y !== year)
      : [...decadeYears, year].sort((a, b) => a - b);
    updateFilter('yearFilters', { decadeYears: newYears });
  };

  return (
    <div className="filter-section">
      <h3 className="text-lg font-semibold text-primary mb-4">Yearly Filters</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Positive/Negative Years</Label>
          <Select
            value={yearFilters.positiveNegativeYears || 'All'}
            onValueChange={(value) => updateFilter('yearFilters', { positiveNegativeYears: value as 'All' | 'Positive' | 'Negative' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Years</SelectItem>
              <SelectItem value="Positive">Positive Years only</SelectItem>
              <SelectItem value="Negative">Negative Years only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Years</Label>
          <Select
            value={yearFilters.evenOddYears || 'All'}
            onValueChange={(value) => updateFilter('yearFilters', { evenOddYears: value as 'All' | 'Even' | 'Odd' | 'Leap' | 'Election' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Years</SelectItem>
              <SelectItem value="Even">Even Years only</SelectItem>
              <SelectItem value="Odd">Odd Years only</SelectItem>
              <SelectItem value="Leap">Leap Years only</SelectItem>
              <SelectItem value="Election">Election Years only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label>Decade Years (Last digit of year)</Label>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((year) => (
            <label key={year} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={decadeYears.includes(year)}
                onCheckedChange={() => toggleDecadeYear(year)}
              />
              <span className="text-sm">{year === 10 ? '0' : year}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
