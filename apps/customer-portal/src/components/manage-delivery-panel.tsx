'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────

export type ContactPref = 'call' | 'sms' | 'whatsapp';

export interface DeliveryPreferences {
  instructions?: string | null;
  dropoffNote?: string | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  contactPref?: ContactPref | null;
  rescheduledTo?: string | null;
  timeSlotId?: string | null;
}

export interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
}

interface ManageDeliveryPanelProps {
  trackingToken: string;
  deliveryStatus: string;
  initialPreferences?: DeliveryPreferences | null;
  availableSlots?: TimeSlot[];
  slotsLocked?: boolean;
  onSave?: (prefs: DeliveryPreferences) => void;
}

// ─── Constants ───────────────────────────────────────────────

const INSTRUCTION_OPTIONS = [
  'Leave at door',
  'Ring bell',
  'Call on arrival',
  'Leave with neighbour',
];

const CONTACT_OPTIONS: { value: ContactPref; label: string }[] = [
  { value: 'call', label: 'Phone Call' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

// Instructions are editable until driver marks "arrived"
const INSTRUCTIONS_LOCKED_STATUSES = ['ARRIVED', 'DELIVERED'];
// Reschedule locked once driver is dispatched
const RESCHEDULE_LOCKED_STATUSES = ['OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'];

// ─── Component ───────────────────────────────────────────────

export function ManageDeliveryPanel({
  trackingToken,
  deliveryStatus,
  initialPreferences,
  availableSlots = [],
  slotsLocked = false,
  onSave,
}: ManageDeliveryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instructions, setInstructions] = useState(initialPreferences?.instructions ?? '');
  const [dropoffNote, setDropoffNote] = useState(initialPreferences?.dropoffNote ?? '');
  const [contactPref, setContactPref] = useState<ContactPref | null>(
    (initialPreferences?.contactPref as ContactPref) ?? null
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    initialPreferences?.timeSlotId ?? null
  );

  const instructionsLocked = INSTRUCTIONS_LOCKED_STATUSES.includes(deliveryStatus);
  const rescheduleLocked = slotsLocked || RESCHEDULE_LOCKED_STATUSES.includes(deliveryStatus);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const payload: DeliveryPreferences = {
      instructions: instructions || undefined,
      dropoffNote: dropoffNote || undefined,
      contactPref: contactPref ?? undefined,
      timeSlotId: selectedSlotId ?? undefined,
    };

    try {
      const res = await fetch(`/api/v4/tracking/token/${trackingToken}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Failed to save preferences');
      }

      setSaveSuccess(true);
      onSave?.(payload);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="section-card">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <h3 className="font-semibold text-wl-text-primary">Manage Delivery</h3>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-wl-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-wl-text-secondary" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-5 animate-fade-in">
          {/* Delivery Instructions */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-2">
              Delivery Instructions
              {instructionsLocked && (
                <span className="ml-2 text-wl-text-tertiary text-xs">(locked — driver has arrived)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {INSTRUCTION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  disabled={instructionsLocked}
                  onClick={() =>
                    setInstructions((prev) =>
                      prev === opt ? '' : opt
                    )
                  }
                  className={cn(
                    'btn btn-ghost text-sm',
                    instructions === opt && 'bg-wl-bg-elevated border border-wl-primary-500',
                    instructionsLocked && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              disabled={instructionsLocked}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add a custom note for the driver…"
              maxLength={500}
              className={cn(
                'input resize-none h-20 w-full text-sm',
                instructionsLocked && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>

          {/* Safe Drop-off Note */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-2">
              Safe Drop-off Location
            </p>
            <textarea
              disabled={instructionsLocked}
              value={dropoffNote}
              onChange={(e) => setDropoffNote(e.target.value)}
              placeholder="e.g., Leave in blue box by gate, or text description of safe spot…"
              maxLength={500}
              className={cn(
                'input resize-none h-20 w-full text-sm',
                instructionsLocked && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>

          {/* Contact Preference */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-2">
              Contact Preference
            </p>
            <div className="flex gap-2 flex-wrap">
              {CONTACT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setContactPref((prev) => (prev === value ? null : value))}
                  className={cn(
                    'btn btn-ghost text-sm',
                    contactPref === value && 'bg-wl-bg-elevated border border-wl-primary-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reschedule */}
          <div>
            <p className="text-sm font-medium text-wl-text-secondary mb-2">
              Reschedule Delivery
              {rescheduleLocked && (
                <span className="ml-2 text-wl-text-tertiary text-xs">(locked — driver en route)</span>
              )}
            </p>
            {rescheduleLocked ? (
              <p className="text-sm text-wl-text-tertiary">
                Rescheduling is no longer available once the driver is on the way.
              </p>
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-wl-text-tertiary">No time slots available for rescheduling.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId((prev) => (prev === slot.id ? null : slot.id))}
                    className={cn(
                      'section-card text-center font-medium text-sm mono transition-all',
                      selectedSlotId === slot.id
                        ? 'border-wl-primary-500 bg-wl-bg-elevated text-wl-primary-400'
                        : 'text-wl-text-primary hover:border-wl-primary-500/50'
                    )}
                  >
                    <p className="font-semibold">{slot.name}</p>
                    <p className="text-xs text-wl-text-secondary">
                      {slot.startTime} – {slot.endTime}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-wl-error-500 animate-fade-in">{error}</p>
          )}

          {/* Success */}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-wl-success-500 animate-fade-in">
              <Check className="w-4 h-4" />
              Preferences saved!
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || instructionsLocked}
            className={cn(
              'btn btn-primary w-full sm:w-auto',
              (isSaving || instructionsLocked) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
