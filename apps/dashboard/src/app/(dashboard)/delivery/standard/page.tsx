'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Filter, Download } from 'lucide-react';

interface StandardDelivery {
  id: string;
  orderNumber: string;
  customer: string;
  address: string;
  status: 'pending' | 'scheduled' | 'in-transit' | 'delivered' | 'failed';
  serviceType: string;
  scheduledDate: string;
  actualDate?: string;
  weight: number;
  cost: number;
  driver?: string;
}

export default function StandardDeliveryPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { items: deliveries, loading, error } = useApiList<StandardDelivery>(
    '/api/v4/orders?type=standard-delivery'
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const filtered = filterStatus === 'all'
    ? deliveries
    : deliveries.filter((d) => d.status === filterStatus);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'success';
      case 'in-transit':
        return 'info';
      case 'scheduled':
        return 'warning';
      case 'failed':
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
              <h1 className="text-2xl font-bold text-wl-text-primary">Standard Delivery</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Ground delivery operations</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="md">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4" />
                New Shipment
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            {['all', 'pending', 'scheduled', 'in-transit', 'delivered', 'failed'].map((status) => {
              const count = status === 'all'
                ? deliveries.length
                : deliveries.filter((d) => d.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    filterStatus === status
                      ? 'bg-wl-primary-500 text-white'
                      : 'bg-wl-bg-overlay text-wl-text-secondary'
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl">
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Order</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Address</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Cost</th>
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((delivery, idx) => (
                    <tr
                      key={delivery.id}
                      className={cn(
                        'border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors',
                        idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{delivery.orderNumber}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{delivery.customer}</td>
                      <td className="px-4 py-3 text-wl-text-secondary">{delivery.address}</td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={getStatusVariant(delivery.status) as any}>
                          {delivery.status}
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3 font-medium text-wl-text-primary">
                        ${delivery.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-wl-text-secondary">
                        {new Date(delivery.scheduledDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
