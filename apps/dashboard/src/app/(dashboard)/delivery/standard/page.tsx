'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Download } from 'lucide-react';

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

const mockDeliveries: StandardDelivery[] = [
  { id: "1", orderNumber: "STD-001", customer: "Acme Corp", address: "100 Business Blvd", status: "delivered", serviceType: "Ground", scheduledDate: "2024-03-21", weight: 25, cost: 45.00, driver: "John" },
  { id: "2", orderNumber: "STD-002", customer: "Tech Inc", address: "200 Innovation Dr", status: "in-transit", serviceType: "Ground", scheduledDate: "2024-03-21", weight: 15, cost: 35.00, driver: "Maria" },
  { id: "3", orderNumber: "STD-003", customer: "Retail Co", address: "300 Commerce Ave", status: "pending", serviceType: "Ground", scheduledDate: "2024-03-22", weight: 50, cost: 65.00 },
  { id: "4", orderNumber: "STD-004", customer: "Factory Ltd", address: "400 Industrial Way", status: "scheduled", serviceType: "Ground", scheduledDate: "2024-03-22", weight: 100, cost: 95.00 },
  { id: "5", orderNumber: "STD-005", customer: "Shop LLC", address: "500 Market St", status: "delivered", serviceType: "Ground", scheduledDate: "2024-03-20", weight: 20, cost: 40.00, driver: "David" },
];

export default function StandardDeliveryPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [deliveries] = useState<StandardDelivery[]>(mockDeliveries);

  const filtered = filterStatus === 'all'
    ? deliveries
    : deliveries.filter((d) => d.status === filterStatus);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'success';
      case 'in-transit':
        return 'primary';
      case 'scheduled':
        return 'warning';
      case 'failed':
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
                <h1 className="text-2xl font-bold text-white">Standard Delivery</h1>
                <p className="text-sm text-gray-400 mt-1">Ground delivery operations</p>
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

            <div className="flex gap-2 flex-wrap">
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
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:text-gray-300'
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Order</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Address</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Cost</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((delivery, idx) => (
                    <tr
                      key={delivery.id}
                      className={cn(
                        "border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors",
                        idx % 2 === 0 ? "bg-[#12121a]" : "bg-[#0a0a0f]"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">{delivery.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-300">{delivery.customer}</td>
                      <td className="px-4 py-3 text-gray-400">{delivery.address}</td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={getStatusVariant(delivery.status) as any}>
                          {delivery.status.replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="text-right px-4 py-3 font-medium text-white">
                        ${delivery.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
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
