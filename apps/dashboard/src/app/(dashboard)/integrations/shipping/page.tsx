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
import { Package, CheckCircle2, XCircle, RefreshCw, Plus } from 'lucide-react';

interface CarrierAdapter {
  name: string;
  label: string;
  enabled: boolean;
  configSource: string;
}

export default function ShippingIntegrationsPage() {
  const { items: adapters, loading, error, refetch } = useApiList<CarrierAdapter>(
    '/api/v4/carriers/adapters',
    { limit: 100 },
  );

  const stats = useMemo(() => ({
    total: adapters.length,
    enabled: adapters.filter((a) => a.enabled).length,
    disabled: adapters.filter((a) => !a.enabled).length,
  }), [adapters]);

  if (loading && adapters.length === 0) return <LoadingSkeleton />;
  if (error && adapters.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Shipping Integrations"
        subtitle="Manage shipping carriers, labels, and tracking"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Link href="/integrations/marketplace?category=ORDER_MANAGEMENT">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add Carrier
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Carrier Adapters', value: stats.total, icon: Package, color: 'text-wl-info-400' },
            { label: 'Enabled', value: stats.enabled, icon: CheckCircle2, color: 'text-wl-success-400' },
            { label: 'Disabled', value: stats.disabled, icon: XCircle, color: 'text-wl-text-muted' },
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
            <CardTitle>Carrier Adapters</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {adapters.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
                <p className="text-wl-text-secondary mb-1">No carrier adapters configured</p>
                <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                  Connect Shippo, ShipStation, EasyPost, FedEx, UPS, USPS, DHL, and more to
                  generate labels, compare rates, and track shipments.
                </p>
                <Link href="/integrations/marketplace?category=ORDER_MANAGEMENT">
                  <Button variant="primary">Browse Marketplace</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-wl-border-default">
                {adapters.map((adapter) => (
                  <div
                    key={adapter.name}
                    className="flex items-center justify-between px-5 py-3 hover:bg-wl-bg-overlay transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-wl-bg-overlay flex items-center justify-center text-xs font-bold text-wl-text-secondary uppercase">
                        {adapter.label.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-wl-text-primary">{adapter.label}</p>
                        <p className="text-xs text-wl-text-muted capitalize">{adapter.configSource} config</p>
                      </div>
                    </div>
                    <Badge variant={adapter.enabled ? 'success' : 'default'} dot>
                      {adapter.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
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
