import { Header } from "../../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import {
  ChevronLeft,
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  downloadUrl: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "inv-2026-03",
    date: "2026-03-01",
    period: "March 2026",
    amount: 499.99,
    status: "paid",
    downloadUrl: "/invoices/2026-03.pdf",
  },
  {
    id: "inv-2026-02",
    date: "2026-02-01",
    period: "February 2026",
    amount: 499.99,
    status: "paid",
    downloadUrl: "/invoices/2026-02.pdf",
  },
  {
    id: "inv-2026-01",
    date: "2026-01-01",
    period: "January 2026",
    amount: 499.99,
    status: "paid",
    downloadUrl: "/invoices/2026-01.pdf",
  },
  {
    id: "inv-2025-12",
    date: "2025-12-01",
    period: "December 2025",
    amount: 399.99,
    status: "paid",
    downloadUrl: "/invoices/2025-12.pdf",
  },
];

const usageMetrics = [
  {
    name: "API Calls",
    current: 2400000,
    limit: 10000000,
    percentage: 24,
    unit: "calls/month",
  },
  {
    name: "Shipments Processed",
    current: 4521,
    limit: 10000,
    percentage: 45,
    unit: "shipments/month",
  },
  {
    name: "Active Drivers",
    current: 125,
    limit: 500,
    percentage: 25,
    unit: "drivers",
  },
  {
    name: "Storage Used",
    current: 85,
    limit: 1000,
    percentage: 8,
    unit: "GB",
  },
];

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="Billing & Plans"
        subtitle="Manage your subscription and payment information"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Current Plan Card */}
        <Card className="mb-8 bg-gradient-to-r from-[var(--wl-primary)]/10 to-[var(--wl-primary)]/5 border-[var(--wl-primary)]/30">
          <CardContent className="pt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm font-medium text-[var(--wl-text-tertiary)] uppercase">
                  Current Plan
                </p>
                <h3 className="text-3xl font-bold text-[var(--wl-text-primary)] mt-2">
                  Pro
                </h3>
                <p className="text-[var(--wl-text-secondary)] mt-2">
                  Professional tier for growing businesses
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--wl-text-tertiary)] uppercase">
                  Monthly Cost
                </p>
                <h3 className="text-3xl font-bold text-[var(--wl-text-primary)] mt-2">
                  $499.99
                </h3>
                <p className="text-[var(--wl-text-secondary)] mt-2">
                  Billed on 1st of each month
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--wl-text-tertiary)] uppercase">
                  Renewal Date
                </p>
                <h3 className="text-3xl font-bold text-[var(--wl-text-primary)] mt-2">
                  April 1
                </h3>
                <p className="text-[var(--wl-text-secondary)] mt-2">
                  Next billing cycle
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-8 border-t border-[var(--wl-border)]">
              <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button
                variant="outline"
                className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
              >
                Downgrade Plan
              </Button>
              <Button
                variant="ghost"
                className="text-[var(--wl-error)]"
              >
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {usageMetrics.map((metric) => (
              <div key={metric.name}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-[var(--wl-text-primary)]">
                    {metric.name}
                  </p>
                  <span className="text-sm text-[var(--wl-text-tertiary)]">
                    {metric.current.toLocaleString()} / {metric.limit.toLocaleString()}{" "}
                    {metric.unit}
                  </span>
                </div>
                <div className="w-full bg-[var(--wl-bg-tertiary)] rounded-full h-2">
                  <div
                    className="bg-[var(--wl-primary)] h-2 rounded-full transition-all"
                    style={{ width: `${metric.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                  {metric.percentage}% of limit used
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-[var(--wl-bg-tertiary)] rounded-lg p-6 mb-6 border border-[var(--wl-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-br from-[#1434CB] to-[#0066FF] rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--wl-text-primary)]">
                      Visa ending in 4242
                    </p>
                    <p className="text-sm text-[var(--wl-text-tertiary)]">
                      Expires 12/27
                    </p>
                  </div>
                </div>
                <Badge variant="default" className="bg-[var(--wl-success)]">
                  Active
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-secondary)]"
                >
                  Update
                </Button>
                <Button
                  variant="ghost"
                  className="text-[var(--wl-error)]"
                >
                  Remove
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-secondary)]"
            >
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Sarah Johnson"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    defaultValue="Witylogix Inc."
                    className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                  Address
                </label>
                <input
                  type="text"
                  defaultValue="123 Logistics Boulevard, Suite 456"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    defaultValue="San Francisco"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    defaultValue="CA"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    defaultValue="94105"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                  />
                </div>
              </div>
            </div>

            <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90">
              Update Billing Address
            </Button>
          </CardContent>
        </Card>

        {/* Invoice History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[var(--wl-border)] hover:bg-[var(--wl-bg-tertiary)] transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-[var(--wl-text-primary)]">
                      {invoice.period}
                    </p>
                    <p className="text-sm text-[var(--wl-text-tertiary)]">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium text-[var(--wl-text-primary)]">
                        ${invoice.amount.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : invoice.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                        className={
                          invoice.status === "paid"
                            ? "bg-[var(--wl-success)] text-white"
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
                      className="text-[var(--wl-primary)] hover:bg-[var(--wl-bg-secondary)]"
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
        <div className="mt-8 p-4 rounded-lg border border-[var(--wl-warning)]/30 bg-[var(--wl-warning)]/5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--wl-warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--wl-text-secondary)]">
            Your subscription will automatically renew on{" "}
            <strong>April 1, 2026</strong> at $499.99. You can cancel anytime
            before the renewal date.
          </div>
        </div>
      </div>
    </div>
  );
}
