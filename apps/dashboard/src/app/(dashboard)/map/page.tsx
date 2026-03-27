'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import {
  MapPin,
  Package,
  Truck,
  Users,
  ZoomIn,
  ZoomOut,
  Filter,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

type ViewTab = 'orders' | 'routes' | 'drivers';
type StatusFilter = string;

interface MapOrder {
  id: string;
  orderNumber?: string;
  status: string;
  deliveryAddress?: string;
  shippingAddress?: { lat?: number; lng?: number; line1?: string; city?: string };
  lat?: number;
  lng?: number;
}

interface MapRoute {
  id: string;
  name?: string;
  status: string;
  driver?: { name: string };
  _count?: { stops: number };
  lat?: number;
  lng?: number;
}

interface MapDriver {
  id: string;
  name: string;
  status: string;
  currentLocation?: { lat?: number; lng?: number };
  lat?: number;
  lng?: number;
}

// NYC bounding box defaults for map canvas
const MAP_BOUNDS = { minLat: 40.6895, maxLat: 40.7700, minLng: -74.0450, maxLng: -73.9500 };

// Deterministic pseudo-random lat/lng from an id string (used when API has no coords)
function pseudoLatLng(id: string, idx: number) {
  const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx * 17;
  const lat = MAP_BOUNDS.minLat + ((seed * 31337) % 10000) / 10000 * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  const lng = MAP_BOUNDS.minLng + ((seed * 98765) % 10000) / 10000 * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  return { lat, lng };
}

const MapCanvas = ({
  items,
  selectedId,
  onItemClick,
  zoom,
  mapType,
}: {
  items: Array<{ id: string; status: string; lat: number; lng: number }>;
  selectedId: string | null;
  onItemClick: (id: string) => void;
  zoom: number;
  mapType: ViewTab;
}) => {
  const canvasSize = 600;

  const normalizeCoords = (lat: number, lng: number) => {
    const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * (canvasSize * (zoom / 100));
    const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * (canvasSize * (zoom / 100));
    return { x: x + (canvasSize - canvasSize * (zoom / 100)) / 2, y: y + (canvasSize - canvasSize * (zoom / 100)) / 2 };
  };

  const getMarkerColor = (status: string) => {
    const s = status.toLowerCase();
    if (mapType === 'orders') {
      if (s === 'pending') return '#f59e0b';
      if (s.includes('transit') || s === 'in_progress') return '#3b82f6';
      if (s === 'delivered' || s === 'completed') return '#10b981';
      if (s === 'failed' || s === 'cancelled') return '#ef4444';
    } else if (mapType === 'routes') {
      if (s === 'active' || s === 'in_progress' || s === 'assigned') return '#6C63FF';
      if (s === 'completed') return '#10b981';
    } else if (mapType === 'drivers') {
      if (s === 'available') return '#3b82f6';
      if (s === 'on_route') return '#6C63FF';
      if (s === 'on_break') return '#f59e0b';
      if (s === 'offline') return '#94a3b8';
    }
    return '#6C63FF';
  };

  return (
    <svg
      width={canvasSize}
      height={canvasSize}
      className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg"
      style={{ cursor: 'crosshair' }}
    >
      {Array.from({ length: 13 }).map((_, i) => (
        <g key={`grid-${i}`}>
          <line x1={i * (canvasSize / 12)} y1={0} x2={i * (canvasSize / 12)} y2={canvasSize} stroke="#1e1e2e" strokeWidth="0.5" />
          <line x1={0} y1={i * (canvasSize / 12)} x2={canvasSize} y2={i * (canvasSize / 12)} stroke="#1e1e2e" strokeWidth="0.5" />
        </g>
      ))}

      {items.map((item) => {
        const { x, y } = normalizeCoords(item.lat, item.lng);
        const color = getMarkerColor(item.status);
        const isSelected = item.id === selectedId;

        return (
          <g key={item.id} onClick={() => onItemClick(item.id)} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
            {isSelected && (
              <circle cx={x} cy={y} r={18} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
            )}
            <circle cx={x} cy={y} r={8} fill={color} stroke="white" strokeWidth="2" opacity={isSelected ? 1 : 0.8} />
            <circle cx={x} cy={y} r={3} fill="white" />
          </g>
        );
      })}
    </svg>
  );
};

export default function MapView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('orders');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const { items: rawOrders, loading: ordersLoading } = useApiList<MapOrder>('/api/v4/orders', { limit: 50 });
  const { items: rawRoutes, loading: routesLoading } = useApiList<MapRoute>('/api/v4/routes', { limit: 50 });
  const { items: rawDrivers, loading: driversLoading } = useApiList<MapDriver>('/api/v4/drivers', { limit: 50 });

  const orders = rawOrders.map((o, i) => ({
    ...o,
    lat: o.lat ?? o.shippingAddress?.lat ?? pseudoLatLng(o.id, i).lat,
    lng: o.lng ?? o.shippingAddress?.lng ?? pseudoLatLng(o.id, i).lng,
    label: o.orderNumber ?? o.id,
    address: o.deliveryAddress ?? [o.shippingAddress?.line1, o.shippingAddress?.city].filter(Boolean).join(', ') ?? '',
  }));

  const routes = rawRoutes.map((r, i) => ({
    ...r,
    lat: r.lat ?? pseudoLatLng(r.id, i).lat,
    lng: r.lng ?? pseudoLatLng(r.id, i).lng,
    label: r.name ?? r.id,
    stops: r._count?.stops ?? 0,
    driverName: r.driver?.name ?? '',
  }));

  const drivers = rawDrivers.map((d, i) => ({
    ...d,
    lat: d.lat ?? d.currentLocation?.lat ?? pseudoLatLng(d.id, i).lat,
    lng: d.lng ?? d.currentLocation?.lng ?? pseudoLatLng(d.id, i).lng,
  }));

  const loading = activeTab === 'orders' ? ordersLoading : activeTab === 'routes' ? routesLoading : driversLoading;

  const getItems = () => {
    const filter = statusFilter.toLowerCase();
    if (activeTab === 'orders') {
      return filter === 'all' ? orders : orders.filter((o) => o.status.toLowerCase().includes(filter));
    }
    if (activeTab === 'routes') {
      return filter === 'all' ? routes : routes.filter((r) => r.status.toLowerCase() === filter);
    }
    if (activeTab === 'drivers') {
      return filter === 'all' ? drivers : drivers.filter((d) => d.status.toLowerCase() === filter);
    }
    return [];
  };

  const getStatusOptions = () => {
    if (activeTab === 'orders') return ['all', 'pending', 'in-transit', 'delivered', 'failed'];
    if (activeTab === 'routes') return ['all', 'active', 'completed'];
    if (activeTab === 'drivers') return ['all', 'available', 'on_route', 'on_break', 'offline'];
    return ['all'];
  };

  const items = getItems();
  const selectedItem = items.find((item) => item.id === selectedId) as (typeof items)[0] & Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Map View</h1>
        <p className="text-gray-400">Real-time location tracking for orders, routes, and drivers</p>
      </div>

      {/* Tab Selector */}
      <div className="max-w-7xl mx-auto mb-6">
        <Tabs
          tabs={[
            { id: 'orders', label: `Orders (${orders.length})`, icon: <Package size={16} /> },
            { id: 'routes', label: `Routes (${routes.length})`, icon: <MapPin size={16} /> },
            { id: 'drivers', label: `Drivers (${drivers.length})`, icon: <Users size={16} /> },
          ]}
          activeTab={activeTab}
          onChange={(value) => { setActiveTab(value as ViewTab); setSelectedId(null); setStatusFilter('all'); }}
          variant="segment"
        />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-[1fr_350px] gap-6">
        {/* Main Map Area */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-6">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  {activeTab === 'orders' && 'Orders Map'}
                  {activeTab === 'routes' && 'Routes Map'}
                  {activeTab === 'drivers' && 'Drivers Map'}
                </h2>
                <p className="text-gray-400 text-sm">{items.length} items on map</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setZoom(Math.min(200, zoom + 20))}
                  variant="secondary"
                  size="sm"
                  className="w-10 h-10 p-0 flex items-center justify-center"
                >
                  <ZoomIn size={18} />
                </Button>
                <Button
                  onClick={() => setZoom(Math.max(50, zoom - 20))}
                  variant="secondary"
                  size="sm"
                  className="w-10 h-10 p-0 flex items-center justify-center"
                >
                  <ZoomOut size={18} />
                </Button>
                <div className="text-gray-400 text-xs pl-2 flex items-center">
                  {zoom}%
                </div>
              </div>
            </div>

            {/* Map Canvas */}
            {loading ? (
              <div className="flex justify-center mb-4"><LoadingSkeleton /></div>
            ) : (
              <div className="flex justify-center mb-4">
                <MapCanvas items={items} selectedId={selectedId} onItemClick={setSelectedId} zoom={zoom} mapType={activeTab} />
              </div>
            )}

            {/* Legend */}
            <div className="border-t border-[#1e1e2e] pt-4">
              <p className="text-xs font-semibold text-gray-400 mb-3 uppercase">Legend</p>
              <div className="grid grid-cols-2 gap-3">
                {activeTab === 'orders' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-xs text-gray-400">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-xs text-gray-400">In Transit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs text-gray-400">Delivered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-xs text-gray-400">Failed</span>
                    </div>
                  </>
                )}
                {activeTab === 'routes' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-xs text-gray-400">Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs text-gray-400">Completed</span>
                    </div>
                  </>
                )}
                {activeTab === 'drivers' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-xs text-gray-400">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-xs text-gray-400">On Route</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-xs text-gray-400">On Break</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-xs text-gray-400">Offline</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar - Items List & Details */}
        <div className="flex flex-col gap-4">
          {/* Filter Card */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={16} className="text-gray-400" />
                <p className="text-sm font-semibold text-white">Filter by Status</p>
              </div>
              <div className="flex flex-col gap-2">
                {getStatusOptions().map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'px-3 py-2 rounded text-xs font-medium cursor-pointer transition-all capitalize',
                      statusFilter === status
                        ? 'border border-blue-500 bg-[#1a1a2e] text-blue-500 font-semibold'
                        : 'border border-[#1e1e2e] bg-transparent text-gray-400 font-normal'
                    )}
                  >
                    {status === 'all' ? 'All Items' : status.replace(/-/g, ' ').replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] flex-1 overflow-hidden flex flex-col">
            <CardContent className="p-4 flex-1 overflow-y-auto max-h-96">
              <p className="text-xs font-semibold text-white mb-3 uppercase">Items ({items.length})</p>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const anyItem = item as Record<string, unknown>;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'p-3 rounded text-left transition-all border',
                        selectedId === item.id
                          ? 'border-blue-500 bg-[#1a1a2e]'
                          : 'border-[#1e1e2e] bg-transparent'
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-white">
                          {(anyItem.label as string) ?? item.id}
                        </span>
                        <Badge variant="default">{item.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      {activeTab === 'orders' && (
                        <p className="text-xs text-gray-400">{anyItem.address as string}</p>
                      )}
                      {activeTab === 'routes' && (
                        <p className="text-xs text-gray-400">{anyItem.stops as number} stops</p>
                      )}
                      {activeTab === 'drivers' && (
                        <p className="text-xs text-gray-400">{anyItem.name as string}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detail Panel */}
          {selectedItem && (
            <Card className="bg-[#12121a] border border-blue-500/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-500 mb-3 uppercase">Details</p>
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">ID</p>
                  <p className="text-xs text-white">{selectedItem.id}</p>
                </div>
                {activeTab === 'orders' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Order</p>
                      <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).label as string}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Address</p>
                      <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).address as string}</p>
                    </div>
                  </>
                )}
                {activeTab === 'routes' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Route</p>
                      <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).label as string}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Stops</p>
                      <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).stops as number}</p>
                    </div>
                    {(selectedItem as Record<string, unknown>).driverName && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1">Driver</p>
                        <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).driverName as string}</p>
                      </div>
                    )}
                  </>
                )}
                {activeTab === 'drivers' && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">Name</p>
                    <p className="text-xs text-white">{(selectedItem as Record<string, unknown>).name as string}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className="text-xs text-white capitalize">{selectedItem.status.replace(/_/g, ' ')}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Location</p>
                  <p className="text-xs text-white">{(selectedItem.lat as number).toFixed(4)}, {(selectedItem.lng as number).toFixed(4)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
