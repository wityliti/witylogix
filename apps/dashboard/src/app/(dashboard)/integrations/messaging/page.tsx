'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ═══════════════════════════════════════════════════════════
   MESSAGING & NOTIFICATION PROVIDER CONFIGURATION PAGE
   Channels: SMS, Push Notifications, Chat
   ═══════════════════════════════════════════════════════════ */

type ChannelType = "SMS" | "PUSH" | "CHAT";
type ProviderStatus = "ACTIVE" | "ERROR" | "NOT_CONFIGURED";

interface ProviderConfig {
  name: string;
  status: ProviderStatus;
  priority: number;
  apiKey?: string;
  accountId?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  channel: ChannelType;
  content: string;
  variables: string[];
  lastModified: string;
}

interface DeliveryStats {
  sent: number;
  delivered: number;
  failed: number;
  bounceRate: number;
}

interface MessagingProvider {
  id: string;
  name: string;
  channel: ChannelType;
  status: ProviderStatus;
  rateLimit: number;
  deliveryStats: DeliveryStats;
  configs: ProviderConfig[];
}

const SMS_PROVIDERS = [
  {
    id: "twilio",
    name: "Twilio",
    channel: "SMS" as ChannelType,
    status: "ACTIVE" as ProviderStatus,
    rateLimit: 1000,
    deliveryStats: { sent: 12400, delivered: 12180, failed: 220, bounceRate: 1.77 },
  },
  {
    id: "vonage",
    name: "Vonage",
    channel: "SMS" as ChannelType,
    status: "ACTIVE" as ProviderStatus,
    rateLimit: 800,
    deliveryStats: { sent: 8650, delivered: 8520, failed: 130, bounceRate: 1.5 },
  },
  {
    id: "textmagic",
    name: "TextMagic",
    channel: "SMS" as ChannelType,
    status: "NOT_CONFIGURED" as ProviderStatus,
    rateLimit: 500,
    deliveryStats: { sent: 0, delivered: 0, failed: 0, bounceRate: 0 },
  },
];

const PUSH_PROVIDERS = [
  {
    id: "firebase",
    name: "Firebase Cloud Messaging",
    channel: "PUSH" as ChannelType,
    status: "ACTIVE" as ProviderStatus,
    rateLimit: 10000,
    deliveryStats: { sent: 45230, delivered: 44890, failed: 340, bounceRate: 0.75 },
  },
  {
    id: "onesignal",
    name: "OneSignal",
    channel: "PUSH" as ChannelType,
    status: "ACTIVE" as ProviderStatus,
    rateLimit: 5000,
    deliveryStats: { sent: 23450, delivered: 23100, failed: 350, bounceRate: 1.49 },
  },
];

const CHAT_PROVIDERS = [
  {
    id: "sendbird",
    name: "Sendbird",
    channel: "CHAT" as ChannelType,
    status: "ACTIVE" as ProviderStatus,
    rateLimit: 2000,
    deliveryStats: { sent: 18920, delivered: 18920, failed: 0, bounceRate: 0 },
  },
];

const ALL_PROVIDERS = [...SMS_PROVIDERS, ...PUSH_PROVIDERS, ...CHAT_PROVIDERS];

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "tmpl-1",
    name: "Delivery Confirmation",
    channel: "SMS",
    content: "Your order {{orderId}} has been delivered. Thank you for your business!",
    variables: ["orderId"],
    lastModified: "2 days ago",
  },
  {
    id: "tmpl-2",
    name: "Driver Arrival",
    channel: "SMS",
    content: "Driver {{driverName}} is {{minutesAway}} minutes away. Order: {{orderId}}",
    variables: ["driverName", "minutesAway", "orderId"],
    lastModified: "5 days ago",
  },
  {
    id: "tmpl-3",
    name: "Order Ready",
    channel: "PUSH",
    content: "Your order is ready for pickup at {{location}}",
    variables: ["location"],
    lastModified: "1 week ago",
  },
  {
    id: "tmpl-4",
    name: "Payment Reminder",
    channel: "SMS",
    content: "Reminder: Your payment for {{amount}} is due on {{dueDate}}",
    variables: ["amount", "dueDate"],
    lastModified: "3 days ago",
  },
  {
    id: "tmpl-5",
    name: "Delivery Updates",
    channel: "PUSH",
    content: "{{driverName}} is delivering your package from {{origin}} to {{destination}}",
    variables: ["driverName", "origin", "destination"],
    lastModified: "4 days ago",
  },
];

function BarChart({ data, height = 120 }: { data: number[]; height?: number }) {
  const max = Math.max(...data);
  const width = 100 / data.length;

  return (
    <svg
      viewBox={`0 0 ${data.length * 20} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
    >
      {data.map((value, i) => {
        const barHeight = (value / max) * (height * 0.9);
        const x = i * 20;
        const y = height - barHeight;

        return (
          <g key={i}>
            <rect
              x={x + 2}
              y={y}
              width={16}
              height={barHeight}
              fill="#3b82f6"
              opacity="0.8"
            />
          </g>
        );
      })}
    </svg>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const variants: Record<ProviderStatus, "success" | "danger" | "default"> = {
    ACTIVE: "success",
    ERROR: "danger",
    NOT_CONFIGURED: "default",
  };
  return <Badge variant={variants[status]}>{status.replace(/_/g, " ")}</Badge>;
}

export default function MessagingPage() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("SMS");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(MESSAGE_TEMPLATES[0].id);
  const [testChannel, setTestChannel] = useState<ChannelType>("SMS");
  const [testRecipient, setTestRecipient] = useState("123-456-7890");

  const channelProviders = ALL_PROVIDERS.filter((p) => p.channel === selectedChannel);
  const selected = MESSAGE_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <>
      <Header
        title="Messaging Providers"
        subtitle="Configure and monitor SMS, push, and chat integrations"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        {/* Channel Tabs */}
        <div className={cn("flex gap-2 mb-4")}>
          {(["SMS", "PUSH", "CHAT"] as const).map((channel) => (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              className={cn(
                "px-4 py-2 rounded-md font-semibold text-sm transition",
                selectedChannel === channel
                  ? "bg-blue-500 text-white"
                  : "bg-wl-bg-elevated text-gray-400 hover:bg-wl-bg-surface"
              )}
            >
              {channel}
            </button>
          ))}
        </div>

        {/* Overview Cards */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Sent</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>
                {(channelProviders.reduce((sum, p) => sum + p.deliveryStats.sent, 0) / 1000).toFixed(0)}
                <span className="text-xs text-gray-300">k</span>
              </div>
              <p className={cn("text-xs text-gray-300 mt-1")}>messages sent</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Delivered</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-emerald-500")}>
                {(
                  (channelProviders.reduce((sum, p) => sum + p.deliveryStats.delivered, 0) /
                    channelProviders.reduce((sum, p) => sum + p.deliveryStats.sent, 0)) *
                  100
                ).toFixed(1)}
                <span className="text-xs text-gray-300">%</span>
              </div>
              <p className={cn("text-xs text-gray-300 mt-1")}>delivery rate</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Failed</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-amber-500")}>
                {channelProviders.reduce((sum, p) => sum + p.deliveryStats.failed, 0)}
              </div>
              <p className={cn("text-xs text-gray-300 mt-1")}>messages failed</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bounce Rate</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>
                {(
                  channelProviders.reduce((sum, p) => sum + p.deliveryStats.bounceRate, 0) /
                  channelProviders.length
                ).toFixed(2)}
                <span className="text-xs text-gray-300">%</span>
              </div>
              <p className={cn("text-xs text-gray-300 mt-1")}>avg bounce rate</p>
            </div>
          </Card>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Configuration */}
          <div className={cn("lg:col-span-2 space-y-6")}>
            {/* Channel Default Provider */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Configuration</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-4")}>
                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Primary Provider for {selectedChannel}
                  </label>
                  <select
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                    defaultValue={channelProviders[0]?.id || ""}
                  >
                    {channelProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Fallback Providers
                  </label>
                  <div className={cn("space-y-2")}>
                    {channelProviders.map((provider) => (
                      <label key={provider.id} className={cn("flex items-center gap-2")}>
                        <input type="checkbox" className={cn("w-4 h-4")} defaultChecked />
                        <span className={cn("text-sm text-white")}>{provider.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Providers List */}
            <Card>
              <CardHeader>
                <CardTitle>{selectedChannel} Providers</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-3")}>
                {channelProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className={cn(
                      "p-4 rounded border border-wl-border-default hover:border-blue-400 transition"
                    )}
                  >
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h4 className={cn("font-semibold text-white")}>{provider.name}</h4>
                        <p className={cn("text-xs text-gray-300")}>
                          Rate limit: {provider.rateLimit.toLocaleString()} messages/day
                        </p>
                      </div>
                      <StatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-4 gap-3 text-sm mb-3")}>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Sent</p>
                        <p className={cn("font-semibold text-white")}>
                          {(provider.deliveryStats.sent / 1000).toFixed(1)}k
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Delivered</p>
                        <p className={cn("font-semibold text-white")}>
                          {(provider.deliveryStats.delivered / 1000).toFixed(1)}k
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Failed</p>
                        <p className={cn("font-semibold text-amber-500")}>
                          {provider.deliveryStats.failed}
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Bounce</p>
                        <p className={cn("font-semibold text-white")}>
                          {provider.deliveryStats.bounceRate.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className={cn("h-12 bg-wl-bg-surface rounded mb-3")}>
                      <BarChart data={[45, 38, 52, 48, 55, 42, 50]} height={48} />
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm">
                        Configure
                      </Button>
                      <Button variant="ghost" size="sm">
                        Test
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className={cn("space-y-4")}>
            {/* Test Message Sender */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Send Test Message</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-3")}>
                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Channel
                  </label>
                  <select
                    value={testChannel}
                    onChange={(e) => setTestChannel(e.target.value as ChannelType)}
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  >
                    {(["SMS", "PUSH", "CHAT"] as const).map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    {testChannel === "SMS" ? "Phone Number" : testChannel === "PUSH" ? "Device Token" : "User ID"}
                  </label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={
                      testChannel === "SMS"
                        ? "1234567890"
                        : testChannel === "PUSH"
                          ? "device_token_..."
                          : "user_id_..."
                    }
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  />
                </div>

                <div>
                  <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                    Message Content
                  </label>
                  <textarea
                    placeholder="Test message content..."
                    rows={3}
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                    )}
                  />
                </div>

                <Button variant="primary" className="w-full">
                  Send Test
                </Button>
              </div>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rate Limits</CardTitle>
              </CardHeader>
              <div className={cn("p-4 pt-0 space-y-3")}>
                {channelProviders.map((provider) => (
                  <div key={provider.id}>
                    <p className={cn("text-xs font-semibold text-gray-400 mb-1")}>
                      {provider.name}
                    </p>
                    <div className={cn("flex items-center gap-2")}>
                      <div className={cn("flex-1 h-2 rounded bg-wl-bg-surface overflow-hidden")}>
                        <div
                          className={cn("h-full bg-blue-500")}
                          style={{ width: "65%" }}
                        />
                      </div>
                      <span className={cn("text-xs text-gray-300")}>650/1000</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Message Templates */}
        <Card>
          <CardHeader>
            <CardTitle>Message Templates</CardTitle>
          </CardHeader>
          <div className={cn("p-4 pt-0")}>
            <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-4")}>
              <div className={cn("space-y-2")}>
                {MESSAGE_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      "p-3 rounded cursor-pointer transition",
                      selectedTemplate === template.id
                        ? "bg-blue-500/10 border border-blue-400"
                        : "bg-wl-bg-surface border border-wl-border-default hover:border-blue-400"
                    )}
                  >
                    <p className={cn("font-semibold text-white text-sm")}>{template.name}</p>
                    <div className={cn("flex items-center gap-2 mt-1")}>
                      <Badge variant="primary" className="text-xs">
                        {template.channel}
                      </Badge>
                      <span className={cn("text-xs text-gray-300")}>{template.lastModified}</span>
                    </div>
                  </div>
                ))}
              </div>

              {selected && (
                <div className={cn("lg:col-span-2 space-y-4")}>
                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={selected.name}
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                      )}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      Channel
                    </label>
                    <p className={cn("text-sm text-white")}>{selected.channel}</p>
                  </div>

                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      Content
                    </label>
                    <textarea
                      value={selected.content}
                      rows={4}
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none font-mono"
                      )}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      Variables
                    </label>
                    <div className={cn("flex flex-wrap gap-2")}>
                      {selected.variables.map((variable) => (
                        <Badge key={variable} variant="info">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className={cn("flex gap-2")}>
                    <Button variant="primary" className="flex-1">
                      Edit
                    </Button>
                    <Button variant="secondary" className="flex-1">
                      Preview
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
