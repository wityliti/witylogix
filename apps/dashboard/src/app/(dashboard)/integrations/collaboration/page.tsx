'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  Settings,
  Power,
  BarChart3,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  Route,
  Radio,
  Slack,
  Send,
  Activity,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  connectedAt?: string;
  config: {
    channels?: string[];
    webhookUrl?: string;
    apiKey?: string;
  };
}

interface PresenceIndicator {
  userId: string;
  name: string;
  status: "online" | "away" | "offline" | "busy";
  lastActive: string;
}

interface MessageRoute {
  id: string;
  source: string;
  target: string;
  conditions: string[];
  enabled: boolean;
}

interface DeliveryStats {
  provider: string;
  sent: number;
  delivered: number;
  failed: number;
  avgLatency: string;
}

const providers: Provider[] = [
  {
    id: "slack",
    name: "Slack",
    icon: <Slack className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-11-15",
    lastSync: "2026-03-12 14:32",
    config: {
      channels: ["#dispatches", "#driver-alerts", "#support"],
      webhookUrl: "https://hooks.slack.com/services/T00000000/B00000000",
      apiKey: "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxx",
    },
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    icon: <MessageSquare className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-10-22",
    lastSync: "2026-03-12 14:28",
    config: {
      channels: ["Dispatches", "Operations", "Alerts"],
      webhookUrl: "https://outlook.webhook.office.com/webhookb2/xxxxx",
      apiKey: "team-api-key-xxxxx",
    },
  },
  {
    id: "pusher",
    name: "Pusher Channels",
    icon: <Send className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-09-10",
    lastSync: "2026-03-12 14:35",
    config: {
      channels: ["shipments", "drivers", "notifications"],
      webhookUrl: "https://api.pusher.com/apps/xxxxx/events",
      apiKey: "pusher-key-xxxxxxxxxxxxx",
    },
  },
  {
    id: "trackpod",
    name: "Track-POD",
    icon: <Activity className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-08-05",
    lastSync: "2026-03-12 14:30",
    config: {
      channels: ["POD-status", "delivery-updates"],
      webhookUrl: "https://trackpod.com/api/webhooks/xxxxx",
      apiKey: "trackpod-api-key-xxxxx",
    },
  },
  {
    id: "dispatchtrack",
    name: "DispatchTrack",
    icon: <Route className="w-5 h-5" />,
    status: "disconnected",
    config: {
      channels: [],
      webhookUrl: "",
      apiKey: "",
    },
  },
  {
    id: "podium",
    name: "Podium",
    icon: <Users className="w-5 h-5" />,
    status: "error",
    lastSync: "2026-03-11 09:15",
    config: {
      channels: ["reviews", "feedback"],
      webhookUrl: "https://api.podium.com/webhooks/xxxxx",
      apiKey: "podium-key-xxxxx",
    },
  },
  {
    id: "workwave",
    name: "WorkWave",
    icon: <Radio className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-07-18",
    lastSync: "2026-03-12 14:33",
    config: {
      channels: ["routes", "crew-comms"],
      webhookUrl: "https://api.workwave.com/webhooks/xxxxx",
      apiKey: "workwave-api-xxxxx",
    },
  },
];

const presenceIndicators: PresenceIndicator[] = [
  { userId: "user-001", name: "John Smith", status: "online", lastActive: "now" },
  { userId: "user-002", name: "Sarah Johnson", status: "online", lastActive: "2m ago" },
  { userId: "user-003", name: "Mike Davis", status: "away", lastActive: "15m ago" },
  { userId: "user-004", name: "Emily Brown", status: "busy", lastActive: "3m ago" },
  { userId: "user-005", name: "James Wilson", status: "offline", lastActive: "1h ago" },
  { userId: "user-006", name: "Lisa Anderson", status: "online", lastActive: "1m ago" },
];

const messageRoutes: MessageRoute[] = [
  {
    id: "route-001",
    source: "Slack",
    target: "Teams",
    conditions: ["priority=high", "type=alert"],
    enabled: true,
  },
  {
    id: "route-002",
    source: "Teams",
    target: "Slack",
    conditions: ["channel=#operations"],
    enabled: true,
  },
  {
    id: "route-003",
    source: "Slack",
    target: "Pusher",
    conditions: ["type=realtime"],
    enabled: false,
  },
  {
    id: "route-004",
    source: "Track-POD",
    target: "Slack",
    conditions: ["status=delivered"],
    enabled: true,
  },
  {
    id: "route-005",
    source: "DispatchTrack",
    target: "Teams",
    conditions: ["urgency=critical"],
    enabled: false,
  },
];

const deliveryStats: DeliveryStats[] = [
  { provider: "Slack", sent: 15432, delivered: 15398, failed: 34, avgLatency: "145ms" },
  { provider: "Teams", sent: 8921, delivered: 8867, failed: 54, avgLatency: "298ms" },
  { provider: "Pusher", sent: 142561, delivered: 142501, failed: 60, avgLatency: "52ms" },
  { provider: "Track-POD", sent: 3241, delivered: 3215, failed: 26, avgLatency: "1.2s" },
  { provider: "WorkWave", sent: 2156, delivered: 2145, failed: 11, avgLatency: "876ms" },
];

const notificationPreferences = [
  { id: "pref-001", event: "Delivery Completed", slack: true, teams: true, pusher: false, sound: true },
  { id: "pref-002", event: "Driver Alert", slack: true, teams: true, pusher: true, sound: true },
  { id: "pref-003", event: "Route Optimized", slack: false, teams: true, pusher: true, sound: false },
  { id: "pref-004", event: "Exception Occurred", slack: true, teams: true, pusher: true, sound: true },
  { id: "pref-005", event: "Task Assigned", slack: true, teams: false, pusher: false, sound: false },
];

export default function CollaborationPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    providers: true,
    presence: true,
    routes: true,
    delivery: true,
    preferences: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "connected":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "away":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "busy":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "offline":
      case "disconnected":
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="Collaboration Integrations"
        subtitle="Connect and manage team communication tools, presence, and message routing"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/integrations">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>

        {/* Providers Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("providers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Communication Providers
              </h2>
              <Badge variant="primary" className="bg-[var(--wl-primary)]/30 text-[var(--wl-primary)]">
                {providers.length} integrated
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.providers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-[var(--wl-primary)]/50",
                    selectedProvider === provider.id && "border-[var(--wl-primary)]/80 bg-[var(--wl-bg-tertiary)]"
                  )}
                  onClick={() => setSelectedProvider(selectedProvider === provider.id ? null : provider.id)}
                >
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-[var(--wl-primary)] text-2xl">{provider.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">
                            {provider.name}
                          </h3>
                          <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                            {provider.status === "connected" && `Connected on ${provider.connectedAt}`}
                            {provider.status === "disconnected" && "Not connected"}
                            {provider.status === "error" && "Connection error"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          provider.status === "connected"
                            ? "success"
                            : provider.status === "error"
                              ? "danger"
                              : "default"
                        }
                        className={cn(
                          provider.status === "connected" &&
                            "bg-green-500/20 text-green-400 border border-green-500/50",
                          provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50",
                          provider.status === "disconnected" && "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {provider.status === "connected" && (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                        {provider.status === "disconnected" && "Disconnected"}
                        {provider.status === "error" && (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Status & Sync Info */}
                    {provider.status === "connected" && (
                      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--wl-border)]">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                            Last Sync
                          </p>
                          <p className="text-sm text-[var(--wl-text-primary)] mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-green-500" />
                            {provider.lastSync}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                            Channels
                          </p>
                          <p className="text-sm text-[var(--wl-text-primary)] mt-1">
                            {provider.config.channels?.length || 0} channels
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Config Details (Expanded) */}
                    {selectedProvider === provider.id && provider.status === "connected" && (
                      <div className="space-y-4 mb-6 pb-6 border-b border-[var(--wl-border)]">
                        {provider.config.channels && provider.config.channels.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-2">
                              Connected Channels
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {provider.config.channels.map((channel) => (
                                <Badge
                                  key={channel}
                                  variant="secondary"
                                  className="bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)]"
                                >
                                  {channel}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {provider.config.webhookUrl && (
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-2">
                              Webhook URL
                            </p>
                            <div className="bg-[var(--wl-bg-secondary)] rounded-lg p-3 flex items-center justify-between font-mono text-xs">
                              <span className="text-[var(--wl-text-tertiary)] truncate">
                                {provider.config.webhookUrl.substring(0, 50)}...
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--wl-primary)] hover:bg-[var(--wl-bg-tertiary)]"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {provider.status === "connected" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Configure
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : provider.status === "error" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Presence Status Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("presence")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Team Presence Status
              </h2>
              <Badge variant="info" className="bg-blue-500/20 text-blue-400">
                Real-time
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.presence ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.presence && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presenceIndicators.map((indicator) => (
                <Card key={indicator.userId} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold", getStatusColor(indicator.status))}>
                          {indicator.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[var(--wl-text-primary)] truncate">
                            {indicator.name}
                          </h4>
                          <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                            {indicator.lastActive}
                          </p>
                        </div>
                      </div>
                      <div className={cn("px-2 py-1 rounded-full text-xs font-semibold border", getStatusColor(indicator.status))}>
                        {indicator.status.charAt(0).toUpperCase() + indicator.status.slice(1)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Message Routing Rules Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("routes")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Message Routing Rules
              </h2>
              <Badge variant="default" className="bg-[var(--wl-bg-secondary)]">
                {messageRoutes.filter((r) => r.enabled).length}/{messageRoutes.length} active
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.routes ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.routes && (
            <div className="space-y-4">
              {messageRoutes.map((route) => (
                <Card key={route.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-right min-w-max">
                          <p className="text-sm font-semibold text-[var(--wl-text-primary)]">
                            {route.source}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          <div className="flex-1 h-px bg-[var(--wl-border)]" />
                          <Send className="w-4 h-4 text-[var(--wl-primary)] mx-3" />
                          <div className="flex-1 h-px bg-[var(--wl-border)]" />
                        </div>
                        <div className="text-left min-w-max">
                          <p className="text-sm font-semibold text-[var(--wl-text-primary)]">
                            {route.target}
                          </p>
                        </div>
                      </div>
                      <div>
                        <input
                          type="checkbox"
                          checked={route.enabled}
                          onChange={() => {}}
                          className="w-5 h-5 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="mb-4 pb-4 border-b border-[var(--wl-border)]">
                      <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-2">
                        Conditions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {route.conditions.map((condition, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] font-mono text-xs"
                          >
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-[var(--wl-error)] hover:bg-[var(--wl-error)]/10"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="primary"
                className="w-full bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Routing Rule
              </Button>
            </div>
          )}
        </div>

        {/* Delivery Stats Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("delivery")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Delivery Statistics
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                99.7% success rate
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.delivery ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.delivery && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {deliveryStats.map((stat) => {
                const successRate = ((stat.delivered / stat.sent) * 100).toFixed(1);
                return (
                  <Card key={stat.provider} className="bg-[var(--wl-bg-tertiary)]">
                    <CardHeader>
                      <CardTitle className="text-base">{stat.provider}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Sent
                            </p>
                            <p className="text-xl font-bold text-[var(--wl-text-primary)] mt-1">
                              {stat.sent.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Delivered
                            </p>
                            <p className="text-xl font-bold text-green-400 mt-1">
                              {stat.delivered.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Failed
                            </p>
                            <p className="text-xl font-bold text-red-400 mt-1">
                              {stat.failed}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--wl-border)]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Success Rate
                            </p>
                            <p className="text-sm font-bold text-green-400">{successRate}%</p>
                          </div>
                          <div className="w-full h-2 bg-[var(--wl-bg-secondary)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-400"
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--wl-border)]">
                          <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                            Avg Latency
                          </p>
                          <p className="text-lg font-bold text-[var(--wl-text-primary)] mt-1">
                            {stat.avgLatency}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Notification Preferences Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("preferences")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Notification Preferences
              </h2>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.preferences ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.preferences && (
            <Card className="bg-[var(--wl-bg-tertiary)]">
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--wl-border)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--wl-text-secondary)]">
                          Event
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--wl-text-secondary)]">
                          Slack
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--wl-text-secondary)]">
                          Teams
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--wl-text-secondary)]">
                          Pusher
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-[var(--wl-text-secondary)]">
                          Sound
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationPreferences.map((pref) => (
                        <tr key={pref.id} className="border-b border-[var(--wl-border)] hover:bg-[var(--wl-bg-secondary)]">
                          <td className="py-3 px-4 text-[var(--wl-text-primary)]">
                            {pref.event}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={pref.slack}
                              onChange={() => {}}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={pref.teams}
                              onChange={() => {}}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={pref.pusher}
                              onChange={() => {}}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={pref.sound}
                              onChange={() => {}}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex gap-2">
                  <Button
                    variant="primary"
                    className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                  >
                    Save Preferences
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                  >
                    Reset to Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
