'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
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
  ExternalLink,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   BILLING PAGE — Subscription & invoice management
   Real API: GET /api/v4/billing/subscription
             GET /api/v4/billing/plans
             GET /api/v4/billing/invoices
   ═══════════════════════════════════════════════════════════ */

type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

interface PlanFeatures {
  shipmentsPerMonth: number;
  driversLimit: number;
  apiCallsPerMonth: number;
  notificationsPerMonth: number;
  hasRouteOptimization: boolean;
  hasAnalytics: boolean;
  hasMultiCarrier: boolean;
  hasDedicatedSupport: boolean;
  monthlyPrice: number;
}

interface PlanComparison {
  tier: PlanTier;
  features: PlanFeatures;
  displayName: string;
  description: string;
  recommendedFor: string;
}

interface UsageLimits {
  shipments: { used: number; limit: number; remaining: number };
  drivers: { used: number; limit: number; remaining: number };
  apiCalls: { used: number; limit: number; remaining: number };
  notifications: { used: number; limit: number; remaining: number };
}

interface SubscriptionSummary {
  plan: PlanTier;
  status: 'active' | 'trial' | 'cancelled' | 'past_due';
  billingCycle: string;
  nextBillingDate: string | null;
  limits: UsageLimits;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
}


const getQuotaColor = (pct: number): 'success' | 'warning' | 'danger' => {
  if (pct >= 90) return 'danger';
  if (pct >= 65) return 'warning';
  return 'success';
};

const planDisplayName: Record<PlanTier, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  ENTERPRISE: 'Enterprise',
};

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'active' || s === 'COMPLETED' || s === 'paid') return 'success';
  if (s === 'trial') return 'info';
  if (s === 'past_due' || s === 'failed' || s === 'FAILED') return 'danger';
  if (s === 'pending' || s === 'PENDING') return 'warning';
  return 'default';
};

function limitLabel(v: number): string {
  return v === -1 || v === Infinity || v > 1_000_000 ? '∞' : v.toLocaleString();
}

function UsageBar({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
}) {
  const isUnlimited = limit === -1 || limit === Infinity || limit > 1_000_000;
  const pct = isUnlimited ? 0 : Math.min(100, (used / limit) * 100);
  const color = isUnlimited ? 'success' : getQuotaColor(pct);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-300">{label}</p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-400">
            {used.toLocaleString()} / {limitLabel(limit)} {unit}
          </span>
          {!isUnlimited && (
            <Badge variant={color} className="min-w-[52px] text-center">
              {Math.round(pct)}%
            </Badge>
          )}
          {isUnlimited && <Badge variant="success">Unlimited</Badge>}
        </div>
      </div>
      {!isUnlimited && (
        <div className="w-full h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              color === 'danger' ? 'bg-red-500' : color === 'warning' ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  expanded,
  onToggle,
}: {
  plan: PlanComparison;
  isCurrent: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const boolFeatures = [
    { label: 'Route optimisation', value: plan.features.hasRouteOptimization },
    { label: 'Advanced analytics', value: plan.features.hasAnalytics },
    { label: 'Multi-carrier shipping', value: plan.features.hasMultiCarrier },
    { label: 'Dedicated support', value: plan.features.hasDedicatedSupport },
  ];

  const capacityFeatures = [
    { label: `${limitLabel(plan.features.shipmentsPerMonth)} shipments/month`, value: true },
    { label: `${limitLabel(plan.features.driversLimit)} drivers`, value: true },
    { label: `${limitLabel(plan.features.apiCallsPerMonth)} API calls/month`, value: true },
    { label: `${limitLabel(plan.features.notificationsPerMonth)} notifications/month`, value: true },
  ];

  const allFeatures = [...capacityFeatures, ...boolFeatures];
  const visible = expanded ? allFeatures : allFeatures.slice(0, 4);

  return (
    <Card
      onClick={onToggle}
      className={cn(
        'relative overflow-hidden cursor-pointer transition-all border-2',
        isCurrent ? 'border-blue-500 bg-blue-500/5' : 'border-[#1e1e2e] bg-[#12121a] hover:border-blue-500/40',
      )}
    >
      {isCurrent && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />}
      <CardContent className={cn('pt-5', isCurrent && 'pt-6')}>
        {isCurrent && <Badge variant="primary" className="mb-3">Current Plan</Badge>}
        <h3 className="text-lg font-bold text-white mb-1">{plan.displayName}</h3>
        <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
        <div className="flex items-baseline gap-1 mb-5">
          <span className="text-2xl font-bold text-white">${plan.features.monthlyPrice}</span>
          <span className="text-gray-500 text-sm">/month</span>
        </div>

        <div className="space-y-2.5 mb-5">
          {visible.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              {f.value ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
              )}
              <span className={cn('text-xs', f.value ? 'text-gray-300' : 'text-gray-600 line-through')}>
                {f.label}
              </span>
            </div>
          ))}
          {!expanded && allFeatures.length > 4 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium mt-1 transition-colors"
            >
              +{allFeatures.length - 4} more
            </button>
          )}
        </div>

        {isCurrent ? (
          <Button variant="secondary" disabled className="w-full text-xs">
            Current Plan
          </Button>
        ) : (
          <Button variant="primary" className="w-full text-xs" onClick={(e) => e.stopPropagation()}>
            Upgrade
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const {
    data: subscription,
    loading: subLoading,
    error: subError,
    refetch: refetchSub,
  } = useApiQuery<SubscriptionSummary>('/api/v4/billing/subscription');

  const {
    data: plans,
    loading: plansLoading,
    error: plansError,
  } = useApiQuery<PlanComparison[]>('/api/v4/billing/plans');

  const {
    data: invoices,
    loading: invoicesLoading,
    error: invoicesError,
  } = useApiQuery<Invoice[]>('/api/v4/billing/invoices');

  const loading = subLoading || plansLoading || invoicesLoading;
  const error = subError || plansError || invoicesError;

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={error?.message ?? 'Failed to load billing data'}
        onRetry={refetchSub}
      />
    );
  }

  const currentPlanTier = subscription?.plan ?? 'FREE';
  const sub = subscription;

  return (
    <>
      <Header
        title="Billing & Subscription"
        subtitle="Manage your subscription plan and billing information"
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-screen">
        {/* Current Plan */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 border-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Plan</p>
                <h2 className="text-3xl font-bold text-white">{planDisplayName[currentPlanTier]}</h2>
                {sub?.status && (
                  <Badge variant={statusVariant(sub.status)} className="mt-2">
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1).replace('_', ' ')}
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Cycle</p>
                <h2 className="text-3xl font-bold text-white capitalize">{sub?.billingCycle ?? 'Monthly'}</h2>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Next Billing</p>
                <h2 className="text-3xl font-bold text-white">
                  {sub?.nextBillingDate
                    ? new Date(sub.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </h2>
              </div>
            </div>

            {/* Usage meters */}
            {sub?.limits && (
              <div className="mt-8 pt-8 border-t border-white/[0.06]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6">Usage This Month</h3>
                <div className="space-y-5">
                  <UsageBar
                    label="Shipments"
                    used={sub.limits.shipments.used}
                    limit={sub.limits.shipments.limit}
                    unit=""
                  />
                  <UsageBar
                    label="Drivers"
                    used={sub.limits.drivers.used}
                    limit={sub.limits.drivers.limit}
                    unit=""
                  />
                  <UsageBar
                    label="API Calls"
                    used={sub.limits.apiCalls.used}
                    limit={sub.limits.apiCalls.limit}
                    unit=""
                  />
                  <UsageBar
                    label="Notifications"
                    used={sub.limits.notifications.used}
                    limit={sub.limits.notifications.limit}
                    unit=""
                  />
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary">Manage Subscription</Button>
              <Button variant="ghost" className="text-red-400 hover:text-red-300">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        {(plans ?? []).length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Plan Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(plans ?? []).map((plan) => (
                <PlanCard
                  key={plan.tier}
                  plan={plan}
                  isCurrent={plan.tier === currentPlanTier}
                  expanded={expandedPlan === plan.tier}
                  onToggle={() => setExpandedPlan(expandedPlan === plan.tier ? null : plan.tier)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Payment Method — managed via Shopify */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-sm">
              <CreditCard className="w-4 h-4" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4 p-4 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e]">
              <div className="w-10 h-7 bg-gradient-to-br from-blue-600 to-blue-400 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-bold">SHP</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Managed via Shopify Billing</p>
                <p className="text-xs text-gray-400 mt-1">
                  Payment details are handled through your Shopify subscription. Update them in your Shopify admin.
                </p>
              </div>
              <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs">
                <ExternalLink className="w-3 h-3" />
                Open Shopify
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-sm">
              <TrendingUp className="w-4 h-4" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(invoices ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">No invoices yet</p>
              </div>
            ) : (
              <Table<Invoice>
                columns={[
                  {
                    key: 'description',
                    header: 'Description',
                    render: (inv) => (
                      <span className="text-sm text-gray-300">{inv.description}</span>
                    ),
                  },
                  {
                    key: 'date',
                    header: 'Date',
                    sortable: true,
                    width: '130px',
                    render: (inv) => (
                      <span className="text-sm text-gray-400">
                        {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    header: 'Amount',
                    align: 'right' as const,
                    width: '110px',
                    render: (inv) => (
                      <span className="font-mono font-semibold text-white text-sm">
                        {inv.currency ?? 'USD'} {inv.amount.toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    width: '110px',
                    render: (inv) => (
                      <Badge variant={statusVariant(inv.status)}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1).toLowerCase()}
                      </Badge>
                    ),
                  },
                  {
                    key: 'id',
                    header: '',
                    width: '56px',
                    align: 'center' as const,
                    render: () => (
                      <Button variant="ghost" size="sm" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    ),
                  },
                ]}
                data={invoices ?? []}
              />
            )}
          </CardContent>
        </Card>

        {/* Auto-renewal notice */}
        {sub?.nextBillingDate && sub.status === 'active' && (
          <div className="p-4 rounded-lg border border-amber-500/25 bg-amber-500/10 flex gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">
              Your subscription auto-renews on{' '}
              <strong className="text-white">
                {new Date(sub.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>
              . Cancel any time before then to avoid being charged.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
