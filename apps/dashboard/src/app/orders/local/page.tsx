'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import {
  Package,
  MapPin,
  Clock,
  User,
  Truck,
  CheckCircle,
  AlertCircle,
  Filter,
  Download,
  RefreshCw,
  ChevronRight,
  Calendar,
  Phone,
  Mail,
} from 'lucide-react';

// Mock local delivery orders
const mockOrders = [
  {
    id: 'ORD-1001',
    customer: 'John Doe',
    phone: '+1 (555) 123-4567',
    email: 'john@example.com',
    address: '123 Broadway, NYC',
    timeWindow: '9:00 AM - 12:00 PM',
    items: 3,
    amount: 85.50,
    status: 'pending',
    priority: 'normal',
    driver: null,
    eta: null,
    lat: 40.7128,
    lng: -74.006,
  },
  {
    id: 'ORD-1002',
    customer: 'Jane Smith',
    phone: '+1 (555) 234-5678',
    email: 'jane@example.com',
    address: '456 5th Ave, NYC',
    timeWindow: '12:00 PM - 3:00 PM',
    items: 1,
    amount: 42.00,
    status: 'pending',
    priority: 'high',
    driver: null,
    eta: null,
    lat: 40.758,
    lng: -73.9855,
  },
  {
    id: 'ORD-1003',
    customer: 'Bob Johnson',
    phone: '+1 (555) 345-6789',
    email: 'bob@example.com',
    address: '789 Park Ave, NYC',
    timeWindow: '3:00 PM - 6:00 PM',
    items: 2,
    amount: 125.75,
    status: 'assigned',
    priority: 'normal',
    driver: 'Carlos M.',
    eta: '3:45 PM',
    lat: 40.7489,
    lng: -73.968,
  },
  {
    id: 'ORD-1004',
    customer: 'Alice Brown',
    phone: '+1 (555) 456-7890',
    email: 'alice@example.com',
    address: '321 Madison Ave, NYC',
    timeWindow: '9:00 AM - 12:00 PM',
    items: 5,
    amount: 210.25,
    status: 'pending',
    priority: 'normal',
    driver: null,
    eta: null,
    lat: 40.7505,
    lng: -73.9972,
  },
  {
    id: 'ORD-1005',
    customer: 'Charlie Wilson',
    phone: '+1 (555) 567-8901',
    email: 'charlie@example.com',
    address: '654 3rd Ave, NYC',
    timeWindow: '12:00 PM - 3:00 PM',
    items: 2,
    amount: 95.00,
    status: 'in-delivery',
    priority: 'high',
    driver: 'Sofia L.',
    eta: '2:30 PM',
    lat: 40.7614,
    lng: -73.9776,
  },
  {
    id: 'ORD-1006',
    customer: 'Diana Martinez',
    phone: '+1 (555) 678-9012',
    email: 'diana@example.com',
    address: '987 2nd Ave, NYC',
    timeWindow: '3:00 PM - 6:00 PM',
    items: 1,
    amount: 65.50,
    status: 'delivered',
    priority: 'normal',
    driver: 'Ahmed K.',
    eta: 'Delivered',
    lat: 40.7549,
    lng: -73.984,
  },
  {
    id: 'ORD-1007',
    customer: 'Eve Davis',
    phone: '+1 (555) 789-0123',
    email: 'eve@example.com',
    address: '246 1st Ave, NYC',
    timeWindow: '9:00 AM - 12:00 PM',
    items: 4,
    amount: 155.00,
    status: 'pending',
    priority: 'normal',
    driver: null,
    eta: null,
    lat: 40.7505,
    lng: -73.968,
  },
  {
    id: 'ORD-1008',
    customer: 'Frank Miller',
    phone: '+1 (555) 890-1234',
    email: 'frank@example.com',
    address: '135 Lexington Ave, NYC',
    timeWindow: '12:00 PM - 3:00 PM',
    items: 3,
    amount: 108.75,
    status: 'pending',
    priority: 'low',
    driver: null,
    eta: null,
    lat: 40.7614,
    lng: -73.968,
  },
];

interface Order {
  id: string;
  customer: string;
  phone: string;
  email: string;
  address: string;
  timeWindow: string;
  items: number;
  amount: number;
  status: string;
  priority: string;
  driver: string | null;
  eta: string | null;
  lat: number;
  lng: number;
}

const MapGrid = ({ orders = [], selectedId, onSelectOrder }: any) => {
  const gridSize = 500;
  const minLat = 40.7100;
  const maxLat = 40.7750;
  const minLng = -74.0150;
  const maxLng = -73.9400;

  const normalizeCoords = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * gridSize;
    const y = ((maxLat - lat) / (maxLat - minLat)) * gridSize;
    return { x, y };
  };

  const getStatusColor = (status: string) => {
    if (status === 'delivered') return '#22c55e';
    if (status === 'in-delivery') return '#3b82f6';
    if (status === 'assigned') return '#6C63FF';
    return '#f59e0b';
  };

  return (
    <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
      <CardHeader style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
        <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={18} style={{ color: '#6C63FF' }} /> Delivery Map
        </CardTitle>
      </CardHeader>
      <CardContent style={{ padding: '16px' }}>
        <svg
          width={gridSize}
          height={gridSize}
          style={{
            backgroundColor: '#0f0f15',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            cursor: 'crosshair',
            marginBottom: '12px',
          }}
        >
          {/* Grid background */}
          {Array.from({ length: 11 }).map((_, i) => (
            <g key={`grid-${i}`}>
              <line x1={i * (gridSize / 10)} y1={0} x2={i * (gridSize / 10)} y2={gridSize} stroke="#1e293b" strokeWidth="0.5" />
              <line x1={0} y1={i * (gridSize / 10)} x2={gridSize} y2={i * (gridSize / 10)} stroke="#1e293b" strokeWidth="0.5" />
            </g>
          ))}

          {/* Plot orders */}
          {orders.map((order: any) => {
            const { x, y } = normalizeCoords(order.lat, order.lng);
            const color = getStatusColor(order.status);
            const isSelected = order.id === selectedId;

            return (
              <g key={order.id} onClick={() => onSelectOrder(order.id)} style={{ cursor: 'pointer' }}>
                {isSelected && <circle cx={x} cy={y} r={16} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />}
                <circle cx={x} cy={y} r={8} fill={color} stroke="white" strokeWidth="2" opacity={isSelected ? 1 : 0.8} />
                <circle cx={x} cy={y} r={3} fill="white" />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span style={{ color: '#94a3b8' }}>Pending</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6C63FF' }} />
            <span style={{ color: '#94a3b8' }}>Assigned</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
            <span style={{ color: '#94a3b8' }}>In Delivery</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span style={{ color: '#94a3b8' }}>Delivered</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function LocalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const filteredOrders = orders.filter((o) => {
    const statusMatch = statusFilter === 'all' || o.status === statusFilter;
    const priorityMatch = priorityFilter === 'all' || o.priority === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const handleSelectOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    setSelectedOrder(order || null);
  };

  const handleToggleSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const handleAssignDriver = (orderId: string, driver: string) => {
    setOrders(
      orders.map((o) =>
        o.id === orderId ? { ...o, status: 'assigned', driver, eta: '2:30 PM' } : o,
      ),
    );
    setSelectedOrder(null);
  };

  const handleBulkAssign = () => {
    const unassignedSelected = Array.from(selectedOrderIds).filter((id) => {
      const order = orders.find((o) => o.id === id);
      return order && order.status === 'pending';
    });

    if (unassignedSelected.length > 0) {
      const drivers = ['Carlos M.', 'Sofia L.', 'Ahmed K.', 'Lisa T.'];
      setOrders(
        orders.map((o) => {
          if (unassignedSelected.includes(o.id)) {
            const driver = drivers[Math.floor(Math.random() * drivers.length)];
            return { ...o, status: 'assigned', driver, eta: '3:15 PM' };
          }
          return o;
        }),
      );
      setSelectedOrderIds(new Set());
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const assignedCount = orders.filter((o) => o.status === 'assigned').length;
  const inDeliveryCount = orders.filter((o) => o.status === 'in-delivery').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px' }}>Local Delivery Orders</h1>
        <p style={{ color: '#94a3b8', marginBottom: '16px' }}>Today's deliveries in {orders.length} locations</p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', padding: '12px 16px', minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Pending</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#f59e0b' }}>{pendingCount}</div>
            </Card>
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', padding: '12px 16px', minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Assigned</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#6C63FF' }}>{assignedCount}</div>
            </Card>
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', padding: '12px 16px', minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>In Delivery</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#3b82f6' }}>{inDeliveryCount}</div>
            </Card>
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', padding: '12px 16px', minWidth: '120px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Delivered</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#22c55e' }}>{deliveredCount}</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapGrid orders={filteredOrders} selectedId={selectedOrder?.id} onSelectOrder={handleSelectOrder} />

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        {/* Left Column - Orders List */}
        <div>
          {/* Filters and Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Select value={statusFilter} onChange={(v) => setStatusFilter(v)} style={{ minWidth: '150px' }} options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in-delivery', label: 'In Delivery' },
              { value: 'delivered', label: 'Delivered' },
            ]} />

            <Select value={priorityFilter} onChange={(v) => setPriorityFilter(v)} style={{ minWidth: '120px' }} options={[
              { value: 'all', label: 'All Priorities' },
              { value: 'high', label: 'High' },
              { value: 'normal', label: 'Normal' },
              { value: 'low', label: 'Low' },
            ]} />

            {selectedOrderIds.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkAssign}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
              >
                <Truck size={14} /> Assign {selectedOrderIds.size}
              </Button>
            )}

            <Button variant="ghost" size="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export
            </Button>
          </div>

          {/* Orders List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                style={{
                  backgroundColor: selectedOrder?.id === order.id ? '#1a1a24' : '#12121a',
                  border: selectedOrder?.id === order.id ? '2px solid #6C63FF' : '1px solid #1e293b',
                  cursor: 'pointer',
                }}
                onClick={() => handleSelectOrder(order.id)}
              >
                <CardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={() => handleToggleSelect(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        marginTop: '2px',
                        accentColor: '#6C63FF',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{order.id}</p>
                        <Badge
                          variant={
                            order.status === 'delivered'
                              ? 'success'
                              : order.status === 'in-delivery'
                                ? 'primary'
                                : order.status === 'assigned'
                                  ? 'info'
                                  : 'warning'
                          }
                        >
                          {order.status.replace('-', ' ').toUpperCase()}
                        </Badge>
                      </div>

                      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{order.customer}</p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {order.timeWindow}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Package size={12} /> {order.items} items
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} /> {order.address}
                        </span>
                        <span style={{ fontSize: '11px', color: '#6C63FF', fontWeight: '600' }}>${order.amount.toFixed(2)}</span>
                      </div>

                      {order.driver && (
                        <div style={{ padding: '8px', backgroundColor: '#0a0a0f', borderRadius: '4px', fontSize: '11px' }}>
                          <p style={{ color: '#6C63FF', fontWeight: '600' }}>Assigned: {order.driver}</p>
                          {order.eta && <p style={{ color: '#94a3b8', marginTop: '2px' }}>ETA: {order.eta}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Order Detail */}
        <div>
          {selectedOrder ? (
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', position: 'sticky', top: '24px' }}>
              <CardHeader style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
                <CardTitle style={{ fontSize: '16px' }}>{selectedOrder.id}</CardTitle>
              </CardHeader>
              <CardContent style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Customer Info */}
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} /> Customer
                  </p>
                  <p style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600' }}>{selectedOrder.customer}</p>
                  <a
                    href={`tel:${selectedOrder.phone}`}
                    style={{ fontSize: '11px', color: '#6C63FF', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                  >
                    <Phone size={12} /> {selectedOrder.phone}
                  </a>
                  <a
                    href={`mailto:${selectedOrder.email}`}
                    style={{ fontSize: '11px', color: '#6C63FF', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                  >
                    <Mail size={12} /> {selectedOrder.email}
                  </a>
                </div>

                {/* Delivery Details */}
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> Delivery
                  </p>
                  <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedOrder.address}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {selectedOrder.timeWindow}
                  </p>
                </div>

                {/* Order Details */}
                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Items</p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{selectedOrder.items}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>Total</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#6C63FF' }}>${selectedOrder.amount.toFixed(2)}</p>
                  </div>
                </div>

                {/* Driver Assignment */}
                {selectedOrder.status === 'pending' ? (
                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Assign Driver</p>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {['Carlos M.', 'Sofia L.', 'Ahmed K.'].map((driver) => (
                        <Button
                          key={driver}
                          variant="secondary"
                          size="sm"
                          style={{ fontSize: '11px', justifyContent: 'flex-start' }}
                          onClick={() => handleAssignDriver(selectedOrder.id, driver)}
                        >
                          <Truck size={12} style={{ marginRight: '6px' }} /> {driver}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px', backgroundColor: '#0a0a0f', borderRadius: '6px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Assigned Driver</p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{selectedOrder.driver}</p>
                    {selectedOrder.eta && <p style={{ fontSize: '11px', color: '#6C63FF', marginTop: '4px' }}>ETA: {selectedOrder.eta}</p>}
                  </div>
                )}

                {/* Action Buttons */}
                <Button
                  variant="primary"
                  size="md"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <ChevronRight size={14} /> View Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
              <CardContent style={{ padding: '24px', textAlign: 'center' }}>
                <AlertCircle size={24} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Select an order to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
