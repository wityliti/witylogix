import { useState, useEffect } from 'react'

const BRAND_BLUE = '#005bd3'
const BG_COLOR = '#f6f6f7'

interface TrackingLandingPageProps {
  onNavigate: (path: string) => void
}

interface RecentTracking {
  trackingNumber: string
  timestamp: number
  shipmentId: string
}

export function TrackingLandingPage({ onNavigate }: TrackingLandingPageProps) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [recentTrackings, setRecentTrackings] = useState<RecentTracking[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load recent trackings from memory (in-memory simulation)
  useEffect(() => {
    const stored = sessionStorage.getItem('witylogix_recent_trackings')
    if (stored) {
      try {
        setRecentTrackings(JSON.parse(stored))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = trackingNumber.trim().toUpperCase()

    if (!cleaned) {
      setError('Please enter a tracking number')
      return
    }

    // Save to recent trackings
    const newRecent: RecentTracking = {
      trackingNumber: cleaned,
      timestamp: Date.now(),
      shipmentId: `shipment_${Date.now()}`,
    }

    const updated = [
      newRecent,
      ...recentTrackings.filter((r) => r.trackingNumber !== cleaned),
    ].slice(0, 5)

    sessionStorage.setItem('witylogix_recent_trackings', JSON.stringify(updated))
    setRecentTrackings(updated)

    setError('')
    onNavigate(`/track/${cleaned}`)
  }

  const handleRecentClick = (trackingNumber: string) => {
    onNavigate(`/track/${trackingNumber}`)
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: BG_COLOR,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '20px' : '40px',
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: isMobile ? '32px' : '48px',
          maxWidth: '600px',
        }}
      >
        {/* Logo placeholder */}
        <div
          style={{
            fontSize: '48px',
            marginBottom: '24px',
            color: BRAND_BLUE,
          }}
        >
          📦
        </div>

        <h1
          style={{
            fontSize: isMobile ? '28px' : '36px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 12px 0',
            lineHeight: '1.2',
          }}
        >
          Track Your Delivery
        </h1>

        <p
          style={{
            fontSize: isMobile ? '14px' : '16px',
            color: '#6b7280',
            margin: '0',
            lineHeight: '1.5',
          }}
        >
          Real-time tracking of your shipments with Witylogix
        </p>
      </div>

      {/* Main Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: isMobile ? '24px' : '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ marginBottom: '32px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Enter Tracking Number
          </label>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: error ? '8px' : '0',
            }}
          >
            <input
              type="text"
              placeholder="e.g., TRK123456789"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value)
                setError('')
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '14px',
                border: error ? `2px solid #dc2626` : `1px solid #e5e7eb`,
                borderRadius: '8px',
                fontFamily: 'monospace',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: BRAND_BLUE,
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background-color 0.2s ease',
                whiteSpace: 'nowrap',
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
              Search
            </button>
          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#dc2626', margin: '8px 0 0 0' }}>
              {error}
            </p>
          )}
        </form>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '24px 0',
          }}
        />

        {/* QR Code Placeholder */}
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            backgroundColor: BG_COLOR,
            borderRadius: '8px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '32px',
              marginBottom: '8px',
            }}
          >
            📷
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: '0',
              fontWeight: '500',
            }}
          >
            Or scan your tracking QR code
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '24px 0',
          }}
        />

        {/* Recent Trackings */}
        {recentTrackings.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#1f2937',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 12px 0',
              }}
            >
              Recent Trackings
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {recentTrackings.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentClick(item.trackingNumber)}
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid #e5e7eb`,
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      BG_COLOR
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      BRAND_BLUE
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      '#e5e7eb'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#1f2937',
                          margin: '0',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.trackingNumber}
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#9ca3af',
                          margin: '4px 0 0 0',
                        }}
                      >
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{ fontSize: '16px', color: BRAND_BLUE }}>
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          marginTop: isMobile ? '32px' : '48px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '12px',
          maxWidth: '500px',
        }}
      >
        <p style={{ margin: '0' }}>
          Need help?{' '}
          <a
            href="mailto:support@witylogix.com"
            style={{
              color: BRAND_BLUE,
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  )
}
