'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LoadingOverlay } from '@/components/ui/loading';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';
import { 
  BarChart3, 
  Calendar, 
  Zap,
  Search,
  Layers,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LineChart,
  CalendarDays,
  CalendarRange,
  Vote,
  TestTube
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigationGroups = [
  {
    title: 'Analysis',
    items: [
      { icon: Calendar, label: 'Daily', href: '/dashboard/daily', color: '#3b82f6' },
      { icon: CalendarDays, label: 'Weekly', href: '/dashboard/weekly', color: '#f59e0b' },
      { icon: CalendarRange, label: 'Monthly', href: '/dashboard/monthly', color: '#8b5cf6' },
      { icon: Layers, label: 'Yearly', href: '/dashboard/yearly', color: '#f97316' },
      { icon: Zap, label: 'Events', href: '/dashboard/events', color: '#7c3aed' },
    ]
  },
  {
    title: 'Strategy',
    items: [
      { icon: LineChart, label: 'Scenario', href: '/dashboard/scenario', color: '#eab308' },
      { icon: Vote, label: 'Election', href: '/dashboard/election', color: '#ef4444' },
      { icon: Sparkles, label: 'Phenomena', href: '/dashboard/phenomena', color: '#14b8a6' },
      { icon: TestTube, label: 'Backtester', href: '/dashboard/backtester', color: '#ec4899' },
    ]
  },
  {
    title: 'Tools',
    items: [
      { icon: Search, label: 'Scanner', href: '/dashboard/scanner', color: '#06b6d4' },
      { icon: ShoppingCart, label: 'Basket', href: '/dashboard/basket', color: '#6366f1' },
      { icon: BarChart3, label: 'Charts', href: '/dashboard/charts', color: '#10b981' },
    ]
  }
];

const allNavigationItems = navigationGroups.flatMap(g => g.items);

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    return activeItem?.color || '#6366f1';
  }, [pathname]);

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  // Dispatch resize event when sidebar collapses/expands (for charts to redraw)
  const handleToggleSidebar = () => {
    setCollapsed(!collapsed);
    // Trigger resize event for charts
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <LoadingOverlay isVisible={isNavigating} text="Loading..." />
      
      {/* LEFT NAVIGATION SIDEBAR - No animation for max performance */}
      <aside 
        className={cn(
          "flex flex-col h-full bg-white border-r border-slate-200 flex-shrink-0 relative z-30",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Toggle Button */}
        <div className={cn(
          "h-10 flex items-center border-b border-slate-100",
          collapsed ? "justify-center px-0" : "justify-end px-3"
        )}>
          <button
            onClick={handleToggleSidebar}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-slate-500" />
            )}
          </button>
        </div>

        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/50",
          collapsed ? "justify-center px-2" : "px-4"
        )}>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${getPageColor} 0%, ${getPageColor}dd 100%)`,
            }}
          >
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="ml-3 overflow-hidden">
              <span className="font-bold text-slate-800 text-sm whitespace-nowrap block">
                Seasonality
              </span>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                Analytics Platform
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden">
          {navigationGroups.map((group, groupIndex) => (
            <div key={group.title} className={cn("mb-4", groupIndex > 0 && "mt-6")}>
              {!collapsed && (
                <div className="px-3 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {group.title}
                  </span>
                </div>
              )}
              
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={cn(
                        "w-full h-10 rounded-lg flex items-center relative overflow-hidden transition-all duration-150",
                        collapsed ? "justify-center px-0" : "px-2",
                        isActive ? "bg-slate-100" : "hover:bg-slate-50"
                      )}
                    >
                      {isActive && (
                        <div 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      
                      <div 
                        className={cn(
                          "rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          collapsed ? "w-8 h-8" : "w-8 h-8",
                          isActive ? "text-white" : "text-slate-400 bg-slate-100"
                        )}
                        style={isActive ? { backgroundColor: item.color } : {}}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      {!collapsed && (
                        <span className={cn(
                          "ml-3 text-sm font-medium whitespace-nowrap",
                          isActive ? "text-slate-800" : "text-slate-500"
                        )}>
                          {item.label}
                        </span>
                      )}
                      
                      {isActive && collapsed && (
                        <div 
                          className="absolute right-1.5 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className={cn(
          "p-2 border-t border-slate-100 bg-slate-50/50",
          collapsed && "flex flex-col items-center"
        )}>
          <button
            className={cn(
              "h-10 rounded-lg flex items-center hover:bg-white transition-colors",
              collapsed ? "w-10 justify-center px-0" : "px-2 w-full"
            )}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 bg-slate-100">
              <Settings className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="ml-3 text-sm font-medium text-slate-500 whitespace-nowrap">
                Settings
              </span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              "h-10 rounded-lg flex items-center hover:bg-white transition-colors mt-1",
              collapsed ? "w-10 justify-center px-0" : "px-2 w-full"
            )}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 bg-slate-100">
              <LogOut className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="ml-3 text-sm font-medium text-slate-500 whitespace-nowrap">
                Logout
              </span>
            )}
          </button>

          {/* User Profile */}
          <div className={cn(
            "mt-3 p-2 rounded-xl flex items-center bg-white border border-slate-100 shadow-sm",
            collapsed ? "w-10 justify-center" : "w-full"
          )}>
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${getPageColor} 0%, ${getPageColor}dd 100%)`,
              }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!collapsed && (
              <div className="ml-2.5 overflow-hidden">
                <div className="text-sm font-semibold text-slate-700 truncate">{user?.name || 'User'}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email || 'user@example.com'}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden min-w-0">
        {children}
      </main>
    </div>
  );
}
