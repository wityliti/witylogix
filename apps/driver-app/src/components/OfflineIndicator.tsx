/**
 * OfflineIndicator - Shows connection status and pending queue
 */

import React, { useState, useEffect } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingCount, syncInProgress, syncNow } = useOfflineSync();
  const [isVisible, setIsVisible] = useState(!isOnline);

  useEffect(() => {
    setIsVisible(!isOnline || pendingCount > 0);
  }, [isOnline, pendingCount]);

  if (!isVisible) {
    return null;
  }

  const statusColor = isOnline ? '#4CAF50' : '#FF9800';
  const statusText = isOnline ? 'Online' : 'Offline';
  const icon = isOnline ? '✓' : '⚠';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: statusColor,
        color: 'white',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            animation: isOnline ? 'none' : 'pulse 1.5s infinite',
          }}
        >
          {icon}
        </span>
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {statusText}
          </div>
          {pendingCount > 0 && (
            <div
              style={{
                fontSize: '12px',
                opacity: 0.9,
              }}
            >
              {pendingCount} pending operation{pendingCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={syncNow}
          disabled={syncInProgress}
          style={{
            backgroundColor: 'rgba(255,255,255,0.3)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: syncInProgress ? 'not-allowed' : 'pointer',
            opacity: syncInProgress ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {syncInProgress ? 'Syncing...' : 'Sync Now'}
        </button>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
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
      `}</style>
    </div>
  );
};

export default OfflineIndicator;
