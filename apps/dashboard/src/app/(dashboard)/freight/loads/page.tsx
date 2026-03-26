'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { Package, Plus, Upload } from 'lucide-react';

interface Shipment {
  id: string;
  status: string;
}

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    Available: 'primary',
    Booked: 'success',
    'In-Transit': 'info',
    Delivered: 'success',
    Exception: 'danger',
  };
  return map[status] ?? 'default';
};

export default function FreightLoadsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { items: shipments, pagination, loading, error, refetch, setPage } = useApiList<Shipment>('/api/v4/shipments?type=freight&view=loads');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const activeLoads = shipments.filter(s => ['Booked', 'In-Transit'].includes(s.status)).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header & Actions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Load Board</h1>
            <p className="text-gray-400">{pagination.total} total loads · {activeLoads} active</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex items-center gap-2">
              <Plus size={16} /> Create Load
            </Button>
            <Button variant="secondary" size="md" className="flex items-center gap-2">
              <Upload size={16} /> Import
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Total Loads</span>
              <Package className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{pagination.total}</p>
            <p className="text-gray-400 text-xs mt-2">All shipments</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">In Transit</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">{activeLoads}</p>
            <p className="text-gray-400 text-xs mt-2">Currently moving</p>
          </div>
        </Card>

        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Available</span>
              <div className="w-5 h-5 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">{shipments.filter(s => s.status === 'Available').length}</p>
            <p className="text-gray-400 text-xs mt-2">Ready to book</p>
          </div>
        </Card>
      </div>

      {/* Loads Table */}
      <Card className="bg-[#12121a] border-[#1e1e2e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a2e] border-b border-[#1e1e2e]">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-300">Load ID</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-300">Origin</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-300">Destination</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment, idx) => (
                <tr
                  key={shipment.id}
                  className={cn(
                    'border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e]',
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f14]'
                  )}
                >
                  <td className="px-6 py-4 text-white font-semibold">{shipment.id}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">Origin</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">Destination</td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant={statusBadgeVariant(shipment.status)}>{shipment.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-[#1e1e2e] bg-[#1a1a2e] text-sm text-gray-400">
          <div>
            Showing {shipments.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 flex items-center text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
