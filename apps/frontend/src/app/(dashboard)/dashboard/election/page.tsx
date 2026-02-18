'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  LayoutGrid, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/store/analysisStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { SymbolSelector, DateRangePicker } from '@/components/filters';
import { RightFilterConsole, FilterSection } from '@/components/layout/RightFilterConsole';
import { cn, formatPercentage, formatNumber } from '@/lib/utils';

const PRIMARY_COLOR = '#ef4444';

const electionTypes = [
  { key: 'All', label: 'All Years' },
  { key: 'Election', label: 'Election Years' },
  { key: 'PreElection', label: 'Pre-Election Years' },
  { key: 'PostElection', label: 'Post-Election Years' },
  { key: 'MidElection', label: 'Mid-Election Years' },
  { key: 'Modi', label: 'Modi Years' },
  { key: 'Current', label: 'Current Year' },
];

export default function ElectionPage() {
  const { selectedSymbols, startDate, endDate, filters, resetFilters } = useAnalysisStore();
  const [filterOpen, setFilterOpen] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['election-analysis', selectedSymbols, startDate, endDate, filters],
    queryFn: async () => {
      const response = await analysisApi.election({
        symbol: selectedSymbols[0],
        symbols: selectedSymbols,
        startDate,
        endDate,
        filters,
      });
      return response.data;
    },
    enabled: selectedSymbols.length > 0,
  });

  return (
    <div className="flex h-full bg-slate-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!filterOpen && (
              <button
                onClick={() => setFilterOpen(true)}
                className="p-1.5 hover:bg-slate-50 rounded transition-colors mr-2"
              >
                <ChevronRight className="h-4 w-4 text-slate-400 rotate-180" />
              </button>
            )}
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">Election Analysis</h1>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Political Cycle Data</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-slate-50 rounded-full transition-colors">
              <RefreshCw className="h-4 w-4 text-slate-400" />
            </button>
            <Button 
              onClick={() => refetch()} 
              disabled={isFetching}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loading size="lg" />
            </div>
          ) : data?.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1600px] mx-auto">
              {electionTypes.map(({ key, label }) => {
                const typeData = data.data[key]?.[selectedSymbols[0]];
                const stats = typeData?.statistics;
                
                if (!stats) return null;

                return (
                  <Card key={key} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Days</span>
                          <span className="font-medium">{stats.allCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg Return</span>
                          <span className={cn('font-medium', stats.avgReturnAll > 0 ? 'text-green-600' : 'text-red-600')}>
                            {formatPercentage(stats.avgReturnAll)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sum Return</span>
                          <span className={cn('font-medium', stats.sumReturnAll > 0 ? 'text-green-600' : 'text-red-600')}>
                            {formatPercentage(stats.sumReturnAll)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Positive Days</span>
                          <span className="font-medium text-green-600">{stats.posCount} ({formatNumber(stats.posAccuracy)}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Negative Days</span>
                          <span className="font-medium text-red-600">{stats.negCount} ({formatNumber(stats.negAccuracy)}%)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="max-w-[1600px] mx-auto">
              <CardContent className="py-20 text-center text-muted-foreground">
                <SlidersHorizontal className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium mb-2">Select a Symbol</p>
                <p className="text-sm text-slate-400">Choose a symbol from the filters and click Analyze to view election cycle analysis</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Right Filter Console */}
      <RightFilterConsole
        isOpen={filterOpen}
        onToggle={() => setFilterOpen(!filterOpen)}
        onApply={() => refetch()}
        onClear={resetFilters}
        isLoading={isFetching}
        title="Election Filters"
        subtitle="Configure Analysis"
        primaryColor={PRIMARY_COLOR}
      >
        <FilterSection title="Market Context" defaultOpen delay={0.1} icon={<LayoutGrid className="h-4 w-4" />}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block tracking-wide">Asset Class</label>
              <SymbolSelector />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Time Ranges" defaultOpen delay={0.15} icon={<Calendar className="h-4 w-4" />}>
          <div className="space-y-3">
            <DateRangePicker />
          </div>
        </FilterSection>
      </RightFilterConsole>
    </div>
  );
}
