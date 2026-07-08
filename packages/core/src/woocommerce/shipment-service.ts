/**
 * packages/core/src/woocommerce/shipment-service.ts
 *
 * Platform-agnostic service that converts a WooCommerce order into
 * WityLogix Order + Shipment + ShipmentItem records.
 *
 * Idempotent: calling upsertShipment with the same WC order twice
 * produces one Order, one Shipment, and fresh ShipmentItem rows.
 *
 * No Shopify-specific imports.
 */

import type { WooCommerceOrder } from "../platforms/adapters/woocommerce.js";
import {
  normalizeWooCommerceOrder,
  type CreateShipmentInput,
  type WooCommerceShipmentStatus,
} from "./normalizer.js";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Prisma-compatible types (subset used by this service)
// ─────────────────────────────────────────────────────────────────────────────

export interface PrismaLike {
  order: {
    upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  shipment: {
    findFirst(args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<{ id: string; shipmentNumber: string } | null>;
    create(args: {
      data: Record<string, unknown>;
    }): Promise<{ id: string; shipmentNumber: string }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ id: string; shipmentNumber: string }>;
  };
  shipmentItem: {
    deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mappings
// ─────────────────────────────────────────────────────────────────────────────

const SHIPMENT_STATUS_MAP: Record<WooCommerceShipmentStatus, string> = {
  pending: "PENDING",
  ready_for_fulfillment: "PROCESSING",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  returned: "RETURNED",
  on_hold: "PENDING",
};

const ORDER_STATUS_MAP: Record<WooCommerceShipmentStatus, string> = {
  pending: "PENDING",
  ready_for_fulfillment: "ACCEPTED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  returned: "RETURNED",
  on_hold: "PENDING",
};

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export interface UpsertShipmentResult {
  orderId: string;
  shipmentId: string;
  shipmentNumber: string;
  action: "created" | "updated";
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class WooCommerceShipmentService {
  /**
   * @param db   Tenant-scoped Prisma client (forTenant(shopId) from @witylogix/db).
   *             Must already have RLS app.current_shop_id set.
   */
  constructor(private readonly db: PrismaLike) {}

  /**
   * Idempotently create or update a WityLogix Order + Shipment from a
   * WooCommerce order webhook payload.
   *
   * On first call:  creates Order + Shipment + ShipmentItems.
   * On subsequent:  updates Order + Shipment, replaces ShipmentItems.
   */
  async upsertShipment(
    wcOrder: WooCommerceOrder,
    shopId: string,
  ): Promise<UpsertShipmentResult> {
    const input = normalizeWooCommerceOrder(wcOrder);
    return this._upsert(input, shopId);
  }

  private async _upsert(
    input: CreateShipmentInput,
    shopId: string,
  ): Promise<UpsertShipmentResult> {
    // 1. Upsert Order — unique by (shopId, externalOrderId, source)
    const order = await this.db.order.upsert({
      where: {
        shopId_externalOrderId_source: {
          shopId,
          externalOrderId: input.external_reference_id,
          source: "WOOCOMMERCE",
        },
      },
      create: {
        shopId,
        externalOrderId: input.external_reference_id,
        externalOrderNumber: input.order_number,
        source: "WOOCOMMERCE",
        status: ORDER_STATUS_MAP[input.shipment_status],
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
        notes: input.delivery_instructions ?? null,
      },
      update: {
        externalOrderNumber: input.order_number,
        status: ORDER_STATUS_MAP[input.shipment_status],
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
        notes: input.delivery_instructions ?? null,
      },
    });

    // 2. Check for existing Shipment linked to this Order
    const existing = await this.db.shipment.findFirst({
      where: { orderId: order.id, shopId },
      select: { id: true, shipmentNumber: true },
    });

    const shipmentNumber = `WC-${input.order_number}`;
    const shipmentData: Record<string, unknown> = {
      status: SHIPMENT_STATUS_MAP[input.shipment_status],
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
      carrier: input.carrier_service_code ?? null,
      notes: input.delivery_instructions ?? null,
      metadata: {
        pickupAddress: input.pickup_address,
        declaredValue: input.declared_value,
        currencyCode: input.currency_code,
        source: "WOOCOMMERCE",
      },
    };

    let shipment: { id: string; shipmentNumber: string };
    let action: "created" | "updated";

    if (existing) {
      // Update existing shipment
      shipment = await this.db.shipment.update({
        where: { id: existing.id },
        data: shipmentData,
      });
      action = "updated";
    } else {
      // Create new shipment
      shipment = await this.db.shipment.create({
        data: {
          shopId,
          orderId: order.id,
          shipmentNumber,
          ...shipmentData,
        },
      });
      action = "created";
    }

    // 3. Replace ShipmentItem rows (delete + create for idempotency)
    await this.db.shipmentItem.deleteMany({
      where: { shipmentId: shipment.id },
    });

    if (input.shipment_items.length > 0) {
      await this.db.shipmentItem.createMany({
        data: input.shipment_items.map((item) => ({
          shipmentId: shipment.id,
          shopId,
          sku: item.sku ?? null,
          title: item.name,
          quantity: item.quantity,
          customsValue: item.unit_price,
        })),
      });
    }

    return {
      orderId: order.id,
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      action,
    };
  }
}
