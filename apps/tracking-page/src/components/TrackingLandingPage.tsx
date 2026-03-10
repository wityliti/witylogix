import { useState, useEffect } from 'react'

const BRAND_BLUE = '#3b82f6'
const BG_COLOR = '#f8fafc'
const DARK_TEXT = '#1f2937'
const LIGHT_TEXT = '#6b7280'

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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load recent trackings from sessionStorage
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
    setIsLoading(true)
    // Simulate delay before navigation
    setTimeout(() => {
      setIsLoading(false)
      onNavigate(`/track/${cleaned}`)
    }, 300)
  }

  const handleRecentClick = (trackingNumber: string) => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onNavigate(`/track/${trackingNumber}`)
    }, 300)
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
      <style>
        {`
          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
          .landing-header {
            animation: fadeInDown 0.6s ease-out;
          }
          .landing-card {
            animation: fadeInUp 0.6s ease-out 0.1s both;
          }
          .search-button:hover {
            transform: translateY(-2px);
          }
          .search-button {
            transition: all 0.3s ease;
          }
        `}
      </style>

      {/* Header */}
      <div
        className="landing-header"
        style={{
          textAlign: 'center',
          marginBottom: isMobile ? '40px' : '56px',
          maxWidth: '600px',
        }}
      >
        {/* Logo placeholder */}
        <div
          style={{
            fontSize: isMobile ? '56px' : '64px',
            marginBottom: '24px',
            color: BRAND_BLUE,
          }}
        >
          📦
        </div>

        <h1
          style={{
            fontSize: isMobile ? '32px' : '40px',
            fontWeight: '800',
            color: DARK_TEXT,
            margin: '0 0 16px 0',
            lineHeight: '1.2',
            letterSpacing: '-0.5px',
          }}
        >
          Track Your Delivery
        </h1>

        <p
          style={{
            fontSize: isMobile ? '16px' : '18px',
            color: LIGHT_TEXT,
            margin: '0',
            lineHeight: '1.6',
            fontWeight: '500',
          }}
        >
          Real-time tracking of your shipments with Witylogix
        </p>
      </div>

      {/* Main Card */}
      <div
        className="landing-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: isMobile ? '28px' : '40px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ marginBottom: '36px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '700',
              color: DARK_TEXT,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Tracking Number
          </label>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: error ? '10px' : '0',
            }}
          >
            <input
              type="text"
              placeholder="e.g., TRK123456789"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value.toUpperCase())
                setError('')
              }}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '14px 16px',
                fontSize: '16px',
                border: error ? `2px solid #ef4444` : `2px solid #e5e7eb`,
                borderRadius: '12px',
                fontFamily: 'monospace',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box',
                backgroundColor: error ? '#fef2f2' : '#f9fafb',
                color: DARK_TEXT,
              }}
              onFocus={(e) => {
                if (!error) {
                  (e.currentTarget as HTMLInputElement).style.borderColor =
                    BRAND_BLUE
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  (e.currentTarget as HTMLInputElement).style.borderColor =
                    '#e5e7eb'
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="search-button"
              style={{
                backgroundColor: isLoading ? '#9ca3af' : BRAND_BLUE,
                color: 'white',
                padding: '14px 28px',
                border: 'none',
                borderRadius: '12px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? '⏳' : 'Search'}
            </button>
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#ef4444', margin: '10px 0 0 0', fontWeight: '500' }}>
              {error}
            </p>
          )}
        </form>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '28px 0',
          }}
        />

        {/* QR Code Placeholder */}
        <div
          style={{
            textAlign: 'center',
            padding: '28px',
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            marginBottom: '28px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            border: '2px dashed #d1d5db',
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = BRAND_BLUE
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#eff6ff'
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'
            ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#f3f4f6'
          }}
        >
          <div
            style={{
              fontSize: '40px',
              marginBottom: '12px',
            }}
          >
            📷
          </div>
          <p
            style={{
              fontSize: '14px',
              color: DARK_TEXT,
              margin: '0',
              fontWeight: '600',
            }}
          >
            Scan QR Code
          </p>
          <p
            style={{
              fontSize: '12px',
              color: LIGHT_TEXT,
              margin: '4px 0 0 0',
            }}
          >
            Or use your phone camera
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            backgroundColor: '#e5e7eb',
            margin: '28px 0',
          }}
        />

        {/* Recent Trackings */}
        {recentTrackings.length > 0 && (
          <div style={{ marginBottom: '0' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: DARK_TEXT,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 14px 0',
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
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#f9fafb',
                    border: `1px solid #e5e7eb`,
                    padding: '13px 14px',
                    borderRadius: '10px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (!isLoading) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        '#f3f4f6'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        BRAND_BLUE
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isLoading) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        '#f9fafb'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        '#e5e7eb'
                    }
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
                          color: DARK_TEXT,
                          margin: '0',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.trackingNumber}
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: LIGHT_TEXT,
                          margin: '4px 0 0 0',
                        }}
                      >
                        {new Date(item.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <span style={{ fontSize: '16px', color: BRAND_BLUE, fontWeight: 'bold' }}>
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
          marginTop: isMobile ? '40px' : '56px',
          textAlign: 'center',
          color: LIGHT_TEXT,
          fontSize: '13px',
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
              fontWeight: '700',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.textDecoration =
                'underline'
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.textDecoration =
                'none'
            }}
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  )
}
