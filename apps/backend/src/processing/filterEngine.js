/**
 * Advanced Filter Engine
 * Implements all 40+ filter combinations from the old Python system
 * Replicates filterDataFrameFromHelper() with full functionality
 */

// Election years for India
const ELECTION_YEARS = new Set([1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991, 1996, 1998, 1999, 2004, 2009, 2014, 2019, 2024]);
const MODI_YEARS = new Set([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);

/**
 * Filter Engine Class
 * Provides comprehensive filtering capabilities
 */
class FilterEngine {
  constructor(data) {
    this.originalData = data;
    this.filteredData = [...data];
  }

  /**
   * Reset filters to original data
   */
  reset() {
    this.filteredData = [...this.originalData];
    return this;
  }

  /**
   * Get current filtered data
   */
  getData() {
    return this.filteredData;
  }

  /**
   * Apply all filters from config object
   * @param {Object} filterConfig - Complete filter configuration
   */
  applyFilters(filterConfig) {
    this.reset();

    if (!filterConfig) return this;

    // Date range filters
    if (filterConfig.dateRange) {
      this.filterByDateRange(filterConfig.dateRange);
    }

    if (filterConfig.lastNDays && filterConfig.lastNDays > 0) {
      this.filterLastNDays(filterConfig.lastNDays);
    }

    // Year filters
    if (filterConfig.yearFilters) {
      this.applyYearFilters(filterConfig.yearFilters);
    }

    // Month filters
    if (filterConfig.monthFilters) {
      this.applyMonthFilters(filterConfig.monthFilters);
    }

    // Week filters (Expiry)
    if (filterConfig.expiryWeekFilters) {
      this.applyExpiryWeekFilters(filterConfig.expiryWeekFilters);
    }

    // Week filters (Monday)
    if (filterConfig.mondayWeekFilters) {
      this.applyMondayWeekFilters(filterConfig.mondayWeekFilters);
    }

    // Day filters
    if (filterConfig.dayFilters) {
      this.applyDayFilters(filterConfig.dayFilters);
    }

    // Outlier filters
    if (filterConfig.outlierFilters) {
      this.applyOutlierFilters(filterConfig.outlierFilters);
    }

    // Election year type filter
    if (filterConfig.electionYearType) {
      this.filterByElectionYearType(filterConfig.electionYearType);
    }

    return this;
  }

  // =====================================================
  // DATE RANGE FILTERS
  // =====================================================

  /**
   * Filter by date range
   */
  filterByDateRange({ startDate, endDate }) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    this.filteredData = this.filteredData.filter(row => {
      const date = new Date(row.date);
      return date >= start && date <= end;
    });

    return this;
  }

  /**
   * Filter to last N days
   */
  filterLastNDays(n) {
    this.filteredData = this.filteredData.slice(-n);
    return this;
  }

  // =====================================================
  // YEAR FILTERS
  // =====================================================

  applyYearFilters(filters) {
    // Positive/Negative years
    if (filters.positiveNegative && filters.positiveNegative !== 'All') {
      const isPositive = filters.positiveNegative === 'Positive';
      this.filteredData = this.filteredData.filter(row => 
        row.positiveYear === isPositive
      );
    }

    // Even/Odd/Leap/Election years
    if (filters.evenOdd && filters.evenOdd !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const year = new Date(row.date).getFullYear();
        switch (filters.evenOdd) {
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

    // Decade years filter (1-10 representing last digit)
    if (filters.decadeYears && filters.decadeYears.length < 10) {
      const allowedDigits = new Set(filters.decadeYears.map(d => d === 10 ? 0 : d));
      this.filteredData = this.filteredData.filter(row => {
        const year = new Date(row.date).getFullYear();
        return allowedDigits.has(year % 10);
      });
    }

    // Specific years
    if (filters.specificYears && filters.specificYears.length > 0) {
      const yearSet = new Set(filters.specificYears);
      this.filteredData = this.filteredData.filter(row => {
        const year = new Date(row.date).getFullYear();
        return yearSet.has(year);
      });
    }

    return this;
  }

  // =====================================================
  // MONTH FILTERS
  // =====================================================

  applyMonthFilters(filters) {
    // Positive/Negative months
    if (filters.positiveNegative && filters.positiveNegative !== 'All') {
      const isPositive = filters.positiveNegative === 'Positive';
      this.filteredData = this.filteredData.filter(row => 
        row.positiveMonth === isPositive
      );
    }

    // Even/Odd months
    if (filters.evenOdd && filters.evenOdd !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const month = new Date(row.date).getMonth() + 1;
        return filters.evenOdd === 'Even' ? month % 2 === 0 : month % 2 !== 0;
      });
    }

    // Specific month
    if (filters.specificMonth && filters.specificMonth > 0) {
      this.filteredData = this.filteredData.filter(row => {
        const month = new Date(row.date).getMonth() + 1;
        return month === filters.specificMonth;
      });
    }

    return this;
  }

  // =====================================================
  // EXPIRY WEEK FILTERS
  // =====================================================

  applyExpiryWeekFilters(filters) {
    // Positive/Negative expiry weeks
    if (filters.positiveNegative && filters.positiveNegative !== 'All') {
      const isPositive = filters.positiveNegative === 'Positive';
      this.filteredData = this.filteredData.filter(row => 
        row.positiveExpiryWeek === isPositive
      );
    }

    // Even/Odd expiry weeks (monthly)
    if (filters.evenOddMonthly && filters.evenOddMonthly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenExpiryWeekNumberMonthly;
        return filters.evenOddMonthly === 'Even' ? isEven : !isEven;
      });
    }

    // Specific expiry week (monthly)
    if (filters.specificWeekMonthly && filters.specificWeekMonthly > 0) {
      this.filteredData = this.filteredData.filter(row => 
        row.expiryWeekNumberMonthly === filters.specificWeekMonthly
      );
    }

    // Even/Odd expiry weeks (yearly)
    if (filters.evenOddYearly && filters.evenOddYearly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenExpiryWeekNumberYearly;
        return filters.evenOddYearly === 'Even' ? isEven : !isEven;
      });
    }

    return this;
  }

  // =====================================================
  // MONDAY WEEK FILTERS
  // =====================================================

  applyMondayWeekFilters(filters) {
    // Positive/Negative monday weeks
    if (filters.positiveNegative && filters.positiveNegative !== 'All') {
      const isPositive = filters.positiveNegative === 'Positive';
      this.filteredData = this.filteredData.filter(row => 
        row.positiveMondayWeek === isPositive
      );
    }

    // Even/Odd monday weeks (monthly)
    if (filters.evenOddMonthly && filters.evenOddMonthly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenMondayWeekNumberMonthly;
        return filters.evenOddMonthly === 'Even' ? isEven : !isEven;
      });
    }

    // Specific monday week (monthly)
    if (filters.specificWeekMonthly && filters.specificWeekMonthly > 0) {
      this.filteredData = this.filteredData.filter(row => 
        row.mondayWeekNumberMonthly === filters.specificWeekMonthly
      );
    }

    // Even/Odd monday weeks (yearly)
    if (filters.evenOddYearly && filters.evenOddYearly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenMondayWeekNumberYearly;
        return filters.evenOddYearly === 'Even' ? isEven : !isEven;
      });
    }

    return this;
  }

  // =====================================================
  // DAY FILTERS
  // =====================================================

  applyDayFilters(filters) {
    // Positive/Negative days
    if (filters.positiveNegative && filters.positiveNegative !== 'All') {
      const isPositive = filters.positiveNegative === 'Positive';
      this.filteredData = this.filteredData.filter(row => 
        row.positiveDay === isPositive
      );
    }

    // Weekday names
    if (filters.weekdays && filters.weekdays.length > 0 && filters.weekdays.length < 5) {
      const allowedDays = new Set(filters.weekdays);
      this.filteredData = this.filteredData.filter(row => 
        allowedDays.has(row.weekday)
      );
    }

    // Even/Odd calendar days (monthly)
    if (filters.evenOddCalendarMonthly && filters.evenOddCalendarMonthly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenCalendarMonthDay;
        return filters.evenOddCalendarMonthly === 'Even' ? isEven : !isEven;
      });
    }

    // Even/Odd calendar days (yearly)
    if (filters.evenOddCalendarYearly && filters.evenOddCalendarYearly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenCalendarYearDay;
        return filters.evenOddCalendarYearly === 'Even' ? isEven : !isEven;
      });
    }

    // Even/Odd trading days (monthly)
    if (filters.evenOddTradingMonthly && filters.evenOddTradingMonthly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenTradingMonthDay;
        return filters.evenOddTradingMonthly === 'Even' ? isEven : !isEven;
      });
    }

    // Even/Odd trading days (yearly)
    if (filters.evenOddTradingYearly && filters.evenOddTradingYearly !== 'All') {
      this.filteredData = this.filteredData.filter(row => {
        const isEven = row.evenTradingYearDay;
        return filters.evenOddTradingYearly === 'Even' ? isEven : !isEven;
      });
    }

    // Specific trading days
    if (filters.specificTradingDays && filters.specificTradingDays.length > 0) {
      const allowedDays = new Set(filters.specificTradingDays);
      this.filteredData = this.filteredData.filter(row => 
        allowedDays.has(row.tradingMonthDay)
      );
    }

    // Specific calendar days
    if (filters.specificCalendarDays && filters.specificCalendarDays.length > 0) {
      const allowedDays = new Set(filters.specificCalendarDays);
      this.filteredData = this.filteredData.filter(row => 
        allowedDays.has(row.calendarMonthDay)
      );
    }

    return this;
  }

  // =====================================================
  // OUTLIER FILTERS
  // =====================================================

  applyOutlierFilters(filters) {
    // Daily percentage change filter
    if (filters.daily?.enabled) {
      const { min, max } = filters.daily;
      this.filteredData = this.filteredData.filter(row => {
        if (row.returnPercentage === undefined || row.returnPercentage === null) return true;
        return row.returnPercentage >= min && row.returnPercentage <= max;
      });
    }

    // Monday weekly percentage change filter
    if (filters.mondayWeekly?.enabled) {
      const { min, max } = filters.mondayWeekly;
      this.filteredData = this.filteredData.filter(row => {
        if (row.mondayWeeklyReturnPercentage === undefined) return true;
        return row.mondayWeeklyReturnPercentage >= min && row.mondayWeeklyReturnPercentage <= max;
      });
    }

    // Expiry weekly percentage change filter
    if (filters.expiryWeekly?.enabled) {
      const { min, max } = filters.expiryWeekly;
      this.filteredData = this.filteredData.filter(row => {
        if (row.expiryWeeklyReturnPercentage === undefined) return true;
        return row.expiryWeeklyReturnPercentage >= min && row.expiryWeeklyReturnPercentage <= max;
      });
    }

    // Monthly percentage change filter
    if (filters.monthly?.enabled) {
      const { min, max } = filters.monthly;
      this.filteredData = this.filteredData.filter(row => {
        if (row.monthlyReturnPercentage === undefined) return true;
        return row.monthlyReturnPercentage >= min && row.monthlyReturnPercentage <= max;
      });
    }

    // Yearly percentage change filter
    if (filters.yearly?.enabled) {
      const { min, max } = filters.yearly;
      this.filteredData = this.filteredData.filter(row => {
        if (row.yearlyReturnPercentage === undefined) return true;
        return row.yearlyReturnPercentage >= min && row.yearlyReturnPercentage <= max;
      });
    }

    return this;
  }

  // =====================================================
  // ELECTION YEAR TYPE FILTER
  // =====================================================

  filterByElectionYearType(electionType) {
    if (!electionType || electionType === 'All') return this;

    const currentYear = new Date().getFullYear();

    this.filteredData = this.filteredData.filter(row => {
      const year = new Date(row.date).getFullYear();

      switch (electionType) {
        case 'Election':
          return ELECTION_YEARS.has(year);
        case 'PreElection':
          return ELECTION_YEARS.has(year + 1);
        case 'PostElection':
          return ELECTION_YEARS.has(year - 1);
        case 'MidElection':
          return !ELECTION_YEARS.has(year) && 
                 !ELECTION_YEARS.has(year + 1) && 
                 !ELECTION_YEARS.has(year - 1);
        case 'Modi':
          return MODI_YEARS.has(year);
        case 'Current':
          return year === currentYear;
        default:
          return true;
      }
    });

    return this;
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Get count of filtered records
   */
  count() {
    return this.filteredData.length;
  }

  /**
   * Get unique years in filtered data
   */
  getYears() {
    const years = new Set(this.filteredData.map(row => 
      new Date(row.date).getFullYear()
    ));
    return Array.from(years).sort();
  }

  /**
   * Get date range of filtered data
   */
  getDateRange() {
    if (this.filteredData.length === 0) return null;
    
    const dates = this.filteredData.map(row => new Date(row.date));
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }

  /**
   * Clone the filter engine with current state
   */
  clone() {
    const cloned = new FilterEngine(this.originalData);
    cloned.filteredData = [...this.filteredData];
    return cloned;
  }
}

/**
 * Create a new filter engine instance
 * @param {Array} data - Data to filter
 * @returns {FilterEngine}
 */
function createFilterEngine(data) {
  return new FilterEngine(data);
}

/**
 * Apply filters to data (functional approach)
 * @param {Array} data - Data to filter
 * @param {Object} filterConfig - Filter configuration
 * @returns {Array} Filtered data
 */
function applyFilters(data, filterConfig) {
  return new FilterEngine(data).applyFilters(filterConfig).getData();
}

module.exports = {
  FilterEngine,
  createFilterEngine,
  applyFilters,
  ELECTION_YEARS,
  MODI_YEARS,
};
