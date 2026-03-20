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

      <div className="p-6 space-y-6">
        {/* Filter Tabs */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filterStatus === status ? 'bg-wl-primary-500 text-wl-text-inverse' : 'bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tracking Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Tracking #</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Recipient</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Carrier</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Last Location</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">ETA</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay">
                    <td className="p-3 px-4 text-wl-text-primary font-mono text-xs">{record.trackingNumber}</td>
                    <td className="p-3 px-4 text-wl-text-secondary text-sm">{record.recipientName}</td>
                    <td className="p-3 px-4 text-wl-text-secondary text-sm">{record.carrier}</td>
                    <td className="p-3 px-4 text-wl-text-secondary text-sm">{record.lastLocation}</td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getStatusColor(record.currentStatus)}>{record.currentStatus}</Badge>
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary text-sm">
                      {record.eta ? new Date(record.eta).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
