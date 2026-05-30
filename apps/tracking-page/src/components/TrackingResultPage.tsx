import { useState } from 'react'
import type { TrackingData } from '../types'
import { StatusTimeline } from './StatusTimeline'
import { TrackingMap } from './TrackingMap'
import { ETADisplay } from './ETADisplay'

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'
const DARK_TEXT = '#1a1a1a'
const LIGHT_TEXT = '#6b7280'

interface TrackingResultPageProps {
  trackingData: TrackingData
  isMobile: boolean
  onPreferences: () => void
  onHome: () => void
}

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

function getStatusIcon(status: string): string {
  switch (status) {
    case 'PENDING':          return '📋'
    case 'ACCEPTED':         return '✅'
    case 'ASSIGNED':         return '👤'
    case 'PICKED_UP':        return '📦'
    case 'OUT_FOR_DELIVERY': return '🚚'
    case 'ARRIVED':          return '📍'
    case 'DELIVERED':        return '🎉'
    case 'FAILED':           return '⚠️'
    case 'RETURNED':         return '↩️'
    case 'CANCELLED':        return '✖️'
    default:                 return '📦'
  }
}

function getVehicleIcon(vehicleType: string): string {
  const t = vehicleType.toLowerCase()
  if (t.includes('van'))                              return '🚐'
  if (t.includes('truck'))                            return '🚚'
  if (t.includes('bike') || t.includes('motorcycle')) return '🏍️'
  if (t.includes('car'))                              return '🚗'
  return '🚙'
}

function formatDeliveryAddress(addr: TrackingData['response']['deliveryAddress']): string {
  return [addr.line1, addr.city, addr.province, addr.postalCode].filter(Boolean).join(', ')
}

function maskAddress(address: string): string {
  const parts = address.split(',')
  if (parts.length === 0) return address
  const words = parts[0].trim().split(' ')
  if (words.length > 0) words[0] = '***'
  return [words.join(' '), ...parts.slice(1)].join(',')
}

export function TrackingResultPage({
  trackingData,
  isMobile,
  onPreferences,
  onHome,
}: TrackingResultPageProps) {
  const [shareToastVisible, setShareToastVisible] = useState(false)
  const [expandedMap, setExpandedMap] = useState(false)

  const { response, liveDriverLocation } = trackingData
  const {
    status,
    orderNumber,
    driver,
    driverLocation,
    estimatedArrival,
    actualDelivery,
    timeSlot,
    deliveryAddress,
    proofOfDelivery,
    timeline,
    shop,
  } = response

  // Prefer live socket location when available
  const activeDriverLocation = liveDriverLocation ?? driverLocation ?? null

  const handleShareTracking = () => {
    const url = `${window.location.origin}${window.location.pathname}#/track/${trackingData.trackingToken}`
    navigator.clipboard.writeText(url).catch(() => { /* clipboard may not be available */ })
    setShareToastVisible(true)
    setTimeout(() => setShareToastVisible(false), 3000)
  }

  const isLive = ['OUT_FOR_DELIVERY', 'ARRIVED'].includes(status)
  const isDelivered = status === 'DELIVERED'
  const showMap = !!activeDriverLocation

  const addressForDisplay = maskAddress(formatDeliveryAddress(deliveryAddress))
  const displayEta = actualDelivery ?? estimatedArrival ?? null

  const renderInfoPanel = () => (
    <div
      style={{
        width: isMobile ? '100%' : '420px',
        minWidth: isMobile ? undefined : '360px',
        height: isMobile ? undefined : '100vh',
        backgroundColor: BG_COLOR,
        overflowY: isMobile ? undefined : 'auto',
        padding: isMobile ? '0' : '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        paddingBottom: '32px',
      }}
    >
      {/* Branding / header (desktop only) */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={onHome}
            style={{ background: 'none', border: 'none', color: BRAND_BLUE, cursor: 'pointer', fontSize: '14px', fontWeight: '700', padding: 0 }}
          >
            ← New Search
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: DARK_TEXT }}>{shop.name}</div>
            {orderNumber && (
              <div style={{ fontSize: '11px', color: LIGHT_TEXT, fontFamily: 'monospace' }}>#{orderNumber}</div>
            )}
          </div>
        </div>
      )}

      {/* Status Card */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '12px', animation: isLive ? 'tp-pulse 2s ease-in-out infinite' : 'none' }}>
          {getStatusIcon(status)}
        </div>
        <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
          Current Status
        </p>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: DARK_TEXT, margin: 0 }}>
          {getStatusLabel(status)}
        </h2>
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: BRAND_GREEN, animation: 'tp-pulse 2s ease-in-out infinite', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: BRAND_GREEN, fontWeight: '600' }}>Live tracking active</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      {/* ETA */}
      {displayEta && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <ETADisplay
            estimatedDelivery={displayEta}
            timeSlot={timeSlot?.name}
            isLive={isLive}
            isDelivered={isDelivered}
          />
        </div>
      )}

      {/* Driver Card */}
      {driver && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
            Your Driver
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '52px', height: '52px', borderRadius: '50%',
                backgroundColor: BRAND_BLUE, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: '700', flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,91,211,0.25)',
              }}
            >
              {driver.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: '700', color: DARK_TEXT, margin: '0 0 3px 0' }}>{driver.name}</p>
              <p style={{ fontSize: '13px', color: LIGHT_TEXT, margin: 0 }}>
                {getVehicleIcon(driver.vehicleType)} {driver.vehicleType}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Address */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
          Delivery Address
        </p>
        <p style={{ fontSize: '14px', color: DARK_TEXT, margin: 0, lineHeight: '1.5' }}>
          {addressForDisplay}
        </p>
      </div>

      {/* Map inline (mobile) */}
      {isMobile && showMap && (
        <div style={{ borderRadius: '16px', overflow: 'hidden', height: expandedMap ? '60vh' : '220px', position: 'relative' }}>
          <TrackingMap deliveryLocation={deliveryAddress} driverLocation={activeDriverLocation} />
          <button
            onClick={() => setExpandedMap((v) => !v)}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              backgroundColor: 'white', border: 'none', borderRadius: '6px',
              padding: '6px 12px', cursor: 'pointer', fontSize: '12px',
              fontWeight: '600', color: BRAND_BLUE, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          >
            {expandedMap ? 'Collapse' : 'Expand Map'}
          </button>
        </div>
      )}

      {/* Proof of Delivery */}
      {proofOfDelivery && isDelivered && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
            Proof of Delivery
          </p>
          {proofOfDelivery.recipientName && (
            <p style={{ fontSize: '13px', color: DARK_TEXT, margin: '0 0 8px 0' }}>
              Received by: <strong>{proofOfDelivery.recipientName}</strong>
            </p>
          )}
          {proofOfDelivery.deliveredAt && (
            <p style={{ fontSize: '13px', color: LIGHT_TEXT, margin: '0 0 12px 0' }}>
              {new Date(proofOfDelivery.deliveredAt).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </p>
          )}
          {proofOfDelivery.photoUrls && proofOfDelivery.photoUrls.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {proofOfDelivery.photoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Proof ${i + 1}`}
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Timeline */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <StatusTimeline currentStatus={status} timeline={timeline} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!isDelivered && (
          <button
            onClick={onPreferences}
            style={{
              backgroundColor: 'white', border: `2px solid ${BRAND_BLUE}`, color: BRAND_BLUE,
              padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '700',
            }}
          >
            Delivery Preferences
          </button>
        )}
        <button
          onClick={handleShareTracking}
          style={{
            backgroundColor: BRAND_BLUE, color: 'white',
            padding: '12px 16px', borderRadius: '10px',
            cursor: 'pointer', fontSize: '14px', fontWeight: '700', border: 'none',
          }}
        >
          {shareToastVisible ? '✓ Link Copied' : 'Share Tracking Link'}
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <a
          href="mailto:support@witylogix.com"
          style={{ fontSize: '12px', color: BRAND_BLUE, textDecoration: 'none', fontWeight: '600' }}
        >
          Contact Support
        </a>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', backgroundColor: BG_COLOR }}>
        {/* Sticky header */}
        <div style={{
          padding: '12px 16px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button onClick={onHome} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '4px' }}>
            ←
          </button>
          <div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: DARK_TEXT, margin: 0 }}>
              {shop.name || 'Track Your Delivery'}
            </p>
            {orderNumber && (
              <p style={{ fontSize: '11px', color: LIGHT_TEXT, margin: 0, fontFamily: 'monospace' }}>#{orderNumber}</p>
            )}
          </div>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '40px' }}>
          {renderInfoPanel()}
        </div>
      </div>
    )
  }

  // Desktop: map fills left side, info panel right
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {showMap ? (
          <TrackingMap deliveryLocation={deliveryAddress} driverLocation={activeDriverLocation} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8eef5', gap: '12px',
          }}>
            <div style={{ fontSize: '56px' }}>🗺️</div>
            <p style={{ fontSize: '14px', color: LIGHT_TEXT, margin: 0, fontWeight: '500' }}>
              Live map active when driver is en route
            </p>
          </div>
        )}
      </div>
      {renderInfoPanel()}
    </div>
  )
}
