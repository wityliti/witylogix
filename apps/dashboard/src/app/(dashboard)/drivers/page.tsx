'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useDrivers, Driver } from '@/hooks/use-drivers';
import { Star, MessageCircle, Eye, Plus, Phone, MapPin } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Professional driver management
   Refined minimalist dark aesthetic with clear data hierarchy
   ═══════════════════════════════════════════════════════════ */

type DriverStatus = 'available' | 'en_route' | 'delivering' | 'offline';

const statusConfig: Record<DriverStatus, { badge: 'success' | 'warning' | 'info' | 'primary' | 'default'; label: string }> = {
  available: { badge: 'success', label: 'Available' },
  en_route: { badge: 'primary', label: 'En Route' },
  delivering: { badge: 'info', label: 'Delivering' },
  offline: { badge: 'default', label: 'Offline' },
};

const normalizeStatus = (status: string): DriverStatus => {
  const s = status.toUpperCase();
  if (s === 'ON_DELIVERY') return 'delivering';
  if (s === 'ACTIVE' || s === 'ONLINE') return 'available';
  if (s === 'ON_BREAK') return 'offline';
  if (s.includes('DELIVERY')) return 'delivering';
  return 'offline';
};

// Mock drivers array - for development fallback when API is unavailable
const DRIVERS: Driver[] = [
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
    documents: [],
    zones: ["Downtown Core", "Midtown East"],
    recentDeliveries: ["ORD-2847", "ORD-2846", "ORD-2845"],
  },
  {
    id: "drv-2",
    name: "Sofia Lindberg",
    email: "sofia@witylogix.io",
    phone: "+1 555-0102",
    status: "ACTIVE",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2201",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 5,
    avgRating: 4.9,
    totalDeliveries: 923,
    onTimePercentage: 97,
    currentLocation: "Midtown East",
    lastActive: "now",
    hireDate: "2020-07-22",
    licenseNumber: "DL-3921-ON",
    documents: [],
    zones: ["Midtown East", "West Side"],
    recentDeliveries: ["ORD-2844", "ORD-2843", "ORD-2842"],
  },
  {
    id: "drv-3",
    name: "Ahmed Khalil",
    email: "ahmed@witylogix.io",
    phone: "+1 555-0103",
    status: "ON_DELIVERY",
    vehicleType: "MOTORCYCLE",
    vehiclePlate: "WTY-1101",
    maxCapacity: 5,
    activeOrders: 2,
    completedToday: 12,
    avgRating: 4.7,
    totalDeliveries: 612,
    onTimePercentage: 91,
    currentLocation: "South District",
    lastActive: "now",
    hireDate: "2022-01-10",
    licenseNumber: "DL-5043-TX",
    documents: [],
    zones: ["South District", "Downtown Core"],
    recentDeliveries: ["ORD-2841", "ORD-2840", "ORD-2839"],
  },
  {
    id: "drv-4",
    name: "Jessica Chen",
    email: "jchen@witylogix.io",
    phone: "+1 555-0104",
    status: "ACTIVE",
    vehicleType: "TRUCK",
    vehiclePlate: "WTY-3301",
    maxCapacity: 50,
    activeOrders: 0,
    completedToday: 3,
    avgRating: 4.6,
    totalDeliveries: 745,
    onTimePercentage: 88,
    currentLocation: "Hub Central",
    lastActive: "now",
    hireDate: "2021-09-05",
    licenseNumber: "DL-6834-NY",
    documents: [],
    zones: ["Hub Central", "North Zone"],
    recentDeliveries: ["ORD-2838", "ORD-2837", "ORD-2836"],
  },
];

const StarRating = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) => {
  const stars = Math.round(rating);
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn(
            iconSize,
            i < stars ? 'fill-wl-warning-400 text-wl-warning-400' : 'text-wl-border-subtle'
          )}
        />
      ))}
    </div>
  );
};

const DriverCard = ({ driver }: { driver: Driver }) => {
  const status = normalizeStatus(driver.status);
  const config = statusConfig[status];
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card hover className="group">
      <CardContent className="p-5">
        {/* Header section with avatar and status */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
            {/* Name and phone */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm leading-tight">{driver.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Phone className="w-3 h-3" />
                <span>{driver.phone}</span>
              </div>
            </div>
          </div>
          {/* Status badge */}
          <Badge variant={config.badge} className="ml-2 flex-shrink-0">
            {config.label}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/[0.05]">
          <div>
            <div className="text-xs text-gray-400 mb-1">Deliveries</div>
            <div className="text-sm font-semibold text-white">{driver.completedToday}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Rating</div>
            <StarRating rating={driver.avgRating} size="sm" />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">On-Time</div>
            <div className="text-sm font-semibold text-white">{driver.onTimePercentage}%</div>
          </div>
        </div>

        {/* Current delivery info */}
        {driver.activeOrders > 0 && (
          <div className="mb-4 pb-4 border-b border-white/[0.05]">
            <div className="text-xs text-gray-400 mb-2">Active Orders</div>
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-300">{driver.currentLocation}</span>
              <span className="text-gray-400">· {driver.activeOrders} orders</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1">
            <Eye className="w-4 h-4" />
            View
          </Button>
          <Button variant="secondary" size="sm" className="flex-1">
            <MessageCircle className="w-4 h-4" />
            Message
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DriversPage() {
  const { items: driversData = DRIVERS } = useDrivers();
  const [activeTab, setActiveTab] = useState('all');

  const driverTabs = [
    { id: 'all', label: 'All', count: driversData.length },
    { id: 'available', label: 'Available', count: driversData.filter((d) => normalizeStatus(d.status) === 'available').length },
    { id: 'en_route', label: 'En Route', count: driversData.filter((d) => normalizeStatus(d.status) === 'en_route').length },
    { id: 'delivering', label: 'Delivering', count: driversData.filter((d) => normalizeStatus(d.status) === 'delivering').length },
    { id: 'offline', label: 'Offline', count: driversData.filter((d) => normalizeStatus(d.status) === 'offline').length },
  ];

  const filteredDrivers = useMemo(() => {
    if (activeTab === 'all') return driversData;
    return driversData.filter((d) => normalizeStatus(d.status) === activeTab);
  }, [driversData, activeTab]);

  return (
    <>
      {/* Header */}
      <Header
        title="Drivers"
        subtitle={`${filteredDrivers.length} drivers`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Add Driver
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-6">
        <Tabs
          tabs={driverTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          size="md"
        />
      </div>

      {/* Driver cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    </>
  );
}
