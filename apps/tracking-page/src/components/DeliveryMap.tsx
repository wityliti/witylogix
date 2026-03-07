import React, { useState } from 'react';

interface DeliveryMapProps {
  deliveryAddress?: string;
  eta?: string;
  onShareLocation?: (enabled: boolean) => void;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({
  deliveryAddress = '123 Main St, New York, NY 10001',
  eta = '2:30 PM',
  onShareLocation,
}) => {
  const [shareLocation, setShareLocation] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(13);

  const handleShareToggle = () => {
    const newState = !shareLocation;
    setShareLocation(newState);
    onShareLocation?.(newState);
  };

  // SVG map visualization with driver and delivery pins
  const renderMapSVG = () => {
    const driverX = 150;
    const driverY = 120;
    const deliveryX = 320;
    const deliveryY = 280;

    return (
      <svg
        viewBox="0 0 500 400"
        style={styles.svg}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Map background */}
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#f0f4f8', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e8eef5', stopOpacity: 1 }} />
          </linearGradient>

          {/* Pulse animation */}
          <style>{`
            @keyframes mapPulse {
              0%, 100% { r: 8px; opacity: 1; }
              50% { r: 12px; opacity: 0.6; }
            }
            .driver-pulse { animation: mapPulse 2s infinite; }
          `}</style>
        </defs>

        <rect width="500" height="400" fill="url(#mapGradient)" />

        {/* Road grid */}
        {[0, 100, 200, 300, 400].map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="400"
            stroke="#d1d5db"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        {[0, 100, 200, 300, 400].map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={y}
            x2="500"
            y2={y}
            stroke="#d1d5db"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}

        {/* Route path */}
        <path
          d={`M ${driverX} ${driverY} Q ${driverX + 100} ${driverY + 50} ${deliveryX} ${deliveryY}`}
          stroke="#005bd3"
          strokeWidth="3"
          fill="none"
          strokeDasharray="5,5"
          opacity="0.6"
        />

        {/* Distance markers along route */}
        <circle cx={driverX + 80} cy={driverY + 30} r="3" fill="#005bd3" opacity="0.5" />
        <circle cx={driverX + 160} cy={driverY + 70} r="3" fill="#005bd3" opacity="0.5" />

        {/* Driver location pin - with pulse effect */}
        <circle cx={driverX} cy={driverY} r="8" fill="#dc2626" opacity="0.3" />
        <circle
          cx={driverX}
          cy={driverY}
          r="8"
          fill="#dc2626"
          className="driver-pulse"
        />
        <circle cx={driverX} cy={driverY} r="5" fill="white" stroke="#dc2626" strokeWidth="2" />
        <text
          x={driverX}
          y={driverY - 18}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#dc2626"
        >
          Driver
        </text>

        {/* Delivery address pin */}
        <path
          d={`M ${deliveryX} ${deliveryY - 15} L ${deliveryX + 10} ${deliveryY + 10} L ${deliveryX - 10} ${deliveryY + 10} Z`}
          fill="#10b981"
        />
        <circle cx={deliveryX} cy={deliveryY - 5} r="4" fill="white" />
        <text
          x={deliveryX}
          y={deliveryY + 30}
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="#10b981"
        >
          Delivery
        </text>
      </svg>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.mapContainer}>
        {renderMapSVG()}

        {/* ETA Overlay Card */}
        <div style={styles.etaCard}>
          <div style={styles.etaContent}>
            <p style={styles.etaLabel}>Estimated Arrival</p>
            <p style={styles.etaTime}>{eta}</p>
            <p style={styles.etaSubtext}>~15 minutes away</p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={styles.zoomControls}>
          <button
            onClick={() => setZoomLevel(Math.min(zoomLevel + 1, 20))}
            style={styles.zoomButton}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(Math.max(zoomLevel - 1, 5))}
            style={styles.zoomButton}
            title="Zoom out"
          >
            −
          </button>
        </div>

        {/* Share Location Toggle */}
        <div style={styles.shareControl}>
          <button
            onClick={handleShareToggle}
            style={{
              ...styles.shareButton,
              ...(shareLocation ? styles.shareButtonActive : {}),
            }}
          >
            <span style={styles.shareIcon}>📍</span>
            {shareLocation ? 'Location Shared' : 'Share Location'}
          </button>
        </div>
      </div>

      {/* Address Info */}
      <div style={styles.addressContainer}>
        <div style={styles.addressSection}>
          <h3 style={styles.addressTitle}>Delivery Address</h3>
          <p style={styles.address}>{deliveryAddress}</p>
          <p style={styles.addressNote}>
            Driver will follow your delivery preferences
          </p>
        </div>

        {/* Driver Instructions */}
        <div style={styles.instructionsSection}>
          <h3 style={styles.instructionsTitle}>What to expect?</h3>
          <ul style={styles.instructionsList}>
            <li>Driver will arrive within the estimated time window</li>
            <li>You'll receive a notification when driver is nearby</li>
            <li>Be ready to receive your package</li>
            <li>Driver will follow your delivery instructions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '24px',
  } as React.CSSProperties,
  mapContainer: {
    position: 'relative',
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    height: '350px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  svg: {
    width: '100%',
    height: '100%',
  } as React.CSSProperties,
  etaCard: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
    padding: '16px',
    minWidth: '160px',
    zIndex: 10,
  } as React.CSSProperties,
  etaContent: {
    textAlign: 'center',
  } as React.CSSProperties,
  etaLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    margin: '0 0 6px 0',
  } as React.CSSProperties,
  etaTime: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#005bd3',
    margin: '0 0 2px 0',
  } as React.CSSProperties,
  etaSubtext: {
    fontSize: '12px',
    color: '#666',
    margin: '0',
  } as React.CSSProperties,
  zoomControls: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 10,
  } as React.CSSProperties,
  zoomButton: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    background: 'white',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  } as React.CSSProperties,
  shareControl: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    zIndex: 10,
  } as React.CSSProperties,
  shareButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    background: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a1a',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  } as React.CSSProperties,
  shareButtonActive: {
    background: '#dcfce7',
    color: '#166534',
    borderColor: '#86efac',
  } as React.CSSProperties,
  shareIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  addressContainer: {
    background: 'white',
    padding: '24px',
  } as React.CSSProperties,
  addressSection: {
    marginBottom: '24px',
  } as React.CSSProperties,
  addressTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  address: {
    fontSize: '14px',
    color: '#333',
    margin: '0 0 4px 0',
    fontWeight: '500',
  } as React.CSSProperties,
  addressNote: {
    fontSize: '12px',
    color: '#999',
    margin: '0',
  } as React.CSSProperties,
  instructionsSection: {
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
  } as React.CSSProperties,
  instructionsTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 12px 0',
  } as React.CSSProperties,
  instructionsList: {
    fontSize: '13px',
    color: '#666',
    margin: '0',
    paddingLeft: '20px',
    lineHeight: '1.6',
  } as React.CSSProperties,
};

export default DeliveryMap;
