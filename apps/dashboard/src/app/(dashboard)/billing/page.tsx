'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import {
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── Types matching the real API response shapes ────────────────────────────

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  unit: string;
}

interface InvoiceItem {
  id: string;
  date: string;
  period: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  downloadUrl?: string;
}

interface BillingOverview {
  plan: string;
  planTier: string;
  monthlyPrice: number;
  renewalDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  usageMetrics: UsageMetric[];
  billingAddress: Record<string, string> | null;
  invoices: InvoiceItem[];
}

interface PlanFeatures {
  shipmentsPerMonth: number;
  driversLimit: number;
  apiCallsPerMonth: number;
  notificationsPerMonth: number;
  monthlyPrice: number;
}

interface PlanComparison {
  tier: string;
  features: PlanFeatures;
  displayName: string;
  description: string;
  recommendedFor: string;
}

interface PlansResponse {
  plans: PlanComparison[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const getQuotaColor = (pct: number): 'success' | 'warning' | 'danger' => {
  if (pct >= 80) return 'danger';
  if (pct >= 60) return 'warning';
  return 'success';
};

const fmt = (n: number): string =>
  n === Infinity || n >= 999999999 ? '∞' : n.toLocaleString();

const invoiceStatusVariant = (
  status: string
): 'success' | 'warning' | 'danger' | 'default' => {
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'completed') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'failed') return 'danger';
  return 'default';
};

// ── Feature list for plan cards ─────────────────────────────────────────────

function planFeatureList(f: PlanFeatures): { label: string; included: boolean }[] {
  return [
    { label: `${fmt(f.shipmentsPerMonth)} shipments/month`, included: true },
    { label: `${fmt(f.driversLimit)} drivers`, included: true },
    { label: `${fmt(f.apiCallsPerMonth)} API calls/month`, included: f.apiCallsPerMonth > 0 },
    { label: `${fmt(f.notificationsPerMonth)} notifications/month`, included: f.notificationsPerMonth > 0 },
    { label: 'Advanced analytics', included: f.monthlyPrice > 0 },
    { label: 'Priority support', included: f.monthlyPrice >= 99 },
    { label: 'Custom integrations', included: f.monthlyPrice >= 99 && f.shipmentsPerMonth === Infinity },
    { label: 'Dedicated account manager', included: f.shipmentsPerMonth === Infinity },
  ];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const {
    data: billing,
    loading: billingLoading,
    error: billingError,
    refetch: refetchBilling,
  } = useApiQuery<BillingOverview>('/api/v4/billing/');

  const {
    data: plansData,
    loading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useApiQuery<PlansResponse>('/api/v4/billing/plans');

  const loading = billingLoading || plansLoading;
  const error = billingError || plansError;

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <ErrorState
        message={error.message || 'Failed to load billing information'}
        onRetry={() => {
          refetchBilling();
          refetchPlans();
        }}
      />
    );
  }

  if (!billing) {
    return (
      <ErrorState
        message="Billing information is not available"
        onRetry={refetchBilling}
      />
    );
  }

  const plans = plansData?.plans ?? [];
  const currentTier = billing.planTier?.toUpperCase();

  return (
    <>
      <Header
        title="Billing & Subscription"
        subtitle="Manage your subscription plan and billing information"
      />

      <div className="p-6 space-y-6 bg-wl-bg-root min-h-screen">
        {/* ── Current Plan Card ───────────────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-wl-info-500/30 border-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">Current Plan</p>
                <h2 className="text-3xl font-bold text-wl-text-primary">{billing.plan}</h2>
              </div>
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">Monthly Cost</p>
                <h2 className="text-3xl font-bold text-wl-text-primary">
                  ${billing.monthlyPrice.toLocaleString()}
                </h2>
              </div>
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase mb-2">Next Billing Date</p>
                <h2 className="text-3xl font-bold text-wl-text-primary">
                  {new Date(billing.renewalDate).toLocaleDateString()}
                </h2>
              </div>
            </div>

            {/* Usage Metrics */}
            {billing.usageMetrics.length > 0 && (
              <div className="mt-8 pt-8 border-t border-wl-border-default">
                <h3 className="text-sm font-semibold text-wl-text-secondary uppercase mb-6">Usage This Month</h3>
                <div className="space-y-6">
                  {billing.usageMetrics.map((resource) => {
                    const quotaColor = getQuotaColor(resource.percentage);
                    return (
                      <div key={resource.name}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-wl-neutral-300">{resource.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-wl-text-secondary">
                              {resource.current.toLocaleString()} / {fmt(resource.limit)}
                            </span>
                            <Badge variant={quotaColor} className="min-w-[55px] text-center">
                              {Math.round(resource.percentage)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-wl-bg-elevated rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-300 rounded-full',
                              quotaColor === 'danger'
                                ? 'bg-wl-danger-500'
                                : quotaColor === 'warning'
                                  ? 'bg-wl-warning-500'
                                  : 'bg-wl-success-500'
                            )}
                            style={{ width: `${Math.min(resource.percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-wl-text-tertiary mt-1">{resource.unit}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary">Manage Plan</Button>
              <Button variant="ghost" className="text-wl-danger-400 hover:text-wl-danger-400">
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Plan Comparison ─────────────────────────────────────────────── */}
        {plans.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-wl-text-primary mb-4">Plan Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.tier === currentTier;
                const isExpanded = expandedPlan === plan.tier;
                const features = planFeatureList(plan.features);
                const visibleFeatures = isExpanded ? features : features.slice(0, 4);

                return (
                  <Card
                    key={plan.tier}
                    className={cn(
                      'relative overflow-hidden cursor-pointer transition-all border-2',
                      isCurrent
                        ? 'border-wl-info-500 bg-wl-info-bg'
                        : 'border-wl-border-default bg-wl-bg-surface hover:border-wl-info-500/50'
                    )}
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.tier)}
                  >
                    {isCurrent && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-wl-info-500" />
                    )}
                    <CardContent className={cn('pt-6', isCurrent && 'pt-8')}>
                      {isCurrent && (
                        <Badge variant="primary" className="mb-4">Current Plan</Badge>
                      )}
                      <h3 className="text-lg font-bold text-wl-text-primary mb-1">{plan.displayName}</h3>
                      <p className="text-xs text-wl-text-secondary mb-3">{plan.description}</p>
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="text-3xl font-bold text-white">
                          ${plan.features.monthlyPrice}
                        </span>
                        <span className="text-wl-text-secondary">/month</span>
                      </div>

                      <div className="space-y-2.5 mb-4">
                        {visibleFeatures.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            {feat.included ? (
                              <Check className="w-4 h-4 text-wl-success-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <X className="w-4 h-4 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
                            )}
                            <span className={cn(
                              'text-xs',
                              feat.included ? 'text-wl-neutral-300' : 'text-wl-text-tertiary line-through'
                            )}>
                              {feat.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {features.length > 4 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedPlan(isExpanded ? null : plan.tier); }}
                          className="flex items-center gap-1 text-wl-info-400 hover:text-wl-info-400 text-xs font-medium mb-4 transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3 h-3" /> Show less</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" /> +{features.length - 4} more</>
                          )}
                        </button>
                      )}

                      {isCurrent ? (
                        <Button variant="secondary" disabled className="w-full text-xs">
                          Current Plan
                        </Button>
                      ) : (
                        <Button variant="primary" className="w-full text-xs">
                          {plan.features.monthlyPrice < billing.monthlyPrice ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Payment Method ──────────────────────────────────────────────── */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billing.billingAddress ? (
              <div className="bg-wl-bg-elevated rounded-lg p-4 border border-wl-border-default text-sm text-wl-neutral-300">
                <p className="font-medium text-white mb-1">Billing Address</p>
                <p>{billing.billingAddress.line1}</p>
                {billing.billingAddress.line2 && <p>{billing.billingAddress.line2}</p>}
                <p>{billing.billingAddress.city}, {billing.billingAddress.state} {billing.billingAddress.postalCode}</p>
                <p>{billing.billingAddress.country}</p>
              </div>
            ) : (
              <div className="bg-wl-bg-elevated rounded-lg p-5 border border-wl-border-default">
                <p className="text-sm text-wl-text-secondary">
                  Payment is processed through your Shopify store. Manage payment methods in your Shopify admin.
                </p>
              </div>
            )}
            <Button variant="secondary" className="w-full">
              Manage Payment in Shopify
            </Button>
          </CardContent>
        </Card>

        {/* ── Invoice History ─────────────────────────────────────────────── */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <TrendingUp className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {billing.invoices.length === 0 ? (
              <div className="text-center py-10 text-wl-text-secondary">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No invoices yet</p>
                <p className="text-xs text-wl-text-tertiary mt-1">
                  Invoices will appear here after your first billing cycle
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left py-3 text-xs font-semibold text-wl-text-secondary uppercase">Period</th>
                      <th className="text-left py-3 text-xs font-semibold text-wl-text-secondary uppercase">Date</th>
                      <th className="text-right py-3 text-xs font-semibold text-wl-text-secondary uppercase">Amount</th>
                      <th className="text-left py-3 pl-4 text-xs font-semibold text-wl-text-secondary uppercase">Status</th>
                      <th className="text-center py-3 text-xs font-semibold text-wl-text-secondary uppercase">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wl-border-default">
                    {billing.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-wl-neutral-300">{inv.period}</td>
                        <td className="py-3 text-wl-text-secondary">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-white">
                          ${Number(inv.amount).toFixed(2)}{' '}
                          <span className="text-xs font-normal text-wl-text-tertiary">
                            {inv.currency?.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 pl-4">
                          <Badge variant={invoiceStatusVariant(inv.status)}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 text-center">
                          {inv.downloadUrl ? (
                            <a href={inv.downloadUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" aria-label="Download invoice">
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          ) : (
                            <Button variant="ghost" size="sm" disabled aria-label="PDF not available">
                              <Download className="w-4 h-4 opacity-30" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Auto-Renewal Notice ─────────────────────────────────────────── */}
        <div className="p-5 rounded-lg border border-wl-warning-500/30 bg-wl-warning-500/10 flex gap-4">
          <AlertCircle className="w-5 h-5 text-wl-warning-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-wl-neutral-300">
            Your subscription will automatically renew on{' '}
            <strong className="text-white">
              {new Date(billing.renewalDate).toLocaleDateString()}
            </strong>{' '}
            at ${billing.monthlyPrice.toLocaleString()}/month. You can manage your subscription
            in your Shopify admin.
          </p>
        </div>
      </div>
    </>
  );
}
