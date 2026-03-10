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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Check,
  AlertCircle,
} from "lucide-react";

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
  types: NotificationType[];
}

interface NotificationType {
  id: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationChannel[] = [
  {
    id: "email",
    name: "Email",
    icon: <Mail className="w-5 h-5" />,
    enabled: true,
    types: [
      { id: "order-updates", label: "Order Updates", enabled: true },
      { id: "driver-alerts", label: "Driver Alerts", enabled: true },
      { id: "billing", label: "Billing & Invoices", enabled: true },
      { id: "system", label: "System Notifications", enabled: false },
    ],
  },
  {
    id: "sms",
    name: "SMS",
    icon: <MessageSquare className="w-5 h-5" />,
    enabled: true,
    types: [
      { id: "order-updates", label: "Order Updates", enabled: true },
      { id: "driver-alerts", label: "Driver Alerts", enabled: true },
      { id: "billing", label: "Billing & Invoices", enabled: false },
      { id: "system", label: "System Notifications", enabled: false },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: <MessageSquare className="w-5 h-5" />,
    enabled: false,
    types: [
      { id: "order-updates", label: "Order Updates", enabled: false },
      { id: "driver-alerts", label: "Driver Alerts", enabled: false },
      { id: "billing", label: "Billing & Invoices", enabled: false },
      { id: "system", label: "System Notifications", enabled: false },
    ],
  },
  {
    id: "push",
    name: "Push Notifications",
    icon: <Bell className="w-5 h-5" />,
    enabled: true,
    types: [
      { id: "order-updates", label: "Order Updates", enabled: true },
      { id: "driver-alerts", label: "Driver Alerts", enabled: true },
      { id: "billing", label: "Billing & Invoices", enabled: false },
      { id: "system", label: "System Notifications", enabled: true },
    ],
  },
];

// Notification Channel Component
const NotificationChannelCard = ({
  channel,
  onChannelToggle,
  onTypeToggle,
  onTestNotification,
}: {
  channel: NotificationChannel;
  onChannelToggle: (channelId: string, enabled: boolean) => void;
  onTypeToggle: (channelId: string, typeId: string, enabled: boolean) => void;
  onTestNotification: (channelId: string) => void;
}) => {
  return (
    <Card className="border border-[var(--wl-border)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--wl-bg-secondary)] rounded-lg text-[var(--wl-primary)]">
              {channel.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{channel.name}</CardTitle>
              <CardDescription>
                Manage {channel.name.toLowerCase()} notification settings
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={channel.enabled}
            onChange={(checked) => onChannelToggle(channel.id, checked)}
            size="md"
          />
        </div>
      </CardHeader>

      <CardContent className={cn(
        "space-y-4 transition-opacity",
        !channel.enabled && "opacity-50 pointer-events-none"
      )}>
        <div className="space-y-3">
          {channel.types.map((type) => (
            <label
              key={type.id}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <Checkbox
                checked={type.enabled && channel.enabled}
                onChange={(checked) => onTypeToggle(channel.id, type.id, checked as boolean)}
                disabled={!channel.enabled}
              />
              <span className="text-sm text-[var(--wl-text-primary)] group-hover:text-[var(--wl-text-primary)]">
                {type.label}
              </span>
            </label>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-[var(--wl-border)]">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onTestNotification(channel.id)}
          disabled={!channel.enabled}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Send Test
        </Button>
      </CardFooter>
    </Card>
  );
};

// Quiet Hours Component
const QuietHoursSection = ({
  quietHours,
  onQuietHoursChange,
}: {
  quietHours: { start: string; end: string; enabled: boolean };
  onQuietHoursChange: (hours: { start: string; end: string; enabled: boolean }) => void;
}) => {
  return (
    <Card className="border border-[var(--wl-border)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Quiet Hours</CardTitle>
            <CardDescription>
              Disable notifications during specific hours
            </CardDescription>
          </div>
          <Switch
            checked={quietHours.enabled}
            onChange={(checked) =>
              onQuietHoursChange({ ...quietHours, enabled: checked })
            }
            size="md"
          />
        </div>
      </CardHeader>

      <CardContent className={cn(
        "space-y-4 transition-opacity",
        !quietHours.enabled && "opacity-50 pointer-events-none"
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Start Time
            </label>
            <input
              type="time"
              value={quietHours.start}
              onChange={(e) =>
                onQuietHoursChange({ ...quietHours, start: e.target.value })
              }
              disabled={!quietHours.enabled}
              className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-[var(--wl-text-secondary)] mt-2">
              No notifications before this time
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              End Time
            </label>
            <input
              type="time"
              value={quietHours.end}
              onChange={(e) =>
                onQuietHoursChange({ ...quietHours, end: e.target.value })
              }
              disabled={!quietHours.enabled}
              className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-[var(--wl-text-secondary)] mt-2">
              Resume notifications after this time
            </p>
          </div>
        </div>

        {quietHours.enabled && (
          <div className="p-3 bg-[var(--wl-bg-secondary)] border border-[var(--wl-border)] rounded-lg flex items-start gap-3">
            <Check className="w-4 h-4 text-[var(--wl-success)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--wl-text-secondary)]">
              Quiet hours active from {quietHours.start} to {quietHours.end} daily
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Notification Preferences Page
export default function NotificationPreferencesPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>(DEFAULT_NOTIFICATIONS);
  const [quietHours, setQuietHours] = useState({
    start: "22:00",
    end: "08:00",
    enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testingSendChannel, setTestingSendChannel] = useState<string | null>(null);

  const handleChannelToggle = (channelId: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, enabled } : ch
      )
    );
  };

  const handleTypeToggle = (channelId: string, typeId: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? {
              ...ch,
              types: ch.types.map((t) =>
                t.id === typeId ? { ...t, enabled } : t
              ),
            }
          : ch
      )
    );
  };

  const handleTestNotification = (channelId: string) => {
    setTestingSendChannel(channelId);
    setTimeout(() => setTestingSendChannel(null), 2000);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Notification Preferences"
        subtitle="Configure how and when you receive notifications"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Notification Channels */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--wl-text-primary)] mb-2">
              Notification Channels
            </h2>
            <p className="text-[var(--wl-text-secondary)]">
              Choose which channels to receive notifications through
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {channels.map((channel) => (
              <NotificationChannelCard
                key={channel.id}
                channel={channel}
                onChannelToggle={handleChannelToggle}
                onTypeToggle={handleTypeToggle}
                onTestNotification={handleTestNotification}
              />
            ))}
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="mb-12">
          <QuietHoursSection
            quietHours={quietHours}
            onQuietHoursChange={setQuietHours}
          />
        </div>

        {/* Summary Card */}
        <Card className="border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)]">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Active Channels
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {channels.filter((c) => c.enabled).length}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Total Notifications
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {channels.reduce(
                    (acc, ch) =>
                      acc + ch.types.filter((t) => t.enabled && ch.enabled).length,
                    0
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Quiet Hours
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {quietHours.enabled ? quietHours.start : "Disabled"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Last Updated
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  Now
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8 justify-end">
          <Button variant="secondary">
            Reset to Default
          </Button>
          <Button
            variant="primary"
            onClick={handleSavePreferences}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </main>
    </div>
  );
}
