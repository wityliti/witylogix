"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { cn } from "@/lib/utils";
import { ChevronRight, Send } from "lucide-react";
import Link from "next/link";
import {
  useNotificationPreferences,
  useSendTestNotification,
  type NotificationChannel,
  type NotificationCategory,
  type DigestFrequency,
} from "@/hooks/use-notifications";
import { useApiMutation } from "@/hooks/use-api";

/**
 * Notification Preferences Page
 * Features:
 * - Channel × Category matrix (6 channels × 6 categories)
 * - Toggle switches for each cell
 * - Quiet hours config (start/end time pickers per timezone)
 * - Digest settings (frequency: immediate/hourly/daily, time picker for daily)
 * - Test notification button per channel
 * - Save with optimistic update
 */

const timezoneOptions = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Asia/Tokyo", label: "Tokyo" },
];

const frequencyOptions = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
];

export default function NotificationPreferencesPage() {
  const {
    preferences,
    isLoading,
    isSaving,
    updatePreferences,
    toggleChannelCategory,
  } = useNotificationPreferences();
  const testMutation = useSendTestNotification();

  const { execute: sendTest } = useApiMutation<{ success: boolean; message: string }>(
    "POST",
    "/api/v4/notification-preferences/test",
  );

  const [isSendingTest, setIsSendingTest] = useState<
    NotificationChannel | null
  >(null);
  const [testResult, setTestResult] = useState<{
    channel: NotificationChannel;
    success: boolean;
    message: string;
  } | null>(null);

  const channels: NotificationChannel[] = [
    "EMAIL",
    "SMS",
    "PUSH",
    "WHATSAPP",
    "WEBHOOK",
    "SLACK",
  ];
  const categories: NotificationCategory[] = [
    "ORDERS",
    "DELIVERIES",
    "DRIVERS",
    "PAYMENTS",
    "SYSTEM",
    "ALERTS",
  ];

  // Local state for form
  const [quietHours, setQuietHours] = useState(
    preferences?.quietHours || {
      enabled: false,
      startTime: "22:00",
      endTime: "08:00",
      timezone: "America/New_York",
    }
  );

  const [digestSettings, setDigestSettings] = useState(
    preferences?.digestSettings || {
      enabled: false,
      frequency: "IMMEDIATE" as const,
      time: "09:00",
    }
  );

  const enabledCount = useMemo(() => {
    return (
      preferences?.channelMatrix.filter((p) => p.enabled).length || 0
    );
  }, [preferences]);

  const handleToggle = useCallback(
    async (channel: NotificationChannel, category: NotificationCategory) => {
      await toggleChannelCategory(channel, category);
    },
    [toggleChannelCategory]
  );

  const handleSave = useCallback(async () => {
    await updatePreferences({
      quietHours,
      digestSettings,
    });
  }, [quietHours, digestSettings, updatePreferences]);

  const handleTestNotification = useCallback(
    async (channel: NotificationChannel) => {
      setIsSendingTest(channel);
      try {
        const res = await sendTest({ channel });
        setTestResult({
          channel,
          success: res?.success ?? true,
          message: res?.message ?? `Test notification sent via ${channel}`,
        });
        setTimeout(() => setTestResult(null), 3000);
      } catch {
        setTestResult({
          channel,
          success: false,
          message: "Failed to send test notification",
        });
      } finally {
        setIsSendingTest(null);
      }
    },
    [sendTest]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-wl-bg-primary">
        <Header title="Notification Preferences" subtitle="Loading preferences…" />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      <Header
        title="Notification Preferences"
        subtitle="Configure how and when you receive notifications"
        actions={
          <Link href="/notifications">
            <Button variant="secondary" size="sm">
              <ChevronRight className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Channel × Category Matrix */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Choose which channels you want to receive notifications for
                each category ({enabledCount} enabled)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left py-3 px-4 font-semibold text-white">
                        Channel
                      </th>
                      {categories.map((cat) => (
                        <th
                          key={cat}
                          className="text-center py-3 px-4 font-semibold text-wl-text-muted text-xs uppercase tracking-wide"
                        >
                          {cat}
                        </th>
                      ))}
                      <th className="text-center py-3 px-4 font-semibold text-wl-text-muted text-xs">
                        Test
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => {
                      const channelPrefs =
                        preferences?.channelMatrix.filter(
                          (p) => p.channel === channel
                        ) || [];
                      const enabledForChannel = channelPrefs.filter(
                        (p) => p.enabled
                      ).length;

                      return (
                        <tr
                          key={channel}
                          className="border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors"
                        >
                          <td className="py-4 px-4 font-medium text-white">
                            {channel}
                          </td>

                          {categories.map((category) => {
                            const pref =
                              preferences?.channelMatrix.find(
                                (p) =>
                                  p.channel === channel &&
                                  p.category === category
                              ) || { enabled: true };

                            return (
                              <td
                                key={`${channel}-${category}`}
                                className="text-center py-4 px-4"
                              >
                                <Switch
                                  checked={pref.enabled}
                                  onChange={() =>
                                    handleToggle(channel, category)
                                  }
                                />
                              </td>
                            );
                          })}

                          <td className="text-center py-4 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleTestNotification(channel)
                              }
                              disabled={
                                isSendingTest === channel ||
                                enabledForChannel === 0
                              }
                              title={
                                enabledForChannel === 0
                                  ? "Enable at least one category for this channel"
                                  : "Send test notification"
                              }
                            >
                              {isSendingTest === channel ? (
                                "..."
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </Button>
                            {testResult?.channel === channel && (
                              <div className="mt-1">
                                <Badge
                                  variant={
                                    testResult.success
                                      ? "success"
                                      : "danger"
                                  }
                                  className="text-xs"
                                >
                                  {testResult.success
                                    ? "Sent"
                                    : "Failed"}
                                </Badge>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>
                Pause notifications during specific hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">
                    Enable Quiet Hours
                  </h4>
                  <p className="text-sm text-wl-text-secondary">
                    Stop receiving notifications during your preferred hours
                  </p>
                </div>
                <Switch
                  checked={quietHours.enabled}
                  onChange={(enabled) =>
                    setQuietHours((prev) => ({
                      ...prev,
                      enabled,
                    }))
                  }
                />
              </div>

              {quietHours.enabled && (
                <div className="space-y-4 p-4 bg-[#0a0a0f] rounded-lg border border-wl-border-default">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Start Time
                      </label>
                      <Input
                        type="time"
                        value={quietHours.startTime}
                        onChange={(e) =>
                          setQuietHours((prev) => ({
                            ...prev,
                            startTime: e.target.value,
                          }))
                        }
                        className="bg-wl-bg-overlay border-wl-border-default text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        End Time
                      </label>
                      <Input
                        type="time"
                        value={quietHours.endTime}
                        onChange={(e) =>
                          setQuietHours((prev) => ({
                            ...prev,
                            endTime: e.target.value,
                          }))
                        }
                        className="bg-wl-bg-overlay border-wl-border-default text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Timezone
                      </label>
                      <select
                        value={quietHours.timezone}
                        onChange={(e) =>
                          setQuietHours((prev) => ({
                            ...prev,
                            timezone: e.target.value,
                          }))
                        }
                        className={cn(
                          "w-full px-4 py-2 rounded-md",
                          "bg-wl-bg-overlay border border-wl-border-default",
                          "text-white",
                          "focus:outline-none focus:border-blue-500",
                          "transition-colors duration-fast"
                        )}
                      >
                        {timezoneOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Digest Settings */}
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle>Digest Settings</CardTitle>
              <CardDescription>
                Receive a summary of notifications instead of individual ones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white">
                    Enable Digest
                  </h4>
                  <p className="text-sm text-wl-text-secondary">
                    Receive notifications in a consolidated email or report
                  </p>
                </div>
                <Switch
                  checked={digestSettings.enabled}
                  onChange={(enabled) =>
                    setDigestSettings((prev) => ({
                      ...prev,
                      enabled,
                    }))
                  }
                />
              </div>

              {digestSettings.enabled && (
                <div className="space-y-4 p-4 bg-[#0a0a0f] rounded-lg border border-wl-border-default">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Frequency
                      </label>
                      <select
                        value={digestSettings.frequency}
                        onChange={(e) =>
                          setDigestSettings((prev) => ({
                            ...prev,
                            frequency: e.target.value as DigestFrequency,
                          }))
                        }
                        className={cn(
                          "w-full px-4 py-2 rounded-md",
                          "bg-wl-bg-overlay border border-wl-border-default",
                          "text-white",
                          "focus:outline-none focus:border-blue-500",
                          "transition-colors duration-fast"
                        )}
                      >
                        {frequencyOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {digestSettings.frequency === "DAILY" && (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Delivery Time
                        </label>
                        <Input
                          type="time"
                          value={digestSettings.time || "09:00"}
                          onChange={(e) =>
                            setDigestSettings((prev) => ({
                              ...prev,
                              time: e.target.value,
                            }))
                          }
                          className="bg-wl-bg-overlay border-wl-border-default text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Link href="/notifications">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
