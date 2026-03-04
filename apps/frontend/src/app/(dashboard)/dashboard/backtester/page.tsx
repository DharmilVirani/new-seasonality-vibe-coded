'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { analysisApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import {
  RefreshCw, SlidersHorizontal, Search, DollarSign, Percent, TrendingUp, Wallet, CalendarDays, Filter, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn, formatPercentage, formatCurrency } from '@/lib/utils';
import { createChart, ColorType } from 'lightweight-charts';

type WalkForwardSeries = {
  name: string;
  data: Array<{ x: string | number; superimposedReturn: number }>;
};

function WalkForwardTvChart({ series }: { series: WalkForwardSeries[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; label: string; points: Array<{ name: string; value: number; color: string }> } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || series.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: '#f97316', style: 2 },
        horzLine: { width: 1, color: '#f97316', style: 2 },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: false,
        secondsVisible: false,
      },
    });

    const baseTime = 1704067200; // 2024-01-01 UTC
    const palette = ['#f97316', '#0ea5e9', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#eab308', '#f43f5e'];
    const xOrder: string[] = [];
    const xSeen = new Set<string>();
    series.forEach(s => {
      s.data.forEach(point => {
        const label = String(point.x);
        if (!xSeen.has(label)) {
          xSeen.add(label);
          xOrder.push(label);
        }
      });
    });
    const timeByLabel = new Map<string, number>(
      xOrder.map((label, idx) => [label, baseTime + idx * 86400])
    );
    const labelByTime = new Map<number, string>(
      xOrder.map((label) => [timeByLabel.get(label) as number, label])
    );

    const lineSeriesMap = new Map<any, { name: string; color: string }>();
    series.forEach((s, idx) => {
      const color = palette[idx % palette.length];
      const lineSeries = chart.addLineSeries({
        color,
        lineWidth: idx === 0 ? 3 : 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      lineSeries.setData(
        s.data
          .map(point => ({
            time: timeByLabel.get(String(point.x)) as any,
            value: Number(point.superimposedReturn ?? 0),
          }))
          .filter(p => Number.isFinite(p.value) && p.time != null)
      );
      lineSeriesMap.set(lineSeries, { name: s.name, color });
    });

    chart.timeScale().fitContent();
    (chart.timeScale() as any).applyOptions({
      tickMarkFormatter: (time: any) => labelByTime.get(time) || '',
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }
      const points: Array<{ name: string; value: number; color: string }> = [];
      lineSeriesMap.forEach((meta, line) => {
        const dataPoint = param.seriesData.get(line);
        if (!dataPoint) return;
        const value = typeof dataPoint.value === 'number' ? dataPoint.value : Number(dataPoint.value ?? 0);
        if (Number.isFinite(value)) {
          points.push({ name: meta.name, value, color: meta.color });
        }
      });
      if (points.length === 0) {
        setTooltip(null);
        return;
      }
      points.sort((a, b) => b.value - a.value);
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        label: labelByTime.get(param.time) || String(param.time),
        points,
      });
    });

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [series]);

  return (
    <div ref={chartContainerRef} className="h-[320px] w-full relative">
      {tooltip?.visible && (
        <div
          className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-20 min-w-[220px]"
          style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y - 70}px` }}
        >
          <div className="font-semibold text-slate-700">{tooltip.label}</div>
          <div className="space-y-1 mt-1">
            {tooltip.points.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3">
                <span className="font-medium" style={{ color: p.color }}>{p.name}</span>
                <span className={cn('font-bold', p.value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {p.value.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BacktesterPage() {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [appliedBacktestFiltersSignature, setAppliedBacktestFiltersSignature] = useState<string | null>(null);

  // Filter states
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  const [startDate, setStartDate] = useState('2016-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [evenOddYears, setEvenOddYears] = useState<'All' | 'Even' | 'Odd' | 'Leap'>('All');
  const [specificMonth, setSpecificMonth] = useState(0);
  const [specificExpiryWeek, setSpecificExpiryWeek] = useState(0);
  const [specificMondayWeek, setSpecificMondayWeek] = useState(0);

  // Strategy Parameters
  const [initialCapital, setInitialCapital] = useState(10000000);
  const [riskFreeRate, setRiskFreeRate] = useState(5.4);
  const [tradeType, setTradeType] = useState<'longTrades' | 'shortTrades'>('longTrades');
  const [brokerage, setBrokerage] = useState(0.04);
  const [phenomenaDaysStart, setPhenomenaDaysStart] = useState(-5);
  const [phenomenaDaysEnd, setPhenomenaDaysEnd] = useState(2);

  // Query One filters
  const [queryWeekdays, setQueryWeekdays] = useState<string[]>(['Monday', 'Friday']);
  const [queryTradingDays, setQueryTradingDays] = useState<number[]>([1]);
  const [queryCalendarDays, setQueryCalendarDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Heatmap & Walk Forward
  const [heatmapType, setHeatmapType] = useState<'TradingMonthDaysVsWeekdays' | 'CalenderMonthDaysVsWeekdays'>('TradingMonthDaysVsWeekdays');
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [inSampleStart, setInSampleStart] = useState('2016-01-01');
  const [inSampleEnd, setInSampleEnd] = useState('2019-12-31');
  const [outSampleStart, setOutSampleStart] = useState('2020-01-01');
  const [outSampleEnd, setOutSampleEnd] = useState('2022-12-31');
  const [walkForwardType, setWalkForwardType] = useState('CalenderYearDay');
  const [walkForwardSymbols, setWalkForwardSymbols] = useState<string[]>([]);

  // Pagination
  const [tradePage, setTradePage] = useState(1);
  const tradePageSize = 20;

  // Fetch symbols
  const { data: symbolsData } = useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const response = await analysisApi.getSymbols();
      return response.data.symbols;
    },
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['backtest', selectedSymbol, startDate, endDate, evenOddYears, specificMonth,
      specificExpiryWeek, specificMondayWeek, initialCapital, riskFreeRate, tradeType,
      brokerage, phenomenaDaysStart, phenomenaDaysEnd, queryWeekdays, queryTradingDays,
      queryCalendarDays, heatmapType, inSampleStart, inSampleEnd, outSampleStart, outSampleEnd, walkForwardType, walkForwardSymbols],
    queryFn: async () => {
      const response = await analysisApi.backtestPhenomena({
        symbol: selectedSymbol,
        startDate,
        endDate,
        evenOddYears,
        specificMonth: specificMonth || null,
        specificExpiryWeek: specificExpiryWeek || null,
        specificMondayWeek: specificMondayWeek || null,
        initialCapital,
        riskFreeRate,
        tradeType,
        brokerage,
        phenomenaDaysStart,
        phenomenaDaysEnd,
        queryWeekdays,
        queryTradingDays,
        queryCalendarDays,
        heatmapType,
        showAnnotation,
        inSampleStart,
        inSampleEnd,
        outSampleStart,
        outSampleEnd,
        walkForwardType,
        walkForwardSymbols,
      });
      return response.data;
    },
    enabled: false,
  });

  const result = data?.data ?? data;
  const currentBacktestFiltersSignature = useMemo(
    () =>
      JSON.stringify({
        selectedSymbol,
        startDate,
        endDate,
        evenOddYears,
        specificMonth,
        specificExpiryWeek,
        specificMondayWeek,
        initialCapital,
        riskFreeRate,
        tradeType,
        brokerage,
        phenomenaDaysStart,
        phenomenaDaysEnd,
        queryWeekdays,
        queryTradingDays,
        queryCalendarDays,
        heatmapType,
        showAnnotation,
        inSampleStart,
        inSampleEnd,
        outSampleStart,
        outSampleEnd,
        walkForwardType,
        walkForwardSymbols,
      }),
    [
      selectedSymbol,
      startDate,
      endDate,
      evenOddYears,
      specificMonth,
      specificExpiryWeek,
      specificMondayWeek,
      initialCapital,
      riskFreeRate,
      tradeType,
      brokerage,
      phenomenaDaysStart,
      phenomenaDaysEnd,
      queryWeekdays,
      queryTradingDays,
      queryCalendarDays,
      heatmapType,
      showAnnotation,
      inSampleStart,
      inSampleEnd,
      outSampleStart,
      outSampleEnd,
      walkForwardType,
      walkForwardSymbols,
    ]
  );
  const hasBacktested = appliedBacktestFiltersSignature !== null;
  const isBacktesterDirty = hasBacktested && appliedBacktestFiltersSignature !== currentBacktestFiltersSignature;

  const handleRunBacktest = async () => {
    setAdvancedFiltersOpen(false);
    const response = await refetch();
    if (!response.error) {
      setAppliedBacktestFiltersSignature(currentBacktestFiltersSignature);
    }
  };

  const handleClearFilters = () => {
    setSelectedSymbol('NIFTY');
    setStartDate('2016-01-01');
    setEndDate('2025-12-31');
    setEvenOddYears('All');
    setSpecificMonth(0);
    setSpecificExpiryWeek(0);
    setSpecificMondayWeek(0);
    setInitialCapital(10000000);
    setRiskFreeRate(5.4);
    setTradeType('longTrades');
    setBrokerage(0.04);
    setPhenomenaDaysStart(-5);
    setPhenomenaDaysEnd(2);
    setWalkForwardSymbols([]);
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const tradingDays = Array.from({ length: 23 }, (_, i) => i + 1);
  const calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const handlePhenomenaRangeChange = (values: number[]) => {
    if (!Array.isArray(values) || values.length < 2) return;
    const start = Math.min(values[0], values[1]);
    const end = Math.max(values[0], values[1]);
    setPhenomenaDaysStart(start);
    setPhenomenaDaysEnd(end);
  };
  const totalTradePages = Math.max(1, Math.ceil((result?.tradeList?.length || 0) / tradePageSize));
  const currentTradePage = Math.min(tradePage, totalTradePages);
  const totalTrades = result?.tradeList?.length || 0;
  const fromTrade = totalTrades === 0 ? 0 : (currentTradePage - 1) * tradePageSize + 1;
  const toTrade = totalTrades === 0 ? 0 : Math.min(currentTradePage * tradePageSize, totalTrades);
  const walkForwardChartSeries = useMemo(() => {
    const wf = result?.walkForwardData;
    if (!wf || !Array.isArray(wf.series)) return [];

    return wf.series
      .map((series: any, sIdx: number) => ({
        name: series?.name || `Series ${sIdx + 1}`,
        data: Array.isArray(series?.data)
          ? series.data.map((p: any, idx: number) => ({
              x: p?.x ?? p?.label ?? p?.day ?? idx + 1,
              superimposedReturn: Number(
                p?.superimposedReturn ?? p?.compoundedReturn ?? p?.value ?? 0
              ),
            }))
          : [],
      }))
      .filter((s: any) => s.data.length > 0);
  }, [result?.walkForwardData]);
  const paginatedTrades = useMemo(
    () => result?.tradeList?.slice((currentTradePage - 1) * tradePageSize, currentTradePage * tradePageSize) || [],
    [result?.tradeList, currentTradePage]
  );

  return (
    <div className="flex h-full bg-[#f6f8fb]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* HEADER */}
        <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                Phenomena Backtester
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-medium">Strategy Testing Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              BT
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-[1800px] mx-auto w-full">

          {/* COMPACT FILTER ROW */}
          <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex-wrap">

            {/* Symbol */}
            <div className="min-w-[120px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Search className="h-3 w-3" /> Symbol
              </label>
              <div className="relative">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white appearance-none cursor-pointer hover:border-orange-300 transition-all"
                >
                  {symbolsData?.map((s: { symbol: string }) => (
                    <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-end gap-1">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <CalendarDays className="h-3 w-3" /> Start
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 hover:border-orange-300 transition-all"
                />
              </div>
              <span className="text-slate-300 pb-2">→</span>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                  End
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 hover:border-orange-300 transition-all"
                />
              </div>
            </div>

            {/* Even/Odd Years */}
            <div className="min-w-[100px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Filter className="h-3 w-3" /> Year Type
              </label>
              <div className="relative">
                <select
                  value={evenOddYears}
                  onChange={(e) => setEvenOddYears(e.target.value as any)}
                  className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white appearance-none cursor-pointer hover:border-orange-300 transition-all"
                >
                  <option value="All">All Years</option>
                  <option value="Even">Even</option>
                  <option value="Odd">Odd</option>
                  <option value="Leap">Leap</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Specific Month */}
            <div className="min-w-[110px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                Month
              </label>
              <div className="relative">
                <select
                  value={specificMonth}
                  onChange={(e) => setSpecificMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white appearance-none cursor-pointer hover:border-orange-300 transition-all"
                >
                  <option value={0}>All Months</option>
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-slate-200 mx-1" />

            {/* Initial Capital */}
            <div className="min-w-[130px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Wallet className="h-3 w-3" /> Capital
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(parseInt(e.target.value) || 10000000)}
                  className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 hover:border-orange-300 transition-all"
                />
              </div>
            </div>

            {/* Risk Free Rate */}
            <div className="min-w-[90px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Percent className="h-3 w-3" /> RF Rate %
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={0.1}
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 5.4)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 hover:border-orange-300 transition-all"
                />
              </div>
            </div>

            {/* Trade Type */}
            <div className="min-w-[100px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3" /> Trade
              </label>
              <div className="relative">
                <select
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value as any)}
                  className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white appearance-none cursor-pointer hover:border-orange-300 transition-all"
                >
                  <option value="longTrades">Long ↑</option>
                  <option value="shortTrades">Short ↓</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {/* Brokerage */}
            <div className="min-w-[90px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <DollarSign className="h-3 w-3" /> Brokerage %
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={0.01}
                  value={brokerage}
                  onChange={(e) => setBrokerage(parseFloat(e.target.value) || 0.04)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 hover:border-orange-300 transition-all"
                />
              </div>
            </div>

            {/* Phenomena Days */}
            <div className="min-w-[260px] flex-1 max-w-[360px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2 mb-2">
                <TrendingUp className="h-3 w-3" /> Phenomena Days
                <span className="text-orange-600 font-bold ml-auto">{phenomenaDaysStart} to {phenomenaDaysEnd}</span>
              </label>
              <div className="px-1">
                <SliderPrimitive.Root
                  min={-10}
                  max={23}
                  step={1}
                  value={[phenomenaDaysStart, phenomenaDaysEnd]}
                  onValueChange={handlePhenomenaRangeChange}
                  className="relative flex w-full touch-none select-none items-center"
                >
                  <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
                    <SliderPrimitive.Range className="absolute h-full bg-orange-500" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-orange-500 bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2" />
                  <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-orange-500 bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2" />
                </SliderPrimitive.Root>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>-10</span>
                  <span>{phenomenaDaysStart} to {phenomenaDaysEnd}</span>
                  <span>23</span>
                </div>
              </div>
            </div>

            {/* More Filters Button */}
            <Button
              onClick={() => setAdvancedFiltersOpen((open) => !open)}
              variant="outline"
              size="sm"
              className="gap-2 border-slate-300 hover:border-orange-400 hover:bg-orange-50 ml-auto h-10 px-4"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-xs font-medium">{advancedFiltersOpen ? 'Hide Filters' : 'More Filters'}</span>
              {advancedFiltersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Run Backtest</p>
                <p className="text-xs text-slate-500">Apply current filters and refresh all reports</p>
              </div>
              {isBacktesterDirty && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  Filters changed
                </span>
              )}
            </div>
            <Button
              onClick={handleRunBacktest}
              disabled={isFetching}
              className="h-11 px-7 text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RefreshCw className={cn("h-5 w-5 mr-2", isFetching && "animate-spin")} />
              {isFetching ? 'Running...' : 'Run Backtest'}
            </Button>
          </div>

          {advancedFiltersOpen && (
            <>
              <Card className="border border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="py-2.5 border-b border-slate-100 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-orange-600" />
                      <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Advanced Filters</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-slate-500 hover:text-slate-700"
                      onClick={() => setAdvancedFiltersOpen(false)}
                    >
                      Collapse
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Week Filters</div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Expiry Week</label>
                        <select
                          value={specificExpiryWeek}
                          onChange={(e) => setSpecificExpiryWeek(parseInt(e.target.value))}
                          className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                        >
                          <option value={0}>Disable</option>
                          <option value={1}>Week 1</option>
                          <option value={2}>Week 2</option>
                          <option value={3}>Week 3</option>
                          <option value={4}>Week 4</option>
                          <option value={5}>Week 5</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Monday Week</label>
                        <select
                          value={specificMondayWeek}
                          onChange={(e) => setSpecificMondayWeek(parseInt(e.target.value))}
                          className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                        >
                          <option value={0}>Disable</option>
                          <option value={1}>Week 1</option>
                          <option value={2}>Week 2</option>
                          <option value={3}>Week 3</option>
                          <option value={4}>Week 4</option>
                          <option value={5}>Week 5</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Query One</div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Weekdays</label>
                        <div className="flex flex-wrap gap-2">
                          {weekdays.map(day => (
                            <label key={day} className="flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={queryWeekdays.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) setQueryWeekdays([...queryWeekdays, day]);
                                  else setQueryWeekdays(queryWeekdays.filter(d => d !== day));
                                }}
                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                              />
                              {day.slice(0, 3)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Trading Days</label>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                          {tradingDays.map(day => (
                            <label key={day} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200">
                              <input
                                type="checkbox"
                                checked={queryTradingDays.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) setQueryTradingDays([...queryTradingDays, day]);
                                  else setQueryTradingDays(queryTradingDays.filter(d => d !== day));
                                }}
                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Calendar Days</label>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                          {calendarDays.map(day => (
                            <label key={day} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-white border border-slate-200">
                              <input
                                type="checkbox"
                                checked={queryCalendarDays.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) setQueryCalendarDays([...queryCalendarDays, day]);
                                  else setQueryCalendarDays(queryCalendarDays.filter(d => d !== day));
                                }}
                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Heatmap</div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Heatmap Type</label>
                        <select
                          value={heatmapType}
                          onChange={(e) => setHeatmapType(e.target.value as any)}
                          className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                        >
                          <option value="TradingMonthDaysVsWeekdays">Trading vs Weekdays</option>
                          <option value="CalenderMonthDaysVsWeekdays">Calendar vs Weekdays</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={showAnnotation}
                          onChange={(e) => setShowAnnotation(e.target.checked)}
                          className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        Show annotations
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Walk Forward</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">In Start</label>
                          <input
                            type="date"
                            value={inSampleStart}
                            onChange={(e) => setInSampleStart(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">In End</label>
                          <input
                            type="date"
                            value={inSampleEnd}
                            onChange={(e) => setInSampleEnd(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Out Start</label>
                          <input
                            type="date"
                            value={outSampleStart}
                            onChange={(e) => setOutSampleStart(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Out End</label>
                          <input
                            type="date"
                            value={outSampleEnd}
                            onChange={(e) => setOutSampleEnd(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Chart Type</label>
                        <select
                          value={walkForwardType}
                          onChange={(e) => setWalkForwardType(e.target.value)}
                          className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-orange-400 bg-white"
                        >
                          <option value="CalenderYearDay">Calendar Year Days</option>
                          <option value="TradingYearDay">Trading Year Days</option>
                          <option value="CalenderMonthDay">Calendar Month Days</option>
                          <option value="TradingMonthDay">Trading Month Days</option>
                          <option value="Weekday">Weekdays</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Walk Forward Symbols</label>
                        <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-md p-2 bg-white space-y-1">
                          {symbolsData?.map((s: { symbol: string }) => {
                            const checked = walkForwardSymbols.includes(s.symbol);
                            return (
                              <label key={s.symbol} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setWalkForwardSymbols([...walkForwardSymbols, s.symbol]);
                                    } else {
                                      setWalkForwardSymbols(walkForwardSymbols.filter(sym => sym !== s.symbol));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                />
                                <span className="text-slate-700">{s.symbol}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <Button
                      onClick={handleClearFilters}
                      variant="outline"
                      className="h-8 border-slate-300 hover:border-orange-400 hover:bg-orange-50"
                    >
                      Clear Advanced
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </>
          )}

          {/* LOADING STATE */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loading size="lg" />
            </div>
          ) : !hasBacktested ? (
            <Card>
              <CardContent className="py-20 text-center text-muted-foreground">
                Configure settings and click Run Backtest
              </CardContent>
            </Card>
          ) : result ? (
            <div className="space-y-6">
              {/* STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Initial Capital</div>
                  <div className="text-[26px] leading-none font-semibold text-slate-900 tabular-nums">{formatCurrency(result.initialCapital)}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Final Capital</div>
                  <div className="text-[26px] leading-none font-semibold text-slate-900 tabular-nums">{formatCurrency(result.finalCapital)}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Return</div>
                  <div className={cn(
                    "text-[26px] leading-none font-semibold tabular-nums",
                    result.totalReturn >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>{result.totalReturn >= 0 ? '+' : ''}{formatPercentage(result.totalReturn)}</div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Trades</div>
                  <div className="text-[26px] leading-none font-semibold text-slate-900 tabular-nums">{result.totalTrades}</div>
                </div>
              </div>

              {/* TRADE LIST TABLE */}
              <Card className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <CardHeader className="py-3.5 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-orange-600 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">Trade Ledger</CardTitle>
                        <p className="text-[11px] text-slate-500 tabular-nums">{result.tradeList?.length || 0} trades executed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 rounded-md"
                        onClick={() => {
                          if (!result?.tradeList?.length) return;

                          const headers = ['#', 'Symbol', 'Trade', 'Entry Date', 'Entry Price', 'Exit Date', 'Exit Price', 'Contracts', 'Profit Points', 'Profit %', 'Profit Value', 'Net Profit %', 'DD%'];
                          const csvContent = [
                            headers.join(','),
                            ...result.tradeList.map((trade: any) => [
                              trade.Number,
                              trade.Symbol,
                              trade.Trade,
                              trade['Entry Date'],
                              trade['Entry Price']?.toFixed(2),
                              trade['Exit Date'],
                              trade['Exit Price']?.toFixed(2),
                              trade.Contracts,
                              trade['Profit Points']?.toFixed(2),
                              trade['Profit Percentage']?.toFixed(2) + '%',
                              trade['Profit Value']?.toFixed(2),
                              trade['Net Profit%']?.toFixed(2) + '%',
                              trade['DD%']?.toFixed(2) + '%'
                            ].join(','))
                          ].join('\n');

                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.download = `${selectedSymbol}_phenomena_trades_${startDate}_${endDate}.csv`;
                          link.click();
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100 border-y border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700 uppercase tracking-wide">#</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700 uppercase tracking-wide">Trade</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700 uppercase tracking-wide">Entry Date</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Entry</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-slate-700 uppercase tracking-wide">Exit Date</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Exit</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Contracts</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Pts</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">P%</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Value</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">Net%</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-slate-700 uppercase tracking-wide">DD%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTrades.map((trade: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/30 hover:bg-slate-100/70 transition-colors">
                            <td className="px-3 py-2 font-semibold text-slate-600 tabular-nums">{trade.Number}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs font-semibold tracking-wide",
                                trade.Trade === 'Long' ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-100 text-red-700 ring-1 ring-red-200"
                              )}>
                                {trade.Trade}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-700 tabular-nums">{trade['Entry Date']}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">{trade['Entry Price']?.toFixed(2)}</td>
                            <td className="px-3 py-2 text-slate-700 tabular-nums">{trade['Exit Date']}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">{trade['Exit Price']?.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{trade.Contracts}</td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", trade['Profit Points'] >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {trade['Profit Points']?.toFixed(2)}
                            </td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", trade['Profit Percentage'] >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {trade['Profit Percentage']?.toFixed(1)}%
                            </td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", trade['Profit Value'] >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {formatCurrency(trade['Profit Value'])}
                            </td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", trade['Net Profit%'] >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {trade['Net Profit%']?.toFixed(1)}%
                            </td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", trade['DD%'] < 0 ? "text-red-600" : "text-slate-500")}>
                              {trade['DD%']?.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      Showing {fromTrade} to {toTrade} of {totalTrades}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentTradePage <= 1}
                        onClick={() => setTradePage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-slate-600 tabular-nums px-2">
                        Page {currentTradePage} / {totalTradePages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentTradePage >= totalTradePages}
                        onClick={() => setTradePage((p) => Math.min(totalTradePages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* STATISTICS REPORT */}
              <Card>
                <CardHeader className="py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-800">Performance Summary</CardTitle>
                        <p className="text-xs text-slate-400">Key metrics & statistics</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                      onClick={() => {
                        if (!result?.statisticsReport?.length) return;

                        const headers = ['Parameter', 'Value'];
                        const csvContent = [
                          headers.join(','),
                          ...result.statisticsReport.map((stat: { Parameters: string; Values: string }) => [
                            `"${stat.Parameters}"`,
                            `"${stat.Values}"`
                          ].join(','))
                        ].join('\n');

                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `${selectedSymbol}_phenomena_summary_${startDate}_${endDate}.csv`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Download Summary
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {result.statisticsReport?.map((stat: { Parameters: string; Values: string }, idx: number) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-slate-100 hover:bg-slate-50 px-2 rounded">
                        <span className="text-xs text-slate-500 font-medium">{stat.Parameters}</span>
                        <span className="text-xs font-bold text-slate-800">{stat.Values}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* QUERY1 PARITY TABLE */}
              {result.queryOneData && result.queryOneData.length > 0 && (
                <Card>
                  <CardHeader className="py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <Filter className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-800">Query1 Summary</CardTitle>
                        <p className="text-xs text-slate-400">Weekday / Trading Month Day / Calendar Month Day stats</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold text-slate-600">Metric</th>
                            <th className="px-2 py-1 text-right font-semibold text-slate-600">Weekday</th>
                            <th className="px-2 py-1 text-right font-semibold text-slate-600">Trading Month Day</th>
                            <th className="px-2 py-1 text-right font-semibold text-slate-600">Calendar Month Day</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.queryOneData.map((row: any, idx: number) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="px-2 py-1.5 text-slate-700 font-medium">{row.Parameters}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{row['Weekday']}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{row['Trading Month Day']}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{row['Calendar Month Day']}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* HEATMAP SECTION */}
              {result.heatmapData?.data && result.heatmapData.data.length > 0 && (
                <Card>
                  <CardHeader className="py-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-800">Return Heatmap</CardTitle>
                          <p className="text-xs text-slate-400">Average returns by weekday and {result.heatmapData.xAxisTitle}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold text-slate-600">Weekday</th>
                            {result.heatmapData.xAxis?.map((x: number, idx: number) => (
                              <th key={idx} className="px-2 py-1 text-center font-semibold text-slate-600">
                                {x}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.heatmapData.data?.map((row: (number | null)[], rowIdx: number) => (
                            <tr key={rowIdx}>
                              <td className="px-2 py-1 font-semibold text-slate-600">
                                {result.heatmapData.yAxis?.[rowIdx]}
                              </td>
                              {row.map((value: number | null, colIdx: number) => {
                                if (value === null) {
                                  return (
                                    <td key={colIdx} className="px-2 py-1 text-center bg-slate-100">
                                      -
                                    </td>
                                  );
                                }
                                const isPositive = value >= 0;
                                const intensity = Math.min(Math.abs(value) / 2, 1);
                                const bgColor = isPositive
                                  ? `rgba(16, 185, 129, ${intensity})`
                                  : `rgba(239, 68, 68, ${intensity})`;
                                return (
                                  <td
                                    key={colIdx}
                                    className="px-2 py-1 text-center"
                                    style={{ backgroundColor: bgColor, color: intensity > 0.5 ? 'white' : 'inherit' }}
                                  >
                                    {value?.toFixed(2)}%
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500"></div>
                        <span className="text-xs text-slate-500">Negative</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-white border"></div>
                        <span className="text-xs text-slate-500">Neutral</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-500"></div>
                        <span className="text-xs text-slate-500">Positive</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* WALK FORWARD SUPERIMPOSED CHART */}
              {result.walkForwardData && (
                <Card>
                  <CardHeader className="py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-800">Walk Forward Superimposed</CardTitle>
                        <p className="text-xs text-slate-400">
                          Compounded in-sample returns by {result.walkForwardData?.chartType || walkForwardType}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {walkForwardChartSeries.length > 0 ? (
                      <WalkForwardTvChart series={walkForwardChartSeries} />
                    ) : (
                      <div className="h-[160px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                        No walk-forward points for current in/out sample filters.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-20 text-center text-muted-foreground">
                No backtest data found for current settings. Click Run Backtest.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
