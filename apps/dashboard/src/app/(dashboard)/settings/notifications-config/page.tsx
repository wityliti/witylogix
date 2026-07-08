'use client';

import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ChevronLeft,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Webhook,
} from 'lucide-react';

interface NotificationEvent {
  id: string;
  name: string;
  description: string;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    webhook: boolean;
  };
}

export default function NotificationsConfigPage() {
  const { items: notificationEvents, loading, error, refetch } = useApiList<NotificationEvent>('/api/v4/settings/notification-events');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const defaultEvents: NotificationEvent[] = [
    {
      id: "shipment-created",
      name: "Shipment Created",
      description: "New shipment has been created in the system",
      channels: { email: true, sms: false, push: true, webhook: true },
    },
    {
      id: "shipment-picked",
      name: "Shipment Picked Up",
      description: "Driver has picked up the shipment",
      channels: { email: true, sms: true, push: true, webhook: true },
    },
    {
      id: "shipment-in-transit",
      name: "Shipment In Transit",
      description: "Shipment is currently in transit",
      channels: { email: false, sms: false, push: true, webhook: true },
    },
    {
      id: "shipment-delivered",
      name: "Shipment Delivered",
      description: "Shipment has been successfully delivered",
      channels: { email: true, sms: true, push: true, webhook: true },
    },
    {
      id: "shipment-failed",
      name: "Delivery Failed",
      description: "Delivery attempt failed",
      channels: { email: true, sms: true, push: true, webhook: true },
    },
    {
      id: "driver-available",
      name: "Driver Available",
      description: "Driver has become available for new assignments",
      channels: { email: true, sms: false, push: false, webhook: true },
    },
    {
      id: "driver-offline",
      name: "Driver Offline",
      description: "Driver has gone offline",
      channels: { email: true, sms: true, push: true, webhook: true },
    },
    {
      id: "alert-low-balance",
      name: "Low Account Balance",
      description: "Account balance is below minimum threshold",
      channels: { email: true, sms: true, push: false, webhook: false },
    },
    {
      id: "team-invitation",
      name: "Team Invitation Sent",
      description: "Team member has been invited",
      channels: { email: true, sms: false, push: true, webhook: false },
    },
    {
      id: "api-error",
      name: "API Integration Error",
      description: "Error occurred during API call",
      channels: { email: true, sms: false, push: false, webhook: true },
    },
  ];

  const channelInfo = [
    {
      icon: Mail,
      name: 'Email',
      id: 'email',
      description: 'Send notifications via email',
    },
    {
      icon: MessageSquare,
      name: 'SMS',
      id: 'sms',
      description: 'Send notifications via SMS',
    },
    {
      icon: Smartphone,
      name: 'Push',
      id: 'push',
      description: 'Send push notifications to mobile apps',
    },
    {
      icon: Webhook,
      name: 'Webhook',
      id: 'webhook',
      description: 'Send notifications to custom webhooks',
    },
  ];
  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Notification Preferences"
        subtitle="Configure notification channels for different event types"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Channel Configuration */}
        <Card className="mb-8 border border-wl-border-default bg-wl-bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {channelInfo.map((channel) => {
                const Icon = channel.icon;
                return (
                  <div
                    key={channel.id}
                    className="p-4 rounded-lg border border-wl-border-default hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5 text-blue-500" />
                      <h4 className="font-medium text-white">
                        {channel.name}
                      </h4>
                    </div>
                    <p className="text-xs text-wl-text-secondary mb-4">
                      {channel.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-[var(--wl-border)]"
                      />
                      <span className="text-sm text-[var(--wl-text-secondary)]">
                        Enabled
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event Configuration Table */}
        <Card className="border border-wl-border-default bg-wl-bg-surface">
          <CardHeader>
            <CardTitle>Event Notification Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left py-4 px-4 font-semibold text-white">
                      Event Type
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-white">
                      <div className="flex items-center justify-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span className="hidden sm:inline">Email</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-white">
                      <div className="flex items-center justify-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">SMS</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-white">
                      <div className="flex items-center justify-center gap-1">
                        <Smartphone className="w-4 h-4" />
                        <span className="hidden sm:inline">Push</span>
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-white">
                      <div className="flex items-center justify-center gap-1">
                        <Webhook className="w-4 h-4" />
                        <span className="hidden sm:inline">Webhook</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notificationEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="border-b border-wl-border-default hover:bg-wl-bg-elevated/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-white">
                            {event.name}
                          </p>
                          <p className="text-xs text-wl-text-secondary">
                            {event.description}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={event.channels.email}
                          className="w-4 h-4 rounded border-[var(--wl-border)] cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={event.channels.sms}
                          className="w-4 h-4 rounded border-[var(--wl-border)] cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={event.channels.push}
                          className="w-4 h-4 rounded border-[var(--wl-border)] cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          defaultChecked={event.channels.webhook}
                          className="w-4 h-4 rounded border-[var(--wl-border)] cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/webhooks/notifications"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                We'll send POST requests to this URL for enabled events
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Webhook Secret
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value="••••••••••••••••"
                  disabled
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
                <Button
                  variant="secondary"
                  className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
                >
                  Regenerate
                </Button>
              </div>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Use this secret to verify webhook authenticity (HMAC-SHA256)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Retry Policy
              </label>
              <select className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                <option>Retry up to 3 times (default)</option>
                <option>Retry up to 5 times</option>
                <option>Retry up to 10 times</option>
                <option>No retry</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Test Webhook
              </label>
              <Button
                variant="secondary"
                className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
              >
                Send Test Event
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Digest Settings */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Email Digest Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Digest Frequency
              </label>
              <select className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                <option>Real-time (immediate)</option>
                <option>Hourly</option>
                <option>Daily at 9:00 AM</option>
                <option>Weekly (Mondays at 9:00 AM)</option>
                <option>Disabled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Minimum Alerts to Digest
              </label>
              <input
                type="number"
                defaultValue="5"
                min="1"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Only send digest if there are at least this many alerts
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Include in Digest
              </label>
              <div className="space-y-2">
                {[
                  "Completed Shipments",
                  "Failed Deliveries",
                  "Team Activity",
                  "System Alerts",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded border-[var(--wl-border)]"
                    />
                    <span className="text-sm text-[var(--wl-text-secondary)]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end mt-8">
          <Button
            variant="secondary"
            className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
          >
            Cancel
          </Button>
          <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90">
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
