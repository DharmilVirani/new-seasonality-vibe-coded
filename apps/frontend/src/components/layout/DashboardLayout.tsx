'use client';

import { Header } from './Header';
import { TabNavigation } from './TabNavigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TabNavigation />
      <main className="container py-6">{children}</main>
    </div>
  );
}
