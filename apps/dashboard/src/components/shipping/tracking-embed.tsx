'use client';

import { useShipmentTracking } from '@/hooks/use-shipment-tracking';
import { TrackingTimeline } from './tracking-timeline';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TrackingEmbedProps {
  trackingNumber: string;
  brandColor?: string;
  logoUrl?: string;
  className?: string;
}

const statusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default'> = {
    delivered: 'success',
    in_transit: 'primary',
    out_for_delivery: 'warning',
    picked_up: 'info',
    exception: 'danger',
    returned: 'warning',
  };
  return map[status.toLowerCase()] ?? 'default';
};

export function TrackingEmbed({
  trackingNumber,
  brandColor = '#F5A623',
  logoUrl,
  className,
}: TrackingEmbedProps) {
  const { trackingData, events, isLoading, error } = useShipmentTracking(trackingNumber);

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-6',
          className
        )}
      >
        <div className="space-y-4">
          <div className="h-6 bg-wl-border-subtle rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-wl-border-subtle rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div
        className={cn(
          'bg-wl-danger-bg/20 border border-wl-danger-400/30 rounded-lg p-4',
          className
        )}
      >
        <p className="text-sm text-wl-danger-400">
          Unable to load tracking information for {trackingNumber}
        </p>
      </div>
    );
  }

  const hours = trackingData.eta
    ? Math.floor(
        (new Date(trackingData.eta).getTime() - Date.now()) / (1000 * 60 * 60)
      )
    : null;

  return (
    <div
      className={cn(
        'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-6',
        'space-y-6',
        className
      )}
      style={{
        '--brand-color': brandColor,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Brand"
              className="h-6 mb-3"
              style={{ maxWidth: '120px' }}
            />
          )}
          <h3 className="text-sm font-semibold text-wl-text-secondary uppercase tracking-wide">
            {trackingData.carrier}
          </h3>
          <p className="text-2xl font-mono font-bold text-wl-primary-400 mt-2">
            {trackingNumber}
          </p>
        </div>
        <Badge variant={statusVariant(trackingData.currentStatus)}>
          {trackingData.currentStatus}
        </Badge>
      </div>

      {/* ETA */}
      {trackingData.eta && hours !== null && (
        <div
          className="p-4 rounded-md border"
          style={{
            borderColor: 'var(--brand-color)',
            backgroundColor: `color-mix(in srgb, var(--brand-color) 8%, transparent)`,
          }}
        >
          <p className="text-xs text-wl-text-tertiary uppercase font-semibold tracking-wide">
            Estimated Delivery
          </p>
          <p className="text-lg font-semibold text-wl-text-primary mt-1">
            {hours > 0
              ? `In ${hours} hour${hours > 1 ? 's' : ''}`
              : 'Today'}
          </p>
        </div>
      )}

      {/* Location Info */}
      <div className="space-y-3">
        <div>
          <p className="text-xs text-wl-text-tertiary uppercase font-semibold">
            Current Location
          </p>
          <p className="text-sm text-wl-text-primary mt-1">{trackingData.lastLocation}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase font-semibold">From</p>
            <p className="text-xs text-wl-text-secondary mt-1">{trackingData.origin}</p>
          </div>
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase font-semibold">To</p>
            <p className="text-xs text-wl-text-secondary mt-1">{trackingData.destination}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t border-wl-border-subtle pt-4">
        <TrackingTimeline events={events} currentStatus={trackingData.currentStatus} />
      </div>

      {/* Package Details */}
      <div className="border-t border-wl-border-subtle pt-4">
        <p className="text-xs text-wl-text-tertiary uppercase font-semibold mb-3">
          Package Details
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-wl-text-tertiary">Weight</span>
            <p className="font-mono font-semibold text-wl-text-primary mt-0.5">
              {trackingData.weight} kg
            </p>
          </div>
          <div>
            <span className="text-wl-text-tertiary">Service</span>
            <p className="font-mono font-semibold text-wl-text-primary mt-0.5">
              {trackingData.serviceLevel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
