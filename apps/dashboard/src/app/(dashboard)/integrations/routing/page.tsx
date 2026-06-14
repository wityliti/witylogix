'use client';

import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Route, CheckCircle2, AlertCircle, Clock, RefreshCw, Plus } from 'lucide-react';

export default function RoutingIntegrationsPage() {
  return (
    <>
      <Header
        title="Routing Integrations"
        subtitle="Manage route optimization and navigation providers"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Providers</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>routing engines</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Requests Today</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>optimization calls</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Latency</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Uptime</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Routing Providers</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-400 mb-2')}>No routing providers connected</p>
            <p className={cn('text-sm text-gray-500 mb-6')}>
              Connect Valhalla, VROOM, Routific, OptimoRoute, HERE Maps, Google Maps Platform, and
              more from the Marketplace to optimize your delivery routes.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider Health</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-500 text-sm')}>No providers to monitor</p>
          </div>
        </Card>
      </div>
    </>
  );
}
