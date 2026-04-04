/**
 * packages/core/src/woocommerce/normalizer.ts
 *
 * Converts a WooCommerce REST API v3 order into a platform-agnostic
 * CreateShipmentInput.  Zero Shopify-specific imports.
 */

import type { WooCommerceOrder, WooCommerceAddress } from '../platforms/adapters/woocommerce';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShipmentAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShipmentItem {
  external_item_id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export type WooCommerceShipmentStatus =
  | 'pending'
  | 'ready_for_fulfillment'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'on_hold';

export interface CreateShipmentInput {
  /** `wc_order_{id}` — prevents cross-platform collisions */
  external_reference_id: string;
  order_number: string;
  shipment_status: WooCommerceShipmentStatus;
  created_at: string;
  /** Destination — from WooCommerce shipping object */
  delivery_address: ShipmentAddress;
  /** Origin / pickup — from billing; falls back to store default when incomplete */
  pickup_address: ShipmentAddress;
  shipment_items: ShipmentItem[];
  carrier_service_code?: string;
  declared_value: number;
  currency_code: string;
  delivery_instructions?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const WC_STATUS_MAP: Record<string, WooCommerceShipmentStatus> = {
  pending: 'pending',
  processing: 'ready_for_fulfillment',
  completed: 'delivered',
  cancelled: 'cancelled',
  refunded: 'returned',
  'on-hold': 'on_hold',
};

/**
 * Store-address fallback used when the billing address is empty.
 * In production this should be populated from tenant/store settings.
 */
const STORE_ADDRESS_FALLBACK: ShipmentAddress = {
  name: 'Store',
  street1: '',
  city: '',
  state: '',
  zip: '',
  country: '',
};

function isBillingComplete(billing: WooCommerceAddress): boolean {
  return Boolean(billing.address_1 && billing.city && billing.country);
}

function mapAddress(addr: WooCommerceAddress): ShipmentAddress {
  const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ');
  return {
    name,
    ...(addr.company ? { company: addr.company } : {}),
    street1: addr.address_1,
    ...(addr.address_2 ? { street2: addr.address_2 } : {}),
    city: addr.city,
    state: addr.state,
    zip: addr.postcode,
    country: addr.country,
    ...(addr.phone ? { phone: addr.phone } : {}),
    ...(addr.email ? { email: addr.email } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a WooCommerce order into a platform-agnostic CreateShipmentInput.
 *
 * @param wcOrder  WooCommerce order from REST API v3
 * @returns        CreateShipmentInput ready for WityLogix shipment creation
 */
export function normalizeWooCommerceOrder(wcOrder: WooCommerceOrder): CreateShipmentInput {
  const status: WooCommerceShipmentStatus =
    WC_STATUS_MAP[wcOrder.status] ?? 'pending';

  const deliveryAddress = mapAddress(wcOrder.shipping);

  const pickupAddress = isBillingComplete(wcOrder.billing)
    ? mapAddress(wcOrder.billing)
    : STORE_ADDRESS_FALLBACK;

  const shipmentItems: ShipmentItem[] = wcOrder.line_items.map((item) => ({
    external_item_id: String(item.id),
    name: item.name,
    ...(item.sku ? { sku: item.sku } : {}),
    quantity: item.quantity,
    unit_price: parseFloat(item.price) || 0,
  }));

  const carrierServiceCode =
    Array.isArray(wcOrder.shipping_lines) && wcOrder.shipping_lines.length > 0
      ? (wcOrder.shipping_lines[0] as any).method_id ?? undefined
      : undefined;

  const declaredValue = parseFloat(wcOrder.total) || 0;

  return {
    external_reference_id: `wc_order_${wcOrder.id}`,
    order_number: wcOrder.number,
    shipment_status: status,
    created_at: wcOrder.date_created,
    delivery_address: deliveryAddress,
    pickup_address: pickupAddress,
    shipment_items: shipmentItems,
    ...(carrierServiceCode !== undefined ? { carrier_service_code: carrierServiceCode } : {}),
    declared_value: declaredValue,
    currency_code: wcOrder.currency,
    ...(wcOrder.customer_note ? { delivery_instructions: wcOrder.customer_note } : {}),
  };
}
