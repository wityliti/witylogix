'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Download, RefreshCw } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string;
  deliveryAddress?: string;
  driverId?: string;
  deliveryMethod?: string;
  order?: { customerName?: string; shopifyOrderNumber?: string };
  createdAt: string;
}

const STATUS_DISPLAY: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  READY_FOR_PICKUP: 'scheduled',
  PICKED_UP: 'in-transit',
  IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'in-transit',
  ARRIVED: 'in-transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'failed',
  CANCELLED: 'failed',
};

export default function StandardDeliveryPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 50, deliveryMethod: 'STANDARD' },
  );

  const displayStatus = (s: string) => STATUS_DISPLAY[s] ?? s.toLowerCase();

  const filtered = filterStatus === 'all'
    ? shipments
    : shipments.filter((s) => displayStatus(s.status) === filterStatus);

  const getStatusVariant = (status: string): 'success' | 'primary' | 'warning' | 'danger' | 'default' => {
    const display = displayStatus(status);
    switch (display) {
      case 'delivered': return 'success';
      case 'in-transit': return 'primary';
      case 'scheduled': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  const statusCounts = (label: string) =>
    label === 'all'
      ? shipments.length
      : shipments.filter((s) => displayStatus(s.status) === label).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Standard Delivery</h1>
                <p className="text-sm text-gray-400 mt-1">Ground delivery operations</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </Button>
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

            <div className="flex gap-2 flex-wrap">
              {['all', 'pending', 'scheduled', 'in-transit', 'delivered', 'failed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    filterStatus === status
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1a1a2e] text-gray-400 hover:text-gray-300'
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')} ({statusCounts(status)})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden p-8 text-center">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
            </Card>
          ) : error ? (
            <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden p-8 text-center">
              <p className="text-red-400">Failed to load shipments.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={refetch}>Retry</Button>
            </Card>
          ) : (
            <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                      <th className="text-left px-4 py-3 font-semibold text-gray-400">Shipment #</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-400">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-400">Address</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-400">Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                          No shipments found
                        </td>
                      </tr>
                    ) : (
                      filtered.map((shipment, idx) => (
                        <tr
                          key={shipment.id}
                          className={cn(
                            'border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors',
                            idx % 2 === 0 ? 'bg-[#12121a]' : 'bg-[#0a0a0f]'
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-white">{shipment.shipmentNumber}</td>
                          <td className="px-4 py-3 text-gray-300">
                            {shipment.order?.customerName ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-400">{shipment.deliveryAddress ?? '—'}</td>
                          <td className="text-center px-4 py-3">
                            <Badge variant={getStatusVariant(shipment.status)}>
                              {displayStatus(shipment.status).replace('-', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {shipment.deliveryDate
                              ? new Date(shipment.deliveryDate).toLocaleDateString()
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
