import type { TrackingData } from '../types'

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api'

export interface AIEtaData {
  estimatedArrival: string
  confidenceLow: string
  confidenceHigh: string
  isAIPredicted: boolean
  lastUpdated: string
}

export async function fetchAIEta(trackingToken: string): Promise<AIEtaData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/tracking/token/${trackingToken}/eta`)
    if (!response.ok) return null
    const json = await response.json()
    return json.data ?? null
  } catch {
    return null
  }
}

export async function fetchTrackingData(orderId: string): Promise<TrackingData> {
  const response = await fetch(`${API_BASE_URL}/tracking/${orderId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Order not found')
    }
    throw new Error('Failed to fetch tracking data')
  }

  return response.json()
}

export interface DeliveryPreferences {
  safePlace?: string
  instructions?: string
  rescheduleDate?: string // YYYY-MM-DD
  rescheduleTimeWindow?: 'morning' | 'afternoon' | 'evening' | 'anytime'
  redirectAddress?: {
    line1: string
    city: string
    postalCode: string
  }
  deliveryMethod?: 'door' | 'signature' | 'neighbor'
  phoneNumber?: string
}

export interface PreferencesUpdateResult {
  data: Record<string, unknown>
  notification: {
    sent: boolean
    channels: string[]
    message: string
  }
}

export async function updateDeliveryPreferences(
  deliveryId: string,
  preferences: DeliveryPreferences,
): Promise<PreferencesUpdateResult> {
  const response = await fetch(`${API_BASE_URL}/v4/deliveries/${deliveryId}/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as any).error || 'Failed to update delivery preferences')
  }

  return response.json()
}
