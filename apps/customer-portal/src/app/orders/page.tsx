'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '@/components/order-card';
import type { Order, OrderStatus } from '@/types';

// Mock orders data
const allOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    status: 'out-for-delivery',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(),
    items: [
      { id: '1', name: 'Premium Headphones', quantity: 1, price: 149.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    totalPrice: 149.99,
    estimatedDelivery: 'Today, 2-4 PM',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    status: 'confirmed',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    items: [
      { id: '1', name: 'Wireless Charger', quantity: 2, price: 29.99 },
      { id: '2', name: 'USB-C Cable', quantity: 3, price: 9.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    totalPrice: 119.96,
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    status: 'delivered',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    items: [
      { id: '1', name: 'Phone Case', quantity: 1, price: 19.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    totalPrice: 19.99,
    rating: {
      driverRating: 5,
      experienceRating: 5,
      feedback: 'Great delivery!',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    status: 'pending',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    items: [
      { id: '1', name: 'Laptop Stand', quantity: 1, price: 49.99 },
      { id: '2', name: 'Monitor Arm', quantity: 1, price: 79.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    totalPrice: 129.98,
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    status: 'cancelled',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    items: [
      { id: '1', name: 'Cancelled Item', quantity: 1, price: 99.99 },
    ],
    deliveryAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    totalPrice: 99.99,
  },
];

const statusFilters: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'out-for-delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const filteredOrders = useMemo(() => {
    let filtered = allOrders;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.deliveryAddress.street.toLowerCase().includes(query) ||
        order.items.some(item => item.name.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (sortBy === 'newest') {
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      filtered = filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return filtered;
  }, [searchQuery, statusFilter, sortBy]);

  return (
    <div className={cn(
      'flex flex-col gap-6 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8'
    )}>
      {/* Header */}
      <section>
        <h1 className="text-3xl sm:text-4xl font-bold text-wl-text-primary mb-2">
          Orders
        </h1>
        <p className="text-wl-text-secondary">
          Manage and track all your deliveries
        </p>
      </section>

      {/* Filters and Search */}
      <section className={cn(
        'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
        'p-4 sm:p-6'
      )}>
        {/* Search Bar */}
        <div className="mb-6">
          <div className={cn(
            'relative flex items-center',
            'bg-wl-bg-root border border-wl-border-subtle rounded-lg',
            'px-4 py-3'
          )}>
            <Search size={18} className="text-wl-text-tertiary mr-3" />
            <input
              type="text"
              placeholder="Search by order number, address, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'flex-1 bg-transparent outline-none',
                'text-wl-text-primary placeholder-wl-text-tertiary'
              )}
            />
          </div>
        </div>

        {/* Filters */}
        <div className={cn(
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2'
        )}>
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as OrderStatus | 'all')}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                'transition-colors duration-fast',
                statusFilter === filter.value
                  ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                  : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className={cn(
          'mt-6 pt-6 border-t border-wl-border-subtle',
          'flex items-center justify-between'
        )}>
          <div className="flex items-center gap-2 text-sm text-wl-text-secondary">
            <Filter size={16} />
            Sort:
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className={cn(
              'bg-wl-bg-elevated border border-wl-border-subtle rounded-md',
              'px-3 py-2 text-sm',
              'text-wl-text-primary',
              'cursor-pointer'
            )}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </section>

      {/* Results Info */}
      <p className="text-sm text-wl-text-secondary">
        Showing {filteredOrders.length} of {allOrders.length} orders
      </p>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className={cn(
          'grid grid-cols-1 lg:grid-cols-2 gap-4'
        )}>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'p-12 text-center'
        )}>
          <p className="text-wl-text-secondary text-lg">
            No orders found matching your criteria
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className={cn(
              'mt-4 text-wl-primary-400 hover:text-wl-primary-300',
              'text-sm font-medium transition-colors'
            )}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
