'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface ShipmentDetail {
  id: string;
  shipmentNumber: string;
  trackingNumber: string | null;
  carrier: string | null;
  carrierTrackingUrl: string | null;
  status: string;
  estimatedArrival: string | null;
  actualDelivery: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  deliveryMethod: string;
  recipientName: string | null;
  order: { id: string; shopifyOrderNumber: string | null } | null;
  activityLogs: Array<{ id: string; action: string; timestamp: string }>;
}

const statusVariant = (
  status: string,
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<
    string,
    'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'
  > = {
    DELIVERED: 'success',
    OUT_FOR_DELIVERY: 'info',
    ARRIVED: 'info',
    IN_TRANSIT: 'primary',
    PICKED_UP: 'primary',
    FAILED: 'danger',
    RETURNED: 'danger',
    CANCELLED: 'default',
  };
  return map[status] || 'warning';
};

export default function TrackingDetailPage() {
  const params = useParams();
  const trackingNumber = params.trackingNumber as string;

  // Search for the shipment by tracking number
  const {
    items: shipments,
    loading,
    error,
    refetch,
  } = useApiList<ShipmentDetail>(`/api/v4/shipments`, {
    limit: 1,
  });

  // The API search uses the `search` param — we pass it via the initial filters
  const {
    items: searchResults,
    loading: searchLoading,
    error: searchError,
    refetch: searchRefetch,
  } = useApiList<ShipmentDetail>(`/api/v4/shipments`, {
    limit: 5,
    search: trackingNumber,
  });

  const isLoading = searchLoading;
  const fetchError = searchError;

  if (isLoading) return <LoadingSkeleton />;
  if (fetchError)
    return <ErrorState message={fetchError.message} onRetry={searchRefetch} />;

  const shipment = searchResults.find(
    (s) =>
      s.trackingNumber === trackingNumber ||
      s.shipmentNumber === trackingNumber,
  );

  if (!shipment) {
    return (
      <>
        <Header title="Tracking Not Found" subtitle={trackingNumber} />
        <div className="p-6 bg-wl-bg-root min-h-screen">
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardContent className="flex flex-col items-center justify-center h-64 gap-4">
              <p className="text-gray-400">
                No shipment found with tracking number{' '}
                <span className="font-mono text-white">{trackingNumber}</span>
              </p>
              <Link href="/shipping/tracking">
                <Button variant="secondary" size="sm">
                  Back to Tracking
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Shipment Tracking"
        subtitle={shipment.trackingNumber ?? shipment.shipmentNumber}
      />

      <main className="min-h-screen bg-wl-bg-root p-6 max-w-2xl mx-auto space-y-6">
        {/* Status Card */}
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">Shipment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Current Status</p>
                <Badge variant={statusVariant(shipment.status)} className="mt-1">
                  {shipment.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-400">Carrier</p>
                <p className="text-white font-medium mt-1">{shipment.carrier ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Last Known Location</p>
                <p className="text-white font-medium mt-1">
                  {[shipment.city, shipment.province].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Estimated Delivery</p>
                <p className="text-white font-medium mt-1">
                  {shipment.estimatedArrival
                    ? new Date(shipment.estimatedArrival).toLocaleDateString()
                    : 'TBD'}
                </p>
              </div>
              {shipment.actualDelivery && (
                <div>
                  <p className="text-sm text-gray-400">Delivered At</p>
                  <p className="text-emerald-400 font-medium mt-1">
                    {new Date(shipment.actualDelivery).toLocaleString()}
                  </p>
                </div>
              )}
              {shipment.carrierTrackingUrl && (
                <div>
                  <a
                    href={shipment.carrierTrackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 text-sm hover:underline"
                  >
                    Track on carrier website →
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        {shipment.activityLogs && shipment.activityLogs.length > 0 && (
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-white">Tracking Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shipment.activityLogs.map((log, idx) => (
                  <div key={log.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      {idx < shipment.activityLogs.length - 1 && (
                        <div className="w-0.5 h-12 bg-wl-bg-elevated mt-2" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-white">
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {[shipment.city, shipment.province].filter(Boolean).join(', ') || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Link href={`/shipments/${shipment.id}`} className="flex-1">
            <Button variant="primary" size="md" className="w-full">
              View Full Shipment Details
            </Button>
          </Link>
          <Link href="/shipping/tracking">
            <Button variant="secondary" size="md">
              Back to Tracking
            </Button>
          </Link>
        </div>
      </main>
    </>
  );
}
