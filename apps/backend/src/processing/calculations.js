/**
 * Financial Calculations Module
 * Replicates Python pandas calculations from GenerateFiles.py
 * Calculates all 40+ derived fields for seasonality analysis
 */

/**
 * Calculate return points and percentage
 * @param {number} currentClose - Current closing price
 * @param {number} previousClose - Previous closing price
 * @returns {Object} { returnPoints, returnPercentage }
 */
function calculateReturns(currentClose, previousClose) {
  if (!previousClose || previousClose === 0) {
    return { returnPoints: 0, returnPercentage: 0 };
  }
  const returnPoints = currentClose - previousClose;
  const returnPercentage = parseFloat(((returnPoints / previousClose) * 100).toFixed(4));
  return { returnPoints: parseFloat(returnPoints.toFixed(4)), returnPercentage };
}

/**
 * Get weekday name from date
 * @param {Date} date 
 * @returns {string} Weekday name
 */
function getWeekdayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Calculate calendar day of month
 * @param {Date} date 
 * @returns {number}
 */
function getCalendarMonthDay(date) {
  return date.getDate();
}

/**
 * Calculate calendar day of year
 * @param {Date} date 
 * @returns {number}
 */
function getCalendarYearDay(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date - start;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Check if year is even
 * @param {number} year 
 * @returns {boolean}
 */
function isEvenYear(year) {
  return year % 2 === 0;
}

/**
 * Check if month is even
 * @param {number} month - 1-12
 * @returns {boolean}
 */
function isEvenMonth(month) {
  return month % 2 === 0;
}

/**
 * Check if day is even
 * @param {number} day 
 * @returns {boolean}
 */
function isEvenDay(day) {
  return day % 2 === 0;
}

/**
 * Check if year is a leap year
 * @param {number} year 
 * @returns {boolean}
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get Monday date for a given date (start of week)
 * @param {Date} date 
 * @returns {Date}
 */
function getMondayWeeklyDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Adjust for Sunday
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Get Expiry (Thursday) date for a given date
 * For Indian markets, expiry is on Thursday
 * @param {Date} date 
 * @returns {Date}
 */
function getExpiryWeeklyDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  
  // If Friday (5), add 6 days to get next Thursday
  if (day === 5) {
    d.setDate(d.getDate() + 6);
  } else {
    // Otherwise, calculate days to Thursday (4)
    const daysToThursday = (4 - day + 7) % 7;
    d.setDate(d.getDate() + (daysToThursday === 0 ? 7 : daysToThursday));
  }
  return d;
}

/**
 * Calculate trading day number within month
 * @param {Array} sortedData - Sorted array of records
 * @returns {Array} Array with tradingMonthDay added
 */
function calculateTradingMonthDays(sortedData) {
  let tradingDay = 0;
  let currentMonth = null;
  let currentYear = null;

  return sortedData.map((record, index) => {
    const date = new Date(record.date);
    const month = date.getMonth();
    const year = date.getFullYear();

    if (month !== currentMonth || year !== currentYear) {
      tradingDay = 1;
      currentMonth = month;
      currentYear = year;
    } else {
      tradingDay++;
    }

    return {
      ...record,
      tradingMonthDay: tradingDay,
      evenTradingMonthDay: isEvenDay(tradingDay),
    };
  });
}

/**
 * Calculate trading day number within year
 * @param {Array} sortedData - Sorted array of records
 * @returns {Array} Array with tradingYearDay added
 */
function calculateTradingYearDays(sortedData) {
  let tradingDay = 0;
  let currentYear = null;

  return sortedData.map((record) => {
    const date = new Date(record.date);
    const year = date.getFullYear();

    if (year !== currentYear) {
      tradingDay = 1;
      currentYear = year;
    } else {
      tradingDay++;
    }

    return {
      ...record,
      tradingYearDay: tradingDay,
      evenTradingYearDay: isEvenDay(tradingDay),
    };
  });
}

/**
 * Calculate week numbers (monthly and yearly)
 * @param {Array} sortedData - Sorted array of weekly records
 * @param {string} weekType - 'monday' or 'expiry'
 * @returns {Array} Array with week numbers added
 */
function calculateWeekNumbers(sortedData, weekType = 'monday') {
  let weekNumberMonthly = 0;
  let weekNumberYearly = 0;
  let currentMonth = null;
  let currentYear = null;

  return sortedData.map((record, index) => {
    const date = new Date(record.date);
    const month = date.getMonth();
    const year = date.getFullYear();

    // Reset monthly week number on month change
    if (month !== currentMonth || year !== currentYear) {
      weekNumberMonthly = 1;
      currentMonth = month;
    } else {
      weekNumberMonthly++;
    }

    // Reset yearly week number on year change
    if (year !== currentYear) {
      weekNumberYearly = 1;
      currentYear = year;
    } else {
      weekNumberYearly++;
    }

    const prefix = weekType === 'monday' ? 'monday' : 'expiry';

    return {
      ...record,
      [`${prefix}WeekNumberMonthly`]: weekNumberMonthly,
      [`${prefix}WeekNumberYearly`]: weekNumberYearly,
      [`even${prefix.charAt(0).toUpperCase() + prefix.slice(1)}WeekNumberMonthly`]: isEvenDay(weekNumberMonthly),
      [`even${prefix.charAt(0).toUpperCase() + prefix.slice(1)}WeekNumberYearly`]: isEvenDay(weekNumberYearly),
    };
  });
}

/**
 * Aggregate OHLCV data for a period
 * @param {Array} records - Array of daily records
 * @returns {Object} Aggregated OHLCV
 */
function aggregateOHLCV(records) {
  if (!records || records.length === 0) {
    return null;
  }

  return {
    open: records[0].open,
    high: Math.max(...records.map(r => r.high)),
    low: Math.min(...records.map(r => r.low)),
    close: records[records.length - 1].close,
    volume: records.reduce((sum, r) => sum + (r.volume || 0), 0),
    openInterest: records[records.length - 1].openInterest || 0,
  };
}

/**
 * Group daily data by week (Monday-based)
 * @param {Array} dailyData - Sorted daily data
 * @returns {Array} Weekly aggregated data
 */
function groupByMondayWeek(dailyData) {
  const weeks = new Map();

  for (const record of dailyData) {
    const date = new Date(record.date);
    const mondayDate = getMondayWeeklyDate(date);
    const key = mondayDate.toISOString().split('T')[0];

    if (!weeks.has(key)) {
      weeks.set(key, []);
    }
    weeks.get(key).push(record);
  }

  const result = [];
  for (const [weekStart, records] of weeks) {
    const aggregated = aggregateOHLCV(records);
    if (aggregated) {
      result.push({
        date: new Date(weekStart),
        weekday: 'Monday',
        ...aggregated,
      });
    }
  }

  return result.sort((a, b) => a.date - b.date);
}

/**
 * Group daily data by week (Expiry/Thursday-based)
 * @param {Array} dailyData - Sorted daily data
 * @returns {Array} Weekly aggregated data
 */
function groupByExpiryWeek(dailyData) {
  const weeks = new Map();

  for (const record of dailyData) {
    const date = new Date(record.date);
    const expiryDate = getExpiryWeeklyDate(date);
    const key = expiryDate.toISOString().split('T')[0];

    if (!weeks.has(key)) {
      weeks.set(key, []);
    }
    weeks.get(key).push(record);
  }

  const result = [];
  for (const [weekEnd, records] of weeks) {
    const aggregated = aggregateOHLCV(records);
    if (aggregated) {
      result.push({
        date: new Date(weekEnd),
        weekday: 'Thursday',
        ...aggregated,
      });
    }
  }

  return result.sort((a, b) => a.date - b.date);
}

/**
 * Group daily data by month
 * @param {Array} dailyData - Sorted daily data
 * @returns {Array} Monthly aggregated data
 */
function groupByMonth(dailyData) {
  const months = new Map();

  for (const record of dailyData) {
    const date = new Date(record.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!months.has(key)) {
      months.set(key, []);
    }
    months.get(key).push(record);
  }

  const result = [];
  for (const [monthKey, records] of months) {
    const [year, month] = monthKey.split('-').map(Number);
    const aggregated = aggregateOHLCV(records);
    if (aggregated) {
      result.push({
        date: new Date(year, month - 1, 1),
        ...aggregated,
      });
    }
  }

  return result.sort((a, b) => a.date - b.date);
}

/**
 * Group daily data by year
 * @param {Array} dailyData - Sorted daily data
 * @returns {Array} Yearly aggregated data
 */
function groupByYear(dailyData) {
  const years = new Map();

  for (const record of dailyData) {
    const date = new Date(record.date);
    const key = date.getFullYear();

    if (!years.has(key)) {
      years.set(key, []);
    }
    years.get(key).push(record);
  }

  const result = [];
  for (const [year, records] of years) {
    const aggregated = aggregateOHLCV(records);
    if (aggregated) {
      result.push({
        date: new Date(year, 0, 1),
        ...aggregated,
      });
    }
  }

  return result.sort((a, b) => a.date - b.date);
}

/**
 * Calculate all derived fields for daily data
 * Replicates the full Python GenerateFiles.py logic
 * @param {Array} rawDailyData - Raw OHLCV data sorted by date
 * @returns {Object} { daily, mondayWeekly, expiryWeekly, monthly, yearly }
 */
function calculateAllDerivedFields(rawDailyData) {
  if (!rawDailyData || rawDailyData.length === 0) {
    return { daily: [], mondayWeekly: [], expiryWeekly: [], monthly: [], yearly: [] };
  }

  // Sort data by date
  const sortedData = [...rawDailyData].sort((a, b) => new Date(a.date) - new Date(b.date));

  // =====================================================
  // STEP 1: Generate Yearly Data
  // =====================================================
  let yearlyData = groupByYear(sortedData);
  yearlyData = yearlyData.map((record, index) => {
    const date = new Date(record.date);
    const year = date.getFullYear();
    const prevRecord = index > 0 ? yearlyData[index - 1] : null;
    const returns = calculateReturns(record.close, prevRecord?.close);

    return {
      ...record,
      evenYear: isEvenYear(year),
      returnPoints: returns.returnPoints,
      returnPercentage: returns.returnPercentage,
      positiveYear: returns.returnPoints > 0,
    };
  });

  // Create yearly lookup map
  const yearlyMap = new Map(yearlyData.map(r => [new Date(r.date).getFullYear(), r]));

  // =====================================================
  // STEP 2: Generate Monthly Data
  // =====================================================
  let monthlyData = groupByMonth(sortedData);
  monthlyData = monthlyData.map((record, index) => {
    const date = new Date(record.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const prevRecord = index > 0 ? monthlyData[index - 1] : null;
    const returns = calculateReturns(record.close, prevRecord?.close);
    const yearlyRecord = yearlyMap.get(year);

    return {
      ...record,
      evenMonth: isEvenMonth(month),
      returnPoints: returns.returnPoints,
      returnPercentage: returns.returnPercentage,
      positiveMonth: returns.returnPoints > 0,
      evenYear: isEvenYear(year),
      yearlyReturnPoints: yearlyRecord?.returnPoints || 0,
      yearlyReturnPercentage: yearlyRecord?.returnPercentage || 0,
      positiveYear: yearlyRecord?.positiveYear || false,
    };
  });

  // Create monthly lookup map
  const monthlyMap = new Map(monthlyData.map(r => {
    const d = new Date(r.date);
    return [`${d.getFullYear()}-${d.getMonth() + 1}`, r];
  }));

  // =====================================================
  // STEP 3: Generate Monday Weekly Data
  // =====================================================
  let mondayWeeklyData = groupByMondayWeek(sortedData);
  mondayWeeklyData = calculateWeekNumbers(mondayWeeklyData, 'monday');
  mondayWeeklyData = mondayWeeklyData.map((record, index) => {
    const date = new Date(record.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const prevRecord = index > 0 ? mondayWeeklyData[index - 1] : null;
    const returns = calculateReturns(record.close, prevRecord?.close);
    const monthlyRecord = monthlyMap.get(`${year}-${month}`);
    const yearlyRecord = yearlyMap.get(year);

    return {
      ...record,
      returnPoints: returns.returnPoints,
      returnPercentage: returns.returnPercentage,
      positiveWeek: returns.returnPoints > 0,
      evenMonth: isEvenMonth(month),
      monthlyReturnPoints: monthlyRecord?.returnPoints || 0,
      monthlyReturnPercentage: monthlyRecord?.returnPercentage || 0,
      positiveMonth: monthlyRecord?.positiveMonth || false,
      evenYear: isEvenYear(year),
      yearlyReturnPoints: yearlyRecord?.returnPoints || 0,
      yearlyReturnPercentage: yearlyRecord?.returnPercentage || 0,
      positiveYear: yearlyRecord?.positiveYear || false,
    };
  });

  // Create Monday weekly lookup map
  const mondayWeeklyMap = new Map(mondayWeeklyData.map(r => {
    return [r.date.toISOString().split('T')[0], r];
  }));

  // =====================================================
  // STEP 4: Generate Expiry Weekly Data
  // =====================================================
  let expiryWeeklyData = groupByExpiryWeek(sortedData);
  expiryWeeklyData = calculateWeekNumbers(expiryWeeklyData, 'expiry');
  expiryWeeklyData = expiryWeeklyData.map((record, index) => {
    const date = new Date(record.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const prevRecord = index > 0 ? expiryWeeklyData[index - 1] : null;
    const returns = calculateReturns(record.close, prevRecord?.close);
    const monthlyRecord = monthlyMap.get(`${year}-${month}`);
    const yearlyRecord = yearlyMap.get(year);

    return {
      ...record,
      returnPoints: returns.returnPoints,
      returnPercentage: returns.returnPercentage,
      positiveWeek: returns.returnPoints > 0,
      evenMonth: isEvenMonth(month),
      monthlyReturnPoints: monthlyRecord?.returnPoints || 0,
      monthlyReturnPercentage: monthlyRecord?.returnPercentage || 0,
      positiveMonth: monthlyRecord?.positiveMonth || false,
      evenYear: isEvenYear(year),
      yearlyReturnPoints: yearlyRecord?.returnPoints || 0,
      yearlyReturnPercentage: yearlyRecord?.returnPercentage || 0,
      positiveYear: yearlyRecord?.positiveYear || false,
    };
  });

  // Create Expiry weekly lookup map
  const expiryWeeklyMap = new Map(expiryWeeklyData.map(r => {
    return [r.date.toISOString().split('T')[0], r];
  }));

  // =====================================================
  // STEP 5: Generate Daily Data with ALL Fields
  // =====================================================
  let dailyData = sortedData.map((record, index) => {
    const date = new Date(record.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const prevRecord = index > 0 ? sortedData[index - 1] : null;
    const returns = calculateReturns(record.close, prevRecord?.close);

    // Get weekly dates
    const mondayDate = getMondayWeeklyDate(date);
    const expiryDate = getExpiryWeeklyDate(date);
    const mondayKey = mondayDate.toISOString().split('T')[0];
    const expiryKey = expiryDate.toISOString().split('T')[0];

    // Get weekly records
    const mondayWeeklyRecord = mondayWeeklyMap.get(mondayKey);
    const expiryWeeklyRecord = expiryWeeklyMap.get(expiryKey);
    const monthlyRecord = monthlyMap.get(`${year}-${month}`);
    const yearlyRecord = yearlyMap.get(year);

    return {
      ...record,
      weekday: getWeekdayName(date),
      
      // Calendar day fields
      calendarMonthDay: getCalendarMonthDay(date),
      calendarYearDay: getCalendarYearDay(date),
      evenCalendarMonthDay: isEvenDay(getCalendarMonthDay(date)),
      evenCalendarYearDay: isEvenDay(getCalendarYearDay(date)),
      
      // Daily returns
      returnPoints: returns.returnPoints,
      returnPercentage: returns.returnPercentage,
      positiveDay: returns.returnPoints > 0,
      
      // Monday weekly fields
      mondayWeeklyDate: mondayDate,
      mondayWeekNumberMonthly: mondayWeeklyRecord?.mondayWeekNumberMonthly || null,
      mondayWeekNumberYearly: mondayWeeklyRecord?.mondayWeekNumberYearly || null,
      evenMondayWeekNumberMonthly: mondayWeeklyRecord?.evenMondayWeekNumberMonthly || false,
      evenMondayWeekNumberYearly: mondayWeeklyRecord?.evenMondayWeekNumberYearly || false,
      mondayWeeklyReturnPoints: mondayWeeklyRecord?.returnPoints || 0,
      mondayWeeklyReturnPercentage: mondayWeeklyRecord?.returnPercentage || 0,
      positiveMondayWeek: mondayWeeklyRecord?.positiveWeek || false,
      
      // Expiry weekly fields
      expiryWeeklyDate: expiryDate,
      expiryWeekNumberMonthly: expiryWeeklyRecord?.expiryWeekNumberMonthly || null,
      expiryWeekNumberYearly: expiryWeeklyRecord?.expiryWeekNumberYearly || null,
      evenExpiryWeekNumberMonthly: expiryWeeklyRecord?.evenExpiryWeekNumberMonthly || false,
      evenExpiryWeekNumberYearly: expiryWeeklyRecord?.evenExpiryWeekNumberYearly || false,
      expiryWeeklyReturnPoints: expiryWeeklyRecord?.returnPoints || 0,
      expiryWeeklyReturnPercentage: expiryWeeklyRecord?.returnPercentage || 0,
      positiveExpiryWeek: expiryWeeklyRecord?.positiveWeek || false,
      
      // Monthly fields
      evenMonth: isEvenMonth(month),
      monthlyReturnPoints: monthlyRecord?.returnPoints || 0,
      monthlyReturnPercentage: monthlyRecord?.returnPercentage || 0,
      positiveMonth: monthlyRecord?.positiveMonth || false,
      
      // Yearly fields
      evenYear: isEvenYear(year),
      yearlyReturnPoints: yearlyRecord?.returnPoints || 0,
      yearlyReturnPercentage: yearlyRecord?.returnPercentage || 0,
      positiveYear: yearlyRecord?.positiveYear || false,
    };
  });

  // Add trading day numbers
  dailyData = calculateTradingMonthDays(dailyData);
  dailyData = calculateTradingYearDays(dailyData);

  return {
    daily: dailyData,
    mondayWeekly: mondayWeeklyData,
    expiryWeekly: expiryWeeklyData,
    monthly: monthlyData,
    yearly: yearlyData,
  };
}

module.exports = {
  calculateReturns,
  getWeekdayName,
  getCalendarMonthDay,
  getCalendarYearDay,
  isEvenYear,
  isEvenMonth,
  isEvenDay,
  isLeapYear,
  getMondayWeeklyDate,
  getExpiryWeeklyDate,
  calculateTradingMonthDays,
  calculateTradingYearDays,
  calculateWeekNumbers,
  aggregateOHLCV,
  groupByMondayWeek,
  groupByExpiryWeek,
  groupByMonth,
  groupByYear,
  calculateAllDerivedFields,
};
