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
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/track', label: 'Track', icon: MapPin },
  { href: '/preferences', label: 'Preferences', icon: Settings },
  { href: '/support', label: 'Support', icon: HelpCircle },
] as const;

export function SidebarNav({ isOpen = true, onClose }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40',
          'w-60 bg-wl-bg-root flex flex-col',
          'transition-transform duration-base lg:translate-x-0',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-14 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 rounded-md',
              'bg-wl-primary-500',
              'flex items-center justify-center',
              'text-xs font-bold text-wl-text-inverse'
            )}>
              W
            </div>
            <span className="text-sm font-semibold text-wl-text-primary tracking-tight">
              Witylogix
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-wl-bg-elevated rounded-md"
            aria-label="Close sidebar"
          >
            <X size={18} className="text-wl-text-tertiary" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname?.startsWith(item.href + '/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md',
                  'text-sm transition-colors duration-fast',
                  isActive
                    ? 'bg-wl-bg-elevated text-wl-text-primary font-medium'
                    : 'text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-elevated'
                )}
              >
                <Icon size={16} className={isActive ? 'text-wl-primary-500' : ''} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 text-xs text-wl-text-tertiary">
          <p>v1.0.0</p>
        </div>
      </aside>
    </>
  );
}
