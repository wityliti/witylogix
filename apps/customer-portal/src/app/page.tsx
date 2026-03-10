'use client';

import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '@/components/order-card';
import type { Order } from '@/types';

// Mock data for upcoming deliveries
const upcomingDeliveries: Order[] = [
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
    scheduledDeliveryDate: addDays(new Date(), 1),
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
];

// Mock data for recent orders
const recentOrders: Order[] = [
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
      feedback: 'Great delivery, very professional!',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    status: 'delivered',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    scheduledDeliveryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
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
];

export default function DashboardPage() {
  return (
    <div className={cn(
      'flex flex-col gap-8 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8'
    )}>
      {/* Welcome Section */}
      <section className={cn(
        'bg-gradient-to-r from-wl-primary-600 to-wl-primary-700',
        'rounded-lg p-6 sm:p-8',
        'text-white'
      )}>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">
          Welcome back, John!
        </h1>
        <p className="text-wl-primary-100 text-lg">
          You have {upcomingDeliveries.length} active deliveries
        </p>
      </section>

      {/* Quick Stats */}
      <div className={cn(
        'grid grid-cols-1 sm:grid-cols-3 gap-4'
      )}>
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'p-6'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-wl-text-tertiary">Active Orders</p>
              <p className="text-3xl font-bold text-wl-text-primary mt-2">
                {upcomingDeliveries.length}
              </p>
            </div>
            <TrendingUp size={28} className="text-wl-primary-500" />
          </div>
        </div>

        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'p-6'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-wl-text-tertiary">Delivered</p>
              <p className="text-3xl font-bold text-wl-text-primary mt-2">
                {recentOrders.filter(o => o.status === 'delivered').length}
              </p>
            </div>
            <div className={cn(
              'w-10 h-10 rounded-full',
              'bg-wl-success-500/20 flex items-center justify-center'
            )}>
              <span className="text-wl-success-500 font-bold">✓</span>
            </div>
          </div>
        </div>

        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg',
          'p-6'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-wl-text-tertiary">Total Spent</p>
              <p className="text-3xl font-bold text-wl-text-primary mt-2">
                ${(upcomingDeliveries.reduce((sum, o) => sum + o.totalPrice, 0) +
                  recentOrders.reduce((sum, o) => sum + o.totalPrice, 0)).toFixed(2)}
              </p>
            </div>
            <div className={cn(
              'w-10 h-10 rounded-full',
              'bg-wl-info-bg flex items-center justify-center'
            )}>
              <span className="text-wl-info-500 text-lg">$</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Deliveries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-wl-text-primary">
            Upcoming Deliveries
          </h2>
          <Link
            href="/orders"
            className={cn(
              'text-sm font-medium text-wl-primary-400',
              'hover:text-wl-primary-300 transition-colors',
              'flex items-center gap-1'
            )}
          >
            View all
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className={cn(
          'grid grid-cols-1 lg:grid-cols-2 gap-4'
        )}>
          {upcomingDeliveries.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>

      {/* Recent Orders */}
      <section>
        <h2 className="text-2xl font-bold text-wl-text-primary mb-4">
          Recent Orders
        </h2>

        <div className={cn(
          'grid grid-cols-1 lg:grid-cols-2 gap-4'
        )}>
          {recentOrders.slice(0, 2).map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    </div>
  );
}
