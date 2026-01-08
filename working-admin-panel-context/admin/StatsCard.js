"use client";

import React from 'react';

export const StatsCard = ({ title, value, icon: Icon, color, trend, subtitle }) => {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' }
  };

  const style = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group">
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-3">
          <p className="text-slate-500 font-medium text-sm">{title}</p>
          <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
          {trend && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.icon}`}>{trend}</span>
          )}
          {subtitle && <p className="text-xs text-slate-400 italic">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-2xl ${style.bg} ${style.icon}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
