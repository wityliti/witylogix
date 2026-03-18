'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDrivers, Driver as ApiDriver, DriverStatus as ApiDriverStatus } from '@/hooks/use-drivers';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Enhanced fleet management with detail panel
   ═══════════════════════════════════════════════════════════ */

type SortOption = 'name' | 'rating' | 'deliveries' | 'ontime';

const statusVariant = (s: string): 'success' | 'warning' | 'info' | 'primary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'default'> = {
    online: 'success',
    on_delivery: 'info',
    on_break: 'warning',
    offline: 'default',
  };
  return map[s.toLowerCase()] ?? 'default';
};

const statusColor = (status: string): string => {
  const colors: Record<string, string> = {
    online: '#10b981',
    on_delivery: '#3b82f6',
    on_break: '#f59e0b',
    offline: '#6b7280',
  };
  return colors[status.toLowerCase()] ?? '#6b7280';
};

// Mock drivers array - for development fallback when API is unavailable
const DRIVERS: ApiDriver[] = [
  {
    id: "drv-1",
    name: "Carlos Martinez",
    email: "carlos@witylogix.io",
    phone: "+1 555-0101",
    status: "ON_DELIVERY",
    vehicleType: "VAN",
    vehiclePlate: "WTY-4501",
    maxCapacity: 20,
    activeOrders: 4,
    completedToday: 7,
    avgRating: 4.8,
    totalDeliveries: 847,
    onTimePercentage: 94,
    currentLocation: "Downtown Core",
    lastActive: "now",
    hireDate: "2021-03-15",
    licenseNumber: "DL-2847-CA",
    documents: [
      { id: "doc-1", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-05-12", expiryDate: "2028-05-12", number: "DL-2847-CA" },
      { id: "doc-2", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-01-10", expiryDate: "2026-01-10", number: "INS-8934" },
      { id: "doc-3", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-03-01", expiryDate: "2026-03-01", number: "BG-5621" },
    ],
    zones: ["Downtown Core", "Midtown East"],
    recentDeliveries: ["ORD-2847", "ORD-2846", "ORD-2845"],
  },
  {
    id: "drv-2",
    name: "Sofia Lindberg",
    email: "sofia@witylogix.io",
    phone: "+1 555-0102",
    status: "ON_DELIVERY",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2201",
    maxCapacity: 10,
    activeOrders: 3,
    completedToday: 5,
    avgRating: 4.9,
    totalDeliveries: 923,
    onTimePercentage: 97,
    currentLocation: "Midtown East",
    lastActive: "now",
    hireDate: "2020-07-22",
    licenseNumber: "DL-3921-ON",
    documents: [
      { id: "doc-4", type: "LICENSE", status: "VERIFIED", issuedDate: "2019-11-08", expiryDate: "2027-11-08", number: "DL-3921-ON" },
      { id: "doc-5", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-02-14", expiryDate: "2026-02-14", number: "INS-7849" },
      { id: "doc-6", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2020-07-15", expiryDate: "2025-07-15", number: "BG-4832" },
    ],
    zones: ["Midtown East", "West Side"],
    recentDeliveries: ["ORD-2844", "ORD-2843", "ORD-2842"],
  },
  {
    id: "drv-3",
    name: "Ahmed Khalil",
    email: "ahmed@witylogix.io",
    phone: "+1 555-0103",
    status: "ACTIVE",
    vehicleType: "MOTORCYCLE",
    vehiclePlate: "WTY-1101",
    maxCapacity: 5,
    activeOrders: 0,
    completedToday: 9,
    avgRating: 4.7,
    totalDeliveries: 756,
    onTimePercentage: 92,
    currentLocation: "West Side",
    lastActive: "2m ago",
    hireDate: "2022-01-10",
    licenseNumber: "DL-5847-BC",
    documents: [
      { id: "doc-7", type: "LICENSE", status: "VERIFIED", issuedDate: "2021-03-20", expiryDate: "2026-03-20", number: "DL-5847-BC" },
      { id: "doc-8", type: "INSURANCE", status: "PENDING", issuedDate: "2023-03-01", expiryDate: "2026-03-01", number: "INS-6521" },
      { id: "doc-9", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2022-01-05", expiryDate: "2027-01-05", number: "BG-7834" },
    ],
    zones: ["West Side", "South District"],
    recentDeliveries: ["ORD-2841", "ORD-2840", "ORD-2839"],
  },
  {
    id: "drv-4",
    name: "Lisa Thompson",
    email: "lisa@witylogix.io",
    phone: "+1 555-0104",
    status: "ON_BREAK",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2202",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 6,
    avgRating: 4.6,
    totalDeliveries: 634,
    onTimePercentage: 89,
    currentLocation: "South District",
    lastActive: "15m ago",
    hireDate: "2021-09-05",
    licenseNumber: "DL-4156-AB",
    documents: [
      { id: "doc-10", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-08-12", expiryDate: "2025-08-12", number: "DL-4156-AB" },
      { id: "doc-11", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-04-10", expiryDate: "2026-04-10", number: "INS-5432" },
      { id: "doc-12", type: "BACKGROUND", status: "EXPIRED", issuedDate: "2021-09-01", expiryDate: "2024-09-01", number: "BG-3849" },
    ],
    zones: ["South District", "Harbor Area"],
    recentDeliveries: ["ORD-2838", "ORD-2837"],
  },
  {
    id: "drv-5",
    name: "Marcus Johnson",
    email: "marcus@witylogix.io",
    phone: "+1 555-0105",
    status: "ON_DELIVERY",
    vehicleType: "VAN",
    vehiclePlate: "WTY-4502",
    maxCapacity: 20,
    activeOrders: 5,
    completedToday: 3,
    avgRating: 4.5,
    totalDeliveries: 721,
    onTimePercentage: 88,
    currentLocation: "Harbor Area",
    lastActive: "now",
    hireDate: "2022-05-18",
    licenseNumber: "DL-6234-SK",
    documents: [
      { id: "doc-13", type: "LICENSE", status: "VERIFIED", issuedDate: "2021-06-15", expiryDate: "2029-06-15", number: "DL-6234-SK" },
      { id: "doc-14", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-05-20", expiryDate: "2026-05-20", number: "INS-4891" },
      { id: "doc-15", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2022-05-10", expiryDate: "2027-05-10", number: "BG-2456" },
    ],
    zones: ["Harbor Area", "Industrial Zone"],
    recentDeliveries: ["ORD-2836", "ORD-2835", "ORD-2834"],
  },
  {
    id: "drv-6",
    name: "Yuki Tanaka",
    email: "yuki@witylogix.io",
    phone: "+1 555-0106",
    status: "OFFLINE",
    vehicleType: "BICYCLE",
    vehiclePlate: "—",
    maxCapacity: 3,
    activeOrders: 0,
    completedToday: 0,
    avgRating: 4.3,
    totalDeliveries: 423,
    onTimePercentage: 85,
    currentLocation: "—",
    lastActive: "3h ago",
    hireDate: "2023-01-12",
    licenseNumber: "DL-7521-MB",
    documents: [
      { id: "doc-16", type: "LICENSE", status: "VERIFIED", issuedDate: "2022-02-10", expiryDate: "2027-02-10", number: "DL-7521-MB" },
      { id: "doc-17", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-06-01", expiryDate: "2026-06-01", number: "INS-3456" },
      { id: "doc-18", type: "BACKGROUND", status: "PENDING", issuedDate: "2023-01-05", expiryDate: "2028-01-05", number: "BG-1298" },
    ],
    zones: ["Downtown Core"],
    recentDeliveries: [],
  },
  {
    id: "drv-7",
    name: "Priya Patel",
    email: "priya@witylogix.io",
    phone: "+1 555-0107",
    status: "ACTIVE",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2203",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 8,
    avgRating: 4.9,
    totalDeliveries: 891,
    onTimePercentage: 96,
    currentLocation: "Downtown Core",
    lastActive: "1m ago",
    hireDate: "2020-11-08",
    licenseNumber: "DL-8934-NL",
    documents: [
      { id: "doc-19", type: "LICENSE", status: "VERIFIED", issuedDate: "2019-12-20", expiryDate: "2027-12-20", number: "DL-8934-NL" },
      { id: "doc-20", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-07-15", expiryDate: "2026-07-15", number: "INS-2847" },
      { id: "doc-21", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2020-11-01", expiryDate: "2025-11-01", number: "BG-5634" },
    ],
    zones: ["Downtown Core", "Midtown East", "West Side"],
    recentDeliveries: ["ORD-2833", "ORD-2832", "ORD-2831"],
  },
  {
    id: "drv-8",
    name: "Diego Fernandez",
    email: "diego@witylogix.io",
    phone: "+1 555-0108",
    status: "ON_DELIVERY",
    vehicleType: "TRUCK",
    vehiclePlate: "WTY-6001",
    maxCapacity: 50,
    activeOrders: 8,
    completedToday: 2,
    avgRating: 4.4,
    totalDeliveries: 534,
    onTimePercentage: 87,
    currentLocation: "Industrial Zone",
    lastActive: "now",
    hireDate: "2021-04-20",
    licenseNumber: "DL-1298-QC",
    documents: [
      { id: "doc-22", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-05-15", expiryDate: "2028-05-15", number: "DL-1298-QC" },
      { id: "doc-23", type: "INSURANCE", status: "EXPIRED", issuedDate: "2022-08-20", expiryDate: "2025-08-20", number: "INS-1567" },
      { id: "doc-24", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-04-10", expiryDate: "2026-04-10", number: "BG-7421" },
    ],
    zones: ["Industrial Zone", "Harbor Area"],
    recentDeliveries: ["ORD-2830", "ORD-2829"],
  },
  {
    id: "drv-9",
    name: "Emma Watson",
    email: "emma@witylogix.io",
    phone: "+1 555-0109",
    status: "ACTIVE",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2204",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 11,
    avgRating: 4.8,
    totalDeliveries: 789,
    onTimePercentage: 95,
    currentLocation: "Midtown East",
    lastActive: "5m ago",
    hireDate: "2021-08-03",
    licenseNumber: "DL-5678-PE",
    documents: [
      { id: "doc-25", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-09-10", expiryDate: "2028-09-10", number: "DL-5678-PE" },
      { id: "doc-26", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-08-25", expiryDate: "2026-08-25", number: "INS-8765" },
      { id: "doc-27", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-08-01", expiryDate: "2026-08-01", number: "BG-9123" },
    ],
    zones: ["Midtown East", "West Side"],
    recentDeliveries: ["ORD-2828", "ORD-2827", "ORD-2826"],
  },
];

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const isFull = i < fullStars;
        const isHalf = i === fullStars && hasHalf;
        return (
          <span
            key={i}
            className="leading-none"
            style={{
              fontSize: size,
              opacity: isFull || isHalf ? 1 : 0.3,
            }}
          >
            {isFull ? "★" : isHalf ? "✦" : "☆"}
          </span>
        );
      })}
      <span className="text-xs text-slate-400 ml-1">
        {rating.toFixed(1)}
      </span>
    </span>
  );
};

export default function DriversPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedDriver, setSelectedDriver] = useState<ApiDriver | null>(null);

  // Fetch drivers from API
  const { items: drivers, loading, error, refetch } = useDrivers({
    limit: 50,
    search: search || undefined,
    sort: 'name:asc',
  });

  // Filter drivers client-side
  const filtered = useMemo(() => {
    let result = drivers;

    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status.toLowerCase() === statusFilter.toLowerCase());
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'deliveries':
          return b.totalDeliveries - a.totalDeliveries;
        case 'ontime':
          return b.completionRate - a.completionRate;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [drivers, statusFilter, sortBy]);

  // Calculate stats from API data
  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter((d) => d.status.toLowerCase() !== 'offline').length;
    const completedToday = drivers.reduce((sum, d) => sum + (d.totalDeliveries || 0), 0);
    const avgRating =
      drivers.length > 0 ? (drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length).toFixed(1) : '0';
    return { total, active, completedToday, avgRating };
  }, [drivers]);

  return (
    <>
      <Header
        title="Driver Management"
        subtitle={`${stats.total} total · ${stats.active} active · ${stats.completedToday} deliveries today`}
        actions={<Button variant="primary" size="md">+ Add Driver</Button>}
      />

      <div className="p-6">
        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-lg">
            <p className="text-sm text-wl-danger-400 flex items-center justify-between">
              <span>Failed to load drivers</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-wl-danger-400">
                Retry
              </Button>
            </p>
          </div>
        )}

        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 auto-rows-max">
          <StatCard
            label="Total Drivers"
            value={stats.total}
            change={{ value: 2.5, label: 'growth' }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Today"
            value={stats.active}
            change={{ value: 5.0, label: 'vs average' }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Average Rating"
            value={stats.avgRating}
            change={{ value: 0.8, label: 'stable' }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Total Deliveries"
            value={stats.completedToday}
            change={{ value: 12.3, label: 'career' }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* ═══ Filters Row ═══ */}
        <div className="flex flex-col sm:flex-row gap-4 mb-5 items-start sm:items-center flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[300px] max-w-[400px]">
            <input
              type="text"
              placeholder="Search drivers by name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-md border border-wl-border-default bg-wl-bg-elevated text-wl-text-primary text-sm placeholder-wl-text-tertiary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'online', 'on_delivery', 'on_break', 'offline'] as const).map((s) => {
              const count =
                s === 'all' ? drivers.length : drivers.filter((d) => d.status.toLowerCase() === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                    statusFilter === s
                      ? 'bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500'
                      : 'border-wl-border-default bg-transparent text-wl-text-tertiary hover:border-wl-border-subtle'
                  )}
                >
                  {s === 'all' ? 'All' : s.replace(/_/g, ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Sort Row ═══ */}
        <div className="flex flex-col sm:flex-row gap-4 mb-5 items-start sm:items-center flex-wrap">
          <div className="ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 rounded-md border border-wl-border-default bg-wl-bg-elevated text-wl-text-primary text-sm focus:outline-none"
            >
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
              <option value="deliveries">Sort by Total Deliveries</option>
              <option value="ontime">Sort by Completion %</option>
            </select>
          </div>
        </div>

        {/* ═══ Drivers Grid + Detail Panel ═══ */}
        <div className={cn('grid gap-5', selectedDriver ? 'grid-cols-1 lg:grid-cols-[1fr_400px]' : 'grid-cols-1')}>
          {/* Driver Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-64 animate-pulse bg-wl-bg-overlay/50" />
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center py-8 text-wl-text-tertiary">
                No drivers found
              </div>
            ) : (
              filtered.map((driver, i) => (
                <Card
                  key={driver.id}
                  onClick={() => setSelectedDriver(selectedDriver?.id === driver.id ? null : driver)}
                  className={cn(
                    'relative overflow-hidden cursor-pointer transition-all opacity-0',
                    selectedDriver?.id === driver.id && 'border-wl-primary-500'
                  )}
                  style={{
                    animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  }}
                >
                  {/* Status indicator line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      backgroundColor: statusColor(driver.status),
                    }}
                  />

                  {/* Avatar & Header */}
                  <div className="flex gap-4 mb-3">
                    {/* Avatar Circle */}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-slate-50 flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      {driver.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                        style={{
                          backgroundColor: statusColor(driver.status),
                          borderColor: 'var(--wl-bg-elevated)',
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-wl-text-primary">{driver.name}</div>
                      <div className="text-xs text-wl-text-secondary mt-0.5">{driver.email}</div>
                      <Badge variant={statusVariant(driver.status)} dot className="mt-1">
                        {driver.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>

                  {/* Vehicle & Location */}
                  <div className="flex items-center gap-2 py-3 px-0 border-t border-b border-wl-border-subtle mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-wl-text-secondary">
                        {driver.vehicle.make} · {driver.vehicle.licensePlate}
                      </div>
                      {driver.currentLocation && (
                        <div className="text-xs text-wl-text-tertiary mt-0.5">
                          📍 {driver.currentLocation.latitude}, {driver.currentLocation.longitude}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Rating */}
                    <div className="p-2 bg-wl-bg-overlay rounded-md text-center">
                      <div className="text-xs text-wl-text-tertiary mb-1">Rating</div>
                      <div className="text-lg font-bold text-wl-warning-400 font-mono">{driver.rating.toFixed(1)}</div>
                    </div>

                    {/* Total Deliveries */}
                    <div className="p-2 bg-wl-bg-overlay rounded-md text-center">
                      <div className="text-xs text-wl-text-tertiary mb-1">Deliveries</div>
                      <div className="text-lg font-bold text-wl-info-400 font-mono">{driver.totalDeliveries}</div>
                    </div>

                    {/* Completion % */}
                    <div className="p-2 bg-wl-bg-overlay rounded-md text-center">
                      <div className="text-xs text-wl-text-tertiary mb-1">Completion %</div>
                      <div
                        className="text-lg font-bold font-mono"
                        style={{
                          color: driver.completionRate >= 90 ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {(driver.completionRate * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Status */}
                    <div className="p-2 bg-wl-bg-overlay rounded-md text-center">
                      <div className="text-xs text-wl-text-tertiary mb-1">Status</div>
                      <div className="text-sm font-semibold text-wl-primary-400">{driver.status}</div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Details
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Route
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Message
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Detail Panel */}
          {selectedDriver && (
            <Card
              className="wl-animate-in sticky overflow-y-auto"
              style={{
                top: 'calc(var(--wl-header-height) + 24px)',
                maxHeight: 'calc(100vh - var(--wl-header-height) - 48px)',
              }}
            >
              {/* Header with close button */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-wl-text-primary">Driver Profile</span>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="text-wl-text-tertiary cursor-pointer text-xl font-light hover:text-wl-text-secondary transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {/* Profile Header */}
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold text-slate-50 mx-auto mb-3"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    {selectedDriver.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
                  </div>
                  <div className="text-base font-bold text-wl-text-primary">{selectedDriver.name}</div>
                  <Badge variant={statusVariant(selectedDriver.status)} dot className="mt-2 justify-center">
                    {selectedDriver.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Contact Info */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Contact
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="text-xs text-wl-text-tertiary">Email</div>
                      <div className="text-sm text-wl-text-primary">{selectedDriver.email}</div>
                    </div>
                    <div>
                      <div className="text-xs text-wl-text-tertiary">Phone</div>
                      <div className="text-sm text-wl-text-primary font-mono">{selectedDriver.phone}</div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Vehicle & License Info */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
                    Vehicle & License
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="text-xs text-wl-text-tertiary">Vehicle</div>
                      <div className="text-sm text-wl-text-primary">
                        {selectedDriver.vehicle.make} {selectedDriver.vehicle.model}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-wl-text-tertiary">License Plate</div>
                      <div className="text-sm text-wl-text-primary font-mono">{selectedDriver.vehicle.licensePlate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-wl-text-tertiary">License #</div>
                      <div className="text-sm text-wl-text-primary font-mono">{selectedDriver.licenseNumber}</div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Performance Metrics */}
                <div>
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-3">
                    Performance
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-wl-bg-overlay rounded">
                      <div className="text-xs text-wl-text-tertiary mb-1">Rating</div>
                      <div className="text-lg font-bold text-wl-warning-400">{selectedDriver.rating.toFixed(1)}</div>
                    </div>
                    <div className="p-2 bg-wl-bg-overlay rounded">
                      <div className="text-xs text-wl-text-tertiary mb-1">Completion %</div>
                      <div className="text-lg font-bold text-wl-success-400">
                        {(selectedDriver.completionRate * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-wl-bg-overlay rounded col-span-2">
                      <div className="text-xs text-wl-text-tertiary mb-1">Total Deliveries</div>
                      <div className="text-lg font-bold text-wl-info-400">{selectedDriver.totalDeliveries}</div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-wl-border-subtle" />

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <Button variant="primary" size="md" className="w-full">
                    Edit Profile
                  </Button>
                  <Button variant="secondary" size="md" className="w-full">
                    Assign Route
                  </Button>
                  <Button variant="ghost" size="md" className="w-full">
                    View History
                  </Button>
                  <Button variant="danger" size="md" className="w-full">
                    Deactivate
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
