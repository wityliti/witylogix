import { useState, useEffect } from 'react'
import type { Driver } from '../types'
import { maskPhoneNumber, getVehicleIcon, calculateETA } from '../lib/utils'

interface DriverCardProps {
  driver: Driver
  eta: number
}

const BRAND_BLUE = '#3b82f6'
const BRAND_GREEN = '#10b981'
const DARK_TEXT = '#1f2937'
const LIGHT_TEXT = '#6b7280'

export function DriverCard({ driver, eta }: DriverCardProps) {
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const { formatted } = calculateETA(eta)
      setTimeRemaining(formatted)
    }

    updateTime()
    const interval = setInterval(updateTime, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [eta])

  const vehicleIcon = getVehicleIcon(driver.vehicle.type)
  const maskedPhone = maskPhoneNumber(driver.phone)
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
        marginBottom: '20px',
        animation: 'slideIn 0.5s ease-out',
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .driver-avatar {
            animation: slideIn 0.6s ease-out;
          }
          .eta-badge {
            animation: pulse 2s ease-in-out infinite;
          }
        `}
      </style>

      {/* Driver Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          className="driver-avatar"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: BRAND_BLUE,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '700',
            marginRight: '16px',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          }}
        >
          {initials}
        </div>
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: DARK_TEXT,
              margin: '0 0 4px 0',
            }}
          >
            {driver.name}
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: LIGHT_TEXT,
              margin: '0',
            }}
          >
            {maskedPhone}
          </p>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              gap: '4px',
            }}
          >
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                style={{
                  color: i < 4 ? '#fbbf24' : '#d1d5db',
                  fontSize: '14px',
                }}
              >
                ★
              </span>
            ))}
            <span style={{ fontSize: '12px', color: LIGHT_TEXT, marginLeft: '4px' }}>
              4.0
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            fontSize: '40px',
            marginRight: '16px',
          }}
        >
          {vehicleIcon}
        </div>
        <div>
          <p
            style={{
              fontSize: '12px',
              color: LIGHT_TEXT,
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600',
            }}
          >
            Vehicle
          </p>
          <p
            style={{
              fontSize: '15px',
              fontWeight: '600',
              color: DARK_TEXT,
              margin: '0 0 2px 0',
            }}
          >
            {driver.vehicle.type}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: LIGHT_TEXT,
              margin: '0',
              fontFamily: 'monospace',
            }}
          >
            {driver.vehicle.licensePlate}
          </p>
        </div>
      </div>

      {/* ETA Section */}
      <div style={{ marginBottom: '20px' }}>
        <p
          style={{
            fontSize: '12px',
            color: LIGHT_TEXT,
            margin: '0 0 10px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: '600',
          }}
        >
          ETA Countdown
        </p>
        <div
          className="eta-badge"
          style={{
            fontSize: '32px',
            fontWeight: '800',
            color: BRAND_GREEN,
            letterSpacing: '-1px',
          }}
        >
          {timeRemaining}
        </div>
        <p
          style={{
            fontSize: '12px',
            color: LIGHT_TEXT,
            margin: '6px 0 0 0',
          }}
        >
          until arrival
        </p>
      </div>

      {/* Contact Button */}
      <button
        onClick={() =>
          alert(`Driver ${driver.name} contact info:\n${maskPhoneNumber(driver.phone)}`)
        }
        style={{
          width: '100%',
          backgroundColor: BRAND_BLUE,
          color: 'white',
          border: 'none',
          padding: '12px 16px',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            '#2563eb'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 8px 16px rgba(59, 130, 246, 0.3)'
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            BRAND_BLUE
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
        }}
      >
        💬 Contact Driver
      </button>
    </div>
  )
}
