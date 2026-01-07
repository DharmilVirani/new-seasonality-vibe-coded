# 📊 Seasonality SaaS Visualization Guide

## Overview

Comprehensive chart and visualization component library for the Seasonality SaaS platform. Built with Recharts for React, designed for easy AI Studio enhancement.

## Chart Components

### 1. ChartWrapper

Base wrapper component for all charts with consistent styling and controls.

```tsx
import { ChartWrapper } from '@/components/charts';

<ChartWrapper
  config={{
    title: 'My Chart',
    subtitle: 'Description',
    height: 500,
  }}
  onRefresh={() => refetch()}
  onExport={() => downloadCSV()}
  isLoading={isLoading}
>
  {/* Chart content */}
</ChartWrapper>
```

### 2. CandlestickChart

OHLC candlestick chart for price data visualization.

```tsx
import { CandlestickChart } from '@/components/charts';

<CandlestickChart
  data={ohlcData}
  symbol="NIFTY"
  showVolume={true}
  scale="linear" // or "log"
  config={{ title: 'NIFTY Price Chart' }}
/>
```

**Data Format:**
```typescript
interface OHLCData {
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
```

### 3. YearlyOverlayChart

Multiple years superimposed for pattern comparison.

```tsx
import { YearlyOverlayChart } from '@/components/charts';

<YearlyOverlayChart
  data={{
    '2020': returnData2020,
    '2021': returnData2021,
    '2022': returnData2022,
  }}
  symbol="NIFTY"
  overlayType="CalendarDays" // or "TradingDays"
  highlightCurrentYear={true}
/>
```

**Data Format:**
```typescript
// Record<year, ReturnData[]>
{
  '2023': [
    { date: '2023-01-01', returnPercentage: 0.5, cumulativeReturn: 0.5 },
    { date: '2023-01-02', returnPercentage: -0.2, cumulativeReturn: 0.3 },
    // ...
  ]
}
```

### 4. SuperimposedChart

Compare multiple symbols or election year types.

```tsx
import { SuperimposedChart } from '@/components/charts';

// Symbol comparison
<SuperimposedChart
  data={{
    'NIFTY': aggregateData,
    'BANKNIFTY': aggregateData,
  }}
  symbols={['NIFTY', 'BANKNIFTY']}
  fieldType="CalendarYearDay"
/>

// Election year comparison
<SuperimposedChart
  data={{
    'All Years': data,
    'Election Years': data,
    'Modi Years': data,
  }}
  electionTypes={['All Years', 'Election Years', 'Modi Years']}
  fieldType="TradingYearDay"
/>
```

### 5. AggregateChart

Bar chart for aggregated data (Total/Avg/Max/Min).

```tsx
import { AggregateChart } from '@/components/charts';

<AggregateChart
  data={aggregateData}
  symbol="NIFTY"
  aggregateType="total" // 'total' | 'avg' | 'max' | 'min'
  fieldType="CalendarMonthDay" // or 'Weekday', 'Month', etc.
/>
```

**Data Format:**
```typescript
interface AggregateData {
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
```

### 6. ReturnBarChart

Daily returns as colored bars.

```tsx
import { ReturnBarChart } from '@/components/charts';

<ReturnBarChart
  data={returnData}
  symbol="NIFTY"
  showCumulative={true}
/>
```

### 7. HeatmapChart

Correlation matrix or any 2D data visualization.

```tsx
import { HeatmapChart } from '@/components/charts';

<HeatmapChart
  data={correlationData}
  xLabels={['NIFTY', 'BANKNIFTY', 'RELIANCE']}
  yLabels={['NIFTY', 'BANKNIFTY', 'RELIANCE']}
  title="Correlation Matrix"
  colorScale="diverging" // or "sequential"
  valueFormat="decimal" // 'percentage' | 'decimal' | 'integer'
/>
```

**Data Format:**
```typescript
interface HeatmapCell {
  x: string | number;
  y: string | number;
  value: number;
}
```

### 8. ConsecutiveTrendChart

Visualize consecutive bullish/bearish patterns.

```tsx
import { ConsecutiveTrendChart } from '@/components/charts';

<ConsecutiveTrendChart
  data={trendPatterns}
  symbol="NIFTY"
/>
```

**Data Format:**
```typescript
interface ConsecutiveTrendData {
  startDate: string;
  endDate: string;
  days: number;
  direction: 'Bullish' | 'Bearish';
  totalReturn: number;
  avgReturn: number;
}
```

## Data Table Components

### 1. AdvancedDataTable

Full-featured data table with sorting, searching, pagination.

```tsx
import { AdvancedDataTable } from '@/components/charts';

<AdvancedDataTable
  data={tableData}
  columns={[
    { key: 'date', label: 'Date', format: 'date', sortable: true },
    { key: 'open', label: 'Open', format: 'number', align: 'right' },
    { key: 'close', label: 'Close', format: 'number', align: 'right' },
    { key: 'returnPct', label: 'Return %', format: 'percentage', colorCode: true },
  ]}
  title="Daily Data"
  pageSize={20}
  searchable={true}
  exportable={true}
/>
```

**Column Configuration:**
```typescript
interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'percentage' | 'currency' | 'date';
  colorCode?: boolean; // Green for positive, red for negative
}
```

### 2. MonthlyReturnsMatrix

Year x Month matrix for scenario analysis.

```tsx
import { MonthlyReturnsMatrix } from '@/components/charts';

<MonthlyReturnsMatrix
  data={{
    '2023': { Jan: 2.5, Feb: -1.2, Mar: 3.1, ..., Total: 15.3 },
    '2022': { Jan: -0.5, Feb: 1.8, Mar: -2.1, ..., Total: 8.7 },
  }}
  title="Monthly Returns"
  showTotal={true}
/>
```

## Statistics Components

### StatisticsPanel

Comprehensive statistics display.

```tsx
import { StatisticsPanel } from '@/components/charts';

<StatisticsPanel
  statistics={{
    allCount: 1500,
    avgReturnAll: 0.05,
    sumReturnAll: 75.5,
    posCount: 820,
    posAccuracy: 54.67,
    avgReturnPos: 0.85,
    sumReturnPos: 697,
    negCount: 680,
    negAccuracy: 45.33,
    avgReturnNeg: -0.91,
    sumReturnNeg: -621.5,
  }}
  symbol="NIFTY"
  compact={false} // true for inline display
/>
```

## Color Schemes

### Default Colors
```typescript
const defaultColors = {
  primary: '#3b82f6',   // Blue
  positive: '#22c55e',  // Green
  negative: '#ef4444',  // Red
  neutral: '#6b7280',   // Gray
  grid: '#e5e7eb',
  text: '#374151',
  background: '#ffffff',
};
```

### Election Year Colors
```typescript
const electionColors = {
  'All Years': '#000000',
  'Election Years': '#000000',
  'Post Election Years': '#008000',
  'Pre Election Years': '#FF0000',
  'Mid Election Years': '#0000FF',
  'Modi Years': '#FF00FF',
  'Current Year': '#AD0AFD',
};
```

### Year Overlay Colors
```typescript
const yearColors = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  // ... 20 distinct colors
];
```

## Field Types

Available field types for aggregation and overlay:

| Field Type | Description | Max Value |
|------------|-------------|-----------|
| CalendarYearDay | Day of year (1-365) | 365 |
| TradingYearDay | Trading day of year | ~252 |
| CalendarMonthDay | Day of month (1-31) | 31 |
| TradingMonthDay | Trading day of month | ~23 |
| Weekday | Day name (Mon-Fri) | 5 |
| Month | Month name (Jan-Dec) | 12 |

## API Integration

### Fetching Chart Data

```typescript
import { analysisApi } from '@/lib/api';

// Daily analysis with filters
const { data } = await analysisApi.daily({
  symbols: ['NIFTY'],
  startDate: '2016-01-01',
  endDate: '2023-12-31',
  filters: { ... },
});

// Response structure
{
  success: true,
  processingTime: 245,
  data: {
    NIFTY: {
      symbol: 'NIFTY',
      data: [...],           // Array of daily records
      statistics: {...},     // Statistics object
      maxConsecutive: {...}, // Max consecutive trends
      dataTable: [...],      // Formatted table data
    }
  }
}
```

### Chart Data Endpoint

```typescript
// Get formatted chart data
const { data } = await analysisApi.chart({
  symbol: 'NIFTY',
  startDate: '2023-01-01',
  endDate: '2023-12-31',
  chartType: 'candlestick', // 'line' | 'bar' | 'candlestick'
});
```

## Performance Optimization

### Large Datasets

1. **Pagination**: Use `AdvancedDataTable` with pagination for large datasets
2. **Virtualization**: Consider react-window for 10k+ rows
3. **Memoization**: Use `useMemo` for chart data transformations
4. **Lazy Loading**: Load chart data on tab activation

### Chart Rendering

```tsx
// Memoize expensive calculations
const chartData = useMemo(() => {
  return data.map(d => ({
    ...d,
    cumulativeReturn: calculateCumulative(d),
  }));
}, [data]);

// Limit data points for performance
const displayData = chartData.slice(-500); // Last 500 points
```

## AI Studio Enhancement Points

These components are designed for easy enhancement:

1. **ChartWrapper**: Add AI-powered insights panel
2. **CandlestickChart**: Add pattern recognition overlays
3. **YearlyOverlayChart**: Add prediction lines
4. **AggregateChart**: Add anomaly highlighting
5. **AdvancedDataTable**: Add smart filtering suggestions
6. **StatisticsPanel**: Add AI-generated insights

### Enhancement Example

```tsx
// Future AI enhancement
<ChartWrapper config={config}>
  <CandlestickChart data={data} symbol={symbol} />
  
  {/* AI Studio can add: */}
  <AIInsightsPanel data={data} />
  <PatternOverlay patterns={detectedPatterns} />
  <PredictionLine forecast={aiPrediction} />
</ChartWrapper>
```

## File Structure

```
src/components/charts/
├── index.ts                  # Exports all components
├── types.ts                  # TypeScript types & color schemes
├── ChartWrapper.tsx          # Base wrapper component
├── CandlestickChart.tsx      # OHLC candlestick
├── YearlyOverlayChart.tsx    # Multi-year comparison
├── SuperimposedChart.tsx     # Symbol/election comparison
├── AggregateChart.tsx        # Aggregated bar chart
├── ReturnBarChart.tsx        # Daily returns bars
├── HeatmapChart.tsx          # Correlation matrix
├── ConsecutiveTrendChart.tsx # Trend patterns
├── SeasonalityChart.tsx      # Cumulative return line
├── StatisticsCard.tsx        # Simple stats card
├── StatisticsPanel.tsx       # Detailed stats panel
├── DataTable.tsx             # Basic data table
├── AdvancedDataTable.tsx     # Full-featured table
└── MonthlyReturnsMatrix.tsx  # Year x Month matrix
```

## Dependencies

- **recharts**: Main charting library
- **@radix-ui/react-***: UI primitives
- **lucide-react**: Icons
- **tailwind-merge**: Class merging
- **clsx**: Conditional classes

## Support

- Frontend Guide: `apps/frontend/FRONTEND_GUIDE.md`
- Backend API: `apps/backend/BACKEND_API_GUIDE.md`
- Database: `DATABASE_DESIGN.md`
