/**
 * WooCommerce Order Sync Service
 * Synchronizes orders between WooCommerce and Witylogix with
 * bidirectional status mapping and conflict resolution
 */

import type {
  WCOrder,
  WCOrderStatus,
  WLOrderStatus,
  WCSyncResult,
} from "./types.js";

/**
 * Order status mapping between WooCommerce and Witylogix
 */
const WC_TO_WL_STATUS_MAP: Record<WCOrderStatus, WLOrderStatus> = {
  pending: "pending",
  processing: "confirmed",
  "on-hold": "pending",
  completed: "delivered",
  cancelled: "cancelled",
  refunded: "cancelled",
  failed: "pending",
};

const WL_TO_WC_STATUS_MAP: Record<WLOrderStatus, WCOrderStatus> = {
  pending: "pending",
  confirmed: "processing",
  dispatched: "processing",
  out_for_delivery: "processing",
  delivered: "completed",
  cancelled: "cancelled",
  returned: "refunded",
};

/**
 * WooCommerce Order Sync Service
 */
export class OrderSyncService {
  /**
   * Map WooCommerce order status to Witylogix status
   */
  static mapWCStatusToWL(wcStatus: WCOrderStatus): WLOrderStatus {
    return WC_TO_WL_STATUS_MAP[wcStatus] || "pending";
  }

  /**
   * Map Witylogix order status to WooCommerce status
   */
  static mapWLStatusToWC(wlStatus: WLOrderStatus): WCOrderStatus {
    return WL_TO_WC_STATUS_MAP[wlStatus] || "pending";
  }

  /**
   * Sync order from WooCommerce to Witylogix
   * Maps WC order to WL order format
   */
  static syncOrderFromWC(wcOrder: WCOrder): Record<string, unknown> {
    return {
      externalId: wcOrder.id.toString(),
      externalOrderNumber: wcOrder.number,
      status: this.mapWCStatusToWL(wcOrder.status),
      customer: {
        firstName: wcOrder.billing.first_name,
        lastName: wcOrder.billing.last_name,
        email: wcOrder.billing.email || "",
        phone: wcOrder.billing.phone || "",
      },
      deliveryAddress: {
        street: wcOrder.shipping.address_1,
        street2: wcOrder.shipping.address_2,
        city: wcOrder.shipping.city,
        state: wcOrder.shipping.state,
        postalCode: wcOrder.shipping.postcode,
        country: wcOrder.shipping.country,
      },
      billingAddress: {
        street: wcOrder.billing.address_1,
        street2: wcOrder.billing.address_2,
        city: wcOrder.billing.city,
        state: wcOrder.billing.state,
        postalCode: wcOrder.billing.postcode,
        country: wcOrder.billing.country,
      },
      items: wcOrder.line_items.map((item) => ({
        externalId: item.id.toString(),
        productId: item.product_id.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price.toString()),
        total: parseFloat(item.total.toString()),
      })),
      subtotal: parseFloat(wcOrder.total.toString()),
      shippingCost: parseFloat(wcOrder.shipping_total.toString()),
      tax: parseFloat(wcOrder.total_tax.toString()),
      total: parseFloat(wcOrder.total.toString()),
      paymentMethod: wcOrder.payment_method_title,
      notes: wcOrder.customer_note,
      metadata: {
        wcOrderId: wcOrder.id,
        wcStatus: wcOrder.status,
        datePaid: wcOrder.date_paid,
        dateCompleted: wcOrder.date_completed,
        paymentMethod: wcOrder.payment_method,
        transactionId: wcOrder.transaction_id,
      },
      metaFields: this.extractMetaFields(wcOrder.meta_data),
      createdAt: new Date(wcOrder.date_created),
      updatedAt: new Date(wcOrder.date_modified),
    };
  }

  /**
   * Sync order from Witylogix to WooCommerce
   * Maps WL order to WC order format for update
   */
  static syncOrderToWC(wlOrder: Record<string, unknown>): Partial<WCOrder> {
    return {
      status: this.mapWLStatusToWC(
        (wlOrder.status as WLOrderStatus) || "pending",
      ),
      customer_note: (wlOrder.notes as string) || "",
      meta_data: this.buildMetaData(
        (wlOrder.metaFields as Record<string, unknown>) || {},
      ),
    };
  }

  /**
   * Handle order status change with bidirectional sync
   */
  static handleOrderStatusChange(
    orderId: string | number,
    newStatus: WLOrderStatus,
    lastModifiedAt: Date,
  ): {
    wcStatus: WCOrderStatus;
    shouldUpdate: boolean;
    reason?: string;
  } {
    const wcStatus = this.mapWLStatusToWC(newStatus);

    return {
      wcStatus,
      shouldUpdate: true,
      reason: `Order ${orderId} status changed to ${newStatus}`,
    };
  }

  /**
   * Resolve conflicts using last-write-wins strategy with timestamp comparison
   */
  static resolveConflict(
    wlLastModified: Date,
    wcLastModified: Date,
    conflictField: string,
  ): {
    winner: "wl" | "wc";
    reason: string;
  } {
    if (wlLastModified > wcLastModified) {
      return {
        winner: "wl",
        reason: `Witylogix version of ${conflictField} is newer`,
      };
    }

    return {
      winner: "wc",
      reason: `WooCommerce version of ${conflictField} is newer`,
    };
  }

  /**
   * Extract custom meta fields from WC order
   */
  static extractMetaFields(
    metaData: Array<{
      id: number;
      key: string;
      value: string | Record<string, unknown>;
    }>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const meta of metaData) {
      // Skip system meta fields
      if (meta.key.startsWith("_")) {
        continue;
      }

      result[meta.key] = meta.value;
    }

    return result;
  }

  /**
   * Build WC meta_data array from Witylogix meta fields
   */
  static buildMetaData(
    metaFields: Record<string, unknown>,
  ): Array<{
    id: number;
    key: string;
    value: string | Record<string, unknown>;
  }> {
    return Object.entries(metaFields).map(([key, value], index) => ({
      id: index,
      key,
      value:
        typeof value === "string" ? value : (value as Record<string, unknown>),
    }));
  }

  /**
   * Validate order data for sync
   */
  static validateOrder(wcOrder: WCOrder): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!wcOrder.id) {
      errors.push("Order ID is required");
    }

    if (
      !wcOrder.billing ||
      (!wcOrder.billing.email && !wcOrder.billing.phone)
    ) {
      errors.push("Email or phone is required");
    }

    if (!wcOrder.line_items || wcOrder.line_items.length === 0) {
      errors.push("Order must contain at least one line item");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate order summary
   */
  static calculateOrderSummary(wcOrder: WCOrder): {
    itemCount: number;
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  } {
    return {
      itemCount: wcOrder.line_items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      subtotal:
        parseFloat(wcOrder.total.toString()) -
        parseFloat(wcOrder.shipping_total.toString()) -
        parseFloat(wcOrder.total_tax.toString()),
      shipping: parseFloat(wcOrder.shipping_total.toString()),
      tax: parseFloat(wcOrder.total_tax.toString()),
      total: parseFloat(wcOrder.total.toString()),
    };
  }
}

/**
 * Create order sync service instance
 */
export function createOrderSyncService(): typeof OrderSyncService {
  return OrderSyncService;
}
