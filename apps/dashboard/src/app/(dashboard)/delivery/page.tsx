'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Truck, Package, RefreshCw } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  driverId?: string;
  orderId?: string;
  order?: { customerName?: string; shopifyOrderNumber?: string };
  createdAt: string;
}

const STATUS_FILTER_MAP: Record<string, string | undefined> = {
  all: undefined,
  pending: 'PENDING',
  'in-transit': 'IN_TRANSIT',
  delivered: 'DELIVERED',
  failed: 'FAILED',
};

const API_TO_DISPLAY: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  READY_FOR_PICKUP: 'pending',
  PICKED_UP: 'in-transit',
  IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'in-transit',
  ARRIVED: 'in-transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'failed',
  CANCELLED: 'failed',
};

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const apiStatus = STATUS_FILTER_MAP[statusFilter];
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 50, ...(apiStatus ? { status: apiStatus } : {}) },
  );

  const displayStatus = (s: string) => API_TO_DISPLAY[s] ?? s.toLowerCase();

  const filtered = statusFilter === 'all'
    ? shipments
    : shipments.filter((s) => displayStatus(s.status) === statusFilter);

  const stats = {
    pending: shipments.filter((s) => ['pending'].includes(displayStatus(s.status))).length,
    inTransit: shipments.filter((s) => displayStatus(s.status) === 'in-transit').length,
    completed: shipments.filter((s) => displayStatus(s.status) === 'delivered').length,
    failed: shipments.filter((s) => displayStatus(s.status) === 'failed').length,
  };

  const getStatusVariant = (status: string): 'success' | 'primary' | 'warning' | 'danger' | 'default' => {
    const display = displayStatus(status);
    switch (display) {
      case 'delivered': return 'success';
      case 'in-transit': return 'primary';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Deliveries</h1>
                <p className="text-sm text-gray-400 mt-1">Track delivery operations</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </Button>
                <Button variant="primary" size="md">
                  <Package className="w-4 h-4" />
                  New Delivery
                </Button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'All', value: 'all', count: shipments.length },
                { label: 'Pending', value: 'pending', count: stats.pending },
                { label: 'In Transit', value: 'in-transit', count: stats.inTransit },
                { label: 'Delivered', value: 'delivered', count: stats.completed },
                { label: 'Failed', value: 'failed', count: stats.failed },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    statusFilter === tab.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1a1a2e] text-gray-400 hover:text-gray-300'
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-4 bg-[#12121a] border border-[#1e1e2e] animate-pulse h-20">{" "}</Card>
              ))}
            </div>
          ) : error ? (
            <Card className="p-12 bg-[#12121a] border border-[#1e1e2e] text-center">
              <p className="text-red-400">Failed to load deliveries. Please try again.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={refetch}>
                Retry
              </Button>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-12 bg-[#12121a] border border-[#1e1e2e] text-center">
              <Truck className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No deliveries found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((shipment) => (
                <Card
                  key={shipment.id}
                  className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:border-[#2e2e3e] cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">
                          {shipment.order?.customerName ?? 'Unknown Customer'}
                        </h3>
                        <Badge variant={getStatusVariant(shipment.status)}>
                          {displayStatus(shipment.status).replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        {shipment.shipmentNumber}
                        {shipment.order?.shopifyOrderNumber && ` · Order #${shipment.order.shopifyOrderNumber}`}
                      </p>
                      <div className="flex gap-4 text-sm text-gray-500">
                        {shipment.deliveryAddress && <span>{shipment.deliveryAddress}</span>}
                        {shipment.driverId && <span>Driver assigned</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      {shipment.deliveryDate ? (
                        <>
                          <p className="text-sm font-medium text-white">
                            {new Date(shipment.deliveryDate).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">Est. Delivery</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">No date set</p>
                      )}
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
