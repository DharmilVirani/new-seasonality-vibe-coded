'use client';

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendar } from 'react-icons/fa';

export default function DateRangePicker({ dateRange, onDateRangeChange, isLoading }) {
  const [startDate, endDate] = dateRange;

  return (
    <div>
      <label className="form-label">Date Range</label>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <DatePicker
            selected={startDate}
            onChange={(date) => onDateRangeChange([date, endDate])}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            placeholderText="Start date"
            className="form-input w-full"
            disabled={isLoading}
            dateFormat="yyyy-MM-dd"
          />
          <FaCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        <span className="text-gray-400">to</span>

        <div className="relative flex-1">
          <DatePicker
            selected={endDate}
            onChange={(date) => onDateRangeChange([startDate, date])}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate}
            placeholderText="End date"
            className="form-input w-full"
            disabled={isLoading}
            dateFormat="yyyy-MM-dd"
          />
          <FaCalendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="mt-2 flex space-x-2">
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(today.getMonth() - 1);
            onDateRangeChange([oneMonthAgo, today]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
        >
          Last Month
        </button>

        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(today.getMonth() - 3);
            onDateRangeChange([threeMonthsAgo, today]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
        >
          Last 3 Months
        </button>

        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(today.getMonth() - 6);
            onDateRangeChange([sixMonthsAgo, today]);
          }}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
        >
          Last 6 Months
        </button>

        <button
          type="button"
          onClick={() => onDateRangeChange([null, null])}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}