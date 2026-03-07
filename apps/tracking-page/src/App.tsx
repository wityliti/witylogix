import { useState, useEffect } from 'react'
import type { TrackingData, LocationUpdate, StatusUpdate, ETAUpdate } from './types'
import { fetchTrackingData } from './lib/api'
import {
  initializeSocket,
  joinTrackingRoom,
  onLocationUpdate,
  onStatusUpdate,
  onETAUpdate,
  disconnectSocket,
} from './lib/socket'
import { TrackingLandingPage } from './components/TrackingLandingPage'
import { TrackingResultPage } from './components/TrackingResultPage'
import { DeliveryPreferencesPage } from './components/DeliveryPreferencesPage'

const BRAND_BLUE = '#005bd3'
const BG_COLOR = '#f6f6f7'

interface RouteState {
  view: 'landing' | 'tracking' | 'preferences'
  trackingNumber?: string
  shipmentId?: string
}

function parseHash(): RouteState {
  const hash = window.location.hash.slice(1) || '/'

  // #/track/:trackingNumber
  if (hash.startsWith('/track/')) {
    const trackingNumber = hash.replace('/track/', '')
    return { view: 'tracking', trackingNumber }
  }

  // #/preferences/:shipmentId
  if (hash.startsWith('/preferences/')) {
    const shipmentId = hash.replace('/preferences/', '')
    return { view: 'preferences', shipmentId }
  }

  // #/ or empty - landing page
  return { view: 'landing' }
}

function navigateTo(path: string) {
  window.location.hash = path
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(parseHash())
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash())
      setError(null)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Fetch tracking data when navigating to tracking view
  useEffect(() => {
    if (route.view === 'tracking' && route.trackingNumber) {
      setLoading(true)
      setError(null)

      fetchTrackingData(route.trackingNumber)
        .then((data) => {
          setTrackingData(data)

          // Initialize socket after getting initial data
          const apiUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000'
          initializeSocket(apiUrl)
          joinTrackingRoom(data.order.id)
        })
        .catch((err) => {
          setError(err.message || 'Failed to load tracking data')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [route.view, route.trackingNumber])

  // Handle real-time updates
  useEffect(() => {
    if (!trackingData) return

    const unsubscribeLocation = onLocationUpdate((update: LocationUpdate) => {
      setTrackingData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          currentLocation: {
            latitude: update.latitude,
            longitude: update.longitude,
            timestamp: update.timestamp,
          },
          route: [
            ...prev.route,
            {
              latitude: update.latitude,
              longitude: update.longitude,
              timestamp: update.timestamp,
            },
          ],
        }
      })
    })

    const unsubscribeStatus = onStatusUpdate((update: StatusUpdate) => {
      setTrackingData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          order: {
            ...prev.order,
            status: update.status,
          },
          statusHistory: [
            ...prev.statusHistory,
            {
              status: update.status,
              timestamp: update.timestamp,
            },
          ],
        }
      })
    })

    const unsubscribeETA = onETAUpdate((update: ETAUpdate) => {
      setTrackingData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          order: {
            ...prev.order,
            eta: update.eta,
          },
        }
      })
    })

    return () => {
      unsubscribeLocation?.()
      unsubscribeStatus?.()
      unsubscribeETA?.()
    }
  }, [trackingData])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSocket()
    }
  }, [])

  // Landing page
  if (route.view === 'landing') {
    return <TrackingLandingPage onNavigate={navigateTo} />
  }

  // Preferences page
  if (route.view === 'preferences') {
    return (
      <DeliveryPreferencesPage
        shipmentId={route.shipmentId || ''}
        onBack={() => navigateTo('/')}
      />
    )
  }

  // Tracking page
  if (route.view === 'tracking') {
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: BG_COLOR,
            fontSize: '16px',
            color: '#6b7280',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e5e7eb',
                borderTop: `4px solid ${BRAND_BLUE}`,
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p>Loading tracking information...</p>
            <style>
              {`@keyframes spin {
                to { transform: rotate(360deg); }
              }`}
            </style>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: BG_COLOR,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '12px',
              textAlign: 'center',
              maxWidth: '400px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '8px',
              }}
            >
              Unable to Load Tracking
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
              {error}
            </p>
            <button
              onClick={() => navigateTo('/')}
              style={{
                marginTop: '24px',
                backgroundColor: BRAND_BLUE,
                color: 'white',
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )
    }

    if (!trackingData) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: BG_COLOR,
          }}
        >
          <p style={{ color: '#6b7280' }}>No tracking data available</p>
        </div>
      )
    }

    return (
      <TrackingResultPage
        trackingData={trackingData}
        isMobile={isMobile}
        onPreferences={() => navigateTo(`/preferences/${trackingData.order.id}`)}
        onHome={() => navigateTo('/')}
      />
    )
  }

  return null
}
