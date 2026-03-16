"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Save,
  X,
} from "lucide-react";

interface NotificationPrefs {
  [key: string]: {
    [key: string]: boolean;
  };
}

const CHANNELS = [
  { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { id: "sms", label: "SMS", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "push", label: "Push", icon: <Bell className="w-4 h-4" /> },
  { id: "whatsapp", label: "WhatsApp", icon: <Smartphone className="w-4 h-4" /> },
  { id: "in-app", label: "In-App", icon: <Bell className="w-4 h-4" /> },
];

const EVENT_CATEGORIES = [
  "Orders",
  "Deliveries",
  "Drivers",
  "System Alerts",
  "Billing",
];

const INITIAL_PREFS: NotificationPrefs = {
  email: {
    orders: true,
    deliveries: true,
    drivers: false,
    systemAlerts: true,
    billing: true,
  },
  sms: {
    orders: true,
    deliveries: true,
    drivers: true,
    systemAlerts: false,
    billing: false,
  },
  push: {
    orders: true,
    deliveries: true,
    drivers: true,
    systemAlerts: true,
    billing: false,
  },
  whatsapp: {
    orders: false,
    deliveries: false,
    drivers: false,
    systemAlerts: false,
    billing: false,
  },
  "in-app": {
    orders: true,
    deliveries: true,
    drivers: true,
    systemAlerts: true,
    billing: true,
  },
};

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [quietHours, setQuietHours] = useState({ enabled: true, start: "22:00", end: "08:00" });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Notification Preferences"
        subtitle="Configure how and when you receive notifications"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Notification Matrix */}
          <Card>
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
                    <tr className="border-b border-[var(--wl-border)]">
                      <th className="text-left py-3 px-3 font-semibold text-[var(--wl-text-primary)]">
                        Event Type
                      </th>
                      {CHANNELS.map((channel) => (
                        <th
                          key={channel.id}
                          className="text-center py-3 px-3 font-semibold text-[var(--wl-text-primary)]"
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
                        className="border-b border-[var(--wl-border)] last:border-b-0"
                      >
                        <td className="py-4 px-3 font-medium text-[var(--wl-text-primary)]">
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
                                  className="w-4 h-4 rounded border-[var(--wl-border)] text-[var(--wl-primary)] cursor-pointer"
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
          <Card>
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
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
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
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
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
              <p className="text-xs text-[var(--wl-text-secondary)]">
                Notifications will be silenced from {quietHours.start} to {quietHours.end} daily
              </p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-[var(--wl-bg-secondary)]">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                    Active Channels
                  </p>
                  <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                    {CHANNELS.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                    Total Notifications
                  </p>
                  <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                    {Object.values(preferences).reduce(
                      (sum, channel) =>
                        sum + Object.values(channel).filter(Boolean).length,
                      0
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                    Quiet Hours
                  </p>
                  <Badge variant={quietHours.enabled ? "success" : "default"}>
                    {quietHours.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
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
