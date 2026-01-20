'use client';

import { useAnalysisStore } from '@/store/analysisStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DateRangePicker() {
  const { startDate, endDate, lastNDays, setDateRange, setLastNDays } = useAnalysisStore();

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setDateRange(e.target.value, endDate)}
        />
      </div>
      <div className="space-y-2">
        <Label>End Date</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setDateRange(startDate, e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Last N Days (0 to disable)</Label>
        <Input
          type="number"
          min={0}
          value={lastNDays}
          onChange={(e) => setLastNDays(parseInt(e.target.value) || 0)}
          placeholder="Enter 0 to use date range"
        />
      </div>
    </div>
  );
}
