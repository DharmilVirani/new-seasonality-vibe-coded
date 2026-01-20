'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

export function WeekFilters({ weekType = 'expiry' }: { weekType?: 'expiry' | 'monday' }) {
  const { filters, updateFilter } = useAnalysisStore();
  const weekFilters = filters.weekFilters || {};

  const title = weekType === 'expiry' ? 'Expiry Weekly Filters' : 'Monday Weekly Filters';

  return (
    <div className="filter-section">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label>Positive/Negative Weeks</Label>
          <Select
            value={weekFilters.positiveNegativeWeeks || 'All'}
            onValueChange={(value) => updateFilter('weekFilters', { positiveNegativeWeeks: value as 'All' | 'Positive' | 'Negative' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="All">All Weeks</SelectItem>
              <SelectItem value="Positive">Positive Weeks only</SelectItem>
              <SelectItem value="Negative">Negative Weeks only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Weeks (Monthly)</Label>
          <Select
            value={weekFilters.evenOddWeeksMonthly || 'All'}
            onValueChange={(value) => updateFilter('weekFilters', { evenOddWeeksMonthly: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="All">All Weeks</SelectItem>
              <SelectItem value="Even">Even Weeks only</SelectItem>
              <SelectItem value="Odd">Odd Weeks only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Specific Week (Monthly): {weekFilters.specificWeekMonthly || 'Disabled'}</Label>
          <Slider
            value={[weekFilters.specificWeekMonthly || 0]}
            onValueChange={([value]) => updateFilter('weekFilters', { specificWeekMonthly: value })}
            min={0}
            max={5}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <Label>Even/Odd Weeks (Yearly)</Label>
          <Select
            value={weekFilters.evenOddWeeksYearly || 'All'}
            onValueChange={(value) => updateFilter('weekFilters', { evenOddWeeksYearly: value as 'All' | 'Even' | 'Odd' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="All">All Weeks</SelectItem>
              <SelectItem value="Even">Even Weeks only</SelectItem>
              <SelectItem value="Odd">Odd Weeks only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
