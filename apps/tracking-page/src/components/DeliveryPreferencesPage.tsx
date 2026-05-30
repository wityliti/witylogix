import { useState, useEffect } from 'react'
import { updateDeliveryPreferences } from '../lib/api'
import type { DeliveryPreferences } from '../lib/api'

const BRAND_BLUE = '#005bd3'
const BRAND_GREEN = '#008060'
const BG_COLOR = '#f6f6f7'

interface DeliveryPreferencesPageProps {
  /** Public tracking token — used as the key for the preferences PATCH endpoint */
  trackingToken: string
  onBack: () => void
}

interface FormState {
  instructions: string
  dropoffNote: string
  contactPref: 'call' | 'sms' | 'whatsapp'
  rescheduleDate: string
}

export function DeliveryPreferencesPage({
  trackingToken,
  onBack,
}: DeliveryPreferencesPageProps) {
  const [form, setForm] = useState<FormState>({
    instructions: '',
    dropoffNote: '',
    contactPref: 'sms',
    rescheduleDate: '',
  })
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
    const stored = sessionStorage.getItem(`prefs_${trackingToken}`)
    if (stored) {
      try {
        const parsed: Partial<FormState> = JSON.parse(stored)
        setForm((prev) => ({ ...prev, ...parsed }))
      } catch {
        // ignore parse errors
      }
    }
  }, [trackingToken])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const payload: DeliveryPreferences = {
      instructions: form.instructions.trim() || undefined,
      dropoffNote: form.dropoffNote.trim() || undefined,
      contactPref: form.contactPref,
      rescheduledTo: form.rescheduleDate
        ? new Date(form.rescheduleDate + 'T09:00:00').toISOString()
        : undefined,
    }

    setSaving(true)
    try {
      await updateDeliveryPreferences(trackingToken, payload)
      sessionStorage.setItem(`prefs_${trackingToken}`, JSON.stringify(form))
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences'
      setError(message)
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
    backgroundColor: 'white',
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
        {/* Driver Instructions */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Driver Instructions <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="e.g. Ring doorbell twice. Please don't leave at side gate."
            maxLength={500}
            style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif' }}
          />
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0 0' }}>
            {form.instructions.length}/500 characters
          </p>
        </div>

        {/* Drop-off Note */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Drop-off Note <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <input
            type="text"
            value={form.dropoffNote}
            onChange={(e) => setForm({ ...form, dropoffNote: e.target.value })}
            placeholder="e.g. Leave under the welcome mat"
            maxLength={500}
            style={inputStyle}
          />
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Contact Preference */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
            Preferred Contact Method
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {([
              { value: 'sms', label: 'SMS' },
              { value: 'call', label: 'Phone Call' },
              { value: 'whatsapp', label: 'WhatsApp' },
            ] as const).map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: form.contactPref === opt.value ? `2px solid ${BRAND_BLUE}` : '1px solid #e5e7eb',
                  backgroundColor: form.contactPref === opt.value ? '#f0f9ff' : 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: form.contactPref === opt.value ? BRAND_BLUE : '#374151',
                }}
              >
                <input
                  type="radio"
                  name="contact-pref"
                  value={opt.value}
                  checked={form.contactPref === opt.value}
                  onChange={() => setForm({ ...form, contactPref: opt.value })}
                  style={{ accentColor: BRAND_BLUE }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

        {/* Reschedule */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
            Reschedule Delivery <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span>
          </label>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
            Request a different delivery date
          </p>
          <input
            type="date"
            value={form.rescheduleDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm({ ...form, rescheduleDate: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {saved && (
          <div style={{ backgroundColor: '#ecfdf5', border: `1px solid ${BRAND_GREEN}`, borderRadius: '8px', padding: '12px', fontSize: '13px', color: BRAND_GREEN, fontWeight: '500' }}>
            Preferences saved — the driver has been notified
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
          How It Works
        </h3>
        <ul style={{ fontSize: '13px', color: '#6b7280', margin: '0', paddingLeft: '20px', lineHeight: '1.7' }}>
          <li>Changes are sent directly to your driver</li>
          <li>You will receive an SMS/email confirmation</li>
          <li>Rescheduling is subject to driver availability</li>
          <li>Preferences cannot be updated once the driver has arrived</li>
        </ul>
      </div>
    </div>
  )
}
