/**
 * ShipmentTracker — used by the cart widget / embedded plugin context.
 * Fetches real data from the public tracking API using the tracking token.
 * Carrier/weight/dimensions not exposed by public API — those fields are omitted.
 */
import { useState, useEffect } from 'react'
import { fetchTrackingData } from '../lib/api'
import type { TrackingResponse } from '../types'
import { ETADisplay } from './ETADisplay'
import { StatusTimeline } from './StatusTimeline'

export interface ShipmentTrackerProps {
  /** Public tracking token for the shipment */
  trackingToken: string
}

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const DARK_TEXT = '#1f2937'
const LIGHT_TEXT = '#6b7280'

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Order Received',
    ACCEPTED: 'Order Confirmed',
    ASSIGNED: 'Driver Assigned',
    PICKED_UP: 'Picked Up',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    ARRIVED: 'Driver Arrived',
    DELIVERED: 'Delivered',
    FAILED: 'Delivery Failed',
    RETURNED: 'Returned',
    CANCELLED: 'Cancelled',
  }
  return labels[status] ?? status.replace(/_/g, ' ')
}

export function ShipmentTracker({ trackingToken }: ShipmentTrackerProps) {
  const [data, setData] = useState<TrackingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchTrackingData(trackingToken)
      .then((result) => {
        if (!cancelled) setData(result.response)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load shipment data')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [trackingToken])

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(trackingToken).catch(() => { /* ignore */ })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px', height: '40px', border: '3px solid #e5e7eb',
              borderTop: `3px solid ${BRAND_BLUE}`, borderRadius: '50%',
              margin: '0 auto 12px', animation: 'st-spin 0.8s linear infinite',
            }}
          />
          <p style={{ color: LIGHT_TEXT, margin: 0, fontSize: '14px' }}>Loading shipment details…</p>
          <style>{`@keyframes st-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>
          {error || 'Unable to load shipment data'}
        </p>
      </div>
    )
  }

  const isLive = ['OUT_FOR_DELIVERY', 'ARRIVED'].includes(data.status)
  const isDelivered = data.status === 'DELIVERED'
  const displayEta = data.actualDelivery ?? data.estimatedArrival ?? null

  return (
    <div
      style={{
        backgroundColor: 'white', borderRadius: '16px',
        padding: isMobile ? '20px' : '28px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: isMobile ? '18px' : '22px',
      }}
    >
      {/* Header: shop + tracking token */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: DARK_TEXT, margin: '0 0 10px 0' }}>
            {data.shop.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <code style={{
              backgroundColor: '#f3f4f6', padding: '7px 11px', borderRadius: '8px',
              fontSize: '12px', fontFamily: 'monospace', color: DARK_TEXT, fontWeight: '600',
            }}>
              {trackingToken}
            </code>
            <button
              onClick={handleCopyTracking}
              style={{
                backgroundColor: 'transparent', border: `2px solid ${BRAND_BLUE}`,
                color: BRAND_BLUE, padding: '5px 12px', borderRadius: '7px',
                cursor: 'pointer', fontSize: '12px', fontWeight: '700',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          backgroundColor: isDelivered ? BRAND_GREEN : isLive ? BRAND_BLUE : '#6b7280',
          color: 'white', padding: '8px 14px', borderRadius: '10px',
          fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {getStatusLabel(data.status)}
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Live indicator */}
      {isLive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '9px', height: '9px', borderRadius: '50%', backgroundColor: BRAND_GREEN,
            animation: 'st-pulse 2s ease-in-out infinite', display: 'inline-block',
          }} />
          <span style={{ fontSize: '13px', color: BRAND_GREEN, fontWeight: '600' }}>Live tracking active</span>
          <style>{`@keyframes st-pulse { 0%,100%{opacity:1}50%{opacity:0.5} }`}</style>
        </div>
      )}

      {/* ETA */}
      {displayEta && (
        <ETADisplay
          estimatedDelivery={displayEta}
          timeSlot={data.timeSlot?.name}
          isLive={isLive}
          isDelivered={isDelivered}
        />
      )}

      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Delivery address */}
      <div>
        <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
          Delivery Address
        </p>
        <p style={{ fontSize: '14px', color: DARK_TEXT, margin: 0, lineHeight: '1.5' }}>
          {[data.deliveryAddress.line1, data.deliveryAddress.city, data.deliveryAddress.province, data.deliveryAddress.postalCode]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>

      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Timeline */}
      <StatusTimeline currentStatus={data.status} timeline={data.timeline} />

      {/* Proof of delivery */}
      {isDelivered && data.proofOfDelivery?.recipientName && (
        <div style={{ backgroundColor: '#f0fdf4', border: `1px solid ${BRAND_GREEN}`, borderRadius: '10px', padding: '14px' }}>
          <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>
            Delivered to <strong>{data.proofOfDelivery.recipientName}</strong>
            {data.proofOfDelivery.deliveredAt && (
              <> on {new Date(data.proofOfDelivery.deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
