'use client';

import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import {
  Truck,
  Plus,
  AlertCircle,
  Zap,
  Wrench,
  Gauge,
  Calendar,
  User,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   FLEET MANAGEMENT PAGE — Vehicle fleet oversight
   Professional grid layout with key metrics and vehicle details
   ═══════════════════════════════════════════════════════════ */

interface Vehicle {
  id: string;
  plate: string;
  type: 'CAR' | 'VAN' | 'TRUCK' | 'MOTORCYCLE';
  status: 'active' | 'maintenance' | 'idle';
  lastMaintenance?: string;
  mileage: number;
  assignedDriver?: string;
}

const vehicleTypeConfig: Record<string, { icon: typeof Truck; label: string; color: string }> = {
  CAR: { icon: Truck, label: 'Car', color: 'text-wl-primary-400' },
  VAN: { icon: Truck, label: 'Van', color: 'text-wl-info-400' },
  TRUCK: { icon: Truck, label: 'Truck', color: 'text-wl-success-400' },
  MOTORCYCLE: { icon: Truck, label: 'Motorcycle', color: 'text-wl-warning-400' },
};

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  active: { badge: 'success', label: 'Active' },
  maintenance: { badge: 'warning', label: 'Maintenance' },
  idle: { badge: 'default', label: 'Idle' },
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatMileage = (miles: number): string => {
  if (miles >= 1000000) return `${(miles / 1000000).toFixed(1)}M`;
  if (miles >= 1000) return `${(miles / 1000).toFixed(0)}K`;
  return miles.toString();
};

// Mock vehicles data
const MOCK_VEHICLES: Vehicle[] = [
  {
    id: 'v-1',
    plate: 'WTY-4501',
    type: 'VAN',
    status: 'active',
    lastMaintenance: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
    mileage: 245000,
    assignedDriver: 'Carlos Martinez',
  },
  {
    id: 'v-2',
    plate: 'WTY-2201',
    type: 'CAR',
    status: 'active',
    lastMaintenance: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
    mileage: 189000,
    assignedDriver: 'Sofia Lindberg',
  },
  {
    id: 'v-3',
    plate: 'WTY-1101',
    type: 'MOTORCYCLE',
    status: 'active',
    lastMaintenance: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    mileage: 78000,
    assignedDriver: 'Ahmed Khalil',
  },
  {
    id: 'v-4',
    plate: 'WTY-3301',
    type: 'TRUCK',
    status: 'maintenance',
    lastMaintenance: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    mileage: 567000,
    assignedDriver: 'Jessica Chen',
  },
  {
    id: 'v-5',
    plate: 'WTY-5401',
    type: 'VAN',
    status: 'idle',
    lastMaintenance: new Date(Date.now() - 60 * 24 * 3600000).toISOString(),
    mileage: 312000,
  },
  {
    id: 'v-6',
    plate: 'WTY-2302',
    type: 'CAR',
    status: 'active',
    lastMaintenance: new Date(Date.now() - 21 * 24 * 3600000).toISOString(),
    mileage: 156000,
    assignedDriver: 'Marcus Johnson',
  },
];

const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  const typeConfig = vehicleTypeConfig[vehicle.type];
  const statusCfg = statusConfig[vehicle.status];
  const TypeIcon = typeConfig.icon;

  return (
    <Card hover>
      <CardContent className="p-5">
        {/* Header with plate and status */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-white/[0.05]', typeConfig.color)}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-wl-text-primary">{vehicle.plate}</div>
              <div className="text-xs text-wl-text-tertiary mt-0.5">{typeConfig.label}</div>
            </div>
          </div>
          <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
        </div>

        {/* Key metrics */}
        <div className="space-y-3 mb-4 pb-4 border-b border-white/[0.05]">
          {/* Maintenance */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Wrench className="w-4 h-4 text-wl-warning-400" />
              <span>Last Maintenance</span>
            </div>
            <span className="font-medium text-wl-text-primary">{formatDate(vehicle.lastMaintenance)}</span>
          </div>

          {/* Mileage */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Gauge className="w-4 h-4 text-wl-info-400" />
              <span>Mileage</span>
            </div>
            <span className="font-medium text-wl-text-primary">{formatMileage(vehicle.mileage)} mi</span>
          </div>

          {/* Driver */}
          {vehicle.assignedDriver && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-wl-text-secondary">
                <User className="w-4 h-4 text-wl-primary-400" />
                <span>Driver</span>
              </div>
              <span className="font-medium text-wl-text-primary">{vehicle.assignedDriver}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1">
            View Details
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function FleetPage() {
  const { items: vehiclesData = MOCK_VEHICLES, loading, error, refetch } = useApiList<Vehicle>('/api/v4/vehicles');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const totalVehicles = vehiclesData.length;
  const activeVehicles = vehiclesData.filter((v) => v.status === 'active').length;
  const maintenanceVehicles = vehiclesData.filter((v) => v.status === 'maintenance').length;
  const avgMileage = vehiclesData.length
    ? Math.round(vehiclesData.reduce((sum, v) => sum + v.mileage, 0) / vehiclesData.length)
    : 0;

  // Calculate monthly fuel cost (mock calculation: ~$0.12 per mile)
  const monthlyFuelCost = vehiclesData.reduce((sum, v) => sum + (v.mileage * 0.12) / 12, 0);

  return (
    <>
      {/* Header */}
      <Header
        title="Fleet"
        subtitle={`${activeVehicles} active vehicles`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Vehicles"
          value={totalVehicles}
          icon={<Truck className="w-5 h-5" />}
          accentColor="var(--wl-primary-500)"
        />
        <StatCard
          label="Active"
          value={activeVehicles}
          change={{ value: Math.round((activeVehicles / totalVehicles) * 100), label: 'utilization' }}
          icon={<Zap className="w-5 h-5" />}
          accentColor="var(--wl-success-500)"
        />
        <StatCard
          label="In Maintenance"
          value={maintenanceVehicles}
          icon={<Wrench className="w-5 h-5" />}
          accentColor="var(--wl-warning-500)"
        />
        <StatCard
          label="Fuel Cost (month)"
          value={`$${monthlyFuelCost.toFixed(0)}`}
          icon={<Zap className="w-5 h-5" />}
          accentColor="var(--wl-info-500)"
        />
      </div>

      {/* Vehicle cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehiclesData.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </>
  );
}
