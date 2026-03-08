'use client';

import { useState, useEffect } from 'react';
import { cn } from '../../../lib/utils';
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
        <div key={index} className={cn('flex gap-3', index < events.length - 1 ? 'mb-4' : '')}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center border-2',
                event.completed
                  ? 'bg-green-500 border-green-500'
                  : 'bg-slate-700 border-slate-600'
              )}
            >
              {event.completed && <CheckCircle size={14} className="text-slate-950" />}
            </div>
            {index < events.length - 1 && (
              <div className={cn('w-0.5 h-8 my-2', event.completed ? 'bg-green-500' : 'bg-slate-700')} />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-100">{event.status}</p>
            <p className="text-xs text-slate-400">{event.time}</p>
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
    <div className="p-6 min-h-screen bg-slate-950">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Live Tracking Dashboard</h1>
        <p className="text-slate-400">Real-time delivery monitoring and driver tracking</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">&nbsp;
        <Card className="bg-slate-900 border border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 font-semibold">ACTIVE DELIVERIES</p>
              <Truck size={18} className="text-indigo-400" />
            </div>
            <p className="text-4xl font-bold text-slate-100">{totalActiveDeliveries}</p>
            <p className="text-xs text-green-400 mt-2">+2 from yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 font-semibold">ON-TIME %</p>
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <p className="text-4xl font-bold text-slate-100">{onTimePercentage}%</p>
            <p className="text-xs text-green-400 mt-2">+3% improvement</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 font-semibold">AVG DELIVERY TIME</p>
              <Clock size={18} className="text-amber-400" />
            </div>
            <p className="text-4xl font-bold text-slate-100">{avgDeliveryTime}</p>
            <p className="text-xs text-amber-400 mt-2">-2 mins from avg</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 font-semibold">ALERTS</p>
              <AlertCircle size={18} className="text-red-500" />
            </div>
            <p className="text-4xl font-bold text-slate-100">{alerts.length}</p>
            <p className="text-xs text-red-500 mt-2">2 critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Deliveries List */}
        <div className="flex flex-col gap-4">
          <Card className="bg-slate-900 border border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">Active Deliveries</h2>

              <div className="flex flex-col gap-3">&nbsp;
                {deliveries.map((delivery) => (
                  <button
                    key={delivery.id}
                    onClick={() => setSelectedDeliveryId(delivery.id)}
                    className={cn(
                      'p-4 rounded-lg text-left transition-all',
                      selectedDeliveryId === delivery.id
                        ? 'border-2 border-indigo-500 bg-slate-800'
                        : 'border border-slate-700 bg-transparent'
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{delivery.trackingId}</p>
                        <p className="text-xs text-slate-400 mt-1">{delivery.driver}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={cn(
                          'text-xs py-0 px-2',
                          delivery.priority === 'high' ? 'bg-red-900 text-red-300' :
                          delivery.priority === 'normal' ? 'bg-blue-900 text-blue-300' :
                          'bg-slate-700 text-slate-300'
                        )}>
                          {delivery.priority}
                        </Badge>
                        <Badge className="bg-indigo-900 text-indigo-300 text-xs py-0 px-2">
                          {delivery.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs text-slate-400">Progress</p>
                        <p className="text-xs font-semibold text-slate-100">{Math.round(delivery.progress)}%</p>
                      </div>
                      <div className="h-1.5 rounded overflow-hidden bg-slate-700">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${delivery.progress}%`,
                            backgroundColor: getStatusColor(delivery.status),
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-400">{delivery.address}</p>
                      <p className="text-xs font-semibold text-indigo-400">ETA: {delivery.eta}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alerts Panel */}
          <Card className="bg-slate-900 border border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                Delivery Alerts
              </h2>

              {alerts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">All deliveries on track</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'p-3 rounded text-xs',
                        alert.severity === 'critical'
                          ? 'border border-red-600 bg-red-900/10'
                          : alert.severity === 'warning'
                          ? 'border border-amber-600 bg-amber-900/10'
                          : 'border border-blue-600 bg-blue-900/10'
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-slate-100">{alert.trackingId}</p>
                        <span className="text-slate-400">{alert.timestamp}</span>
                      </div>
                      <p className="text-slate-300">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Selected Delivery Details */}
          {selectedDelivery && (
            <Card className="bg-slate-900 border border-indigo-500">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-indigo-400 mb-3">DELIVERY DETAILS</p>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">Tracking ID</p>
                  <p className="text-xs font-semibold text-slate-100">{selectedDelivery.trackingId}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">Driver</p>
                  <p className="text-xs text-slate-100">{selectedDelivery.driver}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">Destination</p>
                  <p className="text-xs text-slate-100">{selectedDelivery.address}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">ETA</p>
                  <p className="text-xs text-slate-100">{selectedDelivery.eta}</p>
                </div>

                {selectedDelivery.position && (
                  <div className="mb-4 p-3 rounded bg-slate-950">
                    <p className="text-xs text-slate-400 mb-1">Current Location</p>
                    <p className="text-xs text-slate-100">
                      {selectedDelivery.position.lat.toFixed(4)}, {selectedDelivery.position.lng.toFixed(4)}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1 bg-indigo-500 text-slate-100 border-none p-2 rounded text-xs cursor-pointer hover:bg-indigo-600 flex items-center justify-center gap-1">
                    <Phone size={14} /> Call
                  </Button>
                  <Button className="flex-1 bg-slate-700 text-slate-100 border border-slate-600 p-2 rounded text-xs cursor-pointer hover:bg-slate-600 flex items-center justify-center gap-1">
                    <MessageSquare size={14} /> Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card className="bg-slate-900 border border-slate-700">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-slate-100 mb-4">DELIVERY TIMELINE</p>
              <StatusTimeline trackingId={selectedDelivery?.trackingId || 'ORD-001'} />
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-slate-900 border border-slate-700">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <BarChart3 size={14} /> Stats
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-slate-400">Delivered</p>
                    <p className="text-xs font-semibold text-green-400">12</p>
                  </div>
                  <div className="h-1 rounded bg-slate-700">
                    <div className="h-full w-3/5 bg-green-500 rounded" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-slate-400">In Transit</p>
                    <p className="text-xs font-semibold text-blue-400">5</p>
                  </div>
                  <div className="h-1 rounded bg-slate-700">
                    <div className="h-full w-1/4 bg-blue-500 rounded" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-slate-400">Failed</p>
                    <p className="text-xs font-semibold text-red-400">1</p>
                  </div>
                  <div className="h-1 rounded bg-slate-700">
                    <div className="h-full w-1/20 bg-red-500 rounded" />
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
