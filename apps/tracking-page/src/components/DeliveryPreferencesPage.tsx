import { useState, useEffect } from 'react'

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'

interface DeliveryPreferencesPageProps {
  shipmentId: string
  onBack: () => void
}

interface Preferences {
  method: 'door' | 'signature' | 'neighbor'
  instructions: string
  timeWindow: 'morning' | 'afternoon' | 'evening' | 'anytime'
  safePlace: string
  phoneNumber: string
}

export function DeliveryPreferencesPage({
  shipmentId,
  onBack,
}: DeliveryPreferencesPageProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    method: 'door',
    instructions: '',
    timeWindow: 'anytime',
    safePlace: '',
    phoneNumber: '',
  })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load saved preferences from sessionStorage
  useEffect(() => {
    const key = `prefs_${shipmentId}`
    const stored = sessionStorage.getItem(key)
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [shipmentId])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (preferences.method === 'signature' && !preferences.phoneNumber.trim()) {
      setError('Phone number is required for signature delivery')
      return
    }

    // Save to sessionStorage
    const key = `prefs_${shipmentId}`
    sessionStorage.setItem(key, JSON.stringify(preferences))

    setSaved(true)
    setError('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: BG_COLOR,
        padding: isMobile ? '0' : '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          padding: isMobile ? '12px 16px' : '0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: isMobile ? '0' : '24px',
          backgroundColor: isMobile ? 'white' : 'transparent',
          borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
          position: isMobile ? 'sticky' : 'relative',
          top: isMobile ? '0' : 'auto',
          zIndex: isMobile ? '10' : 'auto',
        }}
      >
        <button
          onClick={onBack}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px 8px',
          }}
        >
          ←
        </button>
        <div>
          <h1
            style={{
              fontSize: isMobile ? '16px' : '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0',
            }}
          >
            Delivery Preferences
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: isMobile ? '0' : '4px 0 0 0',
              display: isMobile ? 'none' : 'block',
            }}
          >
            Customize your delivery experience
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSave}
        style={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: 'white',
          borderRadius: isMobile ? '0' : '12px',
          padding: isMobile ? '16px' : '32px',
          boxShadow: isMobile ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Delivery Method */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Delivery Method
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                value: 'door' as const,
                label: 'Leave at Door',
                desc: 'Leave package at front door',
              },
              {
                value: 'signature' as const,
                label: 'Require Signature',
                desc: 'Signature required upon delivery',
              },
              {
                value: 'neighbor' as const,
                label: 'Leave with Neighbor',
                desc: 'Driver may leave with neighbor',
              },
            ].map((option) => (
              <label
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor:
                    preferences.method === option.value ? '#f0f9ff' : 'transparent',
                  border:
                    preferences.method === option.value
                      ? `2px solid ${BRAND_BLUE}`
                      : '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="radio"
                  name="delivery-method"
                  value={option.value}
                  checked={preferences.method === option.value}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      method: e.target.value as Preferences['method'],
                    })
                  }
                  style={{
                    cursor: 'pointer',
                    marginTop: '2px',
                    accentColor: BRAND_BLUE,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1f2937',
                      margin: '0',
                    }}
                  >
                    {option.label}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      margin: '4px 0 0 0',
                    }}
                  >
                    {option.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Time Window */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Preferred Time Window
          </label>

          <select
            value={preferences.timeWindow}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                timeWindow: e.target.value as Preferences['timeWindow'],
              })
            }
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              color: '#1f2937',
              cursor: 'pointer',
              boxSizing: 'border-box',
              accentColor: BRAND_BLUE,
            }}
          >
            <option value="anytime">Anytime</option>
            <option value="morning">Morning (8am - 12pm)</option>
            <option value="afternoon">Afternoon (12pm - 5pm)</option>
            <option value="evening">Evening (5pm - 9pm)</option>
          </select>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Delivery Instructions */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Delivery Instructions (Optional)
          </label>

          <textarea
            value={preferences.instructions}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                instructions: e.target.value,
              })
            }
            placeholder="e.g., Ring doorbell twice. Please don't leave at side gate."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              color: '#1f2937',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '8px 0 0 0',
            }}
          >
            {preferences.instructions.length}/200 characters
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Safe Place */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Safe Place Description (Optional)
          </label>

          <input
            type="text"
            value={preferences.safePlace}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                safePlace: e.target.value,
              })
            }
            placeholder="e.g., Leave under the welcome mat"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              color: '#1f2937',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Phone Number */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
            }}
          >
            Phone Number for Driver Contact
            {preferences.method === 'signature' && (
              <span style={{ color: '#dc2626' }}> *</span>
            )}
          </label>

          <input
            type="tel"
            value={preferences.phoneNumber}
            onChange={(e) => {
              setPreferences({
                ...preferences,
                phoneNumber: e.target.value,
              })
              setError('')
            }}
            placeholder="(555) 123-4567"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border:
                error && preferences.method === 'signature'
                  ? '2px solid #dc2626'
                  : '1px solid #e5e7eb',
              fontSize: '14px',
              color: '#1f2937',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <p
              style={{
                fontSize: '12px',
                color: '#dc2626',
                margin: '8px 0 0 0',
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Success Message */}
        {saved && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: `1px solid ${BRAND_GREEN}`,
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              color: BRAND_GREEN,
              fontWeight: '500',
            }}
          >
            ✓ Preferences saved successfully
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: `1px solid #e5e7eb`,
              color: '#1f2937',
              padding: '12px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                BG_COLOR
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'transparent'
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            style={{
              flex: 1,
              backgroundColor: BRAND_GREEN,
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                '#006b52'
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                BRAND_GREEN
            }}
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* Info Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          marginTop: '24px',
          marginBottom: isMobile ? '20px' : '0',
          padding: isMobile ? '16px' : '0',
          backgroundColor: 'white',
          borderRadius: isMobile ? '0' : '12px',
          boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ padding: isMobile ? '0' : '20px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 12px 0',
            }}
          >
            💡 How It Works
          </h3>
          <ul
            style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: '0',
              paddingLeft: '20px',
              lineHeight: '1.6',
            }}
          >
            <li>Your preferences are saved to your browser</li>
            <li>Driver will see your instructions at delivery time</li>
            <li>You can always update your preferences before delivery</li>
            <li>Need changes? Contact support for assistance</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
