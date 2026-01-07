# 📚 Seasonality SaaS Backend API Guide

## Overview

The Seasonality SaaS Backend API provides comprehensive seasonality analysis capabilities, replicating and extending the functionality of the original Python Dash application. Built with Express.js, it offers 11 analysis modules with 40+ filter options.

## Quick Start

```bash
# Install dependencies
cd apps/backend
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Start background worker (separate terminal)
npm run worker
```

## API Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

### JWT Token Authentication

```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}

# Response includes accessToken and refreshToken
```

### Using the Token

```bash
# Include in Authorization header
Authorization: Bearer <accessToken>

# Or use API key
X-API-Key: <your-api-key>
```

## Rate Limits

| Tier | Requests/Hour |
|------|---------------|
| Trial | 100 |
| Basic | 500 |
| Premium | 2,000 |
| Enterprise | 10,000 |

---

## Analysis Endpoints

### 1. Daily Analysis

**Endpoint:** `POST /api/analysis/daily`

Comprehensive daily timeframe analysis with 40+ filter options.

```json
{
  "symbols": ["NIFTY", "BANKNIFTY"],
  "startDate": "2016-01-01",
  "endDate": "2023-12-31",
  "lastNDays": 0,
  "filters": {
    "yearFilters": {
      "positiveNegativeYears": "All",
      "evenOddYears": "All",
      "decadeYears": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    "monthFilters": {
      "positiveNegativeMonths": "All",
      "evenOddMonths": "All",
      "specificMonth": 0
    },
    "dayFilters": {
      "positiveNegativeDays": "All",
      "weekdays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "evenOddCalendarDaysMonthly": "All",
      "evenOddTradingDaysMonthly": "All"
    },
    "outlierFilters": {
      "dailyPercentageRange": {
        "enabled": true,
        "min": -5,
        "max": 5
      }
    }
  },
  "chartScale": "linear"
}
```

**Response:**
```json
{
  "success": true,
  "processingTime": 245,
  "data": {
    "NIFTY": {
      "symbol": "NIFTY",
      "data": [...],
      "statistics": {
        "allCount": 1500,
        "avgReturnAll": 0.05,
        "sumReturnAll": 75.5,
        "posCount": 820,
        "posAccuracy": 54.67,
        "negCount": 680,
        "negAccuracy": 45.33
      },
      "maxConsecutive": {
        "maxPositive": 8,
        "maxNegative": 6
      },
      "dataTable": [...]
    }
  }
}
```

### 2. Weekly Analysis

**Endpoint:** `POST /api/analysis/weekly`

Weekly analysis with Monday or Expiry week options.

```json
{
  "symbols": ["NIFTY"],
  "startDate": "2019-01-01",
  "endDate": "2023-12-31",
  "weekType": "monday",
  "filters": {
    "weekFilters": {
      "positiveNegativeWeeks": "All",
      "evenOddWeeksMonthly": "All",
      "specificWeekMonthly": 0
    }
  }
}
```

### 3. Monthly Analysis

**Endpoint:** `POST /api/analysis/monthly`

Monthly timeframe analysis with year-over-year comparisons.

```json
{
  "symbols": ["NIFTY"],
  "startDate": "2010-01-01",
  "endDate": "2023-12-31",
  "aggregateType": "total"
}
```

### 4. Yearly Analysis

**Endpoint:** `POST /api/analysis/yearly`

Yearly overlay analysis for pattern comparison.

```json
{
  "symbols": ["NIFTY"],
  "startDate": "2010-01-01",
  "endDate": "2023-12-31",
  "overlayType": "CalendarDays"
}
```

### 5. Scenario Analysis

**Endpoint:** `POST /api/analysis/scenario`

Day-to-day trading scenario backtesting.

```json
{
  "symbol": "NIFTY",
  "startDate": "2019-01-01",
  "endDate": "2023-12-31",
  "entryType": "Close",
  "exitType": "Close",
  "tradeType": "Long",
  "entryDay": "Monday",
  "exitDay": "Friday",
  "returnType": "Percent"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trades": [...],
    "monthlyReturns": {
      "2019": { "Jan": 2.5, "Feb": -1.2, ..., "Total": 15.3 },
      "2020": { ... }
    },
    "statistics": {
      "allCount": 200,
      "avgReturnAll": 0.35,
      "posAccuracy": 58.5
    }
  }
}
```

### 6. Election Analysis

**Endpoint:** `POST /api/analysis/election`

Political cycle impact analysis.

```json
{
  "symbols": ["NIFTY"],
  "startDate": "2000-01-01",
  "endDate": "2023-12-31"
}
```

**Response includes analysis for:**
- All Years
- Election Years
- Pre-Election Years
- Post-Election Years
- Mid-Election Years
- Modi Years
- Current Year

### 7. Symbol Scanner

**Endpoint:** `POST /api/analysis/scanner`

Multi-symbol scanning for consecutive trending days.

```json
{
  "symbols": [],
  "startDate": "2016-01-01",
  "endDate": "2023-12-31",
  "filters": {
    "evenOddYears": "All",
    "specificMonth": 0
  },
  "trendType": "Bullish",
  "consecutiveDays": 3,
  "criteria": {
    "minAccuracy": 60,
    "minTotalPnl": 1.5,
    "minSampleSize": 50,
    "minAvgPnl": 0.2,
    "operations": {
      "op12": "OR",
      "op23": "OR",
      "op34": "OR"
    }
  }
}
```

### 8. Backtester (Premium)

**Endpoint:** `POST /api/analysis/backtest`

Phenomena backtesting engine.

```json
{
  "symbol": "NIFTY",
  "startDate": "2019-01-01",
  "endDate": "2023-12-31",
  "entryConditions": {...},
  "exitConditions": {...},
  "positionSize": 100,
  "stopLoss": 2,
  "takeProfit": 5
}
```

### 9. Phenomena Detection

**Endpoint:** `POST /api/analysis/phenomena`

Pattern recognition and phenomena detection.

```json
{
  "symbol": "NIFTY",
  "startDate": "2016-01-01",
  "endDate": "2023-12-31",
  "phenomenaType": "consecutive",
  "threshold": 3,
  "percentChange": 0
}
```

### 10. Basket Analysis (Enterprise)

**Endpoint:** `POST /api/analysis/basket`

Portfolio correlation analysis.

```json
{
  "symbols": ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS"],
  "startDate": "2019-01-01",
  "endDate": "2023-12-31"
}
```

### 11. Chart Data

**Endpoint:** `POST /api/analysis/chart`

Formatted chart data for visualization.

```json
{
  "symbol": "NIFTY",
  "startDate": "2023-01-01",
  "endDate": "2023-12-31",
  "chartType": "candlestick"
}
```

---

## Filter Reference

### Year Filters

| Filter | Values | Description |
|--------|--------|-------------|
| positiveNegativeYears | All, Positive, Negative | Filter by yearly return direction |
| evenOddYears | All, Even, Odd, Leap, Election | Filter by year type |
| decadeYears | [1-10] | Filter by last digit of year |
| specificYears | [year array] | Filter specific years |

### Month Filters

| Filter | Values | Description |
|--------|--------|-------------|
| positiveNegativeMonths | All, Positive, Negative | Filter by monthly return direction |
| evenOddMonths | All, Even, Odd | Filter by month number parity |
| specificMonth | 0-12 | Filter specific month (0 = all) |

### Week Filters

| Filter | Values | Description |
|--------|--------|-------------|
| weekType | monday, expiry | Week calculation basis |
| positiveNegativeWeeks | All, Positive, Negative | Filter by weekly return direction |
| evenOddWeeksMonthly | All, Even, Odd | Filter by week number in month |
| evenOddWeeksYearly | All, Even, Odd | Filter by week number in year |
| specificWeekMonthly | 0-5 | Filter specific week of month |

### Day Filters

| Filter | Values | Description |
|--------|--------|-------------|
| positiveNegativeDays | All, Positive, Negative | Filter by daily return direction |
| weekdays | [Monday-Friday] | Filter specific weekdays |
| evenOddCalendarDaysMonthly | All, Even, Odd | Filter by calendar day parity |
| evenOddTradingDaysMonthly | All, Even, Odd | Filter by trading day parity |

### Outlier Filters

| Filter | Range | Description |
|--------|-------|-------------|
| dailyPercentageRange | -5 to 5 | Remove daily outliers |
| weeklyPercentageRange | -15 to 15 | Remove weekly outliers |
| monthlyPercentageRange | -25 to 25 | Remove monthly outliers |
| yearlyPercentageRange | -50 to 50 | Remove yearly outliers |

---

## Upload Endpoints

### Create Upload Batch

**Endpoint:** `POST /api/upload/batch`

Upload CSV files for processing.

```bash
curl -X POST http://localhost:3001/api/upload/batch \
  -H "Authorization: Bearer <token>" \
  -F "files=@data.csv" \
  -F "name=January Data" \
  -F "description=Monthly data upload"
```

### List Batches

**Endpoint:** `GET /api/upload/batches`

### Get Batch Details

**Endpoint:** `GET /api/upload/batches/:batchId`

### Process Batch

**Endpoint:** `POST /api/upload/batches/:batchId/process`

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request parameters |
| AUTHENTICATION_ERROR | 401 | Invalid or missing token |
| AUTHORIZATION_ERROR | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Subscription Tiers

| Feature | Trial | Basic | Premium | Enterprise |
|---------|-------|-------|---------|------------|
| Daily Analysis | ✅ | ✅ | ✅ | ✅ |
| Weekly Analysis | ✅ | ✅ | ✅ | ✅ |
| Monthly Analysis | ✅ | ✅ | ✅ | ✅ |
| Yearly Analysis | ✅ | ✅ | ✅ | ✅ |
| Scenario Analysis | ✅ | ✅ | ✅ | ✅ |
| Election Analysis | ✅ | ✅ | ✅ | ✅ |
| Symbol Scanner | ❌ | ✅ | ✅ | ✅ |
| Backtester | ❌ | ❌ | ✅ | ✅ |
| Phenomena Detection | ❌ | ✅ | ✅ | ✅ |
| Basket Analysis | ❌ | ❌ | ❌ | ✅ |
| API Rate Limit | 100/hr | 500/hr | 2000/hr | 10000/hr |

---

## Development

### Project Structure

```
apps/backend/
├── src/
│   ├── app.js              # Main Express application
│   ├── config/             # Configuration
│   ├── middleware/         # Auth, validation, rate limiting
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   │   ├── AnalysisService.js
│   │   ├── FilterService.js
│   │   └── SeasonalityCalculationService.js
│   ├── jobs/               # Background workers
│   └── utils/              # Utilities (logger, prisma, redis)
├── prisma/
│   └── schema.prisma       # Database schema
└── package.json
```

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/seasonality

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

## Performance Notes

- API response time target: < 5 seconds
- Results are cached in Redis for 1 hour
- Heavy computations run in background workers
- TimescaleDB hypertables optimize time-series queries
- Compression enabled for data older than 3 months

---

## Support

For issues or questions, refer to:
- `INFRASTRUCTURE_SETUP_GUIDE.md` - Infrastructure setup
- `DATABASE_DESIGN.md` - Database architecture
- `CURRENT_IMPLEMENTATION_STATUS.md` - Implementation status
