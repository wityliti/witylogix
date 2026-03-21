'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

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
    <Card className="bg-[#12121a] border border-[#1e1e2e] mt-4">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-white mb-4">Delivery Proof</h3>

        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Signature Placeholder */}
          {proof.signatureRequired && (
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">Signature</p>
              <div
                className="w-full h-30 rounded-lg border-2 border-dashed border-[#1e1e2e] bg-[#1a1a2e] flex flex-col items-center justify-center gap-2"
              >
                <PenTool size={24} className="text-blue-500 opacity-50" />
                <p className="text-xs text-gray-300">Awaiting signature</p>
              </div>
            </div>
          )}

          {/* Photo Placeholder */}
          {proof.photoRequired && (
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">Proof of Delivery</p>
              <div
                className="w-full h-30 rounded-lg border-2 border-dashed border-[#1e1e2e] bg-[#1a1a2e] flex flex-col items-center justify-center gap-2"
              >
                <Camera size={24} className="text-blue-500 opacity-50" />
                <p className="text-xs text-gray-300">Awaiting photo</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-blue-500 text-white flex items-center justify-center gap-1.5 rounded py-2.5 px-4 text-xs font-semibold"
          >
            <Camera size={14} /> Capture Photo
          </Button>
          <Button
            className="flex-1 bg-[#12121a] text-white border border-[#1e1e2e] flex items-center justify-center gap-1.5 rounded py-2.5 px-4 text-xs font-semibold"
          >
            <PenTool size={14} /> Get Signature
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
        <div key={index} className={cn("flex gap-4", index < events.length - 1 ? "mb-5" : "")}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                event.completed
                  ? "bg-blue-500 border-blue-500"
                  : "border-[#1e1e2e] border-[#12121a]"
              )}
            >
              {event.completed && <CheckCircle size={16} className="text-[#1a1a2e]" />}
            </div>
            {index < events.length - 1 && (
              <div
                className={cn(
                  "w-0.5 h-12",
                  event.completed ? "bg-blue-500" : "bg-[#12121a]"
                )}
              />
            )}
          </div>
          <div className="pt-0.5 flex-1">
            <p className="text-sm font-semibold text-white">{event.label}</p>
            <p className="text-xs text-gray-300 mt-1">{event.time}</p>
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
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <p className="text-gray-300">Shipment not found</p>
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
    <div className="p-6 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">{shipment.trackingNumber}</h1>
            <p className="text-gray-300">Shipment ID: {shipment.id}</p>
          </div>
          <Badge className={cn(getStatusColor(shipment.status), "text-xs px-3 py-1.5")}>
            {shipment.status.replace(/_|-/g, ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2">
          {/* Timeline Section */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                <Clock size={18} className="text-blue-500" /> Shipment Timeline
              </h2>
              <Timeline events={shipment.timeline} />
            </CardContent>
          </Card>

          {/* Package Details */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Package size={18} className="text-blue-500" /> Package Details
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Weight size={14} /> Weight
                  </p>
                  <p className="text-sm font-semibold text-white">{shipment.package.weight}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Ruler size={14} /> Dimensions
                  </p>
                  <p className="text-sm font-semibold text-white">{shipment.package.dimensions}</p>
                </div>
              </div>

              <div className="border-t border-[#1e1e2e] pt-4">
                <p className="text-xs font-semibold text-gray-300 mb-3">Items</p>
                <div className="flex flex-col gap-2.5">
                  {shipment.package.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between p-2.5 rounded-lg bg-[#1a1a2e]">
                      <div>
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-gray-300">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-xs font-semibold text-blue-500">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Information */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User size={18} className="text-blue-500" /> Recipient Information
              </h2>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-300 mb-1.5">Name</p>
                <p className="text-sm text-white">{shipment.recipient.name}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-300 mb-1.5">Address</p>
                <p className="text-sm text-white">{shipment.recipient.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone size={14} /> Phone
                  </p>
                  <p className="text-sm text-white">{shipment.recipient.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Mail size={14} /> Email
                  </p>
                  <p className="text-sm text-white">{shipment.recipient.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Notes */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <FileText size={18} className="text-blue-500" /> Delivery Notes
              </h2>
              <div className="p-3 rounded-lg bg-[#1a1a2e] border-l-4 border-l-wl-primary-500">
                <p className="text-sm text-white">{shipment.notes}</p>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Proof Section */}
          <DeliveryProofSection proof={shipment.deliveryProof} />

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <Button
              className="bg-blue-500 text-white rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Edit3 size={14} /> Update Status
            </Button>
            <Button
              className="bg-[#12121a] text-white border border-[#1e1e2e] rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={14} /> Reassign Driver
            </Button>
            <Button
              className="bg-[#12121a] text-white border border-[#1e1e2e] rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <PrinterIcon size={14} /> Print Label
            </Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Quick Info Card */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-blue-500 mb-3">QUICK INFO</p>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">Carrier</p>
                <p className="text-xs font-semibold text-white">{shipment.carrier}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">Tracking #</p>
                <p className="text-xs font-semibold text-white">{shipment.trackingNumber}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">Created</p>
                <p className="text-xs text-white">{shipment.createdAt}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">ETA</p>
                <p className="text-xs font-semibold text-green-500">{shipment.deliveryEta}</p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-blue-500 mb-3 flex items-center gap-1.5">
                <Truck size={14} /> Assigned Driver
              </p>

              <div className="mb-3 p-3 rounded-lg bg-[#1a1a2e]">
                <p className="text-xs font-semibold text-white">{shipment.driver.name}</p>
                <p className="text-xs text-gray-300 mt-1">Vehicle: {shipment.driver.vehicle}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#12121a] text-white border border-[#1e1e2e] rounded py-2 px-3 text-xs"
                >
                  <Phone size={13} />
                </Button>
                <Button
                  className="flex-1 bg-[#12121a] text-white border border-[#1e1e2e] rounded py-2 px-3 text-xs"
                >
                  <MessageSquare size={13} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="bg-[#12121a] border-2 border-blue-500">
            <CardContent className="p-5">
              <p className="text-xs text-gray-300 mb-2">CURRENT STATUS</p>
              <Badge className={cn(getStatusColor(shipment.status), "text-xs px-3 py-1.5")}>
                {shipment.status.replace(/_|-/g, ' ').toUpperCase()}
              </Badge>
              <p className="text-xs text-gray-300 mt-3">
                {shipment.status === 'delivered'
                  ? 'Package has been delivered'
                  : shipment.status === 'out-for-delivery'
                    ? 'Driver is on the way to deliver your package'
                    : 'Package is in transit to destination'}
              </p>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-500" /> Delivery Address
              </p>
              <div className="p-3 rounded-lg bg-[#1a1a2e]">
                <p className="text-xs text-white leading-relaxed">{shipment.recipient.address}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
