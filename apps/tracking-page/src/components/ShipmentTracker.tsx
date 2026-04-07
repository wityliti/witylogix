import { useState, useEffect } from 'react'
import { _formatDate } from '../lib/utils'
import { ETADisplay } from './ETADisplay'
import { MultiCarrierStatus } from './MultiCarrierStatus'

export interface ShipmentTrackerProps {
  shipmentId: string
  trackingNumber: string
}

export interface ShipmentData {
  shipmentId: string
  trackingNumber: string
  carrier: 'FedEx' | 'UPS' | 'USPS' | 'DHL' | 'Local'
  deliveryMethod: 'Standard' | 'Express' | 'Next Day' | 'Same Day'
  status: string
  estimatedDelivery: string
  timeSlot?: string
  isLive: boolean
  weight?: number
  weightUnit?: string
  dimensions?: {
    length: number
    width: number
    height: number
    unit: string
  }
  deliveryInstructions?: string
  externalTrackingUrl?: string
  events: Array<{
    status: string
    timestamp: string
    location?: string
  }>
}

const BRAND_BLUE = '#3b82f6'
const BRAND_GREEN = '#10b981'
const DARK_TEXT = '#1f2937'
const LIGHT_TEXT = '#6b7280'

export function ShipmentTracker({ shipmentId, trackingNumber }: ShipmentTrackerProps) {
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Simulated data fetch - replace with actual API call
  useEffect(() => {
    const fetchShipmentData = async () => {
      try {
        setLoading(true)
        // Mock data - replace with actual API call
        const mockData: ShipmentData = {
          shipmentId,
          trackingNumber,
          carrier: 'FedEx',
          deliveryMethod: 'Express',
          status: 'In Transit',
          estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
          timeSlot: '2:00 PM - 4:00 PM',
          isLive: true,
          weight: 2.5,
          weightUnit: 'lbs',
          dimensions: {
            length: 12,
            width: 8,
            height: 6,
            unit: 'inches',
          },
          deliveryInstructions: 'Leave at door if no one is home',
          externalTrackingUrl: 'https://www.fedex.com/fedextrack/?tracknumbers=' + trackingNumber,
          events: [
            {
              status: 'Package picked up',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              location: 'Memphis, TN',
            },
            {
              status: 'In transit',
              timestamp: new Date(Date.now() - 43200000).toISOString(),
              location: 'Chicago, IL',
            },
            {
              status: 'Out for delivery',
              timestamp: new Date().toISOString(),
              location: 'Local facility',
            },
          ],
        }
        setShipmentData(mockData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shipment data')
      } finally {
        setLoading(false)
      }
    }

    fetchShipmentData()
  }, [shipmentId, trackingNumber])

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(trackingNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: isMobile ? '16px' : '24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTop: `3px solid ${BRAND_BLUE}`,
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ color: '#6b7280', margin: '0', fontSize: '14px' }}>
            Loading shipment details...
          </p>
          <style>
            {`@keyframes spin {
              to { transform: rotate(360deg); }
            }`}
          </style>
        </div>
      </div>
    )
  }

  if (error || !shipmentData) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          color: '#dc2626',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0', fontSize: '14px' }}>
          {error || 'Unable to load shipment data'}
        </p>
      </div>
    )
  }

  const getCarrierColor = (carrier: string): string => {
    const colors: Record<string, string> = {
      FedEx: '#4D148C',
      UPS: '#FFB81C',
      USPS: '#00297B',
      DHL: '#FFCC00',
      Local: BRAND_GREEN,
    }
    return colors[carrier] || BRAND_BLUE
  }

  const getStatusIcon = (status: string): string => {
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes('picked')) return '📦'
    if (lowerStatus.includes('transit')) return '🚚'
    if (lowerStatus.includes('delivery')) return '🏠'
    if (lowerStatus.includes('delivered')) return '✓'
    return '📍'
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: isMobile ? '20px' : '28px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '18px' : '24px',
      }}
    >
      <style>
        {`
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .shipment-header {
            animation: fadeInDown 0.5s ease-out;
          }
        `}
      </style>

      {/* Carrier Info */}
      <div
        className="shipment-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '800',
              color: DARK_TEXT,
              margin: '0 0 12px 0',
              letterSpacing: '-0.5px',
            }}
          >
            {shipmentData.carrier}
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <code
              style={{
                backgroundColor: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: DARK_TEXT,
                fontWeight: '600',
                flex: isMobile ? '1 1 auto' : '0 0 auto',
              }}
            >
              {trackingNumber}
            </code>
            <button
              onClick={handleCopyTracking}
              style={{
                backgroundColor: 'transparent',
                border: `2px solid ${BRAND_BLUE}`,
                color: BRAND_BLUE,
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  BRAND_BLUE
                ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = BRAND_BLUE
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Delivery Method Badge */}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: getCarrierColor(shipmentData.carrier),
            color: 'white',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {shipmentData.deliveryMethod}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Current Status with Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          style={{
            fontSize: '56px',
            animation: shipmentData.isLive
              ? 'pulse 2s ease-in-out infinite'
              : 'none',
          }}
        >
          {getStatusIcon(shipmentData.status)}
        </div>
        <div>
          <p
            style={{
              fontSize: '12px',
              color: LIGHT_TEXT,
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '700',
            }}
          >
            Current Status
          </p>
          <h3
            style={{
              fontSize: isMobile ? '18px' : '22px',
              fontWeight: '800',
              color: DARK_TEXT,
              margin: '0',
              letterSpacing: '-0.5px',
            }}
          >
            {shipmentData.status}
          </h3>
          {shipmentData.isLive && (
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: BRAND_GREEN,
                fontWeight: '600',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: BRAND_GREEN,
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              Live tracking active
            </div>
          )}
        </div>
      </div>

      <style>
        {`@keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }`}
      </style>

      {/* Estimated Delivery */}
      <ETADisplay
        estimatedDelivery={shipmentData.estimatedDelivery}
        timeSlot={shipmentData.timeSlot}
        isLive={shipmentData.isLive}
      />

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Multi-Carrier Status & Events */}
      <MultiCarrierStatus
        carrier={shipmentData.carrier}
        trackingNumber={trackingNumber}
        externalTrackingUrl={shipmentData.externalTrackingUrl}
        status={shipmentData.status}
        events={shipmentData.events}
      />

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Map Section */}
      <div
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          border: '2px dashed #d1d5db',
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '48px' }}>🗺️</div>
        <h4
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: DARK_TEXT,
            margin: '0 0 4px 0',
          }}
        >
          Live Tracking Map
        </h4>
        <p
          style={{
            fontSize: '13px',
            color: LIGHT_TEXT,
            margin: '0',
          }}
        >
          Real-time delivery route visualization
        </p>
      </div>

      {/* Package Details */}
      <div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: DARK_TEXT,
            margin: '0 0 14px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Package Details
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '14px',
          }}
        >
          {shipmentData.weight && (
            <div
              style={{
                backgroundColor: '#f9fafb',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  color: LIGHT_TEXT,
                  margin: '0 0 6px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '700',
                }}
              >
                Weight
              </p>
              <p
                style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: DARK_TEXT,
                  margin: '0',
                }}
              >
                {shipmentData.weight} {shipmentData.weightUnit}
              </p>
            </div>
          )}

          {shipmentData.dimensions && (
            <div
              style={{
                backgroundColor: '#f9fafb',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  color: LIGHT_TEXT,
                  margin: '0 0 6px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '700',
                }}
              >
                Dimensions
              </p>
              <p
                style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: DARK_TEXT,
                  margin: '0',
                }}
              >
                {shipmentData.dimensions.length}×{shipmentData.dimensions.width}×
                {shipmentData.dimensions.height} {shipmentData.dimensions.unit}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Instructions */}
      {shipmentData.deliveryInstructions && (
        <>
          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: DARK_TEXT,
                margin: '0 0 12px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Delivery Instructions
            </h3>
            <div
              style={{
                backgroundColor: '#fffbeb',
                padding: '14px',
                borderRadius: '10px',
                borderLeft: `4px solid #fbbf24`,
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  color: '#92400e',
                  margin: '0',
                  lineHeight: '1.6',
                }}
              >
                {shipmentData.deliveryInstructions}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
