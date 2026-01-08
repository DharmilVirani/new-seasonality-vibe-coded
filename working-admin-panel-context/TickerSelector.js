'use client';

import { useState } from 'react';
import { FaChevronDown, FaSearch } from 'react-icons/fa';

export default function TickerSelector({ tickers, selectedTicker, onTickerChange, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTickers = tickers.filter(ticker =>
    ticker.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTickerObj = tickers.find(t => t.id === selectedTicker);

  return (
    <div className="relative">
      <label className="form-label">Select Ticker</label>

      <div className="relative">
        <button
          type="button"
          className="form-input pr-10 text-left cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
        >
          {selectedTickerObj ? (
            <div className="flex items-center justify-between">
              <span>{selectedTickerObj.symbol}</span>
              <FaChevronDown className="text-gray-400" />
            </div>
          ) : (
            <div className="flex items-center justify-between text-gray-500">
              <span>Select a ticker...</span>
              <FaChevronDown className="text-gray-400" />
            </div>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tickers..."
                className="w-full pl-10 pr-3 py-1 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filteredTickers.length > 0 ? (
              <ul className="py-1">
                {filteredTickers.map((ticker) => (
                  <li
                    key={ticker.id}
                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                      ticker.id === selectedTicker ? 'bg-blue-50 text-blue-600' : 'text-gray-800'
                    }`}
                    onClick={() => {
                      onTickerChange(ticker.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    {ticker.symbol}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">
                No tickers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}