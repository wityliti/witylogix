'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Filter, MapPin, Star, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

// Mock delivery history data
const mockDeliveries: Order[] = [
  {
    id: 'ORD-2024-001',
    orderNumber: '#1001',
    status: 'delivered',
    createdAt: new Date('2024-03-11T14:00:00'),
    scheduledDeliveryDate: new Date('2024-03-11T18:00:00'),
    actualDeliveryDate: new Date('2024-03-11T17:45:00'),
    items: [
      { id: '1', name: 'Fresh Vegetables Bundle', quantity: 2, price: 24.99 },
      { id: '2', name: 'Organic Milk (1L)', quantity: 1, price: 5.99 },
      { id: '3', name: 'Whole Wheat Bread', quantity: 1, price: 3.49 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    totalPrice: 34.47,
    rating: {
      driverRating: 5,
      experienceRating: 5,
      feedback: 'Great service, fast delivery!',
      createdAt: new Date('2024-03-11T18:30:00'),
    },
  },
  {
    id: 'ORD-2024-002',
    orderNumber: '#1002',
    status: 'delivered',
    createdAt: new Date('2024-03-10T10:00:00'),
    scheduledDeliveryDate: new Date('2024-03-10T14:00:00'),
    actualDeliveryDate: new Date('2024-03-10T13:55:00'),
    items: [
      { id: '1', name: 'Coffee Beans (1kg)', quantity: 1, price: 14.99 },
      { id: '2', name: 'Almond Milk (1L)', quantity: 2, price: 6.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    totalPrice: 28.97,
    rating: {
      driverRating: 4,
      experienceRating: 4,
      feedback: 'Good, but slightly late',
      createdAt: new Date('2024-03-10T14:30:00'),
    },
  },
  {
    id: 'ORD-2024-003',
    orderNumber: '#1003',
    status: 'delivered',
    createdAt: new Date('2024-03-09T16:00:00'),
    scheduledDeliveryDate: new Date('2024-03-09T19:00:00'),
    actualDeliveryDate: new Date('2024-03-09T19:12:00'),
    items: [
      { id: '1', name: 'Greek Yogurt (500g)', quantity: 3, price: 4.99 },
      { id: '2', name: 'Blueberries (400g)', quantity: 1, price: 8.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    totalPrice: 23.96,
    rating: {
      driverRating: 5,
      experienceRating: 5,
      feedback: 'Perfect condition, excellent service',
      createdAt: new Date('2024-03-09T19:45:00'),
    },
  },
  {
    id: 'ORD-2024-004',
    orderNumber: '#1004',
    status: 'delivered',
    createdAt: new Date('2024-03-08T11:30:00'),
    scheduledDeliveryDate: new Date('2024-03-08T15:30:00'),
    actualDeliveryDate: new Date('2024-03-08T15:28:00'),
    items: [
      { id: '1', name: 'Spinach (500g)', quantity: 2, price: 3.99 },
      { id: '2', name: 'Tomatoes (1kg)', quantity: 1, price: 5.49 },
      { id: '3', name: 'Bell Peppers (3 pack)', quantity: 1, price: 6.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    totalPrice: 26.46,
    rating: {
      driverRating: 4,
      experienceRating: 4,
      feedback: 'Good delivery',
      createdAt: new Date('2024-03-08T16:00:00'),
    },
  },
];

interface Filter {
  dateRange: 'all' | '7days' | '30days' | '90days';
  status: 'all' | 'delivered' | 'cancelled';
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [filters, setFilters] = useState<Filter>({ dateRange: 'all', status: 'all' });
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    // Filter deliveries based on selected filters
    let filtered = mockDeliveries;

    // Date range filter
    if (filters.dateRange !== 'all') {
      const daysAgo = filters.dateRange === '7days' ? 7 : filters.dateRange === '30days' ? 30 : 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      filtered = filtered.filter((d) => d.createdAt >= cutoffDate);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((d) => d.status === filters.status);
    }

    setDeliveries(filtered);
  }, [filters]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-wl-success-bg text-wl-success-600 border-wl-success-500';
      case 'cancelled':
        return 'bg-wl-danger-bg text-wl-danger-600 border-wl-danger-500';
      default:
        return 'bg-wl-neutral-700 text-wl-text-secondary border-wl-neutral-600';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (deliveries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className={cn(
          'rounded-lg border border-wl-border-subtle',
          'bg-wl-bg-surface p-12 text-center'
        )}>
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-semibold text-wl-text-primary mb-2">
            No deliveries found
          </h2>
          <p className="text-wl-text-secondary mb-6">
            Try adjusting your filters or place a new order
          </p>
          <Link
            href="/orders"
            className={cn(
              'inline-block px-4 py-2 rounded-md',
              'bg-wl-primary-500 text-white font-medium',
              'hover:bg-wl-primary-600 transition-colors'
            )}
          >
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-wl-text-primary">Delivery History</h1>
          <p className="text-wl-text-secondary mt-2">
            {deliveries.length} deliveries found
          </p>
        </div>

        {/* Filter Button */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md',
              'border border-wl-border-subtle bg-wl-bg-surface',
              'text-wl-text-primary font-medium',
              'hover:bg-wl-bg-elevated transition-colors'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {/* Filter Menu */}
          {showFilterMenu && (
            <div className={cn(
              'absolute right-0 top-full mt-2 z-20',
              'rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface shadow-lg p-4 w-48 space-y-4'
            )}>
              {/* Date Range */}
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 block">
                  Date Range
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: e.target.value as Filter['dateRange'],
                    }))
                  }
                  className={cn(
                    'w-full px-3 py-2 rounded-md',
                    'border border-wl-border-subtle',
                    'bg-wl-bg-elevated text-wl-text-primary',
                    'text-sm focus:outline-none focus:border-wl-primary-500'
                  )}
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase mb-2 block">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value as Filter['status'],
                    }))
                  }
                  className={cn(
                    'w-full px-3 py-2 rounded-md',
                    'border border-wl-border-subtle',
                    'bg-wl-bg-elevated text-wl-text-primary',
                    'text-sm focus:outline-none focus:border-wl-primary-500'
                  )}
                >
                  <option value="all">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setFilters({ dateRange: 'all', status: 'all' });
                  setShowFilterMenu(false);
                }}
                className={cn(
                  'w-full py-2 rounded-md text-sm',
                  'text-wl-text-secondary hover:text-wl-text-primary',
                  'transition-colors'
                )}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        {deliveries.map((delivery) => (
          <Link
            key={delivery.id}
            href={`/orders/${delivery.id}`}
          >
            <div className={cn(
              'rounded-lg border border-wl-border-subtle',
              'bg-wl-bg-surface p-6',
              'hover:border-wl-primary-500 hover:bg-wl-bg-elevated',
              'transition-all cursor-pointer group'
            )}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Date and Order Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-wl-text-secondary">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">
                      {delivery.createdAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-wl-text-secondary mb-1">Order</p>
                    <p className="text-lg font-semibold text-wl-text-primary group-hover:text-wl-primary-500 transition-colors">
                      {delivery.orderNumber}
                    </p>
                  </div>
                  <div className={cn(
                    'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                    'border',
                    getStatusBadgeColor(delivery.status)
                  )}>
                    {getStatusLabel(delivery.status)}
                  </div>
                </div>

                {/* Center: Items Summary */}
                <div className="space-y-2">
                  <p className="text-sm text-wl-text-secondary font-medium">Items</p>
                  <div className="space-y-1">
                    {delivery.items.slice(0, 2).map((item) => (
                      <p key={item.id} className="text-sm text-wl-text-primary">
                        {item.quantity}x {item.name}
                      </p>
                    ))}
                    {delivery.items.length > 2 && (
                      <p className="text-sm text-wl-text-tertiary">
                        +{delivery.items.length - 2} more
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Rating and Price */}
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-sm text-wl-text-secondary font-medium mb-2">Rating</p>
                    {delivery.rating ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'w-4 h-4',
                                i < Math.round(delivery.rating!.driverRating)
                                  ? 'fill-wl-warning-500 text-wl-warning-500'
                                  : 'text-wl-neutral-700'
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-wl-text-primary">
                          {delivery.rating.driverRating.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-wl-text-tertiary">Not rated</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-wl-text-secondary mb-1">Total</p>
                    <p className="text-2xl font-bold text-wl-text-primary">
                      ${delivery.totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className={cn(
                'mt-6 pt-6 border-t border-wl-border-subtle',
                'flex items-start gap-3'
              )}>
                <MapPin className="w-4 h-4 text-wl-text-secondary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-wl-text-secondary">
                  {delivery.deliveryAddress.street}, {delivery.deliveryAddress.city},{' '}
                  {delivery.deliveryAddress.state} {delivery.deliveryAddress.zipCode}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Load More Button */}
      <div className="text-center pt-6">
        <button
          className={cn(
            'px-6 py-3 rounded-md',
            'border border-wl-border-subtle',
            'text-wl-text-primary font-medium',
            'hover:bg-wl-bg-elevated transition-colors'
          )}
        >
          Load More
        </button>
      </div>
    </div>
  );
}
