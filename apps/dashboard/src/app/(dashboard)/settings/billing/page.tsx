'use client';

import { useApiQuery, useApiList } from '@/hooks/use-api';
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
  Calendar,
  AlertCircle,
  ArrowUpRight,
  FileText,
  Infinity as InfinityIcon,
} from 'lucide-react';

interface UsageSummary {
  plan: string;
  status: string;
  billingCycle: string;
  nextBillingDate: string | null;
  limits: {
    shipments: { used: number; limit: number | null; remaining: number };
    drivers: { used: number; limit: number | null; remaining: number };
    apiCalls: { used: number; limit: number | null; remaining: number };
    notifications: { used: number; limit: number | null; remaining: number };
  };
}

interface QuotaItem {
  name: string;
  current: number;
  limit: number | null;
  unit: string;
}

interface BillingInvoice {
  id: string;
  period: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
}

const PLAN_META: Record<string, { label: string; price: number; description: string }> = {
  FREE:       { label: 'Free',       price: 0,   description: 'For testing and small operations' },
  STARTER:    { label: 'Starter',    price: 29,  description: 'Ideal for growing local delivery businesses' },
  GROWTH:     { label: 'Growth',     price: 99,  description: 'For rapidly scaling delivery operations' },
  ENTERPRISE: { label: 'Enterprise', price: 299, description: 'Unlimited usage with dedicated support' },
};

function formatLimit(limit: number | null): string {
  if (limit === null || limit === Infinity) return 'Unlimited';
  return limit.toLocaleString();
}

function calcPercentage(current: number, limit: number | null): number {
  if (!limit || limit === Infinity) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

export default function BillingPage() {
  const { data: subscription, loading: subLoading, error: subError, refetch: refetchSub } =
    useApiQuery<UsageSummary>('/api/v4/billing/subscription');

  const { items: quotas, loading: quotasLoading, error: quotasError } =
    useApiList<QuotaItem>('/api/v4/billing/quotas');

  const { items: invoices, loading: invoicesLoading, error: invoicesError } =
    useApiList<Invoice>('/api/v4/billing/invoices');

  if (subLoading) return <LoadingSkeleton />;
  if (subError) return <ErrorState message={subError.message} onRetry={refetchSub} />;

  const plan = subscription?.plan ?? 'FREE';
  const planMeta = PLAN_META[plan] ?? { label: plan, price: 0, description: '' };
  const status = subscription?.status ?? 'active';
  const nextBillingDate = subscription?.nextBillingDate
    ? new Date(subscription.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Billing & Plans"
        subtitle="Manage your subscription and payment information"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/settings">
          <Button variant="ghost" className="mb-8 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Current Plan Card */}
        <Card className="mb-8 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-blue-500/30 bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="pt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">Current Plan</p>
                <div className="flex items-center gap-3 mt-2">
                  <h3 className="text-3xl font-bold text-white">{planMeta.label}</h3>
                  <Badge
                    variant={
                      status === 'active' ? 'success'
                      : status === 'past_due' ? 'warning'
                      : status === 'trial' ? 'default'
                      : 'danger'
                    }
                  >
                    {status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-gray-400 mt-2">{planMeta.description}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">Monthly Cost</p>
                <h3 className="text-3xl font-bold text-white mt-2">
                  {planMeta.price === 0 ? 'Free' : `$${planMeta.price}`}
                </h3>
                <p className="text-gray-400 mt-2">
                  {planMeta.price === 0 ? 'No charge' : 'Billed monthly'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">Renewal Date</p>
                {nextBillingDate ? (
                  <>
                    <h3 className="text-3xl font-bold text-white mt-2">
                      {new Date(subscription!.nextBillingDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </h3>
                    <p className="text-gray-400 mt-2">Next billing cycle</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-bold text-white mt-2">—</h3>
                    <p className="text-gray-400 mt-2">No upcoming renewal</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-[#1e1e2e]">
              <Button variant="primary" className="bg-blue-500 hover:bg-blue-600">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary" className="border-[#1e1e2e] text-white hover:bg-[#1a1a2e]">
                Downgrade Plan
              </Button>
              <Button variant="ghost" className="text-red-400">
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotasLoading ? (
              <div className="space-y-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-[#1a1a2e] rounded animate-pulse w-40" />
                    <div className="h-2 bg-[#1a1a2e] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : quotasError ? (
              <p className="text-sm text-red-400">Failed to load usage data.</p>
            ) : quotas.length === 0 ? (
              <p className="text-sm text-gray-500">No usage data available for this period.</p>
            ) : (
              <div className="space-y-6">
                {quotas.map((quota) => {
                  const pct = calcPercentage(quota.current, quota.limit);
                  const isUnlimited = quota.limit === null || quota.limit === Infinity;
                  return (
                    <div key={quota.name}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-white">{quota.name}</p>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          {quota.current.toLocaleString()}
                          {' / '}
                          {isUnlimited ? (
                            <span className="flex items-center gap-0.5">
                              <InfinityIcon className="w-3.5 h-3.5 inline" />
                            </span>
                          ) : (
                            formatLimit(quota.limit)
                          )}
                          {' '}{quota.unit}
                        </span>
                      </div>
                      <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                        <div
                          className={isUnlimited ? 'bg-emerald-500 h-2 rounded-full w-full' : 'bg-blue-500 h-2 rounded-full transition-all'}
                          style={isUnlimited ? undefined : { width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {isUnlimited ? 'Unlimited' : `${pct}% of limit used`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-[#1a1a2e] rounded-lg p-5 border border-[#1e1e2e] flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white mb-1">Managed via Shopify Billing</p>
                <p className="text-sm text-gray-400">
                  Payment methods and billing details are managed through your Shopify admin. To update
                  payment information, please visit your Shopify admin dashboard.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-[#1a1a2e] rounded border border-[#1e1e2e] animate-pulse" />
                ))}
              </div>
            ) : invoicesError ? (
              <p className="text-sm text-red-400">Failed to load invoice history.</p>
            ) : invoices.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No invoices yet.</p>
                <p className="text-gray-500 text-xs mt-1">Invoices will appear here once billing cycles complete.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">{invoice.period}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(invoice.date).toLocaleDateString()}
                        {invoice.description ? ` · ${invoice.description}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium text-white">
                          {invoice.currency ? `${invoice.currency.toUpperCase()} ` : ''}
                          ${invoice.amount.toFixed(2)}
                        </p>
                        <Badge
                          variant={
                            invoice.status === 'paid' ? 'success'
                            : invoice.status === 'pending' ? 'warning'
                            : 'danger'
                          }
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        {nextBillingDate && status === 'active' && planMeta.price > 0 && (
          <div className="mt-8 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400">
              Your subscription renews on{' '}
              <strong>{nextBillingDate}</strong>{' '}
              at ${planMeta.price}/month. You can cancel anytime before the renewal date.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
