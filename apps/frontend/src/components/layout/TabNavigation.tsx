'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { TAB_COLORS, type TabName } from '@/lib/utils';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  Vote,
  Search,
  TestTube,
  Sparkles,
  ShoppingBasket,
  LineChart,
  Layers,
} from 'lucide-react';

const tabs: Array<{
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  colorKey: TabName;
  tier?: 'basic' | 'premium' | 'enterprise';
}> = [
  { name: 'Daily', href: '/dashboard/daily', icon: Calendar, colorKey: 'daily' },
  { name: 'Weekly', href: '/dashboard/weekly', icon: CalendarDays, colorKey: 'weekly' },
  { name: 'Monthly', href: '/dashboard/monthly', icon: CalendarRange, colorKey: 'monthly' },
  { name: 'Scenario', href: '/dashboard/scenario', icon: TrendingUp, colorKey: 'scenario' },
  { name: 'Election', href: '/dashboard/election', icon: Vote, colorKey: 'election' },
  { name: 'Scanner', href: '/dashboard/scanner', icon: Search, colorKey: 'scanner', tier: 'basic' },
  { name: 'Backtester', href: '/dashboard/backtester', icon: TestTube, colorKey: 'backtester', tier: 'premium' },
  { name: 'Phenomena', href: '/dashboard/phenomena', icon: Sparkles, colorKey: 'phenomena', tier: 'basic' },
  { name: 'Basket', href: '/dashboard/basket', icon: ShoppingBasket, colorKey: 'basket', tier: 'enterprise' },
  { name: 'Charts', href: '/dashboard/charts', icon: LineChart, colorKey: 'charts' },
];

const tierOrder = ['trial', 'basic', 'premium', 'enterprise'];

export function TabNavigation() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const userTierIndex = tierOrder.indexOf(user?.subscriptionTier || 'trial');

  return (
    <nav className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="container">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const requiredTierIndex = tab.tier ? tierOrder.indexOf(tab.tier) : 0;
            const isLocked = userTierIndex < requiredTierIndex;
            const isActive = pathname === tab.href;
            const colors = TAB_COLORS[tab.colorKey];

            return (
              <Link
                key={tab.name}
                href={isLocked ? '#' : tab.href}
                className={cn(
                  'group flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'border-transparent text-white'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
                style={isActive ? { 
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                } : undefined}
                onClick={(e) => isLocked && e.preventDefault()}
              >
                <Icon 
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isActive ? "text-white" : "group-hover:scale-110"
                  )} 
                />
                <span>{tab.name}</span>
                {isLocked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">
                    {tab.tier}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function getActiveTabColor(pathname: string): typeof TAB_COLORS[TabName] {
  const activeTab = tabs.find(tab => pathname === tab.href);
  return TAB_COLORS[activeTab?.colorKey || 'daily'];
}
