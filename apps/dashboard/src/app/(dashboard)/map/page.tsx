'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

type ViewTab = 'orders' | 'shipments' | 'routes' | 'drivers';
type StatusFilter = 'all' | 'pending' | 'in-transit' | 'delivered' | 'failed' | 'active' | 'completed' | 'on-duty' | 'on-break' | 'off-duty';

// Mock data
const mockOrders = [
  { id: "ORD-001", customer: "John Smith", address: "123 Main St", lat: 40.7128, lng: -74.006, status: "pending" },
  { id: "ORD-002", customer: "Jane Doe", address: "456 Oak Ave", lat: 40.7489, lng: -73.9680, status: "in-transit" },
  { id: "ORD-003", customer: "Bob Wilson", address: "789 Pine Rd", lat: 40.7614, lng: -73.9776, status: "delivered" },
];

const mockShipments = [
  { id: "SHP-001", carrier: "FedEx", eta: "2:30 PM", lat: 40.7200, lng: -73.9950, status: "pending" },
  { id: "SHP-002", carrier: "UPS", eta: "1:15 PM", lat: 40.7400, lng: -73.9500, status: "in-transit" },
];

const mockRoutes = [
  { id: "RT-001", name: "Downtown Route", driver: "Alex Johnson", stops: 12, lat: 40.7300, lng: -73.9850, status: "active" },
  { id: "RT-002", name: "Uptown Route", driver: "Maria Garcia", stops: 8, lat: 40.7700, lng: -73.9600, status: "completed" },
];

const mockDrivers = [
  { id: "DRV-001", name: "John Doe", destination: "Central Station", speed: 25, lat: 40.7450, lng: -73.9950, status: "on-duty" },
  { id: "DRV-002", name: "Jane Smith", destination: "Grand Central", speed: 0, lat: 40.7525, lng: -73.9772, status: "on-break" },
  { id: "DRV-003", name: "Bob Wilson", destination: "Home", speed: 0, lat: 40.6895, lng: -74.0450, status: "off-duty" },
];

const MapCanvas = ({ items, selectedId, onItemClick, zoom, mapType }: Record<string, unknown>) => {
  const canvasSize = 600;
  const minLat = 40.6895;
  const maxLat = 40.7700;
  const minLng = -74.0450;
  const maxLng = -73.9500;

  const normalizeCoords = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (canvasSize * (zoom / 100));
    const y = ((maxLat - lat) / (maxLat - minLat)) * (canvasSize * (zoom / 100));
    return { x: x + (canvasSize - canvasSize * (zoom / 100)) / 2, y: y + (canvasSize - canvasSize * (zoom / 100)) / 2 };
  };

  const getMarkerColor = (status: string, mapType: ViewTab) => {
    if (mapType === 'orders') {
      if (status === 'pending') return '#f59e0b';
      if (status === 'in-transit') return '#3b82f6';
      if (status === 'delivered') return '#10b981';
      if (status === 'failed') return '#ef4444';
    } else if (mapType === 'shipments') {
      if (status === 'pending') return '#f59e0b';
      if (status === 'in-transit') return '#3b82f6';
    } else if (mapType === 'routes') {
      if (status === 'active') return '#6C63FF';
      if (status === 'completed') return '#10b981';
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
      className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg"
      style={{ cursor: 'crosshair' }}
    >
      {Array.from({ length: 13 }).map((_, i) => (
        <g key={`grid-${i}`}>
          <line x1={i * (canvasSize / 12)} y1={0} x2={i * (canvasSize / 12)} y2={canvasSize} stroke="#1e1e2e" strokeWidth="0.5" />
          <line x1={0} y1={i * (canvasSize / 12)} x2={canvasSize} y2={i * (canvasSize / 12)} stroke="#1e1e2e" strokeWidth="0.5" />
        </g>
      ))}

      {items.map((item: Record<string, unknown>) => {
        const { x, y } = normalizeCoords(item.lat, item.lng);
        const color = getMarkerColor(item.status, mapType);
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

  const selectedItem = getItems().find((item) => item.id === selectedId) as any;
  const items = getItems();

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Map View</h1>
        <p className="text-gray-400">Real-time location tracking for orders, shipments, routes, and drivers</p>
      </div>

      {/* Tab Selector */}
      <div className="max-w-7xl mx-auto mb-6">
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
                  {activeTab === 'shipments' && 'Shipments Map'}
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
            <div className="flex justify-center mb-4">
              <MapCanvas items={items} selectedId={selectedId} onItemClick={setSelectedId} zoom={zoom} mapType={activeTab} />
            </div>

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
                {activeTab === 'shipments' && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-xs text-gray-400">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-xs text-gray-400">In Transit</span>
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
                      <span className="text-xs text-gray-400">On Duty</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-xs text-gray-400">On Break</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span className="text-xs text-gray-400">Off Duty</span>
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
                    onClick={() => setStatusFilter(status as StatusFilter)}
                    className={cn(
                      'px-3 py-2 rounded text-xs font-medium cursor-pointer transition-all capitalize',
                      statusFilter === status
                        ? 'border border-blue-500 bg-[#1a1a2e] text-blue-500 font-semibold'
                        : 'border border-[#1e1e2e] bg-transparent text-gray-400 font-normal'
                    )}
                  >
                    {status === 'all' ? 'All Items' : status.replace('-', ' ')}
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
                {items.map((item: Record<string, unknown>) => (
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
                      <span className="text-xs font-semibold text-white">{item.id}</span>
                      <Badge variant="default">{item.status.replace('-', ' ')}</Badge>
                    </div>
                    {activeTab === 'orders' && (
                      <p className="text-xs text-gray-400">{item.address}</p>
                    )}
                    {activeTab === 'shipments' && (
                      <p className="text-xs text-gray-400">ETA: {item.eta}</p>
                    )}
                    {activeTab === 'routes' && (
                      <p className="text-xs text-gray-400">{item.stops} stops</p>
                    )}
                    {activeTab === 'drivers' && (
                      <p className="text-xs text-gray-400">{item.speed} km/h</p>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detail Panel */}
          {selectedItem && (
            <Card className="bg-[#12121a] border border-blue-500/30">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-blue-500 mb-3 uppercase">Details</p>
                {activeTab === 'orders' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">ID</p>
                      <p className="text-xs text-white">{selectedItem.id}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Customer</p>
                      <p className="text-xs text-white">{selectedItem.customer}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Address</p>
                      <p className="text-xs text-white">{selectedItem.address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Coordinates</p>
                      <p className="text-xs text-white">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                    </div>
                  </>
                )}
                {activeTab === 'shipments' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">ID</p>
                      <p className="text-xs text-white">{selectedItem.id}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Carrier</p>
                      <p className="text-xs text-white">{selectedItem.carrier}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">ETA</p>
                      <p className="text-xs text-white">{selectedItem.eta}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Location</p>
                      <p className="text-xs text-white">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                    </div>
                  </>
                )}
                {activeTab === 'routes' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Route</p>
                      <p className="text-xs text-white">{selectedItem.name}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Driver</p>
                      <p className="text-xs text-white">{selectedItem.driver}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Stops</p>
                      <p className="text-xs text-white">{selectedItem.stops}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Current Location</p>
                      <p className="text-xs text-white">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                    </div>
                  </>
                )}
                {activeTab === 'drivers' && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Name</p>
                      <p className="text-xs text-white">{selectedItem.name}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Destination</p>
                      <p className="text-xs text-white">{selectedItem.destination}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Speed</p>
                      <p className="text-xs text-white">{selectedItem.speed} km/h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Location</p>
                      <p className="text-xs text-white">{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
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
