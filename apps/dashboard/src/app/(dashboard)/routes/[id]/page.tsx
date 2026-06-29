'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Edit2,
  UserCheck,
  Play,
  PauseCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { RoutePolylineLayer } from '@/components/map/route-polyline-layer';
import { RouteStopMarkersLayer, type StopMarker } from '@/components/map/route-stop-markers-layer';

// ─── Types ────────────────────────────────────────────────────

type RouteStatus = 'DRAFT' | 'OPTIMIZED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type StopStatus = 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
type StopType = 'PICKUP' | 'DELIVERY' | 'RETURN' | 'DEPOT';

interface EnrichedStop {
  id: string;
  routeId: string;
  orderId: string | null;
  sequence: number;
  stopType: StopType;
  status: StopStatus;
  estimatedArrival: string | null;
  actualArrival: string | null;
  departedAt: string | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  customerName: string | null;
  orderNumber: string | null;
}

interface RouteDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string | null;
  status: string;
  currentLocation: { lat?: number; lng?: number } | null;
}

interface RouteDetail {
  id: string;
  name: string | null;
  status: RouteStatus;
  date: string;
  totalDistance: string | null;
  totalDuration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  driver: RouteDriver | null;
  stops: EnrichedStop[];
  optimizedOrder: unknown[];
}

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_BADGE: Record<RouteStatus, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  DRAFT: 'default',
  OPTIMIZED: 'info',
  ASSIGNED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const STOP_STATUS_BADGE: Record<StopStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'default',
  EN_ROUTE: 'info',
  ARRIVED: 'primary' as 'info',
  COMPLETED: 'success',
  SKIPPED: 'warning',
  FAILED: 'danger',
};

const STOP_STATUS_ICON: Record<StopStatus, React.ReactNode> = {
  PENDING: <Clock className="w-3.5 h-3.5 text-wl-text-secondary" />,
  EN_ROUTE: <Navigation className="w-3.5 h-3.5 text-blue-400" />,
  ARRIVED: <MapPin className="w-3.5 h-3.5 text-blue-400" />,
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  SKIPPED: <SkipForward className="w-3.5 h-3.5 text-amber-400" />,
  FAILED: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Build polyline coordinates from stop lat/lng in sequence order
function buildPolylineCoords(stops: EnrichedStop[]): Array<[number, number]> {
  return stops
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => [s.longitude!, s.latitude!] as [number, number]);
}

// Default map center (fallback when no geocoords available)
const DEFAULT_CENTER: [number, number] = [0, 20];

// ─── Loading Skeleton ─────────────────────────────────────────

function RouteDetailSkeleton() {
  return (
    <div className="p-6 bg-wl-bg-root min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-8 h-8 rounded" />
        <Skeleton className="w-48 h-7 rounded" />
        <Skeleton className="w-20 h-6 rounded-full ml-2" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
            <Skeleton className="w-24 h-3 rounded mb-2" />
            <Skeleton className="w-16 h-8 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <Skeleton className="h-[520px] rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Stop List Item ───────────────────────────────────────────

interface StopListItemProps {
  stop: EnrichedStop;
  isSelected: boolean;
  onSelect: () => void;
  routeId: string;
  onStatusUpdated: () => void;
}

function StopListItem({ stop, isSelected, onSelect, routeId, onStatusUpdated }: StopListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { execute: updateStop, loading } = useApiMutation<EnrichedStop>(
    'PATCH',
    `/api/v4/routes/${routeId}/stops/${stop.id}`,
  );

  const handleMarkCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateStop({ status: 'COMPLETED' });
    onStatusUpdated();
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-wl-border-default bg-wl-bg-surface hover:border-wl-border-strong',
      )}
      onClick={onSelect}
    >
      <div className="p-3 flex items-center gap-3">
        {/* Sequence Number */}
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
            stop.status === 'COMPLETED'
              ? 'bg-emerald-500 text-white'
              : stop.status === 'FAILED'
                ? 'bg-red-500 text-white'
                : stop.status === 'EN_ROUTE' || stop.status === 'ARRIVED'
                  ? 'bg-blue-500 text-white'
                  : 'bg-wl-bg-overlay text-wl-neutral-300',
          )}
        >
          {stop.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            stop.sequence + 1
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white truncate">
              {stop.customerName ?? stop.address ?? `Stop ${stop.sequence + 1}`}
            </span>
            <div className="flex-shrink-0">{STOP_STATUS_ICON[stop.status]}</div>
          </div>
          {stop.address && (
            <p className="text-xs text-wl-text-secondary truncate">{stop.address}</p>
          )}
        </div>

        {/* ETA */}
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-wl-text-secondary">{formatTime(stop.estimatedArrival)}</div>
          <Badge variant={STOP_STATUS_BADGE[stop.status]} className="text-xs mt-1">
            {stop.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Expand */}
        <button
          className="text-wl-text-tertiary hover:text-wl-neutral-300 ml-1 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-wl-border-default pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-wl-text-secondary mb-2">
            {stop.timeWindowStart && (
              <div>
                <span className="text-wl-text-tertiary">Window:</span>{' '}
                {formatTime(stop.timeWindowStart)} – {formatTime(stop.timeWindowEnd)}
              </div>
            )}
            {stop.actualArrival && (
              <div>
                <span className="text-wl-text-tertiary">Arrived:</span>{' '}
                {formatTime(stop.actualArrival)}
              </div>
            )}
            {stop.orderNumber && (
              <div>
                <span className="text-wl-text-tertiary">Order:</span> #{stop.orderNumber}
              </div>
            )}
            <div>
              <span className="text-wl-text-tertiary">Type:</span> {stop.stopType}
            </div>
          </div>
          {stop.notes && (
            <p className="text-xs text-wl-text-secondary italic mb-2">{stop.notes}</p>
          )}
          {stop.status === 'PENDING' || stop.status === 'EN_ROUTE' || stop.status === 'ARRIVED' ? (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={handleMarkCompleted}
              disabled={loading}
            >
              <CheckCircle2 className="w-3 h-3" />
              {loading ? 'Updating...' : 'Mark Completed'}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: route, loading, error, refetch } = useApiQuery<RouteDetail>(
    id ? `/api/v4/routes/${id}` : null,
  );

  const { execute: updateStatus, loading: statusLoading } = useApiMutation<RouteDetail>(
    'PATCH',
    `/api/v4/routes/${id}/status`,
  );

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Compute polyline and stop markers from enriched stops
  const polylineCoords = useMemo(
    () => (route ? buildPolylineCoords(route.stops) : []),
    [route],
  );

  const stopMarkers = useMemo<StopMarker[]>(() => {
    if (!route) return [];
    return route.stops
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => ({
        id: s.id,
        sequence: s.sequence + 1,
        lng: s.longitude!,
        lat: s.latitude!,
        status: s.status,
        address: s.address ?? undefined,
        customerName: s.customerName ?? undefined,
        eta: formatTime(s.estimatedArrival),
      }));
  }, [route]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (stopMarkers.length > 0) {
      const avgLng = stopMarkers.reduce((s, m) => s + m.lng, 0) / stopMarkers.length;
      const avgLat = stopMarkers.reduce((s, m) => s + m.lat, 0) / stopMarkers.length;
      return [avgLng, avgLat];
    }
    return DEFAULT_CENTER;
  }, [stopMarkers]);

  const hasMapData = stopMarkers.length > 0;

  if (loading) return <RouteDetailSkeleton />;
  if (error)
    return (
      <div className="min-h-screen bg-wl-bg-root p-6">
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  if (!route)
    return (
      <div className="min-h-screen bg-wl-bg-root p-6 text-center text-wl-text-secondary pt-20">
        Route not found.
      </div>
    );

  const completedStops = route.stops.filter((s) => s.status === 'COMPLETED').length;
  const totalStops = route.stops.length;
  const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const handleStartRoute = async () => {
    await updateStatus({ status: 'IN_PROGRESS' });
    await refetch();
  };

  const handleCompleteRoute = async () => {
    await updateStatus({ status: 'COMPLETED' });
    await refetch();
  };

  return (
    <div className="p-6 bg-wl-bg-root min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={() => router.push('/routes')}
          className="text-wl-text-secondary hover:text-white transition-colors p-1.5 rounded-md hover:bg-wl-bg-surface"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">
          {route.name ?? `Route ${new Date(route.date).toLocaleDateString()}`}
        </h1>
        <Badge variant={STATUS_BADGE[route.status]}>{route.status.replace('_', ' ')}</Badge>

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          <Link href={`/routes/${id}/assign`}>
            <Button variant="secondary" size="sm">
              <UserCheck className="w-4 h-4" />
              Assign Driver
            </Button>
          </Link>
          <Link href={`/routes/${id}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          {route.status === 'ASSIGNED' || route.status === 'OPTIMIZED' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartRoute}
              disabled={statusLoading}
            >
              <Play className="w-4 h-4" />
              Start Route
            </Button>
          ) : route.status === 'IN_PROGRESS' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompleteRoute}
              disabled={statusLoading}
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete Route
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
          <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-1">Stops</div>
          <div className="text-2xl font-bold text-blue-500">
            {completedStops}/{totalStops}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-1 bg-blue-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
          <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-1">Distance</div>
          <div className="text-2xl font-bold text-emerald-400">
            {route.totalDistance ? `${Number(route.totalDistance).toFixed(1)} km` : '—'}
          </div>
        </div>

        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
          <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-1">Duration</div>
          <div className="text-2xl font-bold text-amber-400">
            {route.totalDuration ? formatDuration(Math.round(route.totalDuration / 60)) : '—'}
          </div>
        </div>

        <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-4">
          <div className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-1">Progress</div>
          <div className="text-2xl font-bold text-purple-400">{progressPct}%</div>
        </div>
      </div>

      {/* ── Main Grid: Map + Sidebar ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Map Panel */}
        <div className="flex flex-col gap-4">
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl overflow-hidden h-[520px] relative">
            {hasMapData ? (
              <WLMap
                center={mapCenter}
                zoom={12}
                className="w-full h-full"
                interactive
              >
                {polylineCoords.length >= 2 && (
                  <RoutePolylineLayer
                    coordinates={polylineCoords}
                    variant="planned"
                    fitBounds
                    fitPadding={60}
                  />
                )}
                <RouteStopMarkersLayer
                  stops={stopMarkers}
                  fitBounds={polylineCoords.length < 2}
                  fitPadding={60}
                  onStopClick={(marker) => setSelectedStopId(marker.id)}
                />
              </WLMap>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-wl-text-tertiary gap-3">
                <MapPin className="w-10 h-10 opacity-30" />
                <div className="text-sm">No geocoordinates on stops yet.</div>
                <div className="text-xs text-wl-text-tertiary max-w-xs text-center">
                  Stops will appear on the map once their orders have delivery
                  location data.
                </div>
              </div>
            )}

            {/* Route summary overlay */}
            <div className="absolute bottom-4 right-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-4 py-3 text-xs">
              <div className="font-semibold text-white mb-2">Route Summary</div>
              <div className="space-y-1 text-wl-text-secondary">
                <div className="flex justify-between gap-6">
                  <span>Completed</span>
                  <span className="text-emerald-400 font-medium">{completedStops}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>Remaining</span>
                  <span className="text-white font-medium">{totalStops - completedStops}</span>
                </div>
                {route.totalDistance && (
                  <div className="flex justify-between gap-6">
                    <span>Distance</span>
                    <span className="text-white font-medium">
                      {Number(route.totalDistance).toFixed(1)} km
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stop sequence list */}
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">Stop Sequence</div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {route.stops.length === 0 ? (
                <div className="text-sm text-wl-text-tertiary text-center py-4">No stops on this route.</div>
              ) : (
                route.stops.map((stop) => (
                  <StopListItem
                    key={stop.id}
                    stop={stop}
                    isSelected={selectedStopId === stop.id}
                    onSelect={() =>
                      setSelectedStopId(selectedStopId === stop.id ? null : stop.id)
                    }
                    routeId={id}
                    onStatusUpdated={refetch}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Driver Card */}
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Driver
            </div>
            {route.driver ? (
              <div className="space-y-2 text-sm">
                <div className="text-white font-medium">{route.driver.name}</div>
                <div className="text-wl-text-secondary text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Phone</span>
                    <span className="text-white">{route.driver.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle</span>
                    <span className="text-white">
                      {route.driver.vehicleType}
                      {route.driver.vehiclePlate ? ` · ${route.driver.vehiclePlate}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <Badge
                      variant={route.driver.status === 'ON_ROUTE' ? 'success' : 'default'}
                      className="text-xs"
                    >
                      {route.driver.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-wl-text-tertiary">
                No driver assigned.{' '}
                <Link href={`/routes/${id}/assign`} className="text-blue-400 hover:underline">
                  Assign one
                </Link>
              </div>
            )}
          </div>

          {/* Route Timeline */}
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-4 flex-1">
            <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Timeline
            </div>
            <div className="relative pl-5">
              {route.stops.map((stop, idx) => {
                const isLast = idx === route.stops.length - 1;
                const dotColor =
                  stop.status === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : stop.status === 'FAILED'
                      ? 'bg-red-500'
                      : stop.status === 'EN_ROUTE' || stop.status === 'ARRIVED'
                        ? 'bg-blue-500'
                        : 'bg-wl-bg-elevated';

                return (
                  <div key={stop.id} className="relative pb-4">
                    {/* Vertical line */}
                    {!isLast && (
                      <div className="absolute left-[-13px] top-5 bottom-0 w-px bg-wl-bg-overlay" />
                    )}
                    {/* Dot */}
                    <div
                      className={cn(
                        'absolute left-[-17px] top-1 w-4 h-4 rounded-full border-2 border-wl-bg-root flex items-center justify-center',
                        dotColor,
                      )}
                    />

                    <div
                      className={cn(
                        'cursor-pointer',
                        selectedStopId === stop.id ? 'opacity-100' : 'opacity-80 hover:opacity-100',
                      )}
                      onClick={() =>
                        setSelectedStopId(selectedStopId === stop.id ? null : stop.id)
                      }
                    >
                      <div className="text-xs text-wl-text-tertiary mb-0.5">
                        {formatTime(stop.estimatedArrival)}
                      </div>
                      <div className="text-sm font-medium text-white">
                        {stop.customerName ?? stop.address ?? `Stop ${stop.sequence + 1}`}
                      </div>
                      {stop.address && stop.customerName && (
                        <div className="text-xs text-wl-text-tertiary mt-0.5 truncate max-w-[260px]">
                          {stop.address}
                        </div>
                      )}
                      {stop.status !== 'PENDING' && (
                        <div className="mt-1">
                          <Badge variant={STOP_STATUS_BADGE[stop.status]} className="text-xs">
                            {stop.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {route.stops.length === 0 && (
                <div className="text-sm text-wl-text-tertiary">No stops added yet.</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-wl-bg-surface border border-wl-border-default rounded-xl p-4">
            <div className="text-sm font-semibold text-white mb-3">Quick Actions</div>
            <div className="flex flex-col gap-2">
              {route.status === 'IN_PROGRESS' && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleCompleteRoute}
                  disabled={statusLoading}
                >
                  <PauseCircle className="w-4 h-4" />
                  Mark Route Complete
                </Button>
              )}
              <Link href={`/routes/${id}/assign`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  <UserCheck className="w-4 h-4" />
                  Reassign Driver
                </Button>
              </Link>
              <Link href={`/routes/${id}/edit`}>
                <Button variant="secondary" size="sm" className="w-full justify-start">
                  <Edit2 className="w-4 h-4" />
                  Edit Route
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
