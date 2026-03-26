import type { TrackingData } from '../types'

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api'

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
