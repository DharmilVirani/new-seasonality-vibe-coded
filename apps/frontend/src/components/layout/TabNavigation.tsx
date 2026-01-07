'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
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

const tabs = [
  { name: 'Daily', href: '/dashboard/daily', icon: Calendar },
  { name: 'Weekly', href: '/dashboard/weekly', icon: CalendarDays },
  { name: 'Monthly', href: '/dashboard/monthly', icon: CalendarRange },
  { name: 'Yearly', href: '/dashboard/yearly', icon: Layers },
  { name: 'Scenario', href: '/dashboard/scenario', icon: TrendingUp },
  { name: 'Election', href: '/dashboard/election', icon: Vote },
  { name: 'Scanner', href: '/dashboard/scanner', icon: Search, tier: 'basic' },
  { name: 'Backtester', href: '/dashboard/backtester', icon: TestTube, tier: 'premium' },
  { name: 'Phenomena', href: '/dashboard/phenomena', icon: Sparkles, tier: 'basic' },
  { name: 'Basket', href: '/dashboard/basket', icon: ShoppingBasket, tier: 'enterprise' },
  { name: 'Charts', href: '/dashboard/charts', icon: LineChart },
];

const tierOrder = ['trial', 'basic', 'premium', 'enterprise'];

export function TabNavigation() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const userTierIndex = tierOrder.indexOf(user?.subscriptionTier || 'trial');

  return (
    <nav className="border-b bg-background">
      <div className="container">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const requiredTierIndex = tab.tier ? tierOrder.indexOf(tab.tier) : 0;
            const isLocked = userTierIndex < requiredTierIndex;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.name}
                href={isLocked ? '#' : tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted',
                  isLocked && 'opacity-50 cursor-not-allowed'
                )}
                onClick={(e) => isLocked && e.preventDefault()}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
                {isLocked && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
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
