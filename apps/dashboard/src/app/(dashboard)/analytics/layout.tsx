'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export default function AnalyticsLayout({ children }: LayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/analytics' },
    { name: 'Reports', href: '/analytics/reports' },
    { name: 'Dashboards', href: '/analytics/dashboards' },
  ];

  return (
    <div className="space-y-6">
      {/* Analytics Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wl-text-primary">Analytics</h1>
          <p className="text-wl-text-secondary mt-1">
            Monitor dashboards, reports, and data sources
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-wl-border-subtle">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || (pathname === '/analytics' && tab.href === '/analytics');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'px-1 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-wl-primary-500 text-wl-primary-400'
                    : 'border-transparent text-wl-text-secondary hover:text-wl-text-primary'
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
