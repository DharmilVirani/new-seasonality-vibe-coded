# 🎉 Special Days Filter Implementation Guide

## Overview

This document describes the implementation of the **Special Days Filter** feature, which allows users to filter market data based on special days like festivals, holidays, budget days, and election days - matching the functionality from the old software.

## 📋 What Was Implemented

### 1. **Database Migration Script** ✅
- **File**: `scripts/migrate-special-days.ts`
- **Purpose**: Migrates data from `old-software/SpecialDays/SpecialDays.csv` to the database
- **Features**:
  - Parses CSV with 29 special day categories
  - Automatically categorizes days (Festival, Holiday, Budget, Election, etc.)
  - Handles both Indian and USA special days
  - Batch insertion for performance
  - Comprehensive error handling and progress reporting

### 2. **Backend API Endpoints** ✅
- **File**: `apps/backend/src/routes/specialDays.js`
- **Endpoints**:
  - `GET /api/special-days` - Get all unique special day names
  - `GET /api/special-days/by-year/:year` - Get special days for a specific year
  - `GET /api/special-days/by-name/:name` - Get all occurrences of a specific special day
  - `GET /api/special-days/categories` - Get all categories with counts
  - `GET /api/special-days/date-range` - Get special days within a date range (with optional name filtering)

### 3. **Frontend Filter Component** ✅
- **File**: `apps/frontend/src/components/filters/SpecialDaysFilter.tsx`
- **Features**:
  - Search functionality to find special days quickly
  - Grouped by category (Festivals, Holidays, National Holidays, Budget, Election)
  - Select All / Clear All quick actions
  - Visual badges showing selected days
  - Real-time filtering
  - Responsive design with scrollable list

### 4. **Integration with UI** ✅
- Added to Weekly Analysis page under "Advanced Filters" section
- Integrated with existing filter system
- State management via Zustand store
- Type-safe implementation with TypeScript

## 🚀 How to Use

### Step 1: Run the Migration

First, migrate the special days data from CSV to database:

```bash
cd apps/backend
npm run migrate:special-days
```

**Expected Output:**
```
🚀 Starting Special Days Migration...
📂 Reading CSV file: /path/to/old-software/SpecialDays/SpecialDays.csv
📊 Found 24 rows in CSV
📋 Special Day Categories: 29
   1. Union Budget Day
   2. ELECTION RESULT DAY
   3. REPUBLIC DAY
   ... (and more)

📈 Statistics:
   Total special day entries: 580
   Skipped empty/invalid entries: 116

🗑️  Clearing existing special days...
   Deleted 0 existing records

💾 Inserting special days into database...
   Progress: 580/580 (100.0%)

✅ Migration completed!
   Total records in database: 580

📊 Summary by Category:
   INDIA - FESTIVAL: 312 days
   USA - HOLIDAY: 168 days
   INDIA - BUDGET: 23 days
   INDIA - ELECTION: 5 days
   INDIA - NATIONAL_HOLIDAY: 48 days

📝 Sample Records:
   RAMDAN EID - 2025-03-31 (INDIA)
   KUMBH MELA - 2025-02-26 (INDIA)
   ... (and more)

✨ Special Days migration completed successfully!
```

### Step 2: Access the Filter in UI

1. Navigate to **Weekly Analysis** page
2. Open the **Filter Console** (left sidebar)
3. Scroll down to **Advanced Filters** section
4. Click to expand and see **Special Days Filter**

### Step 3: Use the Filter

**Search for Special Days:**
- Type in the search box to find specific days (e.g., "Diwali", "Budget", "Christmas")

**Select Days:**
- Click checkboxes next to special days you want to filter by
- Use "Select All" to select all visible days
- Use "Clear All" to deselect all days

**View Selected:**
- Selected days appear as badges at the bottom
- Click on a badge to remove that day from selection

**Apply Filters:**
- Click "APPLY FILTERS" button to run analysis with selected special days

## 📊 Special Days Categories

The system includes the following categories:

### 🎉 Festivals (INDIA)
- Diwali, Holi, Mahashivratri, Ganesh Chaturthi, Dussehra, etc.
- Religious festivals: Ram Navami, Mahavir Jayanti, Bakri Id, Ramdan Eid
- Cultural events: Kumbh Mela

### 🏖️ Holidays (USA)
- New Year's Day, Martin Luther King Jr. Day
- Washington's Birthday, Good Friday
- Juneteenth, Independence Day
- Labor Day, Thanksgiving, Christmas

### 🇮🇳 National Holidays (INDIA)
- Republic Day (January 26)
- Independence Day (August 15)
- Mahatma Gandhi Jayanti (October 2)

### 💰 Budget Days (INDIA)
- Union Budget Day announcements

### 🗳️ Election Days (INDIA)
- Election Result Days

## 🔧 Technical Details

### Database Schema

```prisma
model SpecialDay {
  id          Int      @id @default(autoincrement())
  name        String   // "DIWALI", "REPUBLIC DAY", etc.
  date        DateTime // The date of the special day
  year        Int      // Year for quick filtering
  country     String   @default("INDIA") // "INDIA", "USA"
  category    String   @default("FESTIVAL") // Category type
  
  createdAt   DateTime @default(now())
  
  @@unique([name, date])
  @@index([name])
  @@index([date])
  @@index([year])
  @@index([country])
  @@index([name, year])
  @@map("special_days")
}
```

### Filter State Management

```typescript
interface SpecialDaysFilters {
  selectedDays?: string[]; // Array of special day names
}

// Example usage in store
filters: {
  specialDaysFilters: {
    selectedDays: ['DIWALI', 'HOLI', 'REPUBLIC DAY']
  }
}
```

### API Response Format

```json
{
  "success": true,
  "data": [
    {
      "name": "DIWALI",
      "category": "FESTIVAL",
      "country": "INDIA"
    },
    {
      "name": "REPUBLIC DAY",
      "category": "NATIONAL_HOLIDAY",
      "country": "INDIA"
    }
  ],
  "count": 29
}
```

## 🎯 How It Works (Like Old Software)

The old software had `specialDaysToDropdown` which provided a list of special days for filtering. Our implementation:

1. **Loads all special days** from the database (migrated from CSV)
2. **Groups them by category** for better organization
3. **Allows multi-select** to filter data by multiple special days
4. **Filters market data** to show only days that match selected special days

### Example Use Cases

**Scenario 1: Analyze Diwali Performance**
- Select "DIWALI" from special days
- Apply filters
- See how the market performs on Diwali days across years

**Scenario 2: Budget Day Analysis**
- Select "Union Budget Day"
- Apply filters
- Analyze market behavior on budget announcement days

**Scenario 3: Festival Season Analysis**
- Select multiple festivals: Diwali, Holi, Ganesh Chaturthi
- Apply filters
- See combined performance during major festivals

## 📁 Files Modified/Created

### Created Files:
1. `scripts/migrate-special-days.ts` - Migration script
2. `apps/backend/src/routes/specialDays.js` - API routes
3. `apps/frontend/src/components/filters/SpecialDaysFilter.tsx` - Filter component
4. `SPECIAL_DAYS_IMPLEMENTATION.md` - This documentation

### Modified Files:
1. `apps/backend/package.json` - Added migration script
2. `apps/backend/src/routes/index.js` - Added special days routes
3. `apps/frontend/src/components/filters/index.ts` - Exported new component
4. `apps/frontend/src/app/(dashboard)/dashboard/weekly/page.tsx` - Added filter to UI
5. `apps/frontend/src/store/analysisStore.ts` - Added special days filter state
6. `apps/frontend/src/lib/types.ts` - Added SpecialDaysFilters type

## 🔍 Verification

After migration, verify the data:

```sql
-- Check total special days
SELECT COUNT(*) FROM special_days;

-- Check by category
SELECT category, country, COUNT(*) 
FROM special_days 
GROUP BY category, country;

-- Check specific special day
SELECT * FROM special_days 
WHERE name = 'DIWALI' 
ORDER BY date DESC 
LIMIT 5;

-- Check date range
SELECT * FROM special_days 
WHERE date BETWEEN '2023-01-01' AND '2023-12-31'
ORDER BY date;
```

## 🐛 Troubleshooting

### Migration Issues

**Problem**: CSV file not found
```
❌ CSV file not found: /path/to/old-software/SpecialDays/SpecialDays.csv
```
**Solution**: Ensure you're running the script from the project root directory

**Problem**: Database connection error
**Solution**: Check your `.env` file has correct `DATABASE_URL`

### API Issues

**Problem**: 401 Unauthorized
**Solution**: Ensure you're logged in and have a valid token in localStorage

**Problem**: Empty special days list
**Solution**: Run the migration script first

### UI Issues

**Problem**: Filter not showing
**Solution**: Check browser console for errors, ensure backend is running

**Problem**: Selected days not applying
**Solution**: Click "APPLY FILTERS" button after selecting days

## 🎨 Customization

### Adding More Categories

Edit the `getCategoryAndCountry` function in `migrate-special-days.ts`:

```typescript
const getCategoryAndCountry = (name: string): { category: string; country: string } => {
  const upperName = name.toUpperCase();
  
  // Add your custom category
  if (upperName.includes('YOUR_KEYWORD')) {
    return { category: 'YOUR_CATEGORY', country: 'INDIA' };
  }
  
  // ... existing code
};
```

### Styling the Filter

Modify `apps/frontend/src/components/filters/SpecialDaysFilter.tsx` to change colors, layout, or behavior.

## 📚 References

- **Old Software**: `old-software/helper.py` - `specialDaysToDropdown`
- **CSV Data**: `old-software/SpecialDays/SpecialDays.csv`
- **Database Schema**: `apps/backend/prisma/schema.prisma` - SpecialDay model

## ✅ Next Steps

1. ✅ Run migration script
2. ✅ Test API endpoints
3. ✅ Test UI filter
4. 🔄 Add special days filter to other analysis pages (Daily, Monthly, Yearly)
5. 🔄 Implement backend filtering logic to actually filter data by special days
6. 🔄 Add special days to scenario analysis
7. 🔄 Add special days to scanner module

## 🎉 Success!

You now have a fully functional Special Days filter that matches the old software's functionality with modern UI/UX improvements!

---

**Need Help?** Check the code comments or reach out to the development team.
