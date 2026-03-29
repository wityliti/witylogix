import { useState, useEffect } from 'react'
import { updateDeliveryPreferences } from '../lib/api'
import type { DeliveryPreferences } from '../lib/api'

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'

interface DeliveryPreferencesPageProps {
  shipmentId: string
  onBack: () => void
}

type Preferences = DeliveryPreferences & {
  deliveryMethod: 'door' | 'signature' | 'neighbor'
  rescheduleTimeWindow: 'morning' | 'afternoon' | 'evening' | 'anytime'
}

export function DeliveryPreferencesPage({
  shipmentId,
  onBack,
}: DeliveryPreferencesPageProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    deliveryMethod: 'door',
    instructions: '',
    rescheduleTimeWindow: 'anytime',
    rescheduleDate: '',
    safePlace: '',
    phoneNumber: '',
    redirectAddress: undefined,
  })
  const [enableRedirect, setEnableRedirect] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Restore previously saved preferences from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`prefs_${shipmentId}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPreferences((prev) => ({ ...prev, ...parsed }))
        if (parsed.redirectAddress) setEnableRedirect(true)
      } catch {
        // ignore parse errors
      }
    }
  }, [shipmentId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (preferences.deliveryMethod === 'signature' && !preferences.phoneNumber?.trim()) {
      setError('Phone number is required for signature delivery')
      return
    }

    const payload: DeliveryPreferences = {
      deliveryMethod: preferences.deliveryMethod,
      instructions: preferences.instructions || undefined,
      safePlace: preferences.safePlace || undefined,
      phoneNumber: preferences.phoneNumber || undefined,
      rescheduleDate: preferences.rescheduleDate || undefined,
      rescheduleTimeWindow: preferences.rescheduleDate ? preferences.rescheduleTimeWindow : undefined,
      redirectAddress:
        enableRedirect && preferences.redirectAddress?.line1
          ? preferences.redirectAddress
          : undefined,
    }

    setSaving(true)
    try {
      await updateDeliveryPreferences(shipmentId, payload)
      sessionStorage.setItem(`prefs_${shipmentId}`, JSON.stringify(payload))
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    color: '#1f2937',
    boxSizing: 'border-box',
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
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '4px 8px' }}
        >
          ←
        </button>
        <div>
          <h1 style={{ fontSize: isMobile ? '16px' : '24px', fontWeight: '700', color: '#1f2937', margin: '0' }}>
            Change Delivery
          </h1>
          {!isMobile && (
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
              Update preferences while your order is in transit
            </p>
          )}
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
          boxShadow: isMobile ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Delivery Method */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
            Delivery Method
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {([
              { value: 'door', label: 'Leave at Door', desc: 'Leave package at front door' },
              { value: 'signature', label: 'Require Signature', desc: 'Signature required upon delivery' },
              { value: 'neighbor', label: 'Leave with Neighbour', desc: 'Driver may leave with neighbour' },
            ] as const).map((option) => (
              <label
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: preferences.deliveryMethod === option.value ? '#f0f9ff' : 'transparent',
                  border: preferences.deliveryMethod === option.value ? `2px solid ${BRAND_BLUE}` : '1px solid #e5e7eb',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="delivery-method"
                  value={option.value}
                  checked={preferences.deliveryMethod === option.value}
                  onChange={(e) =>
                    setPreferences({ ...preferences, deliveryMethod: e.target.value as Preferences['deliveryMethod'] })
                  }
                  style={{ cursor: 'pointer', marginTop: '2px', accentColor: BRAND_BLUE }}
                />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937', margin: '0' }}>{option.label}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Safe Place */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Safe Place Instructions <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <input
            type="text"
            value={preferences.safePlace ?? ''}
            onChange={(e) => setPreferences({ ...preferences, safePlace: e.target.value })}
            placeholder="e.g. Leave under the welcome mat"
            style={inputStyle}
          />
        </div>

        {/* Additional Instructions */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Driver Instructions <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <textarea
            value={preferences.instructions ?? ''}
            onChange={(e) => setPreferences({ ...preferences, instructions: e.target.value })}
            placeholder="e.g. Ring doorbell twice. Please don't leave at side gate."
            maxLength={200}
            style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif' }}
          />
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0 0' }}>
            {(preferences.instructions ?? '').length}/200 characters
          </p>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Reschedule */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
            Reschedule Delivery <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
            Request a different date and time window
          </p>
          <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
            <input
              type="date"
              value={preferences.rescheduleDate ?? ''}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPreferences({ ...preferences, rescheduleDate: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
            <select
              value={preferences.rescheduleTimeWindow}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  rescheduleTimeWindow: e.target.value as Preferences['rescheduleTimeWindow'],
                })
              }
              style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
              disabled={!preferences.rescheduleDate}
            >
              <option value="anytime">Anytime</option>
              <option value="morning">Morning (8am – 12pm)</option>
              <option value="afternoon">Afternoon (12pm – 5pm)</option>
              <option value="evening">Evening (5pm – 9pm)</option>
            </select>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Redirect Address */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: '0' }}>
                Redirect to Alternative Address
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                Must be within the delivery zone
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enableRedirect}
                onChange={(e) => {
                  setEnableRedirect(e.target.checked)
                  if (!e.target.checked) {
                    setPreferences({ ...preferences, redirectAddress: undefined })
                  }
                }}
                style={{ accentColor: BRAND_BLUE, width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '13px', color: '#374151' }}>Enable</span>
            </label>
          </div>

          {enableRedirect && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={preferences.redirectAddress?.line1 ?? ''}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    redirectAddress: {
                      line1: e.target.value,
                      city: preferences.redirectAddress?.city ?? '',
                      postalCode: preferences.redirectAddress?.postalCode ?? '',
                    },
                  })
                }
                placeholder="Street address"
                style={inputStyle}
                required={enableRedirect}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={preferences.redirectAddress?.city ?? ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      redirectAddress: {
                        line1: preferences.redirectAddress?.line1 ?? '',
                        city: e.target.value,
                        postalCode: preferences.redirectAddress?.postalCode ?? '',
                      },
                    })
                  }
                  placeholder="City"
                  style={{ ...inputStyle, flex: 1 }}
                  required={enableRedirect}
                />
                <input
                  type="text"
                  value={preferences.redirectAddress?.postalCode ?? ''}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      redirectAddress: {
                        line1: preferences.redirectAddress?.line1 ?? '',
                        city: preferences.redirectAddress?.city ?? '',
                        postalCode: e.target.value,
                      },
                    })
                  }
                  placeholder="Postal code"
                  style={{ ...inputStyle, flex: 1 }}
                  required={enableRedirect}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Phone Number */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Phone Number for Driver Contact
            {preferences.deliveryMethod === 'signature' && <span style={{ color: '#dc2626' }}> *</span>}
          </label>
          <input
            type="tel"
            value={preferences.phoneNumber ?? ''}
            onChange={(e) => {
              setPreferences({ ...preferences, phoneNumber: e.target.value })
              setError('')
            }}
            placeholder="(555) 123-4567"
            style={{ ...inputStyle, border: error.includes('Phone') ? '2px solid #dc2626' : '1px solid #e5e7eb' }}
          />
          {error.includes('Phone') && (
            <p style={{ fontSize: '12px', color: '#dc2626', margin: '6px 0 0 0' }}>{error}</p>
          )}
        </div>

        {/* Generic error */}
        {error && !error.includes('Phone') && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {saved && (
          <div style={{ backgroundColor: '#ecfdf5', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '12px', fontSize: '13px', color: BRAND_GREEN, fontWeight: '500' }}>
            ✓ Preferences saved — the driver has been notified
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid #e5e7eb', color: '#1f2937', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ flex: 1, backgroundColor: saving ? '#93c5fd' : BRAND_GREEN, color: 'white', padding: '12px 16px', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontSize: '14px', fontWeight: '600', border: 'none' }}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Info card */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          marginTop: '24px',
          marginBottom: isMobile ? '20px' : '0',
          padding: isMobile ? '16px' : '20px',
          backgroundColor: 'white',
          borderRadius: isMobile ? '0' : '12px',
          boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: '0 0 12px 0' }}>
          💡 How It Works
        </h3>
        <ul style={{ fontSize: '13px', color: '#6b7280', margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Changes are sent directly to your driver</li>
          <li>You'll receive an email/SMS confirmation</li>
          <li>Rescheduling is subject to driver availability</li>
          <li>Address redirects must be within the delivery zone</li>
          <li>Changes can no longer be made within 30 minutes of estimated delivery</li>
        </ul>
      </div>
    </div>
  )
}
