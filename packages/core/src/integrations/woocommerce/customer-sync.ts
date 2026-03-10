/**
 * WooCommerce Customer Sync Service
 * Synchronizes customers between WooCommerce and Witylogix
 * with address book and guest customer merge support
 */

import type { WCCustomer, WCAddress } from "./types.js";

/**
 * WooCommerce Customer Sync Service
 */
export class CustomerSyncService {
  /**
   * Sync customer from WooCommerce to Witylogix
   */
  static syncCustomerFromWC(wcCustomer: WCCustomer): Record<string, unknown> {
    return {
      externalId: wcCustomer.id.toString(),
      email: wcCustomer.email,
      firstName: wcCustomer.first_name,
      lastName: wcCustomer.last_name,
      username: wcCustomer.username,
      phone: wcCustomer.billing.phone || "",
      role: wcCustomer.role,
      isPayingCustomer: wcCustomer.is_paying_customer,
      billingAddress: this.mapAddress(wcCustomer.billing),
      shippingAddress: this.mapAddress(wcCustomer.shipping),
      addresses: [
        {
          type: "billing",
          ...this.mapAddress(wcCustomer.billing),
        },
        {
          type: "shipping",
          ...this.mapAddress(wcCustomer.shipping),
        },
      ],
      metadata: {
        wcCustomerId: wcCustomer.id,
        role: wcCustomer.role,
        avatarUrl: wcCustomer.avatar_url,
      },
      createdAt: new Date(wcCustomer.date_created),
      updatedAt: new Date(wcCustomer.date_modified),
    };
  }

  /**
   * Sync customer from Witylogix to WooCommerce
   */
  static syncCustomerToWC(
    wlCustomer: Record<string, unknown>,
  ): Partial<WCCustomer> {
    const billingAddress = wlCustomer.billingAddress as Record<string, unknown>;
    const shippingAddress = wlCustomer.shippingAddress as Record<string, unknown>;

    return {
      email: (wlCustomer.email as string) || "",
      first_name: (wlCustomer.firstName as string) || "",
      last_name: (wlCustomer.lastName as string) || "",
      billing: this.unmapAddress(billingAddress || {}),
      shipping: this.unmapAddress(shippingAddress || {}),
    };
  }

  /**
   * Merge guest customer by email
   * WooCommerce allows guest checkout, so we need to merge guest orders with registered customers
   */
  static mergeGuestByEmail(
    guestEmail: string,
    registeredCustomer: WCCustomer,
  ): {
    shouldMerge: boolean;
    reason: string;
  } {
    if (guestEmail.toLowerCase() === registeredCustomer.email.toLowerCase()) {
      return {
        shouldMerge: true,
        reason: "Email addresses match exactly",
      };
    }

    return {
      shouldMerge: false,
      reason: "Email addresses do not match",
    };
  }

  /**
   * Map WC address to WL address
   */
  static mapAddress(wcAddress: WCAddress): Record<string, unknown> {
    return {
      firstName: wcAddress.first_name,
      lastName: wcAddress.last_name,
      company: wcAddress.company,
      street: wcAddress.address_1,
      street2: wcAddress.address_2,
      city: wcAddress.city,
      state: wcAddress.state,
      postalCode: wcAddress.postcode,
      country: wcAddress.country,
      phone: wcAddress.phone || "",
      email: wcAddress.email || "",
    };
  }

  /**
   * Unmap WL address to WC address
   */
  static unmapAddress(
    address: Record<string, unknown>,
  ): WCAddress {
    return {
      first_name: (address.firstName as string) || "",
      last_name: (address.lastName as string) || "",
      company: (address.company as string) || "",
      address_1: (address.street as string) || "",
      address_2: (address.street2 as string) || "",
      city: (address.city as string) || "",
      state: (address.state as string) || "",
      postcode: (address.postalCode as string) || "",
      country: (address.country as string) || "",
      email: (address.email as string) || "",
      phone: (address.phone as string) || "",
    };
  }

  /**
   * Link order history to customer
   */
  static linkOrderHistory(
    customerId: number,
    orderIds: number[],
  ): {
    customerId: number;
    linkedOrders: number[];
  } {
    return {
      customerId,
      linkedOrders: orderIds,
    };
  }

  /**
   * Validate customer data
   */
  static validateCustomer(wcCustomer: WCCustomer): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!wcCustomer.id) {
      errors.push("Customer ID is required");
    }

    if (!wcCustomer.email || !wcCustomer.email.includes("@")) {
      errors.push("Valid email is required");
    }

    if (!wcCustomer.first_name && !wcCustomer.last_name) {
      errors.push("First name or last name is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if customer needs update
   */
  static needsUpdate(
    currentCustomer: WCCustomer,
    updatedCustomer: Partial<WCCustomer>,
  ): boolean {
    const fieldsToCheck: Array<keyof WCCustomer> = [
      "first_name",
      "last_name",
      "email",
      "billing",
      "shipping",
    ];

    for (const field of fieldsToCheck) {
      if (field in updatedCustomer) {
        const current = currentCustomer[field];
        const updated = updatedCustomer[field];

        if (field === "billing" || field === "shipping") {
          if (JSON.stringify(current) !== JSON.stringify(updated)) {
            return true;
          }
        } else if (current !== updated) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get customer summary
   */
  static getCustomerSummary(wcCustomer: WCCustomer): {
    id: number;
    email: string;
    name: string;
    isPayingCustomer: boolean;
    hasBillingAddress: boolean;
    hasShippingAddress: boolean;
  } {
    const name = `${wcCustomer.first_name} ${wcCustomer.last_name}`.trim();
    const hasBillingAddress = Boolean(wcCustomer.billing?.address_1);
    const hasShippingAddress = Boolean(wcCustomer.shipping?.address_1);

    return {
      id: wcCustomer.id,
      email: wcCustomer.email,
      name: name || wcCustomer.username,
      isPayingCustomer: wcCustomer.is_paying_customer,
      hasBillingAddress,
      hasShippingAddress,
    };
  }

  /**
   * Detect potential duplicates by email
   */
  static detectDuplicates(
    customers: WCCustomer[],
  ): Array<{
    emails: string;
    customerIds: number[];
  }> {
    const emailMap = new Map<string, number[]>();

    for (const customer of customers) {
      const email = customer.email.toLowerCase();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)?.push(customer.id);
    }

    const duplicates: Array<{
      emails: string;
      customerIds: number[];
    }> = [];

    for (const [email, ids] of emailMap) {
      if (ids.length > 1) {
        duplicates.push({
          emails: email,
          customerIds: ids,
        });
      }
    }

    return duplicates;
  }
}

/**
 * Create customer sync service instance
 */
export function createCustomerSyncService(): typeof CustomerSyncService {
  return CustomerSyncService;
}
