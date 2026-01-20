'use client';

import { useEffect, useState } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpecialDay {
  name: string;
  category: string;
  country: string;
}

export function SpecialDaysFilter() {
  const { filters, updateFilter } = useAnalysisStore();
  const specialDaysFilters = filters.specialDaysFilters || {};
  const selectedSpecialDays = specialDaysFilters.selectedDays || [];
  
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecialDays();
  }, []);

  const fetchSpecialDays = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/special-days`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch special days');
      }

      const data = await response.json();
      setSpecialDays(data.data || []);
    } catch (err) {
      console.error('Error fetching special days:', err);
      setError('Failed to load special days');
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialDay = (dayName: string) => {
    const newDays = selectedSpecialDays.includes(dayName)
      ? selectedSpecialDays.filter((d: string) => d !== dayName)
      : [...selectedSpecialDays, dayName];
    updateFilter('specialDaysFilters', { selectedDays: newDays });
  };

  const clearAllSpecialDays = () => {
    updateFilter('specialDaysFilters', { selectedDays: [] });
  };

  const selectAllSpecialDays = () => {
    const allDayNames = filteredSpecialDays.map(day => day.name);
    updateFilter('specialDaysFilters', { selectedDays: allDayNames });
  };

  const filteredSpecialDays = specialDays.filter(day =>
    day.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const groupedByCategory = filteredSpecialDays.reduce((acc, day) => {
    const category = day.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(day);
    return acc;
  }, {} as Record<string, SpecialDay[]>);

  const categoryLabels: Record<string, string> = {
    'FESTIVAL': '🎉 Festivals',
    'HOLIDAY': '🏖️ Holidays',
    'NATIONAL_HOLIDAY': '🇮🇳 National Holidays',
    'BUDGET': '💰 Budget Days',
    'ELECTION': '🗳️ Election Days',
  };

  if (loading) {
    return (
      <div className="filter-section">
        <h3 className="text-lg font-semibold text-primary mb-4">Special Days Filter</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading special days...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="filter-section">
        <h3 className="text-lg font-semibold text-primary mb-4">Special Days Filter</h3>
        <div className="text-sm text-red-500 py-4">
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchSpecialDays}
            className="ml-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="filter-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Special Days Filter</h3>
        {selectedSpecialDays.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {selectedSpecialDays.length} selected
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search special days..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllSpecialDays}
            disabled={filteredSpecialDays.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllSpecialDays}
            disabled={selectedSpecialDays.length === 0}
          >
            Clear All
          </Button>
        </div>

        {/* Special Days List - Grouped by Category */}
        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {Object.entries(groupedByCategory).map(([category, days]) => (
            <div key={category} className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-1">
                {categoryLabels[category] || category}
              </div>
              <div className="space-y-2 pl-2">
                {days.map((day) => (
                  <label
                    key={day.name}
                    className="flex items-start gap-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors"
                  >
                    <Checkbox
                      checked={selectedSpecialDays.includes(day.name)}
                      onCheckedChange={() => toggleSpecialDay(day.name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {day.name.replace('USA : ', '').replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.country}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {filteredSpecialDays.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No special days found
            </div>
          )}
        </div>

        {/* Selected Days Summary */}
        {selectedSpecialDays.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm font-medium mb-2">Selected Days:</div>
            <div className="flex flex-wrap gap-2">
              {selectedSpecialDays.map((dayName: string) => (
                <Badge
                  key={dayName}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => toggleSpecialDay(dayName)}
                >
                  {dayName.replace('USA : ', '').replace(/_/g, ' ')}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
