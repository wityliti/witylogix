'use client';

import Link from 'next/link';
import { addDays } from 'date-fns';
import { ArrowRight, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderCard } from '@/components/order-card';
import type { Order } from '@/types';

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
  const totalSpent = (
    upcomingDeliveries.reduce((sum, o) => sum + o.totalPrice, 0) +
    recentOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  ).toFixed(2);

  return (
    <div className="page-container">
      {/* Greeting — clean, no garish banner */}
      <div className="page-header animate-fade-in">
        <p className="text-wl-text-secondary text-sm">Good afternoon</p>
        <h1 className="page-title">Welcome back, John</h1>
      </div>

      {/* Quick stats — tight, numbers-first */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in stagger-1">
        <div className="stat-card">
          <p className="label">Active</p>
          <p className="value mt-1">{upcomingDeliveries.length}</p>
        </div>
        <div className="stat-card">
          <p className="label">Delivered</p>
          <p className="value mt-1">{recentOrders.filter(o => o.status === 'delivered').length}</p>
        </div>
        <div className="stat-card">
          <p className="label">Total Spent</p>
          <p className="value mt-1 text-xl sm:text-2xl">${totalSpent}</p>
        </div>
      </div>

      {/* Active deliveries — these get prominence */}
      <section className="animate-fade-in stagger-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-wl-primary-500" />
            <h2 className="text-base font-semibold text-wl-text-primary">
              Active Deliveries
            </h2>
          </div>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-xs font-medium text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {upcomingDeliveries.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>

      {/* Recent orders — receded, less visual weight */}
      <section className="animate-fade-in stagger-3">
        <div className="flex items-center gap-2 mb-3">
          <Package size={16} className="text-wl-text-tertiary" />
          <h2 className="text-base font-semibold text-wl-text-primary">
            Recent Orders
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {recentOrders.slice(0, 2).map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    </div>
  );
}
