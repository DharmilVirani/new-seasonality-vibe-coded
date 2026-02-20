'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useChartDragSelect } from '@/hooks/useChartDragSelect';
import { useChartSelectionStore } from '@/store/chartSelectionStore';
import { DragSelectOverlay } from './DragSelectOverlay';
import { Button } from '@/components/ui/button';
import { X, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CumulativeChartWithDragSelectProps {
  data: any[];
  chartScale?: 'linear' | 'log';
  onRangeSelected?: (startDate: string, endDate: string) => void;
  chartColor?: string;
  compareData?: any[];
  compareColor?: string;
}

export function CumulativeChartWithDragSelect({
  data,
  chartScale = 'linear',
  onRangeSelected,
  chartColor = '#10b981',
  compareData,
  compareColor = '#dc2626',
}: CumulativeChartWithDragSelectProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    date: string;
    value: number;
    compareValue?: number | null;
  } | null>(null);

  const { timeRangeSelection, setTimeRangeSelection, clearTimeRangeSelection } = 
    useChartSelectionStore();

  // Initialize drag select hook
  const { selection, clearSelection, containerRef, isSelecting } = useChartDragSelect(
    chartRef,
    seriesRef,
    {
      onSelectionComplete: (dragSelection) => {
        if (dragSelection.startTime && dragSelection.endTime) {
          setTimeRangeSelection({
            startTime: dragSelection.startTime,
            endTime: dragSelection.endTime,
            startDate: null, // Will be calculated in store
            endDate: null,
            isActive: true,
          });

          // Notify parent component
          const startTimestamp = typeof dragSelection.startTime === 'number'
            ? dragSelection.startTime * 1000
            : new Date(dragSelection.startTime as any).getTime();
          const endTimestamp = typeof dragSelection.endTime === 'number'
            ? dragSelection.endTime * 1000
            : new Date(dragSelection.endTime as any).getTime();

          const startDate = new Date(startTimestamp).toISOString().split('T')[0];
          const endDate = new Date(endTimestamp).toISOString().split('T')[0];

          onRangeSelected?.(startDate, endDate);
        }
      },
      minSelectionWidth: 20,
      throttleMs: 16,
    }
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

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
        vertLine: {
          width: 1,
          color: chartColor,
          style: 2,
        },
        horzLine: {
          width: 1,
          color: chartColor,
          style: 2,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      // Disable chart panning/dragging to allow our drag-to-select
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: false, // Disable drag to pan
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: false,
        axisDoubleClickReset: true,
      },
    });

    chartRef.current = chart;

    // Prepare data
    const isEventData = data.length > 0 && data[0].relativeDay !== undefined;
    
    const chartData = isEventData 
      ? data.map((d: any, index: number) => ({
          time: index as any,
          value: d.cumulative || 0,
          originalDate: d.date,
          relativeDay: d.relativeDay,
        }))
      : data.map((d: any) => ({
          time: Math.floor(new Date(d.date).getTime() / 1000) as any,
          value: d.cumulative || 0,
          originalDate: d.date,
        }));

    // Add area series for cumulative
    const areaSeries = chart.addAreaSeries({
      lineColor: chartColor,
      topColor: `${chartColor}66`,
      bottomColor: `${chartColor}00`,
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;
    areaSeries.setData(chartData);

    // Add comparison series if provided
    if (compareData && compareData.length > 0) {
      const compareChartData = compareData.map((d: any) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000) as any,
        value: d.cumulative || 0,
      }));

      const compareSeries = chart.addLineSeries({
        color: compareColor,
        lineWidth: 2,
        title: 'Compare',
      });
      compareSeries.setData(compareChartData);
    }

    chart.timeScale().fitContent();

    // For event data, customize time scale to show relative days
    if (isEventData) {
      chart.timeScale().applyOptions({
        // @ts-ignore - tickMarkFormatter exists but not in types
        tickMarkFormatter: (time: any) => {
          const index = Math.floor(time);
          if (index >= 0 && index < chartData.length) {
            const relDay = (chartData[index] as any).relativeDay;
            if (relDay === 0) return '0';
            return relDay > 0 ? `+${relDay}` : `${relDay}`;
          }
          return '';
        },
      });
    }

    // Tooltip handler
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const seriesData = param.seriesData;
      const firstSeries = seriesData.keys().next().value;
      
      if (firstSeries) {
        const dataPoint = seriesData.get(firstSeries);
        const cumulativeValue = dataPoint?.value ?? 0;
        
        // Get compare value if available
        let compareValue: number | null = null;
        if (compareData && compareData.length > 0) {
          const compareSeriesKey = seriesData.keys().next().value;
          if (compareSeriesKey) {
            const compareDataPoint = seriesData.get(compareSeriesKey);
            compareValue = compareDataPoint?.value ?? null;
          }
        }
        
        const chartDataPoint = chartData[param.time];
        const dateStr = isEventData
          ? chartDataPoint?.originalDate || `Day ${param.time}`
          : new Date(param.time * 1000).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          date: dateStr,
          value: cumulativeValue,
          compareValue,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Draw T0 vertical line overlay for event data
    if (isEventData && chartContainerRef.current) {
      const t0Index = chartData.findIndex((d: any) => d.relativeDay === 0);
      
      if (t0Index !== -1) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        canvas.width = chartContainerRef.current.clientWidth;
        canvas.height = chartContainerRef.current.clientHeight;
        
        chartContainerRef.current.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const drawT0Line = () => {
            const timeScale = chart.timeScale();
            const x = timeScale.timeToCoordinate(t0Index as any);
            
            if (x !== null) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Draw vertical line
              ctx.strokeStyle = '#9900ffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height);
              ctx.stroke();
              
              // Draw label
              ctx.fillStyle = '#DC2626';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('',x, 10);
            }
          };
          
          drawT0Line();
          
          // Redraw on scroll/zoom
          chart.timeScale().subscribeVisibleLogicalRangeChange(drawT0Line);
          
          return () => {
            canvas.remove();
          };
        }
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, chartScale]);

  // Handle clear selection
  const handleClearSelection = () => {
    clearSelection();
    clearTimeRangeSelection();
  };

  // Merge refs
  useEffect(() => {
    if (chartContainerRef.current) {
      (containerRef as any).current = chartContainerRef.current;
    }
  }, [containerRef]);

  return (
    <div className="h-full w-full relative">
      {/* Selection controls */}
      {(selection.isActive || timeRangeSelection.isActive) && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
            Range Selected: {timeRangeSelection.startDate} to {timeRangeSelection.endDate}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearSelection}
            className="bg-white hover:bg-red-50 border-red-200 text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Selection
          </Button>
        </div>
      )}

      {/* Instruction hint */}
      {!selection.isActive && !timeRangeSelection.isActive && (
        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm px-3 py-1.5 text-xs text-slate-600 flex items-center gap-2">
          <MousePointerClick className="h-3.5 w-3.5" style={{ color: chartColor }} />
          <span>Click and drag to select time range</span>
        </div>
      )}

      {/* Chart container with custom cursor */}
      <div
        ref={chartContainerRef}
        className={cn(
          "h-full w-full relative",
          selection.isDragging ? "cursor-col-resize" : "cursor-crosshair"
        )}
      >
        {/* Drag selection overlay */}
        <DragSelectOverlay
          chartRef={chartRef}
          selection={selection}
          containerRef={chartContainerRef}
          color={chartColor}
        />

        {/* Regular tooltip (only show when not selecting) */}
        {tooltip && tooltip.visible && !selection.isDragging && (
          <div
            className="absolute pointer-events-none bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs z-50"
            style={{
              left: `${tooltip.x + 10}px`,
              top: `${tooltip.y - 50}px`,
            }}
          >
            <div className="font-semibold text-slate-700 mb-1">{tooltip.date}</div>
            <div className={`font-bold`} style={{ color: chartColor }}>
              Cumulative: {tooltip.value.toFixed(2)}%
            </div>
            {tooltip.compareValue !== null && tooltip.compareValue !== undefined && (
              <div className={`font-bold`} style={{ color: compareColor }}>
                Compare: {tooltip.compareValue.toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
