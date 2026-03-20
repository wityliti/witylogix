'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import {
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Check,
  X,
} from 'lucide-react';

interface QuotaResource {
  name: string;
  current: number;
  limit: number;
  unit: string;
}

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

  if (quotasError || plansError || invoicesError) {
    return (
      <ErrorState
        message={quotasError?.message || plansError?.message || invoicesError?.message || 'Failed to load billing data'}
      />
    );

  return (
    <>
      <Header
        title="Billing & Subscription"
        subtitle="Manage your subscription plan and payment information"
      />

      <div className="p-6">
        {/* Current Plan Section */}
        <Card className="mb-6 bg-gradient-to-br from-[rgba(245,166,35,0.1)] to-[rgba(245,166,35,0.05)] border-wl-primary-500">
          <CardContent>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
              {/* Plan Name */}
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase m-0 mb-2">
                  Current Plan
                </p>
                <h2 className="text-3xl font-bold text-wl-text-primary m-0">
                  {CURRENT_PLAN.name}
                </h2>
              </div>

              {/* Monthly Cost */}
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase m-0 mb-2">
                  Monthly Cost
                </p>
                <h2 className="text-3xl font-bold text-wl-text-primary m-0">
                  ${CURRENT_PLAN.price.toLocaleString()}
                </h2>
              </div>

              {/* Next Billing Date */}
              <div>
                <p className="text-xs font-semibold text-wl-text-secondary uppercase m-0 mb-2">
                  Next Billing Date
                </p>
                <h2 className="text-3xl font-bold text-wl-text-primary m-0">
                  {CURRENT_PLAN.nextBillingDate}
                </h2>
              </div>
            </div>

            {/* Usage Metrics */}
            <div className="mt-6 pt-6 border-t border-wl-border-subtle">
              <h3 className="text-sm font-semibold text-wl-text-secondary uppercase m-0 mb-4">
                Usage This Month
              </h3>

              <div className="flex flex-col gap-4">
                {QUOTA_RESOURCES.map((resource) => {
                  const percentage = (resource.current / resource.limit) * 100;
                  const quotaColor = getQuotaColor(percentage);

                  return (
                    <div key={resource.name}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-wl-text-primary m-0">
                          {resource.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-wl-text-primary">
                            {resource.current.toLocaleString()} / {resource.limit.toLocaleString()}
                          </span>
                          <Badge variant={quotaColor} className="min-w-[50px] text-center">
                            {percentage.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-wl-bg-surface rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-[width] duration-300",
                            quotaColor === "danger"
                              ? "bg-wl-danger-400"
                              : quotaColor === "warning"
                                ? "bg-wl-warning-400"
                                : "bg-wl-success-400"
                          )}
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                        {resource.unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-2 flex-wrap">
              <Button variant="primary">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary">
                Downgrade Plan
              </Button>
              <Button variant="ghost" className="text-wl-danger-400">
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
              {PRICING_PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                  className={cn(
                    "relative overflow-hidden cursor-pointer transition-all",
                    plan.isCurrent
                      ? "border-2 border-wl-primary-500 bg-[rgba(245,166,35,0.08)]"
                      : "border border-wl-border-subtle bg-wl-bg-elevated hover:border-wl-primary-500 hover:bg-[rgba(245,166,35,0.04)]"
                  )}
                  onMouseEnter={(e) => {
                    if (!plan.isCurrent) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--wl-primary-500)";
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(245, 166, 35, 0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!plan.isCurrent) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--wl-border-subtle)";
                      (e.currentTarget as HTMLDivElement).style.background = "var(--wl-bg-elevated)";
                    }
                  }}
                >
                  {plan.isCurrent && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-wl-primary-500" />
                  )}

                  <CardContent className={plan.isCurrent ? "pt-6" : "pt-5"}>
                    {/* Badge */}
                    {plan.isCurrent && (
                      <Badge variant="primary" className="mb-3">
                        Current Plan
                      </Badge>
                    )}

                    {/* Plan Name and Price */}
                    <h3 className="text-lg font-bold text-wl-text-primary m-0 mb-1">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-2xl font-bold text-wl-text-primary">
                        ${plan.price}
                      </span>
                      <span className="text-sm text-wl-text-secondary">
                        /month
                      </span>
                    </div>

                    {/* Features */}
                    <div className="flex flex-col gap-2 mb-4">
                      {plan.features.slice(0, expandedPlan === plan.id ? plan.features.length : 3).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-wl-success-400 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-wl-text-tertiary flex-shrink-0" />
                          )}
                          <span className={cn("text-sm", feature.included ? "text-wl-text-primary" : "text-wl-text-tertiary line-through")}>
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
                          className="bg-none border-none text-wl-primary-500 cursor-pointer p-0 text-sm font-semibold mt-2 text-left"
                        >
                          +{plan.features.length - 3} more features
                        </button>
                      )}
                    </div>

                    {/* Button */}
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
          </CardContent>
        </Card>

        {/* Payment Method Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-wl-bg-surface rounded-lg p-4 mb-4 border border-wl-border-subtle">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-br from-[#1434CB] to-[#0066FF] rounded-md flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-wl-text-primary m-0">
                      Visa ending in 4242
                    </p>
                    <p className="text-xs text-wl-text-tertiary m-0 mt-1">
                      Expires 12/27
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Update
                </Button>
                <Button variant="ghost" size="sm" className="text-wl-danger-400">
                  Remove
                </Button>
              </div>
            </div>

            <Button variant="secondary">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Invoice History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table<Invoice>
              columns={[
                {
                  key: "period",
                  header: "Period",
                  sortable: true,
                  width: "150px",
                },
                {
                  key: "date",
                  header: "Date",
                  sortable: true,
                  width: "120px",
                  render: (invoice) => new Date(invoice.date).toLocaleDateString(),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right" as const,
                  width: "120px",
                  render: (invoice) => (
                    <span className="font-mono font-semibold">
                      ${invoice.amount.toFixed(2)}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "120px",
                  render: (invoice) => (
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "success"
                          : invoice.status === "pending"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  ),
                },
                {
                  key: "id",
                  header: "Actions",
                  width: "120px",
                  align: "center" as const,
                  render: () => (
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  ),
                },
              ]}
              data={INVOICES}
            />
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        <div className="mt-6 p-4 rounded-lg border border-wl-warning-400 bg-[rgba(245,158,11,0.08)] flex gap-3">
          <div className="flex-1">
            <p className="text-sm text-wl-text-secondary m-0">
              Your subscription will automatically renew on <strong>{CURRENT_PLAN.nextBillingDate}</strong> at ${CURRENT_PLAN.price}. You can cancel anytime before the renewal date.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
