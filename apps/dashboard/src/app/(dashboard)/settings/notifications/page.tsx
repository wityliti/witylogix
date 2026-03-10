"use client";

import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import {
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  X,
} from "lucide-react";

type Provider = "smtp" | "sendgrid" | "ses" | "twilio" | "vonage" | "meta" | "firebase" | "onesignal";

interface ChannelConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
  provider: Provider | null;
  credentials: Record<string, string>;
  rateLimit: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
}

interface NotificationSettings {
  defaultSender: {
    fromEmail: string;
    fromPhone: string;
    businessName: string;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  channels: Record<string, ChannelConfig>;
}

const INITIAL_SETTINGS: NotificationSettings = {
  defaultSender: {
    fromEmail: "noreply@example.com",
    fromPhone: "+1234567890",
    businessName: "Witylogix",
  },
  quietHours: {
    enabled: true,
    startTime: "22:00",
    endTime: "08:00",
    timezone: "UTC",
  },
  channels: {
    email: {
      id: "email",
      name: "Email",
      icon: <Mail className="w-5 h-5" />,
      enabled: true,
      provider: "sendgrid",
      credentials: {
        apiKey: "****************************",
        senderEmail: "noreply@example.com",
      },
      rateLimit: { perMinute: 100, perHour: 5000, perDay: 50000 },
    },
    sms: {
      id: "sms",
      name: "SMS",
      icon: <MessageSquare className="w-5 h-5" />,
      enabled: true,
      provider: "twilio",
      credentials: {
        accountSid: "****************************",
        authToken: "****************************",
        fromNumber: "+1234567890",
      },
      rateLimit: { perMinute: 10, perHour: 500, perDay: 5000 },
    },
    whatsapp: {
      id: "whatsapp",
      name: "WhatsApp",
      icon: <MessageSquare className="w-5 h-5" />,
      enabled: false,
      provider: "meta",
      credentials: {
        businessAccountId: "",
        phoneNumberId: "",
        accessToken: "****************************",
      },
      rateLimit: { perMinute: 5, perHour: 100, perDay: 1000 },
    },
    push: {
      id: "push",
      name: "Push Notifications",
      icon: <Bell className="w-5 h-5" />,
      enabled: true,
      provider: "firebase",
      credentials: {
        projectId: "",
        privateKey: "****************************",
        clientEmail: "",
      },
      rateLimit: { perMinute: 200, perHour: 10000, perDay: 100000 },
    },
  },
};

interface RevealedCredentials {
  [key: string]: boolean;
}

interface UnsavedChanges {
  [key: string]: boolean;
}

const ChannelConfigCard = ({
  channel,
  onChannelUpdate,
  onTestSend,
  revealedCredentials,
  onToggleReveal,
}: {
  channel: ChannelConfig;
  onChannelUpdate: (channelId: string, updates: Partial<ChannelConfig>) => void;
  onTestSend: (channelId: string) => void;
  revealedCredentials: RevealedCredentials;
  onToggleReveal: (key: string) => void;
}) => {
  const providers: Record<string, Provider[]> = {
    email: ["smtp", "sendgrid", "ses"],
    sms: ["twilio", "vonage"],
    whatsapp: ["meta", "twilio"],
    push: ["firebase", "onesignal"],
  };

  const getProviderLabel = (provider: Provider) => {
    const labels: Record<Provider, string> = {
      smtp: "SMTP",
      sendgrid: "SendGrid",
      ses: "AWS SES",
      twilio: "Twilio",
      vonage: "Vonage",
      meta: "Meta (WhatsApp Business)",
      firebase: "Firebase Cloud Messaging",
      onesignal: "OneSignal",
    };
    return labels[provider];
  };

  const credentialFields: Record<Provider, string[]> = {
    smtp: ["host", "port", "username", "password"],
    sendgrid: ["apiKey"],
    ses: ["accessKeyId", "secretAccessKey", "region"],
    twilio: ["accountSid", "authToken", "fromNumber"],
    vonage: ["apiKey", "apiSecret", "fromNumber"],
    meta: ["businessAccountId", "phoneNumberId", "accessToken"],
    firebase: ["projectId", "privateKey", "clientEmail"],
    onesignal: ["appId", "apiKey"],
  };

  const availableProviders = providers[channel.id] || [];

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
                Configure {channel.name.toLowerCase()} settings and credentials
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={channel.enabled}
            onChange={(checked) =>
              onChannelUpdate(channel.id, { enabled: checked })
            }
            size="md"
          />
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "space-y-6 transition-opacity",
          !channel.enabled && "opacity-50 pointer-events-none"
        )}
      >
        {/* Provider Selection */}
        <div>
          <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
            Provider
          </label>
          <select
            value={channel.provider || ""}
            onChange={(e) =>
              onChannelUpdate(channel.id, {
                provider: e.target.value as Provider,
              })
            }
            disabled={!channel.enabled}
            className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a provider</option>
            {availableProviders.map((provider) => (
              <option key={provider} value={provider}>
                {getProviderLabel(provider)}
              </option>
            ))}
          </select>
        </div>

        {/* Credentials */}
        {channel.provider && (
          <div className="space-y-3 p-4 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide">
              Credentials
            </p>
            {(credentialFields[channel.provider] || []).map((field) => {
              const credKey = `${channel.id}_${field}`;
              const isRevealed = revealedCredentials[credKey];
              const value = channel.credentials[field] || "";

              return (
                <div key={field}>
                  <label className="text-xs text-[var(--wl-text-secondary)] block mb-1">
                    {field
                      .split(/(?=[A-Z])/)
                      .join(" ")
                      .replace(/^\w/, (c) => c.toUpperCase())}
                  </label>
                  <div className="relative">
                    <Input
                      type={isRevealed ? "text" : "password"}
                      value={value}
                      onChange={(e) =>
                        onChannelUpdate(channel.id, {
                          credentials: {
                            ...channel.credentials,
                            [field]: e.target.value,
                          },
                        })
                      }
                      placeholder={`Enter ${field}`}
                      className="pr-10"
                    />
                    <button
                      onClick={() => onToggleReveal(credKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
                    >
                      {isRevealed ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rate Limits */}
        <div className="space-y-3 p-4 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]">
          <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide">
            Rate Limits
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[var(--wl-text-secondary)] block mb-1">
                Per Minute
              </label>
              <Input
                type="number"
                value={channel.rateLimit.perMinute}
                onChange={(e) =>
                  onChannelUpdate(channel.id, {
                    rateLimit: {
                      ...channel.rateLimit,
                      perMinute: parseInt(e.target.value) || 0,
                    },
                  })
                }
                min="1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--wl-text-secondary)] block mb-1">
                Per Hour
              </label>
              <Input
                type="number"
                value={channel.rateLimit.perHour}
                onChange={(e) =>
                  onChannelUpdate(channel.id, {
                    rateLimit: {
                      ...channel.rateLimit,
                      perHour: parseInt(e.target.value) || 0,
                    },
                  })
                }
                min="1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--wl-text-secondary)] block mb-1">
                Per Day
              </label>
              <Input
                type="number"
                value={channel.rateLimit.perDay}
                onChange={(e) =>
                  onChannelUpdate(channel.id, {
                    rateLimit: {
                      ...channel.rateLimit,
                      perDay: parseInt(e.target.value) || 0,
                    },
                  })
                }
                min="1"
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-[var(--wl-border)]">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onTestSend(channel.id)}
          disabled={!channel.enabled || !channel.provider}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Test Send
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(INITIAL_SETTINGS);
  const [revealedCredentials, setRevealedCredentials] = useState<RevealedCredentials>({});
  const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChanges>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = Object.values(unsavedChanges).some((v) => v);

  const handleChannelUpdate = (
    channelId: string,
    updates: Partial<ChannelConfig>
  ) => {
    setSettings((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channelId]: {
          ...prev.channels[channelId],
          ...updates,
        },
      },
    }));
    setUnsavedChanges((prev) => ({ ...prev, [channelId]: true }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setUnsavedChanges({});
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(INITIAL_SETTINGS);
    setUnsavedChanges({});
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Notification Settings"
        subtitle="Configure notification channels and delivery settings"
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Unsaved Changes Warning */}
        {hasUnsavedChanges && (
          <div className="mb-6 p-4 bg-[var(--wl-warning)]/10 border border-[var(--wl-warning)]/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--wl-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--wl-text-primary)]">
                Unsaved Changes
              </p>
              <p className="text-xs text-[var(--wl-text-secondary)]">
                You have unsaved changes. Click save to apply them.
              </p>
            </div>
          </div>
        )}

        {/* Default Sender Config */}
        <Card className="border border-[var(--wl-border)] mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Default Sender Configuration</CardTitle>
            <CardDescription>Set default sender information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                From Email
              </label>
              <Input
                value={settings.defaultSender.fromEmail}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultSender: {
                      ...prev.defaultSender,
                      fromEmail: e.target.value,
                    },
                  }))
                }
                placeholder="noreply@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                From Phone
              </label>
              <Input
                value={settings.defaultSender.fromPhone}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultSender: {
                      ...prev.defaultSender,
                      fromPhone: e.target.value,
                    },
                  }))
                }
                placeholder="+1234567890"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                Business Name
              </label>
              <Input
                value={settings.defaultSender.businessName}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultSender: {
                      ...prev.defaultSender,
                      businessName: e.target.value,
                    },
                  }))
                }
                placeholder="Your Business Name"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours Config */}
        <Card className="border border-[var(--wl-border)] mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Quiet Hours</CardTitle>
                <CardDescription>
                  Suspend notifications during specific hours
                </CardDescription>
              </div>
              <Switch
                checked={settings.quietHours.enabled}
                onChange={(checked) =>
                  setSettings((prev) => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, enabled: checked },
                  }))
                }
              />
            </div>
          </CardHeader>
          <CardContent
            className={cn(
              "space-y-4 transition-opacity",
              !settings.quietHours.enabled && "opacity-50 pointer-events-none"
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={settings.quietHours.startTime}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours,
                        startTime: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  End Time
                </label>
                <Input
                  type="time"
                  value={settings.quietHours.endTime}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours,
                        endTime: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Timezone
                </label>
                <Input
                  value={settings.quietHours.timezone}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours,
                        timezone: e.target.value,
                      },
                    }))
                  }
                  placeholder="UTC"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Channel Configuration */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--wl-text-primary)] mb-2">
              Notification Channels
            </h2>
            <p className="text-[var(--wl-text-secondary)]">
              Configure providers, credentials, and rate limits for each channel
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.values(settings.channels).map((channel) => (
              <ChannelConfigCard
                key={channel.id}
                channel={channel}
                onChannelUpdate={handleChannelUpdate}
                onTestSend={(channelId) => {
                  console.log("Test send:", channelId);
                }}
                revealedCredentials={revealedCredentials}
                onToggleReveal={(key) => {
                  setRevealedCredentials((prev) => ({
                    ...prev,
                    [key]: !prev[key],
                  }));
                }}
              />
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <Card className="border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Active Channels
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {
                    Object.values(settings.channels).filter((c) => c.enabled)
                      .length
                  }
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Configured Providers
                </p>
                <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                  {
                    Object.values(settings.channels).filter(
                      (c) => c.provider
                    ).length
                  }
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Quiet Hours
                </p>
                <p className="text-sm text-[var(--wl-text-primary)]">
                  {settings.quietHours.enabled
                    ? `${settings.quietHours.startTime} - ${settings.quietHours.endTime}`
                    : "Disabled"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                  Status
                </p>
                <p className="inline-flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-[var(--wl-success)]" />
                  Connected
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={handleDiscard}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </main>
    </div>
  );
}
