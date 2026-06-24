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
  Download,
  ArrowUpRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  downloadUrl: string;
}

interface SubscriptionSummary {
  plan: string;
  status: string;
  nextBillingDate: string | null;
  limits: {
    shipments: { used: number; limit: number };
    drivers: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
    notifications: { used: number; limit: number };
  };
}

export default function BillingPage() {
  const { data: subscription, loading: subLoading, error: subError, refetch: refetchSub } = useApiQuery<SubscriptionSummary>('/api/v4/billing/subscription');
  const { items: invoices, loading: invLoading, error: invError, refetch: refetchInv } = useApiList<Invoice>('/api/v4/billing/invoices');

  const loading = subLoading || invLoading;
  const error = subError || invError;
  const refetch = () => { refetchSub(); refetchInv(); };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const usageMetrics = subscription ? [
    { name: "Shipments", current: subscription.limits.shipments.used, limit: subscription.limits.shipments.limit, percentage: Math.round((subscription.limits.shipments.used / (subscription.limits.shipments.limit || 1)) * 100), unit: "deliveries" },
    { name: "Drivers", current: subscription.limits.drivers.used, limit: subscription.limits.drivers.limit, percentage: Math.round((subscription.limits.drivers.used / (subscription.limits.drivers.limit || 1)) * 100), unit: "active" },
    { name: "API Calls", current: subscription.limits.apiCalls.used, limit: subscription.limits.apiCalls.limit, percentage: Math.round((subscription.limits.apiCalls.used / (subscription.limits.apiCalls.limit || 1)) * 100), unit: "requests" },
  ] : [];

  const planName = subscription?.plan ?? "—";
  const renewalDate = subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : "—";

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Billing & Plans"
        subtitle="Manage your subscription and payment information"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Current Plan Card */}
        <Card className="mb-8 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-blue-500/30 bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="pt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">
                  Current Plan
                </p>
                <h3 className="text-3xl font-bold text-white mt-2">
                  {planName}
                </h3>
                <p className="text-gray-400 mt-2">
                  {subscription?.status ? `Status: ${subscription.status}` : "—"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">
                  Monthly Cost
                </p>
                <h3 className="text-3xl font-bold text-white mt-2">
                  {invoices[0] ? `$${invoices[0].amount.toFixed(2)}` : "—"}
                </h3>
                <p className="text-gray-400 mt-2">
                  Most recent charge
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 uppercase">
                  Renewal Date
                </p>
                <h3 className="text-3xl font-bold text-white mt-2">
                  {renewalDate}
                </h3>
                <p className="text-gray-400 mt-2">
                  Next billing cycle
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-8 border-t border-[#1e1e2e]">
              <Button variant="primary" className="bg-blue-500 hover:bg-blue-600">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button
                variant="secondary"
                className="border-[#1e1e2e] text-white hover:bg-[#1a1a2e]"
              >
                Downgrade Plan
              </Button>
              <Button
                variant="ghost"
                className="text-red-400"
              >
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
          <CardContent className="space-y-6">
            {usageMetrics.map((metric) => (
              <div key={metric.name}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-white">
                    {metric.name}
                  </p>
                  <span className="text-sm text-gray-500">
                    {metric.current.toLocaleString()} / {metric.limit.toLocaleString()}{" "}
                    {metric.unit}
                  </span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${metric.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {metric.percentage}% of limit used
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethod ? (
              <div className="bg-[#1a1a2e] rounded-lg p-6 mb-6 border border-[#1e1e2e]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gradient-to-br from-[#1434CB] to-[#0066FF] rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{(paymentMethod.brand ?? 'CARD').toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {paymentMethod.brand ?? 'Card'} ending in {paymentMethod.last4 ?? '****'}
                      </p>
                      {paymentMethod.expiryMonth && paymentMethod.expiryYear && (
                        <p className="text-sm text-gray-500">
                          Expires {String(paymentMethod.expiryMonth).padStart(2, '0')}/{String(paymentMethod.expiryYear).slice(-2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="success" className="bg-emerald-500">
                    {paymentMethod.status ?? 'Active'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="border-[#1e1e2e] text-white hover:bg-[#0a0a0f]">Update</Button>
                  <Button variant="ghost" className="text-red-400">Remove</Button>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1a2e] rounded-lg p-6 mb-6 border border-dashed border-[#1e1e2e] text-center">
                <CreditCard className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No payment method on file</p>
              </div>
            )}

            <Button
              variant="secondary"
              className="border-[#1e1e2e] text-white hover:bg-[#1a1a2e]"
            >
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="text-white">Billing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    defaultValue={billingAddress?.name ?? ''}
                    placeholder="Full name"
                    className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    defaultValue={billingAddress?.company ?? ''}
                    placeholder="Company name"
                    className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Address
                </label>
                <input
                  type="text"
                  defaultValue={billingAddress?.address ?? ''}
                  placeholder="Street address"
                  className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    defaultValue={billingAddress?.city ?? ''}
                    placeholder="City"
                    className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    defaultValue={billingAddress?.state ?? ''}
                    placeholder="State"
                    className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    defaultValue={billingAddress?.postalCode ?? ''}
                    placeholder="Postal code"
                    className="w-full px-4 py-2 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <Button variant="primary" className="bg-blue-500 hover:bg-blue-600">
              Update Billing Address
            </Button>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No invoices yet.</p>
            )}
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No invoices yet</p>
              ) : null}
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {invoice.period}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium text-white">
                        ${invoice.amount.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "success"
                            : invoice.status === "pending"
                              ? "warning"
                              : "danger"
                        }
                        className={
                          invoice.status === "paid"
                            ? "bg-emerald-500 text-white"
                            : ""
                        }
                      >
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:bg-[#1a1a2e]"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auto-renewal Notice */}
        <div className="mt-8 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            Your subscription will automatically renew on{" "}
            <strong>{renewalDate}</strong>. You can cancel anytime before the renewal date.
          </div>
        </div>
      </div>
    </div>
  );
}
