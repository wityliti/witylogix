import React, { useState } from 'react';
import TrackingSearch from './TrackingSearch';
import DeliveryTimeline from './DeliveryTimeline';
import DeliveryMap from './DeliveryMap';
import DeliveryPreferences from './DeliveryPreferences';
import RatingFeedback from './RatingFeedback';
import LiveChat from './LiveChat';

interface TimelineEvent {
  id: string;
  status: 'Order Placed' | 'Picked Up' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Failed' | 'Exception';
  timestamp: string;
  location?: string;
  description?: string;
}

interface TrackingData {
  trackingNumber: string;
  orderNumber: string;
  status: string;
  estimatedDelivery: string;
  deliveryAddress: string;
  events: TimelineEvent[];
  driverName?: string;
  eta?: string;
  isDelivered: boolean;
  storeName?: string;
  storeIcon?: string;
}

const App: React.FC = () => {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Mock data for demonstration
  const mockTrackingData: Record<string, TrackingData> = {
    'WTX123456789': {
      trackingNumber: 'WTX123456789',
      orderNumber: 'ORD-2024-001',
      status: 'Out for Delivery',
      estimatedDelivery: 'Today by 5:00 PM',
      deliveryAddress: '123 Main St, New York, NY 10001',
      driverName: 'John Martinez',
      eta: '2:30 PM',
      isDelivered: false,
      storeName: 'Witylogix Shop',
      storeIcon: '🛍️',
      events: [
        {
          id: '1',
          status: 'Order Placed',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Online',
          description: 'Your order has been confirmed',
        },
        {
          id: '2',
          status: 'Picked Up',
          timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Distribution Center, NJ',
          description: 'Package picked up from warehouse',
        },
        {
          id: '3',
          status: 'In Transit',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          location: 'New Jersey',
          description: 'Package in transit to local facility',
        },
        {
          id: '4',
          status: 'Out for Delivery',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          location: 'Local Delivery Hub, NYC',
          description: 'Out for delivery with driver',
        },
      ],
    },
    'ORD-2024-001': {
      trackingNumber: 'WTX987654321',
      orderNumber: 'ORD-2024-001',
      status: 'Delivered',
      estimatedDelivery: 'Delivered on Mar 5, 2026',
      deliveryAddress: '456 Oak Ave, Los Angeles, CA 90001',
      driverName: 'Sarah Johnson',
      eta: 'Completed',
      isDelivered: true,
      storeName: 'Witylogix Shop',
      storeIcon: '🛍️',
      events: [
        {
          id: '1',
          status: 'Order Placed',
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Online',
        },
        {
          id: '2',
          status: 'Picked Up',
          timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Distribution Center, CA',
        },
        {
          id: '3',
          status: 'In Transit',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'California',
        },
        {
          id: '4',
          status: 'Out for Delivery',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Local Delivery Hub, LA',
        },
        {
          id: '5',
          status: 'Delivered',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          location: '456 Oak Ave, Los Angeles, CA 90001',
          description: 'Package delivered to front door',
        },
      ],
    },
  };

  const handleSearch = (searchInput: string) => {
    setIsLoading(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      const data = mockTrackingData[searchInput];
      if (data) {
        setTrackingData(data);
        setIsLoading(false);
      } else {
        setError('We could not find an order matching that number. Please check and try again.');
        setIsLoading(false);
      }
    }, 800);
  };

  const handleReset = () => {
    setTrackingData(null);
    setError('');
  };

  // Show search page if no tracking data
  if (!trackingData) {
    return (
      <TrackingSearch
        onSearch={handleSearch}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Show full tracking view
  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button
            onClick={handleReset}
            style={styles.backButton}
            title="Search again"
          >
            ← New Search
          </button>
          <div style={styles.brandSection}>
            <span style={styles.storeIcon}>{trackingData.storeIcon}</span>
            <div>
              <h1 style={styles.storeName}>{trackingData.storeName}</h1>
              <p style={styles.trackingNumber}>#{trackingData.trackingNumber}</p>
            </div>
          </div>
          <div style={styles.statusBadge}>
            <span style={styles.statusIndicator} />
            {trackingData.status}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <div style={styles.contentWrapper}>
          {/* Timeline Section */}
          <section style={styles.section}>
            <DeliveryTimeline
              events={trackingData.events}
              estimatedDelivery={trackingData.estimatedDelivery}
              currentStatus={trackingData.status}
            />
          </section>

          {/* Map Section - Only show if not delivered */}
          {!trackingData.isDelivered && (
            <section style={styles.section}>
              <DeliveryMap
                
                deliveryAddress={trackingData.deliveryAddress}
                eta={trackingData.eta}
              />
            </section>
          )}

          {/* Preferences Section - Only show if not delivered */}
          {!trackingData.isDelivered && (
            <section style={styles.section}>
              <DeliveryPreferences />
            </section>
          )}

          {/* Rating Section - Only show if delivered */}
          {trackingData.isDelivered && (
            <section style={styles.section}>
              <RatingFeedback
                driverName={trackingData.driverName}
                isDelivered={true}
              />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>Need help? Contact support or use the chat below</p>
      </footer>

      {/* Floating Chat Widget */}
      <LiveChat onClose={handleReset} />
    </div>
  );
};

const styles = {
  appContainer: {
    minHeight: '100vh',
    background: '#f5f7fa',
  } as React.CSSProperties,
  header: {
    background: 'white',
    borderBottom: '1px solid #e5e7eb',
    padding: '20px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  } as React.CSSProperties,
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
  } as React.CSSProperties,
  backButton: {
    background: 'none',
    border: 'none',
    color: '#005bd3',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    padding: '0',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  brandSection: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  storeIcon: {
    fontSize: '32px',
  } as React.CSSProperties,
  storeName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0',
  } as React.CSSProperties,
  trackingNumber: {
    fontSize: '12px',
    color: '#999',
    margin: '0',
  } as React.CSSProperties,
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#eff6ff',
    color: '#005bd3',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
  } as React.CSSProperties,
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#005bd3',
  } as React.CSSProperties,
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px',
  } as React.CSSProperties,
  contentWrapper: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '32px',
  } as React.CSSProperties,
  section: {
    animation: 'fadeIn 0.3s ease-in',
  } as React.CSSProperties,
  footer: {
    background: 'white',
    borderTop: '1px solid #e5e7eb',
    padding: '20px 24px',
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
    marginBottom: '80px',
  } as React.CSSProperties,
};

export default App;
