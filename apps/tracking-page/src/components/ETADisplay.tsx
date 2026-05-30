import { useState, useEffect } from 'react'

export interface ETADisplayProps {
  /** ISO datetime string — either estimatedArrival or actualDelivery from the API */
  estimatedDelivery: string
  /** Time slot name from the API (e.g. "Morning 8am–12pm") */
  timeSlot?: string
  isLive: boolean
  /** When true, shows "Delivered on …" wording instead of countdown */
  isDelivered?: boolean
}

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const LIGHT_TEXT = '#6b7280'
const DARK_TEXT = '#1f2937'

function formatDeliveryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTimeString(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isDateToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function computeCountdown(iso: string): string {
  const diff = Math.max(0, new Date(iso).getTime() - Date.now())
  if (diff === 0) return ''
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(minutes, 1)}m`
}

export function ETADisplay({ estimatedDelivery, timeSlot, isLive, isDelivered = false }: ETADisplayProps) {
  const [countdown, setCountdown] = useState(() => computeCountdown(estimatedDelivery))
  const today = isDateToday(estimatedDelivery)

  useEffect(() => {
    setCountdown(computeCountdown(estimatedDelivery))
    const id = setInterval(() => setCountdown(computeCountdown(estimatedDelivery)), 60_000)
    return () => clearInterval(id)
  }, [estimatedDelivery])

  const label = isDelivered ? 'Delivered On' : 'Estimated Delivery'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p
        style={{
          fontSize: '11px',
          color: LIGHT_TEXT,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: '600',
        }}
      >
        {label}
      </p>

      {/* Countdown (today, not yet delivered) */}
      {today && countdown && !isDelivered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: BRAND_GREEN, letterSpacing: '-1px' }}>
            {countdown}
          </div>
          <div>
            <p style={{ fontSize: '13px', color: LIGHT_TEXT, margin: 0 }}>until delivery</p>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                <span
                  style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: BRAND_GREEN, display: 'inline-block',
                    animation: 'eta-pulse 2s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: '11px', color: BRAND_GREEN, fontWeight: '600' }}>Live</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time slot */}
      {timeSlot && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '10px 12px',
          }}
        >
          <p style={{ fontSize: '13px', color: '#1e40af', margin: 0, fontWeight: '500' }}>
            {timeSlot}
          </p>
        </div>
      )}

      {/* Full date */}
      {(!today || isDelivered || !countdown) && (
        <div
          style={{
            backgroundColor: '#f3f4f6',
            padding: '11px 14px',
            borderRadius: '8px',
            borderLeft: `4px solid ${isDelivered ? BRAND_GREEN : BRAND_BLUE}`,
          }}
        >
          <p style={{ fontSize: '15px', fontWeight: '600', color: DARK_TEXT, margin: 0 }}>
            {formatDeliveryDate(estimatedDelivery)}
            {today && isDelivered && (
              <span style={{ color: LIGHT_TEXT, fontWeight: '400', fontSize: '13px' }}>
                {' '}at {formatTimeString(estimatedDelivery)}
              </span>
            )}
          </p>
        </div>
      )}

      <style>{`
        @keyframes eta-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
