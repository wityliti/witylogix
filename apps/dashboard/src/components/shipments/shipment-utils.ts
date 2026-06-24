/**
 * Shared utilities and types for shipment pages and components.
 */

export type ShipmentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | 'FAILED_ATTEMPT'
  | 'RETURNED'
  | 'CANCELLED';

export type DeliveryMethod =
  | 'LOCAL_DELIVERY'
  | 'STORE_PICKUP'
  | 'STANDARD_SHIPPING'
  | 'EXPRESS_SHIPPING'
  | 'SAME_DAY';

/**
 * Lightweight shipment shape used by the list and map views.
 * The detail page uses its own extended interface.
 */
export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  status: ShipmentStatus;
  deliveryMethod: DeliveryMethod;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  driver: { id: string; name: string; phone: string } | null;
  location: { id: string; name: string; city: string } | null;
  weight: number | null;
  itemCount: number;
  shippingCost: number | null;
  codAmount: number | null;
  trackingNumber: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  estimatedArrival: string | null;
  deliveryLocation: { lat: number; lng: number } | null;
  order: {
    id: string;
    externalOrderNumber: string | null;
    shopifyOrderNumber?: string | null;
  } | null;
}

export type ShipmentBadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'default';

export function statusVariant(s: string): ShipmentBadgeVariant {
  const map: Record<string, ShipmentBadgeVariant> = {
    DELIVERED: 'success',
    ARRIVED: 'success',
    OUT_FOR_DELIVERY: 'primary',
    IN_TRANSIT: 'primary',
    PICKED_UP: 'primary',
    PROCESSING: 'info',
    READY_FOR_PICKUP: 'info',
    PENDING: 'warning',
    FAILED: 'danger',
    FAILED_ATTEMPT: 'danger',
    RETURNED: 'danger',
    CANCELLED: 'default',
  };
  return map[s] ?? 'default';
}
