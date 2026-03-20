'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import {
  MapPin,
  Package,
  Truck,
  Users,
  ZoomIn,
  ZoomOut,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

// Mock data








type ViewTab = 'orders' | 'shipments' | 'routes' | 'drivers';
type StatusFilter = 'all' | 'pending' | 'in-transit' | 'delivered' | 'failed' | 'active' | 'completed' | 'on-duty' | 'on-break' | 'off-duty';

const MapCanvas = ({ items, selectedId, onItemClick, zoom, mapType }: any) => {
  const canvasSize = 600;
  const minLat = 40.7100;
  const maxLat = 40.7750;
  const minLng = -74.0150;
  const maxLng = -73.9400;

  const normalizeCoords = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (canvasSize * (zoom / 100));
    const y = ((maxLat - lat) / (maxLat - minLat)) * (canvasSize * (zoom / 100));
    return { x: x + (canvasSize - canvasSize * (zoom / 100)) / 2, y: y + (canvasSize - canvasSize * (zoom / 100)) / 2 };
  };

  const getMarkerColor = (status: string, mapType: ViewTab) => {
    if (mapType === 'orders') {
      if (status === 'pending') return '#f59e0b';
      if (status === 'in-transit') return '#3b82f6';
      if (status === 'delivered') return '#22c55e';
      if (status === 'failed') return '#ef4444';
    } else if (mapType === 'shipments') {
      if (status === 'pending') return '#f59e0b';
      if (status === 'in-transit') return '#3b82f6';
    } else if (mapType === 'routes') {
      if (status === 'active') return '#6C63FF';
      if (status === 'completed') return '#22c55e';
    } else if (mapType === 'drivers') {
      if (status === 'on-duty') return '#3b82f6';
      if (status === 'on-break') return '#f59e0b';
      if (status === 'off-duty') return '#94a3b8';
    }
    return '#6C63FF';
  };

  return (
    <svg
      width={canvasSize}
      height={canvasSize}
      className="bg-slate-950 border border-slate-700 rounded-lg"
      style={{ cursor: 'crosshair' }}
    >
      {/* Grid background */}
      {Array.from({ length: 13 }).map((_, i) => (
        <g key={`grid-${i}`}>
          <line x1={i * (canvasSize / 12)} y1={0} x2={i * (canvasSize / 12)} y2={canvasSize} stroke="#1e293b" strokeWidth="0.5" />
          <line x1={0} y1={i * (canvasSize / 12)} x2={canvasSize} y2={i * (canvasSize / 12)} stroke="#1e293b" strokeWidth="0.5" />
        </g>
      ))}

      {/* Plot items */}
      {items.map((item: any) => {
        const { x, y } = normalizeCoords(item.lat, item.lng);
        const color = getMarkerColor(item.status, mapType);
        const isSelected = item.id === selectedId;

        return (
          <g key={item.id} onClick={() => onItemClick(item.id)} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
            {/* Selection ring */}
            {isSelected && (
              <circle cx={x} cy={y} r={18} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
            )}
            {/* Main marker */}
            <circle cx={x} cy={y} r={8} fill={color} stroke="white" strokeWidth="2" opacity={isSelected ? 1 : 0.8} />
            {/* Inner dot */}
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

  const getItems = () => {
    switch (activeTab) {
      case 'orders':
        return statusFilter === 'all' ? mockOrders : mockOrders.filter((o) => o.status === statusFilter);
      case 'shipments':
        return statusFilter === 'all' ? mockShipments : mockShipments.filter((s) => s.status === statusFilter);
      case 'routes':
        return statusFilter === 'all' ? mockRoutes : mockRoutes.filter((r) => r.status === statusFilter);
      case 'drivers':
        return statusFilter === 'all' ? mockDrivers : mockDrivers.filter((d) => d.status === statusFilter);
      default:
        return [];
    }
  };

  const getStatusOptions = () => {
    if (activeTab === 'orders') return ['all', 'pending', 'in-transit', 'delivered', 'failed'];
    if (activeTab === 'shipments') return ['all', 'pending', 'in-transit'];
    if (activeTab === 'routes') return ['all', 'active', 'completed'];
    if (activeTab === 'drivers') return ['all', 'on-duty', 'on-break', 'off-duty'];
    return ['all'];
  };

  const getStatusBadgeColor = (status: string) => {
    const mapping: Record<string, string> = {
      'pending': 'bg-yellow-900 text-yellow-300',
      'in-transit': 'bg-blue-900 text-blue-300',
      'delivered': 'bg-green-900 text-green-300',
      'failed': 'bg-red-900 text-red-300',
      'active': 'bg-purple-900 text-purple-300',
      'completed': 'bg-green-900 text-green-300',
      'on-duty': 'bg-blue-900 text-blue-300',
      'on-break': 'bg-yellow-900 text-yellow-300',
      'off-duty': 'bg-gray-900 text-gray-300',
    };
    return mapping[status] || 'bg-gray-900 text-gray-300';
  };

  const selectedItem = getItems().find((item) => item.id === selectedId) as any;
  const items = getItems();

  return (
    <div className="p-6 min-h-screen bg-slate-950">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Map View</h1>
        <p className="text-slate-400">Real-time location tracking for orders, shipments, routes, and drivers</p>
      </div>

      {/* Tab Selector */}
      <Tabs
        tabs={[
          { id: 'orders', label: `Orders (${mockOrders.length})`, icon: <Package size={16} /> },
          { id: 'shipments', label: `Shipments (${mockShipments.length})`, icon: <Truck size={16} /> },
          { id: 'routes', label: `Routes (${mockRoutes.length})`, icon: <MapPin size={16} /> },
          { id: 'drivers', label: `Drivers (${mockDrivers.length})`, icon: <Users size={16} /> },
        ]}
        activeTab={activeTab}
        onChange={(value) => { setActiveTab(value as ViewTab); setSelectedId(null); }}
        variant="segment"
        className="mb-6"
      />

      <div className="grid grid-cols-[1fr_350px] gap-6">
            {/* Main Map Area */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardContent className="p-6">
                <div className="mb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100 mb-2">
                      {activeTab === 'orders' && 'Orders Map'}
                      {activeTab === 'shipments' && 'Shipments Map'}
                      {activeTab === 'routes' && 'Routes Map'}
                      {activeTab === 'drivers' && 'Drivers Map'}
                    </h2>
                    <p className="text-slate-400 text-sm">{items.length} items on map</p>
                  </div>
                  <div className="flex gap-2">&nbsp;
                    <Button
                      onClick={() => setZoom(Math.min(200, zoom + 20))}
                      className="bg-slate-700 border border-slate-600 text-slate-100 w-10 h-10 p-0 flex items-center justify-center hover:bg-slate-600"
                    >
                      <ZoomIn size={18} />
                    </Button>
                    <Button
                      onClick={() => setZoom(Math.max(50, zoom - 20))}
                      className="bg-slate-700 border border-slate-600 text-slate-100 w-10 h-10 p-0 flex items-center justify-center hover:bg-slate-600"
                    >
                      <ZoomOut size={18} />
                    </Button>
                    <div className="text-slate-400 text-xs pl-2 flex items-center">
                      {zoom}%
                    </div>
                  </div>
                </div>

                {/* Map Canvas */}
                <div className="flex justify-center mb-4">
                  <MapCanvas items={items} selectedId={selectedId} onItemClick={setSelectedId} zoom={zoom} mapType={activeTab} />
                </div>

                {/* Legend */}
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-xs font-semibold text-slate-400 mb-3">LEGEND</p>
                  <div className="grid grid-cols-2 gap-3">&nbsp;
                    {activeTab === 'orders' && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-xs text-slate-400">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-xs text-slate-400">In Transit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-xs text-slate-400">Delivered</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-xs text-slate-400">Failed</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'shipments' && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-xs text-slate-400">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-xs text-slate-400">In Transit</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-indigo-500" />
                          <span className="text-xs text-slate-400">Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-xs text-slate-400">Completed</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-xs text-slate-400">On Duty</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          <span className="text-xs text-slate-400">On Break</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-400" />
                          <span className="text-xs text-slate-400">Off Duty</span>
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
              <Card className="bg-slate-900 border border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter size={16} className="text-slate-400" />
                    <p className="text-sm font-semibold text-slate-100">Filter by Status</p>
                  </div>
                  <div className="flex flex-col gap-2">&nbsp;
                    {getStatusOptions().map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status as StatusFilter)}
                        className={cn(
                          'px-3 py-2 rounded text-xs font-medium cursor-pointer transition-all capitalize',
                          statusFilter === status
                            ? 'border border-indigo-500 bg-slate-800 text-indigo-400 font-semibold'
                            : 'border border-slate-600 bg-transparent text-slate-400 font-normal'
                        )}
                      >
                        {status === 'all' ? 'All Items' : status.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Items List */}
              <Card className="bg-slate-900 border border-slate-700 flex-1 overflow-hidden flex flex-col">
                <CardContent className="p-4 flex-1 overflow-y-auto max-h-96">
                  <p className="text-xs font-semibold text-slate-100 mb-3">ITEMS ({items.length})</p>
                  <div className="flex flex-col gap-2">&nbsp;
                    {items.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'p-3 rounded text-left transition-all',
                          selectedId === item.id
                            ? 'border border-indigo-500 bg-slate-800'
                            : 'border border-slate-700 bg-transparent'
                        )}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-100">{item.id}</span>
                          <Badge className="text-xs py-0 px-1.5">
                            {item.status.replace('-', ' ')}
                          </Badge>
                        </div>
                        {activeTab === 'orders' && (
                          <p className="text-xs text-slate-400">{item.address}</p>
                        )}
                        {activeTab === 'shipments' && (
                          <p className="text-xs text-slate-400">ETA: {item.eta}</p>
                        )}
                        {activeTab === 'routes' && (
                          <p className="text-xs text-slate-400">{item.stops} stops</p>
                        )}
                        {activeTab === 'drivers' && (
                          <p className="text-xs text-slate-400">{item.speed} km/h</p>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detail Panel */}
              {selectedItem && (
                <Card className="bg-slate-900 border border-indigo-500">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-indigo-400 mb-3">DETAILS</p>
                    {activeTab === 'orders' && (
                      <>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">ID</p>
                          <p className="text-xs text-slate-100">{selectedItem.id}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Customer</p>
                          <p className="text-xs text-slate-100">{selectedItem.customer}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Address</p>
                          <p className="text-xs text-slate-100">{selectedItem.address}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Coordinates</p>
                          <p className="text-xs text-slate-100">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'shipments' && (
                      <>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">ID</p>
                          <p className="text-xs text-slate-100">{selectedItem.id}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Carrier</p>
                          <p className="text-xs text-slate-100">{selectedItem.carrier}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">ETA</p>
                          <p className="text-xs text-slate-100">{selectedItem.eta}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Location</p>
                          <p className="text-xs text-slate-100">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Route</p>
                          <p className="text-xs text-slate-100">{selectedItem.name}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Driver</p>
                          <p className="text-xs text-slate-100">{selectedItem.driver}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Stops</p>
                          <p className="text-xs text-slate-100">{selectedItem.stops}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Current Location</p>
                          <p className="text-xs text-slate-100">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Name</p>
                          <p className="text-xs text-slate-100">{selectedItem.name}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Destination</p>
                          <p className="text-xs text-slate-100">{selectedItem.destination}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-1">Speed</p>
                          <p className="text-xs text-slate-100">{selectedItem.speed} km/h</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Location</p>
                          <p className="text-xs text-slate-100">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
    </div>
  );
}
