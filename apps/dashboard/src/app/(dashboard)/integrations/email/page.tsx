'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Settings,
  Eye,
  Copy,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Send,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   EMAIL PROVIDER CONFIGURATION PAGE
   ═══════════════════════════════════════════════════════════ */

interface EmailProvider {
  id: string;
  name: string;
  slug: string;
  icon: string;
  status: "active" | "inactive" | "error";
  configType: "api_key" | "oauth";
  apiKey?: string;
  domains: {
    domain: string;
    verified: boolean;
    dnsRecords: {
      type: string;
      name: string;
      value: string;
    }[];
  }[];
  sendingLimits: {
    perDay: number;
    perSecond: number;
    sent: number;
  };
  templates: string[];
}

interface EmailTemplate {
  id: string;
  name: string;
  type:
    | "order_confirmation"
    | "shipping_update"
    | "delivery_complete"
    | "invoice"
    | "password_reset"
    | "welcome";
  subject: string;
  preview: string;
  variables: string[];
}

interface DeliveryMetrics {
  template: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

const PROVIDERS: EmailProvider[] = [
  {
    id: "sendgrid-001",
    name: "SendGrid",
    slug: "sendgrid",
    icon: "📧",
    status: "active",
    configType: "api_key",
    apiKey: "SG.xxxxxxxxxxxx...",
    domains: [
      {
        domain: "notifications@witylogix.com",
        verified: true,
        dnsRecords: [
          {
            type: "CNAME",
            name: "sendgrid._domainkey.witylogix.com",
            value: "sendgrid.net",
          },
          {
            type: "MX",
            name: "witylogix.com",
            value: "sendgrid.net",
          },
        ],
      },
      {
        domain: "marketing@witylogix.com",
        verified: true,
        dnsRecords: [],
      },
    ],
    sendingLimits: {
      perDay: 100000,
      perSecond: 1000,
      sent: 42831,
    },
    templates: [
      "order_confirmation",
      "shipping_update",
      "delivery_complete",
      "invoice",
      "welcome",
    ],
  },
  {
    id: "mailgun-001",
    name: "Mailgun",
    slug: "mailgun",
    icon: "🎯",
    status: "inactive",
    configType: "api_key",
    domains: [],
    sendingLimits: {
      perDay: 50000,
      perSecond: 500,
      sent: 0,
    },
    templates: [],
  },
  {
    id: "ses-001",
    name: "Amazon SES",
    slug: "ses",
    icon: "☁",
    status: "inactive",
    configType: "oauth",
    domains: [],
    sendingLimits: {
      perDay: 200000,
      perSecond: 14,
      sent: 0,
    },
    templates: [],
  },
  {
    id: "gmail-001",
    name: "Gmail",
    slug: "gmail",
    icon: "📨",
    status: "inactive",
    configType: "oauth",
    domains: [],
    sendingLimits: {
      perDay: 100,
      perSecond: 1,
      sent: 0,
    },
    templates: [],
  },
  {
    id: "outlook-001",
    name: "Outlook",
    slug: "outlook",
    icon: "📬",
    status: "inactive",
    configType: "oauth",
    domains: [],
    sendingLimits: {
      perDay: 300,
      perSecond: 3,
      sent: 0,
    },
    templates: [],
  },
];

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-001",
    name: "Order Confirmation",
    type: "order_confirmation",
    subject: "Order #{order_id} Confirmed",
    preview:
      "Thank you for your order! Here are your order details and next steps...",
    variables: [
      "{customer_name}",
      "{order_id}",
      "{order_total}",
      "{order_items}",
      "{estimated_delivery}",
    ],
  },
  {
    id: "tpl-002",
    name: "Shipping Update",
    type: "shipping_update",
    subject: "Your order is on the way!",
    preview:
      "Your order has been shipped! Track your package with the link below...",
    variables: [
      "{customer_name}",
      "{tracking_number}",
      "{carrier}",
      "{estimated_delivery}",
      "{tracking_url}",
    ],
  },
  {
    id: "tpl-003",
    name: "Delivery Complete",
    type: "delivery_complete",
    subject: "Your order has been delivered",
    preview: "Your package has been delivered! Thank you for your purchase...",
    variables: [
      "{customer_name}",
      "{order_id}",
      "{delivered_date}",
      "{review_url}",
    ],
  },
  {
    id: "tpl-004",
    name: "Invoice",
    type: "invoice",
    subject: "Invoice #{invoice_id}",
    preview: "Please find your invoice attached. Payment is due within 30 days...",
    variables: [
      "{customer_name}",
      "{invoice_id}",
      "{invoice_date}",
      "{invoice_total}",
      "{due_date}",
    ],
  },
  {
    id: "tpl-005",
    name: "Password Reset",
    type: "password_reset",
    subject: "Reset Your Password",
    preview:
      "You requested a password reset. Click the link below to create a new password...",
    variables: [
      "{customer_name}",
      "{reset_link}",
      "{expiration_time}",
      "{support_email}",
    ],
  },
  {
    id: "tpl-006",
    name: "Welcome",
    type: "welcome",
    subject: "Welcome to Witylogix!",
    preview: "Get started with your account and explore our features...",
    variables: [
      "{customer_name}",
      "{account_email}",
      "{onboarding_url}",
      "{help_url}",
    ],
  },
];

const DELIVERY_METRICS: DeliveryMetrics[] = [
  {
    template: "Order Confirmation",
    sent: 12450,
    delivered: 12398,
    opened: 8764,
    clicked: 2341,
    bounced: 52,
  },
  {
    template: "Shipping Update",
    sent: 8920,
    delivered: 8891,
    opened: 6234,
    clicked: 1845,
    bounced: 29,
  },
  {
    template: "Delivery Complete",
    sent: 7654,
    delivered: 7623,
    opened: 4891,
    clicked: 1234,
    bounced: 31,
  },
  {
    template: "Invoice",
    sent: 3456,
    delivered: 3445,
    opened: 2156,
    clicked: 892,
    bounced: 11,
  },
  {
    template: "Password Reset",
    sent: 2341,
    delivered: 2334,
    opened: 1987,
    clicked: 1876,
    bounced: 7,
  },
  {
    template: "Welcome",
    sent: 1823,
    delivered: 1819,
    opened: 1432,
    clicked: 621,
    bounced: 4,
  },
];

export default function EmailProviderPage() {
  const [activeProvider, setActiveProvider] = useState<string>("sendgrid-001");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("tpl-001");
  const [showTestEmail, setShowTestEmail] = useState(false);

  const activeProviderData = PROVIDERS.find((p) => p.id === activeProvider)!;
  const selectedTemplateData = EMAIL_TEMPLATES.find(
    (t) => t.id === selectedTemplate
  )!;

  // Calculate aggregate metrics
  const aggregateMetrics = DELIVERY_METRICS.reduce(
    (acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      opened: acc.opened + m.opened,
      clicked: acc.clicked + m.clicked,
      bounced: acc.bounced + m.bounced,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
  );

  const deliveryRate = (
    (aggregateMetrics.delivered / aggregateMetrics.sent) *
    100
  ).toFixed(1);
  const openRate = (
    (aggregateMetrics.opened / aggregateMetrics.delivered) *
    100
  ).toFixed(1);
  const clickRate = (
    (aggregateMetrics.clicked / aggregateMetrics.delivered) *
    100
  ).toFixed(1);

  return (
    <>
      <Header
        title="Email Providers"
        subtitle={`${PROVIDERS.filter((p) => p.status === "active").length} active · ${aggregateMetrics.sent.toLocaleString()} emails sent (24h)`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Provider Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setActiveProvider(provider.id)}
              className={cn(
                "px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2",
                activeProvider === provider.id
                  ? "bg-blue-500 text-white border-blue-600"
                  : "border-[#1e1e2e] text-gray-400 hover:border-blue-500/50"
              )}
            >
              <span className="text-lg">{provider.icon}</span>
              {provider.name}
              {provider.status === "active" && (
                <CheckCircle className="w-4 h-4 ml-1" />
              )}
            </button>
          ))}
        </div>

        {/* Provider Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left: Provider Config */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Configuration</span>
                  <Badge
                    variant={
                      activeProviderData.status === "active"
                        ? "success"
                        : "default"
                    }
                  >
                    {activeProviderData.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* API Key / OAuth Config */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Authentication Method
                  </h4>
                  <div className="p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]">
                    <div className="text-sm text-gray-400 mb-2">
                      {activeProviderData.configType === "api_key"
                        ? "API Key"
                        : "OAuth 2.0"}
                    </div>
                    {activeProviderData.apiKey && (
                      <div className="font-mono text-xs text-gray-500 flex items-center justify-between p-2 bg-[#0a0a0f] rounded">
                        <span>{activeProviderData.apiKey}</span>
                        <Copy className="w-4 h-4 cursor-pointer hover:text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Verified Domains */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">
                      Verified Domains ({activeProviderData.domains.length})
                    </h4>
                    <Button variant="secondary" size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Domain
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {activeProviderData.domains.map((domain, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-mono text-sm text-white">
                            {domain.domain}
                          </div>
                          <Badge variant={domain.verified ? "success" : "warning"}>
                            {domain.verified ? "Verified" : "Pending"}
                          </Badge>
                        </div>
                        {domain.dnsRecords.length > 0 && (
                          <div className="space-y-2">
                            {domain.dnsRecords.map((record, ridx) => (
                              <div
                                key={ridx}
                                className="text-xs p-2 bg-[#0a0a0f] rounded font-mono text-gray-500"
                              >
                                <div>
                                  <span className="text-cyan-400">
                                    {record.type}
                                  </span>{" "}
                                  {record.name}
                                </div>
                                <div className="text-gray-400 mt-1">
                                  {record.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sending Limits */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Sending Limits
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-[#12121a] rounded-lg border border-[#1e1e2e]">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Per Day
                      </div>
                      <div className="text-lg font-bold text-white mt-1">
                        {activeProviderData.sendingLimits.perDay.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-[#12121a] rounded-lg border border-[#1e1e2e]">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Per Second
                      </div>
                      <div className="text-lg font-bold text-white mt-1">
                        {activeProviderData.sendingLimits.perSecond}
                      </div>
                    </div>
                    <div className="p-3 bg-[#12121a] rounded-lg border border-[#1e1e2e]">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        Sent (24h)
                      </div>
                      <div className="text-lg font-bold text-white mt-1">
                        {activeProviderData.sendingLimits.sent.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-[#1e1e2e]">
                  {activeProviderData.status === "active" && (
                    <>
                      <Button variant="secondary" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        Edit Settings
                      </Button>
                      <Button variant="danger" size="sm">
                        Disconnect
                      </Button>
                    </>
                  )}
                  {activeProviderData.status === "inactive" && (
                    <Button variant="primary" size="sm" className="w-full">
                      Connect {activeProviderData.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Quick Stats */}
          <div className="space-y-4">
            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardContent className="pt-6">
                <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Delivery Rate (24h)
                </h4>
                <div className="text-3xl font-bold text-emerald-400">
                  {deliveryRate}%
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {aggregateMetrics.delivered.toLocaleString()} of{" "}
                  {aggregateMetrics.sent.toLocaleString()} delivered
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardContent className="pt-6">
                <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Open Rate (24h)
                </h4>
                <div className="text-3xl font-bold text-cyan-400">
                  {openRate}%
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {aggregateMetrics.opened.toLocaleString()} opens
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardContent className="pt-6">
                <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Click Rate (24h)
                </h4>
                <div className="text-3xl font-bold text-blue-400">
                  {clickRate}%
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {aggregateMetrics.clicked.toLocaleString()} clicks
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#12121a] border border-red-500/20">
              <CardContent className="pt-6">
                <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
                  Bounced (24h)
                </h4>
                <div className="text-3xl font-bold text-red-400">
                  {aggregateMetrics.bounced}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-gray-500">
                  Manage Suppression List
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Email Templates Section */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-bold text-white">
            Email Templates
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="lg:col-span-1">
              <div className="space-y-2">
                {EMAIL_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-all",
                      selectedTemplate === template.id
                        ? "bg-blue-500/10 border-blue-500"
                        : "bg-[#1a1a2e] border-[#1e1e2e] hover:border-blue-500/50"
                    )}
                  >
                    <div className="font-medium text-white">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {template.type.replace(/_/g, " ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Preview */}
            <div className="lg:col-span-2">
              <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{selectedTemplateData.name}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowTestEmail(!showTestEmail)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send Test
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject Line */}
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Subject
                    </label>
                    <div className="text-sm text-white mt-2 p-3 bg-[#12121a] rounded border border-[#1e1e2e] font-mono">
                      {selectedTemplateData.subject}
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Preview
                    </label>
                    <div className="text-sm text-gray-400 mt-2 p-4 bg-[#12121a] rounded border border-[#1e1e2e]">
                      {selectedTemplateData.preview}
                    </div>
                  </div>

                  {/* Variables */}
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Available Variables
                    </label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplateData.variables.map((v) => (
                        <Badge key={v} variant="info">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Test Email Form */}
                  {showTestEmail && (
                    <div className="p-4 bg-[#12121a] rounded border border-blue-500/30 space-y-3">
                      <div>
                        <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold block mb-2">
                          Recipient Email
                        </label>
                        <input
                          type="email"
                          placeholder="test@example.com"
                          className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-sm text-white placeholder-wl-text-tertiary"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm">
                          Send Test Email
                        </Button>
                        <Button variant="secondary" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Delivery Analytics */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">
            Delivery Analytics (24h)
          </h2>

          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {DELIVERY_METRICS.map((metric) => {
                  const delivered = (
                    (metric.delivered / metric.sent) *
                    100
                  ).toFixed(0);
                  const opened = (
                    (metric.opened / metric.delivered) *
                    100
                  ).toFixed(0);
                  const clicked = (
                    (metric.clicked / metric.delivered) *
                    100
                  ).toFixed(0);
                  const bounced = (
                    (metric.bounced / metric.sent) *
                    100
                  ).toFixed(0);

                  return (
                    <div
                      key={metric.template}
                      className="border border-[#1e1e2e] rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-white">
                          {metric.template}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {metric.sent.toLocaleString()} sent
                        </span>
                      </div>

                      {/* Stacked Bar Chart */}
                      <div className="flex h-8 rounded-lg overflow-hidden bg-[#12121a]">
                        <div
                          className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            width: `${delivered}%`,
                          }}
                          title={`Delivered: ${metric.delivered}`}
                        >
                          {delivered > 15 && `${delivered}%`}
                        </div>
                        <div
                          className="bg-cyan-500 flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            width: `${(metric.opened / metric.sent) * 100}%`,
                          }}
                          title={`Opened: ${metric.opened}`}
                        >
                          {(metric.opened / metric.sent) * 100 > 10 &&
                            `${((metric.opened / metric.sent) * 100).toFixed(0)}%`}
                        </div>
                        <div
                          className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            width: `${(metric.clicked / metric.sent) * 100}%`,
                          }}
                          title={`Clicked: ${metric.clicked}`}
                        >
                          {(metric.clicked / metric.sent) * 100 > 5 &&
                            `${((metric.clicked / metric.sent) * 100).toFixed(0)}%`}
                        </div>
                        <div
                          className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            width: `${bounced}%`,
                          }}
                          title={`Bounced: ${metric.bounced}`}
                        >
                          {bounced > 5 && `${bounced}%`}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                        <div>
                          <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1" />
                          <span className="text-gray-500">
                            Delivered: {metric.delivered}
                          </span>
                        </div>
                        <div>
                          <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full mr-1" />
                          <span className="text-gray-500">
                            Opened: {metric.opened}
                          </span>
                        </div>
                        <div>
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1" />
                          <span className="text-gray-500">
                            Clicked: {metric.clicked}
                          </span>
                        </div>
                        <div>
                          <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
                          <span className="text-gray-500">
                            Bounced: {metric.bounced}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
