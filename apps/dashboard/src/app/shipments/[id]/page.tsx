'use client';

import { useState } from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Package,
  Truck,
  MapPin,
  User,
  Calendar,
  Weight,
  Ruler,
  FileText,
  Camera,
  PenTool,
  Phone,
  Mail,
  Edit3,
  RefreshCw,
  PrinterIcon,
  CheckCircle,
  Clock,
  AlertCircle,
  Home,
  MessageSquare,
} from 'lucide-react';

// Mock shipment data
const mockShipments: Record<string, any> = {
  'SHP-001': {
    id: 'SHP-001',
    trackingNumber: 'TRK-2024-00001',
    status: 'out-for-delivery',
    carrier: 'FedEx Express',
    createdAt: '2024-03-04 08:00 AM',
    pickupAt: '2024-03-04 09:30 AM',
    inTransitAt: '2024-03-04 10:15 AM',
    outForDeliveryAt: '2024-03-06 08:00 AM',
    deliveryEta: '2024-03-06 02:15 PM',
    recipient: {
      name: 'John Doe',
      phone: '+1 (212) 555-0123',
      email: 'john.doe@example.com',
      address: '123 Broadway, Suite 500, New York, NY 10001',
    },
    package: {
      weight: '2.5 kg',
      dimensions: '30 x 20 x 15 cm',
      items: [
        { name: 'Electronics Kit', quantity: 1, value: '$150' },
        { name: 'USB Cables', quantity: 5, value: '$25' },
        { name: 'Adapter Pack', quantity: 2, value: '$40' },
      ],
    },
    driver: {
      name: 'Michael Brown',
      phone: '+1 (212) 555-0456',
      vehicle: 'FX-2024',
    },
    notes: 'Handle with care. Please leave at front desk if not answered.',
    timeline: [
      { status: 'created', label: 'Order Created', time: '2024-03-04 08:00 AM', completed: true },
      { status: 'picked_up', label: 'Picked Up', time: '2024-03-04 09:30 AM', completed: true },
      { status: 'in_transit', label: 'In Transit', time: '2024-03-04 10:15 AM', completed: true },
      { status: 'out_for_delivery', label: 'Out for Delivery', time: '2024-03-06 08:00 AM', completed: true },
      { status: 'delivered', label: 'Delivered', time: '2024-03-06 02:15 PM (Est.)', completed: false },
    ],
    deliveryProof: {
      signatureRequired: true,
      photoRequired: true,
    },
  },
};

interface TimelineEvent {
  status: string;
  label: string;
  time: string;
  completed: boolean;
}

const DeliveryProofSection = ({ proof }: { proof: any }) => {
  return (
    <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginTop: '16px' }}>
      <CardContent style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>Delivery Proof</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {/* Signature Placeholder */}
          {proof.signatureRequired && (
            <div>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Signature</p>
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '8px',
                  border: '2px dashed #334155',
                  backgroundColor: '#0f0f15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <PenTool size={24} style={{ color: '#6C63FF', opacity: 0.5 }} />
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Awaiting signature</p>
              </div>
            </div>
          )}

          {/* Photo Placeholder */}
          {proof.photoRequired && (
            <div>
              <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px' }}>Proof of Delivery</p>
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '8px',
                  border: '2px dashed #334155',
                  backgroundColor: '#0f0f15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <Camera size={24} style={{ color: '#6C63FF', opacity: 0.5 }} />
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Awaiting photo</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            style={{
              flex: 1,
              backgroundColor: '#6C63FF',
              color: '#e2e8f0',
              border: 'none',
              padding: '10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <Camera size={14} style={{ marginRight: '6px' }} /> Capture Photo
          </Button>
          <Button
            style={{
              flex: 1,
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              padding: '10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <PenTool size={14} style={{ marginRight: '6px' }} /> Get Signature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Timeline = ({ events }: { events: TimelineEvent[] }) => {
  return (
    <div>
      {events.map((event, index) => (
        <div key={index} style={{ display: 'flex', gap: '16px', marginBottom: index < events.length - 1 ? '20px' : '0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: event.completed ? '#6C63FF' : '#334155',
                border: '2px solid ' + (event.completed ? '#6C63FF' : '#1e293b'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {event.completed && <CheckCircle size={16} style={{ color: '#0a0a0f' }} />}
            </div>
            {index < events.length - 1 && (
              <div
                style={{
                  width: '2px',
                  height: '48px',
                  backgroundColor: event.completed ? '#6C63FF' : '#1e293b',
                  margin: '8px 0',
                }}
              />
            )}
          </div>
          <div style={{ paddingTop: '2px', flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{event.label}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{event.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ShipmentDetail({ params }: { params: { id: string } }) {
  const shipmentId = params.id || 'SHP-001';
  const shipment = mockShipments[shipmentId];

  if (!shipment) {
    return (
      <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
        <p style={{ color: '#94a3b8' }}>Shipment not found</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'delivered') return 'bg-green-900 text-green-300';
    if (status === 'out-for-delivery') return 'bg-blue-900 text-blue-300';
    if (status === 'in_transit') return 'bg-purple-900 text-purple-300';
    if (status === 'picked_up') return 'bg-cyan-900 text-cyan-300';
    return 'bg-yellow-900 text-yellow-300';
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}>{shipment.trackingNumber}</h1>
            <p style={{ color: '#94a3b8' }}>Shipment ID: {shipment.id}</p>
          </div>
          <Badge className={getStatusColor(shipment.status)} style={{ fontSize: '12px', padding: '6px 12px' }}>
            {shipment.status.replace(/_|-/g, ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        {/* Left Column */}
        <div>
          {/* Timeline Section */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: '#6C63FF' }} /> Shipment Timeline
              </h2>
              <Timeline events={shipment.timeline} />
            </CardContent>
          </Card>

          {/* Package Details */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#6C63FF' }} /> Package Details
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Weight size={14} /> Weight
                  </p>
                  <p style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: '600' }}>{shipment.package.weight}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Ruler size={14} /> Dimensions
                  </p>
                  <p style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: '600' }}>{shipment.package.dimensions}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '12px' }}>Items</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {shipment.package.items.map((item: any, index: number) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', backgroundColor: '#0a0a0f' }}>
                      <div>
                        <p style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: '600' }}>{item.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>Qty: {item.quantity}</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6C63FF', fontWeight: '600' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Information */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} style={{ color: '#6C63FF' }} /> Recipient Information
              </h2>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px' }}>Name</p>
                <p style={{ fontSize: '14px', color: '#e2e8f0' }}>{shipment.recipient.name}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px' }}>Address</p>
                <p style={{ fontSize: '14px', color: '#e2e8f0' }}>{shipment.recipient.address}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} /> Phone
                  </p>
                  <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{shipment.recipient.phone}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} /> Email
                  </p>
                  <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{shipment.recipient.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Notes */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
            <CardContent style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#6C63FF' }} /> Delivery Notes
              </h2>
              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0a0a0f', borderLeft: '3px solid #6C63FF' }}>
                <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{shipment.notes}</p>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Proof Section */}
          <DeliveryProofSection proof={shipment.deliveryProof} />

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '24px' }}>
            <Button
              style={{
                backgroundColor: '#6C63FF',
                color: '#e2e8f0',
                border: 'none',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Edit3 size={14} /> Update Status
            </Button>
            <Button
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} /> Reassign Driver
            </Button>
            <Button
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <PrinterIcon size={14} /> Print Label
            </Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Info Card */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6C63FF', marginBottom: '12px' }}>QUICK INFO</p>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Carrier</p>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{shipment.carrier}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Tracking #</p>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{shipment.trackingNumber}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Created</p>
                <p style={{ fontSize: '12px', color: '#e2e8f0' }}>{shipment.createdAt}</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>ETA</p>
                <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>{shipment.deliveryEta}</p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6C63FF', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> Assigned Driver
              </p>

              <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', backgroundColor: '#0a0a0f' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>{shipment.driver.name}</p>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Vehicle: {shipment.driver.vehicle}</p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  style={{
                    flex: 1,
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  <Phone size={13} />
                </Button>
                <Button
                  style={{
                    flex: 1,
                    backgroundColor: '#1e293b',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  <MessageSquare size={13} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card style={{ backgroundColor: '#12121a', border: '2px solid #6C63FF' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>CURRENT STATUS</p>
              <Badge className={getStatusColor(shipment.status)} style={{ fontSize: '13px', padding: '6px 12px' }}>
                {shipment.status.replace(/_|-/g, ' ').toUpperCase()}
              </Badge>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>
                {shipment.status === 'delivered'
                  ? 'Package has been delivered'
                  : shipment.status === 'out-for-delivery'
                    ? 'Driver is on the way to deliver your package'
                    : 'Package is in transit to destination'}
              </p>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
            <CardContent style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#6C63FF' }} /> Delivery Address
              </p>
              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0a0a0f' }}>
                <p style={{ fontSize: '11px', color: '#e2e8f0', lineHeight: '1.6' }}>{shipment.recipient.address}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
