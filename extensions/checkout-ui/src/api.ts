// @ts-nocheck
import {
  CartItem,
  DeliveryDate,
  TimeSlot,
  DeliveryDatesResponse,
  TimeSlotsResponse,
} from "./types";

/**
 * API client for Witylogix delivery services
 * Communicates with the backend via Shopify App Bridge
 */

const API_BASE_URL = process.env.VITE_API_URL || "https://api.witylogix.app";

/**
 * Get session token from Shopify App Bridge
 * This token is used for authentication with the backend
 */
async function getSessionToken(): Promise<string> {
  // In a real implementation, this would use the Shopify App Bridge
  // For now, we'll simulate it. The actual token comes from window.__SHOPIFY_SESSION_TOKEN__
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      (window as any).__SHOPIFY_SESSION_TOKEN__
    ) {
      resolve((window as any).__SHOPIFY_SESSION_TOKEN__);
    } else {
      // Fallback: resolve with empty token (will be handled by backend)
      resolve("");
    }
  });
}

/**
 * Fetch available delivery dates for a shop
 * @param shopId - Shopify shop ID
 * @param cartItems - Items in the cart
 * @returns Promise with available dates
 */
export async function fetchDeliveryDates(
  shopId: string,
  cartItems: CartItem[],
): Promise<DeliveryDate[]> {
  try {
    const token = await getSessionToken();

    const response = await fetch(`${API_BASE_URL}/api/delivery/dates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        items: cartItems,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: DeliveryDatesResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]);
    }

    return data.dates || [];
  } catch (error) {
    console.error("Failed to fetch delivery dates:", error);
    throw error;
  }
}

/**
 * Fetch available time slots for a specific date
 * @param shopId - Shopify shop ID
 * @param date - Date in YYYY-MM-DD format
 * @returns Promise with available time slots
 */
export async function fetchTimeSlots(
  shopId: string,
  date: string,
): Promise<TimeSlot[]> {
  try {
    const token = await getSessionToken();

    const response = await fetch(`${API_BASE_URL}/api/delivery/slots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify({
        date,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: TimeSlotsResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]);
    }

    return data.slots || [];
  } catch (error) {
    console.error("Failed to fetch time slots:", error);
    throw error;
  }
}

/**
 * Save delivery selection to checkout attributes
 * @param shopId - Shopify shop ID
 * @param selection - The delivery selection to save
 */
export async function saveDeliverySelection(
  shopId: string,
  selection: {
    date: string;
    slotId: string;
    timeLabel: string;
    deliveryFee: number;
  },
): Promise<boolean> {
  try {
    const token = await getSessionToken();

    const response = await fetch(`${API_BASE_URL}/api/delivery/selection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        "X-Shop-ID": shopId,
      },
      body: JSON.stringify(selection),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to save delivery selection:", error);
    return false;
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
 * Group time slots by time of day
 * @param slots - Array of time slots
 * @returns Object with slots grouped by time period
 */
export function groupSlotsByTime(
  slots: TimeSlot[],
): Record<string, TimeSlot[]> {
  return slots.reduce(
    (acc, slot) => {
      const group = slot.timeGroup;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(slot);
      return acc;
    },
    {} as Record<string, TimeSlot[]>,
  );
}
