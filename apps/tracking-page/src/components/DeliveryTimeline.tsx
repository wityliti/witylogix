import React, { useState, useEffect } from 'react';

interface TimelineEvent {
  id: string;
  status: 'Order Placed' | 'Picked Up' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Failed' | 'Exception';
  timestamp: string;
  location?: string;
  description?: string;
  isCurrent?: boolean;
}

interface DeliveryTimelineProps {
  events: TimelineEvent[];
  estimatedDelivery?: string;
  currentStatus?: string;
}

const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({
  events,
  estimatedDelivery = 'Today by 5:00 PM',
  currentStatus = 'In Transit'
}) => {
  const [displayEvents, setDisplayEvents] = useState<TimelineEvent[]>(events);

  useEffect(() => {
    // Mark current status event
    const updated = events.map((event, idx) => ({
      ...event,
      isCurrent: idx === events.length - 1
    }));
    setDisplayEvents(updated);
  }, [events]);

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'Order Placed':
        return '📋';
      case 'Picked Up':
        return '📦';
      case 'In Transit':
        return '🚚';
      case 'Out for Delivery':
        return '📍';
      case 'Delivered':
        return '✅';
      case 'Failed':
      case 'Exception':
        return '❌';
      default:
        return '•';
    }
  };

  const isErrorStatus = (status: string): boolean => {
    return status === 'Failed' || status === 'Exception';
  };

  const getStatusColor = (status: string, isCurrent: boolean): string => {
    if (isErrorStatus(status)) return '#dc2626';
    if (isCurrent) return '#005bd3';
    return '#10b981';
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div style={styles.container}>
      {/* Estimated Delivery Card */}
      <div style={styles.estimatedCard}>
        <div style={styles.estimatedContent}>
          <p style={styles.estimatedLabel}>Estimated Delivery</p>
          <p style={styles.estimatedValue}>{estimatedDelivery}</p>
          <p style={styles.estimatedStatus}>Status: {currentStatus}</p>
        </div>
      </div>

      {/* Timeline */}
      <div style={styles.timelineWrapper}>
        {displayEvents.map((event, index) => {
          const isCurrent = event.isCurrent || index === displayEvents.length - 1;
          const isError = isErrorStatus(event.status);
          const statusColor = getStatusColor(event.status, isCurrent);
          const isLast = index === displayEvents.length - 1;

          return (
            <div key={event.id} style={styles.timelineItem}>
              {/* Timeline Dot and Line */}
              <div style={styles.dotContainer}>
                <div
                  style={{
                    ...styles.dot,
                    background: statusColor,
                    ...(isCurrent ? styles.dotPulsing : {}),
                    boxShadow: isCurrent ? `0 0 0 8px ${statusColor}22` : 'none',
                  }}
                >
                  <span style={styles.dotIcon}>{getStatusIcon(event.status)}</span>
                </div>
                {!isLast && (
                  <div
                    style={{
                      ...styles.line,
                      background: isError ? '#dc2626' : index < displayEvents.length - 1 ? '#10b981' : '#005bd3',
                    }}
                  />
                )}
              </div>

              {/* Event Content */}
              <div style={styles.eventContent}>
                <div style={styles.eventHeader}>
                  <h3 style={{
                    ...styles.eventStatus,
                    color: statusColor,
                  }}>
                    {event.status}
                  </h3>
                  <span style={styles.eventTime}>{formatTime(event.timestamp)}</span>
                </div>

                <p style={styles.eventDate}>{formatDate(event.timestamp)}</p>

                {event.location && (
                  <p style={styles.eventLocation}>
                    <span style={styles.locationIcon}>📍</span>
                    {event.location}
                  </p>
                )}

                {event.description && (
                  <p style={styles.eventDescription}>{event.description}</p>
                )}

                {isCurrent && !isError && (
                  <div style={styles.currentBadge}>
                    <span style={styles.currentDot}>●</span>
                    Live tracking active
                  </div>
                )}

                {isError && (
                  <div style={styles.errorBadge}>
                    <span style={styles.errorDot}>⚠️</span>
                    Action required
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Instructions */}
      {events.length > 0 && (
        <div style={styles.infoCard}>
          <h4 style={styles.infoTitle}>What happens next?</h4>
          {currentStatus === 'Delivered' ? (
            <p style={styles.infoText}>Your package has been delivered. Check for it at your delivery location.</p>
          ) : currentStatus === 'Out for Delivery' ? (
            <p style={styles.infoText}>Your driver is on the way! You'll receive a notification when they're nearby.</p>
          ) : (
            <p style={styles.infoText}>Track your delivery in real-time. We'll notify you of every update.</p>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
  } as React.CSSProperties,
  estimatedCard: {
    background: 'linear-gradient(135deg, #005bd3 0%, #003d99 100%)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '32px',
    color: 'white',
  } as React.CSSProperties,
  estimatedContent: {
    textAlign: 'center',
  } as React.CSSProperties,
  estimatedLabel: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    margin: '0 0 8px 0',
    opacity: 0.9,
  } as React.CSSProperties,
  estimatedValue: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  } as React.CSSProperties,
  estimatedStatus: {
    fontSize: '14px',
    margin: '0',
    opacity: 0.9,
  } as React.CSSProperties,
  timelineWrapper: {
    position: 'relative',
  } as React.CSSProperties,
  timelineItem: {
    display: 'flex',
    marginBottom: '32px',
  } as React.CSSProperties,
  dotContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: '24px',
    minWidth: '56px',
  } as React.CSSProperties,
  dot: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    color: 'white',
    fontWeight: 'bold',
    position: 'relative',
    zIndex: 2,
    transition: 'all 0.3s ease',
  } as React.CSSProperties,
  dotPulsing: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  } as React.CSSProperties,
  dotIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  line: {
    width: '4px',
    height: '60px',
    margin: '8px 0',
    borderRadius: '2px',
  } as React.CSSProperties,
  eventContent: {
    flex: 1,
    paddingTop: '2px',
  } as React.CSSProperties,
  eventHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  } as React.CSSProperties,
  eventStatus: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0',
  } as React.CSSProperties,
  eventTime: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '500',
  } as React.CSSProperties,
  eventDate: {
    fontSize: '12px',
    color: '#999',
    margin: '2px 0 8px 0',
  } as React.CSSProperties,
  eventLocation: {
    fontSize: '14px',
    color: '#333',
    margin: '6px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  locationIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  eventDescription: {
    fontSize: '13px',
    color: '#666',
    margin: '6px 0 0 0',
    fontStyle: 'italic',
  } as React.CSSProperties,
  currentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#dcfce7',
    color: '#166534',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    marginTop: '8px',
  } as React.CSSProperties,
  currentDot: {
    fontSize: '8px',
    animation: 'pulse 2s infinite',
  } as React.CSSProperties,
  errorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    marginTop: '8px',
  } as React.CSSProperties,
  errorDot: {
    fontSize: '12px',
  } as React.CSSProperties,
  infoCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
  } as React.CSSProperties,
  infoTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  infoText: {
    fontSize: '13px',
    color: '#666',
    margin: '0',
  } as React.CSSProperties,
};

export default DeliveryTimeline;
