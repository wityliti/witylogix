import { useState } from 'react'
import type { TrackingData } from '../types'
import { DriverCard } from './DriverCard'
import { StatusTimeline } from './StatusTimeline'
import { TrackingMap } from './TrackingMap'
import { calculateETA, formatDate } from '../lib/utils'

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'

interface TrackingResultPageProps {
  trackingData: TrackingData
  isMobile: boolean
  onPreferences: () => void
  onHome: () => void
}

export function TrackingResultPage({
  trackingData,
  isMobile,
  onPreferences,
  onHome,
}: TrackingResultPageProps) {
  const [shareToastVisible, setShareToastVisible] = useState(false)
  const [expandedMap, setExpandedMap] = useState(false)

  const { order, driver, currentLocation, route, statusHistory } = trackingData

  const handleShareTracking = () => {
    const trackingUrl = `${window.location.origin}${window.location.pathname}#/track/${order.id}`
    navigator.clipboard.writeText(trackingUrl)
    setShareToastVisible(true)
    setTimeout(() => setShareToastVisible(false), 3000)
  }

  const maskAddress = (address: string) => {
    // Simple masking: "123 Elm Street, Apt 456" -> "*** Elm Street, Apt **"
    const parts = address.split(',')
    if (parts.length > 0) {
      const firstPart = parts[0].trim()
      const words = firstPart.split(' ')
      if (words.length > 0) {
        words[0] = '***'
        if (words.length > 1 && /^\d+$/.test(words[words.length - 1])) {
          words[words.length - 1] = '**'
        }
        return words.join(' ') + (parts.length > 1 ? ',' + parts.slice(1).join(',') : '')
      }
    }
    return address
  }

  const renderStatusIcon = (status: string) => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes('pending')) return '📋'
    if (lowerStatus.includes('accepted')) return '✓'
    if (lowerStatus.includes('assigned')) return '👤'
    if (lowerStatus.includes('picked')) return '📦'
    if (lowerStatus.includes('transit')) return '🚚'
    if (lowerStatus.includes('delivery')) return '📍'
    if (lowerStatus.includes('delivered')) return '🎉'
    return '📦'
  }

  const renderMainView = () => {
    if (isMobile || expandedMap) {
      return (
        <div
          style={{
            width: '100%',
            minHeight: '100vh',
            backgroundColor: BG_COLOR,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header with back button */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'white',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <button
              onClick={onHome}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px 8px',
              }}
            >
              ←
            </button>
            <div>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0',
                }}
              >
                Track Your Delivery
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '0',
                }}
              >
                {order.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          {/* Map */}
          <div
            style={{
              height: expandedMap ? '100vh' : '300px',
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <TrackingMap
              deliveryLocation={order.deliveryLocation}
              driverLocation={currentLocation}
              route={route}
              pickupLocation={order.pickupLocation}
            />
            {expandedMap && (
              <button
                onClick={() => setExpandedMap(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: BRAND_BLUE,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                Collapse Map
              </button>
            )}
          </div>

          {/* Content */}
          {!expandedMap && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingBottom: '20px',
              }}
            >
              {/* Status Header */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '56px',
                    marginBottom: '12px',
                    animation: order.status === 'OUT_FOR_DELIVERY'
                      ? 'pulse 2s ease-in-out infinite'
                      : 'none',
                  }}
                >
                  {renderStatusIcon(order.status)}
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Current Status
                </p>
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: '0',
                  }}
                >
                  {order.status.replace(/_/g, ' ')}
                </h2>
              </div>

              <style>
                {`@keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.6; }
                }`}
              </style>

              {/* ETA */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Estimated Arrival
                </p>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: BRAND_GREEN,
                    marginBottom: '12px',
                  }}
                >
                  {calculateETA(order.eta).formatted}
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    margin: '0',
                  }}
                >
                  {new Date(order.eta).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {/* Driver Card */}
              <DriverCard driver={driver} eta={order.eta} />

              {/* Delivery Address */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Delivery Address
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#1f2937',
                    margin: '0',
                    lineHeight: '1.5',
                  }}
                >
                  {maskAddress(order.deliveryLocation.address)}
                </p>
              </div>

              {/* Status Timeline */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <StatusTimeline
                  currentStatus={order.status}
                  statusHistory={statusHistory}
                />
              </div>

              {/* Package Details */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: '0 0 16px 0',
                  }}
                >
                  Package Details
                </h3>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    📦 Order ID: {order.id.slice(0, 16)}...
                  </p>
                  <p style={{ margin: '0' }}>
                    📅 Order Date: {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <button
                  onClick={onPreferences}
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${BRAND_BLUE}`,
                    color: BRAND_BLUE,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      BRAND_BLUE
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'white'
                    ;(e.currentTarget as HTMLButtonElement).style.color = BRAND_BLUE
                  }}
                >
                  Delivery Preferences
                </button>
                <button
                  onClick={handleShareTracking}
                  style={{
                    backgroundColor: BRAND_BLUE,
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: 'none',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      '#004ba3'
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      BRAND_BLUE
                  }}
                >
                  {shareToastVisible ? '✓ Copied to Clipboard' : 'Share Tracking Link'}
                </button>
              </div>

              {/* Support Link */}
              <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                <a
                  href="mailto:support@witylogix.com"
                  style={{
                    fontSize: '12px',
                    color: BRAND_BLUE,
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  Contact Support
                </a>
              </div>
            </div>
          )}
        </div>
      )
    }

    // Desktop view: Side-by-side layout
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          backgroundColor: BG_COLOR,
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {/* Map Section */}
        <div
          style={{
            flex: 1,
            height: '100vh',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <TrackingMap
            deliveryLocation={order.deliveryLocation}
            driverLocation={currentLocation}
            route={route}
            pickupLocation={order.pickupLocation}
          />
        </div>

        {/* Info Section */}
        <div
          style={{
            width: '40%',
            height: '100vh',
            backgroundColor: BG_COLOR,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: '#1f2937',
                  margin: '0 0 8px 0',
                }}
              >
                Track Your Delivery
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: '0',
                }}
              >
                Order {order.id.slice(0, 8)}...
              </p>
            </div>
            <button
              onClick={onHome}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px',
                padding: '4px',
              }}
            >
              ←
            </button>
          </div>

          {/* Status Header */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                marginBottom: '12px',
                animation: order.status === 'OUT_FOR_DELIVERY'
                  ? 'pulse 2s ease-in-out infinite'
                  : 'none',
              }}
            >
              {renderStatusIcon(order.status)}
            </div>
            <p
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Current Status
            </p>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1f2937',
                margin: '0',
              }}
            >
              {order.status.replace(/_/g, ' ')}
            </h2>
          </div>

          <style>
            {`@keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }`}
          </style>

          {/* ETA */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Estimated Arrival
            </p>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: BRAND_GREEN,
                marginBottom: '8px',
              }}
            >
              {calculateETA(order.eta).formatted}
            </div>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
                margin: '0',
              }}
            >
              {new Date(order.eta).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Driver Card */}
          <DriverCard driver={driver} eta={order.eta} />

          {/* Delivery Address */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                color: '#6b7280',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Delivery Address
            </p>
            <p
              style={{
                fontSize: '14px',
                color: '#1f2937',
                margin: '0',
                lineHeight: '1.5',
              }}
            >
              {maskAddress(order.deliveryLocation.address)}
            </p>
          </div>

          {/* Status Timeline */}
          <StatusTimeline currentStatus={order.status} statusHistory={statusHistory} />

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexDirection: 'column',
            }}
          >
            <button
              onClick={onPreferences}
              style={{
                backgroundColor: 'white',
                border: `1px solid ${BRAND_BLUE}`,
                color: BRAND_BLUE,
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  BRAND_BLUE
                ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'white'
                ;(e.currentTarget as HTMLButtonElement).style.color = BRAND_BLUE
              }}
            >
              Delivery Preferences
            </button>
            <button
              onClick={handleShareTracking}
              style={{
                backgroundColor: BRAND_BLUE,
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                border: 'none',
                transition: 'background-color 0.2s ease',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#004ba3'
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  BRAND_BLUE
              }}
            >
              {shareToastVisible ? '✓ Copied' : 'Share Link'}
            </button>
          </div>

          {/* Support Link */}
          <div style={{ textAlign: 'center', paddingTop: '8px' }}>
            <a
              href="mailto:support@witylogix.com"
              style={{
                fontSize: '12px',
                color: BRAND_BLUE,
                textDecoration: 'none',
                fontWeight: '600',
              }}
            >
              Contact Support
            </a>
          </div>

          <div style={{ height: '20px' }} />
        </div>
      </div>
    )
  }

  return renderMainView()
}
