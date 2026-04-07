'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Phone, MessageSquare, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryTimeline } from '@/components/delivery-timeline';
import { MiniMap } from '@/components/mini-map';
import { RatingStars } from '@/components/rating-stars';
import type { Order, DeliveryTimestep, Driver } from '@/types';

// Mock order details
const mockOrder: Order = {
  id: '1',
  orderNumber: 'ORD-2024-001',
  status: 'out-for-delivery',
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  scheduledDeliveryDate: new Date(),
  items: [
    { id: '1', name: 'Premium Headphones', quantity: 1, price: 149.99, image: '🎧' },
    { id: '2', name: 'Audio Cable', quantity: 2, price: 9.99, image: '🔌' },
  ],
  deliveryAddress: {
    street: '123 Main St, Apt 4B',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'USA',
    latitude: 37.7749,
    longitude: -122.4194,
  },
  totalPrice: 169.97,
  estimatedDelivery: 'Today, 2-4 PM',
};

const mockDriver: Driver = {
  id: 'DRV-001',
  name: 'Michael Johnson',
  phone: '(555) 123-4567',
  email: 'michael.johnson@witylogix.com',
  photo: '👨‍💼',
  vehicle: {
    type: 'Van',
    plate: 'WLX-2024',
    color: 'Blue',
  },
  rating: 4.8,
};

const deliverySteps: DeliveryTimestep[] = [
  {
    step: 'ordered',
    status: 'completed',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    details: 'Your order has been placed and confirmed',
  },
  {
    step: 'confirmed',
    status: 'completed',
    timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
    details: 'Order confirmed and prepared for delivery',
  },
  {
    step: 'out-for-delivery',
    status: 'completed',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    details: 'Driver Michael Johnson is on the way with your package',
  },
  {
    step: 'delivered',
    status: 'pending',
  },
];

export default function OrderDetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="page-container">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3 animate-fade-in">
        <Link
          href="/orders"
          className="btn btn-ghost p-2"
          aria-label="Back to orders"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="text-xs text-wl-text-tertiary">
          <Link href="/orders" className="hover:text-wl-text-secondary transition-colors">
            Orders
          </Link>
          {' / '}
          <span className="text-wl-text-secondary mono">{mockOrder.orderNumber}</span>
        </span>
      </div>

      {/* Page Title */}
      <header className="page-header animate-fade-in stagger-1">
        <h1 className="page-title">
          Order <span className="mono">{mockOrder.orderNumber}</span>
        </h1>
        <p className="page-subtitle">
          Placed on {format(mockOrder.createdAt, 'PPP p')}
        </p>
      </header>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content — spans 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Delivery Status */}
          <div className="section-card animate-fade-in stagger-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-wl-text-primary">
                Delivery Status
              </h2>
              <span className={cn('status-badge', 'status-active')}>
                <span className="status-badge-dot" />
                Out for Delivery
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="section-card animate-fade-in stagger-3">
            <h2 className="font-semibold text-wl-text-primary mb-5">
              Delivery Timeline
            </h2>
            <DeliveryTimeline steps={deliverySteps} />
          </div>

          {/* Driver Info */}
          <div className="section-card animate-fade-in stagger-4">
            <h2 className="font-semibold text-wl-text-primary mb-4">
              Driver Information
            </h2>
            <div className="flex items-start gap-4">
              <div className={cn(
                'w-14 h-14 rounded-full flex-shrink-0',
                'bg-wl-bg-elevated flex items-center justify-center',
                'text-2xl'
              )}>
                {mockDriver.photo}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-wl-text-primary">
                  {mockDriver.name}
                </p>
                <p className="text-sm text-wl-text-secondary mt-0.5">
                  {mockDriver.vehicle.color} {mockDriver.vehicle.type} &middot;{' '}
                  <span className="mono">{mockDriver.vehicle.plate}</span>
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <RatingStars value={Math.round(mockDriver.rating)} readonly size="sm" />
                  <span className="text-xs text-wl-text-tertiary mono">
                    {mockDriver.rating}/5
                  </span>
                </div>

                {/* Driver Actions */}
                <div className="flex gap-2 mt-4">
                  <a
                    href={`tel:${mockDriver.phone}`}
                    className="btn btn-primary"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                  <a
                    href={`sms:${mockDriver.phone}`}
                    className="btn btn-secondary"
                  >
                    <MessageSquare size={14} />
                    Message
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="section-card animate-fade-in stagger-5">
            <h2 className="font-semibold text-wl-text-primary mb-4">
              Delivery Address
            </h2>
            <div className="flex items-start gap-2 mb-4 text-sm text-wl-text-secondary">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-wl-text-tertiary" />
              <span>
                {mockOrder.deliveryAddress.street},{' '}
                {mockOrder.deliveryAddress.city},{' '}
                {mockOrder.deliveryAddress.state}{' '}
                {mockOrder.deliveryAddress.zipCode}
              </span>
            </div>
            <MiniMap address={mockOrder.deliveryAddress} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Order Summary */}
          <div className="section-card animate-fade-in stagger-2">
            <h2 className="font-semibold text-wl-text-primary mb-4">
              Order Summary
            </h2>

            <div className="space-y-3 mb-4 pb-4 border-b border-wl-border-subtle">
              {mockOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-wl-text-primary font-medium">
                      {item.name}
                    </p>
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
                  ${mockOrder.totalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-wl-text-secondary">Delivery Fee</span>
                <span className="text-wl-text-primary font-medium">Free</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-wl-border-subtle">
                <span className="font-semibold text-wl-text-primary">Total</span>
                <span className="font-semibold text-wl-text-primary mono">
                  ${mockOrder.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Delivery — border-left accent, no amber background */}
          {mockOrder.estimatedDelivery && (
            <div className={cn(
              'section-card animate-fade-in stagger-3',
              'border-l-[3px] border-l-wl-primary-500'
            )}>
              <div className="flex items-center gap-2 text-wl-text-secondary mb-1">
                <Clock size={14} />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Estimated Delivery
                </span>
              </div>
              <p className="text-lg font-semibold text-wl-text-primary">
                {mockOrder.estimatedDelivery}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="section-card animate-fade-in stagger-4">
            <h3 className="font-semibold text-wl-text-primary mb-3">
              Actions
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href={`/orders/${mockOrder.id}/reschedule`}
                className="btn btn-primary w-full"
              >
                Reschedule
              </Link>
              <button className="btn btn-secondary w-full">
                Download Invoice
              </button>
            </div>
          </div>

          {/* Rate Order — only show after delivery */}
          {mockOrder.status === 'delivered' && !mockOrder.rating && (
            <Link
              href={`/orders/${mockOrder.id}/rate`}
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
