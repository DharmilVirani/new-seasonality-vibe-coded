'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LoadingPage } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Calendar, Search } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard/daily');
    }
  }, [isAuthenticated, router]);

  const features = [
    { icon: Calendar, title: 'Daily Analysis', desc: '40+ filters for daily seasonality patterns' },
    { icon: TrendingUp, title: 'Scenario Testing', desc: 'Backtest trading scenarios with historical data' },
    { icon: Search, title: 'Symbol Scanner', desc: 'Find consecutive trending patterns across symbols' },
    { icon: BarChart3, title: 'Election Analysis', desc: 'Political cycle impact on markets' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="container py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">Seasonality SaaS</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="container py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Advanced Seasonality Analysis for Trading
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Discover market patterns with 11 analysis modules and 40+ filters.
            Make data-driven trading decisions with historical seasonality insights.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">View Demo</Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          {features.map((feature) => (
            <div key={feature.title} className="p-6 bg-card rounded-lg border">
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
