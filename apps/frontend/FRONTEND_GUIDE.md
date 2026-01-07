# 🎨 Seasonality SaaS Frontend Guide

## Overview

Modern Next.js 14 frontend for the Seasonality SaaS platform with 11 analysis tabs, 40+ filters, and comprehensive charting capabilities.

## Quick Start

```bash
cd apps/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Custom components
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Dashboard with 11 tabs
│   │   │   └── dashboard/
│   │   │       ├── daily/     # Daily analysis
│   │   │       ├── weekly/    # Weekly analysis
│   │   │       ├── monthly/   # Monthly analysis
│   │   │       ├── yearly/    # Yearly overlay
│   │   │       ├── scenario/  # Scenario testing
│   │   │       ├── election/  # Election analysis
│   │   │       ├── scanner/   # Symbol scanner
│   │   │       ├── backtester/# Backtesting
│   │   │       ├── phenomena/ # Pattern detection
│   │   │       ├── basket/    # Portfolio analysis
│   │   │       └── charts/    # Chart visualizations
│   │   ├── admin/             # Admin panel
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   ├── providers.tsx      # React Query provider
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── ui/                # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   ├── layout/            # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── TabNavigation.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── filters/           # Filter components
│   │   │   ├── SymbolSelector.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── YearFilters.tsx
│   │   │   ├── MonthFilters.tsx
│   │   │   ├── WeekFilters.tsx
│   │   │   ├── DayFilters.tsx
│   │   │   └── OutlierFilters.tsx
│   │   └── charts/            # Chart components
│   │       ├── SeasonalityChart.tsx
│   │       ├── StatisticsCard.tsx
│   │       └── DataTable.tsx
│   ├── lib/
│   │   ├── api.ts             # API client (axios)
│   │   ├── types.ts           # TypeScript types
│   │   └── utils.ts           # Utility functions
│   └── store/
│       ├── authStore.ts       # Auth state (Zustand)
│       └── analysisStore.ts   # Analysis state
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

## API Integration

### API Client (`src/lib/api.ts`)

```typescript
import { analysisApi, authApi, uploadApi } from '@/lib/api';

// Authentication
await authApi.login(email, password);
await authApi.register({ email, password, name });
await authApi.me();

// Analysis endpoints
await analysisApi.daily({ symbols, startDate, endDate, filters });
await analysisApi.weekly({ symbols, startDate, endDate, weekType, filters });
await analysisApi.monthly({ symbols, startDate, endDate, filters });
await analysisApi.yearly({ symbols, startDate, endDate, overlayType });
await analysisApi.scenario({ symbol, entryDay, exitDay, ... });
await analysisApi.election({ symbols, startDate, endDate, filters });
await analysisApi.scanner({ trendType, consecutiveDays, criteria });
await analysisApi.backtest({ symbol, positionSize, stopLoss, takeProfit });
await analysisApi.phenomena({ symbol, phenomenaType, threshold });
await analysisApi.basket({ symbols, startDate, endDate });
await analysisApi.chart({ symbol, chartType });

// File uploads
await uploadApi.createBatch(formData);
await uploadApi.listBatches();
await uploadApi.processBatch(batchId);
```

### Using React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { analysisApi } from '@/lib/api';

// Fetch data
const { data, isLoading, refetch } = useQuery({
  queryKey: ['daily-analysis', symbols, filters],
  queryFn: () => analysisApi.daily({ symbols, startDate, endDate, filters }),
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => analysisApi.scenario(data),
  onSuccess: () => toast.success('Analysis complete!'),
});
```

## State Management

### Auth Store (`src/store/authStore.ts`)

```typescript
import { useAuthStore } from '@/store/authStore';

const { user, isAuthenticated, login, logout, checkAuth } = useAuthStore();
```

### Analysis Store (`src/store/analysisStore.ts`)

```typescript
import { useAnalysisStore } from '@/store/analysisStore';

const {
  selectedSymbols,
  startDate,
  endDate,
  filters,
  chartScale,
  setSelectedSymbols,
  setDateRange,
  updateFilter,
  resetFilters,
} = useAnalysisStore();
```

## Filter Configuration

### Available Filters

```typescript
interface FilterConfig {
  yearFilters: {
    positiveNegativeYears: 'All' | 'Positive' | 'Negative';
    evenOddYears: 'All' | 'Even' | 'Odd' | 'Leap' | 'Election';
    decadeYears: number[];
  };
  monthFilters: {
    positiveNegativeMonths: 'All' | 'Positive' | 'Negative';
    evenOddMonths: 'All' | 'Even' | 'Odd';
    specificMonth: number; // 0-12
  };
  weekFilters: {
    positiveNegativeWeeks: 'All' | 'Positive' | 'Negative';
    evenOddWeeksMonthly: 'All' | 'Even' | 'Odd';
    specificWeekMonthly: number; // 0-5
  };
  dayFilters: {
    positiveNegativeDays: 'All' | 'Positive' | 'Negative';
    weekdays: string[];
    evenOddCalendarDaysMonthly: 'All' | 'Even' | 'Odd';
    evenOddTradingDaysMonthly: 'All' | 'Even' | 'Odd';
  };
  outlierFilters: {
    dailyPercentageRange: { enabled: boolean; min: number; max: number };
    weeklyPercentageRange: { enabled: boolean; min: number; max: number };
    monthlyPercentageRange: { enabled: boolean; min: number; max: number };
    yearlyPercentageRange: { enabled: boolean; min: number; max: number };
  };
}
```

## 11 Analysis Tabs

| Tab | Route | Description | Tier |
|-----|-------|-------------|------|
| Daily | `/dashboard/daily` | Daily analysis with 40+ filters | All |
| Weekly | `/dashboard/weekly` | Monday/Expiry weekly analysis | All |
| Monthly | `/dashboard/monthly` | Monthly patterns | All |
| Yearly | `/dashboard/yearly` | Yearly overlay charts | All |
| Scenario | `/dashboard/scenario` | Day-to-day trading scenarios | All |
| Election | `/dashboard/election` | Political cycle analysis | All |
| Scanner | `/dashboard/scanner` | Multi-symbol pattern scanner | Basic+ |
| Backtester | `/dashboard/backtester` | Strategy backtesting | Premium+ |
| Phenomena | `/dashboard/phenomena` | Pattern detection | Basic+ |
| Basket | `/dashboard/basket` | Portfolio correlation | Enterprise |
| Charts | `/dashboard/charts` | Chart visualizations | All |

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Styling

### Tailwind CSS Variables

```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}
```

### Utility Classes

```typescript
import { cn } from '@/lib/utils';

// Merge class names
<div className={cn('base-class', condition && 'conditional-class')} />

// Format helpers
formatDate(date);        // "06 Jan 2026"
formatPercentage(0.05);  // "+0.05%"
formatCurrency(1000);    // "₹1,000.00"
getReturnColor(0.5);     // "text-green-600"
```

## Adding New Features

### 1. Add New Filter

```typescript
// 1. Add to types.ts
interface FilterConfig {
  newFilter: { ... };
}

// 2. Create component in components/filters/
export function NewFilter() {
  const { filters, updateFilter } = useAnalysisStore();
  // ...
}

// 3. Export from index.ts
export { NewFilter } from './NewFilter';

// 4. Use in tab page
<NewFilter />
```

### 2. Add New Chart Type

```typescript
// 1. Create in components/charts/
export function NewChart({ data }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        {/* ... */}
      </LineChart>
    </ResponsiveContainer>
  );
}

// 2. Export and use
import { NewChart } from '@/components/charts';
```

### 3. Add New Tab

```typescript
// 1. Create page at app/(dashboard)/dashboard/newtab/page.tsx
export default function NewTabPage() {
  return <div>New Tab Content</div>;
}

// 2. Add to TabNavigation.tsx
const tabs = [
  // ...existing tabs
  { name: 'NewTab', href: '/dashboard/newtab', icon: IconName },
];
```

## Performance Optimization

- React Query caching (1 minute stale time)
- Pagination for large data tables
- Lazy loading for charts
- Debounced filter updates
- Memoized chart data calculations

## Deployment

```bash
# Build
npm run build

# The output is in .next/ directory
# Deploy to any Node.js hosting or static hosting with SSR support
```

## Support

- Backend API: See `apps/backend/BACKEND_API_GUIDE.md`
- Infrastructure: See `INFRASTRUCTURE_SETUP_GUIDE.md`
- Database: See `DATABASE_DESIGN.md`
