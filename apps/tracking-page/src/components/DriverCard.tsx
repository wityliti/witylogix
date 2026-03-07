import { useState, useEffect } from 'react'
import type { Driver } from '../types'
import { maskPhoneNumber, getVehicleIcon, calculateETA } from '../lib/utils'

interface DriverCardProps {
  driver: Driver
  eta: number
}

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

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px',
      }}
    >
      {/* Driver Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#005bd3',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginRight: '16px',
            flexShrink: 0,
          }}
        >
          👤
        </div>
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 4px 0',
            }}
          >
            {driver.name}
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: '0',
            }}
          >
            {maskedPhone}
          </p>
        </div>
      </div>

      {/* Vehicle Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            fontSize: '32px',
            marginRight: '16px',
          }}
        >
          {vehicleIcon}
        </div>
        <div>
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '0 0 4px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Vehicle
          </p>
          <div>
            <p
              style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#1f2937',
                margin: '0',
              }}
            >
              {driver.vehicle.type}
            </p>
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
                margin: '4px 0 0 0',
              }}
            >
              {driver.vehicle.licensePlate}
            </p>
          </div>
        </div>
      </div>

      {/* ETA */}
      <div>
        <p
          style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Estimated Arrival
        </p>
        <div
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#008060',
          }}
        >
          {timeRemaining}
        </div>
      </div>
    </div>
  )
}
