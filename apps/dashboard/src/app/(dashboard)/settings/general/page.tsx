'use client';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ChevronLeft, Clock, MapPin, DollarSign, Weight } from 'lucide-react';

interface GeneralSettings {
  companyName: string;
  industry: string;
  description: string;
  supportEmail: string;
  supportPhone: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  address: string;
  timezone: string;
  language: string;
  currency: string;
  weightUnit: string;
  distanceUnit: string;
  dateFormat: string;
  businessHours: Array<{ day: string; open: string; close: string; closed: boolean }>;
}

export default function GeneralSettingsPage() {
  const { data: settings, loading, error, refetch } = useApiQuery<GeneralSettings>('/api/v4/settings/general');
  const { execute: updateSettings } = useApiMutation('PATCH', '/api/v4/settings/general');

  const businessHours = settings?.businessHours ?? [
    { day: "Monday", open: "09:00 AM", close: "06:00 PM", closed: false },
    { day: "Tuesday", open: "09:00 AM", close: "06:00 PM", closed: false },
    { day: "Wednesday", open: "09:00 AM", close: "06:00 PM", closed: false },
    { day: "Thursday", open: "09:00 AM", close: "06:00 PM", closed: false },
    { day: "Friday", open: "09:00 AM", close: "06:00 PM", closed: false },
    { day: "Saturday", open: "10:00 AM", close: "04:00 PM", closed: false },
    { day: "Sunday", open: "Closed", close: "", closed: true },
  ];

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="General Settings"
        subtitle="Configure your tenant information and preferences"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-wl-text-secondary hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Company Information */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  defaultValue="Witylogix Inc."
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  defaultValue="Logistics & Supply Chain"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Company Description
              </label>
              <textarea
                rows={3}
                defaultValue="Leading provider of logistics management solutions for modern supply chains."
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  defaultValue="support@witylogix.com"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Support Phone
                </label>
                <input
                  type="tel"
                  defaultValue="+1 (555) 123-4567"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MapPin className="w-5 h-5" />
              Regional Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Country
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Australia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  State / Province
                </label>
                <input
                  type="text"
                  defaultValue="California"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  City
                </label>
                <input
                  type="text"
                  defaultValue="San Francisco"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  defaultValue="94105"
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Address
              </label>
              <input
                type="text"
                defaultValue="123 Logistics Boulevard, Suite 456"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Localization */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5" />
              Localization & Units
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Timezone
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>America/Los_Angeles</option>
                  <option>America/Chicago</option>
                  <option>America/New_York</option>
                  <option>Europe/London</option>
                  <option>Asia/Tokyo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Language
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Default Currency
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>USD - US Dollar</option>
                  <option>EUR - Euro</option>
                  <option>GBP - British Pound</option>
                  <option>CAD - Canadian Dollar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Weight Unit
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>Pounds (lbs)</option>
                  <option>Kilograms (kg)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Distance Unit
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>Miles (mi)</option>
                  <option>Kilometers (km)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Date Format
                </label>
                <select className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
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
                    <p className="font-medium text-white">
                      {day.day}
                    </p>
                  </div>
                  {day.closed ? (
                    <Badge variant="default">Closed</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        defaultValue={day.open.replace(/[AP]M/, "").trim()}
                        className="px-3 py-1 text-sm rounded border border-wl-border-default bg-wl-bg-root text-white"
                      />
                      <span className="text-wl-text-secondary">to</span>
                      <input
                        type="time"
                        defaultValue={day.close.replace(/[AP]M/, "").trim()}
                        className="px-3 py-1 text-sm rounded border border-wl-border-default bg-wl-bg-root text-white"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="secondary"
            className="border-wl-border-default text-white hover:bg-wl-bg-elevated"
          >
            Cancel
          </Button>
          <Button variant="primary" className="bg-wl-info-500 hover:bg-wl-primary-600">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
