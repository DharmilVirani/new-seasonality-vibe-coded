'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LoadingOverlay } from '@/components/ui/loading';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  PieChart, 
  Zap,
  Search,
  Target,
  Layers,
  ShoppingCart,
  Settings,
  LogOut,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { icon: Calendar, label: 'Daily', href: '/dashboard/daily' },
  { icon: BarChart3, label: 'Weekly', href: '/dashboard/weekly' },
  { icon: TrendingUp, label: 'Monthly', href: '/dashboard/monthly' },
  { icon: PieChart, label: 'Yearly', href: '/dashboard/yearly' },
  { icon: Zap, label: 'Scenario', href: '/dashboard/scenario' },
  { icon: Target, label: 'Election', href: '/dashboard/election' },
  { icon: Search, label: 'Scanner', href: '/dashboard/scanner' },
  { icon: Layers, label: 'Backtester', href: '/dashboard/backtester' },
  { icon: Target, label: 'Phenomena', href: '/dashboard/phenomena' },
  { icon: ShoppingCart, label: 'Basket', href: '/dashboard/basket' },
];

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

  return (
    <div className="flex h-screen bg-slate-50">
      <LoadingOverlay isVisible={isNavigating} text="Loading..." />
      
      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-2 w-full px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                )}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
                
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
                
                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section - Empty now, user profile moved to header */}
        <div className="flex flex-col gap-2 w-full px-2 pt-4 border-t border-slate-200">
          {/* Empty - all controls moved to header */}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
