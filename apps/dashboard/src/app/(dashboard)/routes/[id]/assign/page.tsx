'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Truck,
  CheckCircle,
  User,
  AlertCircle,
  MapPin,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery, useApiMutation, useApiList } from '@/hooks/use-api';

// ─── Types ────────────────────────────────────────────────────

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  address: string | null;
  customerName: string | null;
}

interface RouteDriver {
  id: string;
  name: string;
  vehicleType: string;
}

interface RouteSummary {
  id: string;
  name: string | null;
  status: string;
  date: string;
  totalDistance: string | null;
  totalDuration: number | null;
  driver: RouteDriver | null;
  stops: RouteStop[];
}

interface ApiDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string | null;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK';
  maxCapacity: number;
}

const DRIVER_STATUS_BADGE: Record<
  ApiDriver['status'],
  'default' | 'success' | 'warning' | 'danger'
> = {
  AVAILABLE: 'success',
  OFFLINE: 'default',
  ON_ROUTE: 'warning',
  ON_BREAK: 'warning',
};

// ─── Loading Skeleton ─────────────────────────────────────────

function AssignPageSkeleton() {
  return (
    <div className="p-6 bg-wl-bg-root min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-8 h-8 rounded" />
        <Skeleton className="w-48 h-7 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 rounded-lg" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Driver Card ──────────────────────────────────────────────

interface DriverCardProps {
  driver: ApiDriver;
  isSelected: boolean;
  isCurrentDriver: boolean;
  onSelect: () => void;
}

function DriverCard({ driver, isSelected, isCurrentDriver, onSelect }: DriverCardProps) {
  const canAssign = driver.status === 'AVAILABLE' || driver.status === 'OFFLINE';

  return (
    <Card
      className={cn(
        'transition-all cursor-pointer',
        isSelected
          ? 'border-blue-500 bg-blue-500/5'
          : canAssign
            ? 'border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong'
            : 'border-wl-border-default bg-wl-bg-sunken opacity-60 cursor-not-allowed',
      )}
      onClick={() => canAssign && onSelect()}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-wl-bg-overlay flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-wl-text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{driver.name}</span>
              {isCurrentDriver && (
                <Badge variant="primary" className="text-xs">
                  Current
                </Badge>
              )}
              <Badge variant={DRIVER_STATUS_BADGE[driver.status]} className="text-xs">
                {driver.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex gap-4 mt-1 text-xs text-wl-text-secondary flex-wrap">
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {driver.vehicleType}
                {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ''}
              </span>
              <span>{driver.phone}</span>
              <span>Capacity: {driver.maxCapacity}</span>
            </div>
            {!canAssign && (
              <p className="text-xs text-wl-warning-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Driver is currently {driver.status.toLowerCase().replace('_', ' ')}
              </p>
            )}
          </div>
          {isSelected && (
            <CheckCircle className="w-5 h-5 text-wl-info-400 flex-shrink-0 mt-0.5" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function RouteAssignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: route,
    loading: routeLoading,
    error: routeError,
    refetch: refetchRoute,
  } = useApiQuery<RouteSummary>(id ? `/api/v4/routes/${id}` : null);

  const { items: drivers, loading: driversLoading } = useApiList<ApiDriver>('/api/v4/drivers');

  const { execute: assignDriver, loading: assigning, error: assignError } = useApiMutation<
    RouteSummary
  >('POST', `/api/v4/routes/${id}/assign`);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;
    const q = searchQuery.toLowerCase();
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.vehicleType.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        (d.vehiclePlate ?? '').toLowerCase().includes(q),
    );
  }, [drivers, searchQuery]);

  const handleConfirm = async () => {
    if (!selectedDriverId) return;
    await assignDriver({ driverId: selectedDriverId });
    router.push(`/routes/${id}`);
  };

  if (routeLoading || driversLoading) return <AssignPageSkeleton />;

  if (routeError) {
    return (
      <div className="p-6 min-h-screen bg-wl-bg-root">
        <ErrorState message={routeError.message} onRetry={refetchRoute} />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-6 min-h-screen bg-wl-bg-root text-center text-wl-text-secondary pt-20">
        Route not found.
      </div>
    );
  }

  const availableDrivers = filteredDrivers.filter(
    (d) => d.status === 'AVAILABLE' || d.status === 'OFFLINE',
  );
  const unavailableDrivers = filteredDrivers.filter(
    (d) => d.status !== 'AVAILABLE' && d.status !== 'OFFLINE',
  );

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <div className="p-6 min-h-screen bg-wl-bg-root">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link
          href={`/routes/${id}`}
          className="text-wl-text-secondary hover:text-wl-text-primary transition-colors p-1.5 rounded-md hover:bg-wl-bg-surface"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">
            Assign Driver — {route.name ?? `Route ${new Date(route.date).toLocaleDateString()}`}
          </h1>
          <p className="text-sm text-wl-text-secondary mt-0.5">
            {route.stops.length} stops ·{' '}
            {route.totalDistance ? `${Number(route.totalDistance).toFixed(1)} km` : 'Distance TBD'}
          </p>
        </div>
      </div>

      {/* ── Main Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Driver List */}
        <div>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
            <Input
              placeholder="Search drivers by name, vehicle, or plate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-wl-bg-surface border-wl-border-default text-wl-text-primary"
            />
          </div>

          {/* Available Drivers */}
          {availableDrivers.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
                Available ({availableDrivers.length})
              </div>
              <div className="flex flex-col gap-3">
                {availableDrivers.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={selectedDriverId === driver.id}
                    isCurrentDriver={route.driver?.id === driver.id}
                    onSelect={() =>
                      setSelectedDriverId(
                        selectedDriverId === driver.id ? null : driver.id,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unavailable Drivers */}
          {unavailableDrivers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3">
                Unavailable ({unavailableDrivers.length})
              </div>
              <div className="flex flex-col gap-3">
                {unavailableDrivers.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={false}
                    isCurrentDriver={route.driver?.id === driver.id}
                    onSelect={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredDrivers.length === 0 && (
            <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-8 text-center text-wl-text-tertiary">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No drivers found matching your search.</p>
            </div>
          )}
        </div>

        {/* Sidebar: Route info + confirmation */}
        <div className="flex flex-col gap-4">
          {/* Current Assignment */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader className="pb-3 border-b border-wl-border-default">
              <CardTitle className="text-sm text-white">Current Assignment</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {route.driver ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-wl-info-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-wl-info-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{route.driver.name}</div>
                    <div className="text-xs text-wl-text-secondary">{route.driver.vehicleType}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-wl-text-tertiary">No driver assigned yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Route Stops Preview */}
          <Card className="bg-wl-bg-surface border border-wl-border-default flex-1">
            <CardHeader className="pb-3 border-b border-wl-border-default">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-wl-info-400" />
                Route Stops ({route.stops.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 max-h-64 overflow-y-auto">
              {route.stops.length === 0 ? (
                <p className="text-xs text-wl-text-tertiary text-center py-4">No stops on this route.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {route.stops.map((stop) => (
                    <div key={stop.id} className="flex items-start gap-2 text-xs">
                      <div className="w-5 h-5 rounded-full bg-wl-bg-overlay flex items-center justify-center text-wl-text-secondary font-bold flex-shrink-0 mt-0.5">
                        {stop.sequence + 1}
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          {stop.customerName ?? `Stop ${stop.sequence + 1}`}
                        </div>
                        {stop.address && (
                          <div className="text-wl-text-tertiary mt-0.5 truncate max-w-[260px]">
                            {stop.address}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ETA Preview */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader className="pb-3 border-b border-wl-border-default">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-wl-warning-400" />
                Estimated Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-xs text-wl-text-secondary space-y-1">
                <div className="flex justify-between">
                  <span>Stops</span>
                  <span className="text-white">{route.stops.length}</span>
                </div>
                {route.totalDistance && (
                  <div className="flex justify-between">
                    <span>Distance</span>
                    <span className="text-white">
                      {Number(route.totalDistance).toFixed(1)} km
                    </span>
                  </div>
                )}
                {route.totalDuration && (
                  <div className="flex justify-between">
                    <span>Est. Duration</span>
                    <span className="text-white">
                      {Math.round(route.totalDuration / 60)} min
                    </span>
                  </div>
                )}
                {selectedDriver && (
                  <div className="flex justify-between pt-2 border-t border-wl-border-default">
                    <span>Selected Driver</span>
                    <span className="text-wl-info-400">{selectedDriver.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {assignError && (
            <div className="p-3 bg-wl-danger-500/10 border border-red-500 rounded-lg text-wl-danger-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {assignError.message}
            </div>
          )}

          {/* Confirm Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/routes/${id}`}>
              <Button variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              disabled={!selectedDriverId || assigning}
              onClick={handleConfirm}
              className="w-full"
            >
              <CheckCircle className="w-4 h-4" />
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
