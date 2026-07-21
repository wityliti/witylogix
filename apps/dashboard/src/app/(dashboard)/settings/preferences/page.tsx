'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Save,
  MapPin,
  Globe,
  Calendar,
  Weight,
} from 'lucide-react';

interface UserPreferences {
  timezone: string;
  language: string;
  dateFormat: string;
  distanceUnit: string;
  weightUnit: string;
  dashboardView: string;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
  { value: "UTC", label: "UTC" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY" },
];

export default function PreferencesPage() {
  const { addToast } = useToast();
  const { data: prefs, loading, error, refetch } = useApiQuery<UserPreferences>('/api/v4/settings/preferences');
  const { execute: updatePrefs } = useApiMutation('PATCH', '/api/v4/settings/preferences');

  const [preferences, setPreferences] = useState(prefs || {
    timezone: 'America/New_York',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    distanceUnit: 'miles',
    weightUnit: 'lbs',
    dashboardView: 'grid',
  });

  const [isSaving, setIsSaving] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const detectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setPreferences({ ...preferences, timezone: detected });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePrefs(preferences);
      refetch();
      addToast({ type: 'success', title: 'Preferences saved' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to save preferences', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Dashboard Preferences"
        subtitle="Customize your dashboard experience"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Location & Timezone */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-wl-text-primary">
                <MapPin className="w-5 h-5" />
                Location & Timezone
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">Set your timezone for accurate scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Timezone
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                  className="w-full px-3 py-2 bg-wl-bg-root text-white border border-wl-border-default rounded-md text-sm"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={detectTimezone}
              >
                Auto-Detect Timezone
              </Button>
            </CardContent>
          </Card>

          {/* Language & Regional */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-wl-text-primary">
                <Globe className="w-5 h-5" />
                Language & Regional
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">Choose your preferred language and date format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  className="w-full px-3 py-2 bg-wl-bg-root text-white border border-wl-border-default rounded-md text-sm"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Date Format
                </label>
                <select
                  value={preferences.dateFormat}
                  onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 bg-wl-bg-root text-white border border-wl-border-default rounded-md text-sm"
                >
                  {DATE_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Units & Measurements */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-wl-text-primary">
                <Weight className="w-5 h-5" />
                Units & Measurements
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">Set your preferred units for distance and weight</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Distance Unit
                </label>
                <div className="flex gap-4">
                  {[
                    { value: "miles", label: "Miles (mi)" },
                    { value: "kilometers", label: "Kilometers (km)" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="distance"
                        value={option.value}
                        checked={preferences.distanceUnit === option.value}
                        onChange={(e) => setPreferences({ ...preferences, distanceUnit: e.target.value })}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-wl-text-secondary">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Weight Unit
                </label>
                <div className="flex gap-4">
                  {[
                    { value: "lbs", label: "Pounds (lbs)" },
                    { value: "kg", label: "Kilograms (kg)" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="weight"
                        value={option.value}
                        checked={preferences.weightUnit === option.value}
                        onChange={(e) => setPreferences({ ...preferences, weightUnit: e.target.value })}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-wl-text-secondary">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Display */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-wl-text-primary">
                <Calendar className="w-5 h-5" />
                Dashboard Display
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">Customize your default dashboard view</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Default Dashboard View
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: "grid", label: "Grid View" },
                    { value: "list", label: "List View" },
                    { value: "calendar", label: "Calendar View" },
                    { value: "map", label: "Map View" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "p-3 border border-wl-border-default rounded-lg cursor-pointer transition-all",
                        preferences.dashboardView === option.value
                          ? "border-wl-info-500 bg-wl-info-500/10"
                          : "hover:border-wl-border-strong"
                      )}
                    >
                      <input
                        type="radio"
                        name="dashboard"
                        value={option.value}
                        checked={preferences.dashboardView === option.value}
                        onChange={(e) => setPreferences({ ...preferences, dashboardView: e.target.value })}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-white ml-2">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary">Reset to Defaults</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
