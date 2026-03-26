'use client';

import Link from 'next/link';
import { addDays, format } from 'date-fns';
import {
  ArrowRight,
  Clock,
  HelpCircle,
  MapPin,
  Package,
  PackageCheck,
  Truck,
} from 'lucide-react';
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

const allOrders = [...upcomingDeliveries, ...recentOrders];

const statCards = [
  {
    label: 'Total Orders',
    value: allOrders.length,
    icon: Package,
    color: 'text-wl-primary-400',
  },
  {
    label: 'Active Deliveries',
    value: allOrders.filter((o) => o.status === 'out-for-delivery').length,
    icon: Truck,
    color: 'text-wl-info-500',
  },
  {
    label: 'Pending',
    value: allOrders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed',
    ).length,
    icon: Clock,
    color: 'text-wl-warning-500',
  },
  {
    label: 'Delivered',
    value: allOrders.filter((o) => o.status === 'delivered').length,
    icon: PackageCheck,
    color: 'text-wl-success-500',
  },
] as const;

const quickActions = [
  {
    label: 'Track a Delivery',
    href: '/track',
    icon: MapPin,
  },
  {
    label: 'View All Orders',
    href: '/orders',
    icon: Package,
  },
  {
    label: 'Get Support',
    href: '/support',
    icon: HelpCircle,
  },
] as const;

export default function DashboardPage() {
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="page-container">
      {/* Welcome greeting */}
      <div className="page-header animate-fade-in">
        <p className="text-wl-text-tertiary text-sm">{today}</p>
        <h1 className="page-title">Welcome back, John</h1>
        <p className="page-subtitle">
          Here is an overview of your deliveries and orders.
        </p>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in stagger-1">
        {statCards.map((card) => (
          <div key={card.label} className="section-card flex flex-col items-center gap-2 py-5">
            <card.icon size={24} className={card.color} />
            <p className="text-3xl font-bold text-wl-text-primary">
              {card.value}
            </p>
            <p className="text-sm text-wl-text-secondary">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions row */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in stagger-1">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'section-card flex-1 flex items-center gap-3 px-4 py-3',
              'hover:border-wl-primary-500/40 transition-colors',
            )}
          >
            <action.icon size={18} className="text-wl-primary-400 shrink-0" />
            <span className="text-sm font-medium text-wl-text-primary">
              {action.label}
            </span>
            <ArrowRight
              size={14}
              className="ml-auto text-wl-text-tertiary"
            />
          </Link>
        ))}
      </div>

      {/* Upcoming deliveries */}
      <section className="animate-fade-in stagger-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-wl-primary-500" />
            <h2 className="text-base font-semibold text-wl-text-primary">
              Upcoming Deliveries
            </h2>
            <span className="status-badge text-xs px-2 py-0.5 rounded-full bg-wl-primary-500/10 text-wl-primary-400">
              {upcomingDeliveries.length}
            </span>
          </div>
          <Link
            href="/deliveries"
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

      {/* Recent orders */}
      <section className="animate-fade-in stagger-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-wl-text-tertiary" />
            <h2 className="text-base font-semibold text-wl-text-primary">
              Recent Orders
            </h2>
            <span className="status-badge text-xs px-2 py-0.5 rounded-full bg-wl-bg-elevated text-wl-text-secondary">
              {recentOrders.length}
            </span>
          </div>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-xs font-medium text-wl-text-tertiary hover:text-wl-text-secondary transition-colors"
          >
            View all orders
            <ArrowRight size={12} />
          </Link>
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
