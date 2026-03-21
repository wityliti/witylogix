'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Save,
  X,
} from 'lucide-react';

interface NotificationPrefs {
  [key: string]: {
    [key: string]: boolean;
  };
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

interface NotificationSettings {
  preferences: NotificationPrefs;
  quietHours: QuietHours;
}

const CHANNELS = [
  { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { id: 'sms', label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'push', label: 'Push', icon: <Bell className="w-4 h-4" /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'in-app', label: 'In-App', icon: <Bell className="w-4 h-4" /> },
];

const EVENT_CATEGORIES = [
  'Orders',
  'Deliveries',
  'Drivers',
  'System Alerts',
  'Billing',
];

export default function NotificationsPage() {
  const { data: settings, loading, error, refetch } = useApiQuery<NotificationSettings>('/api/v4/settings/notifications');
  const { execute: updateSettings } = useApiMutation('PATCH', '/api/v4/settings/notifications');

  const [preferences, setPreferences] = useState<NotificationPrefs>(settings?.preferences ?? {});
  const [quietHours, setQuietHours] = useState<QuietHours>(settings?.quietHours ?? { enabled: true, start: '22:00', end: '08:00' });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const handlePreferenceChange = (channel: string, category: string) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [category]: !prev[channel][category],
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Notification Preferences"
        subtitle="Configure how and when you receive notifications"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Notification Matrix */}
          <Card className="border border-[#1e1e2e] bg-[#12121a]">
            <CardHeader>
              <CardTitle>Notification Channels & Preferences</CardTitle>
              <CardDescription>
                Choose which notification channels to use for different event types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="text-left py-3 px-3 font-semibold text-white">
                        Event Type
                      </th>
                      {CHANNELS.map((channel) => (
                        <th
                          key={channel.id}
                          className="text-center py-3 px-3 font-semibold text-white"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {channel.icon}
                            <span className="hidden sm:inline">{channel.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EVENT_CATEGORIES.map((category) => (
                      <tr
                        key={category}
                        className="border-b border-[#1e1e2e] last:border-b-0"
                      >
                        <td className="py-4 px-3 font-medium text-white">
                          {category}
                        </td>
                        {CHANNELS.map((channel) => {
                          const categoryKey = category.toLowerCase().replace(/\s+/g, "");
                          const isChecked = preferences[channel.id]?.[categoryKey] ?? false;
                          return (
                            <td key={`${channel.id}-${category}`} className="text-center py-4 px-3">
                              <label className="flex justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePreferenceChange(channel.id, categoryKey)}
                                  className="w-4 h-4 rounded border-[#1e1e2e] text-blue-500 cursor-pointer"
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="border border-[#1e1e2e] bg-[#12121a]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Quiet Hours</CardTitle>
                  <CardDescription>
                    Pause notifications during specific hours each day
                  </CardDescription>
                </div>
                <Switch
                  checked={quietHours.enabled}
                  onChange={(checked) => {
                    setQuietHours({ ...quietHours, enabled: checked });
                    setHasChanges(true);
                  }}
                  size="md"
                />
              </div>
            </CardHeader>
            <CardContent
              className={cn(
                "space-y-4 transition-opacity",
                !quietHours.enabled && "opacity-50 pointer-events-none"
              )}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Start Time
                  </label>
                  <Input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => {
                      setQuietHours({ ...quietHours, start: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    End Time
                  </label>
                  <Input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => {
                      setQuietHours({ ...quietHours, end: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Notifications will be silenced from {quietHours.start} to {quietHours.end} daily
              </p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-[#1a1a2e] border border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Active Channels
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {CHANNELS.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Total Notifications
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {Object.values(preferences).reduce(
                      (sum, channel) =>
                        sum + Object.values(channel).filter(Boolean).length,
                      0
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Quiet Hours
                  </p>
                  <Badge variant={quietHours.enabled ? "success" : "default"}>
                    {quietHours.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Status
                  </p>
                  <Badge variant="success">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" disabled={!hasChanges}>
              <X className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
