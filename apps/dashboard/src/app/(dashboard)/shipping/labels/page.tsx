'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
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
    <>
      <Header
        title="Shipping Labels"
        subtitle={`${labels.length} labels available`}
        actions={<Button variant="primary" size="md">+ Create Label</Button>}
      />

      <main className="min-h-screen bg-[#0a0a0f] p-6">
        <Card className="overflow-hidden p-0 bg-[#12121a] border border-[#1e1e2e]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Tracking #</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Carrier</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Service</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Destination</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labels.slice(0, 20).map((label, idx) => (
                  <tr key={label.id} className={`border-b border-[#1e1e2e] transition-colors hover:bg-[#1a1a2e] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f14]'}`}>
                    <td className="p-3 px-4 text-white font-mono text-xs">{label.trackingNumber}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{label.carrier}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{label.service}</td>
                    <td className="p-3 px-4 text-gray-400 text-sm">{label.destination}</td>
                    <td className="p-3 px-4 text-center">
                      <Button variant="secondary" size="sm">Print</Button>
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
