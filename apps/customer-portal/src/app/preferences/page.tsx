'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
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

  const handleSafePlaceChange = (field: 'instruction' | 'customNote', value: any) => {
    setPreferences(prev => ({
      ...prev,
      safePlace: {
        ...prev.safePlace,
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
    <div className={cn(
      'flex flex-col gap-6 px-4 sm:px-6 lg:px-8',
      'py-6 sm:py-8 pb-12'
    )}>
      {/* Header */}
      <section>
        <h1 className="text-3xl sm:text-4xl font-bold text-wl-text-primary mb-2">
          Delivery Preferences
        </h1>
        <p className="text-wl-text-secondary">
          Customize how you want to receive your deliveries
        </p>
      </section>

      {/* Success Message */}
      {saveSuccess && (
        <div className={cn(
          'bg-wl-success-bg border border-wl-success-500/30',
          'rounded-lg p-4 flex items-center gap-3'
        )}>
          <span className="text-lg">✓</span>
          <p className="text-sm text-wl-text-primary font-medium">
            Preferences saved successfully!
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Safe Place Instructions */}
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
        )}>
          <h2 className="text-xl font-bold text-wl-text-primary mb-4">
            Safe Place Instructions
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">
                Where should we leave your package?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {safeInstructions.map((instruction) => (
                  <button
                    key={instruction.value}
                    onClick={() => handleSafePlaceChange('instruction', instruction.value)}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium',
                      'transition-colors duration-fast',
                      preferences.safePlace?.instruction === instruction.value
                        ? 'bg-wl-primary-500/20 text-wl-primary-400 border border-wl-primary-500/30'
                        : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary'
                    )}
                  >
                    {instruction.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={preferences.safePlace?.customNote || ''}
                onChange={(e) => handleSafePlaceChange('customNote', e.target.value)}
                placeholder="e.g., Ring doorbell, do not knock..."
                className={cn(
                  'w-full p-3 rounded-lg border border-wl-border-subtle',
                  'bg-wl-bg-elevated text-wl-text-primary',
                  'placeholder-wl-text-tertiary',
                  'focus:outline-none focus:border-wl-primary-500',
                  'resize-none h-20'
                )}
              />
            </div>
          </div>
        </div>

        {/* Access Codes */}
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
        )}>
          <h2 className="text-xl font-bold text-wl-text-primary mb-4">
            Access Codes
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">
                Gate Code (Optional)
              </label>
              <input
                type="text"
                value={preferences.accessCodes?.gateCode || ''}
                onChange={(e) => handleAccessCodeChange('gateCode', e.target.value)}
                placeholder="e.g., 1234#"
                className={cn(
                  'w-full px-4 py-2 rounded-lg border border-wl-border-subtle',
                  'bg-wl-bg-elevated text-wl-text-primary',
                  'placeholder-wl-text-tertiary',
                  'focus:outline-none focus:border-wl-primary-500'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">
                Building Entry (Optional)
              </label>
              <input
                type="text"
                value={preferences.accessCodes?.buildingEntry || ''}
                onChange={(e) => handleAccessCodeChange('buildingEntry', e.target.value)}
                placeholder="e.g., Apt 4B"
                className={cn(
                  'w-full px-4 py-2 rounded-lg border border-wl-border-subtle',
                  'bg-wl-bg-elevated text-wl-text-primary',
                  'placeholder-wl-text-tertiary',
                  'focus:outline-none focus:border-wl-primary-500'
                )}
              />
            </div>
          </div>
        </div>

        {/* Preferred Delivery Times */}
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
        )}>
          <h2 className="text-xl font-bold text-wl-text-primary mb-4">
            Preferred Delivery Times
          </h2>

          <p className="text-sm text-wl-text-secondary mb-4">
            Set your preferred delivery windows for each day
          </p>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayLabel = dayLabels[day];
              const preferred = preferences.preferredDeliveryTimes?.find(t => t.dayOfWeek === day);

              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="w-24 text-sm font-medium text-wl-text-primary">
                    {dayLabel}
                  </label>
                  <div className="flex gap-2 flex-1">
                    <input
                      type="time"
                      value={preferred?.startTime || '10:00'}
                      onChange={(e) => handlePreferredTimeChange(day, 'startTime', e.target.value)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md border border-wl-border-subtle',
                        'bg-wl-bg-elevated text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    />
                    <span className="text-wl-text-tertiary py-2">to</span>
                    <input
                      type="time"
                      value={preferred?.endTime || '18:00'}
                      onChange={(e) => handlePreferredTimeChange(day, 'endTime', e.target.value)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md border border-wl-border-subtle',
                        'bg-wl-bg-elevated text-wl-text-primary text-sm',
                        'focus:outline-none focus:border-wl-primary-500'
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
        )}>
          <h2 className="text-xl font-bold text-wl-text-primary mb-4">
            Notification Preferences
          </h2>

          <p className="text-sm text-wl-text-secondary mb-4">
            Choose how you want to be notified about your deliveries
          </p>

          <div className="space-y-3">
            {notificationChannels.map((channel) => (
              <div
                key={channel}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  'bg-wl-bg-elevated'
                )}
              >
                <label className="text-sm font-medium text-wl-text-primary cursor-pointer">
                  {channelLabels[channel]}
                </label>
                <button
                  onClick={() => handleNotificationChange(channel, !preferences.notificationPreferences?.[channel])}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors duration-fast',
                    preferences.notificationPreferences?.[channel]
                      ? 'bg-wl-primary-500'
                      : 'bg-wl-neutral-700'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 left-1 w-4 h-4 rounded-full',
                      'bg-white transition-transform duration-fast',
                      preferences.notificationPreferences?.[channel] && 'translate-x-6'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Default Address */}
        <div className={cn(
          'bg-wl-bg-surface border border-wl-border-subtle rounded-lg p-6'
        )}>
          <h2 className="text-xl font-bold text-wl-text-primary mb-4">
            Default Address
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-wl-text-secondary mb-1">Street Address</p>
              <p className="text-wl-text-primary font-medium">
                {preferences.defaultAddress.street}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-wl-text-secondary mb-1">City</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.city}
                </p>
              </div>
              <div>
                <p className="text-wl-text-secondary mb-1">State</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.state}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-wl-text-secondary mb-1">ZIP Code</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.zipCode}
                </p>
              </div>
              <div>
                <p className="text-wl-text-secondary mb-1">Country</p>
                <p className="text-wl-text-primary font-medium">
                  {preferences.defaultAddress.country}
                </p>
              </div>
            </div>

            <button className={cn(
              'px-4 py-2 rounded-md text-sm',
              'text-wl-primary-400 hover:text-wl-primary-300',
              'transition-colors'
            )}>
              Edit Address
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3 sticky bottom-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-medium',
            'transition-colors duration-fast',
            isSaving
              ? 'bg-wl-neutral-800 text-wl-text-tertiary cursor-not-allowed'
              : 'bg-wl-primary-500 text-wl-text-inverse hover:bg-wl-primary-600'
          )}
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
