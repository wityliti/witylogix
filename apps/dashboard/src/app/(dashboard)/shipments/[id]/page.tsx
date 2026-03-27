'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import {
  Package,
  Truck,
  MapPin,
  User,
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
} from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

interface ShipmentDetail {
  id: string;
  shipmentNumber: string;
  trackingNumber: string | null;
  status: string;
  carrier: string | null;
  deliveryMethod: string;
  createdAt: string;
  estimatedArrival: string | null;
  actualDelivery: string | null;
  pickedUpAt: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  itemCount: number;
  lineItems: Array<{ name: string; quantity: number; price: number }>;
  shippingCost: number | null;
  notes: string | null;
  driver: { id: string; name: string; phone: string; vehicleType: string | null } | null;
  location: { id: string; name: string; city: string } | null;
  order: { id: string; shopifyOrderNumber: string | null; customerName: string | null } | null;
  activityLogs: Array<{ id: string; action: string; timestamp: string; metadata: Record<string, unknown> }>;
  proofOfDelivery: {
    photoUrls: string[];
    signatureUrl: string | null;
    recipientName: string | null;
    deliveredAt: string;
  } | null;
}

const STATUS_PROGRESSION = [
  'PENDING',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'ARRIVED',
  'DELIVERED',
];

const statusColor = (status: string) => {
  if (status === 'DELIVERED') return 'bg-green-900 text-green-300';
  if (status === 'OUT_FOR_DELIVERY') return 'bg-blue-900 text-blue-300';
  if (status === 'IN_TRANSIT') return 'bg-purple-900 text-purple-300';
  if (status === 'PICKED_UP') return 'bg-cyan-900 text-cyan-300';
  if (status === 'FAILED') return 'bg-red-900 text-red-300';
  return 'bg-yellow-900 text-yellow-300';
};

export default function ShipmentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: shipment, loading, error, refetch } = useApiQuery<ShipmentDetail>(
    `/api/v4/shipments/${id}`,
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (!shipment) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <p className="text-gray-300">Shipment not found</p>
      </div>
    );
  }

  // Build timeline from activity logs
  const timeline = shipment.activityLogs.map((log) => ({
    status: log.action,
    label: log.action.replace(/_/g, ' '),
    time: new Date(log.timestamp).toLocaleString(),
    completed: true,
  }));

  return (
    <div className="p-6 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {shipment.trackingNumber ?? shipment.shipmentNumber}
            </h1>
            <p className="text-gray-300">
              Shipment: {shipment.shipmentNumber}
              {shipment.order?.shopifyOrderNumber && (
                <span className="ml-2 text-gray-500">
                  · Order {shipment.order.shopifyOrderNumber}
                </span>
              )}
            </p>
          </div>
          <Badge className={cn(statusColor(shipment.status), 'text-xs px-3 py-1.5')}>
            {shipment.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2">
          {/* Status Progression */}
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                <Clock size={18} className="text-blue-500" /> Shipment Progress
              </h2>
              <div className="flex flex-wrap gap-2">
                {STATUS_PROGRESSION.map((step, idx) => {
                  const currentIdx = STATUS_PROGRESSION.indexOf(shipment.status);
                  const isCompleted = currentIdx >= idx;
                  const isCurrent = shipment.status === step;
                  return (
                    <div
                      key={step}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border',
                        isCurrent
                          ? 'bg-blue-500 text-white border-blue-500'
                          : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-transparent text-gray-500 border-[#1e1e2e]',
                      )}
                    >
                      {step.replace(/_/g, ' ')}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          {timeline.length > 0 && (
            <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                  <Clock size={18} className="text-blue-500" /> Activity Timeline
                </h2>
                <div>
                  {timeline.map((event, index) => (
                    <div
                      key={index}
                      className={cn('flex gap-4', index < timeline.length - 1 ? 'mb-5' : '')}
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center bg-blue-500 border-blue-500">
                          <CheckCircle size={16} className="text-[#1a1a2e]" />
                        </div>
                        {index < timeline.length - 1 && (
                          <div className="w-0.5 h-12 bg-blue-500" />
                        )}
                      </div>
                      <div className="pt-0.5 flex-1">
                        <p className="text-sm font-semibold text-white">{event.label}</p>
                        <p className="text-xs text-gray-300 mt-1">{event.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                  <p className="text-sm font-semibold text-white">
                    {shipment.weight ? `${shipment.weight} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Ruler size={14} /> Dimensions
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {shipment.dimensions
                      ? `${shipment.dimensions.length} × ${shipment.dimensions.width} × ${shipment.dimensions.height} cm`
                      : '—'}
                  </p>
                </div>
              </div>

              {shipment.lineItems && shipment.lineItems.length > 0 && (
                <div className="border-t border-[#1e1e2e] pt-4">
                  <p className="text-xs font-semibold text-gray-300 mb-3">Items</p>
                  <div className="flex flex-col gap-2.5">
                    {shipment.lineItems.map((item, index) => (
                      <div key={index} className="flex justify-between p-2.5 rounded-lg bg-[#1a1a2e]">
                        <div>
                          <p className="text-xs font-semibold text-white">{item.name}</p>
                          <p className="text-xs text-gray-300">Qty: {item.quantity}</p>
                        </div>
                        {item.price > 0 && (
                          <p className="text-xs font-semibold text-blue-500">
                            ${item.price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <p className="text-sm text-white">{shipment.recipientName ?? '—'}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-300 mb-1.5">Address</p>
                <p className="text-sm text-white">
                  {[shipment.addressLine1, shipment.city, shipment.province, shipment.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone size={14} /> Phone
                  </p>
                  <p className="text-sm text-white">{shipment.recipientPhone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Mail size={14} /> Email
                  </p>
                  <p className="text-sm text-white">{shipment.recipientEmail ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Notes */}
          {shipment.notes && (
            <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-blue-500" /> Delivery Notes
                </h2>
                <div className="p-3 rounded-lg bg-[#1a1a2e] border-l-4 border-l-blue-500">
                  <p className="text-sm text-white">{shipment.notes}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Proof of Delivery */}
          {shipment.proofOfDelivery && (
            <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
              <CardContent className="p-6">
                <h3 className="text-base font-semibold text-white mb-4">Delivery Proof</h3>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {shipment.proofOfDelivery.signatureUrl ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-300 mb-2">Signature</p>
                      <img
                        src={shipment.proofOfDelivery.signatureUrl}
                        alt="Signature"
                        className="w-full rounded border border-[#1e1e2e]"
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-gray-300 mb-2">Signature</p>
                      <div className="w-full h-30 rounded-lg border-2 border-dashed border-[#1e1e2e] bg-[#1a1a2e] flex flex-col items-center justify-center gap-2">
                        <PenTool size={24} className="text-blue-500 opacity-50" />
                        <p className="text-xs text-gray-300">No signature captured</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-300 mb-2">Photo Proof</p>
                    {shipment.proofOfDelivery.photoUrls.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1">
                        {shipment.proofOfDelivery.photoUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Delivery photo ${idx + 1}`}
                            className="w-full rounded border border-[#1e1e2e]"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-30 rounded-lg border-2 border-dashed border-[#1e1e2e] bg-[#1a1a2e] flex flex-col items-center justify-center gap-2">
                        <Camera size={24} className="text-blue-500 opacity-50" />
                        <p className="text-xs text-gray-300">No photos</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button className="bg-blue-500 text-white rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5">
              <Edit3 size={14} /> Update Status
            </Button>
            <Button className="bg-[#12121a] text-white border border-[#1e1e2e] rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5">
              <RefreshCw size={14} /> Reassign Driver
            </Button>
            <Button className="bg-[#12121a] text-white border border-[#1e1e2e] rounded py-3 px-4 text-xs font-semibold flex items-center justify-center gap-1.5">
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
                <p className="text-xs font-semibold text-white">{shipment.carrier ?? '—'}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">Tracking #</p>
                <p className="text-xs font-semibold text-white">
                  {shipment.trackingNumber ?? '—'}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">Created</p>
                <p className="text-xs text-white">
                  {new Date(shipment.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-300 mb-1">ETA</p>
                <p className="text-xs font-semibold text-green-500">
                  {shipment.estimatedArrival
                    ? new Date(shipment.estimatedArrival).toLocaleDateString()
                    : 'TBD'}
                </p>
              </div>

              {shipment.shippingCost && (
                <div className="mb-4">
                  <p className="text-xs text-gray-300 mb-1">Shipping Cost</p>
                  <p className="text-xs font-semibold text-blue-500">
                    ${Number(shipment.shippingCost).toFixed(2)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Driver Information */}
          {shipment.driver && (
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-blue-500 mb-3 flex items-center gap-1.5">
                  <Truck size={14} /> Assigned Driver
                </p>

                <div className="mb-3 p-3 rounded-lg bg-[#1a1a2e]">
                  <p className="text-xs font-semibold text-white">{shipment.driver.name}</p>
                  {shipment.driver.vehicleType && (
                    <p className="text-xs text-gray-300 mt-1">
                      Vehicle: {shipment.driver.vehicleType}
                    </p>
                  )}
                  {shipment.driver.phone && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {shipment.driver.phone}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Card */}
          <Card className="bg-[#12121a] border-2 border-blue-500">
            <CardContent className="p-5">
              <p className="text-xs text-gray-300 mb-2">CURRENT STATUS</p>
              <Badge className={cn(statusColor(shipment.status), 'text-xs px-3 py-1.5')}>
                {shipment.status.replace(/_/g, ' ')}
              </Badge>
            </CardContent>
          </Card>

          {/* Location Card */}
          {(shipment.addressLine1 || shipment.location) && (
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue-500" /> Delivery Address
                </p>
                <div className="p-3 rounded-lg bg-[#1a1a2e]">
                  <p className="text-xs text-white leading-relaxed">
                    {[shipment.addressLine1, shipment.city, shipment.province, shipment.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
