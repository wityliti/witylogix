/**
 * packages/core/src/woocommerce/normalize.ts
 *
 * Orchestrates WooCommerce order → WityLogix Order + Shipment persistence.
 * Builds on normalizer.ts (pure transform); this module owns the DB write path.
 *
 * Idempotency: calling with the same (shopId, wcOrderId) always returns the
 * same Order / Shipment records without duplicating them.
 */

import { normalizeWooCommerceOrder } from './normalizer.js';
import type { WooCommerceOrder } from '../platforms/adapters/woocommerce.js';
import type { CreateShipmentInput } from './normalizer.js';

export { normalizeWooCommerceOrder };
export type { CreateShipmentInput };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal Prisma-compatible DB interface injected into persistWCOrder.
 * Using a structural interface keeps packages/core free of a hard
 * @witylogix/db import and makes unit testing straightforward.
 */
export interface WCPersistenceDb {
  order: {
    upsert(args: {
      where: { shopId_externalOrderId_source: { shopId: string; externalOrderId: string; source: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<{ id: string }>;
  };
  shipment: {
    findFirst(args: {
      where: { shopId: string; orderId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: Record<string, unknown>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  $transaction<T>(fn: (tx: WCPersistenceDb) => Promise<T>): Promise<T>;
}

export interface WCOrderPersistResult {
  orderId: string;
  shipmentId: string;
  /** true = new records were inserted; false = idempotent hit (already existed) */
  created: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const WC_SHIPMENT_STATUS_TO_ORDER_STATUS: Record<string, string> = {
  pending: 'PENDING',
  ready_for_fulfillment: 'PENDING',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  returned: 'RETURNED',
  on_hold: 'PENDING',
};

function wcShipmentStatusToOrderStatus(status: string): string {
  return WC_SHIPMENT_STATUS_TO_ORDER_STATUS[status] ?? 'PENDING';
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a WooCommerce order as a WityLogix Order + Shipment.
 *
 * All DB writes are scoped to `shopId` for tenant isolation.
 * The function is idempotent: a second call for the same WC order returns
 * the existing records with `created: false`.
 *
 * @param wcOrder  Raw WooCommerce REST API v3 order
 * @param shopId   Tenant shop UUID — required for all DB writes
 * @param db       Prisma-compatible DB client (inject for testability)
 */
export async function persistWCOrder(
  wcOrder: WooCommerceOrder,
  shopId: string,
  db: WCPersistenceDb,
): Promise<WCOrderPersistResult> {
  const input: CreateShipmentInput = normalizeWooCommerceOrder(wcOrder);
  const externalOrderId = input.external_reference_id; // "wc_order_{id}"
  const orderStatus = wcShipmentStatusToOrderStatus(input.shipment_status);

  return db.$transaction(async (tx) => {
    // ── Step 1: Upsert Order ───────────────────────────────────────────────
    // Unique key: (shopId, externalOrderId, source) — see 04-orders.prisma
    const order = await tx.order.upsert({
      where: {
        shopId_externalOrderId_source: {
          shopId,
          externalOrderId,
          source: 'WOOCOMMERCE',
        },
      },
      create: {
        shopId,
        externalOrderId,
        externalOrderNumber: input.order_number,
        source: 'WOOCOMMERCE',
        status: orderStatus,
        customerName: input.delivery_address.name,
        customerEmail: input.delivery_address.email ?? null,
        customerPhone: input.delivery_address.phone ?? null,
        addressLine1: input.delivery_address.street1,
        addressLine2: input.delivery_address.street2 ?? null,
        city: input.delivery_address.city,
        province: input.delivery_address.state,
        postalCode: input.delivery_address.zip,
        country: input.delivery_address.country,
        totalPrice: input.declared_value,
        itemCount: input.shipment_items.length,
        lineItems: input.shipment_items,
        metadata: {
          wc_currency: input.currency_code,
          wc_carrier_service: input.carrier_service_code ?? null,
        },
      },
      update: {
        // Keep status + price in sync on re-delivered webhooks
        status: orderStatus,
        totalPrice: input.declared_value,
      },
    });

    // ── Step 2: Idempotent Shipment creation ───────────────────────────────
    // One primary shipment per WC order — find before creating.
    const existing = await tx.shipment.findFirst({
      where: { shopId, orderId: order.id },
      select: { id: true },
    });

    if (existing) {
      return { orderId: order.id, shipmentId: existing.id, created: false };
    }

    const shipmentNumber = `WC-${wcOrder.id}-${Date.now().toString(36).toUpperCase()}`;

    const shipment = await tx.shipment.create({
      data: {
        shopId,
        orderId: order.id,
        shipmentNumber,
        status: 'PENDING',
        recipientName: input.delivery_address.name,
        recipientPhone: input.delivery_address.phone ?? null,
        recipientEmail: input.delivery_address.email ?? null,
        addressLine1: input.delivery_address.street1,
        addressLine2: input.delivery_address.street2 ?? null,
        city: input.delivery_address.city,
        province: input.delivery_address.state,
        postalCode: input.delivery_address.zip,
        country: input.delivery_address.country,
        itemCount: input.shipment_items.length,
        lineItems: input.shipment_items,
        notes: input.delivery_instructions ?? null,
        carrier: input.carrier_service_code ?? null,
        metadata: {
          wc_order_id: wcOrder.id,
          wc_order_number: input.order_number,
          wc_currency: input.currency_code,
        },
      },
      select: { id: true },
    });

    return { orderId: order.id, shipmentId: shipment.id, created: true };
  });
}
