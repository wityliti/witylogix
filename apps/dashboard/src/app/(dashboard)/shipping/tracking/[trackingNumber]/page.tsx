'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrackingTimeline } from '@/components/shipping/tracking-timeline';
import { useShipmentTracking } from '@/hooks/use-shipment-tracking';
import { cn } from '@/lib/utils';

interface Params {
  trackingNumber: string;
}

const statusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    'Delivered': 'success',
    'Out for Delivery': 'warning',
    'In Transit': 'primary',
    'Exception': 'danger',
    'Pending': 'info',
  };
  return map[status] ?? 'default';
};

export default function TrackingDetailPage({ params }: { params: Params }) {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  const { trackingData, events, isLoading, error } = useShipmentTracking(params.trackingNumber);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Trigger refetch logic through the hook would happen here
      // For now, just refresh the page silently
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Generate share link
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareLink(`${window.location.origin}/tracking/${params.trackingNumber}`);
    }
  }, [params.trackingNumber]);

  const handleCopyTrackingNumber = () => {
    navigator.clipboard.writeText(params.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hoursUntilETA = trackingData?.eta
    ? Math.floor((new Date(trackingData.eta).getTime() - Date.now()) / (1000 * 60 * 60))
    : null;

  if (isLoading) {
    return (
      <>
        <Header title="Loading..." />
        <div className="p-6">
          <Card className="p-8">
            <div className="space-y-4">
              <div className="h-8 bg-wl-border-subtle rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-wl-border-subtle rounded animate-pulse" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (error || !trackingData) {
    return (
      <>
        <Header
          title={params.trackingNumber}
          actions={
            <Button variant="secondary" onClick={() => router.back()}>
              ← Back
            </Button>
          }
        />
        <div className="p-6">
          <Card className="border-wl-danger-400/30 bg-wl-danger-bg/20">
            <p className="text-wl-danger-400">
              Unable to load tracking information. Please check the tracking number and try again.
            </p>
            <Button variant="primary" size="sm" className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={params.trackingNumber}
        subtitle={`${trackingData.carrier} · Order ${trackingData.orderId}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '⏸ Stop Auto-Refresh' : '▶ Auto-Refresh'}
            </Button>
            <Button variant="secondary" onClick={() => router.back()}>
              ← Back
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Header */}
        <Card>
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-mono font-bold text-wl-primary-400">
                  {trackingData.trackingNumber}
                </h2>
                <p className="text-sm text-wl-text-secondary mt-1">
                  {trackingData.carrier} · {trackingData.serviceLevel} Service
                </p>
              </div>
              <Badge variant={statusVariant(trackingData.currentStatus)}>
                {trackingData.currentStatus}
              </Badge>
            </div>

            {/* Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-wl-border-subtle pt-6">
              {/* Current Status */}
              <div>
                <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                  Current Status
                </p>
                <p className="text-lg font-semibold text-wl-text-primary mt-2">
                  {trackingData.currentStatus}
                </p>
                <p className="text-xs text-wl-text-secondary mt-1">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>

              {/* ETA Countdown */}
              {trackingData.eta && hoursUntilETA !== null && (
                <div className="bg-wl-bg-surface rounded p-4">
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Estimated Delivery
                  </p>
                  <p className="text-2xl font-bold text-wl-primary-400 mt-2">
                    {hoursUntilETA > 0 ? `${hoursUntilETA}h` : 'Today'}
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    {new Date(trackingData.eta).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}

              {/* Current Location */}
              <div>
                <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                  Current Location
                </p>
                <p className="text-lg font-semibold text-wl-text-primary mt-2">
                  {trackingData.lastLocation}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-wl-border-subtle pt-4 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyTrackingNumber}
              >
                {copied ? '✓ Copied' : '📋 Copy Tracking#'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShareLink}
              >
                {copied ? '✓ Link Copied' : '🔗 Share Link'}
              </Button>
              <Button variant="ghost" size="sm">
                📞 Contact Carrier
              </Button>
              <Button variant="ghost" size="sm">
                📋 File Claim
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline - Large Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Tracking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <TrackingTimeline events={events} currentStatus={trackingData.currentStatus} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Package Details */}
          <div className="space-y-6">
            {/* Package Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Package Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Weight
                  </p>
                  <p className="text-sm font-mono font-semibold text-wl-text-primary mt-1">
                    {trackingData.weight} kg
                  </p>
                </div>
                <div className="border-t border-wl-border-subtle pt-4">
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Dimensions
                  </p>
                  <p className="text-sm font-mono text-wl-text-primary mt-1">
                    {trackingData.dimensions.length} × {trackingData.dimensions.width} × {trackingData.dimensions.height} cm
                  </p>
                </div>
                <div className="border-t border-wl-border-subtle pt-4">
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Service Level
                  </p>
                  <p className="text-sm text-wl-text-primary mt-1">
                    {trackingData.serviceLevel}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recipient Card */}
            <Card>
              <CardHeader>
                <CardTitle>Recipient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Name
                  </p>
                  <p className="text-sm text-wl-text-primary mt-1">
                    {trackingData.recipientName}
                  </p>
                </div>
                <div className="border-t border-wl-border-subtle pt-4">
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    Address
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    {trackingData.recipientAddress}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Route Card */}
            <Card>
              <CardHeader>
                <CardTitle>Route</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    From
                  </p>
                  <p className="text-sm text-wl-text-primary mt-1">
                    {trackingData.origin}
                  </p>
                </div>
                <div className="flex items-center justify-center h-6 text-wl-text-tertiary">
                  ↓
                </div>
                <div>
                  <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
                    To
                  </p>
                  <p className="text-sm text-wl-text-primary mt-1">
                    {trackingData.destination}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Proof of Delivery Section */}
        {(trackingData.proofOfDelivery || trackingData.signature) && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Proof</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trackingData.proofOfDelivery && trackingData.proofOfDelivery.length > 0 && (
                  <div>
                    <p className="text-xs text-wl-text-tertiary uppercase font-semibold mb-3">
                      Photos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {trackingData.proofOfDelivery.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square bg-wl-bg-surface rounded border border-wl-border-subtle overflow-hidden"
                        >
                          <img
                            src={url}
                            alt={`Delivery photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trackingData.signature && (
                  <div className="border-t border-wl-border-subtle pt-4">
                    <p className="text-xs text-wl-text-tertiary uppercase font-semibold mb-3">
                      Signature
                    </p>
                    <div className="bg-wl-bg-surface rounded border border-wl-border-subtle p-4 max-w-xs">
                      <img
                        src={trackingData.signature}
                        alt="Signature"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Shipment Route</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 bg-wl-bg-surface rounded border border-wl-border-subtle flex items-center justify-center text-wl-text-tertiary">
              <div className="text-center">
                <p className="text-sm">Map view coming soon</p>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  Interactive route from {trackingData.origin} to {trackingData.destination}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
