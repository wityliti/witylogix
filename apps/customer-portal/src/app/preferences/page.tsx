'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Save, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoader, ErrorMessage } from '@/components/loading-skeleton';
import { useQuery, useMutation } from '@/lib/use-api';
import type { ApiUserProfile } from '@/lib/portal-api';
import { ROUTES } from '@/lib/portal-api';
import type { CustomerPreferences, NotificationChannel } from '@/types';

// ─── Envelopes ────────────────────────────────────────────────

interface ProfileEnvelope {
  data: ApiUserProfile;
  preferences?: CustomerPreferences;
}

// ─── Notification channels ────────────────────────────────────

const NOTIFICATION_CHANNELS: { id: NotificationChannel; label: string; description: string }[] = [
  { id: 'email', label: 'Email', description: 'Status updates and delivery confirmations' },
  { id: 'sms', label: 'SMS', description: 'Quick updates via text message' },
  { id: 'push', label: 'Push Notifications', description: 'Real-time alerts on your device' },
];

// ─── Component ────────────────────────────────────────────────

export default function PreferencesPage() {
  const { data: envelope, loading, error, refetch } = useQuery<ProfileEnvelope>(
    ROUTES.AUTH_ME,
  );

  const profile = envelope?.data;

  // Local form state seeded from API
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifications, setNotifications] = useState<Partial<Record<NotificationChannel, boolean>>>(
    {
      email: true,
      sms: false,
      push: false,
    },
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Seed form once profile loads
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
  }, [profile]);

  const { mutate: saveProfile, loading: saving, error: saveError } = useMutation<ProfileEnvelope>(
    ROUTES.AUTH_ME,
    'PATCH',
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveProfile({ name: name.trim(), phone: phone.trim() || null });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error shown via saveError
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <div className="page-container"><ErrorMessage message={error.message} onRetry={refetch} /></div>;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Preferences</h1>
        <p className="page-subtitle">Manage your profile and notification settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Profile section */}
        <form onSubmit={handleSave} className="section-card stagger-1 flex flex-col gap-5">
          <div className="flex items-center gap-2 mb-1">
            <User size={18} className="text-wl-primary-500" />
            <h2 className="font-semibold text-wl-text-primary">Profile</h2>
          </div>

          <div>
            <label htmlFor="pref-name" className="label block mb-2">
              Display Name
            </label>
            <input
              id="pref-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="input w-full"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="pref-email" className="label block mb-2">
              Email
            </label>
            <input
              id="pref-email"
              type="email"
              value={profile?.email ?? ''}
              readOnly
              className="input w-full opacity-60 cursor-not-allowed"
              title="Email cannot be changed here"
            />
            <p className="mt-1 text-xs text-wl-text-tertiary">
              Contact support to update your email address.
            </p>
          </div>

          <div>
            <label htmlFor="pref-phone" className="label block mb-2">
              Phone Number
            </label>
            <input
              id="pref-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="input w-full"
              maxLength={30}
            />
          </div>

          {saveError && (
            <p className="text-sm text-wl-error-500">{saveError.message}</p>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-wl-success-500 animate-fade-in">
              <Check size={16} />
              Profile saved!
            </div>
          )}

          <div className="flex gap-3 mt-1">
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'btn btn-primary',
                saving && 'opacity-50 cursor-not-allowed',
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Profile
                </>
              )}
            </button>
          </div>
        </form>

        {/* Notification preferences */}
        <div className="section-card stagger-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={18} className="text-wl-primary-500" />
            <h2 className="font-semibold text-wl-text-primary">Notifications</h2>
          </div>
          <p className="text-sm text-wl-text-secondary -mt-2">
            Choose how you want to receive delivery updates.
          </p>

          {NOTIFICATION_CHANNELS.map((channel) => (
            <label
              key={channel.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                notifications[channel.id]
                  ? 'border-wl-primary-500 bg-wl-bg-elevated'
                  : 'border-wl-border-subtle hover:border-wl-border-default',
              )}
            >
              <input
                type="checkbox"
                checked={notifications[channel.id] ?? false}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    [channel.id]: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-wl-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-wl-text-primary">{channel.label}</p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">{channel.description}</p>
              </div>
            </label>
          ))}

          <p className="text-xs text-wl-text-tertiary mt-2">
            Notification channel preferences are saved per delivery — configure them in the tracking
            view for each active order.
          </p>
        </div>
      </div>
    </div>
  );
}
