/**
 * Email template types and interfaces for transactional emails
 */

export type EmailTemplate =
  | "order_confirmed"
  | "order_shipped"
  | "out_for_delivery"
  | "delivered"
  | "return_initiated"
  | "return_refunded";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  storeName: string;
  storeUrl: string;
  supportEmail: string;
}

export interface ShippingEmailData extends OrderEmailData {
  trackingNumber: string;
  trackingUrl: string;
  carrierName: string;
  estimatedDelivery: string;
}

export interface DeliveryEmailData extends ShippingEmailData {
  deliveredAt: string;
  driverName: string;
  proofOfDeliveryUrl: string;
}

export interface ReturnItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReturnEmailData {
  orderNumber: string;
  customerName: string;
  returnId: string;
  returnStatus: "initiated" | "approved" | "received" | "refunded";
  refundAmount: number;
  items: ReturnItem[];
  returnLabelUrl: string;
  storeName: string;
  supportEmail: string;
  currency: string;
}

/**
 * Union type for all email data types
 */
export type EmailData =
  | OrderEmailData
  | ShippingEmailData
  | DeliveryEmailData
  | ReturnEmailData;
