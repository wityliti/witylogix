import { useState, useEffect } from 'react';
import { fetchTrackingData } from './lib/api';
import { initializeSocket, joinTrackingRoom, onLocationUpdate, onStatusUpdate, onETAUpdate, disconnectSocket, } from './lib/socket';
import { TrackingMap } from './components/TrackingMap';
import { StatusTimeline } from './components/StatusTimeline';
import { DriverCard } from './components/DriverCard';
import { OrderSummary } from './components/OrderSummary';
const BRAND_BLUE = '#005bd3';
const BRAND_GREEN = '#008060';
const BG_COLOR = '#f6f6f7';
export default function App() {
    const [trackingData, setTrackingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    // Extract order ID from URL path
    const orderId = window.location.pathname.split('/').pop() || '';
    // Fetch initial data
    useEffect(() => {
        if (!orderId) {
            setError('Order ID not found in URL');
            setLoading(false);
            return;
        }
        fetchTrackingData(orderId)
            .then((data) => {
            setTrackingData(data);
            setError(null);
            // Initialize socket after getting initial data
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            initializeSocket(apiUrl);
            joinTrackingRoom(orderId);
        })
            .catch((err) => {
            setError(err.message || 'Failed to load tracking data');
            setLoading(false);
        });
    }, [orderId]);
    // Handle real-time updates
    useEffect(() => {
        if (!trackingData)
            return;
        const unsubscribeLocation = onLocationUpdate((update) => {
            setTrackingData((prev) => {
                if (!prev)
                    return prev;
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
                };
            });
        });
        const unsubscribeStatus = onStatusUpdate((update) => {
            setTrackingData((prev) => {
                if (!prev)
                    return prev;
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
                };
            });
        });
        const unsubscribeETA = onETAUpdate((update) => {
            setTrackingData((prev) => {
                if (!prev)
                    return prev;
                return {
                    ...prev,
                    order: {
                        ...prev.order,
                        eta: update.eta,
                    },
                };
            });
        });
        setLoading(false);
        return () => {
            unsubscribeLocation?.();
            unsubscribeStatus?.();
            unsubscribeETA?.();
        };
    }, [trackingData]);
    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectSocket();
        };
    }, []);
    if (loading && !trackingData) {
        return (<div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: BG_COLOR,
                fontSize: '16px',
                color: '#6b7280',
            }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #e5e7eb',
                borderTop: `4px solid ${BRAND_BLUE}`,
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
            }}/>
          <p>Loading tracking information...</p>
          <style>
            {`@keyframes spin {
              to { transform: rotate(360deg); }
            }`}
          </style>
        </div>
      </div>);
    }
    if (error) {
        return (<div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: BG_COLOR,
                padding: '20px',
            }}>
        <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '12px',
                textAlign: 'center',
                maxWidth: '400px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '8px',
            }}>
            Unable to Load Order
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            {error}
          </p>
        </div>
      </div>);
    }
    if (!trackingData) {
        return (<div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: BG_COLOR,
            }}>
        <p style={{ color: '#6b7280' }}>No tracking data available</p>
      </div>);
    }
    const { order, driver, currentLocation, route, statusHistory } = trackingData;
    return (<div style={{
            width: '100%',
            minHeight: '100vh',
            backgroundColor: BG_COLOR,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
        }}>
      {/* Map Section */}
      <div style={{
            flex: isMobile ? '0 0 auto' : '1',
            height: isMobile ? '60vh' : '100vh',
            width: isMobile ? '100%' : 'auto',
            position: 'relative',
            overflow: 'hidden',
        }}>
        <TrackingMap deliveryLocation={order.deliveryLocation} driverLocation={currentLocation} route={route} pickupLocation={order.pickupLocation}/>
      </div>

      {/* Info Section */}
      <div style={{
            flex: isMobile ? '1' : '0 0 40%',
            height: isMobile ? 'auto' : '100vh',
            width: isMobile ? '100%' : 'auto',
            backgroundColor: BG_COLOR,
            overflowY: 'auto',
            padding: isMobile ? '16px' : '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
        }}>
        {/* Header */}
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 8px 0',
        }}>
            Track Your Delivery
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '0',
        }}>
            Order {order.id.slice(0, 8)}...
          </p>
        </div>

        {/* Driver Card */}
        <DriverCard driver={driver} eta={order.eta}/>

        {/* Status Timeline */}
        <StatusTimeline currentStatus={order.status} statusHistory={statusHistory}/>

        {/* Order Summary */}
        <OrderSummary order={order}/>

        {/* Footer spacing */}
        <div style={{ height: '20px' }}/>
      </div>
    </div>);
}
//# sourceMappingURL=App.js.map