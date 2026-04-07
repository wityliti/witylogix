import { useState, useEffect } from 'react'
import type { AIEtaData } from '../lib/api'

export interface ETADisplayProps {
  estimatedDelivery: string
  timeSlot?: string
  isLive: boolean
  aiEta?: AIEtaData | null
}

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'

export function ETADisplay({
  estimatedDelivery,
  timeSlot,
  isLive,
  aiEta,
}: ETADisplayProps) {
  const [countdown, setCountdown] = useState<string>('')
  const [isToday, setIsToday] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const calculateCountdown = () => {
      const eta = new Date(displayEta).getTime()
      const now = Date.now()
      const diff = eta - now

      // Check if delivery is today
      const etaDate = new Date(displayEta)
      const todayDate = new Date()
      const isDeliveryToday =
        etaDate.getFullYear() === todayDate.getFullYear() &&
        etaDate.getMonth() === todayDate.getMonth() &&
        etaDate.getDate() === todayDate.getDate()

      setIsToday(isDeliveryToday && diff > 0)

      if (isDeliveryToday && diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

        if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m`)
        } else {
          setCountdown(`${Math.max(minutes, 1)}m`)
        }
      } else {
        setCountdown('')
      }
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [estimatedDelivery])

  const formatDeliveryDate = (dateString: string) => {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }
    return date.toLocaleDateString('en-US', options)
  }

  const formatTimeSlot = (slot?: string) => {
    if (!slot) return null
    return `Expected between ${slot}`
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  // Use AI ETA as primary source when available
  const displayEta = aiEta ? aiEta.estimatedArrival : estimatedDelivery

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Estimated Delivery
          </p>
          {aiEta?.isAIPredicted && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#7c3aed',
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '4px',
                padding: '1px 6px',
                letterSpacing: '0.3px',
              }}
            >
              Powered by AI
            </span>
          )}
        </div>

        {/* Countdown Timer (if today) */}
        {isToday && countdown && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: isMobile ? '28px' : '36px',
                fontWeight: '700',
                color: BRAND_GREEN,
              }}
            >
              {countdown}
            </div>
            <div>
              <p
                style={{
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#6b7280',
                  margin: '0',
                }}
              >
                until delivery
              </p>
              {isLive && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: BRAND_GREEN,
                      borderRadius: '50%',
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      color: BRAND_GREEN,
                      fontWeight: '600',
                    }}
                  >
                    Live Tracking
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Time Slot Display */}
        {timeSlot && (
          <div
            style={{
              backgroundColor: '#f0f9ff',
              border: `1px solid #bfdbfe`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                color: '#1e40af',
                margin: '0',
                fontWeight: '500',
              }}
            >
              {formatTimeSlot(timeSlot)}
            </p>
          </div>
        )}

        {/* Date Display (if not today or no countdown) */}
        {!isToday || !countdown ? (
          <div
            style={{
              backgroundColor: '#f3f4f6',
              padding: '12px',
              borderRadius: '8px',
              borderLeft: `4px solid ${BRAND_BLUE}`,
            }}
          >
            <p
              style={{
                fontSize: isMobile ? '14px' : '15px',
                fontWeight: '600',
                color: '#1f2937',
                margin: '0',
              }}
            >
              {formatDeliveryDate(displayEta)}
            </p>
          </div>
        ) : null}

        {/* AI Confidence Range */}
        {aiEta?.isAIPredicted && (
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '4px 0 0 0',
            }}
          >
            between {formatTime(aiEta.confidenceLow)} and {formatTime(aiEta.confidenceHigh)}
          </p>
        )}
      </div>

      <style>
        {`@keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }`}
      </style>
    </div>
  )
}
