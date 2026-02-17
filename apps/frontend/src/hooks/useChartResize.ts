'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseResizeObserverOptions {
  onResize?: () => void;
  debounceMs?: number;
}

export function useChartResize(onResize?: () => void, debounceMs = 100) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const handleResize = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onResize?.();
    }, debounceMs);
  }, [onResize, debounceMs]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleResize]);

  return { triggerResize: handleResize };
}

// Hook for components that need to respond to layout changes
export function useLayoutChangeDetector() {
  const [key, setKey] = useState(0);
  
  // This can be called to force re-render when layout changes
  const forceUpdate = useCallback(() => {
    setKey(k => k + 1);
  }, []);

  return { key, forceUpdate };
}

export default useChartResize;
