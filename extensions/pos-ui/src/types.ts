// @ts-nocheck

/**
 * POS Order: Order data fetched from backend
 */
export interface POSOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  status: "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled";
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  deliveryAddress: Address;
  notes?: string;
}

/**
 * Order item: Line item in an order
 */
export interface OrderItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
}

/**
 * Address: Customer delivery address
 */
export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  formattedAddress?: string;
}

/**
 * POS Driver: Available driver for delivery assignment
 */
export interface POSDriver {
  id: string;
  name: string;
  phone: string;
  status: "available" | "busy" | "offline";
  currentOrders: number;
  zoneId: string;
  vehicle?: string;
  rating?: number;
}

/**
 * Delivery Slot: Available time slot for delivery
 */
export interface DeliverySlot {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  label: string; // Display: "9:00 AM - 12:00 PM"
  available: boolean;
  slotsRemaining: number;
}

/**
 * Delivery Assignment: Assignment of order to driver
 */
export interface DeliveryAssignment {
  orderId: string;
  driverId: string;
  driverName: string;
  deliveryDate: string; // YYYY-MM-DD
  deliverySlot: DeliverySlot;
  estimatedDeliveryTime: string; // Display label
  zoneId: string;
  status: "assigned" | "in_transit" | "delivered" | "failed";
  createdAt: string;
}

/**
 * Search result from order lookup
 */
export interface POSSearchResult {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: string;
  address: string;
}

/**
 * POS Extension Config: Configuration for POS extension
 */
export interface POSExtensionConfig {
  shopId: string;
  extensionId: string;
  apiKey: string;
  apiBaseUrl: string;
  posExtensionOrigin?: string;
  features?: Record<string, boolean>;
}

/**
 * API response for search
 */
export interface SearchOrdersResponse {
  results: POSSearchResult[];
  total: number;
  errors?: string[];
}

/**
 * API response for drivers
 */
export interface GetDriversResponse {
  drivers: POSDriver[];
  errors?: string[];
}

/**
 * API response for delivery slots
 */
export interface GetSlotsResponse {
  slots: DeliverySlot[];
  errors?: string[];
}

/**
 * API response for assignment
 */
export interface AssignDeliveryResponse {
  success: boolean;
  assignment?: DeliveryAssignment;
  errors?: string[];
}

/**
 * Status badge variants
 */
export type StatusBadgeVariant =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

/**
 * Component state for order lookup
 */
export interface OrderLookupState {
  query: string;
  results: POSSearchResult[];
  selectedOrder?: POSOrder;
  isLoading: boolean;
  error?: Error;
}

/**
 * Component state for delivery assignment
 */
export interface DeliveryAssignmentState {
  selectedDriverId?: string;
  selectedDate?: string;
  selectedSlot?: DeliverySlot;
  estimatedDeliveryTime?: string;
  isAssigning: boolean;
  error?: Error;
  success: boolean;
}
