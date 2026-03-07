'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import {
  Package,
  MapPin,
  User,
  Truck,
  Clock,
  Weight,
  Zap,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Search,
  GripVertical,
} from 'lucide-react';

// Mock data
const mockShipments = [
  { id: 'SHP-001', customer: 'John Doe', address: '123 Broadway, NYC', weight: 2.5, items: 3, priority: 'high', eta: '2:30 PM', assigned: false },
  { id: 'SHP-002', customer: 'Jane Smith', address: '456 5th Ave, NYC', weight: 1.2, items: 1, priority: 'normal', eta: '3:15 PM', assigned: false },
  { id: 'SHP-003', customer: 'Bob Johnson', address: '789 Park Ave, NYC', weight: 3.8, items: 5, priority: 'normal', eta: '4:00 PM', assigned: false },
  { id: 'SHP-004', customer: 'Alice Brown', address: '321 Madison Ave, NYC', weight: 0.8, items: 1, priority: 'low', eta: '4:45 PM', assigned: false },
  { id: 'SHP-005', customer: 'Charlie Wilson', address: '654 3rd Ave, NYC', weight: 2.1, items: 2, priority: 'high', eta: '2:15 PM', assigned: false },
  { id: 'SHP-006', customer: 'Diana Martinez', address: '987 2nd Ave, NYC', weight: 1.5, items: 2, priority: 'normal', eta: '5:00 PM', assigned: false },
];

const mockRoute = {
  id: 'RTE-001',
  name: 'Manhattan North Loop',
  driver: { id: 'DRV-001', name: 'Michael Brown', vehicle: 'Van-001', capacity: 50 },
  currentStops: 5,
  maxStops: 15,
  currentWeight: 18.5,
  maxWeight: 100,
  currentCapacity: 37,
  eta: '6:30 PM',
  status: 'active',
};

interface Shipment {
  id: string;
  customer: string;
  address: string;
  weight: number;
  items: number;
  priority: string;
  eta: string;
  assigned: boolean;
}

const getPriorityColor = (priority: string) => {
  if (priority === 'high') return 'danger';
  if (priority === 'low') return 'info';
  return 'default';
};

export default function RouteAssignPage({ params }: { params: { id: string } }) {
  const routeId = params.id || 'RTE-001';
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [assignedShipments, setAssignedShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [currentCapacity, setCurrentCapacity] = useState(mockRoute.currentCapacity);
  const [currentWeight, setCurrentWeight] = useState(mockRoute.currentWeight);

  const filteredShipments = searchQuery
    ? shipments.filter(
        (s) =>
          s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : shipments;

  const handleAssign = (shipment: Shipment) => {
    const newCapacity = currentCapacity - 1;
    const newWeight = currentWeight + shipment.weight;

    if (newCapacity < 0 || newWeight > mockRoute.maxWeight) {
      return;
    }

    setAssignedShipments([...assignedShipments, shipment]);
    setShipments(shipments.filter((s) => s.id !== shipment.id));
    setCurrentCapacity(newCapacity);
    setCurrentWeight(newWeight);
    setSelectedShipment(null);
  };

  const handleUnassign = (shipment: Shipment) => {
    setAssignedShipments(assignedShipments.filter((s) => s.id !== shipment.id));
    setShipments([...shipments, shipment]);
    setCurrentCapacity(currentCapacity + 1);
    setCurrentWeight(currentWeight - shipment.weight);
  };

  const handleOptimize = () => {
    const sorted = [...assignedShipments].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    });
    setAssignedShipments(sorted);
  };

  const totalAssignedWeight = assignedShipments.reduce((sum, s) => sum + s.weight, 0);
  const capacityUsed = ((mockRoute.currentWeight + totalAssignedWeight) / mockRoute.maxWeight) * 100;
  const stopsUsed = (mockRoute.currentStops + assignedShipments.length) / mockRoute.maxStops;

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px' }}>{mockRoute.name}</h1>
        <p style={{ color: '#94a3b8', marginBottom: '16px' }}>Assign shipments to this route</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant="success">ACTIVE</Badge>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Driver: {mockRoute.driver.name}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Vehicle: {mockRoute.driver.vehicle}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>ETA: {mockRoute.eta}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        {/* Left Column - Unassigned Shipments */}
        <div>
          {/* Search Bar */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <CardContent style={{ padding: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6C63FF' }} />
                <Input
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    paddingLeft: '36px',
                    width: '100%',
                    backgroundColor: '#0a0a0f',
                    border: '1px solid #1e293b',
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipment List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredShipments.length > 0 ? (
              filteredShipments.map((shipment) => (
                <Card
                  key={shipment.id}
                  style={{
                    backgroundColor: selectedShipment?.id === shipment.id ? '#1a1a24' : '#12121a',
                    border: selectedShipment?.id === shipment.id ? '2px solid #6C63FF' : '1px solid #1e293b',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                  onClick={() => setSelectedShipment(selectedShipment?.id === shipment.id ? null : shipment)}
                >
                  <CardContent style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                        <Package size={16} style={{ color: '#6C63FF' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{shipment.id}</p>
                          <Badge variant={getPriorityColor(shipment.priority)}>{shipment.priority.toUpperCase()}</Badge>
                        </div>
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{shipment.customer}</p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {shipment.address}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Weight size={12} /> {shipment.weight} kg
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {shipment.eta}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedShipment?.id === shipment.id && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
                        <Button
                          variant="primary"
                          size="sm"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => handleAssign(shipment)}
                        >
                          <ChevronRight size={14} /> Assign to Route
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
                <CardContent style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8' }}>No unassigned shipments found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Route Details & Assigned Shipments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Capacity Meter */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardHeader style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
              <CardTitle style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={16} style={{ color: '#6C63FF' }} /> Route Capacity
              </CardTitle>
            </CardHeader>
            <CardContent style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Stops</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>
                    {mockRoute.currentStops + assignedShipments.length}/{mockRoute.maxStops}
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#0a0a0f',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(stopsUsed * 100).toFixed(1)}%`,
                      height: '100%',
                      backgroundColor: stopsUsed > 0.8 ? '#ef4444' : stopsUsed > 0.5 ? '#f59e0b' : '#6C63FF',
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Weight</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>
                    {(mockRoute.currentWeight + totalAssignedWeight).toFixed(1)}/{mockRoute.maxWeight} kg
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#0a0a0f',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${capacityUsed.toFixed(1)}%`,
                      height: '100%',
                      backgroundColor: capacityUsed > 80 ? '#ef4444' : capacityUsed > 50 ? '#f59e0b' : '#6C63FF',
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#0a0a0f',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                }}
              >
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Remaining Capacity</p>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#6C63FF' }}>{currentCapacity} slots</p>
              </div>
            </CardContent>
          </Card>

          {/* ETA Preview */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardHeader style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
              <CardTitle style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} style={{ color: '#6C63FF' }} /> ETA Preview
              </CardTitle>
            </CardHeader>
            <CardContent style={{ padding: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#0a0a0f',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                }}
              >
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Current Route ETA</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#22c55e' }}>{mockRoute.eta}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>+{assignedShipments.length * 8} min estimated</p>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Shipments List */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardHeader style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
              <CardTitle style={{ fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} style={{ color: '#22c55e' }} /> Assigned ({assignedShipments.length})
                </span>
                {assignedShipments.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleOptimize} style={{ fontSize: '11px' }}>
                    <Zap size={12} /> Optimize
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent style={{ padding: '12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assignedShipments.length > 0 ? (
                assignedShipments.map((shipment, idx) => (
                  <div
                    key={shipment.id}
                    style={{
                      padding: '10px',
                      backgroundColor: '#0a0a0f',
                      borderRadius: '6px',
                      border: '1px solid #1e293b',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <GripVertical size={14} style={{ color: '#6C63FF', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <p style={{ fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>{idx + 1}. {shipment.id}</p>
                        <button
                          onClick={() => handleUnassign(shipment)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '0',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <p style={{ fontSize: '10px', color: '#94a3b8' }}>{shipment.weight} kg</p>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>No shipments assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Button variant="secondary" size="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> Review
            </Button>
            <Button variant="primary" size="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <CheckCircle size={14} /> Confirm Route
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
