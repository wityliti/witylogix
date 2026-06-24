/**
 * Portal-specific API response types, mapped from backend shapes.
 *
 * The backend uses different field names than the portal's local types.
 * These types match the actual API response shapes from apps/api/src/routes/*.ts
 */

// ─── Order (from /api/v4/orders) ─────────────────────────────

export interface ApiOrder {
  id: string;
  externalOrderNumber: string | null;
  status: string;
  createdAt: string;
  deliveryDate: string | null;
  estimatedArrival: string | null;
  actualDelivery: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  totalPrice: number | null;
  trackingToken: string | null;
  driver: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  timeSlot: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  proofOfDelivery: {
    id: string;
    photoUrls: string[];
    deliveredAt: string | null;
    recipientName: string | null;
  } | null;
  lineItems?: ApiLineItem[];
}

export interface ApiLineItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
}

// ─── Tracking (from /api/v4/tracking/token/:token) ──────────

export interface ApiTrackingResponse {
  id: string;
  status: string;
  customerName: string;
  addressLine1: string;
  city: string;
  province: string | null;
  postalCode: string | null;
  deliveryDate: string | null;
  estimatedArrival: string | null;
  actualDelivery: string | null;
  externalOrderNumber: string | null;
  trackingToken: string;
  timeSlot: {
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  driver: {
    id: string;
    name: string;
    vehicleType: string | null;
  } | null;
  proofOfDelivery: {
    photoUrls: string[];
    recipientName: string | null;
    deliveredAt: string | null;
    signature: string | null;
  } | null;
  deliveryPreferences: {
    instructions: string | null;
    dropoffNote: string | null;
    contactPref: string | null;
    timeSlotId: string | null;
  } | null;
}

// ─── Support Ticket (from /api/v4/support/tickets) ───────────

export interface ApiSupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ApiTicketMessage[];
}

export interface ApiTicketMessage {
  id: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  createdAt: string;
}

// ─── User profile (from /api/v4/auth/me) ─────────────────────

export interface ApiUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  shopId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Time slot (from /api/v4/time-slots) ─────────────────────

export interface ApiTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  isActive: boolean;
}

// ─── Proof of delivery ────────────────────────────────────────

export interface ApiProofOfDelivery {
  id: string;
  orderId: string;
  photoUrls: string[];
  recipientName: string | null;
  signature: string | null;
  deliveredAt: string | null;
  notes: string | null;
}

// ─── API route constants ──────────────────────────────────────

export const ROUTES = {
  ORDERS: '/api/v4/orders',
  ORDER: (id: string) => `/api/v4/orders/${id}`,
  ORDER_TIMELINE: (id: string) => `/api/v4/orders/${id}/timeline`,
  TRACKING_BY_TOKEN: (token: string) => `/api/v4/tracking/token/${token}`,
  TRACKING_PREFS: (token: string) => `/api/v4/tracking/token/${token}/preferences`,
  TRACKING_SLOTS: (token: string) => `/api/v4/tracking/token/${token}/slots`,
  SUPPORT_TICKETS: '/api/v4/support/tickets',
  SUPPORT_TICKET: (id: string) => `/api/v4/support/tickets/${id}`,
  SUPPORT_TICKET_MSG: (id: string) => `/api/v4/support/tickets/${id}/messages`,
  AUTH_ME: '/api/v4/auth/me',
  TIME_SLOTS: '/api/v4/time-slots',
  POD: (orderId: string) => `/api/v4/pod/${orderId}`,
} as const;

// ─── Status display helpers ───────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Confirmed',
  ASSIGNED: 'Driver Assigned',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  ARRIVED: 'Driver Arrived',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const STATUS_VARIANT: Record<string, 'active' | 'complete' | 'warn' | 'error' | 'default'> = {
  PENDING: 'default',
  ACCEPTED: 'active',
  ASSIGNED: 'active',
  PICKED_UP: 'active',
  OUT_FOR_DELIVERY: 'active',
  ARRIVED: 'active',
  DELIVERED: 'complete',
  FAILED: 'error',
  RETURNED: 'warn',
  CANCELLED: 'error',
};

export function getStatusVariant(
  status: string,
): 'active' | 'complete' | 'warn' | 'error' | 'default' {
  return STATUS_VARIANT[status] ?? 'default';
}
