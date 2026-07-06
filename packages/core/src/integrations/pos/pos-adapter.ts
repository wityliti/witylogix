/**
 * Abstract POS Adapter Base Class
 * Provides location/terminal awareness, rate limiting, and menu sync helpers
 */

import {
  type POSAdapterInterface,
  type POSLocation,
  type POSMenuItem,
  type POSOrder,
  type POSPayment,
  type POSWebhookEvent,
  type MenuSyncOptions,
  type OrderFilters,
  type POSModifier,
  type KitchenOrderStatus,
} from "./types";
import { createHmac } from "crypto";

/**
 * Rate limiter state
 */
interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

/**
 * Abstract base class for POS adapters
 */
export abstract class POSAdapter implements POSAdapterInterface {
  protected providerId: string;
  protected maxRetries: number = 3;
  protected retryDelayMs: number = 1000;
  protected retryBackoffMultiplier: number = 2;

  // Rate limiter
  private rateLimiterState: RateLimiterState = {
    tokens: 100,
    lastRefill: Date.now(),
  };
  private rateLimitPerSecond: number = 100;
  private rateLimitBurst: number = 200;

  // Menu sync cache
  private menuSyncCache = new Map<
    string,
    { timestamp: number; menu: POSMenuItem[] }
  >();
  private menuSyncCacheTtl = 15 * 60 * 1000; // 15 minutes

  constructor(providerId: string) {
    this.providerId = providerId;
  }

  /**
   * Execute with exponential backoff retries
   */
  protected async executeWithRetries<T>(
    executor: () => Promise<T>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check rate limiter
        await this.checkRateLimiter();

        // Execute
        return await executor();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes("4xx")) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delayMs =
            this.retryDelayMs * Math.pow(this.retryBackoffMultiplier, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimiter(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.rateLimiterState.lastRefill) / 1000;

    // Refill tokens based on elapsed time
    const tokensToAdd = timeSinceLastRefill * this.rateLimitPerSecond;
    this.rateLimiterState.tokens = Math.min(
      this.rateLimitBurst,
      this.rateLimiterState.tokens + tokensToAdd,
    );
    this.rateLimiterState.lastRefill = now;

    // Check if we have tokens
    if (this.rateLimiterState.tokens < 1) {
      const waitTime =
        ((1 - this.rateLimiterState.tokens) / this.rateLimitPerSecond) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimiterState.tokens--;
    } else {
      this.rateLimiterState.tokens--;
    }
  }

  /**
   * Get menu from cache or execute sync
   */
  protected getMenuFromCache(locationId: string): POSMenuItem[] | null {
    const cached = this.menuSyncCache.get(locationId);
    if (cached && cached.timestamp + this.menuSyncCacheTtl > Date.now()) {
      return cached.menu;
    }
    return null;
  }

  /**
   * Cache menu items
   */
  protected cacheMenu(locationId: string, items: POSMenuItem[]): void {
    this.menuSyncCache.set(locationId, {
      timestamp: Date.now(),
      menu: items,
    });
  }

  /**
   * Invalidate menu cache
   */
  protected invalidateMenuCache(locationId: string): void {
    this.menuSyncCache.delete(locationId);
  }

  /**
   * Format amount from cents to dollars
   */
  protected formatAmount(amountInCents: number, decimals: number = 2): number {
    return parseFloat(
      (amountInCents / Math.pow(10, decimals)).toFixed(decimals),
    );
  }

  /**
   * Format amount from dollars to cents
   */
  protected formatAmountToCents(
    amountInDollars: number,
    decimals: number = 2,
  ): number {
    return Math.round(amountInDollars * Math.pow(10, decimals));
  }

  /**
   * Calculate order totals
   */
  protected calculateOrderTotals(
    order: Partial<{
      lineItems?: Array<{
        quantity: number;
        price: number;
        modifiers?: Array<{ price: number }>;
      }>;
      discounts?: Array<{ type: string; amount: number }>;
      tax?: number;
    }>,
  ): { subtotal: number; discount: number; tax: number; total: number } {
    let subtotal = 0;
    let discount = 0;

    if (order.lineItems) {
      for (const item of order.lineItems) {
        let itemTotal = item.price * item.quantity;
        if (item.modifiers) {
          itemTotal += item.modifiers.reduce(
            (sum, m) => sum + m.price * item.quantity,
            0,
          );
        }
        subtotal += itemTotal;
      }
    }

    if (order.discounts) {
      for (const d of order.discounts) {
        if (d.type === "fixed") {
          discount += d.amount;
        } else if (d.type === "percentage") {
          discount += Math.round(subtotal * (d.amount / 100));
        }
      }
    }

    const tax = order.tax || 0;
    const total = subtotal - discount + tax;

    return {
      subtotal,
      discount,
      tax,
      total: Math.max(0, total),
    };
  }

  /**
   * Validate order data
   */
  protected validateOrder(order: Partial<any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!order.lineItems || order.lineItems.length === 0) {
      errors.push("Order must contain at least one line item");
    }

    if (order.lineItems) {
      for (const item of order.lineItems) {
        if (item.quantity <= 0) {
          errors.push("Item quantity must be greater than 0");
        }
        if (item.price < 0) {
          errors.push("Item price cannot be negative");
        }
      }
    }

    if (order.discounts) {
      for (const discount of order.discounts) {
        if (
          discount.type === "percentage" &&
          (discount.amount < 0 || discount.amount > 100)
        ) {
          errors.push("Discount percentage must be between 0 and 100");
        }
        if (discount.type === "fixed" && discount.amount < 0) {
          errors.push("Discount amount cannot be negative");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build modifier group from items
   */
  protected buildModifierGroups(
    modifiers: POSModifier[],
  ): Record<string, POSModifier[]> {
    const groups: Record<string, POSModifier[]> = {};

    for (const modifier of modifiers) {
      const groupId = modifier.groupId || "default";
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(modifier);
    }

    return groups;
  }

  /**
   * Merge menu updates (partial sync)
   */
  protected mergeMenuUpdates(
    existingMenu: POSMenuItem[],
    updates: POSMenuItem[],
  ): POSMenuItem[] {
    const menuMap = new Map(
      existingMenu.map((item) => [item.externalId, item]),
    );

    for (const update of updates) {
      menuMap.set(update.externalId, {
        ...menuMap.get(update.externalId),
        ...update,
      });
    }

    return Array.from(menuMap.values());
  }

  /**
   * Sign request for HMAC verification
   */
  protected signRequest(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Verify webhook HMAC signature
   */
  protected verifyHmacSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return signature === expectedSignature;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract getLocation(locationId: string): Promise<POSLocation>;

  abstract listLocations(): Promise<POSLocation[]>;

  abstract getMenuItems(
    locationId: string,
    categoryId?: string,
  ): Promise<POSMenuItem[]>;

  abstract syncMenu(
    locationId: string,
    options?: MenuSyncOptions,
  ): Promise<void>;

  abstract createOrder(
    locationId: string,
    order: Partial<POSOrder>,
  ): Promise<POSOrder>;

  abstract getOrder(locationId: string, orderId: string): Promise<POSOrder>;

  abstract listOrders(
    locationId: string,
    filters?: OrderFilters,
  ): Promise<POSOrder[]>;

  abstract updateOrder(
    locationId: string,
    orderId: string,
    updates: Partial<POSOrder>,
  ): Promise<POSOrder>;

  abstract addPayment(
    locationId: string,
    orderId: string,
    payment: Partial<POSPayment>,
  ): Promise<POSPayment>;

  abstract voidOrder(
    locationId: string,
    orderId: string,
    reason?: string,
  ): Promise<POSOrder>;

  abstract sendToKitchen(locationId: string, orderId: string): Promise<void>;

  abstract getKitchenDisplayStatus(
    locationId: string,
    orderId: string,
  ): Promise<KitchenOrderStatus>;

  abstract listEmployees(locationId: string): Promise<any[]>;

  abstract createShift(locationId: string, shift: Partial<any>): Promise<any>;

  abstract closeShift(locationId: string, shiftId: string): Promise<any>;

  abstract getRevenueCenter(
    locationId: string,
    revenueCenterId: string,
  ): Promise<any>;

  abstract listRevenueCenters(locationId: string): Promise<any[]>;

  abstract verifyWebhookSignature(payload: string, signature: string): boolean;

  abstract parseWebhookPayload(
    payload: Record<string, any>,
  ): POSWebhookEvent | null;
}
