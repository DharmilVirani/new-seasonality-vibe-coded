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
  { icon: Calendar, label: 'Daily', href: '/dashboard/daily', color: 'blue' },
  { icon: BarChart3, label: 'Weekly', href: '/dashboard/weekly', color: 'emerald' },
  { icon: TrendingUp, label: 'Monthly', href: '/dashboard/monthly', color: 'purple' },
  { icon: PieChart, label: 'Yearly', href: '/dashboard/yearly', color: 'orange' },
  { icon: Zap, label: 'Scenario', href: '/dashboard/scenario', color: 'yellow' },
  { icon: Target, label: 'Election', href: '/dashboard/election', color: 'red' },
  { icon: Search, label: 'Scanner', href: '/dashboard/scanner', color: 'cyan' },
  { icon: Layers, label: 'Backtester', href: '/dashboard/backtester', color: 'pink' },
  { icon: Target, label: 'Phenomena', href: '/dashboard/phenomena', color: 'teal' },
  { icon: ShoppingCart, label: 'Basket', href: '/dashboard/basket', color: 'indigo' },
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
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            pathname.includes('/weekly') ? "bg-emerald-600" :
            pathname.includes('/daily') ? "bg-blue-600" :
            pathname.includes('/monthly') ? "bg-purple-600" :
            pathname.includes('/yearly') ? "bg-orange-600" :
            "bg-indigo-600"
          )}>
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-2 w-full px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            // Color mapping for each page
            const colorClasses = {
              blue: { bg: 'bg-blue-50', text: 'text-blue-600', indicator: 'bg-blue-600' },
              emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', indicator: 'bg-emerald-600' },
              purple: { bg: 'bg-purple-50', text: 'text-purple-600', indicator: 'bg-purple-600' },
              orange: { bg: 'bg-orange-50', text: 'text-orange-600', indicator: 'bg-orange-600' },
              yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', indicator: 'bg-yellow-600' },
              red: { bg: 'bg-red-50', text: 'text-red-600', indicator: 'bg-red-600' },
              cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', indicator: 'bg-cyan-600' },
              pink: { bg: 'bg-pink-50', text: 'text-pink-600', indicator: 'bg-pink-600' },
              teal: { bg: 'bg-teal-50', text: 'text-teal-600', indicator: 'bg-teal-600' },
              indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', indicator: 'bg-indigo-600' },
            };
            
            const colors = colorClasses[item.color as keyof typeof colorClasses] || colorClasses.indigo;
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative group",
                  isActive 
                    ? `${colors.bg} ${colors.text}` 
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
                  <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r", colors.indicator)} />
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
