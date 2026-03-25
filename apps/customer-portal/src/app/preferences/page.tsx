'use client';

import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CustomerPreferences, SafePlaceInstruction, NotificationChannel } from '@/types';

const safeInstructions: { value: SafePlaceInstruction; label: string }[] = [
  { value: 'front-door', label: 'Front Door' },
  { value: 'back-door', label: 'Back Door' },
  { value: 'garage', label: 'Garage' },
  { value: 'neighbor', label: 'Leave with Neighbor' },
];

const notificationChannels: NotificationChannel[] = ['email', 'sms', 'push', 'whatsapp'];
const channelLabels: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push Notifications',
  whatsapp: 'WhatsApp',
};

// Mock preferences data
const mockPreferences: CustomerPreferences = {
  safePlace: {
    instruction: 'front-door',
    customNote: 'Ring doorbell, do not knock',
  },
  accessCodes: {
    gateCode: '1234',
    buildingEntry: 'Apt 4B',
  },
  preferredDeliveryTimes: [
    { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
    { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
    { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
    { dayOfWeek: 4, startTime: '10:00', endTime: '18:00' },
    { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
  ],
  notificationPreferences: {
    email: true,
    sms: true,
    push: false,
    whatsapp: false,
  },
  defaultAddress: {
    street: '123 Main St, Apt 4B',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'USA',
  },
};

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState(mockPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSafePlaceChange = (field: 'instruction' | 'customNote', value: SafePlaceInstruction | string) => {
    setPreferences(prev => ({
      ...prev,
      safePlace: {
        instruction: prev.safePlace?.instruction ?? 'front-door',
        customNote: prev.safePlace?.customNote,
        [field]: value,
      },
    }));
  };

  const handleAccessCodeChange = (field: 'gateCode' | 'buildingEntry', value: string) => {
    setPreferences(prev => ({
      ...prev,
      accessCodes: {
        ...prev.accessCodes,
        [field]: value,
      },
    }));
  };

  const handleNotificationChange = (channel: NotificationChannel, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [channel]: enabled,
      },
    }));
  };

  const handlePreferredTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredDeliveryTimes: prev.preferredDeliveryTimes?.map(time =>
        time.dayOfWeek === dayOfWeek
          ? { ...time, [field]: value }
          : time
      ) || [],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="page-container pb-24 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Delivery Preferences</h1>
        <p className="page-subtitle">
          Customize how you want to receive your deliveries
        </p>
      </div>

      {/* Success Toast */}
      {saveSuccess && (
        <div className="bg-wl-success-bg rounded-lg p-4 flex items-center gap-3 animate-fade-in">
          <Check className="w-4 h-4 text-wl-success-500 flex-shrink-0" />
          <p className="text-sm text-wl-success-500 font-medium">
            Preferences saved successfully!
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Safe Place Instructions */}
        <div className="section-card animate-fade-in stagger-1">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
            Safe Place Instructions
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-wl-text-secondary mb-3">
                Where should we leave your package?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {safeInstructions.map((instruction) => (
                  <button
                    key={instruction.value}
                    onClick={() => handleSafePlaceChange('instruction', instruction.value)}
                    className={cn(
                      'btn btn-ghost',
                      preferences.safePlace?.instruction === instruction.value
                        && 'bg-wl-bg-elevated border border-wl-primary-500 text-wl-text-primary'
                    )}
                  >
                    {instruction.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-wl-text-secondary mb-2">
                Custom Instructions (Optional)
              </p>
              <textarea
                value={preferences.safePlace?.customNote || ''}
                onChange={(e) => handleSafePlaceChange('customNote', e.target.value)}
                placeholder="e.g., Ring doorbell, do not knock..."
                className="input resize-none h-20"
              />
            </div>
          </div>
        </div>

        {/* Access Codes */}
        <div className="section-card animate-fade-in stagger-2">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
            Access Codes
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-wl-text-secondary mb-2">
                Gate Code (Optional)
              </p>
              <input
                type="text"
                value={preferences.accessCodes?.gateCode || ''}
                onChange={(e) => handleAccessCodeChange('gateCode', e.target.value)}
                placeholder="e.g., 1234#"
                className="input"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-wl-text-secondary mb-2">
                Building Entry (Optional)
              </p>
              <input
                type="text"
                value={preferences.accessCodes?.buildingEntry || ''}
                onChange={(e) => handleAccessCodeChange('buildingEntry', e.target.value)}
                placeholder="e.g., Apt 4B"
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Preferred Delivery Times */}
        <div className="section-card animate-fade-in stagger-3">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-1">
            Preferred Delivery Times
          </h2>
          <p className="text-sm text-wl-text-secondary mb-5">
            Set your preferred delivery windows for each day
          </p>

          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayLabel = dayLabels[day];
              const preferred = preferences.preferredDeliveryTimes?.find(t => t.dayOfWeek === day);

              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm font-medium text-wl-text-primary w-24">
                    {dayLabel}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={preferred?.startTime || '10:00'}
                      onChange={(e) => handlePreferredTimeChange(day, 'startTime', e.target.value)}
                      className="input flex-1"
                    />
                    <span className="text-wl-text-tertiary text-sm">to</span>
                    <input
                      type="time"
                      value={preferred?.endTime || '18:00'}
                      onChange={(e) => handlePreferredTimeChange(day, 'endTime', e.target.value)}
                      className="input flex-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="section-card animate-fade-in stagger-4">
          <h2 className="text-lg font-semibold text-wl-text-primary mb-1">
            Notification Preferences
          </h2>
          <p className="text-sm text-wl-text-secondary mb-5">
            Choose how you want to be notified about your deliveries
          </p>

          <div className="flex flex-col gap-3">
            {notificationChannels.map((channel) => {
              const isOn = !!preferences.notificationPreferences?.[channel];

              return (
                <div
                  key={channel}
                  className="flex items-center justify-between p-3 rounded-lg bg-wl-bg-elevated"
                >
                  <span className="text-sm font-medium text-wl-text-primary">
                    {channelLabels[channel]}
                  </span>
                  <button
                    onClick={() => handleNotificationChange(channel, !isOn)}
                    className={cn(
                      'toggle',
                      isOn ? 'toggle-on' : 'toggle-off'
                    )}
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Default Address */}
        <div className="section-card animate-fade-in stagger-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Default Address
            </h2>
            <button className="btn btn-ghost">
              Edit Address
            </button>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-wl-text-tertiary mb-0.5">Street Address</p>
              <p className="text-wl-text-primary font-medium">
                {preferences.defaultAddress.street}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-wl-text-tertiary mb-0.5">City</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.city}
                </p>
              </div>
              <div>
                <p className="text-wl-text-tertiary mb-0.5">State</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.state}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-wl-text-tertiary mb-0.5">ZIP Code</p>
                <p className="text-wl-text-primary font-medium mono">
                  {preferences.defaultAddress.zipCode}
                </p>
              </div>
              <div>
                <p className="text-wl-text-tertiary mb-0.5">Country</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.country}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button — sticky bottom */}
      <div className="sticky bottom-6 z-10">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary btn-lg w-full sm:w-auto"
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
