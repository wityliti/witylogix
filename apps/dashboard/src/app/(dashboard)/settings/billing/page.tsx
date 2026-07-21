'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ChevronLeft,
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillingInvoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'completed';
  downloadUrl: string;
}

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  unit: string;
}

interface BillingAddress {
  fullName?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface BillingData {
  plan: string;
  planTier: string;
  monthlyPrice: number;
  renewalDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  usageMetrics: UsageMetric[];
  billingAddress: BillingAddress | null;
  invoices: BillingInvoice[];
}

export default function BillingPage() {
  const { data: billing, loading, error, refetch } = useApiQuery<BillingData>('/api/v4/billing');

  const [addressForm, setAddressForm] = useState<BillingAddress | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const addr = addressForm ?? billing?.billingAddress ?? {};
  const invoices = billing?.invoices ?? [];
  const usageMetrics = billing?.usageMetrics ?? [];

  const handleAddressSave = async () => {
    setSavingAddress(true);
    try {
      await api.put('/api/v4/billing/address', addr);
      setAddressForm(null);
      refetch();
    } finally {
      setSavingAddress(false);
    }
  };

  const invoiceStatusVariant = (status: string) => {
    if (status === 'paid' || status === 'completed') return 'success';
    if (status === 'pending') return 'warning';
    return 'danger';
  };

  const invoiceStatusLabel = (status: string) =>
    status === 'completed' ? 'Paid' : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Billing & Plans"
        subtitle="Manage your subscription and payment information"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/settings">
          <Button variant="ghost" className="mb-8 text-wl-text-secondary hover:text-wl-text-primary">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Current Plan Card */}
        <Card className="mb-8 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-wl-info-500/30 bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="pt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm font-medium text-wl-text-tertiary uppercase">Current Plan</p>
                <h3 className="text-3xl font-bold text-wl-text-primary mt-2">{billing?.plan ?? '—'}</h3>
                <p className="text-wl-text-secondary mt-2">Professional logistics platform</p>
              </div>
              <div>
                <p className="text-sm font-medium text-wl-text-tertiary uppercase">Monthly Cost</p>
                <h3 className="text-3xl font-bold text-wl-text-primary mt-2">
                  {billing?.monthlyPrice != null
                    ? billing.monthlyPrice === 0
                      ? 'Free'
                      : `$${billing.monthlyPrice.toFixed(2)}`
                    : '—'}
                </h3>
                <p className="text-wl-text-secondary mt-2">Billed on 1st of each month</p>
              </div>
              <div>
                <p className="text-sm font-medium text-wl-text-tertiary uppercase">Next Renewal</p>
                <h3 className="text-3xl font-bold text-wl-text-primary mt-2">
                  {billing?.renewalDate
                    ? new Date(billing.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
                </h3>
                <p className="text-wl-text-secondary mt-2">Next billing cycle</p>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-8 border-t border-wl-border-default">
              <Button variant="primary" className="bg-wl-info-500 hover:bg-wl-primary-600">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary" className="border-wl-border-default text-wl-text-primary hover:bg-wl-bg-elevated">
                Downgrade Plan
              </Button>
              <Button variant="ghost" className="text-wl-danger-400">
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        {usageMetrics.length > 0 && (
          <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-wl-text-primary">
                <TrendingUp className="w-5 h-5" />
                Usage This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {usageMetrics.map((metric) => (
                <div key={metric.name}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-wl-text-primary">{metric.name}</p>
                    <span className="text-sm text-wl-text-tertiary">
                      {metric.current.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                    </span>
                  </div>
                  <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        metric.percentage >= 90 ? 'bg-wl-danger-500' : metric.percentage >= 70 ? 'bg-wl-warning-500' : 'bg-wl-info-500',
                      )}
                      style={{ width: `${metric.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-wl-text-tertiary mt-1">{metric.percentage.toFixed(1)}% of limit used</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-wl-text-secondary mb-4">
              Payment method management requires Stripe integration.{' '}
              <Link href="/settings/payments" className="text-wl-info-400 hover:underline">
                Configure payment gateways →
              </Link>
            </div>
            <Button variant="secondary" className="border-wl-border-default text-wl-text-primary hover:bg-wl-bg-elevated">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-wl-text-primary">Billing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-wl-text-primary mb-2">Full Name</label>
                  <input
                    type="text"
                    value={addr.fullName ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,fullName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-wl-text-primary mb-2">Company</label>
                  <input
                    type="text"
                    value={addr.company ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,company: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    placeholder="Company name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">Address</label>
                <input
                  type="text"
                  value={addr.address ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,address: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-wl-text-primary mb-2">City</label>
                  <input
                    type="text"
                    value={addr.city ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,city: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-wl-text-primary mb-2">State</label>
                  <input
                    type="text"
                    value={addr.state ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,state: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-wl-text-primary mb-2">Postal Code</label>
                  <input
                    type="text"
                    value={addr.postalCode ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressForm({ ...addr,postalCode: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-info-500"
                    placeholder="Postal code"
                  />
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              className="bg-wl-info-500 hover:bg-wl-primary-600"
              onClick={handleAddressSave}
              disabled={savingAddress}
            >
              {savingAddress ? 'Saving…' : 'Update Billing Address'}
            </Button>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Calendar className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-wl-text-secondary text-center py-8">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-wl-text-primary">{invoice.period}</p>
                      <p className="text-sm text-wl-text-tertiary">
                        {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium text-wl-text-primary">${invoice.amount.toFixed(2)}</p>
                        <Badge variant={invoiceStatusVariant(invoice.status)}>
                          {invoiceStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="text-wl-info-400 hover:bg-wl-bg-elevated">
                        <Download className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        {billing?.renewalDate && (
          <div className="mt-8 p-4 rounded-lg border border-wl-warning-500/30 bg-wl-warning-bg flex gap-3">
            <AlertCircle className="w-5 h-5 text-wl-warning-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-wl-text-secondary">
              Your subscription will automatically renew on{' '}
              <strong>{new Date(billing.renewalDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
              You can cancel anytime before the renewal date.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
