'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { cn } from '../../../lib/utils';
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
    <Card className="bg-slate-950 border-slate-700 mb-6">
      <CardHeader className="pb-3 border-b border-slate-700">
        <CardTitle className="flex items-center gap-2">
          <MapPin size={18} className="text-indigo-500" /> Delivery Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <svg
          width={gridSize}
          height={gridSize}
          className="bg-slate-900 border border-slate-700 rounded mb-3 cursor-crosshair"
        >
          {Array.from({ length: 11 }).map((_, i) => (
            <g key={`grid-${i}`}>
              <line x1={i * (gridSize / 10)} y1={0} x2={i * (gridSize / 10)} y2={gridSize} stroke="#1e293b" strokeWidth="0.5" />
              <line x1={0} y1={i * (gridSize / 10)} x2={gridSize} y2={i * (gridSize / 10)} stroke="#1e293b" strokeWidth="0.5" />
            </g>
          ))}

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

        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { color: '#f59e0b', label: 'Pending' },
            { color: '#6C63FF', label: 'Assigned' },
            { color: '#3b82f6', label: 'In Delivery' },
            { color: '#22c55e', label: 'Delivered' }
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400">{item.label}</span>
            </div>
          ))}
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
    <div className="p-6 min-h-screen bg-slate-950">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Local Delivery Orders</h1>
        <p className="text-slate-400 mb-4">Today's deliveries in {orders.length} locations</p>

        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-3">
            {[
              { label: 'Pending', count: pendingCount, color: '#f59e0b' },
              { label: 'Assigned', count: assignedCount, color: '#6C63FF' },
              { label: 'In Delivery', count: inDeliveryCount, color: '#3b82f6' },
              { label: 'Delivered', count: deliveredCount, color: '#22c55e' }
            ].map((stat) => (
              <Card key={stat.label} className="bg-slate-900 border-slate-700 p-4 min-w-[120px]">
                <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
                <div className="text-lg font-semibold" style={{ color: stat.color }}>{stat.count}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <MapGrid orders={filteredOrders} selectedId={selectedOrder?.id} onSelectOrder={handleSelectOrder} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        {/* Left Column - Orders List */}
        <div>
          {/* Filters and Actions */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
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
                className="flex items-center gap-1.5 ml-auto"
              >
                <Truck size={14} /> Assign {selectedOrderIds.size}
              </Button>
            )}

            <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
              <Download size={14} /> Export
            </Button>
          </div>

          {/* Orders List */}
          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  'cursor-pointer transition-all',
                  selectedOrder?.id === order.id
                    ? 'bg-slate-800 border-indigo-500 border-2'
                    : 'bg-slate-900 border-slate-700'
                )}
                onClick={() => handleSelectOrder(order.id)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3 items-start">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={() => handleToggleSelect(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4.5 h-4.5 cursor-pointer mt-0.5 accent-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-slate-100">{order.id}</p>
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

                      <p className="text-xs text-slate-400 mb-2">{order.customer}</p>

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} /> {order.timeWindow}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Package size={12} /> {order.items} items
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={12} /> {order.address}
                        </span>
                        <span className="text-sm font-semibold text-indigo-400">${order.amount.toFixed(2)}</span>
                      </div>

                      {order.driver && (
                        <div className="p-2 bg-slate-950 rounded text-xs">
                          <p className="text-indigo-400 font-semibold">Assigned: {order.driver}</p>
                          {order.eta && <p className="text-slate-400 mt-0.5">ETA: {order.eta}</p>}
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
            <Card className="bg-slate-900 border-slate-700 sticky top-6">
              <CardHeader className="pb-3 border-b border-slate-700">
                <CardTitle className="text-base">{selectedOrder.id}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <p className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                    <User size={14} /> Customer
                  </p>
                  <p className="text-sm font-semibold text-slate-100">{selectedOrder.customer}</p>
                  <a
                    href={`tel:${selectedOrder.phone}`}
                    className="text-xs text-indigo-400 flex items-center gap-1 mt-1"
                  >
                    <Phone size={12} /> {selectedOrder.phone}
                  </a>
                  <a
                    href={`mailto:${selectedOrder.email}`}
                    className="text-xs text-indigo-400 flex items-center gap-1 mt-0.5"
                  >
                    <Mail size={12} /> {selectedOrder.email}
                  </a>
                </div>

                {/* Delivery Details */}
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin size={14} /> Delivery
                  </p>
                  <p className="text-xs text-slate-100">{selectedOrder.address}</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Calendar size={12} /> {selectedOrder.timeWindow}
                  </p>
                </div>

                {/* Order Details */}
                <div className="border-t border-slate-700 pt-3">
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 mb-0.5">Items</p>
                    <p className="text-sm font-semibold text-slate-100">{selectedOrder.items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Total</p>
                    <p className="text-base font-semibold text-indigo-400">${selectedOrder.amount.toFixed(2)}</p>
                  </div>
                </div>

                {/* Driver Assignment */}
                {selectedOrder.status === 'pending' ? (
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-xs text-slate-400 font-semibold mb-2">Assign Driver</p>
                    <div className="flex flex-col gap-1.5">
                      {['Carlos M.', 'Sofia L.', 'Ahmed K.'].map((driver) => (
                        <Button
                          key={driver}
                          variant="secondary"
                          size="sm"
                          className="text-xs justify-start"
                          onClick={() => handleAssignDriver(selectedOrder.id, driver)}
                        >
                          <Truck size={12} className="mr-1.5" /> {driver}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-700 pt-3 bg-slate-950 rounded p-3">
                    <p className="text-xs text-slate-400 mb-1">Assigned Driver</p>
                    <p className="text-sm font-semibold text-slate-100">{selectedOrder.driver}</p>
                    {selectedOrder.eta && <p className="text-xs text-indigo-400 mt-1">ETA: {selectedOrder.eta}</p>}
                  </div>
                )}

                {/* Action Buttons */}
                <Button
                  variant="primary"
                  size="md"
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <ChevronRight size={14} /> View Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-6 text-center">
                <AlertCircle size={24} className="text-slate-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select an order to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
