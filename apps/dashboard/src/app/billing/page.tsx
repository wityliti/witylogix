"use client";

import { useState } from "react";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Table } from "../../components/ui/table";
import {
  CreditCard,
  TrendingUp,
  Download,
  ArrowUpRight,
  Check,
  X,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   BILLING PAGE — Billing & Subscription Management
   ═══════════════════════════════════════════════════════════ */

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
  interval: "month" | "year";
  features: { name: string; included: boolean }[];
  isCurrent?: boolean;
}

interface Invoice {
  id: string;
  date: string;
  period: string;
  amount: number;
  status: "paid" | "pending" | "failed";
}

const CURRENT_PLAN = {
  name: "Professional",
  price: 799,
  interval: "month" as const,
  billingDate: "March 1, 2026",
  nextBillingDate: "April 1, 2026",
};

const QUOTA_RESOURCES: QuotaResource[] = [
  {
    name: "Orders",
    current: 2400,
    limit: 5000,
    unit: "orders/month",
  },
  {
    name: "Shipments",
    current: 4521,
    limit: 10000,
    unit: "shipments/month",
  },
  {
    name: "API Calls",
    current: 2400000,
    limit: 10000000,
    unit: "calls/month",
  },
  {
    name: "Storage",
    current: 85,
    limit: 1000,
    unit: "GB",
  },
  {
    name: "Active Drivers",
    current: 125,
    limit: 500,
    unit: "drivers",
  },
];

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 299,
    interval: "month",
    features: [
      { name: "Up to 1,000 orders/month", included: true },
      { name: "Basic delivery tracking", included: true },
      { name: "Mobile app (web-based)", included: true },
      { name: "Email support", included: true },
      { name: "API access", included: false },
      { name: "Advanced analytics", included: false },
      { name: "Custom integrations", included: false },
      { name: "Dedicated account manager", included: false },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 799,
    interval: "month",
    features: [
      { name: "Up to 10,000 orders/month", included: true },
      { name: "Real-time delivery tracking", included: true },
      { name: "Native mobile app", included: true },
      { name: "Priority email & chat support", included: true },
      { name: "API access", included: true },
      { name: "Advanced analytics & reports", included: true },
      { name: "Custom integrations", included: true },
      { name: "Dedicated account manager", included: false },
    ],
    isCurrent: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 1999,
    interval: "month",
    features: [
      { name: "Unlimited orders/month", included: true },
      { name: "White-label solution", included: true },
      { name: "Custom mobile app", included: true },
      { name: "24/7 phone & dedicated support", included: true },
      { name: "API access (unlimited)", included: true },
      { name: "Custom analytics", included: true },
      { name: "Priority integrations", included: true },
      { name: "Dedicated account manager", included: true },
    ],
  },
];

const INVOICES: Invoice[] = [
  {
    id: "inv-2026-03",
    date: "2026-03-01",
    period: "March 2026",
    amount: 799.99,
    status: "paid",
  },
  {
    id: "inv-2026-02",
    date: "2026-02-01",
    period: "February 2026",
    amount: 799.99,
    status: "paid",
  },
  {
    id: "inv-2026-01",
    date: "2026-01-01",
    period: "January 2026",
    amount: 799.99,
    status: "paid",
  },
  {
    id: "inv-2025-12",
    date: "2025-12-01",
    period: "December 2025",
    amount: 699.99,
    status: "paid",
  },
  {
    id: "inv-2025-11",
    date: "2025-11-01",
    period: "November 2025",
    amount: 699.99,
    status: "paid",
  },
  {
    id: "inv-2025-10",
    date: "2025-10-01",
    period: "October 2025",
    amount: 499.99,
    status: "paid",
  },
];

// Helper function to determine quota percentage and color
const getQuotaColor = (percentage: number): "success" | "warning" | "danger" => {
  if (percentage >= 80) return "danger";
  if (percentage >= 60) return "warning";
  return "success";
};

export default function BillingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  return (
    <>
      <Header
        title="Billing & Subscription"
        subtitle="Manage your subscription plan and payment information"
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Current Plan Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)", background: "linear-gradient(135deg, rgba(245, 166, 35, 0.1) 0%, rgba(245, 166, 35, 0.05) 100%)", borderColor: "var(--wl-primary-500)" }}>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--wl-space-6)" }}>
              {/* Plan Name */}
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", margin: "0 0 var(--wl-space-2) 0" }}>
                  Current Plan
                </p>
                <h2 style={{ fontSize: "var(--wl-text-3xl)", fontWeight: 700, color: "var(--wl-text-primary)", margin: 0 }}>
                  {CURRENT_PLAN.name}
                </h2>
              </div>

              {/* Monthly Cost */}
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", margin: "0 0 var(--wl-space-2) 0" }}>
                  Monthly Cost
                </p>
                <h2 style={{ fontSize: "var(--wl-text-3xl)", fontWeight: 700, color: "var(--wl-text-primary)", margin: 0 }}>
                  ${CURRENT_PLAN.price.toLocaleString()}
                </h2>
              </div>

              {/* Next Billing Date */}
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", margin: "0 0 var(--wl-space-2) 0" }}>
                  Next Billing Date
                </p>
                <h2 style={{ fontSize: "var(--wl-text-3xl)", fontWeight: 700, color: "var(--wl-text-primary)", margin: 0 }}>
                  {CURRENT_PLAN.nextBillingDate}
                </h2>
              </div>
            </div>

            {/* Usage Metrics */}
            <div style={{ marginTop: "var(--wl-space-6)", paddingTop: "var(--wl-space-6)", borderTop: "1px solid var(--wl-border-subtle)" }}>
              <h3 style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", margin: "0 0 var(--wl-space-4) 0" }}>
                Usage This Month
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
                {QUOTA_RESOURCES.map((resource) => {
                  const percentage = (resource.current / resource.limit) * 100;
                  const quotaColor = getQuotaColor(percentage);

                  return (
                    <div key={resource.name}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--wl-space-2)" }}>
                        <p style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", margin: 0 }}>
                          {resource.name}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                          <span style={{ fontSize: "var(--wl-text-sm)", fontFamily: "var(--wl-font-mono)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                            {resource.current.toLocaleString()} / {resource.limit.toLocaleString()}
                          </span>
                          <Badge variant={quotaColor} style={{ minWidth: "50px", textAlign: "center" }}>
                            {percentage.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "var(--wl-bg-surface)", borderRadius: "var(--wl-radius-full)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(percentage, 100)}%`,
                            background:
                              quotaColor === "danger"
                                ? "var(--wl-danger-400)"
                                : quotaColor === "warning"
                                  ? "var(--wl-warning-400)"
                                  : "var(--wl-success-400)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", margin: "var(--wl-space-1) 0 0 0" }}>
                        {resource.unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "var(--wl-space-6)", display: "flex", gap: "var(--wl-space-2)", flexWrap: "wrap" }}>
              <Button variant="primary">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button variant="secondary">
                Downgrade Plan
              </Button>
              <Button variant="ghost" style={{ color: "var(--wl-danger-400)" }}>
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--wl-space-4)" }}>
              {PRICING_PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    border: plan.isCurrent
                      ? "2px solid var(--wl-primary-500)"
                      : "1px solid var(--wl-border-subtle)",
                    cursor: "pointer",
                    background: plan.isCurrent ? "rgba(245, 166, 35, 0.08)" : "var(--wl-bg-elevated)",
                    transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                  }}
                  onMouseEnter={(e) => {
                    if (!plan.isCurrent) {
                      e.currentTarget.style.borderColor = "var(--wl-primary-500)";
                      e.currentTarget.style.background = "rgba(245, 166, 35, 0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!plan.isCurrent) {
                      e.currentTarget.style.borderColor = "var(--wl-border-subtle)";
                      e.currentTarget.style.background = "var(--wl-bg-elevated)";
                    }
                  }}
                >
                  {plan.isCurrent && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--wl-primary-500)" }} />
                  )}

                  <CardContent style={{ paddingTop: plan.isCurrent ? "var(--wl-space-6)" : "var(--wl-space-5)" }}>
                    {/* Badge */}
                    {plan.isCurrent && (
                      <Badge variant="primary" style={{ marginBottom: "var(--wl-space-3)" }}>
                        Current Plan
                      </Badge>
                    )}

                    {/* Plan Name and Price */}
                    <h3 style={{ fontSize: "var(--wl-text-lg)", fontWeight: 700, color: "var(--wl-text-primary)", margin: "0 0 var(--wl-space-1) 0" }}>
                      {plan.name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--wl-space-1)", marginBottom: "var(--wl-space-4)" }}>
                      <span style={{ fontSize: "var(--wl-text-2xl)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                        ${plan.price}
                      </span>
                      <span style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)" }}>
                        /month
                      </span>
                    </div>

                    {/* Features */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-4)" }}>
                      {plan.features.slice(0, expandedPlan === plan.id ? plan.features.length : 3).map((feature, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                          {feature.included ? (
                            <Check className="w-4 h-4" style={{ color: "var(--wl-success-400)", flexShrink: 0 }} />
                          ) : (
                            <X className="w-4 h-4" style={{ color: "var(--wl-text-tertiary)", flexShrink: 0 }} />
                          )}
                          <span
                            style={{
                              fontSize: "var(--wl-text-sm)",
                              color: feature.included ? "var(--wl-text-primary)" : "var(--wl-text-tertiary)",
                              textDecoration: feature.included ? "none" : "line-through",
                            }}
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
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--wl-primary-500)",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "var(--wl-text-sm)",
                            fontWeight: 600,
                            marginTop: "var(--wl-space-2)",
                            textAlign: "left",
                          }}
                        >
                          +{plan.features.length - 3} more features
                        </button>
                      )}
                    </div>

                    {/* Button */}
                    {plan.isCurrent ? (
                      <Button variant="secondary" disabled style={{ width: "100%" }}>
                        Current Plan
                      </Button>
                    ) : (
                      <Button variant="primary" style={{ width: "100%" }}>
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
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ background: "var(--wl-bg-surface)", borderRadius: "var(--wl-radius-lg)", padding: "var(--wl-space-4)", marginBottom: "var(--wl-space-4)", border: "1px solid var(--wl-border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--wl-space-4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
                  <div
                    style={{
                      width: 48,
                      height: 32,
                      background: "linear-gradient(135deg, #1434CB, #0066FF)",
                      borderRadius: "var(--wl-radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: "white", fontSize: "10px", fontWeight: 700 }}>VISA</span>
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", margin: 0 }}>
                      Visa ending in 4242
                    </p>
                    <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", margin: "var(--wl-space-1) 0 0 0" }}>
                      Expires 12/27
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                <Button variant="secondary" size="sm">
                  Update
                </Button>
                <Button variant="ghost" size="sm" style={{ color: "var(--wl-danger-400)" }}>
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
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
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
                    <span style={{ fontFamily: "var(--wl-font-mono)", fontWeight: 600 }}>
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
        <div
          style={{
            marginTop: "var(--wl-space-6)",
            padding: "var(--wl-space-4)",
            borderRadius: "var(--wl-radius-lg)",
            border: "1px solid var(--wl-warning-400)",
            background: "rgba(245, 158, 11, 0.08)",
            display: "flex",
            gap: "var(--wl-space-3)",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", margin: 0 }}>
              Your subscription will automatically renew on <strong>{CURRENT_PLAN.nextBillingDate}</strong> at ${CURRENT_PLAN.price}. You can cancel anytime before the renewal date.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
