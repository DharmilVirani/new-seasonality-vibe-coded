'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Maximize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChartConfig } from './types';

interface ChartWrapperProps {
  config: ChartConfig;
  children: ReactNode;
  className?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  isLoading?: boolean;
}

export function ChartWrapper({
  config,
  children,
  className,
  onRefresh,
  onExport,
  onFullscreen,
  isLoading,
}: ChartWrapperProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.subtitle && (
            <CardDescription className="text-sm">{config.subtitle}</CardDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
          {onExport && (
            <Button variant="ghost" size="icon" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onFullscreen && (
            <Button variant="ghost" size="icon" onClick={onFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="w-full"
          style={{ height: config.height || 500 }}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
