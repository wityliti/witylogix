'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { Package } from 'lucide-react';

interface ShippingLabel {
  id: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  destination: string;
  status: 'created' | 'voided' | 'printed';
  createdAt: string;
  weight: number;
}

export default function ShippingLabelsPage() {
  const { items: labels, loading, error, refetch } = useApiList<ShippingLabel>('/api/v4/shipments?include=labels');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-wl-text-primary">Shipping Labels</h2>
          <p className="text-sm text-wl-text-secondary mt-1">{labels.length} labels</p>
        </div>
        <Button variant="primary" size="md">
          + Create Label
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Tracking #</th>
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Carrier</th>
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Service</th>
                <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Destination</th>
                <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {labels.slice(0, 20).map((label) => (
                <tr key={label.id} className="border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay">
                  <td className="p-3 px-4 text-wl-text-primary font-mono text-xs">{label.trackingNumber}</td>
                  <td className="p-3 px-4 text-wl-text-secondary text-sm">{label.carrier}</td>
                  <td className="p-3 px-4 text-wl-text-secondary text-sm">{label.service}</td>
                  <td className="p-3 px-4 text-wl-text-secondary text-sm">{label.destination}</td>
                  <td className="p-3 px-4 text-center">
                    <Button variant="secondary" size="sm">Print</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
