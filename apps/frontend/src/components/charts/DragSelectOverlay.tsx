import React, { useEffect, useState, useRef } from 'react';
import { IChartApi, Time } from 'lightweight-charts';
import { DragSelection } from '@/hooks/useChartDragSelect';
import { cn } from '@/lib/utils';

interface DragSelectOverlayProps {
  chartRef: React.MutableRefObject<IChartApi | null>;
  selection: DragSelection;
  containerRef: React.RefObject<HTMLDivElement>;
  color?: string;
}

export function DragSelectOverlay({ 
  chartRef, 
  selection, 
  containerRef,
  color = '#4F46E5'
}: DragSelectOverlayProps) {
  const [overlayStyle, setOverlayStyle] = useState<{
    left: number;
    width: number;
    display: boolean;
  }>({ left: 0, width: 0, display: false });

  const [tooltips, setTooltips] = useState<{
    start: { x: number; date: string; value: string } | null;
    end: { x: number; date: string; value: string } | null;
  }>({ start: null, end: null });

  useEffect(() => {
    if (!chartRef.current || !selection.startTime || !selection.endTime) {
      setOverlayStyle({ left: 0, width: 0, display: false });
      setTooltips({ start: null, end: null });
      return;
    }

    const chart = chartRef.current;
    const timeScale = chart.timeScale();

    try {
      // Convert times to pixel coordinates
      const startX = timeScale.timeToCoordinate(selection.startTime);
      const endX = timeScale.timeToCoordinate(selection.endTime);

      if (startX === null || endX === null) {
        setOverlayStyle({ left: 0, width: 0, display: false });
        return;
      }

      // Ensure left is always the smaller value
      const left = Math.min(startX, endX);
      const right = Math.max(startX, endX);
      const width = right - left;

      setOverlayStyle({
        left,
        width,
        display: true,
      });

      // Format tooltips
      const formatDate = (time: Time) => {
        const timestamp = typeof time === 'number' ? time * 1000 : new Date(time as any).getTime();
        return new Date(timestamp).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const formatValue = (value: number | null) => {
        return value !== null ? value.toFixed(2) : 'N/A';
      };

      setTooltips({
        start: {
          x: startX,
          date: formatDate(selection.startTime),
          value: formatValue(selection.startValue),
        },
        end: {
          x: endX,
          date: formatDate(selection.endTime),
          value: formatValue(selection.endValue),
        },
      });
    } catch (error) {
      console.error('Error calculating overlay position:', error);
      setOverlayStyle({ left: 0, width: 0, display: false });
    }
  }, [chartRef, selection]);

  if (!overlayStyle.display) return null;

  // Convert hex color to rgba for overlay backgrounds
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgColor = hexToRgba(color, 0.15);
  const borderColor = hexToRgba(color, 0.8);

  return (
    <>
      {/* Semi-transparent selection overlay */}
      <div
        className={cn(
          "absolute top-0 bottom-0 pointer-events-none z-10 transition-opacity",
          selection.isDragging ? "opacity-100" : "opacity-80"
        )}
        style={{
          left: `${overlayStyle.left}px`,
          width: `${overlayStyle.width}px`,
          backgroundColor: bgColor,
          borderLeft: `2px solid ${borderColor}`,
          borderRight: `2px solid ${borderColor}`,
        }}
      >
        {/* Vertical boundary lines */}
        <div
          className="absolute top-0 bottom-0 left-0 w-[2px]"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${borderColor}` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 w-[2px]"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${borderColor}` }}
        />
      </div>

      {/* Start boundary tooltip */}
      {tooltips.start && (
        <div
          className="absolute pointer-events-none z-20 animate-in fade-in duration-200"
          style={{
            left: `${tooltips.start.x}px`,
            top: '10px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-white border-2 rounded-lg shadow-lg px-3 py-2 text-xs" style={{ borderColor: color }}>
            <div className="font-bold mb-1" style={{ color }}>START</div>
            <div className="text-slate-700 font-semibold">{tooltips.start.date}</div>
            <div className="text-slate-600">Value: {tooltips.start.value}</div>
          </div>
          {/* Arrow pointing down */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${color}`,
              top: '100%',
            }}
          />
        </div>
      )}

      {/* End boundary tooltip */}
      {tooltips.end && (
        <div
          className="absolute pointer-events-none z-20 animate-in fade-in duration-200"
          style={{
            left: `${tooltips.end.x}px`,
            top: '10px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-white border-2 rounded-lg shadow-lg px-3 py-2 text-xs" style={{ borderColor: color }}>
            <div className="font-bold mb-1" style={{ color }}>END</div>
            <div className="text-slate-700 font-semibold">{tooltips.end.date}</div>
            <div className="text-slate-600">Value: {tooltips.end.value}</div>
          </div>
          {/* Arrow pointing down */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${color}`,
              top: '100%',
            }}
          />
        </div>
      )}

      {/* Selection info badge (center) */}
      {selection.isActive && overlayStyle.width > 100 && (
        <div
          className="absolute pointer-events-none z-20 animate-in fade-in duration-300"
          style={{
            left: `${overlayStyle.left + overlayStyle.width / 2}px`,
            bottom: '10px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-white rounded-full px-4 py-1.5 text-xs font-bold shadow-lg" style={{ backgroundColor: color }}>
            SELECTED RANGE
          </div>
        </div>
      )}
    </>
  );
}
