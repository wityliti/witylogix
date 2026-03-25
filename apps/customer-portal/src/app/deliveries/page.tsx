'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Filter, MapPin, Star } from 'lucide-react';
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

interface DeliveryFilter {
  dateRange: 'all' | '7days' | '30days' | '90days';
  status: 'all' | 'delivered' | 'cancelled';
}

const getStatusAccentClass = (status: string): string => {
  switch (status) {
    case 'delivered':
      return 'card-accent-delivered';
    case 'cancelled':
      return 'card-accent-cancelled';
    default:
      return '';
  }
};

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'delivered':
      return 'status-delivered';
    case 'cancelled':
      return 'status-cancelled';
    default:
      return '';
  }
};

const getStatusLabel = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [filters, setFilters] = useState<DeliveryFilter>({ dateRange: 'all', status: 'all' });
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

  if (deliveries.length === 0) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Delivery History</h1>
          <p className="page-subtitle">Your past deliveries</p>
        </div>

        {/* Filter row even on empty state */}
        <div className="flex justify-end relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="btn btn-secondary"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {showFilterMenu && (
            <FilterDropdown
              filters={filters}
              onFilterChange={setFilters}
              onClose={() => setShowFilterMenu(false)}
            />
          )}
        </div>

        <div className="section-card flex flex-col items-center py-12 text-center">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-2">
            No deliveries found
          </h2>
          <p className="text-sm text-wl-text-secondary mb-6 max-w-xs">
            Try adjusting your filters or place a new order
          </p>
          <Link href="/orders" className="btn btn-primary">
            View Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="page-header">
          <h1 className="page-title">Delivery History</h1>
          <p className="page-subtitle">
            <span className="mono">{deliveries.length}</span> deliveries found
          </p>
        </div>

        {/* Filter Button */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="btn btn-secondary"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          {showFilterMenu && (
            <FilterDropdown
              filters={filters}
              onFilterChange={setFilters}
              onClose={() => setShowFilterMenu(false)}
            />
          )}
        </div>
      </div>

      {/* Deliveries List */}
      <div className="flex flex-col gap-3">
        {deliveries.map((delivery, index) => (
          <Link
            key={delivery.id}
            href={`/orders/${delivery.id}`}
          >
            <div
              className={cn(
                'card-accent group cursor-pointer',
                'animate-fade-in',
                `stagger-${Math.min(index + 1, 6)}`,
                getStatusAccentClass(delivery.status)
              )}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Left: Date + Order */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-wl-text-tertiary">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-xs mono">
                      {delivery.createdAt.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-base font-semibold text-wl-text-primary group-hover:text-wl-primary-400 transition-colors">
                    Order {delivery.orderNumber}
                  </p>
                  <div className={cn('status-badge', getStatusBadgeClass(delivery.status))}>
                    <span className="status-badge-dot" />
                    {getStatusLabel(delivery.status)}
                  </div>
                </div>

                {/* Center: Items */}
                <div className="flex flex-col gap-1">
                  <p className="label mb-1">Items</p>
                  {delivery.items.slice(0, 2).map((item) => (
                    <p key={item.id} className="text-sm text-wl-text-primary">
                      <span className="mono">{item.quantity}x</span> {item.name}
                    </p>
                  ))}
                  {delivery.items.length > 2 && (
                    <p className="text-xs text-wl-text-tertiary">
                      +{delivery.items.length - 2} more
                    </p>
                  )}
                </div>

                {/* Right: Rating + Price */}
                <div className="flex flex-col justify-between">
                  <div>
                    {delivery.rating ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'w-3.5 h-3.5',
                                i < Math.round(delivery.rating!.driverRating)
                                  ? 'fill-wl-warning-500 text-wl-warning-500'
                                  : 'text-wl-neutral-700'
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium text-wl-text-secondary mono">
                          {delivery.rating.driverRating.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-wl-text-tertiary">Not rated</p>
                    )}
                  </div>

                  <div className="text-right mt-3 md:mt-0">
                    <p className="text-xl font-bold text-wl-text-primary mono">
                      ${delivery.totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address Row */}
              <div className="mt-4 pt-4 border-t border-wl-border-subtle flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-wl-text-tertiary flex-shrink-0" />
                <span className="text-xs text-wl-text-tertiary">
                  {delivery.deliveryAddress.street}, {delivery.deliveryAddress.city},{' '}
                  {delivery.deliveryAddress.state} {delivery.deliveryAddress.zipCode}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Load More */}
      <div className="flex justify-center pt-2">
        <button className="btn btn-secondary">
          Load More
        </button>
      </div>
    </div>
  );
}

/* ─── Filter Dropdown ────────────────────────── */

function FilterDropdown({
  filters,
  onFilterChange,
  onClose,
}: {
  filters: DeliveryFilter;
  onFilterChange: (filters: DeliveryFilter) => void;
  onClose: () => void;
}) {
  return (
    <div className="section-card absolute right-0 top-full mt-2 z-20 w-52 shadow-lg animate-fade-in">
      <div className="flex flex-col gap-4">
        {/* Date Range */}
        <div>
          <p className="label mb-2">Date Range</p>
          <select
            value={filters.dateRange}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                dateRange: e.target.value as DeliveryFilter['dateRange'],
              })
            }
            className="input"
          >
            <option value="all">All Time</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <p className="label mb-2">Status</p>
          <select
            value={filters.status}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                status: e.target.value as DeliveryFilter['status'],
              })
            }
            className="input"
          >
            <option value="all">All Status</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => {
            onFilterChange({ dateRange: 'all', status: 'all' });
            onClose();
          }}
          className="btn btn-ghost w-full"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
