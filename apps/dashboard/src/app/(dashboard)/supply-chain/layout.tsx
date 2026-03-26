'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export default function SupplyChainLayout({ children }: LayoutProps) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/supply-chain' },
    { name: 'Inventory', href: '/supply-chain/inventory' },
    { name: 'Orders', href: '/supply-chain/orders' },
  ];

  return (
    <div className="space-y-6">
      {/* Supply Chain Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-wl-text-primary">Supply Chain</h1>
          <p className="text-wl-text-secondary mt-1">
            Manage inventory, orders, and fulfillment operations
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-wl-border-subtle">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || (pathname === '/supply-chain' && tab.href === '/supply-chain');
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
