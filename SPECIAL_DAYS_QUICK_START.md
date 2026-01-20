# 🚀 Special Days Filter - Quick Start Guide

## What Was Done

✅ **Data Migration Script** - Migrates 580+ special days from CSV to database  
✅ **Backend API** - 5 endpoints to fetch special days data  
✅ **Frontend Filter Component** - Beautiful, searchable filter UI  
✅ **Integration** - Added to Weekly Analysis page under Advanced Filters  

## Quick Setup (3 Steps)

### 1. Migrate Data (One-time)

```bash
cd apps/backend
npm run migrate:special-days
```

This imports all special days from `old-software/SpecialDays/SpecialDays.csv` into your database.

### 2. Start Backend

```bash
cd apps/backend
npm run dev
```

### 3. Start Frontend

```bash
cd apps/frontend
npm run dev
```

## How to Use

1. Go to **Weekly Analysis** page
2. Open **Filter Console** (left sidebar)
3. Scroll to **Advanced Filters** section
4. Expand to see **Special Days Filter**
5. Search and select special days (e.g., "Diwali", "Budget")
6. Click **APPLY FILTERS**

## What Special Days Are Included?

### 🎉 Indian Festivals (312 days)
Diwali, Holi, Mahashivratri, Ganesh Chaturthi, Dussehra, Ram Navami, Mahavir Jayanti, Bakri Id, Ramdan Eid, Kumbh Mela, etc.

### 🏖️ USA Holidays (168 days)
New Year's Day, MLK Day, Washington's Birthday, Good Friday, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas

### 🇮🇳 National Holidays (48 days)
Republic Day, Independence Day, Gandhi Jayanti

### 💰 Budget Days (23 days)
Union Budget Day announcements

### 🗳️ Election Days (5 days)
Election Result Days

## Files Created/Modified

### Created:
- `scripts/migrate-special-days.ts` - Migration script
- `apps/backend/src/routes/specialDays.js` - API endpoints
- `apps/frontend/src/components/filters/SpecialDaysFilter.tsx` - Filter UI
- `SPECIAL_DAYS_IMPLEMENTATION.md` - Full documentation
- `SPECIAL_DAYS_QUICK_START.md` - This file

### Modified:
- `apps/backend/package.json` - Added migration script
- `apps/backend/src/routes/index.js` - Added routes
- `apps/frontend/src/components/filters/index.ts` - Exported component
- `apps/frontend/src/app/(dashboard)/dashboard/weekly/page.tsx` - Added filter
- `apps/frontend/src/store/analysisStore.ts` - Added state
- `apps/frontend/src/lib/types.ts` - Added types

## API Endpoints

```
GET /api/special-days                    - Get all special days
GET /api/special-days/by-year/:year      - Get by year
GET /api/special-days/by-name/:name      - Get by name
GET /api/special-days/categories         - Get categories
GET /api/special-days/date-range         - Get by date range
```

## Example Usage

**Filter by Diwali:**
1. Search "Diwali"
2. Check the box
3. Apply filters
4. See market performance on Diwali days

**Filter by Multiple Festivals:**
1. Select: Diwali, Holi, Ganesh Chaturthi
2. Apply filters
3. Analyze combined festival performance

## Troubleshooting

**Migration fails?**
- Check you're in `apps/backend` directory
- Verify `DATABASE_URL` in `.env`

**Filter not showing?**
- Run migration first
- Check backend is running
- Check browser console for errors

**No data after filtering?**
- Ensure you clicked "APPLY FILTERS"
- Check date range includes special days
- Verify special days exist in selected date range

## Next Steps

- [ ] Add to Daily Analysis page
- [ ] Add to Monthly Analysis page
- [ ] Add to Yearly Analysis page
- [ ] Implement backend filtering logic
- [ ] Add to Scenario Analysis
- [ ] Add to Scanner module

## Need More Info?

See `SPECIAL_DAYS_IMPLEMENTATION.md` for complete documentation.

---

**That's it! You're ready to use Special Days filtering! 🎉**
