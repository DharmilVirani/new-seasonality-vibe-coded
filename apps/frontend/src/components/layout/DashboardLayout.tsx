'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LoadingOverlay } from '@/components/ui/loading';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3,
  Calendar,
  Zap,
  Search,
  ShoppingCart,
  Settings,
  LogOut,
  Sparkles,
  LineChart,
  CalendarDays,
  CalendarRange,
  Vote,
  TestTube
} from 'lucide-react';
import { cn, TAB_COLORS } from '@/lib/utils';

// Premium glassmorphism & sophisticated aesthetic adjustments
const glassClasses = "bg-white/80 backdrop-blur-2xl border border-white/40 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-slate-900/5";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
};

const navigationGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Analysis',
    items: [
      { icon: Calendar, label: 'Daily', href: '/dashboard/daily', color: TAB_COLORS.daily.accent },
      { icon: CalendarDays, label: 'Weekly', href: '/dashboard/weekly', color: TAB_COLORS.weekly.accent },
      { icon: CalendarRange, label: 'Monthly', href: '/dashboard/monthly', color: TAB_COLORS.monthly.accent },
      { icon: Zap, label: 'Events', href: '/dashboard/events', color: TAB_COLORS.events.accent },
    ]
  },
  {
    title: 'Strategy',
    items: [
      { icon: LineChart, label: 'Scenario', href: '/dashboard/scenario', color: TAB_COLORS.scenario.accent },
      { icon: Vote, label: 'Election', href: '/dashboard/election', color: TAB_COLORS.election.accent },
      { icon: Sparkles, label: 'Phenomena', href: '/dashboard/phenomena', color: TAB_COLORS.phenomena.accent },
      { icon: TestTube, label: 'Backtester', href: '/dashboard/backtester', color: TAB_COLORS.backtester.accent },
    ]
  },
  {
    title: 'Tools',
    items: [
      { icon: Search, label: 'Scanner', href: '/dashboard/scanner', color: TAB_COLORS.scanner.accent },
      { icon: ShoppingCart, label: 'Basket', href: '/dashboard/basket', color: TAB_COLORS.basket.accent },
      { icon: BarChart3, label: 'Charts', href: '/dashboard/charts', color: TAB_COLORS.charts.accent },
    ]
  }
];

const allNavigationItems = navigationGroups.flatMap(g => g.items);

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  useNavigationLoading(setIsNavigating);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getPageColor = useMemo(() => {
    const activeItem = allNavigationItems.find(item => pathname === item.href);
    return activeItem?.color || '#10b981';
  }, [pathname]);

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <LoadingOverlay isVisible={isNavigating} text="Loading..." />

        {/* LEFT NAVIGATION SIDEBAR - Floating Premium Glass Dock */}
        <div className="py-4 pl-4 pr-0 h-full">
          <aside className={cn("flex flex-col h-full w-[64px] flex-shrink-0 relative z-30 rounded-2xl overflow-hidden", glassClasses)}>
            {/* Logo area */}
            <div className="h-16 flex items-center justify-center border-b border-slate-200/50 mt-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.12)] relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${getPageColor} 0%, ${getPageColor}dd 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-white/20" style={{ mixBlendMode: 'overlay' }}></div>
                <BarChart3 className="h-5 w-5 text-white relative z-10" strokeWidth={2.5} />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
              <div className="space-y-1.5 flex flex-col items-center">
                {allNavigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <div key={item.href} className="relative flex justify-center">
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavigation(item.href)}
                            className={cn(
                              "w-11 h-11 mx-auto rounded-xl flex items-center justify-center relative transition-all duration-300 group outline-none",
                              isActive ? "bg-slate-100/50 shadow-inner" : "hover:bg-slate-50 border border-transparent hover:border-slate-200/50"
                            )}
                          >
                            {isActive && (
                              <div
                                className="absolute left-[3px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full transition-all duration-500 ease-out shadow-sm"
                                style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}80` }}
                              />
                            )}

                            <div
                              className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300",
                                isActive
                                  ? "text-white shadow-sm scale-100 ring-1 ring-black/5"
                                  : "text-slate-400 group-hover:text-slate-800 group-hover:scale-105"
                              )}
                              style={isActive ? { backgroundImage: `linear-gradient(135deg, ${item.color} 0%, ${item.color}ee 100%)`, boxShadow: `0 4px 12px ${item.color}30` } : {}}
                            >
                              <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.75} />
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={14} className="relative z-[100] bg-slate-900 border border-slate-800 text-slate-100 font-medium tracking-wide shadow-xl px-3 py-1.5 text-[11px] uppercase rounded-lg">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* Bottom Section */}
            <div className="p-2 border-t border-slate-200/50 bg-slate-50/30 flex flex-col items-center gap-2 pb-5 mt-auto">
              {/* Settings */}
              <div className="relative">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center hover:bg-slate-50 group transition-all duration-300 border border-transparent hover:border-slate-200/50"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-slate-800 transition-colors">
                        <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={14} className="relative z-[100] bg-slate-900 border border-slate-800 text-slate-100 font-medium tracking-wide shadow-xl px-3 py-1.5 text-[11px] uppercase rounded-lg">
                    Settings
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Logout */}
              <div className="relative">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center hover:bg-slate-50 group transition-all duration-300 border border-transparent hover:border-slate-200/50"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-rose-500 transition-colors">
                        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={14} className="relative z-[100] bg-slate-900 border border-slate-800 text-slate-100 font-medium tracking-wide shadow-xl px-3 py-1.5 text-[11px] uppercase rounded-lg">
                    Logout
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* User Profile */}
              <div
                className="mt-3 p-1 rounded-full flex items-center justify-center bg-white shadow-sm ring-1 ring-slate-200/50 relative group cursor-pointer transition-transform duration-300 hover:scale-105"
                title={user?.name || 'User'}
              >
                <div className="absolute inset-[-2px] rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 opacity-50 group-hover:opacity-100 transition-opacity -z-10 blur-[1px]"></div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${getPageColor} 0%, ${getPageColor}dd 100%)`,
                    fontFamily: 'system-ui'
                  }}
                >
                  {user?.name?.charAt(0) || 'U'}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-hidden min-w-0 bg-slate-50 rounded-tl-3xl shadow-[inset_4px_4px_10px_rgba(0,0,0,0.02)] border-t border-l border-slate-200/60 ml-2 mt-2 flex flex-col">
          <main className="flex-1 overflow-y-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
