'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Truck,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  MapPin,
  Zap,
  BarChart3,
  Phone,
  MessageSquare,
} from 'lucide-react';

// Mock data
const mockActiveDeliveries = [
  { id: 'DLV-001', trackingId: 'ORD-001', driver: 'Michael Brown', status: 'out-for-delivery', eta: '2:15 PM', progress: 85, address: '123 Broadway, NYC', priority: 'normal' },
  { id: 'DLV-002', trackingId: 'ORD-002', driver: 'Sarah Connor', status: 'out-for-delivery', eta: '1:45 PM', progress: 65, address: '456 5th Ave, NYC', priority: 'high' },
  { id: 'DLV-003', trackingId: 'ORD-005', driver: 'Charlie Wilson', status: 'in-transit', eta: '3:30 PM', progress: 45, address: '654 3rd Ave, NYC', priority: 'normal' },
  { id: 'DLV-004', trackingId: 'ORD-009', driver: 'Grace Lee', status: 'out-for-delivery', eta: '2:45 PM', progress: 75, address: '357 Broadway, NYC', priority: 'normal' },
  { id: 'DLV-005', trackingId: 'ORD-012', driver: 'Jack Robinson', status: 'in-transit', eta: '4:00 PM', progress: 30, address: '123 Madison Ave, NYC', priority: 'low' },
];

const mockAlerts = [
  { id: 'ALT-001', trackingId: 'ORD-002', type: 'delayed', message: 'Delivery delayed by 15 minutes due to traffic', severity: 'warning', timestamp: '12:45 PM' },
  { id: 'ALT-002', trackingId: 'ORD-005', type: 'at-risk', message: 'Customer not responding to calls', severity: 'critical', timestamp: '12:50 PM' },
  { id: 'ALT-003', trackingId: 'ORD-012', type: 'exception', message: 'Package requires signature but not available', severity: 'warning', timestamp: '1:00 PM' },
];

interface MockDelivery {
  id: string;
  trackingId: string;
  driver: string;
  status: string;
  eta: string;
  progress: number;
  address: string;
  priority: string;
  position?: {
    lat: number;
    lng: number;
  };
}

const StatusTimeline = ({ trackingId }: { trackingId: string }) => {
  const events = [
    { status: 'Order Placed', time: '11:00 AM', completed: true },
    { status: 'Picked Up', time: '11:30 AM', completed: true },
    { status: 'In Transit', time: '12:00 PM', completed: true },
    { status: 'Out for Delivery', time: '1:30 PM', completed: true },
    { status: 'Delivered', time: 'Est. 2:15 PM', completed: false },
  ];

  return (
    <div>
      {events.map((event, index) => (
        <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: index < events.length - 1 ? '16px' : '0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: event.completed ? '#22c55e' : '#334155',
                border: '2px solid ' + (event.completed ? '#22c55e' : '#1e293b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {event.completed && <CheckCircle size={14} style={{ color: '#0a0a0f' }} />}
            </div>
            {index < events.length - 1 && (
              <div style={{ width: '2px', height: '32px', backgroundColor: event.completed ? '#22c55e' : '#1e293b', margin: '8px 0' }} />
            )}
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{event.status}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8' }}>{event.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function LiveTracking() {
  const [deliveries, setDeliveries] = useState<MockDelivery[]>(mockActiveDeliveries);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(mockActiveDeliveries[0].id);
  const [alerts, setAlerts] = useState(mockAlerts);
  const [time, setTime] = useState(new Date());

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      // Simulate driver position updates
      setDeliveries((prev) =>
        prev.map((delivery) => ({
          ...delivery,
          progress: Math.min(100, delivery.progress + Math.random() * 2),
          position: {
            lat: 40.7128 + Math.random() * 0.01,
            lng: -74.006 + Math.random() * 0.01,
          },
        }))
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId);
  const onTimePercentage = 92;
  const avgDeliveryTime = '42 mins';
  const totalActiveDeliveries = deliveries.length;

  const getStatusColor = (status: string) => {
    if (status === 'out-for-delivery') return '#3b82f6';
    if (status === 'in-transit') return '#6C63FF';
    if (status === 'delivered') return '#22c55e';
    return '#f59e0b';
  };

  const getAlertColor = (severity: string) => {
    if (severity === 'critical') return 'bg-red-900 text-red-300';
    if (severity === 'warning') return 'bg-yellow-900 text-yellow-300';
    return 'bg-blue-900 text-blue-300';
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px' }}>Live Tracking Dashboard</h1>
        <p style={{ color: '#94a3b8' }}>Real-time delivery monitoring and driver tracking</p>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>ACTIVE DELIVERIES</p>
              <Truck size={18} style={{ color: '#6C63FF' }} />
            </div>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#e2e8f0' }}>{totalActiveDeliveries}</p>
            <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>+2 from yesterday</p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>ON-TIME %</p>
              <TrendingUp size={18} style={{ color: '#22c55e' }} />
            </div>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#e2e8f0' }}>{onTimePercentage}%</p>
            <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>+3% improvement</p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>AVG DELIVERY TIME</p>
              <Clock size={18} style={{ color: '#f59e0b' }} />
            </div>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#e2e8f0' }}>{avgDeliveryTime}</p>
            <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '8px' }}>-2 mins from avg</p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>ALERTS</p>
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            </div>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#e2e8f0' }}>{alerts.length}</p>
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>2 critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Deliveries List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>Active Deliveries</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {deliveries.map((delivery) => (
                  <button
                    key={delivery.id}
                    onClick={() => setSelectedDeliveryId(delivery.id)}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: selectedDeliveryId === delivery.id ? '2px solid #6C63FF' : '1px solid #1e293b',
                      backgroundColor: selectedDeliveryId === delivery.id ? '#1a1a2e' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{delivery.trackingId}</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{delivery.driver}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Badge className={delivery.priority === 'high' ? 'bg-red-900 text-red-300' : delivery.priority === 'normal' ? 'bg-blue-900 text-blue-300' : 'bg-gray-900 text-gray-300'} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {delivery.priority}
                        </Badge>
                        <Badge className="bg-purple-900 text-purple-300" style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {delivery.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>Progress</p>
                        <p style={{ fontSize: '11px', fontWeight: '600', color: '#e2e8f0' }}>{Math.round(delivery.progress)}%</p>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#1e293b', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${delivery.progress}%`,
                            backgroundColor: getStatusColor(delivery.status),
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '11px', color: '#94a3b8' }}>{delivery.address}</p>
                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6C63FF' }}>ETA: {delivery.eta}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts Panel */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} style={{ color: '#ef4444' }} />
                Delivery Alerts
              </h2>

              {alerts.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>All deliveries on track</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid ' + (alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'),
                        backgroundColor: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : alert.severity === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{alert.trackingId}</p>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>{alert.timestamp}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Selected Delivery Details */}
          {selectedDelivery && (
            <Card style={{ backgroundColor: '#12121a', border: '1px solid #6C63FF' }}>
              <CardContent style={{ padding: '20px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6C63FF', marginBottom: '12px' }}>DELIVERY DETAILS</p>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Tracking ID</p>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{selectedDelivery.trackingId}</p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Driver</p>
                  <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedDelivery.driver}</p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Destination</p>
                  <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedDelivery.address}</p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ETA</p>
                  <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{selectedDelivery.eta}</p>
                </div>

                {selectedDelivery.position && (
                  <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '6px', backgroundColor: '#0a0a0f' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Current Location</p>
                    <p style={{ fontSize: '11px', color: '#e2e8f0' }}>
                      {selectedDelivery.position.lat.toFixed(4)}, {selectedDelivery.position.lng.toFixed(4)}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button style={{ flex: 1, backgroundColor: '#6C63FF', color: '#e2e8f0', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    <Phone size={14} /> Call
                  </Button>
                  <Button style={{ flex: 1, backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    <MessageSquare size={14} /> Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>DELIVERY TIMELINE</p>
              <StatusTimeline trackingId={selectedDelivery?.trackingId || 'ORD-001'} />
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={14} /> Stats
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Delivered</p>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#22c55e' }}>12</p>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#1e293b' }}>
                    <div style={{ height: '100%', width: '60%', backgroundColor: '#22c55e', borderRadius: '2px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>In Transit</p>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#3b82f6' }}>5</p>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#1e293b' }}>
                    <div style={{ height: '100%', width: '25%', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Failed</p>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444' }}>1</p>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#1e293b' }}>
                    <div style={{ height: '100%', width: '5%', backgroundColor: '#ef4444', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
