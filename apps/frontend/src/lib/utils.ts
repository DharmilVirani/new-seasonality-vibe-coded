import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(num: number, decimals = 2): string {
  return num.toFixed(decimals);
}

export function formatPercentage(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}

export const TAB_COLORS = {
  daily: {
    accent: '#0d9488', // teal-600
    accentLight: '#2dd4bf', // teal-400
    accentMuted: '#f0fdfa', // teal-50
    gradient: 'from-teal-600 to-teal-700',
  },
  weekly: {
    accent: '#06b6d4', // cyan-600
    accentLight: '#22d3ee', // cyan-400
    accentMuted: '#ecfeff', // cyan-50
    gradient: 'from-cyan-600 to-cyan-700',
  },
  monthly: {
    accent: '#8b5cf6', // violet-600
    accentLight: '#a78bfa', // violet-400
    accentMuted: '#f5f3ff', // violet-50
    gradient: 'from-violet-600 to-violet-700',
  },
  yearly: {
    accent: '#6366f1', // indigo-600
    accentLight: '#818cf8', // indigo-400
    accentMuted: '#eef2ff', // indigo-50
    gradient: 'from-indigo-600 to-indigo-700',
  },
  events: {
    accent: '#3b82f6', // blue-600
    accentLight: '#60a5fa', // blue-400
    accentMuted: '#eff6ff', // blue-50
    gradient: 'from-blue-600 to-blue-700',
  },
  scenario: {
    accent: '#0ea5e9', // sky-600
    accentLight: '#38bdf8', // sky-400
    accentMuted: '#f0f9ff', // sky-50
    gradient: 'from-sky-600 to-sky-700',
  },
  election: {
    accent: '#d97706', // amber-600
    accentLight: '#fbbf24', // amber-400
    accentMuted: '#fffbeb', // amber-50
    gradient: 'from-amber-600 to-amber-700',
  },
  scanner: {
    accent: '#10b981', // emerald-600
    accentLight: '#34d399', // emerald-400
    accentMuted: '#ecfdf5', // emerald-50
    gradient: 'from-emerald-600 to-emerald-700',
  },
  backtester: {
    accent: '#f97316', // orange-600
    accentLight: '#fb923c', // orange-400
    accentMuted: '#fff7ed', // orange-50
    gradient: 'from-orange-600 to-orange-700',
  },
  phenomena: {
    accent: '#a855f7', // purple-600
    accentLight: '#c084fc', // purple-400
    accentMuted: '#faf5ff', // purple-50
    gradient: 'from-purple-600 to-purple-700',
  },
  basket: {
    accent: '#f43f5e', // rose-500
    accentLight: '#fb7185', // rose-400
    accentMuted: '#fff1f2', // rose-50
    gradient: 'from-rose-500 to-rose-600',
  },
  charts: {
    accent: '#475569', // slate-600
    accentLight: '#94a3b8', // slate-400
    accentMuted: '#f8fafc', // slate-50
    gradient: 'from-slate-600 to-slate-700',
  },
} as const;

export type TabName = keyof typeof TAB_COLORS;

export function getTabColor(tabName: TabName) {
  return TAB_COLORS[tabName] || TAB_COLORS.daily;
}

export const RETURN_COLORS = {
  positive: '#16a34a',
  positiveLight: '#86efac',
  negative: '#dc2626',
  negativeLight: '#fca5a5',
  compare: '#9333ea',
  compareLight: '#c084fc',
} as const;

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
