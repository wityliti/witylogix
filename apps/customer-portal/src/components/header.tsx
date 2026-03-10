'use client';

import { Bell, User, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  customerName?: string;
  onMenuClick?: () => void;
}

export function Header({ customerName = 'John Doe', onMenuClick }: HeaderProps) {
  return (
    <header className={cn(
      'sticky top-0 z-40 bg-wl-bg-surface border-b border-wl-border-subtle',
      'px-4 sm:px-6 lg:px-8 py-4'
    )}>
      <div className={cn(
        'flex items-center justify-between h-16 gap-4'
      )}>
        {/* Left: Menu button for mobile */}
        <button
          onClick={onMenuClick}
          className={cn(
            'lg:hidden p-2 hover:bg-wl-bg-elevated rounded-md',
            'transition-colors duration-fast'
          )}
          aria-label="Toggle menu"
        >
          <Menu size={24} className="text-wl-text-primary" />
        </button>

        {/* Center: Spacer */}
        <div className="flex-1" />

        {/* Right: Notifications and Profile */}
        <div className={cn(
          'flex items-center gap-2 sm:gap-4'
        )}>
          {/* Notification Bell */}
          <button
            className={cn(
              'relative p-2 hover:bg-wl-bg-elevated rounded-md',
              'transition-colors duration-fast'
            )}
            aria-label="Notifications"
          >
            <Bell size={20} className="text-wl-text-secondary" />
            <span className={cn(
              'absolute top-1 right-1 w-2 h-2',
              'bg-wl-danger-500 rounded-full'
            )} />
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-wl-border-subtle" />

          {/* Profile Section */}
          <div className={cn(
            'hidden sm:flex items-center gap-3 pl-4'
          )}>
            <div className="text-right">
              <p className="text-sm font-medium text-wl-text-primary">
                {customerName}
              </p>
              <p className="text-xs text-wl-text-tertiary">
                Customer
              </p>
            </div>
            <button
              className={cn(
                'w-10 h-10 rounded-full bg-wl-primary-500',
                'flex items-center justify-center text-wl-text-inverse',
                'hover:bg-wl-primary-600 transition-colors duration-fast'
              )}
              aria-label="Profile menu"
            >
              <User size={18} />
            </button>
          </div>

          {/* Mobile Profile Button */}
          <button
            className={cn(
              'sm:hidden w-10 h-10 rounded-full bg-wl-primary-500',
              'flex items-center justify-center text-wl-text-inverse',
              'hover:bg-wl-primary-600 transition-colors duration-fast'
            )}
            aria-label="Profile menu"
          >
            <User size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
