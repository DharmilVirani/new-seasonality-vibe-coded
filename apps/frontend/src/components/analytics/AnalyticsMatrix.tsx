'use client';

import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';

// Simple black tooltip component
function SimpleTooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <span 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="fixed z-[9999] bg-black text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap">
          {content}
        </div>
      )}
    </span>
  );
}

interface AnalyticsMatrixProps {
    data: any[]; // eventOccurrences
    stats: any; // aggregatedMetrics
}

export function AnalyticsMatrix({ data, stats }: AnalyticsMatrixProps) {
    // 1. Calculate Profit Distribution (Histogram)
    const distributionData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const returns = data.map(d => d.returnPercentage || 0);
        const min = Math.floor(Math.min(...returns));
        const max = Math.ceil(Math.max(...returns));

        // Create bins
        const binCount = Math.min(20, Math.max(5, data.length)); // Dynamic bin count
        const range = max - min || 1;
        const binSize = range / binCount;

        const bins = Array.from({ length: binCount }, (_, i) => {
            const binStart = min + i * binSize;
            return {
                name: binStart.toFixed(1),
                count: 0,
                range: `${binStart.toFixed(1)} to ${(binStart + binSize).toFixed(1)}`
            };
        });

        returns.forEach(r => {
            const binIndex = Math.min(Math.floor((r - min) / binSize), binCount - 1);
            if (binIndex >= 0 && bins[binIndex]) {
                bins[binIndex].count++;
            }
        });

        return bins;
    }, [data]);

    // 2. Specialized Metrics
    const annualizedReturn = useMemo(() => {
        if (!stats?.avgReturn) return 0;
        // Simple annualized return approximation: avgReturn * (252 / avgHoldingDays)
        // Assuming avgHoldingDays is available or defaulting to 3
        const avgHolding = stats.avgHoldingDays || 5;
        return (stats.avgReturn * (252 / avgHolding));
    }, [stats]);

    const totalProfit = useMemo(() => {
        if (!data || data.length === 0) return 0;
        const totalReturn = data.reduce((sum, d) => sum + (d.returnPercentage || 0), 0);
        const inrRate = parseInt(process.env.NEXT_PUBLIC_INR_RATE || '83', 10);
        return (10000 * inrRate) * (totalReturn / 100);
    }, [data]);

    const metrics = [
        { 
            label: 'Annualized Return', 
            value: `${annualizedReturn.toFixed(1)}%`, 
            trend: annualizedReturn > 0 ? 'up' : 'down', 
            subType: 'CAGR',
            tooltip: (
                <div>
                    <div className="font-semibold mb-1">Annualized Return (CAGR)</div>
                    <div className="text-slate-300">Formula: (End Value/Start Value)^(1/years) - 1</div>
                    <div className="text-slate-400 text-[10px] mt-1">Compounded annual growth rate over the period</div>
                </div>
            )
        },
        { 
            label: 'Average Return', 
            value: `${(stats?.avgReturn || 0).toFixed(2)}%`, 
            trend: (stats?.avgReturn || 0) > 0 ? 'up' : 'down', 
            subType: 'Per Trade',
            tooltip: (
                <div>
                    <div className="font-semibold mb-1">Average Return</div>
                    <div className="text-slate-300">Formula: Σ(Returns) ÷ Count</div>
                    <div className="text-slate-400 text-[10px] mt-1">Mean return across all periods</div>
                </div>
            )
        },
        { 
            label: 'Total Profit', 
            value: `₹${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
            trend: totalProfit > 0 ? 'up' : 'down', 
            subType: `on ₹${((10000 * parseInt(process.env.NEXT_PUBLIC_INR_RATE || '83', 10)) / 100000).toFixed(1)}L`,
            tooltip: (
                <div>
                    <div className="font-semibold mb-1">Total Profit</div>
                    <div className="text-slate-300">Formula: Investment × (Total Return %)</div>
                    <div className="text-slate-400 text-[10px] mt-1">Absolute profit on ₹10L investment</div>
                </div>
            )
        },
        { 
            label: 'Win %', 
            value: `${(stats?.winRate || 0).toFixed(1)}%`, 
            trend: (stats?.winRate || 0) > 50 ? 'up' : 'down', 
            subType: `${stats?.winningEvents || 0}/${stats?.totalEvents || 0}`,
            tooltip: (
                <div>
                    <div className="font-semibold mb-1">Win Rate</div>
                    <div className="text-slate-300">Formula: (Winning Trades ÷ Total Trades) × 100</div>
                    <div className="text-slate-400 text-[10px] mt-1">Percentage of profitable periods</div>
                </div>
            )
        },
    ];

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col h-full font-sans">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Analytics Matrix</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-400">
                    DISTRIBUTION
                </span>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 mb-4 relative">
                    {distributionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={distributionData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 text-white text-xs p-2 rounded shadow-xl border border-slate-800">
                                                    <p className="font-bold mb-1">Return: {payload[0].payload.range}%</p>
                                                    <p className="text-indigo-300">Count: {payload[0].value}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300 text-xs font-medium">
                            No distribution data
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {metrics.map((m, i) => (
                        <div key={i} className="bg-slate-50/80 rounded-lg p-3 border border-slate-100/50 hover:bg-slate-50 transition-colors">
                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                                <SimpleTooltip content={m.tooltip}>
                                    <span className="inline-flex items-center gap-1 cursor-help">
                                        {m.label}
                                        <HelpCircle className="h-3 w-3 text-slate-300 hover:text-slate-500" />
                                    </span>
                                </SimpleTooltip>
                            </div>
                            <div className="flex items-end justify-between">
                                <div className="text-base font-bold text-slate-800 tracking-tight">{m.value}</div>
                                <div className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                    m.trend === 'up' ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                                )}>
                                    {m.trend === 'up' ? '↗' : '↘'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
