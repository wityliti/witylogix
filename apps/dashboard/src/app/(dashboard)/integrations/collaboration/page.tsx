'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ChevronLeft,
  Slack,
  MessageSquare,
  Send,
  Activity,
  Route,
  Radio,
  Users,
} from 'lucide-react';
import { ProviderList } from './_components/provider-list';
import { PresenceGrid } from './_components/presence-grid';
import { MessageRoutes } from './_components/message-routes';
import { DeliveryStats } from './_components/delivery-stats';
import { NotificationPreferences } from './_components/notification-preferences';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#12121a]">
      <Header
        title="Collaboration Integrations"
        subtitle="Connect and manage team communication tools, presence, and message routing"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/integrations">
          <Button
            variant="ghost"
            className="mb-8 text-gray-400 hover:text-white"
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
              <h2 className="text-2xl font-bold text-white">
                Communication Providers
              </h2>
              <Badge variant="primary" className="bg-blue-500/30 text-blue-500">
                {providers.length} integrated
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.providers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.providers && (
            <ProviderList
              providers={providers}
              selectedProvider={selectedProvider}
              onSelectProvider={setSelectedProvider}
            />
          )}
        </div>

        {/* Presence Status Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("presence")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Team Presence Status
              </h2>
              <Badge variant="info" className="bg-blue-500/20 text-blue-400">
                Real-time
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.presence ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.presence && (
            <PresenceGrid indicators={presenceIndicators} />
          )}
        </div>

        {/* Message Routing Rules Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("routes")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Message Routing Rules
              </h2>
              <Badge variant="default" className="bg-[#12121a]">
                {messageRoutes.filter((r) => r.enabled).length}/{messageRoutes.length} active
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.routes ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.routes && (
            <MessageRoutes routes={messageRoutes} onAddRoute={() => {}} />
          )}
        </div>

        {/* Delivery Stats Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("delivery")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Delivery Statistics
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                99.7% success rate
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.delivery ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.delivery && (
            <DeliveryStats stats={deliveryStats} />
          )}
        </div>

        {/* Notification Preferences Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("preferences")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Notification Preferences
              </h2>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.preferences ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.preferences && (
            <NotificationPreferences preferences={notificationPreferences} />
          )}
        </div>
      </div>
    </div>
  );
}
