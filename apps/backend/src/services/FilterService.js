/**
 * Filter Service
 * Replicates the comprehensive filtering logic from the old Python system
 * Based on filterDataFrameFromHelper() from helper.py
 */
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');

// Election years for India
const ELECTION_YEARS = new Set([1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019, 2024]);
const MODI_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

class FilterService {
  /**
   * Build Prisma WHERE clause from filter parameters
   * This replicates the Python filterDataFrameFromHelper function
   */
  static buildWhereClause(filters, tickerId, startDate, endDate, lastNDays = 0) {
    const where = {
      tickerId,
      AND: [],
    };

    // Date range filter
    if (lastNDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lastNDays);
      where.AND.push({ date: { gte: cutoffDate } });
    } else {
      where.AND.push({
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      });
    }

    if (!filters) return where;

    // Year filters
    if (filters.yearFilters) {
      this.applyYearFilters(where, filters.yearFilters);
    }

    // Month filters
    if (filters.monthFilters) {
      this.applyMonthFilters(where, filters.monthFilters);
    }

    // Note: Week and Day filters require calculated fields that will be
    // available in Phase 2. For now, we'll filter in-memory after fetching.

    return where;
  }

  /**
   * Apply year-based filters
   */
  static applyYearFilters(where, yearFilters) {
    // Note: These filters require calculated fields (PositiveYear, EvenYear)
    // which will be available in Phase 2. For Phase 1, we filter by year directly.
    
    // Decade years filter
    if (yearFilters.decadeYears && yearFilters.decadeYears.length < 10) {
      // This will be applied in post-processing
    }

    // Specific years filter
    if (yearFilters.specificYears && yearFilters.specificYears.length > 0) {
      // Will be applied in post-processing based on date extraction
    }
  }

  /**
   * Apply month-based filters
   */
  static applyMonthFilters(where, monthFilters) {
    // Specific month filter - can be applied directly
    if (monthFilters.specificMonth && monthFilters.specificMonth > 0) {
      // Will be applied in post-processing
    }
  }

  /**
   * Post-process data with filters that can't be done in SQL
   * This handles all the complex filtering from the old Python system
   */
  static applyInMemoryFilters(data, filters) {
    if (!filters || data.length === 0) return data;

    let filtered = [...data];

    // Year filters
    if (filters.yearFilters) {
      filtered = this.filterByYear(filtered, filters.yearFilters);
    }

    // Month filters
    if (filters.monthFilters) {
      filtered = this.filterByMonth(filtered, filters.monthFilters);
    }

    // Day filters
    if (filters.dayFilters) {
      filtered = this.filterByDay(filtered, filters.dayFilters);
    }

    // Outlier filters
    if (filters.outlierFilters) {
      filtered = this.filterOutliers(filtered, filters.outlierFilters);
    }

    return filtered;
  }

  /**
   * Filter by year criteria
   */
  static filterByYear(data, yearFilters) {
    let filtered = data;

    // Even/Odd/Leap/Election years
    if (yearFilters.evenOddYears && yearFilters.evenOddYears !== 'All') {
      filtered = filtered.filter(row => {
        const year = new Date(row.date).getFullYear();
        switch (yearFilters.evenOddYears) {
          case 'Even':
            return year % 2 === 0;
          case 'Odd':
            return year % 2 !== 0;
          case 'Leap':
            return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
          case 'Election':
            return ELECTION_YEARS.has(year);
          default:
            return true;
        }
      });
    }

    // Decade years filter (1-10 representing last digit of year)
    if (yearFilters.decadeYears && yearFilters.decadeYears.length < 10) {
      const allowedDigits = new Set(yearFilters.decadeYears.map(d => d === 10 ? 0 : d));
      filtered = filtered.filter(row => {
        const year = new Date(row.date).getFullYear();
        return allowedDigits.has(year % 10);
      });
    }

    // Specific years
    if (yearFilters.specificYears && yearFilters.specificYears.length > 0) {
      const yearSet = new Set(yearFilters.specificYears);
      filtered = filtered.filter(row => {
        const year = new Date(row.date).getFullYear();
        return yearSet.has(year);
      });
    }

    return filtered;
  }

  /**
   * Filter by month criteria
   */
  static filterByMonth(data, monthFilters) {
    let filtered = data;

    // Even/Odd months
    if (monthFilters.evenOddMonths && monthFilters.evenOddMonths !== 'All') {
      filtered = filtered.filter(row => {
        const month = new Date(row.date).getMonth() + 1;
        return monthFilters.evenOddMonths === 'Even' ? month % 2 === 0 : month % 2 !== 0;
      });
    }

    // Specific month
    if (monthFilters.specificMonth && monthFilters.specificMonth > 0) {
      filtered = filtered.filter(row => {
        const month = new Date(row.date).getMonth() + 1;
        return month === monthFilters.specificMonth;
      });
    }

    return filtered;
  }

  /**
   * Filter by day criteria
   */
  static filterByDay(data, dayFilters) {
    let filtered = data;

    // Weekday names
    if (dayFilters.weekdays && dayFilters.weekdays.length < 5) {
      const weekdayMap = {
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5
      };
      const allowedDays = new Set(dayFilters.weekdays.map(d => weekdayMap[d]));
      filtered = filtered.filter(row => {
        const dayOfWeek = new Date(row.date).getDay();
        // Convert Sunday=0 to Monday=1 format
        const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
        return allowedDays.has(adjustedDay);
      });
    }

    // Even/Odd calendar days (monthly)
    if (dayFilters.evenOddCalendarDaysMonthly && dayFilters.evenOddCalendarDaysMonthly !== 'All') {
      filtered = filtered.filter(row => {
        const day = new Date(row.date).getDate();
        return dayFilters.evenOddCalendarDaysMonthly === 'Even' ? day % 2 === 0 : day % 2 !== 0;
      });
    }

    // Even/Odd calendar days (yearly)
    if (dayFilters.evenOddCalendarDaysYearly && dayFilters.evenOddCalendarDaysYearly !== 'All') {
      filtered = filtered.filter(row => {
        const date = new Date(row.date);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.ceil((date - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
        return dayFilters.evenOddCalendarDaysYearly === 'Even' ? dayOfYear % 2 === 0 : dayOfYear % 2 !== 0;
      });
    }

    return filtered;
  }

  /**
   * Filter outliers based on percentage change ranges
   */
  static filterOutliers(data, outlierFilters) {
    let filtered = data;

    // Daily percentage change filter
    if (outlierFilters.dailyPercentageRange?.enabled) {
      const { min, max } = outlierFilters.dailyPercentageRange;
      filtered = filtered.filter(row => {
        if (row.returnPercentage === undefined || row.returnPercentage === null) return true;
        return row.returnPercentage >= min && row.returnPercentage <= max;
      });
    }

    // Weekly percentage change filter
    if (outlierFilters.weeklyPercentageRange?.enabled) {
      const { min, max } = outlierFilters.weeklyPercentageRange;
      filtered = filtered.filter(row => {
        if (row.weeklyReturnPercentage === undefined || row.weeklyReturnPercentage === null) return true;
        return row.weeklyReturnPercentage >= min && row.weeklyReturnPercentage <= max;
      });
    }

    // Monthly percentage change filter
    if (outlierFilters.monthlyPercentageRange?.enabled) {
      const { min, max } = outlierFilters.monthlyPercentageRange;
      filtered = filtered.filter(row => {
        if (row.monthlyReturnPercentage === undefined || row.monthlyReturnPercentage === null) return true;
        return row.monthlyReturnPercentage >= min && row.monthlyReturnPercentage <= max;
      });
    }

    // Yearly percentage change filter
    if (outlierFilters.yearlyPercentageRange?.enabled) {
      const { min, max } = outlierFilters.yearlyPercentageRange;
      filtered = filtered.filter(row => {
        if (row.yearlyReturnPercentage === undefined || row.yearlyReturnPercentage === null) return true;
        return row.yearlyReturnPercentage >= min && row.yearlyReturnPercentage <= max;
      });
    }

    return filtered;
  }

  /**
   * Get election year type for a given year
   */
  static getElectionYearType(year) {
    if (ELECTION_YEARS.has(year)) return 'Election';
    if (ELECTION_YEARS.has(year + 1)) return 'PreElection';
    if (ELECTION_YEARS.has(year - 1)) return 'PostElection';
    return 'MidElection';
  }

  /**
   * Filter data by election year type
   */
  static filterByElectionYearType(data, electionType) {
    if (!electionType || electionType === 'All') return data;

    const currentYear = new Date().getFullYear();

    return data.filter(row => {
      const year = new Date(row.date).getFullYear();
      
      switch (electionType) {
        case 'Election':
          return ELECTION_YEARS.has(year);
        case 'PreElection':
          return ELECTION_YEARS.has(year + 1);
        case 'PostElection':
          return ELECTION_YEARS.has(year - 1);
        case 'MidElection':
          return !ELECTION_YEARS.has(year) && !ELECTION_YEARS.has(year + 1) && !ELECTION_YEARS.has(year - 1);
        case 'Modi':
          return MODI_YEARS.includes(year);
        case 'Current':
          return year === currentYear;
        default:
          return true;
      }
    });
  }
}

module.exports = FilterService;
