'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { integrationLogoCandidates } from '@/lib/integration-logos';
import { useApiQuery } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ChevronDown, Search, Package, Zap } from 'lucide-react';
import { Skeleton, CardSkeleton } from '@/components/ui/loading-skeleton';

interface CatalogApp {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  logoUrl?: string;
  authType: string;
  capabilities: string[];
  status: 'AVAILABLE' | 'COMING_SOON' | 'BETA' | 'DEPRECATED';
  isBuiltIn: boolean;
  version: string;
  installed: boolean;
  isEnabled: boolean;
  healthStatus: string | null;
}

interface MarketplaceResponse {
  apps: CatalogApp[];
  categories: Record<string, string>;
  counts: Record<string, number>;
}

type AvailabilityFilter = 'ALL' | 'AVAILABLE' | 'BETA';

const AVAILABILITY_OPTIONS: { key: AvailabilityFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'BETA', label: 'Beta' },
];

// Self-serve install flow isn't wired yet; flip to true once wired.
const INSTALL_WIRED = false;

function CatalogIntegrationLogo({ integrationId, name }: { integrationId: string; name: string }) {
  const urls = useMemo(() => integrationLogoCandidates(integrationId), [integrationId]);
  const [urlIndex, setUrlIndex] = useState(0);
  const onError = useCallback(() => {
    setUrlIndex((i) => (i + 1 < urls.length ? i + 1 : i));
  }, [urls.length]);

  return (
    <div
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
        'border border-wl-border-subtle bg-white/95 overflow-hidden',
      )}
    >
      <img
        src={urls[urlIndex]}
        alt={`${name} logo`}
        className="h-7 w-7 object-contain"
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    </div>
  );
}

export default function IntegrationCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'status'>('name');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiQuery<MarketplaceResponse>(
    '/api/v4/integrations/marketplace',
  );

  const apps = data?.apps ?? [];
  const apiCategories = data?.categories ?? {};

  // Build category list from API data with live counts
  const categories = useMemo(() => {
    const all = { key: 'ALL', label: 'All Integrations', icon: '⬡', count: apps.length };
    const cats = Object.entries(apiCategories).map(([key, label]) => ({
      key,
      label,
      icon: categoryIcon(key),
      count: apps.filter((a) => a.category === key).length,
    }));
    return [all, ...cats];
  }, [apiCategories, apps]);

  const filtered = useMemo(() => {
    let items = [...apps];

    if (selectedCategory !== 'ALL') {
      items = items.filter((a) => a.category === selectedCategory);
    }

    if (statusFilter !== 'ALL') {
      items = items.filter((a) => a.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.slug.includes(q),
      );
    }

    items.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      // Sort by status: AVAILABLE first, then BETA, then COMING_SOON/DEPRECATED
      const rank = { AVAILABLE: 0, BETA: 1, COMING_SOON: 2, DEPRECATED: 3 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    });

    return items;
  }, [apps, selectedCategory, statusFilter, searchQuery, sortBy]);

  const availableCount = apps.filter((a) => a.status === 'AVAILABLE').length;
  const betaCount = apps.filter((a) => a.status === 'BETA').length;

  if (error) {
    return <ErrorState title="Failed to load integration catalog" error={error} onRetry={refetch} />;
  }

  return (
    <>
      <Header
        title="Integration Catalog"
        subtitle={
          loading
            ? 'Loading…'
            : `${apps.length} providers · ${availableCount} available · ${betaCount} beta`
        }
      />

      <div className={cn('p-6')}>
        {/* Search */}
        <div className={cn('relative mb-4')}>
          <Search className={cn('absolute left-3 top-2.5 h-4 w-4 text-wl-text-tertiary')} />
          <input
            type="text"
            placeholder="Search integrations by name or category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 bg-wl-bg-surface border border-wl-border-subtle',
              'rounded-lg text-wl-text-primary text-sm outline-none',
              'focus-visible:border-wl-primary-500 focus-visible:ring-1 focus-visible:ring-wl-primary-500',
            )}
          />
        </div>

        {/* Mobile: availability + category pills */}
        <div className={cn('md:hidden mb-4 space-y-3')}>
          <div role="radiogroup" aria-label="Filter by availability" className={cn('flex flex-wrap gap-2')}>
            {AVAILABILITY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                role="radio"
                aria-checked={statusFilter === opt.key}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer',
                  statusFilter === opt.key
                    ? 'bg-wl-primary-500/15 text-wl-primary-400 border-wl-primary-500'
                    : 'bg-transparent text-wl-text-secondary border-wl-border-subtle hover:border-wl-border-strong',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Filter by category" className={cn('flex flex-wrap gap-2')}>
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                role="tab"
                aria-selected={selectedCategory === cat.key}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer',
                  selectedCategory === cat.key
                    ? 'bg-wl-primary-500/15 text-wl-primary-400 border-wl-primary-500'
                    : 'bg-transparent text-wl-text-secondary border-wl-border-subtle hover:border-wl-border-strong',
                )}
              >
                <span aria-hidden="true">{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: sidebar + content */}
        <div className={cn('md:grid md:grid-cols-[14rem_1fr] md:gap-6')}>
          {/* Sidebar */}
          <aside
            className={cn(
              'hidden md:block sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-y-auto',
              'rounded-lg border border-wl-border-subtle bg-wl-bg-surface p-2',
            )}
            aria-label="Filter integrations"
          >
            <div className={cn('px-2 pt-1 pb-2')}>
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider text-wl-text-tertiary mb-2')}>
                Availability
              </p>
              <div role="radiogroup" aria-label="Filter by availability" className={cn('flex gap-1')}>
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStatusFilter(opt.key)}
                    role="radio"
                    aria-checked={statusFilter === opt.key}
                    className={cn(
                      'flex-1 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-primary-500',
                      statusFilter === opt.key
                        ? 'bg-wl-primary-500/15 text-wl-primary-400 border-wl-primary-500'
                        : 'bg-transparent text-wl-text-secondary border-wl-border-subtle hover:border-wl-border-strong',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn('mx-2 my-1 border-t border-wl-border-subtle')} aria-hidden="true" />
            <p className={cn('px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-wl-text-tertiary')}>
              Category
            </p>
            {loading ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} variant="rect" className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <nav className={cn('flex flex-col gap-0.5')} role="tablist" aria-label="Filter by category">
                {categories.map((cat) => {
                  const active = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        'group flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-primary-500',
                        active
                          ? 'bg-wl-primary-500/10 text-wl-primary-400'
                          : 'text-wl-text-secondary hover:bg-wl-bg-overlay hover:text-wl-text-primary',
                      )}
                    >
                      <span className={cn('flex items-center gap-2 min-w-0')}>
                        <span className="shrink-0" aria-hidden="true">{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                          active
                            ? 'bg-wl-primary-500/20 text-wl-primary-400'
                            : 'bg-wl-bg-overlay text-wl-text-tertiary group-hover:text-wl-text-secondary',
                        )}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>

          {/* Right column */}
          <div className={cn('min-w-0')}>
            {/* Sort Controls */}
            <div className={cn('flex items-center gap-2 mb-4')}>
              <span className={cn('text-xs text-wl-text-tertiary font-medium')}>Sort by:</span>
              {(['name', 'category', 'status'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  aria-pressed={sortBy === s}
                  className={cn(
                    'px-2 py-1 text-xs rounded border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-primary-500',
                    sortBy === s
                      ? 'bg-wl-primary-500/15 text-wl-primary-400 border-wl-primary-500'
                      : 'bg-transparent text-wl-text-tertiary border-wl-border-subtle hover:border-wl-border-strong',
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <span className={cn('ml-auto text-xs text-wl-text-tertiary tabular-nums')}>
                {filtered.length} result{filtered.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Grid */}
            {loading ? (
              <div className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4')}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <CardSkeleton key={i} className="h-40" />
                ))}
              </div>
            ) : (
              <>
                <div className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4')}>
                  {filtered.map((app, index) => (
                    <Card
                      key={app.slug}
                      className={cn(
                        'relative overflow-hidden transition-all duration-300 cursor-pointer hover:border-blue-500 hover:shadow-lg',
                        expandedId === app.slug && 'ring-2 ring-blue-500',
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div
                        className={cn('p-4')}
                        onClick={() =>
                          setExpandedId(expandedId === app.slug ? null : app.slug)
                        }
                      >
                        {/* Header */}
                        <div className={cn('flex items-start gap-3 mb-3')}>
                          <CatalogIntegrationLogo integrationId={app.slug} name={app.name} />
                          <div className={cn('flex-1 min-w-0')}>
                            <h3 className={cn('font-bold text-white text-sm')}>{app.name}</h3>
                            {app.subcategory && (
                              <p className={cn('text-xs text-wl-text-tertiary mt-0.5 capitalize')}>
                                {app.subcategory.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-wl-text-tertiary transition-transform',
                              expandedId === app.slug && 'rotate-180',
                            )}
                          />
                        </div>

                        {/* Status Badges */}
                        <div className={cn('flex flex-wrap items-center gap-2 mb-3')}>
                          <Badge
                            variant={
                              app.status === 'AVAILABLE'
                                ? 'success'
                                : app.status === 'BETA'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            {app.status === 'AVAILABLE'
                              ? 'Available'
                              : app.status === 'BETA'
                                ? 'Beta'
                                : 'Coming Soon'}
                          </Badge>
                          {app.installed && <Badge variant="success">Connected</Badge>}
                          {!INSTALL_WIRED && (
                            <span
                              className={cn(
                                'ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                                'text-[10px] font-semibold uppercase tracking-wider',
                                'border-wl-warning-500/40 bg-wl-warning-500/10 text-wl-warning-400',
                              )}
                              title="Self-serve install is on the way"
                            >
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-wl-warning-500"
                              />
                              Install · Coming soon
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className={cn('text-xs text-wl-text-secondary mb-3 line-clamp-2')}>
                          {app.description}
                        </p>

                        {/* Expanded Content */}
                        {expandedId === app.slug && (
                          <div className={cn('border-t border-wl-border-default pt-3 mt-3 space-y-3')}>
                            {app.capabilities.length > 0 && (
                              <div>
                                <p className={cn('text-xs font-semibold text-white mb-2')}>
                                  Capabilities:
                                </p>
                                <div className={cn('flex flex-wrap gap-1')}>
                                  {app.capabilities.map((cap) => (
                                    <span
                                      key={cap}
                                      className={cn(
                                        'px-2 py-1 rounded text-xs bg-wl-bg-elevated text-wl-text-tertiary font-medium',
                                      )}
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className={cn('flex items-center gap-2 text-xs text-wl-text-secondary')}>
                              <Zap className={cn('h-3 w-3')} />
                              <span>Auth: {app.authType.replace(/_/g, ' ')}</span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className={cn('w-full mt-2')}
                              title="Self-serve install is on the way"
                              aria-label={`${app.name} — coming soon`}
                            >
                              Coming soon
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className={cn('text-center py-12')}>
                    <Package className={cn('h-12 w-12 text-wl-text-tertiary mx-auto mb-3 opacity-50')} />
                    <p className={cn('text-wl-text-secondary text-sm font-medium')}>
                      No integrations found matching your criteria.
                    </p>
                    <p className={cn('text-wl-text-tertiary text-xs mt-1')}>
                      Try adjusting your search or filter options.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function categoryIcon(category: string): string {
  const icons: Record<string, string> = {
    COMMUNICATION: '📱',
    ROUTING: '🗺',
    ORDER_MANAGEMENT: '📋',
    INVENTORY: '📦',
    PAYMENT: '💳',
    ANALYTICS: '📈',
  };
  return icons[category] ?? '⬡';
}
