'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs } from '../../components/ui/tabs';
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
const mockOrders = [
  { id: 'ORD-001', lat: 40.7128, lng: -74.006, status: 'pending', address: '123 Broadway, NYC', customer: 'John Doe' },
  { id: 'ORD-002', lat: 40.758, lng: -73.9855, status: 'in-transit', address: '456 5th Ave, NYC', customer: 'Jane Smith' },
  { id: 'ORD-003', lat: 40.7489, lng: -73.968, status: 'delivered', address: '789 Park Ave, NYC', customer: 'Bob Johnson' },
  { id: 'ORD-004', lat: 40.7505, lng: -73.9972, status: 'pending', address: '321 Madison Ave, NYC', customer: 'Alice Brown' },
  { id: 'ORD-005', lat: 40.7614, lng: -73.9776, status: 'in-transit', address: '654 3rd Ave, NYC', customer: 'Charlie Wilson' },
  { id: 'ORD-006', lat: 40.7549, lng: -73.9840, status: 'delivered', address: '987 2nd Ave, NYC', customer: 'Diana Martinez' },
  { id: 'ORD-007', lat: 40.7505, lng: -73.9680, status: 'pending', address: '246 1st Ave, NYC', customer: 'Eve Davis' },
  { id: 'ORD-008', lat: 40.7614, lng: -73.9680, status: 'failed', address: '135 Lexington Ave, NYC', customer: 'Frank Miller' },
  { id: 'ORD-009', lat: 40.7480, lng: -73.9862, status: 'in-transit', address: '357 Broadway, NYC', customer: 'Grace Lee' },
  { id: 'ORD-010', lat: 40.7549, lng: -73.9945, status: 'delivered', address: '789 5th Ave, NYC', customer: 'Henry White' },
  { id: 'ORD-011', lat: 40.7614, lng: -73.9862, status: 'pending', address: '456 Park Ave, NYC', customer: 'Iris Garcia' },
  { id: 'ORD-012', lat: 40.7489, lng: -73.9945, status: 'in-transit', address: '123 Madison Ave, NYC', customer: 'Jack Robinson' },
  { id: 'ORD-013', lat: 40.7480, lng: -73.9776, status: 'delivered', address: '654 3rd Ave, NYC', customer: 'Karen Thomas' },
  { id: 'ORD-014', lat: 40.7505, lng: -73.9862, status: 'failed', address: '987 2nd Ave, NYC', customer: 'Leo Jackson' },
  { id: 'ORD-015', lat: 40.7549, lng: -73.9680, status: 'pending', address: '246 1st Ave, NYC', customer: 'Mia Anderson' },
];

const mockShipments = [
  { id: 'SHP-001', lat: 40.7205, lng: -74.0098, status: 'in-transit', carrier: 'FedEx', eta: '2:30 PM' },
  { id: 'SHP-002', lat: 40.7300, lng: -73.9900, status: 'in-transit', carrier: 'UPS', eta: '3:15 PM' },
  { id: 'SHP-003', lat: 40.7400, lng: -73.9750, status: 'in-transit', carrier: 'DHL', eta: '4:00 PM' },
  { id: 'SHP-004', lat: 40.7500, lng: -73.9650, status: 'pending', carrier: 'FedEx', eta: 'TBD' },
  { id: 'SHP-005', lat: 40.7600, lng: -73.9550, status: 'in-transit', carrier: 'UPS', eta: '1:45 PM' },
  { id: 'SHP-006', lat: 40.7700, lng: -73.9450, status: 'in-transit', carrier: 'DHL', eta: '2:00 PM' },
  { id: 'SHP-007', lat: 40.7300, lng: -74.0000, status: 'in-transit', carrier: 'FedEx', eta: '3:30 PM' },
  { id: 'SHP-008', lat: 40.7450, lng: -73.9800, status: 'pending', carrier: 'UPS', eta: 'TBD' },
  { id: 'SHP-009', lat: 40.7550, lng: -73.9700, status: 'in-transit', carrier: 'DHL', eta: '4:15 PM' },
  { id: 'SHP-010', lat: 40.7650, lng: -73.9600, status: 'in-transit', carrier: 'FedEx', eta: '1:30 PM' },
];

const mockRoutes = [
  { id: 'RTE-001', name: 'Manhattan North Loop', stops: 12, status: 'active', driver: 'Michael Brown', lat: 40.7614, lng: -73.9776 },
  { id: 'RTE-002', name: 'Midtown Express', stops: 8, status: 'active', driver: 'Sarah Connor', lat: 40.7505, lng: -73.9880 },
  { id: 'RTE-003', name: 'Downtown Circuit', stops: 15, status: 'active', driver: 'Tom Hardy', lat: 40.7128, lng: -74.006 },
  { id: 'RTE-004', name: 'Upper East Side', stops: 10, status: 'completed', driver: 'Emma Stone', lat: 40.7700, lng: -73.9500 },
  { id: 'RTE-005', name: 'West Side Coverage', stops: 11, status: 'active', driver: 'Ryan Gosling', lat: 40.7450, lng: -74.0050 },
];

const mockDrivers = [
  { id: 'DRV-001', name: 'Michael Brown', status: 'on-duty', lat: 40.7614, lng: -73.9776, speed: 25, destination: 'Times Square' },
  { id: 'DRV-002', name: 'Sarah Connor', status: 'on-duty', lat: 40.7505, lng: -73.9880, speed: 18, destination: 'Central Park' },
  { id: 'DRV-003', name: 'Tom Hardy', status: 'on-duty', lat: 40.7128, lng: -74.006, speed: 22, destination: 'Battery Park' },
  { id: 'DRV-004', name: 'Emma Stone', status: 'on-break', lat: 40.7700, lng: -73.9500, speed: 0, destination: 'Lunch Break' },
  { id: 'DRV-005', name: 'Ryan Gosling', status: 'on-duty', lat: 40.7450, lng: -74.0050, speed: 30, destination: 'Hudson Yards' },
  { id: 'DRV-006', name: 'Zoe Saldana', status: 'off-duty', lat: 40.7680, lng: -73.9810, speed: 0, destination: 'Depot' },
  { id: 'DRV-007', name: 'Chris Evans', status: 'on-duty', lat: 40.7549, lng: -73.9840, speed: 20, destination: 'Bryant Park' },
  { id: 'DRV-008', name: 'Scarlett Johansson', status: 'on-duty', lat: 40.7480, lng: -73.9862, speed: 28, destination: 'Grand Central' },
];

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
      style={{
        backgroundColor: '#0f0f15',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        cursor: 'crosshair',
      }}
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
          <g key={item.id} onClick={() => onItemClick(item.id)} style={{ cursor: 'pointer' }}>
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
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px' }}>Map View</h1>
        <p style={{ color: '#94a3b8' }}>Real-time location tracking for orders, shipments, routes, and drivers</p>
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
        style={{ marginBottom: '24px' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
            {/* Main Map Area */}
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
              <CardContent style={{ padding: '24px' }}>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
                      {activeTab === 'orders' && 'Orders Map'}
                      {activeTab === 'shipments' && 'Shipments Map'}
                      {activeTab === 'routes' && 'Routes Map'}
                      {activeTab === 'drivers' && 'Drivers Map'}
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>{items.length} items on map</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      onClick={() => setZoom(Math.min(200, zoom + 20))}
                      style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        color: '#e2e8f0',
                        width: '40px',
                        height: '40px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ZoomIn size={18} />
                    </Button>
                    <Button
                      onClick={() => setZoom(Math.max(50, zoom - 20))}
                      style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        color: '#e2e8f0',
                        width: '40px',
                        height: '40px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ZoomOut size={18} />
                    </Button>
                    <div style={{ color: '#94a3b8', fontSize: '12px', paddingLeft: '8px', display: 'flex', alignItems: 'center' }}>
                      {zoom}%
                    </div>
                  </div>
                </div>

                {/* Map Canvas */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <MapCanvas items={items} selectedId={selectedId} onItemClick={setSelectedId} zoom={zoom} mapType={activeTab} />
                </div>

                {/* Legend */}
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>LEGEND</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {activeTab === 'orders' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Pending</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>In Transit</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Delivered</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Failed</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'shipments' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Pending</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>In Transit</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#6C63FF' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Active</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Completed</span>
                        </div>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>On Duty</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>On Break</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Off Duty</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar - Items List & Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filter Card */}
              <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
                <CardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Filter size={16} style={{ color: '#94a3b8' }} />
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>Filter by Status</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {getStatusOptions().map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status as StatusFilter)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: statusFilter === status ? '1px solid #6C63FF' : '1px solid #334155',
                          backgroundColor: statusFilter === status ? '#1a1a2e' : 'transparent',
                          color: statusFilter === status ? '#6C63FF' : '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: statusFilter === status ? '600' : '400',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s',
                        }}
                      >
                        {status === 'all' ? 'All Items' : status.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Items List */}
              <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <CardContent style={{ padding: '16px', flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>ITEMS ({items.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                          padding: '12px',
                          borderRadius: '6px',
                          border: selectedId === item.id ? '1px solid #6C63FF' : '1px solid #1e293b',
                          backgroundColor: selectedId === item.id ? '#1a1a2e' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{item.id}</span>
                          <Badge style={{ fontSize: '10px', padding: '2px 6px' }}>
                            {item.status.replace('-', ' ')}
                          </Badge>
                        </div>
                        {activeTab === 'orders' && (
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{item.address}</p>
                        )}
                        {activeTab === 'shipments' && (
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>ETA: {item.eta}</p>
                        )}
                        {activeTab === 'routes' && (
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{item.stops} stops</p>
                        )}
                        {activeTab === 'drivers' && (
                          <p style={{ fontSize: '11px', color: '#94a3b8' }}>{item.speed} km/h</p>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detail Panel */}
              {selectedItem && (
                <Card style={{ backgroundColor: '#12121a', border: '1px solid #6C63FF' }}>
                  <CardContent style={{ padding: '16px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#6C63FF', marginBottom: '12px' }}>DETAILS</p>
                    {activeTab === 'orders' && (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ID</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.id}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Customer</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.customer}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Address</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.address}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Coordinates</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'shipments' && (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ID</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.id}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Carrier</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.carrier}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ETA</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.eta}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Location</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Route</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.name}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Driver</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.driver}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Stops</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.stops}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Current Location</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
                        </div>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Name</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.name}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Destination</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.destination}</p>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Speed</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.speed} km/h</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Location</p>
                          <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedItem.lat.toFixed(4)}, {selectedItem.lng.toFixed(4)}</p>
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
