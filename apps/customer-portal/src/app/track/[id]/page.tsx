'use client';

import { use } from 'react';
import { format } from 'date-fns';
import { MapPin, Clock, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageLoader, ErrorMessage } from '@/components/loading-skeleton';
import { ManageDeliveryPanel } from '@/components/manage-delivery-panel';
import { useQuery } from '@/lib/use-api';
import type { ApiTrackingResponse, ApiTimeSlot } from '@/lib/portal-api';
import { ROUTES, getStatusLabel } from '@/lib/portal-api';
import type { ContactPref } from '@/components/manage-delivery-panel';

// ─── Response envelopes ───────────────────────────────────────

interface TrackingEnvelope {
  data: ApiTrackingResponse;
}

interface SlotsEnvelope {
  data: ApiTimeSlot[];
}

// ─── Step display ─────────────────────────────────────────────

const STATUS_STEPS = [
  { status: 'PENDING', label: 'Order Placed', icon: '📦' },
  { status: 'ACCEPTED', label: 'Confirmed', icon: '✅' },
  { status: 'ASSIGNED', label: 'Driver Assigned', icon: '👤' },
  { status: 'PICKED_UP', label: 'Picked Up', icon: '🚚' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🗺️' },
  { status: 'ARRIVED', label: 'Driver Arrived', icon: '📍' },
  { status: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.status);

function getStepStatus(
  stepStatus: string,
  currentStatus: string,
): 'complete' | 'current' | 'pending' {
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (currentIdx < 0) return 'pending';
  if (stepIdx < currentIdx) return 'complete';
  if (stepIdx === currentIdx) return 'current';
  return 'pending';
}

// ─── Component ────────────────────────────────────────────────

export default function TrackDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: trackingToken } = use(params);

  const { data: trackingEnvelope, loading, error, refetch } = useQuery<TrackingEnvelope>(
    ROUTES.TRACKING_BY_TOKEN(trackingToken),
  );

  const { data: slotsEnvelope } = useQuery<SlotsEnvelope>(
    trackingEnvelope ? ROUTES.TRACKING_SLOTS(trackingToken) : null,
  );

  const tracking = trackingEnvelope?.data;
  const slots = slotsEnvelope?.data ?? [];

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="page-container">
        <ErrorMessage
          message={
            error.message.includes('404')
              ? 'Tracking information not found. Please check your tracking token.'
              : error.message
          }
          onRetry={refetch}
        />
        <div className="mt-4">
          <Link href="/track" className="btn btn-ghost">
            ← Try another token
          </Link>
        </div>
      </div>
    );
  }

  if (!tracking) return null;

  const isDelivered = tracking.status === 'DELIVERED';
  const isFailed = ['FAILED', 'CANCELLED', 'RETURNED'].includes(tracking.status);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Live Tracking</h1>
        <p className="page-subtitle">
          Order{' '}
          <span className="mono">
            {tracking.externalOrderNumber ?? `#${tracking.id.slice(-8).toUpperCase()}`}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Status Hero */}
          <div
            className={cn(
              'section-card',
              isDelivered && 'border-wl-success-500/50',
              isFailed && 'border-wl-error-500/50',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                  Current Status
                </p>
                <p className="text-2xl font-bold text-wl-text-primary">
                  {getStatusLabel(tracking.status)}
                </p>
              </div>
              {isDelivered && (
                <CheckCircle2 size={40} className="text-wl-success-500" />
              )}
            </div>

            {/* ETA */}
            {tracking.estimatedArrival && !isDelivered && (
              <div className="flex items-center gap-2 text-sm text-wl-text-secondary mt-2">
                <Clock size={14} className="text-wl-primary-500" />
                <span>
                  Estimated arrival:{' '}
                  <strong className="text-wl-text-primary">
                    {format(new Date(tracking.estimatedArrival), 'PPp')}
                  </strong>
                </span>
              </div>
            )}

            {/* Delivery address */}
            <div className="flex items-start gap-2 mt-3 text-sm text-wl-text-secondary">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-wl-text-tertiary" />
              <span>
                {tracking.addressLine1}, {tracking.city}
                {tracking.province ? `, ${tracking.province}` : ''}{' '}
                {tracking.postalCode}
              </span>
            </div>
          </div>

          {/* Progress steps */}
          <div className="section-card">
            <h2 className="font-semibold text-wl-text-primary mb-5">Delivery Progress</h2>
            <div className="relative">
              {/* Vertical connector */}
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-wl-border-subtle" />

              <div className="flex flex-col gap-5">
                {STATUS_STEPS.filter((s) => !isFailed || s.status !== 'DELIVERED').map((step) => {
                  const stepState = getStepStatus(step.status, tracking.status);
                  return (
                    <div key={step.status} className="relative flex items-center gap-4">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-sm',
                          stepState === 'complete' &&
                            'bg-wl-success-500/20 border-2 border-wl-success-500 text-wl-success-500',
                          stepState === 'current' &&
                            'bg-wl-primary-500 border-2 border-wl-primary-500 text-white animate-pulse',
                          stepState === 'pending' &&
                            'bg-wl-bg-elevated border-2 border-wl-border-subtle text-wl-text-tertiary',
                        )}
                      >
                        {stepState === 'complete' ? '✓' : step.icon}
                      </div>
                      <div>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            stepState === 'current' && 'text-wl-primary-400',
                            stepState === 'complete' && 'text-wl-text-primary',
                            stepState === 'pending' && 'text-wl-text-tertiary',
                          )}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Proof of delivery */}
          {isDelivered && tracking.proofOfDelivery && (
            <div className="section-card">
              <h2 className="font-semibold text-wl-text-primary mb-4">Proof of Delivery</h2>
              {tracking.proofOfDelivery.photoUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {tracking.proofOfDelivery.photoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border border-wl-border-subtle"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Delivery photo ${i + 1}`}
                        className="w-full h-28 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {tracking.proofOfDelivery.recipientName && (
                <p className="text-sm text-wl-text-secondary">
                  Signed by:{' '}
                  <span className="font-medium">{tracking.proofOfDelivery.recipientName}</span>
                </p>
              )}
              {tracking.proofOfDelivery.deliveredAt && (
                <p className="text-xs text-wl-text-tertiary mt-1">
                  At {format(new Date(tracking.proofOfDelivery.deliveredAt), 'PPp')}
                </p>
              )}
            </div>
          )}

          {/* Manage delivery panel (from existing component — already calls real API) */}
          {!isDelivered && !isFailed && (
            <ManageDeliveryPanel
              trackingToken={trackingToken}
              deliveryStatus={tracking.status}
              initialPreferences={
                tracking.deliveryPreferences
                  ? {
                      ...tracking.deliveryPreferences,
                      contactPref: (tracking.deliveryPreferences.contactPref as ContactPref | null) ?? null,
                    }
                  : undefined
              }
              availableSlots={slots.map((s) => ({
                id: s.id,
                name: s.name,
                startTime: s.startTime,
                endTime: s.endTime,
                daysOfWeek: s.daysOfWeek,
              }))}
              slotsLocked={['OUT_FOR_DELIVERY', 'ARRIVED'].includes(tracking.status)}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Driver info */}
          {tracking.driver && (
            <div className="section-card">
              <h3 className="font-semibold text-wl-text-primary mb-4">Your Driver</h3>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-wl-bg-elevated flex items-center justify-center text-xl font-bold text-wl-primary-400">
                  {tracking.driver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-wl-text-primary">{tracking.driver.name}</p>
                  {tracking.driver.vehicleType && (
                    <p className="text-xs text-wl-text-secondary">{tracking.driver.vehicleType}</p>
                  )}
                </div>
              </div>
              {/* Driver contact — phone is intentionally not exposed by the tracking endpoint per API design */}
              <p className="text-xs text-wl-text-tertiary">
                Use the Manage Delivery panel below to set your contact preference.
              </p>
            </div>
          )}

          {/* Time slot */}
          {tracking.timeSlot && (
            <div className="section-card">
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                Scheduled Slot
              </p>
              <p className="font-semibold text-wl-text-primary">{tracking.timeSlot.name}</p>
              <p className="text-sm text-wl-text-secondary">
                {tracking.timeSlot.startTime} – {tracking.timeSlot.endTime}
              </p>
            </div>
          )}

          {/* Recipient */}
          <div className="section-card">
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
              Delivering To
            </p>
            <p className="font-semibold text-wl-text-primary">{tracking.customerName}</p>
            <p className="text-sm text-wl-text-secondary mt-1">
              {tracking.addressLine1}, {tracking.city}
            </p>
          </div>

          {/* Nav back */}
          <Link href="/orders" className="btn btn-ghost w-full">
            ← Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
