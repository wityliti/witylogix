'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import {
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: { name: string; included: boolean }[];
  isCurrent?: boolean;
}

interface Invoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

interface QuotaResource {
  name: string;
  current: number;
  limit: number;
  unit: string;
}

interface SubscriptionData {
  name: string;
  price: number;
  nextBillingDate: string;
}

const getQuotaColor = (percentage: number): 'success' | 'warning' | 'danger' => {
  if (percentage >= 80) return 'danger';
  if (percentage >= 60) return 'warning';
  return 'success';
};

export default function BillingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const { items: quotas, loading: quotasLoading, error: quotasError } = useApiList<QuotaResource>('/api/v4/billing/quotas');
  const { items: plans, loading: plansLoading, error: plansError } = useApiList<PricingPlan>('/api/v4/billing/plans');
  const { items: invoices, loading: invoicesLoading, error: invoicesError } = useApiList<Invoice>('/api/v4/billing/invoices');

  const loading = quotasLoading || plansLoading || invoicesLoading;
  const error = quotasError || plansError || invoicesError;

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={error?.message || 'Failed to load billing data'}
      />
    );
  }

  const currentPlan: SubscriptionData = {
    name: 'Professional',
    price: 299,
    nextBillingDate: '2026-04-20',
  };

  const quotasData = quotas || [
    { name: 'API Requests', current: 2400, limit: 3000, unit: 'requests/month' },
    { name: 'Storage', current: 85, limit: 100, unit: 'GB' },
    { name: 'Users', current: 12, limit: 20, unit: 'active seats' },
  ];

  const plansData = plans || [
    {
      id: '1',
      name: 'Starter',
      price: 99,
      interval: 'month' as const,
      isCurrent: false,
      features: [
        { name: 'Up to 1000 API requests/month', included: true },
        { name: '10 GB storage', included: true },
        { name: '5 active users', included: true },
        { name: 'Email support', included: true },
        { name: 'Advanced analytics', included: false },
      ],
    },
    {
      id: '2',
      name: 'Professional',
      price: 299,
      interval: 'month' as const,
      isCurrent: true,
      features: [
        { name: 'Up to 10000 API requests/month', included: true },
        { name: '100 GB storage', included: true },
        { name: '20 active users', included: true },
        { name: 'Priority email support', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Custom integrations', included: false },
      ],
    },
    {
      id: '3',
      name: 'Enterprise',
      price: 999,
      interval: 'month' as const,
      isCurrent: false,
      features: [
        { name: 'Unlimited API requests', included: true },
        { name: 'Unlimited storage', included: true },
        { name: 'Unlimited users', included: true },
        { name: '24/7 phone & email support', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Custom integrations', included: true },
      ],
    },
  ];

  const invoicesData = invoices || [
    { id: '1', period: 'Mar 2026', date: '2026-03-20', amount: 299, status: 'paid' as const },
    { id: '2', period: 'Feb 2026', date: '2026-02-20', amount: 299, status: 'paid' as const },
    { id: '3', period: 'Jan 2026', date: '2026-01-20', amount: 299, status: 'paid' as const },
  ];

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
                <h2 className="text-3xl font-bold text-white">{new Date(currentPlan.nextBillingDate).toLocaleDateString()}</h2>
              </div>
            </div>

            {/* Usage Metrics */}
            <div className="mt-8 pt-8 border-t border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-6">Usage This Month</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plansData.map((plan) => (
              <Card
                key={plan.id}
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                className={cn(
                  'relative overflow-hidden cursor-pointer transition-all border-2',
                  plan.isCurrent
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-[#1e1e2e] bg-[#12121a] hover:border-blue-500/50'
                )}
              >
                {plan.isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                )}

                <CardContent className={cn('pt-6', plan.isCurrent && 'pt-8')}>
                  {plan.isCurrent && (
                    <Badge variant="primary" className="mb-4">
                      Current Plan
                    </Badge>
                  )}

                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features
                      .slice(0, expandedPlan === plan.id ? plan.features.length : 3)
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

                    {plan.features.length > 3 && expandedPlan !== plan.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPlan(plan.id);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm font-semibold mt-2 transition-colors"
                      >
                        +{plan.features.length - 3} more features
                      </button>
                    )}
                  </div>

                  {plan.isCurrent ? (
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
            ))}
          </div>
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
            <div className="bg-[#1a1a2e] rounded-lg p-5 border border-[#1e1e2e]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-9 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Visa ending in 4242</p>
                    <p className="text-xs text-gray-500 mt-1">Expires 12/27</p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
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
                      ${invoice.amount.toFixed(2)}
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
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        <div className="p-5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-300">
              Your subscription will automatically renew on{' '}
              <strong className="text-white">{new Date(currentPlan.nextBillingDate).toLocaleDateString()}</strong> at $
              {currentPlan.price}. You can cancel anytime before the renewal date.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
