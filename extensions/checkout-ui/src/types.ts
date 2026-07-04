// @ts-nocheck

/**
 * Represents a single available delivery date
 */
export interface DeliveryDate {
  date: string; // ISO 8601 format: YYYY-MM-DD
  label: string; // Human-readable display: "Mon, Mar 10"
  available: boolean;
  slotCount: number; // Total slots available on this date
}

/**
 * Represents a single time slot available for delivery
 */
export interface TimeSlot {
  id: string; // Unique identifier for the slot
  startTime: string; // ISO 8601 format: HH:MM
  endTime: string; // ISO 8601 format: HH:MM
  label: string; // Display: "9:00 AM - 12:00 PM"
  timeGroup: "morning" | "afternoon" | "evening";
  available: boolean;
  slotsRemaining: number;
  price: number; // Delivery fee in cents
}

/**
 * Represents the user's selected delivery details
 */
export interface DeliverySelection {
  date: string; // Selected date (YYYY-MM-DD)
  slotId: string; // Selected time slot ID
  timeLabel: string; // Display-friendly time label
  deliveryFee: number; // Total fee in cents
  estimatedDate: string; // ISO date string
  estimatedTime: string; // Time range label
}

/**
 * API response for available delivery dates
 */
export interface DeliveryDatesResponse {
  dates: DeliveryDate[];
  errors?: string[];
}

/**
 * API response for time slots
 */
export interface TimeSlotsResponse {
  slots: TimeSlot[];
  errors?: string[];
}

/**
 * Cart item details for delivery fee calculation
 */
export interface CartItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
}

/**
 * Checkout attributes to save delivery selection
 */
export interface CheckoutAttributes {
  witylogix_delivery_date?: string;
  witylogix_delivery_slot?: string;
  witylogix_delivery_fee?: string;
  witylogix_time_label?: string;
}

/**
 * Error state information
 */
export interface ErrorState {
  type: "fetch" | "validation" | "save" | "network";
  message: string;
  retry?: () => void;
}
