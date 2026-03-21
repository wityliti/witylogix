'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Truck, Package } from 'lucide-react';

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

const mockDeliveries: Delivery[] = [
  { id: "1", orderId: "ORD-001", customer: "John Smith", status: "completed", location: "123 Main St", estimatedDelivery: "2024-03-21", distance: 5.2, driver: "Alex" },
  { id: "2", orderId: "ORD-002", customer: "Jane Doe", status: "in-transit", location: "456 Oak Ave", estimatedDelivery: "2024-03-21", distance: 3.8, driver: "Maria" },
  { id: "3", orderId: "ORD-003", customer: "Bob Wilson", status: "pending", location: "789 Pine Rd", estimatedDelivery: "2024-03-21", distance: 6.1 },
  { id: "4", orderId: "ORD-004", customer: "Alice Johnson", status: "completed", location: "321 Elm St", estimatedDelivery: "2024-03-20", distance: 4.5, driver: "John" },
  { id: "5", orderId: "ORD-005", customer: "Charlie Brown", status: "failed", location: "654 Maple Dr", estimatedDelivery: "2024-03-19", distance: 7.2, driver: "David" },
];

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deliveries] = useState<Delivery[]>(mockDeliveries);

  const filtered = statusFilter === 'all'
    ? deliveries
    : deliveries.filter((d) => d.status === statusFilter);

  const stats = {
    pending: deliveries.filter((d) => d.status === 'pending').length,
    inTransit: deliveries.filter((d) => d.status === 'in-transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
    failed: deliveries.filter((d) => d.status === 'failed').length,
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-transit':
        return 'primary';
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
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Deliveries</h1>
                <p className="text-sm text-gray-400 mt-1">Track delivery operations</p>
              </div>
              <Button variant="primary" size="md">
                <Package className="w-4 h-4" />
                New Delivery
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
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
          {filtered.length === 0 ? (
            <Card className="p-12 bg-[#12121a] border border-[#1e1e2e] text-center">
              <Truck className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No deliveries found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((delivery) => (
                <Card
                  key={delivery.id}
                  className="p-4 bg-[#12121a] border border-[#1e1e2e] hover:border-[#2e2e3e] cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-white">{delivery.customer}</h3>
                        <Badge variant={getStatusVariant(delivery.status) as any}>
                          {delivery.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">Order #{delivery.orderId}</p>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>{delivery.location}</span>
                        <span>{delivery.distance} mi</span>
                        {delivery.driver && <span>Driver: {delivery.driver}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        {new Date(delivery.estimatedDelivery).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">Est. Delivery</p>
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
