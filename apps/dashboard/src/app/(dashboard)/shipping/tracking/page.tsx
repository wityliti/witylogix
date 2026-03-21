'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface TrackingRecord {
  id: string;
  trackingNumber: string;
  orderId: string;
  carrier: string;
  currentStatus: string;
  eta: string | null;
  lastLocation: string;
  createdAt: string;
  recipientName: string;
}

export default function TrackingPage() {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const { items: trackingRecords, loading, error, refetch } = useApiList<TrackingRecord>('/api/v4/tracking');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const filteredRecords =
    filterStatus === 'ALL' ? trackingRecords : trackingRecords.filter((r) => r.currentStatus === filterStatus);

  const getStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
    if (status === 'Delivered') return 'success';
    if (status === 'Out for Delivery') return 'info';
    if (status === 'Exception') return 'danger';
    return 'warning';
  };

  return (
    <>
      <Header title="Shipment Tracking" subtitle={`${trackingRecords.length} active shipments`} />

      <main className="min-h-screen bg-[#0a0a0f] p-6 space-y-6">
        {/* Filter Tabs */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="pt-4">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === status ? 'bg-blue-500 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tracking Table */}
        <Card className="overflow-hidden p-0 bg-[#12121a] border border-[#1e1e2e]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Tracking #</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Recipient</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Carrier</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Last Location</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">ETA</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
                  <tr key={record.id} className={`border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f14]'}`}>
                    <td className="p-3 px-4 text-white font-mono text-xs">{record.trackingNumber}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{record.recipientName}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{record.carrier}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{record.lastLocation}</td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getStatusColor(record.currentStatus)}>{record.currentStatus}</Badge>
                    </td>
                    <td className="p-3 px-4 text-center text-gray-400 text-sm">
                      {record.eta ? new Date(record.eta).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
