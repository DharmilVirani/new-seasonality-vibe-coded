'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analysisApi, BasketGroupDto } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

type BasketRow = Record<string, string | number | null>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_UPPER = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const MAX_SYMBOLS = 50;

function SelectField({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
      />
    </label>
  );
}

function DataTable({ title, rows }: { title: string; rows: BasketRow[] }) {
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-white/80 pb-3">
        <CardTitle className="text-xl font-semibold text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="m-4 rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-base text-slate-500">
            No rows returned for this section.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[15px]">
              <thead className="bg-slate-100 border-y border-slate-200">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/30 hover:bg-slate-100/60 transition-colors">
                    {columns.map((col) => {
                      const value = row[col];
                      const numeric = typeof value === 'number' ? value : Number(value);
                      const isReturnColumn = col.toLowerCase().includes('return');

                      return (
                        <td
                          key={`${rowIdx}-${col}`}
                          className={cn(
                            'whitespace-nowrap px-4 py-3 text-[15px] text-slate-700',
                            Number.isFinite(numeric) && isReturnColumn && numeric > 0 ? 'font-semibold text-emerald-700' : '',
                            Number.isFinite(numeric) && isReturnColumn && numeric < 0 ? 'font-semibold text-rose-700' : ''
                          )}
                        >
                          {value === null || value === undefined ? '-' : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default function BasketPage() {
  const queryClient = useQueryClient();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [isBasketDialogOpen, setIsBasketDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [appliedSignature, setAppliedSignature] = useState<string | null>(null);

  const [selectedBasketId, setSelectedBasketId] = useState<number | null>(null);

  const [startDate, setStartDate] = useState('2016-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [month, setMonth] = useState<(typeof MONTHS)[number]>('Jun');
  const [calendarDay, setCalendarDay] = useState(10);
  const [tradingDay, setTradingDay] = useState(10);
  const [holdingPeriod, setHoldingPeriod] = useState(10);
  const [trendType, setTrendType] = useState<'Any' | 'Bullish' | 'Bearish'>('Any');
  const [riskFreeInterestRate, setRiskFreeInterestRate] = useState(7);
  const [topRanks, setTopRanks] = useState(10);
  const [sortFirstBy, setSortFirstBy] = useState<'AvgPnl' | 'WinnerPct'>('AvgPnl');

  const [monthName, setMonthName] = useState<(typeof MONTHS_UPPER)[number]>('JAN');
  const [rankType, setRankType] = useState<'Bullish' | 'Bearish'>('Bullish');
  const [intervalGapRange, setIntervalGapRange] = useState(10);
  const [totalReturns, setTotalReturns] = useState(2);

  const [basketName, setBasketName] = useState('');
  const [basketDescription, setBasketDescription] = useState('');
  const [basketSymbols, setBasketSymbols] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [managerError, setManagerError] = useState<string | null>(null);

  const toErrorMessage = (error: any, fallback: string) => {
    const payloadError = error?.response?.data?.error;
    if (typeof payloadError === 'string') return payloadError;
    if (payloadError && typeof payloadError === 'object') {
      if (typeof payloadError.message === 'string') return payloadError.message;
      if (typeof payloadError.code === 'string') return payloadError.code;
    }
    if (typeof error?.message === 'string') return error.message;
    return fallback;
  };

  const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['basket-groups'],
    queryFn: async () => {
      const response = await analysisApi.getBasketGroups();
      return (response.data?.data ?? []) as BasketGroupDto[];
    },
  });

  const groups = groupsData ?? [];
  const selectedGroup = groups.find((group) => group.id === selectedBasketId) ?? null;

  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data?.symbols ?? [];
    },
  });

  const allSymbols = useMemo(() => {
    const rows = Array.isArray(symbolsData) ? symbolsData : [];
    return rows.map((row: { symbol: string }) => row.symbol).filter(Boolean);
  }, [symbolsData]);

  useEffect(() => {
    if (!selectedBasketId && groups.length > 0) {
      setSelectedBasketId(groups[0].id);
    }

    if (selectedBasketId && groups.length > 0 && !groups.some((g) => g.id === selectedBasketId)) {
      setSelectedBasketId(groups[0]?.id ?? null);
    }
  }, [selectedBasketId, groups]);

  const resetEditor = () => {
    setEditorMode('create');
    setBasketName('');
    setBasketDescription('');
    setBasketSymbols([]);
    setSymbolSearch('');
    setManagerError(null);
  };

  const openCreateDialog = () => {
    resetEditor();
    setEditorMode('create');
    setIsBasketDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedGroup || selectedGroup.isSystem || !selectedGroup.isOwner) return;
    setEditorMode('edit');
    setBasketName(selectedGroup.name);
    setBasketDescription(selectedGroup.description || '');
    setBasketSymbols(selectedGroup.symbols);
    setSymbolSearch('');
    setManagerError(null);
    setIsBasketDialogOpen(true);
  };

  const closeDialog = () => {
    setIsBasketDialogOpen(false);
    setManagerError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () =>
      analysisApi.createBasketGroup({
        name: basketName,
        description: basketDescription || null,
        symbols: basketSymbols,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['basket-groups'] });
      const created = response.data?.data as BasketGroupDto;
      if (created?.id) {
        setSelectedBasketId(created.id);
      }
      resetEditor();
      setIsBasketDialogOpen(false);
    },
    onError: (error: any) => {
      setManagerError(toErrorMessage(error, 'Failed to create basket'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error('No basket selected');
      return analysisApi.updateBasketGroup(selectedGroup.id, {
        name: basketName,
        description: basketDescription || null,
        symbols: basketSymbols,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['basket-groups'] });
      resetEditor();
      setIsBasketDialogOpen(false);
    },
    onError: (error: any) => {
      setManagerError(toErrorMessage(error, 'Failed to update basket'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error('No basket selected');
      return analysisApi.deleteBasketGroup(selectedGroup.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['basket-groups'] });
      resetEditor();
    },
    onError: (error: any) => {
      setManagerError(toErrorMessage(error, 'Failed to delete basket'));
    },
  });

  const addSymbol = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    if (!allSymbols.includes(normalized)) return;
    if (basketSymbols.includes(normalized)) return;
    if (basketSymbols.length >= MAX_SYMBOLS) return;
    setBasketSymbols((prev) => [...prev, normalized]);
    setSymbolSearch('');
  };

  const removeSymbol = (symbol: string) => {
    setBasketSymbols((prev) => prev.filter((item) => item !== symbol));
  };

  const canSubmitEditor = basketName.trim().length > 0 && basketSymbols.length > 0 && basketSymbols.length <= MAX_SYMBOLS;

  const filteredSymbolOptions = useMemo(() => {
    const query = symbolSearch.trim().toUpperCase();
    return allSymbols
      .filter((symbol) => !basketSymbols.includes(symbol))
      .filter((symbol) => (query ? symbol.includes(query) : true))
      .slice(0, 200);
  }, [allSymbols, basketSymbols, symbolSearch]);

  const currentSignature = useMemo(
    () =>
      JSON.stringify({
        selectedBasketId,
        startDate,
        endDate,
        month,
        calendarDay,
        tradingDay,
        holdingPeriod,
        trendType,
        riskFreeInterestRate,
        topRanks,
        sortFirstBy,
        monthName,
        rankType,
        intervalGapRange,
        totalReturns,
      }),
    [
      selectedBasketId,
      startDate,
      endDate,
      month,
      calendarDay,
      tradingDay,
      holdingPeriod,
      trendType,
      riskFreeInterestRate,
      topRanks,
      sortFirstBy,
      monthName,
      rankType,
      intervalGapRange,
      totalReturns,
    ]
  );

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ['basket-analysis', currentSignature],
    queryFn: async () => {
      if (!selectedBasketId) {
        return { calendar: { rows: [] }, trading: { rows: [] }, bestMonthly: { rows: [] } };
      }

      const baseParams = {
        basketGroupId: selectedBasketId,
        startDate,
        endDate,
      };

      const [calendarRes, tradingRes, bestMonthlyRes] = await Promise.all([
        analysisApi.basketCalendarDay({
          ...baseParams,
          month,
          calendarDay,
          holdingPeriod,
          trendType,
          riskFreeInterestRate,
          topRanks,
          sortFirstBy,
        }),
        analysisApi.basketTradingDay({
          ...baseParams,
          month,
          tradingDay,
          holdingPeriod,
          trendType,
          riskFreeInterestRate,
          topRanks,
          sortFirstBy,
        }),
        analysisApi.basketBestMonthlyReturns({
          ...baseParams,
          monthName,
          rankType,
          intervalGapRange,
          totalReturns,
        }),
      ]);

      return {
        calendar: calendarRes.data?.data,
        trading: tradingRes.data?.data,
        bestMonthly: bestMonthlyRes.data?.data,
      };
    },
    enabled: false,
    retry: 1,
  });

  const hasRun = appliedSignature !== null;
  const isDirty = hasRun && appliedSignature !== currentSignature;

  const handleRun = async () => {
    if (!selectedBasketId) return;
    const response = await refetch();
    if (!response.error) {
      setAppliedSignature(currentSignature);
      setFiltersOpen(false);
    }
  };

  const managerBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const calendarRows = (data?.calendar?.rows ?? []) as BasketRow[];
  const tradingRows = (data?.trading?.rows ?? []) as BasketRow[];
  const bestMonthlyRows = (data?.bestMonthly?.rows ?? []) as BasketRow[];

  const calendarTop = calendarRows[0] ?? null;
  const tradingTop = tradingRows[0] ?? null;
  const bestMonthlyTop = bestMonthlyRows[0] ?? null;

  const calendarTopReturn = parseNumber(calendarTop?.['Avg Return']);
  const tradingTopReturn = parseNumber(tradingTop?.['Avg Return']);
  const bestMonthlyTopReturn = parseNumber(bestMonthlyTop?.['Avg Return']);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,_#fce7ee_0%,_#fff5f7_34%,_#f8fafc_78%)] p-6">
      <div className="mx-auto max-w-[1900px] space-y-5">
        <div className="rounded-xl border border-[#f44765]/25 bg-white p-4 shadow-[0_10px_35px_-18px_rgba(244,71,101,0.38)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#f44765]/12 text-[#f44765] flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Basket Analysis</h1>
                <p className="text-sm text-slate-500">Legacy-matched calendar/trading/monthly basket tables</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedGroup && (
                <div className="rounded-full border border-[#f44765]/25 bg-[#f44765]/10 px-3 py-1 text-sm font-semibold text-[#b0264a]">
                  {selectedGroup.name} · {selectedGroup.symbolCount} symbols
                </div>
              )}
              <Button variant="outline" className="h-11 px-4 text-sm" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Basket
              </Button>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={openEditDialog}
                disabled={!selectedGroup || selectedGroup.isSystem || !selectedGroup.isOwner}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Basket
              </Button>
              <Button
                variant="secondary"
                className="h-11 px-4 text-sm bg-rose-600 text-white hover:bg-rose-700"
                disabled={!selectedGroup || selectedGroup.isSystem || !selectedGroup.isOwner || managerBusy}
                onClick={() => {
                  if (!selectedGroup) return;
                  const confirmed = window.confirm(`Delete basket \"${selectedGroup.name}\"?`);
                  if (confirmed) deleteMutation.mutate();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Basket
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-xl font-semibold">Filters</CardTitle>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Filters changed
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
                  {filtersOpen ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>
          </CardHeader>

          {filtersOpen && (
            <CardContent className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/45 p-3">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Calendar & Trading Day Inputs</h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600">Selected Basket</span>
                      <select
                        value={selectedBasketId ? String(selectedBasketId) : ''}
                        onChange={(e) => setSelectedBasketId(e.target.value ? Number(e.target.value) : null)}
                        disabled={groups.length === 0}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
                      >
                        {groups.length === 0 ? (
                          <option value="">No baskets found</option>
                        ) : (
                          groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name} ({group.symbolCount})
                            </option>
                          ))
                        )}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600">Start Date</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-600">End Date</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
                      />
                    </label>

                    <SelectField label="Month" value={month} onChange={(v) => setMonth(v as (typeof MONTHS)[number])} options={[...MONTHS]} />
                    <NumberField label="Calendar Day" value={calendarDay} onChange={setCalendarDay} min={1} max={31} />
                    <NumberField label="Trading Day" value={tradingDay} onChange={setTradingDay} min={1} max={31} />
                    <NumberField label="Holding Period" value={holdingPeriod} onChange={setHoldingPeriod} min={1} max={31} />
                    <SelectField label="Trend" value={trendType} onChange={(v) => setTrendType(v as 'Any' | 'Bullish' | 'Bearish')} options={['Any', 'Bullish', 'Bearish']} />
                    <SelectField label="Sort First" value={sortFirstBy} onChange={(v) => setSortFirstBy(v as 'AvgPnl' | 'WinnerPct')} options={['AvgPnl', 'WinnerPct']} />
                    <NumberField label="Risk Free %" value={riskFreeInterestRate} onChange={setRiskFreeInterestRate} min={0} max={100} step={0.1} />
                    <NumberField label="Top Ranks" value={topRanks} onChange={setTopRanks} min={0} max={500} />
                  </div>
                </div>

                <div className="rounded-xl border border-[#f44765]/25 bg-[#f44765]/5 p-3">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#b0264a]">Best Monthly Returns Input</h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <SelectField label="Month Name" value={monthName} onChange={(v) => setMonthName(v as (typeof MONTHS_UPPER)[number])} options={[...MONTHS_UPPER]} />
                    <SelectField label="Rank Type" value={rankType} onChange={(v) => setRankType(v as 'Bullish' | 'Bearish')} options={['Bullish', 'Bearish']} />
                    <NumberField label="Interval Gap" value={intervalGapRange} onChange={setIntervalGapRange} min={1} max={31} />
                    <NumberField label="Total Returns" value={totalReturns} onChange={setTotalReturns} min={1} max={100} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleRun}
                  disabled={!selectedBasketId || isFetching || isGroupsLoading}
                  className="h-12 px-8 text-base font-semibold bg-[#f44765] hover:bg-[#e23c5b]"
                >
                  <RefreshCw className={cn('mr-2 h-5 w-5', isFetching ? 'animate-spin' : '')} />
                  Run Basket Analysis
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {isLoading || isFetching ? (
          <Card>
            <CardContent className="flex min-h-[230px] items-center justify-center">
              <Loading size="lg" />
            </CardContent>
          </Card>
        ) : !hasRun ? (
          <Card>
            <CardContent className="py-16 text-center text-base text-slate-500">
              Select a basket and click <span className="font-semibold text-slate-700">Run Basket Analysis</span>.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {isDirty && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Filters changed after last run. Click <span className="font-semibold">Run Basket Analysis</span> to refresh data.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-600" />Calendar Best</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {calendarTop ? (
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">{String(calendarTop.Symbol ?? 'N/A')}</p>
                      <p className={cn('font-medium', (calendarTopReturn ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        Avg Return: {calendarTopReturn !== null ? `${calendarTopReturn.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500">No qualifying rows</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4 text-[#f44765]" />Trading Best</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {tradingTop ? (
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">{String(tradingTop.Symbol ?? 'N/A')}</p>
                      <p className={cn('font-medium', (tradingTopReturn ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        Avg Return: {tradingTopReturn !== null ? `${tradingTopReturn.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500">No qualifying rows</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" />Best Monthly Interval</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {bestMonthlyTop ? (
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900">{String(bestMonthlyTop.TickerName ?? 'N/A')}</p>
                      <p className="font-medium text-slate-700">
                        Days {String(bestMonthlyTop['Start Day'] ?? '-')} → {String(bestMonthlyTop['End Day'] ?? '-')}
                      </p>
                      <p className={cn('font-medium', (bestMonthlyTopReturn ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                        Avg Return: {bestMonthlyTopReturn !== null ? `${bestMonthlyTopReturn.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500">No qualifying rows</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <DataTable title="Calendar Day Ranking" rows={calendarRows} />
            <DataTable title="Trading Day Ranking" rows={tradingRows} />
            <DataTable title="Best Monthly Returns" rows={bestMonthlyRows} />
          </div>
        )}
      </div>

      <Dialog open={isBasketDialogOpen} onOpenChange={(open) => (open ? setIsBasketDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-4xl border border-[#f44765]/25">
          <DialogHeader>
            <DialogTitle className="text-xl">{editorMode === 'create' ? 'Create Basket' : 'Edit Basket'}</DialogTitle>
            <DialogDescription>
              Add up to {MAX_SYMBOLS} symbols. Only valid symbols from database can be saved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-1">
              <span className="text-sm font-semibold text-slate-700">Basket Name</span>
              <input
                type="text"
                value={basketName}
                onChange={(e) => setBasketName(e.target.value)}
                placeholder="Example: My Momentum Basket"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
              />
            </label>

            <label className="space-y-2 md:col-span-1">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <input
                type="text"
                value={basketDescription}
                onChange={(e) => setBasketDescription(e.target.value)}
                placeholder="Optional description"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
              />
            </label>

            <div className="space-y-2 md:col-span-1">
              <span className="text-sm font-semibold text-slate-700">Search Symbols</span>
              <input
                type="text"
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                placeholder="Search symbol (e.g. NIFTY, RELIANCE)"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] font-medium text-slate-700 outline-none transition-all hover:border-[#f44765]/50 focus:border-[#f44765] focus:ring-2 focus:ring-[#f44765]/20"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {filteredSymbolOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No matching symbols.</div>
                ) : (
                  filteredSymbolOptions.map((symbol) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => addSymbol(symbol)}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#f44765]/10"
                    >
                      <span>{symbol}</span>
                      <Plus className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 md:col-span-1">
              <span className="text-sm font-semibold text-slate-700">Selected Symbols ({basketSymbols.length}/{MAX_SYMBOLS})</span>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                <div className="flex flex-wrap gap-2">
                  {basketSymbols.map((symbol) => (
                    <span key={symbol} className="inline-flex items-center gap-1 rounded-full bg-[#f44765]/12 px-2.5 py-1 text-xs font-semibold text-[#b0264a]">
                      {symbol}
                      <button type="button" onClick={() => removeSymbol(symbol)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {basketSymbols.length === 0 && <span className="text-sm text-slate-500">No symbols selected.</span>}
                </div>
              </div>
            </div>
          </div>

          {managerError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{managerError}</div>}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="h-11">
              Cancel
            </Button>
            {editorMode === 'create' ? (
              <Button className="h-11 bg-[#f44765] hover:bg-[#e23c5b]" disabled={!canSubmitEditor || managerBusy} onClick={() => createMutation.mutate()}>
                <Save className="mr-2 h-4 w-4" />
                Create Basket
              </Button>
            ) : (
              <Button className="h-11 bg-[#f44765] hover:bg-[#e23c5b]" disabled={!canSubmitEditor || managerBusy} onClick={() => updateMutation.mutate()}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
