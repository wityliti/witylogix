// @ts-nocheck

import type {
  POSOrder,
  POSDriver,
  DeliverySlot,
  DeliveryAssignment,
  SearchOrdersResponse,
  GetDriversResponse,
  GetSlotsResponse,
  AssignDeliveryResponse,
} from "./types";

/**
 * API client for POS UI extension
 * Communicates with the Witylogix backend
 */

const API_BASE_URL = process.env.VITE_API_URL || "https://api.witylogix.app";

/**
 * Get session token from extension context
 * Used for authentication with backend
 */
async function getSessionToken(): Promise<string> {
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      (window as any).__EXTENSION_CONFIG__?.apiKey
    ) {
      resolve((window as any).__EXTENSION_CONFIG__.apiKey);
    } else {
      resolve("");
    }
  });
}

/**
 * Get shop ID from extension config
 */
function getShopId(): string {
  if (
    typeof window !== "undefined" &&
    (window as any).__EXTENSION_CONFIG__?.shopId
  ) {
    return (window as any).__EXTENSION_CONFIG__.shopId;
  }
  return "";
}

/**
 * Search orders by ID, phone number, or customer name
 * @param query - Search query (order ID, phone, or name)
 * @returns Promise with search results
 */
export async function searchOrders(query: string): Promise<POSSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/pos/orders/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        query: query.trim(),
        limit: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: SearchOrdersResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]);
    }

    return data.results || [];
  } catch (error) {
    console.error("[POS API] Search failed:", error);
    throw error;
  }
}

/**
 * Get full order details by order ID
 * @param orderId - Order ID
 * @returns Promise with order details
 */
export async function getOrder(orderId: string): Promise<POSOrder> {
  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/pos/orders/${orderId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const order: POSOrder = await response.json();
    return order;
  } catch (error) {
    console.error("[POS API] Get order failed:", error);
    throw error;
  }
}

/**
 * Get available drivers for a delivery zone
 * @param zoneId - Zone ID (derived from order address)
 * @returns Promise with available drivers
 */
export async function getAvailableDrivers(
  zoneId: string,
): Promise<POSDriver[]> {
  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/pos/drivers/available`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        zoneId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: GetDriversResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]);
    }

    return data.drivers || [];
  } catch (error) {
    console.error("[POS API] Get drivers failed:", error);
    throw error;
  }
}

/**
 * Get available delivery time slots for a date and zone
 * @param zoneId - Zone ID
 * @param date - Date in YYYY-MM-DD format
 * @returns Promise with available slots
 */
export async function getDeliverySlots(
  zoneId: string,
  date: string,
): Promise<DeliverySlot[]> {
  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/pos/delivery/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        zoneId,
        date,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: GetSlotsResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]);
    }

    return data.slots || [];
  } catch (error) {
    console.error("[POS API] Get slots failed:", error);
    throw error;
  }
}

/**
 * Assign delivery to driver and create label
 * @param orderId - Order ID
 * @param driverId - Driver ID
 * @param slotId - Time slot ID
 * @returns Promise with assignment details
 */
export async function assignDelivery(
  orderId: string,
  driverId: string,
  slotId: string,
): Promise<DeliveryAssignment> {
  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/pos/delivery/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        orderId,
        driverId,
        slotId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: AssignDeliveryResponse = await response.json();

    if (!data.success || !data.assignment) {
      throw new Error(data.errors?.[0] || "Failed to assign delivery");
    }

    return data.assignment;
  } catch (error) {
    console.error("[POS API] Assign delivery failed:", error);
    throw error;
  }
}

/**
 * Format date from YYYY-MM-DD to readable format
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Human-readable date label
 */
export function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format time from HH:MM to readable format
 * @param time - Time string in HH:MM format
 * @returns Human-readable time label
 */
export function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return time;
  }
}

/**
 * Format currency value
 * @param value - Value in currency units
 * @param currency - ISO 4217 currency code
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Get delivery zone ID from address (simplified)
 * In production, this would call a backend service
 * @param postalCode - Postal code
 * @returns Zone ID
 */
export async function getZoneIdFromAddress(
  postalCode: string,
): Promise<string> {
  try {
    const token = await getSessionToken();
    const shopId = getShopId();

    const response = await fetch(`${API_BASE_URL}/api/zones/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({ postalCode }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.zoneId || "default";
  } catch (error) {
    console.error("[POS API] Zone lookup failed:", error);
    return "default";
  }
}
