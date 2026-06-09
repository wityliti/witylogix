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
import { useApiList, useApiQuery } from '@/hooks/use-api';
import {
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Check,
  X,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  billingCycle: string;
  shipmentsPerMonth: number;
  driversLimit: number;
  apiCallsPerMonth: number;
  hasAnalytics: boolean;
  hasRouteOptimization: boolean;
  hasMultiCarrier: boolean;
  hasDedicatedSupport: boolean;
}

interface Invoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
}

interface QuotaResource {
  name: string;
  current: number;
  limit: number;
  unit: string;
}

interface SubscriptionSummary {
  plan: string;
  status: string;
  billingCycle: string;
  nextBillingDate: string | null;
  limits: {
    shipments: { used: number; limit: number };
    drivers: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
    notifications: { used: number; limit: number };
  };
}

interface PaymentMethodData {
  id: string;
  type: string;
  displayName: string;
  lastDigits?: string;
  expiryDate?: string;
  isDefault: boolean;
  isActive: boolean;
}

const getQuotaColor = (percentage: number): 'success' | 'warning' | 'danger' => {
  if (percentage >= 80) return 'danger';
  if (percentage >= 60) return 'warning';
  return 'success';
};

const PLAN_PRICE: Record<string, number> = {
  FREE: 0, STARTER: 29, GROWTH: 99, ENTERPRISE: 299,
};

function planFeatureList(plan: PricingPlan): { name: string; included: boolean }[] {
  return [
    { name: `${plan.shipmentsPerMonth.toLocaleString()} shipments/month`, included: true },
    { name: `${plan.driversLimit} drivers`, included: true },
    { name: `${plan.apiCallsPerMonth.toLocaleString()} API calls/month`, included: true },
    { name: 'Route optimization', included: plan.hasRouteOptimization },
    { name: 'Advanced analytics', included: plan.hasAnalytics },
    { name: 'Multi-carrier', included: plan.hasMultiCarrier },
    { name: 'Dedicated support', included: plan.hasDedicatedSupport },
  ];
}

export default function BillingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const { items: quotas, loading: quotasLoading, error: quotasError } =
    useApiList<QuotaResource>('/api/v4/billing/quotas');
  const { items: plans, loading: plansLoading, error: plansError } =
    useApiList<PricingPlan>('/api/v4/billing/plans');
  const { items: invoices, loading: invoicesLoading, error: invoicesError } =
    useApiList<Invoice>('/api/v4/billing/invoices');
  const { data: subscription, loading: subLoading, error: subError } =
    useApiQuery<SubscriptionSummary>('/api/v4/billing/subscription');
  const { items: paymentMethods, loading: pmLoading } =
    useApiList<PaymentMethodData>('/api/v4/payment-methods/payment-methods');

  const loading = quotasLoading || plansLoading || invoicesLoading || subLoading;
  const error = quotasError || plansError || invoicesError || subError;

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={error?.message || 'Failed to load billing data'}
      />
    );
  }

  const planName = subscription?.plan ?? 'FREE';
  const planPrice = PLAN_PRICE[planName] ?? 0;
  const nextBillingDate = subscription?.nextBillingDate
    ? new Date(subscription.nextBillingDate).toLocaleDateString()
    : 'N/A';

  const currentPlan = { name: planName, price: planPrice, nextBillingDate };
  const quotasData = quotas;
  const plansData = plans;
  const invoicesData = invoices;
  const primaryMethod = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0] ?? null;

  return (
    <>
      <Header
        title="Billing & Subscription"
        subtitle="Manage your subscription plan and billing information"
      />

      <div className="p-6 space-y-6 bg-[#0a0a0f] min-h-screen">
        {/* Current Plan Section */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 border-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Current Plan</p>
                <h2 className="text-3xl font-bold text-white">{currentPlan.name}</h2>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Monthly Cost</p>
                <h2 className="text-3xl font-bold text-white">${currentPlan.price.toLocaleString()}</h2>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Next Billing Date</p>
                <h2 className="text-3xl font-bold text-white">{currentPlan.nextBillingDate}</h2>
              </div>
            </div>

            {/* Usage Metrics */}
            <div className="mt-8 pt-8 border-t border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-6">Usage This Month</h3>
              {quotasData.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Zap className="w-4 h-4" />
                  <span>No usage data available yet</span>
                </div>
              ) : (
              <div className="space-y-6">
                {quotasData.map((resource) => {
                  const percentage = (resource.current / resource.limit) * 100;
                  const quotaColor = getQuotaColor(percentage);

                  return (
                    <div key={resource.name}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-300">{resource.name}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-gray-400">
                            {resource.current.toLocaleString()} / {resource.limit.toLocaleString()}
                          </span>
                          <Badge variant={quotaColor} className="min-w-[55px] text-center">
                            {Math.round(percentage)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-300 rounded-full',
                            quotaColor === 'danger'
                              ? 'bg-red-500'
                              : quotaColor === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{resource.unit}</p>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary">Downgrade Plan</Button>
              <Button variant="ghost" className="text-red-400 hover:text-red-300">
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Plan Comparison</h2>
          {plansData.length === 0 ? (
            <div className="p-8 text-center text-gray-500 border border-[#1e1e2e] rounded-xl bg-[#12121a]">
              No plans available at this time.
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plansData.map((plan) => {
              const isCurrent = plan.name === planName;
              const features = planFeatureList(plan);
              return (
              <Card
                key={plan.id ?? plan.name}
                onClick={() => setExpandedPlan(expandedPlan === (plan.id ?? plan.name) ? null : (plan.id ?? plan.name))}
                className={cn(
                  'relative overflow-hidden cursor-pointer transition-all border-2',
                  isCurrent
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-[#1e1e2e] bg-[#12121a] hover:border-blue-500/50'
                )}
              >
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                )}

                <CardContent className={cn('pt-6', isCurrent && 'pt-8')}>
                  {isCurrent && (
                    <Badge variant="primary" className="mb-4">
                      Current Plan
                    </Badge>
                  )}

                  <h3 className="text-lg font-bold text-white mb-2 capitalize">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold text-white">${plan.monthlyPrice}</span>
                    <span className="text-gray-400">/month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {features
                      .slice(0, expandedPlan === (plan.id ?? plan.name) ? features.length : 4)
                      .map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={cn(
                              'text-sm',
                              feature.included ? 'text-gray-300' : 'text-gray-500 line-through'
                            )}
                          >
                            {feature.name}
                          </span>
                        </div>
                      ))}

                    {features.length > 4 && expandedPlan !== (plan.id ?? plan.name) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPlan(plan.id ?? plan.name);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm font-semibold mt-2 transition-colors"
                      >
                        +{features.length - 4} more features
                      </button>
                    )}
                  </div>

                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button variant="primary" className="w-full">
                      Upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
          )}
        </div>

        {/* Payment Method Section */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pmLoading ? (
              <div className="h-20 bg-[#1a1a2e] rounded-lg animate-pulse" />
            ) : primaryMethod ? (
            <div className="bg-[#1a1a2e] rounded-lg p-5 border border-[#1e1e2e]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-9 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white text-xs font-bold uppercase">{primaryMethod.type.slice(0, 4)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{primaryMethod.displayName}</p>
                    {primaryMethod.expiryDate && (
                      <p className="text-xs text-gray-500 mt-1">Expires {primaryMethod.expiryDate}</p>
                    )}
                  </div>
                </div>
                <Badge variant={primaryMethod.isActive ? 'success' : 'default'}>
                  {primaryMethod.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Update
                </Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                  Remove
                </Button>
              </div>
            </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">No payment methods on file.</p>
            )}

            <Button variant="secondary" className="w-full">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Invoice History Section */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesData.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No invoices yet. Your billing history will appear here.</p>
              </div>
            ) : (
            <Table<Invoice>
              columns={[
                {
                  key: 'period',
                  header: 'Period',
                  sortable: true,
                  width: '150px',
                },
                {
                  key: 'date',
                  header: 'Date',
                  sortable: true,
                  width: '120px',
                  render: (invoice) => new Date(invoice.date).toLocaleDateString(),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right' as const,
                  width: '120px',
                  render: (invoice) => (
                    <span className="font-mono font-semibold text-white">
                      ${Number(invoice.amount).toFixed(2)}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  width: '120px',
                  render: (invoice) => (
                    <Badge
                      variant={
                        invoice.status === 'paid'
                          ? 'success'
                          : invoice.status === 'pending'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  ),
                },
                {
                  key: 'id',
                  header: 'Actions',
                  width: '100px',
                  align: 'center' as const,
                  render: () => (
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  ),
                },
              ]}
              data={invoicesData}
            />
            )}
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        {currentPlan.nextBillingDate !== 'N/A' && (
          <div className="p-5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex gap-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-300">
                Your subscription will automatically renew on{' '}
                <strong className="text-white">{currentPlan.nextBillingDate}</strong> at $
                {currentPlan.price}/month. You can cancel anytime before the renewal date.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
