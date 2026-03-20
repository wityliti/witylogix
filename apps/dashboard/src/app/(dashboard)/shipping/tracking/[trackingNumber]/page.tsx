'use client';

import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';

interface TrackingDetail {
  trackingNumber: string;
  orderId: string;
  carrier: string;
  currentStatus: string;
  eta: string | null;
  lastLocation: string;
  events: Array<{ timestamp: string; location: string; status: string }>;
}

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    delivered: 'success',
    'out-for-delivery': 'info',
    'in-transit': 'warning',
    exception: 'danger',
  };
  return map[status.toLowerCase()] || 'default';
};

export default function TrackingDetailPage() {
  const params = useParams();
  const trackingNumber = params.trackingNumber as string;

  const { data: tracking, loading, error, refetch } = useApiQuery<TrackingDetail>(`/api/v4/tracking/${trackingNumber}`);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (!tracking) {
    return (
      <>
        <Header title="Tracking Not Found" />
        <div className="p-6">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-wl-text-secondary">Tracking information not found</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Shipment Tracking" subtitle={tracking.trackingNumber} />

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Shipment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-wl-text-secondary">Current Status</p>
                <Badge variant={statusVariant(tracking.currentStatus)} className="mt-1">
                  {tracking.currentStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-wl-text-secondary">Carrier</p>
                <p className="text-wl-text-primary font-medium mt-1">{tracking.carrier}</p>
              </div>
              <div>
                <p className="text-sm text-wl-text-secondary">Last Location</p>
                <p className="text-wl-text-primary font-medium mt-1">{tracking.lastLocation}</p>
              </div>
              <div>
                <p className="text-sm text-wl-text-secondary">Estimated Delivery</p>
                <p className="text-wl-text-primary font-medium mt-1">
                  {tracking.eta ? new Date(tracking.eta).toLocaleDateString() : 'TBD'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {tracking.events && tracking.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tracking Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tracking.events.map((event, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-wl-primary-500" />
                      {idx < tracking.events.length - 1 && <div className="w-0.5 h-12 bg-wl-border-subtle mt-2" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-wl-text-primary">{event.status}</p>
                      <p className="text-xs text-wl-text-secondary">{event.location}</p>
                      <p className="text-xs text-wl-text-tertiary mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
