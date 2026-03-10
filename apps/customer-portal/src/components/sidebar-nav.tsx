'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  MapPin,
  Settings,
  HelpCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: Home,
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: Package,
  },
  {
    href: '/track',
    label: 'Track',
    icon: MapPin,
  },
  {
    href: '/preferences',
    label: 'Preferences',
    icon: Settings,
  },
  {
    href: '/support',
    label: 'Support',
    icon: HelpCircle,
  },
];

export function SidebarNav({ isOpen = true, onClose }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40',
          'w-64 bg-wl-bg-sidebar border-r border-wl-border-subtle',
          'flex flex-col',
          'transition-transform duration-base lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-6 py-6',
          'border-b border-wl-border-subtle'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-md',
              'bg-gradient-to-br from-wl-primary-400 to-wl-primary-600',
              'flex items-center justify-center',
              'text-wl-text-inverse font-bold'
            )}>
              W
            </div>
            <h1 className="text-lg font-bold text-wl-text-primary">
              Witylogix
            </h1>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-wl-bg-elevated rounded-md"
            aria-label="Close sidebar"
          >
            <X size={20} className="text-wl-text-primary" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 overflow-y-auto px-4 py-6',
          'flex flex-col gap-2'
        )}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-3 rounded-md',
                  'flex items-center gap-3',
                  'text-sm font-medium',
                  'transition-colors duration-fast',
                  isActive
                    ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                    : 'text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-elevated'
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          'px-4 py-6 border-t border-wl-border-subtle',
          'text-xs text-wl-text-tertiary'
        )}>
          <p>Version 1.0.0</p>
          <p className="mt-2">© 2026 Witylogix</p>
        </div>
      </aside>
    </>
  );
}
