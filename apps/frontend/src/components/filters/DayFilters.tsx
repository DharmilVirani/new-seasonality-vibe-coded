'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function DayFilters() {
  const { filters, updateFilter } = useAnalysisStore();
  const dayFilters = filters.dayFilters || {};
  const selectedWeekdays = dayFilters.weekdays || weekdays;

  const toggleWeekday = (day: string) => {
    const newDays = selectedWeekdays.includes(day)
      ? selectedWeekdays.filter((d) => d !== day)
      : [...selectedWeekdays, day];
    updateFilter('dayFilters', { weekdays: newDays });
  };

  return (
    <div className="filter-section">
      <h3 className="text-lg font-semibold text-primary mb-4">Daily Filters</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Positive/Negative Days</Label>
          <Select
            value={dayFilters.positiveNegativeDays || 'All'}
            onValueChange={(value) => updateFilter('dayFilters', { positiveNegativeDays: value as 'All' | 'Positive' | 'Negative' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Days</SelectItem>
              <SelectItem value="Positive">Positive Days only</SelectItem>
              <SelectItem value="Negative">Negative Days only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Weekdays</Label>
          <div className="flex flex-wrap gap-3">
            {weekdays.map((day) => (
              <label key={day} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedWeekdays.includes(day)}
                  onCheckedChange={() => toggleWeekday(day)}
                />
                <span className="text-sm">{day.slice(0, 3)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Calendar Days (Monthly)</Label>
          <Select
            value={dayFilters.evenOddCalendarDaysMonthly || 'All'}
            onValueChange={(value) => updateFilter('dayFilters', { evenOddCalendarDaysMonthly: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Days</SelectItem>
              <SelectItem value="Even">Even Days only</SelectItem>
              <SelectItem value="Odd">Odd Days only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Trading Days (Monthly)</Label>
          <Select
            value={dayFilters.evenOddTradingDaysMonthly || 'All'}
            onValueChange={(value) => updateFilter('dayFilters', { evenOddTradingDaysMonthly: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Days</SelectItem>
              <SelectItem value="Even">Even Days only</SelectItem>
              <SelectItem value="Odd">Odd Days only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
