'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Grid3x3,
  List,
  X,
  Loader2,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';

interface MarketplaceApp {
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
  apps: MarketplaceApp[];
  categories: Record<string, string>;
  counts: Record<string, number>;
}

type SortBy = 'name' | 'category';

export default function MarketplacePage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, loading, error, refetch } = useApiQuery<MarketplaceResponse>(
    '/api/v4/integrations/marketplace',
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setIsSearching(true);
  };

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }, []);

  const apps = data?.apps ?? [];
  const apiCategories = data?.categories ?? {};

  const categories = useMemo(
    () =>
      Object.entries(apiCategories).map(([key, label]) => ({
        key,
        label,
        count: apps.filter((a) => a.category === key).length,
      })),
    [apiCategories, apps],
  );

  const filtered = useMemo(() => {
    let items = [...apps];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.slug.includes(q),
      );
    }

    if (selectedCategories.length > 0) {
      items = items.filter((p) => selectedCategories.includes(p.category));
    }

    if (sortBy === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else items.sort((a, b) => a.category.localeCompare(b.category));

    return items;
  }, [apps, debouncedSearch, selectedCategories, sortBy]);

  const activeFilterCount = selectedCategories.length + (debouncedSearch ? 1 : 0);

  if (error) {
    return <ErrorState title="Failed to load marketplace" error={error} onRetry={refetch} />;
  }

  return (
    <>
      <Header
        title="Integration Marketplace"
        subtitle={loading ? 'Loading…' : `${filtered.length} providers available`}
      />

      <div className={cn('p-6 max-w-7xl mx-auto')}>
        {/* Search */}
        <div className={cn('flex flex-col gap-4 mb-6')}>
          <div className={cn('relative')}>
            <Search className="w-4 h-4 absolute left-3 top-3 text-wl-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search providers…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg',
                'text-white text-sm focus:border-wl-info-500 outline-none transition-all',
              )}
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3 top-3 text-wl-info-500 animate-spin" />
            )}
          </div>

          {/* Controls */}
          <div className={cn('flex flex-wrap gap-3 items-center')}>
            <div className={cn('flex gap-1 bg-wl-bg-elevated rounded-md p-1')}>
              {(['grid', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === 'grid' ? 'Grid view' : 'List view'}
                  className={cn(
                    'p-2 rounded-sm cursor-pointer transition-all',
                    view === v
                      ? 'bg-blue-500 text-black'
                      : 'bg-transparent text-wl-text-tertiary hover:text-white',
                  )}
                >
                  {v === 'grid' ? <Grid3x3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <div className={cn('flex gap-2 items-center')}>
              <span className="text-xs text-wl-text-tertiary">Sort:</span>
              {(['name', 'category'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-all',
                    sortBy === s
                      ? 'bg-wl-info-500/15 text-wl-info-400 border-blue-500'
                      : 'bg-wl-bg-elevated border-wl-border-default text-white hover:border-blue-500',
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCategories([]);
                }}
                className={cn('text-sm text-wl-text-tertiary hover:text-white transition-all')}
              >
                Clear filters
              </button>
            )}
          </div>

          {(debouncedSearch || selectedCategories.length > 0) && (
            <div className={cn('flex flex-wrap gap-2')}>
              {debouncedSearch && (
                <Badge variant="primary">
                  Search: {debouncedSearch}
                  <button onClick={() => setSearch('')} className="ml-1 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedCategories.map((cat) => (
                <Badge key={cat} variant="info">
                  {apiCategories[cat] ?? cat.replace(/_/g, ' ')}
                  <button onClick={() => toggleCategory(cat)} className="ml-1 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar + Content */}
        <div className={cn('flex gap-6')}>
          <aside className={cn('w-56 flex-shrink-0')}>
            <div className={cn('sticky top-4')}>
              <h3 className={cn('text-sm font-semibold text-white mb-3')}>Categories</h3>
              <div className={cn('space-y-1')}>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-9 bg-wl-bg-elevated animate-pulse rounded" />
                    ))
                  : categories.map((cat) => (
                      <label
                        key={cat.key}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-wl-bg-elevated transition-all',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.key)}
                          onChange={() => toggleCategory(cat.key)}
                          className="w-4 h-4 rounded border-wl-border-default"
                        />
                        <span className="text-sm text-white flex-1">{cat.label}</span>
                        <span className="text-xs text-wl-text-tertiary">{cat.count}</span>
                      </label>
                    ))}
              </div>
            </div>
          </aside>

          <main className={cn('flex-1 min-w-0')}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-56 bg-wl-bg-elevated animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className={cn('text-center py-20 text-wl-text-tertiary')}>
                <div className="text-base font-semibold mb-2">No providers found</div>
                <div className="text-sm">Try adjusting your search or filters</div>
              </div>
            ) : (
              <div
                className={cn(
                  view === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-3',
                )}
              >
                {filtered.map((provider, idx) => (
                  <ProviderCard
                    key={provider.slug}
                    provider={provider}
                    index={idx}
                    layout={view}
                    categoryLabel={
                      apiCategories[provider.category] ?? provider.category.replace(/_/g, ' ')
                    }
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

interface ProviderCardProps {
  provider: MarketplaceApp;
  index: number;
  layout: 'grid' | 'list';
  categoryLabel: string;
}

function ProviderCard({ provider, index, layout, categoryLabel }: ProviderCardProps) {
  const statusVariant =
    provider.installed
      ? 'success'
      : provider.status === 'BETA'
        ? 'info'
        : provider.status === 'COMING_SOON'
          ? 'default'
          : 'primary';

  const statusLabel = provider.installed
    ? 'Connected'
    : provider.status === 'COMING_SOON'
      ? 'Coming Soon'
      : provider.status === 'BETA'
        ? 'Beta'
        : 'Available';

  const delay = `${index * 30}ms`;

  const logo = provider.logoUrl ? (
    <img src={provider.logoUrl} alt={`${provider.name} logo`} className="w-8 h-8 object-contain" />
  ) : (
    <span className="text-xl">📦</span>
  );

  if (layout === 'list') {
    return (
      <Card
        className={cn(
          'flex items-center justify-between p-4 hover:border-blue-500 transition-all',
          provider.installed && 'border-wl-success-500/30',
        )}
        style={{ animationDelay: delay } as React.CSSProperties}
      >
        <div className={cn('flex-1 flex items-center gap-4 min-w-0')}>
          <div className="w-12 h-12 rounded-lg bg-wl-bg-elevated flex items-center justify-center flex-shrink-0">
            {logo}
          </div>
          <div className={cn('flex-1 min-w-0')}>
            <h3 className="text-sm font-semibold text-white">{provider.name}</h3>
            <p className="text-xs text-wl-text-tertiary truncate">{provider.description}</p>
            <Badge variant="default" className="text-xs mt-1">
              {categoryLabel}
            </Badge>
          </div>
        </div>
        <div className={cn('flex items-center gap-3 flex-shrink-0')}>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <Link href={`/integrations/marketplace/${provider.slug}`}>
            <Button variant="secondary" size="sm">
              View
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/integrations/marketplace/${provider.slug}`}>
      <Card
        className={cn(
          'h-full flex flex-col hover:border-blue-500 cursor-pointer transition-all',
          provider.installed && 'border-wl-success-500/30',
        )}
        style={{ animationDelay: delay } as React.CSSProperties}
        hover
      >
        <div className="w-full h-24 bg-wl-bg-elevated rounded-lg mb-3 flex items-center justify-center">
          {provider.logoUrl ? (
            <img
              src={provider.logoUrl}
              alt={`${provider.name} logo`}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <span className="text-3xl">📦</span>
          )}
        </div>

        <div className={cn('flex-1 flex flex-col')}>
          <h3 className="text-sm font-semibold text-white mb-2">{provider.name}</h3>
          <p className="text-xs text-wl-text-tertiary mb-3 line-clamp-2">{provider.description}</p>
          <Badge variant="default" className="mb-2 w-fit text-xs">
            {categoryLabel}
          </Badge>
          <Badge variant={statusVariant} className="mt-auto mb-3 w-fit text-xs">
            {statusLabel}
          </Badge>
        </div>

        <div className={cn('flex gap-2 w-full')}>
          <Button variant="secondary" size="sm" className="flex-1">
            View Details
          </Button>
          {provider.installed && (
            <Button variant="ghost" size="sm" className="flex-1">
              Manage
            </Button>
          )}
        </div>
      </Card>
    </Link>
  );
}
