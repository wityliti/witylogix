/**
 * ETA Recalculator — Type Definitions
 */

import type { ZoneType } from '../ai-eta/lightgbm-residual-model.js';

// ─── Input types ──────────────────────────────────────────────────────────

/** Real-time GPS update from a driver's device */
export interface DriverLocationUpdate {
  driverId: string;
  shopId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading?: number;
  timestamp: Date;
}

/** A delivery currently being tracked for real-time ETA updates */
export interface ActiveDelivery {
  deliveryId: string;
  shopId: string;
  driverId: string;
  destination: { lat: number; lng: number };
  /** Customer phone number for SMS notifications */
  customerPhone: string;
  /** Optional FCM/APNs push token */
  customerPushToken?: string;
  /** ETA in minutes that was last communicated to the customer, null if never sent */
  currentEtaMinutes: number | null;
  /** When the ETA was last sent to the customer */
  lastSentEtaAt: Date | null;
  /** Zone context for ML feature extraction */
  zoneType?: ZoneType;
  /** Number of stops remaining before this delivery */
  numStopsRemaining?: number;
}

// ─── Output types ─────────────────────────────────────────────────────────

/** An entry in the ETA change log for a delivery */
export interface ETAHistoryEntry {
  calculatedAt: Date;
  newEtaMinutes: number;
  previousEtaMinutes: number | null;
  deltaMinutes: number | null;
  distanceRemainingKm: number;
  notificationFired: boolean;
}

/** Result of a single ETA recalculation for one delivery */
export interface RecalculationResult {
  deliveryId: string;
  /** New ETA in minutes from now */
  newEtaMinutes: number;
  /** Previous ETA in minutes (from lastSentEtaAt), null if first calculation */
  previousEtaMinutes: number | null;
  /** Change vs previous ETA (positive = later, negative = earlier), null if no previous */
  etaDeltaMinutes: number | null;
  /** Remaining distance in km from driver to destination */
  distanceRemainingKm: number;
  /** Confidence score 0–1 */
  confidence: number;
  /** Whether a customer notification was triggered */
  notificationFired: boolean;
  /** ETA history entry for this recalculation */
  etaHistory: ETAHistoryEntry;
}

// ─── Notification types ───────────────────────────────────────────────────

/** Notification channels to use */
export type NotificationChannel = 'sms' | 'push';

/** Payload passed to the notification handler when ETA delta exceeds threshold */
export interface NotificationTrigger {
  deliveryId: string;
  shopId: string;
  customerPhone: string;
  customerPushToken?: string;
  newEtaMinutes: number;
  previousEtaMinutes: number;
  deltaMinutes: number;
  channels: NotificationChannel[];
}

// ─── Service config ───────────────────────────────────────────────────────

export interface ETARecalculatorConfig {
  /**
   * Called when ETA changes by more than deltaThresholdMinutes.
   * Implement to send SMS/push via NotificationService.
   */
  onNotify: (trigger: NotificationTrigger) => Promise<void>;
  /**
   * Minimum absolute delta (minutes) before firing a notification.
   * Default: 5
   */
  deltaThresholdMinutes?: number;
  /**
   * Default driver speed (km/h) when GPS speed is 0 or missing.
   * Default: 30
   */
  defaultSpeedKmh?: number;
}
