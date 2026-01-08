"use client";
import React from 'react';
import { Save, Globe, Cpu } from 'lucide-react';

export const SystemSettings = () => {
  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-indigo-600">
          <Globe className="w-5 h-5" />
          <h4 className="font-bold">General Configuration</h4>
        </div>
        <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">System Environment</label>
            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100">
              <option>Production (Stable)</option>
              <option>Staging</option>
              <option>Development</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center space-x-2 text-indigo-600">
          <Cpu className="w-5 h-5" />
          <h4 className="font-bold">Engine & API</h4>
        </div>
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">Real-time Calculation</p>
            <div className="w-11 h-6 bg-indigo-600 rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">API Base URL</label>
            <input 
              type="text" 
              defaultValue="https://api.seasonality.pro/v1"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4">
        <button className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95">
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
};
