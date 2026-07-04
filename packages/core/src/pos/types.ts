/**
 * POS Integration Types
 * Defines all type definitions for Point-of-Sale integration module
 */

export type PosProvider = "SHOPIFY_POS" | "SQUARE" | "CUSTOM";
export type PosDeliveryType = "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE";
export type PosOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "READY"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

/**
 * Configuration input for creating/updating POS configs
 */
export interface PosConfigInput {
  shopId: string;
  terminalId?: string;
  provider: PosProvider;
  apiKey?: string;
  enabled?: boolean;
  settings?: Record<string, unknown>;
}

/**
 * Input for creating POS orders
 */
export interface PosOrderInput {
  shopId: string;
  posConfigId: string;
  externalId?: string;
  customerName?: string;
  customerPhone?: string;
  items: PosLineItem[];
  total: number;
  deliveryType: PosDeliveryType;
  address?: PosAddress;
  notes?: string;
  scheduledAt?: Date;
}

/**
 * Line item in a POS order
 */
export interface PosLineItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  weight?: number;
}

/**
 * Address information for POS order delivery
 */
export interface PosAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat?: number;
  lng?: number;
}

/**
 * Custom form field definition
 */
export interface CustomFormField {
  name: string;
  type:
    | "text"
    | "number"
    | "email"
    | "phone"
    | "select"
    | "checkbox"
    | "textarea"
    | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
}

/**
 * Input for creating/updating custom forms
 */
export interface PosFormInput {
  shopId: string;
  name: string;
  fields: CustomFormField[];
  isDefault?: boolean;
}

/**
 * Order statistics response
 */
export interface PosOrderStats {
  totalOrders: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  revenue: number;
}

/**
 * Order list response with pagination
 */
export interface PosOrderListResponse {
  orders: any[];
  total: number;
}

/**
 * Order filters for querying
 */
export interface PosOrderFilters {
  status?: PosOrderStatus;
  deliveryType?: PosDeliveryType;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}
