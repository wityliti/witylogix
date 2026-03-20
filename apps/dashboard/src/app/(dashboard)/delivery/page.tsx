'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Truck, Clock, CheckCircle, AlertCircle, Package } from 'lucide-react';

interface Delivery {
  id: string;
  orderId: string;
  customer: string;
  status: 'pending' | 'in-transit' | 'completed' | 'failed' | 'returned';
  location: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  distance: number;
  driver?: string;
}

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { items: deliveries, loading, error } = useApiList<Delivery>(
    '/api/v4/orders?type=delivery'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const filtered = statusFilter === 'all' 
    ? deliveries 
    : deliveries.filter((d) => d.status === statusFilter);

  const stats = {
    pending: deliveries.filter((d) => d.status === 'pending').length,
    inTransit: deliveries.filter((d) => d.status === 'in-transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
    failed: deliveries.filter((d) => d.status === 'failed').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-transit':
        return 'info';
      case 'pending':
        return 'warning';
      case 'failed':
      case 'returned':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Deliveries</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Track delivery operations</p>
            </div>
            <Button variant="primary" size="md">
              <Package className="w-4 h-4" />
              New Delivery
            </Button>
          </div>

          <div className="flex gap-2 mt-6">
            {[
              { label: 'All', value: 'all', count: deliveries.length },
              { label: 'Pending', value: 'pending', count: stats.pending },
              { label: 'In Transit', value: 'in-transit', count: stats.inTransit },
              { label: 'Completed', value: 'completed', count: stats.completed },
              { label: 'Failed', value: 'failed', count: stats.failed },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-wl-primary-500 text-white'
                    : 'bg-wl-bg-overlay text-wl-text-secondary'
                )}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4 max-w-7xl">
          {filtered.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <Truck className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary">No deliveries found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((delivery) => (
                <Card
                  key={delivery.id}
                  className="p-4 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-wl-text-primary">{delivery.customer}</h3>
                        <Badge variant={getStatusColor(delivery.status) as any}>
                          {delivery.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-wl-text-secondary mb-2">Order #{delivery.orderId}</p>
                      <div className="flex gap-4 text-sm text-wl-text-tertiary">
                        <span>{delivery.location}</span>
                        <span>{delivery.distance} mi</span>
                        {delivery.driver && <span>Driver: {delivery.driver}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-wl-text-primary">
                        {new Date(delivery.estimatedDelivery).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-wl-text-tertiary">Est. Delivery</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
