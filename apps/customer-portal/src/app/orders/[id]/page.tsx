'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Phone, MapPin, Clock } from 'lucide-react';
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

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className={cn(
      'flex flex-col gap-6 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8 pb-12'
    )}>
      {/* Header with Back Button */}
      <div className={cn(
        'flex items-center gap-4'
      )}>
        <Link
          href="/orders"
          className={cn(
            'p-2 hover:bg-wl-bg-surface rounded-lg',
            'transition-colors duration-fast'
          )}
          aria-label="Back to orders"
        >
          <ArrowLeft size={20} className="text-wl-text-primary" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-wl-text-primary">
            Order #{mockOrder.orderNumber}
          </h1>
          <p className="text-wl-text-secondary text-sm mt-1">
            Placed on {format(mockOrder.createdAt, 'PPP p')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Status Badge */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-wl-text-primary">
                Delivery Status
              </h2>
              <span className={cn(
                'px-4 py-2 rounded-full text-sm font-medium',
                'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
              )}>
                Out for Delivery
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <h2 className="text-lg font-bold text-wl-text-primary mb-6">
              Delivery Timeline
            </h2>
            <DeliveryTimeline steps={deliverySteps} />
          </div>

          {/* Driver Info */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Driver Information
            </h2>
            <div className={cn(
              'flex items-start gap-4'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-full',
                'bg-wl-primary-500/20 flex items-center justify-center',
                'text-3xl flex-shrink-0'
              )}>
                {mockDriver.photo}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-wl-text-primary">
                  {mockDriver.name}
                </h3>
                <p className="text-sm text-wl-text-secondary mt-1">
                  {mockDriver.vehicle.color} {mockDriver.vehicle.type} • {mockDriver.vehicle.plate}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <RatingStars value={Math.round(mockDriver.rating)} readonly size="sm" />
                  <span className="text-sm text-wl-text-secondary">
                    {mockDriver.rating}/5
                  </span>
                </div>

                {/* Driver Actions */}
                <div className={cn(
                  'flex gap-2 mt-4'
                )}>
                  <a
                    href={`tel:${mockDriver.phone}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md',
                      'bg-wl-primary-500/20 text-wl-primary-400',
                      'hover:bg-wl-primary-500/30 transition-colors duration-fast',
                      'text-sm font-medium'
                    )}
                  >
                    <Phone size={16} />
                    Call
                  </a>
                  <a
                    href={`sms:${mockDriver.phone}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md',
                      'bg-wl-neutral-700 text-wl-text-primary',
                      'hover:bg-wl-neutral-600 transition-colors duration-fast',
                      'text-sm font-medium'
                    )}
                  >
                    Message
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address Map */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Delivery Address
            </h2>
            <MiniMap address={mockOrder.deliveryAddress} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Order Summary */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <h2 className="text-lg font-bold text-wl-text-primary mb-4">
              Order Summary
            </h2>

            <div className={cn(
              'space-y-3 mb-4 pb-4',
              'border-b border-wl-border-subtle'
            )}>
              {mockOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-wl-text-primary font-medium">
                      {item.name}
                    </p>
                    <p className="text-xs text-wl-text-tertiary mt-1">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-wl-text-primary">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-wl-text-secondary">Subtotal</span>
                <span className="text-wl-text-primary font-medium">
                  ${mockOrder.totalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-wl-text-secondary">Delivery Fee</span>
                <span className="text-wl-text-primary font-medium">Free</span>
              </div>
              <div className={cn(
                'flex justify-between pt-2 border-t border-wl-border-subtle'
              )}>
                <span className="font-bold text-wl-text-primary">Total</span>
                <span className="font-bold text-lg text-wl-primary-400">
                  ${mockOrder.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Delivery */}
          {mockOrder.estimatedDelivery && (
            <div className={cn(
              'bg-wl-primary-500/20 border border-wl-primary-500/30',
              'rounded-lg p-4'
            )}>
              <div className="flex items-center gap-2 text-wl-primary-400 mb-2">
                <Clock size={16} />
                <span className="font-medium">Estimated Delivery</span>
              </div>
              <p className="text-2xl font-bold text-wl-text-primary">
                {mockOrder.estimatedDelivery}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className={cn(
            'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
          )}>
            <h3 className="font-bold text-wl-text-primary mb-3">
              Actions
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href={`/orders/${mockOrder.id}/reschedule`}
                className={cn(
                  'px-4 py-2 rounded-md text-center',
                  'bg-wl-primary-500/20 text-wl-primary-400',
                  'hover:bg-wl-primary-500/30 transition-colors',
                  'text-sm font-medium'
                )}
              >
                Reschedule
              </Link>
              <button className={cn(
                'px-4 py-2 rounded-md text-center',
                'bg-wl-neutral-700 text-wl-text-primary',
                'hover:bg-wl-neutral-600 transition-colors',
                'text-sm font-medium'
              )}>
                Download Invoice
              </button>
            </div>
          </div>

          {/* Rate Order - only show after delivery */}
          {mockOrder.status === 'delivered' && !mockOrder.rating && (
            <Link
              href={`/orders/${mockOrder.id}/rate`}
              className={cn(
                'px-4 py-3 rounded-md text-center',
                'bg-wl-success-500 text-wl-text-inverse',
                'hover:bg-wl-success-600 transition-colors',
                'font-medium text-sm'
              )}
            >
              Rate This Delivery
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
