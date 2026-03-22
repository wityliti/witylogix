'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { ProviderTabs } from './_components/provider-tabs';
import { ProviderConfig } from './_components/provider-config';
import { DeliveryStatsCard } from './_components/delivery-stats-card';
import { TemplateList } from './_components/template-list';
import { TemplatePreview } from './_components/template-preview';
import { DeliveryAnalytics } from './_components/delivery-analytics';

interface EmailProvider {
  id: string;
  name: string;
  slug: string;
  icon: string;
  status: 'active' | 'inactive' | 'error';
  configType: 'api_key' | 'oauth';
  apiKey?: string;
  domains: Array<{
    domain: string;
    verified: boolean;
    dnsRecords: Array<{
      type: string;
      name: string;
      value: string;
    }>;
  }>;
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
  type: string;
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
    id: 'sendgrid-001',
    name: 'SendGrid',
    slug: 'sendgrid',
    icon: '📧',
    status: 'active',
    configType: 'api_key',
    apiKey: 'SG.xxxxxxxxxxxx...',
    domains: [
      {
        domain: 'notifications@witylogix.com',
        verified: true,
        dnsRecords: [
          {
            type: 'CNAME',
            name: 'sendgrid._domainkey.witylogix.com',
            value: 'sendgrid.net',
          },
          {
            type: 'MX',
            name: 'witylogix.com',
            value: 'sendgrid.net',
          },
        ],
      },
      {
        domain: 'marketing@witylogix.com',
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
      'order_confirmation',
      'shipping_update',
      'delivery_complete',
      'invoice',
      'welcome',
    ],
  },
  {
    id: 'mailgun-001',
    name: 'Mailgun',
    slug: 'mailgun',
    icon: '🎯',
    status: 'inactive',
    configType: 'api_key',
    domains: [],
    sendingLimits: {
      perDay: 50000,
      perSecond: 500,
      sent: 0,
    },
    templates: [],
  },
  {
    id: 'ses-001',
    name: 'Amazon SES',
    slug: 'ses',
    icon: '☁',
    status: 'inactive',
    configType: 'oauth',
    domains: [],
    sendingLimits: {
      perDay: 200000,
      perSecond: 14,
      sent: 0,
    },
    templates: [],
  },
  {
    id: 'gmail-001',
    name: 'Gmail',
    slug: 'gmail',
    icon: '📨',
    status: 'inactive',
    configType: 'oauth',
    domains: [],
    sendingLimits: {
      perDay: 100,
      perSecond: 1,
      sent: 0,
    },
    templates: [],
  },
  {
    id: 'outlook-001',
    name: 'Outlook',
    slug: 'outlook',
    icon: '📬',
    status: 'inactive',
    configType: 'oauth',
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
    id: 'tpl-001',
    name: 'Order Confirmation',
    type: 'order_confirmation',
    subject: 'Order #{order_id} Confirmed',
    preview:
      'Thank you for your order! Here are your order details and next steps...',
    variables: [
      '{customer_name}',
      '{order_id}',
      '{order_total}',
      '{order_items}',
      '{estimated_delivery}',
    ],
  },
  {
    id: 'tpl-002',
    name: 'Shipping Update',
    type: 'shipping_update',
    subject: 'Your order is on the way!',
    preview:
      'Your order has been shipped! Track your package with the link below...',
    variables: [
      '{customer_name}',
      '{tracking_number}',
      '{carrier}',
      '{estimated_delivery}',
      '{tracking_url}',
    ],
  },
  {
    id: 'tpl-003',
    name: 'Delivery Complete',
    type: 'delivery_complete',
    subject: 'Your order has been delivered',
    preview: 'Your package has been delivered! Thank you for your purchase...',
    variables: [
      '{customer_name}',
      '{order_id}',
      '{delivered_date}',
      '{review_url}',
    ],
  },
  {
    id: 'tpl-004',
    name: 'Invoice',
    type: 'invoice',
    subject: 'Invoice #{invoice_id}',
    preview:
      'Please find your invoice attached. Payment is due within 30 days...',
    variables: [
      '{customer_name}',
      '{invoice_id}',
      '{invoice_date}',
      '{invoice_total}',
      '{due_date}',
    ],
  },
  {
    id: 'tpl-005',
    name: 'Password Reset',
    type: 'password_reset',
    subject: 'Reset Your Password',
    preview:
      'You requested a password reset. Click the link below to create a new password...',
    variables: [
      '{customer_name}',
      '{reset_link}',
      '{expiration_time}',
      '{support_email}',
    ],
  },
  {
    id: 'tpl-006',
    name: 'Welcome',
    type: 'welcome',
    subject: 'Welcome to Witylogix!',
    preview: 'Get started with your account and explore our features...',
    variables: [
      '{customer_name}',
      '{account_email}',
      '{onboarding_url}',
      '{help_url}',
    ],
  },
];

const DELIVERY_METRICS: DeliveryMetrics[] = [
  {
    template: 'Order Confirmation',
    sent: 12450,
    delivered: 12398,
    opened: 8764,
    clicked: 2341,
    bounced: 52,
  },
  {
    template: 'Shipping Update',
    sent: 8920,
    delivered: 8891,
    opened: 6234,
    clicked: 1845,
    bounced: 29,
  },
  {
    template: 'Delivery Complete',
    sent: 7654,
    delivered: 7623,
    opened: 4891,
    clicked: 1234,
    bounced: 31,
  },
  {
    template: 'Invoice',
    sent: 3456,
    delivered: 3445,
    opened: 2156,
    clicked: 892,
    bounced: 11,
  },
  {
    template: 'Password Reset',
    sent: 2341,
    delivered: 2334,
    opened: 1987,
    clicked: 1876,
    bounced: 7,
  },
  {
    template: 'Welcome',
    sent: 1823,
    delivered: 1819,
    opened: 1432,
    clicked: 621,
    bounced: 4,
  },
];

export default function EmailProviderPage() {
  const [activeProvider, setActiveProvider] = useState<string>('sendgrid-001');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('tpl-001');

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
        subtitle={`${PROVIDERS.filter((p) => p.status === 'active').length} active · ${aggregateMetrics.sent.toLocaleString()} emails sent (24h)`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProviderTabs
          providers={PROVIDERS}
          activeProvider={activeProvider}
          onSelectProvider={setActiveProvider}
        />

        {/* Provider Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left: Provider Config */}
          <div className="lg:col-span-2">
            <ProviderConfig {...activeProviderData} />
          </div>

          {/* Right: Quick Stats */}
          <div className="space-y-4">
            <DeliveryStatsCard
              title="Delivery Rate (24h)"
              value={`${deliveryRate}%`}
              variant="success"
              subtitle={`${aggregateMetrics.delivered.toLocaleString()} of ${aggregateMetrics.sent.toLocaleString()} delivered`}
            />
            <DeliveryStatsCard
              title="Open Rate (24h)"
              value={`${openRate}%`}
              variant="info"
              subtitle={`${aggregateMetrics.opened.toLocaleString()} opens`}
            />
            <DeliveryStatsCard
              title="Click Rate (24h)"
              value={`${clickRate}%`}
              variant="warning"
              subtitle={`${aggregateMetrics.clicked.toLocaleString()} clicks`}
            />
            <DeliveryStatsCard
              title="Bounced (24h)"
              value={aggregateMetrics.bounced}
              variant="danger"
              subtitle=""
              action={{
                label: 'Manage Suppression List',
                onClick: () => {},
              }}
            />
          </div>
        </div>

        {/* Email Templates Section */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-bold text-white">Email Templates</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <TemplateList
                templates={EMAIL_TEMPLATES}
                selectedId={selectedTemplate}
                onSelect={setSelectedTemplate}
              />
            </div>

            <div className="lg:col-span-2">
              <TemplatePreview template={selectedTemplateData} />
            </div>
          </div>
        </div>

        <DeliveryAnalytics metrics={DELIVERY_METRICS} />
      </div>
    </>
  );
}
