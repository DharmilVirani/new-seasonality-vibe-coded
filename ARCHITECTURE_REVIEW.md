# Software Architecture Review - New Seasonality

## Overall Rating: 6.5/10

The architecture is decent but has several issues affecting performance (slow startup), maintainability, and code quality. Below is a detailed analysis.

---

## Critical Issues

### 1. **Slow Startup - Root Causes**

| Issue | Location | Impact |
|-------|----------|--------|
| Synchronous DB connection at startup | `apps/backend/src/app.js:106` | Blocks server start until DB ready |
| All routes loaded eagerly | `apps/backend/src/routes/index.js` | No lazy loading |
| No lazy imports for heavy services | Throughout backend | Loads all services even if unused |
| Redis/MinIO blocking connections | `apps/backend/src/utils/` | Delays startup if services unavailable |

**Fix for slow startup:**

```javascript
// app.js - Make routes lazy loaded
const startServer = async () => {
  try {
    // Start server FIRST, then connect DB in background
    const server = app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
    });

    // Connect DB in background (non-blocking)
    prisma.$connect().then(() => logger.info('Database connected'))
      .catch(err => logger.error('DB connection failed', { error: err.message }));
    
    // ... rest of startup
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
  }
};
```

### 2. **Massive Files Violating 200-Line Rule**

| File | Lines | Recommendation |
|------|-------|----------------|
| `AnalysisService.js` | 1350 | Split into domain-specific services |
| `analysisRoutes.js` | 1045 | Split by analysis type (daily/weekly/monthly) |
| `calculations.js` | 620 | Split into calculation modules |

**Action:** Split `AnalysisService.js` into:
- `DailyAnalysisService.js`
- `WeeklyAnalysisService.js`
- `MonthlyAnalysisService.js`
- `YearlyAnalysisService.js`
- `EventAnalysisService.js`
- `ScenarioAnalysisService.js`

### 3. **Code Duplication**

| Function | Duplicated In |
|----------|---------------|
| `debounce` | `src/lib/utils.ts` + `src/utils/chartHelpers.ts` |
| `formatDate` | `src/lib/utils.ts` + `src/utils/chartHelpers.ts` |

**Fix:** Remove from `chartHelpers.ts`, use `src/lib/utils.ts` only.

---

## Architecture Flaws

### 4. **Generic Naming (Anti-Pattern)**

Current problematic naming:
- `apps/frontend/src/utils/chartHelpers.ts` → Should be `ChartDateFormatter.ts`
- `apps/frontend/src/utils/` → Consider domain-specific like `apps/frontend/src/formatters/`

### 5. **No Lazy Loading in Frontend**

All heavy chart libraries loaded at startup:
```javascript
// next.config.js - Add dynamic imports
const nextConfig = {
  // ... existing config
  experimental: {
    optimizePackageImports: ['recharts', 'lightweight-charts', 'lucide-react'],
  },
};
```

**Fix chart components:**
```typescript
// Use dynamic imports for heavy charts
import dynamic from 'next/dynamic';

const SeasonalityChart = dynamic(
  () => import('@/components/charts/SeasonalityChart'),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

### 6. **Missing Error Boundaries**

Frontend has no error boundaries - a single chart crash takes down the whole page.

**Add to layout.tsx:**
```typescript
'use client';
import { ErrorBoundary } from 'react-error-boundary';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

### 7. **Security Issues**

| Issue | Location | Fix |
|-------|----------|-----|
| CORS allows all origins | `app.js:37-42` | Restrict to frontend domain |
| No global rate limiting | Missing | Add to auth routes |
| Hardcoded secrets potential | Check `.env` | Use env vars only |

**Fix CORS:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

### 8. **No API Response Caching**

Every request hits the database. Add Redis caching:

```javascript
// In analysisRoutes.js
const cachedAnalysis = await redis.get(`analysis:${cacheKey}`);
if (cachedAnalysis) {
  return res.json(JSON.parse(cachedAnalysis));
}

// After generating response
await redis.setex(`analysis:${cacheKey}`, 3600, JSON.stringify(result));
```

---

## Missing Best Practices

### 9. **No Input Validation Middleware**

Add Zod validation to routes:
```javascript
// middleware/validation.js
const validateRequest = (schema) => [
  body(schema),
  validationMiddleware
];

// Usage in routes
router.post('/analysis', 
  validateRequest(analysisSchema),
  analysisController
);
```

### 10. **No Request ID Tracking**

Add request correlation for debugging:
```javascript
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});
```

### 11. **No Health Check for Dependencies**

Current health check only checks DB. Add comprehensive check:
```javascript
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'healthy';
  } catch {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'healthy';
  } catch {
    health.services.redis = 'unhealthy';
  }
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

---

## Recommended Refactoring Plan

### Priority 1 - Performance (Startup Time)
1. [ ] Make DB connection non-blocking
2. [ ] Add lazy loading for routes
3. [ ] Implement Redis caching

### Priority 2 - Maintainability
1. [ ] Split AnalysisService.js (1350 → 6 files)
2. [ ] Split analysisRoutes.js (1045 → modular)
3. [ ] Remove duplicate debounce/formatDate

### Priority 3 - Security
1. [ ] Fix CORS to restrict origins
2. [ ] Add rate limiting
3. [ ] Add input validation

### Priority 4 - UX
1. [ ] Add error boundaries
2. [ ] Lazy load chart components
3. [ ] Optimize package imports

---

## Summary

| Category | Score | Issues |
|----------|-------|--------|
| Performance | 5/10 | Slow startup, no caching |
| Maintainability | 5/10 | Files too large, duplication |
| Security | 8/10 | CORS fixed, rate limiting added |
| Code Quality | 7/10 | Good structure, needs refactoring |
| Scalability | 7/10 | Good DB schema, needs caching |

**Overall: 7/10** - Fixed startup performance and security issues. Still needs file refactoring for maintainability.

---

## ✅ Completed Fixes

1. ✅ **Backend startup** - DB connection now non-blocking
2. ✅ **CORS security** - Restricted to configurable origins  
3. ✅ **Rate limiting** - Applied to auth endpoints (login, register, password reset)
4. ✅ **Next.js optimization** - Added `optimizePackageImports` for recharts, lightweight-charts

---

## Remaining Tasks

- [ ] Split AnalysisService.js (1350 lines → 6 services)
- [ ] Split analysisRoutes.js (1045 lines → modular)
- [ ] Add Redis caching for API responses
- [ ] Add lazy loading for chart components in frontend
- [ ] Add error boundaries
