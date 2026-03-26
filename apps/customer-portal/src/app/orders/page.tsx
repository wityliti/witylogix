'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, SlidersHorizontal } from 'lucide-react';
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
    <div className="page-container">
      {/* Header */}
      <header className="page-header animate-fade-in">
        <h1 className="page-title">Orders</h1>
        <p className="page-subtitle">Manage and track all your deliveries</p>
      </header>

      {/* Search & Filters */}
      <div className="section-card animate-fade-in stagger-1">
        {/* Search Bar */}
        <div className="relative mb-5">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by order number, address, or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as OrderStatus | 'all')}
              className={cn(
                'btn',
                statusFilter === filter.value
                  ? 'btn-primary'
                  : 'btn-ghost'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="mt-5 pt-5 border-t border-wl-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-wl-text-tertiary">
            <SlidersHorizontal size={14} />
            <span>Sort by</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="input w-auto"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-xs text-wl-text-tertiary animate-fade-in stagger-2">
        Showing <span className="mono">{filteredOrders.length}</span> of{' '}
        <span className="mono">{allOrders.length}</span> orders
      </p>

      {/* Orders Grid */}
      {filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((order, i) => (
            <div
              key={order.id}
              className={cn('animate-fade-in', `stagger-${Math.min(i + 1, 6)}`)}
            >
              <OrderCard order={order} />
            </div>
          ))}
        </div>
      ) : (
        <div className="section-card text-center py-16 animate-fade-in">
          <p className="text-wl-text-secondary mb-1">
            No orders found matching your criteria
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="btn btn-ghost mt-3"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
