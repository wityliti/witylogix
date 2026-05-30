/**
 * components/App.tsx — Alternative entry point used by embedded/cart widget context.
 * Uses real API data via fetchTrackingData. No mock data.
 */
import React, { useState } from 'react';
import TrackingSearch from './TrackingSearch';
import DeliveryTimeline from './DeliveryTimeline';
import DeliveryMap from './DeliveryMap';
import RatingFeedback from './RatingFeedback';
import LiveChat from './LiveChat';
import { fetchTrackingData } from '../lib/api';
import type { TrackingResponse } from '../types';

const App: React.FC = () => {
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = (searchInput: string) => {
    const token = searchInput.trim();
    if (!token) {
      setError('Please enter a tracking number.');
      return;
    }

    setIsLoading(true);
    setError('');

    fetchTrackingData(token)
      .then((result) => {
        setTrackingData(result.response);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to find that tracking number.';
        setError(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
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

  const isDelivered = trackingData.status === 'DELIVERED';
  const isLive = ['OUT_FOR_DELIVERY', 'ARRIVED'].includes(trackingData.status);

  // Build timeline events from the timeline steps for DeliveryTimeline component
  const timelineEvents = trackingData.timeline
    .filter((step) => step.completed)
    .map((step, idx) => ({
      id: String(idx),
      status: step.label as Parameters<typeof DeliveryTimeline>[0]['events'][number]['status'],
      timestamp: new Date().toISOString(), // API timeline steps don't include timestamps
      description: step.current ? 'Current status' : undefined,
    }));

  const deliveryAddress = [
    trackingData.deliveryAddress.line1,
    trackingData.deliveryAddress.city,
    trackingData.deliveryAddress.province,
    trackingData.deliveryAddress.postalCode,
  ].filter(Boolean).join(', ');

  const estimatedDelivery = trackingData.actualDelivery ?? trackingData.estimatedArrival
    ? new Date(trackingData.actualDelivery ?? trackingData.estimatedArrival!).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Date pending';

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
            <div>
              <h1 style={styles.storeName}>{trackingData.shop.name}</h1>
              {trackingData.orderNumber && (
                <p style={styles.trackingNumber}>#{trackingData.orderNumber}</p>
              )}
            </div>
          </div>
          <div style={styles.statusBadge}>
            <span style={styles.statusIndicator} />
            {trackingData.status.replace(/_/g, ' ')}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <div style={styles.contentWrapper}>
          {/* Timeline Section */}
          <section style={styles.section}>
            <DeliveryTimeline
              events={timelineEvents as Parameters<typeof DeliveryTimeline>[0]['events']}
              estimatedDelivery={estimatedDelivery}
              currentStatus={trackingData.status.replace(/_/g, ' ')}
            />
          </section>

          {/* Map Section — only when driver is live */}
          {isLive && trackingData.driverLocation && (
            <section style={styles.section}>
              <DeliveryMap
                deliveryAddress={deliveryAddress}
                eta={trackingData.timeSlot?.name}
              />
            </section>
          )}

          {/* Rating Section — only when delivered */}
          {isDelivered && (
            <section style={styles.section}>
              <RatingFeedback
                driverName={trackingData.driver?.name}
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
