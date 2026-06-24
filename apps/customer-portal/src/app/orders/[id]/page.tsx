'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Phone, MessageSquare, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryTimeline } from '@/components/delivery-timeline';
import { MiniMap } from '@/components/mini-map';
import { RatingStars } from '@/components/rating-stars';
import { PageLoader, ErrorMessage, Skeleton } from '@/components/loading-skeleton';
import { useQuery } from '@/lib/use-api';
import { ROUTES, getStatusLabel, getStatusVariant } from '@/lib/portal-api';
import type { ApiOrder } from '@/lib/portal-api';
import type { DeliveryTimestep } from '@/types';

// ─── Status → timeline steps ──────────────────────────────────

function buildTimelineSteps(status: string, order: ApiOrder): DeliveryTimestep[] {
  const progressOrder = ['PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'];
  const currentIdx = progressOrder.indexOf(status);

  return [
    {
      step: 'ordered',
      status: currentIdx >= 0 ? 'completed' : 'pending',
      timestamp: new Date(order.createdAt),
      details: 'Your order has been placed and confirmed',
    },
    {
      step: 'confirmed',
      status: currentIdx >= 1 ? 'completed' : 'pending',
      details: 'Order confirmed and prepared for delivery',
    },
    {
      step: 'out-for-delivery',
      status:
        currentIdx >= 3
          ? 'completed'
          : currentIdx === 2
            ? 'completed'
            : 'pending',
      details: order.driver
        ? `${order.driver.name} is on the way with your package`
        : 'Driver is on the way',
    },
    {
      step: 'delivered',
      status:
        status === 'DELIVERED'
          ? 'completed'
          : 'pending',
      timestamp: order.proofOfDelivery?.deliveredAt
        ? new Date(order.proofOfDelivery.deliveredAt)
        : undefined,
    },
  ];
}

// ─── Envelope shape from GET /api/v4/orders/:id ───────────────

interface OrderDetailEnvelope {
  data: ApiOrder;
}

// ─── Component ────────────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: envelope, loading, error, refetch } = useQuery<OrderDetailEnvelope>(
    ROUTES.ORDER(id),
  );

  const order = envelope?.data;

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="page-container">
        <Link href="/orders" className="btn btn-ghost p-2 inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={18} />
          Back to Orders
        </Link>
        <ErrorMessage message={error.message} onRetry={refetch} />
      </div>
    );
  }

  if (!order) return null;

  const statusVariant = getStatusVariant(order.status);
  const statusLabel = getStatusLabel(order.status);
  const timelineSteps = buildTimelineSteps(order.status, order);
  const orderNumber = order.externalOrderNumber ?? `#${id.slice(-8).toUpperCase()}`;
  const totalPrice = order.totalPrice ?? 0;

  return (
    <div className="page-container">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3 animate-fade-in">
        <Link href="/orders" className="btn btn-ghost p-2" aria-label="Back to orders">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-xs text-wl-text-tertiary">
          <Link href="/orders" className="hover:text-wl-text-secondary transition-colors">
            Orders
          </Link>
          {' / '}
          <span className="text-wl-text-secondary mono">{orderNumber}</span>
        </span>
      </div>

      <header className="page-header animate-fade-in stagger-1">
        <h1 className="page-title">
          Order <span className="mono">{orderNumber}</span>
        </h1>
        <p className="page-subtitle">Placed on {format(new Date(order.createdAt), 'PPP p')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Delivery Status */}
          <div className="section-card animate-fade-in stagger-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-wl-text-primary">Delivery Status</h2>
              <span
                className={cn(
                  'status-badge',
                  statusVariant === 'active' && 'status-active',
                  statusVariant === 'complete' && 'status-complete',
                  statusVariant === 'error' && 'status-error',
                  statusVariant === 'warn' && 'status-warn',
                  statusVariant === 'default' && 'status-default',
                )}
              >
                {statusVariant === 'active' && <span className="status-badge-dot" />}
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="section-card animate-fade-in stagger-3">
            <h2 className="font-semibold text-wl-text-primary mb-5">Delivery Timeline</h2>
            <DeliveryTimeline steps={timelineSteps} />
          </div>

          {/* Driver Info */}
          {order.driver && (
            <div className="section-card animate-fade-in stagger-4">
              <h2 className="font-semibold text-wl-text-primary mb-4">Driver Information</h2>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-full flex-shrink-0',
                    'bg-wl-bg-elevated flex items-center justify-center',
                    'text-2xl font-bold text-wl-primary-400',
                  )}
                >
                  {order.driver.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-wl-text-primary">{order.driver.name}</p>
                  <div className="flex gap-2 mt-3">
                    {order.driver.phone && (
                      <>
                        <a href={`tel:${order.driver.phone}`} className="btn btn-primary">
                          <Phone size={14} />
                          Call
                        </a>
                        <a href={`sms:${order.driver.phone}`} className="btn btn-secondary">
                          <MessageSquare size={14} />
                          Message
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Proof of Delivery */}
          {order.proofOfDelivery && order.proofOfDelivery.photoUrls.length > 0 && (
            <div className="section-card animate-fade-in stagger-4">
              <h2 className="font-semibold text-wl-text-primary mb-4">Proof of Delivery</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {order.proofOfDelivery.photoUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-wl-border-subtle hover:border-wl-primary-500 transition-colors"
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
              {order.proofOfDelivery.recipientName && (
                <p className="mt-3 text-sm text-wl-text-secondary">
                  Signed by: <span className="font-medium">{order.proofOfDelivery.recipientName}</span>
                </p>
              )}
            </div>
          )}

          {/* Delivery Address */}
          <div className="section-card animate-fade-in stagger-5">
            <h2 className="font-semibold text-wl-text-primary mb-4">Delivery Address</h2>
            <div className="flex items-start gap-2 mb-4 text-sm text-wl-text-secondary">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-wl-text-tertiary" />
              <span>
                {order.addressLine1}
                {order.addressLine2 ? `, ${order.addressLine2}` : ''},{' '}
                {order.city}
                {order.province ? `, ${order.province}` : ''}{' '}
                {order.postalCode}
              </span>
            </div>
            <MiniMap
              address={{
                street: order.addressLine1,
                city: order.city,
                state: order.province ?? '',
                zipCode: order.postalCode ?? '',
                country: order.country ?? '',
              }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Order Summary */}
          <div className="section-card animate-fade-in stagger-2">
            <h2 className="font-semibold text-wl-text-primary mb-4">Order Summary</h2>
            {order.lineItems && order.lineItems.length > 0 ? (
              <>
                <div className="space-y-3 mb-4 pb-4 border-b border-wl-border-subtle">
                  {order.lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-wl-text-primary font-medium">{item.title}</p>
                        <p className="text-xs text-wl-text-tertiary mt-0.5">
                          Qty: <span className="mono">{item.quantity}</span>
                        </p>
                      </div>
                      <p className="text-sm font-medium text-wl-text-primary mono">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-wl-text-secondary">Subtotal</span>
                    <span className="text-wl-text-primary font-medium mono">
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-wl-text-secondary">Delivery Fee</span>
                    <span className="text-wl-text-primary font-medium">Free</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-wl-border-subtle">
                    <span className="font-semibold text-wl-text-primary">Total</span>
                    <span className="font-semibold text-wl-text-primary mono">
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-wl-text-tertiary">No items information available.</p>
            )}
          </div>

          {/* Estimated Delivery */}
          {order.estimatedArrival && (
            <div
              className={cn(
                'section-card animate-fade-in stagger-3',
                'border-l-[3px] border-l-wl-primary-500',
              )}
            >
              <div className="flex items-center gap-2 text-wl-text-secondary mb-1">
                <Clock size={14} />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Estimated Delivery
                </span>
              </div>
              <p className="text-lg font-semibold text-wl-text-primary">
                {format(new Date(order.estimatedArrival), 'PPp')}
              </p>
            </div>
          )}

          {/* Time Slot */}
          {order.timeSlot && (
            <div className="section-card animate-fade-in stagger-3">
              <p className="text-xs text-wl-text-tertiary font-medium uppercase tracking-wide mb-1">
                Delivery Slot
              </p>
              <p className="font-semibold text-wl-text-primary">{order.timeSlot.name}</p>
              <p className="text-sm text-wl-text-secondary">
                {order.timeSlot.startTime} – {order.timeSlot.endTime}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="section-card animate-fade-in stagger-4">
            <h3 className="font-semibold text-wl-text-primary mb-3">Actions</h3>
            <div className="flex flex-col gap-2">
              {order.trackingToken && (
                <Link
                  href={`/track/${order.trackingToken}`}
                  className="btn btn-primary w-full"
                >
                  Live Track
                </Link>
              )}
              {!['DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(
                order.status,
              ) && (
                <Link href={`/orders/${id}/reschedule`} className="btn btn-secondary w-full">
                  Reschedule
                </Link>
              )}
            </div>
          </div>

          {/* Rate — only after delivery and not yet rated */}
          {order.status === 'DELIVERED' && (
            <Link
              href={`/orders/${id}/rate`}
              className="btn btn-primary btn-lg w-full animate-fade-in stagger-5"
            >
              Rate This Delivery
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
