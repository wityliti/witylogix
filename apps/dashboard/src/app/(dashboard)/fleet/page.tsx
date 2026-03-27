'use client';

import Link from 'next/link';
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
  Zap,
  Wrench,
  Gauge,
  User,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   FLEET MANAGEMENT PAGE — Vehicle fleet oversight
   Professional grid layout with key metrics and vehicle details
   ═══════════════════════════════════════════════════════════ */

interface Vehicle {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  engineType: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'IDLE' | 'OFFLINE';
  odometer: number;
  fuelLevel: number;
  driverId?: string;
  lastSyncAt: string;
}

const statusConfig: Record<string, { badge: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  ACTIVE: { badge: 'success', label: 'Active' },
  MAINTENANCE: { badge: 'warning', label: 'Maintenance' },
  IDLE: { badge: 'default', label: 'Idle' },
  OFFLINE: { badge: 'danger', label: 'Offline' },
};

const formatMileage = (km: number): string => {
  if (km >= 1000000) return `${(km / 1000000).toFixed(1)}M`;
  if (km >= 1000) return `${(km / 1000).toFixed(0)}K`;
  return km.toString();
};

const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  const statusCfg = statusConfig[vehicle.status] ?? { badge: 'default' as const, label: vehicle.status };

  return (
    <Card hover>
      <CardContent className="p-5">
        {/* Header with plate and status */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-white/[0.05] text-wl-primary-400')}>
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-wl-text-primary">{vehicle.licensePlate}</div>
              <div className="text-xs text-wl-text-tertiary mt-0.5">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </div>
            </div>
          </div>
          <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
        </div>

        {/* Key metrics */}
        <div className="space-y-3 mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Gauge className="w-4 h-4 text-wl-info-400" />
              <span>Odometer</span>
            </div>
            <span className="font-medium text-wl-text-primary">{formatMileage(vehicle.odometer)} km</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-wl-text-secondary">
              <Zap className="w-4 h-4 text-wl-warning-400" />
              <span>Fuel Level</span>
            </div>
            <span className="font-medium text-wl-text-primary">{vehicle.fuelLevel}%</span>
          </div>

          {vehicle.driverId && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-wl-text-secondary">
                <User className="w-4 h-4 text-wl-primary-400" />
                <span>Driver Assigned</span>
              </div>
              <span className="font-medium text-wl-text-primary">Yes</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Link href={`/fleet/vehicles/${vehicle.id}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default function FleetPage() {
  const { items: vehiclesData, loading, error, refetch } = useApiList<Vehicle>('/api/v4/fleet/vehicles');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const totalVehicles = vehiclesData.length;
  const activeVehicles = vehiclesData.filter((v) => v.status === 'ACTIVE').length;
  const maintenanceVehicles = vehiclesData.filter((v) => v.status === 'MAINTENANCE').length;
  const avgFuel = vehiclesData.length
    ? Math.round(vehiclesData.reduce((sum, v) => sum + v.fuelLevel, 0) / vehiclesData.length)
    : 0;

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
          change={{ value: totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0, label: 'utilization' }}
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
          label="Avg Fuel Level"
          value={`${avgFuel}%`}
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
