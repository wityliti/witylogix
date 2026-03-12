"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Provider Switcher component
 * Quick provider switching dropdown with status indicators and grouping
 * Features: provider list, status badges, category grouping, search/filter
 */

export type ProviderStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type ProviderCategory = 'ecommerce' | 'payment' | 'communication' | 'automation';

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  status: ProviderStatus;
  icon: string;
  isActive: boolean;
}

export interface ProviderSwitcherProps {
  providers: Provider[];
  activeProviderId?: string;
  onSelectProvider?: (providerId: string) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  ecommerce: 'E-Commerce',
  payment: 'Payment',
  communication: 'Communication',
  automation: 'Automation',
};

const CATEGORY_COLORS: Record<ProviderCategory, string> = {
  ecommerce: 'var(--wl-primary-500)',
  payment: 'var(--wl-success-500)',
  communication: 'var(--wl-info-500)',
  automation: 'var(--wl-warning-500)',
};

export function ProviderSwitcher({
  providers,
  activeProviderId,
  onSelectProvider,
  className,
}: ProviderSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  const getStatusColor = (status: ProviderStatus): string => {
    switch (status) {
      case 'connected':
        return 'var(--wl-success-500)';
      case 'connecting':
        return 'var(--wl-warning-500)';
      case 'disconnected':
        return 'var(--wl-border-subtle)';
      case 'error':
        return 'var(--wl-danger-500)';
    }
  };

  const getStatusLabel = (status: ProviderStatus): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
    }
  };

  const getStatusBadgeClass = (status: ProviderStatus): string => {
    switch (status) {
      case 'connected':
        return 'bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300';
      case 'connecting':
        return 'bg-wl-warning-100 dark:bg-wl-warning-900/30 text-wl-warning-700 dark:text-wl-warning-300';
      case 'disconnected':
        return 'bg-wl-surface-hover text-wl-text-secondary';
      case 'error':
        return 'bg-wl-danger-100 dark:bg-wl-danger-900/30 text-wl-danger-700 dark:text-wl-danger-300';
    }
  };

  // Group providers by category
  const groupedProviders: Record<ProviderCategory, Provider[]> = {
    ecommerce: [],
    payment: [],
    communication: [],
    automation: [],
  };

  providers.forEach((provider) => {
    if (provider.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      groupedProviders[provider.category].push(provider);
    }
  });

  const connectedCount = providers.filter((p) => p.status === 'connected').length;
  const disconnectedCount = providers.filter((p) => p.status === 'disconnected').length;

  return (
    <div className={cn('relative w-full', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-4 py-3 rounded-lg border border-wl-border-subtle',
          'bg-wl-bg-surface text-left transition-all duration-200',
          'hover:border-wl-border-default hover:shadow-sm',
          isOpen && 'border-wl-primary-500 shadow-sm'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeProvider ? (
              <>
                <span className="text-2xl">{activeProvider.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-wl-text-primary">{activeProvider.name}</div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getStatusColor(activeProvider.status) }}
                    />
                    <span className="text-xs text-wl-text-secondary">{getStatusLabel(activeProvider.status)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="text-sm font-semibold text-wl-text-primary">Select a provider</div>
                <div className="text-xs text-wl-text-secondary">{providers.length} available</div>
              </div>
            )}
          </div>
          <span
            className={cn(
              'text-wl-text-secondary transition-transform',
              isOpen && 'rotate-180'
            )}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-2',
            'border border-wl-border-subtle rounded-lg bg-wl-bg-surface shadow-lg',
            'overflow-hidden'
          )}
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-wl-border-subtle bg-wl-surface-hover sticky top-0">
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className={cn(
                'w-full px-3 py-2 rounded text-sm',
                'border border-wl-border-subtle',
                'bg-wl-bg-surface text-wl-text-primary placeholder-wl-text-tertiary',
                'focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500/20'
              )}
            />
          </div>

          {/* Provider Stats */}
          <div className="px-4 py-2 text-xs text-wl-text-secondary border-b border-wl-border-subtle flex gap-4 bg-wl-surface-hover">
            <span>
              <strong>{connectedCount}</strong> connected
            </span>
            <span>
              <strong>{disconnectedCount}</strong> disconnected
            </span>
          </div>

          {/* Provider Groups */}
          <div className="max-h-96 overflow-y-auto">
            {(['ecommerce', 'payment', 'communication', 'automation'] as const).map((category) => {
              const categoryProviders = groupedProviders[category];
              if (categoryProviders.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-4 py-2 bg-wl-surface-hover border-t border-wl-border-subtle">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[category] }}
                      />
                      <span className="text-xs font-semibold text-wl-text-secondary uppercase">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-xs text-wl-text-tertiary ml-auto">
                        {categoryProviders.length}
                      </span>
                    </div>
                  </div>

                  {/* Category Items */}
                  {categoryProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        onSelectProvider?.(provider.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-wl-border-subtle',
                        'hover:bg-wl-surface-hover transition-colors',
                        activeProviderId === provider.id && 'bg-wl-primary-500/10 border-l-2 border-wl-primary-500'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{provider.icon}</span>
                          <div>
                            <div className="text-sm font-semibold text-wl-text-primary">
                              {provider.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  provider.status === 'connected' && 'animate-pulse'
                                )}
                                style={{ backgroundColor: getStatusColor(provider.status) }}
                              />
                              <span className="text-xs text-wl-text-secondary">
                                {getStatusLabel(provider.status)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              provider.status === 'connected'
                                ? 'bg-wl-success-100 dark:bg-wl-success-900/30 text-wl-success-700 dark:text-wl-success-300'
                                : 'bg-wl-surface-hover text-wl-text-secondary'
                            )}
                          >
                            {provider.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {activeProviderId === provider.id && (
                            <span className="text-wl-primary-500 text-lg">✓</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Empty State */}
            {Object.values(groupedProviders).every((arr) => arr.length === 0) && (
              <div className="p-6 text-center text-wl-text-tertiary">
                <div className="text-sm">No providers found</div>
                <div className="text-xs mt-1">Try adjusting your search</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-wl-border-subtle bg-wl-surface-hover px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-wl-text-secondary">
              Total: {providers.length} providers
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-wl-primary-500 hover:text-wl-primary-600 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <button
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}
    </div>
  );
}
