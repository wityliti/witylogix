/**
 * DriverCard — renders a driver summary card.
 * The public tracking API exposes name + vehicleType only (no phone/licensePlate by design).
 */
import type { DriverInfo } from '../types'
import { getVehicleIcon } from '../lib/utils'

interface DriverCardProps {
  driver: DriverInfo
}

const BRAND_BLUE = '#005bd3'
const DARK_TEXT = '#1f2937'
const LIGHT_TEXT = '#6b7280'

export function DriverCard({ driver }: DriverCardProps) {
  const vehicleIcon = getVehicleIcon(driver.vehicleType)
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
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: BRAND_BLUE,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '700',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,91,211,0.25)',
        }}
      >
        {initials}
      </div>

      {/* Info */}
      <div>
        <p style={{ fontSize: '16px', fontWeight: '700', color: DARK_TEXT, margin: '0 0 3px 0' }}>
          {driver.name}
        </p>
        <p style={{ fontSize: '13px', color: LIGHT_TEXT, margin: 0 }}>
          {vehicleIcon} {driver.vehicleType}
        </p>
      </div>
    </div>
  )
}
