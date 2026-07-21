'use client';

import { useState, useEffect } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ChevronLeft, Clock, MapPin, DollarSign, Save, RefreshCw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface ShopProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  settings?: Record<string, unknown>;
}

interface GeneralConfig {
  timezone?: string;
  currency?: string;
  weightUnit?: string;
  distanceUnit?: string;
  language?: string;
  dateFormat?: string;
  businessHours?: Array<{ day: string; open: string; close: string; closed: boolean }>;
}

const DEFAULT_HOURS: Array<{ day: string; open: string; close: string; closed: boolean }> = [
  { day: 'Monday', open: '09:00', close: '18:00', closed: false },
  { day: 'Tuesday', open: '09:00', close: '18:00', closed: false },
  { day: 'Wednesday', open: '09:00', close: '18:00', closed: false },
  { day: 'Thursday', open: '09:00', close: '18:00', closed: false },
  { day: 'Friday', open: '09:00', close: '18:00', closed: false },
  { day: 'Saturday', open: '10:00', close: '16:00', closed: false },
  { day: 'Sunday', open: '09:00', close: '17:00', closed: true },
];

// ── Page ───────────────────────────────────────────────────────────
export default function GeneralSettingsPage() {
  const { data: shop, loading: shopLoading, error: shopError, refetch: refetchShop } =
    useApiQuery<{ data: ShopProfile }>('/api/v4/shops/me');
  const { data: generalConfig, loading: configLoading, error: configError, refetch: refetchConfig } =
    useApiQuery<GeneralConfig>('/api/v4/settings/general');

  const { execute: updateShop, loading: saving } = useApiMutation<ShopProfile>('PATCH', '/api/v4/shops/me');
  const { execute: updateConfig } = useApiMutation('PATCH', '/api/v4/settings/general');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const profile = shop?.data ?? (shop as unknown as ShopProfile);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
      setTimezone(profile.timezone ?? generalConfig?.timezone ?? 'UTC');
      setCurrency(profile.currency ?? generalConfig?.currency ?? 'USD');
    }
    if (generalConfig) {
      setWeightUnit(generalConfig.weightUnit ?? 'kg');
      setDistanceUnit(generalConfig.distanceUnit ?? 'km');
    }
  }, [profile, generalConfig]);

  const loading = shopLoading || configLoading;
  const error = shopError || configError;

  const businessHours = generalConfig?.businessHours ?? DEFAULT_HOURS;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={() => { refetchShop(); refetchConfig(); }} />;

  async function handleSave() {
    setSaveError(null);
    setSaved(false);
    try {
      await Promise.all([
        updateShop({ name, email: email || null, phone: phone || null, timezone, currency }),
        updateConfig({ timezone, currency, weightUnit, distanceUnit }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="General Settings"
        subtitle="Configure your tenant information and preferences"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button variant="ghost" className="mb-8 text-wl-text-secondary hover:text-wl-text-primary">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Company Information */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-wl-text-primary">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your company name"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="support@yourcompany.com"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">
                Support Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Localization */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <DollarSign className="w-5 h-5" />
              Localization &amp; Units
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                >
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Default Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                >
                  <option value="USD">USD – US Dollar</option>
                  <option value="EUR">EUR – Euro</option>
                  <option value="GBP">GBP – British Pound</option>
                  <option value="CAD">CAD – Canadian Dollar</option>
                  <option value="AUD">AUD – Australian Dollar</option>
                  <option value="JPY">JPY – Japanese Yen</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Weight Unit
                </label>
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lb">Pounds (lb)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Distance Unit
                </label>
                <select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                >
                  <option value="km">Kilometers (km)</option>
                  <option value="mi">Miles (mi)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Clock className="w-5 h-5" />
              Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {businessHours.map((day, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-wl-text-primary">{day.day}</p>
                  </div>
                  {day.closed ? (
                    <Badge variant="default">Closed</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        defaultValue={day.open}
                        className="px-3 py-1 text-sm rounded border border-wl-border-default bg-wl-bg-root text-wl-text-primary"
                      />
                      <span className="text-wl-text-secondary">to</span>
                      <input
                        type="time"
                        defaultValue={day.close}
                        className="px-3 py-1 text-sm rounded border border-wl-border-default bg-wl-bg-root text-wl-text-primary"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error + Action Buttons */}
        {saveError && (
          <p className="text-wl-danger-400 text-sm mb-4">{saveError}</p>
        )}

        <div className="flex gap-4 justify-end">
          <Button
            variant="secondary"
            className="border-wl-border-default text-wl-text-secondary hover:bg-wl-bg-elevated"
            onClick={() => { refetchShop(); refetchConfig(); }}
            disabled={saving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
