import type { TrackingData, TrackingResponse, AIEtaData } from "../types";

// VITE_API_URL should end WITHOUT /api (e.g. https://api.witylogix.com)
const API_BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_URL || "http://localhost:3000";

export type { AIEtaData };

/**
 * Fetch full tracking info for a shipment by its public tracking token.
 * Hits GET /tracking/token/:trackingToken (public, no auth required).
 */
export async function fetchTrackingData(
  trackingToken: string,
): Promise<TrackingData> {
  const url = `${API_BASE_URL}/tracking/token/${encodeURIComponent(trackingToken)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Tracking number not found. Please check and try again.");
    }
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as Record<string, unknown>).message)
        : "Failed to load tracking information";
    throw new Error(message);
  }

  const json: { data: TrackingResponse } = await response.json();

  return {
    trackingToken,
    response: json.data,
  };
}

/**
 * Fetch AI-predicted ETA for a tracking token.
 * Returns null on any error (non-blocking; UI falls back to static estimate).
 */
export async function fetchAIEta(
  trackingToken: string,
): Promise<AIEtaData | null> {
  try {
    const url = `${API_BASE_URL}/tracking/token/${encodeURIComponent(trackingToken)}/eta`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json: { data: AIEtaData } = await response.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─── Delivery Preferences (by tracking token) ────────────────────────────────

export interface DeliveryPreferences {
  instructions?: string;
  dropoffNote?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  contactPref?: "call" | "sms" | "whatsapp";
  rescheduledTo?: string; // ISO datetime
  timeSlotId?: string;
}

export interface PreferencesUpdateResult {
  data: Record<string, unknown>;
}

/**
 * Update customer delivery preferences using the tracking token (public endpoint).
 */
export async function updateDeliveryPreferences(
  trackingToken: string,
  preferences: DeliveryPreferences,
): Promise<PreferencesUpdateResult> {
  const url = `${API_BASE_URL}/tracking/token/${encodeURIComponent(trackingToken)}/preferences`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as Record<string, unknown>).message)
        : "Failed to update delivery preferences";
    throw new Error(message);
  }

  return response.json() as Promise<PreferencesUpdateResult>;
}
