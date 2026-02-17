// Chart Types and Interfaces

export interface ChartConfig {
  title?: string;
  subtitle?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  responsive?: boolean;
}

export interface OHLCData {
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TimeSeriesData {
  date: string | Date;
  value: number;
  label?: string;
}

export interface ReturnData {
  date: string | Date;
  returnPercentage: number;
  returnPoints?: number;
  cumulativeReturn?: number;
}

export interface YearlyOverlayData {
  dayNumber: number;
  [year: string]: number;
}

export interface AggregateData {
  field: string | number;
  total: number;
  avg: number;
  max: number;
  min: number;
  count: number;
  posCount: number;
  negCount: number;
  posAccuracy: number;
  negAccuracy: number;
}

export interface HeatmapCell {
  x: string | number;
  y: string | number;
  value: number;
}

export interface StatisticsData {
  allCount: number;
  avgReturnAll: number;
  sumReturnAll: number;
  posCount: number;
  posAccuracy: number;
  avgReturnPos: number;
  sumReturnPos: number;
  negCount: number;
  negAccuracy: number;
  avgReturnNeg: number;
  sumReturnNeg: number;
}

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'percentage' | 'currency' | 'date';
  colorCode?: boolean;
  tooltipKey?: string;
}

export interface ChartColors {
  primary: string;
  positive: string;
  negative: string;
  neutral: string;
  grid: string;
  text: string;
  background: string;
}

// Default color schemes
export const defaultColors: ChartColors = {
  primary: '#3b82f6',
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
  grid: '#e5e7eb',
  text: '#374151',
  background: '#ffffff',
};

export const electionColors: Record<string, string> = {
  'All Years': '#000000',
  'Election Years': '#000000',
  'Post Election Years': '#008000',
  'Pre Election Years': '#FF0000',
  'Mid Election Years': '#0000FF',
  'Modi Years': '#FF00FF',
  'Current Year': '#AD0AFD',
};

export const yearColors: string[] = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#1a1a1a', '#ff5733', '#33ff57', '#337aff', '#ff33cc',
  '#ffe333', '#3333ff', '#9933ff', '#ff3333', '#33ffcc',
];
