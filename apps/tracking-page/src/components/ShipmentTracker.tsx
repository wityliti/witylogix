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

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'

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
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '16px' : '20px',
      }}
    >
      {/* Carrier Info */}
      <div
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
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0',
            }}
          >
            {shipmentData.carrier}
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <code
              style={{
                backgroundColor: BG_COLOR,
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#374151',
                flex: isMobile ? '1 1 auto' : '0 0 auto',
              }}
            >
              {trackingNumber}
            </code>
            <button
              onClick={handleCopyTracking}
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${BRAND_BLUE}`,
                color: BRAND_BLUE,
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
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
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          {shipmentData.deliveryMethod}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

      {/* Current Status with Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            fontSize: '48px',
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
              color: '#6b7280',
              margin: '0 0 4px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Current Status
          </p>
          <h3
            style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0',
            }}
          >
            {shipmentData.status}
          </h3>
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

      {/* Package Details */}
      <div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 12px 0',
          }}
        >
          Package Details
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '12px',
          }}
        >
          {shipmentData.weight && (
            <div
              style={{
                backgroundColor: BG_COLOR,
                padding: '12px',
                borderRadius: '8px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Weight
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
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
                backgroundColor: BG_COLOR,
                padding: '12px',
                borderRadius: '8px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Dimensions
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: '0',
                }}
              >
                {shipmentData.dimensions.length} × {shipmentData.dimensions.width} ×{' '}
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
                fontWeight: '600',
                color: '#1f2937',
                margin: '0 0 8px 0',
              }}
            >
              Delivery Instructions
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: '#374151',
                margin: '0',
                lineHeight: '1.5',
                backgroundColor: BG_COLOR,
                padding: '12px',
                borderRadius: '8px',
              }}
            >
              {shipmentData.deliveryInstructions}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
