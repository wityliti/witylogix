'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Store, CheckCircle2, AlertCircle, Clock, RefreshCw, Plus } from 'lucide-react';

interface IntegrationConnection {
  id: string;
  providerName: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

function statusVariant(s: string): 'success' | 'danger' | 'warning' | 'default' {
  if (s === 'connected') return 'success';
  if (s === 'error') return 'danger';
  if (s === 'pending') return 'warning';
  return 'default';
}

function timeSince(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function POSIntegrationsPage() {
  const { items, loading, error, refetch } = useApiList<IntegrationConnection>(
    '/api/v4/integrations/connections?category=payment',
    { limit: 100 },
  );

  const stats = useMemo(() => ({
    total: items.length,
    healthy: items.filter((i) => i.status === 'connected').length,
    errors: items.filter((i) => i.status === 'error').length,
    apiCalls: items.reduce((s, i) => s + i.apiCallsCount, 0),
  }), [items]);

  if (loading && items.length === 0) return <LoadingSkeleton />;
  if (error && items.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="POS Integrations"
        subtitle="Manage point-of-sale and restaurant system connections"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Link href="/integrations/marketplace?category=PAYMENT">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add POS System
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Connected Systems', value: stats.total, icon: Store, color: 'text-wl-info-400' },
            { label: 'Healthy', value: stats.healthy, icon: CheckCircle2, color: 'text-wl-success-400' },
            { label: 'With Errors', value: stats.errors, icon: AlertCircle, color: 'text-wl-danger-400' },
            { label: 'API Calls (30d)', value: stats.apiCalls.toLocaleString(), icon: Clock, color: 'text-wl-text-primary' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={cn('w-5 h-5 shrink-0', s.color)} />
                  <div>
                    <p className="text-xs text-wl-text-muted">{s.label}</p>
                    <p className="text-xl font-bold text-wl-text-primary">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>POS Systems</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-12 text-center">
                <Store className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
                <p className="text-wl-text-secondary mb-1">No POS systems connected</p>
                <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                  Connect Toast, Square, Lightspeed, Clover, Revel, and more to sync orders,
                  menus, and location data directly into your dispatch workflow.
                </p>
                <Link href="/integrations/marketplace?category=PAYMENT">
                  <Button variant="primary">Browse Marketplace</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-wl-border-default">
                {items.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-wl-bg-overlay transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-wl-bg-overlay flex items-center justify-center text-xs font-bold text-wl-text-secondary uppercase">
                        {conn.providerName.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-wl-text-primary">{conn.providerName}</p>
                        <p className="text-xs text-wl-text-muted">Last sync: {timeSince(conn.lastSyncTime)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-wl-text-muted hidden sm:block">
                        {conn.apiCallsCount.toLocaleString()} calls
                      </span>
                      <Badge variant={statusVariant(conn.status)} dot>
                        {conn.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
