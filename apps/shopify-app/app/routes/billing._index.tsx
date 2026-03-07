/**
 * Billing & Plan Management Page
 *
 * Features:
 *   - Current plan card with plan name, price, and usage stats
 *   - Plan comparison grid with 3 tiers (Starter, Professional, Enterprise)
 *   - Usage progress bars (Orders, Shipments, API Calls)
 *   - Invoice history table with status badges
 *   - Upgrade/Downgrade buttons with action modals
 *   - Mock data only (no real API calls)
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Box,
  ProgressBar,
  Divider,
} from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: "monthly" | "annual";
  features: string[];
  maxOrders: number;
  maxShipments: number;
  maxApiCalls: number;
}

interface UsageStats {
  orders: number;
  shipments: number;
  apiCalls: number;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  pdfUrl: string;
}

interface BillingPageData {
  currentPlan: PlanDetails & { isActive: true };
  nextBillingDate: string;
  usage: UsageStats;
  availablePlans: PlanDetails[];
  invoices: Invoice[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  // Mock data only - no real API calls
  const billingData: BillingPageData = {
    currentPlan: {
      id: "plan-professional",
      name: "Professional",
      price: 299,
      currency: "USD",
      billingCycle: "monthly",
      isActive: true,
      features: [
        "Up to 10,000 orders/month",
        "Advanced analytics",
        "Priority support",
        "Custom integrations",
      ],
      maxOrders: 10000,
      maxShipments: 15000,
      maxApiCalls: 100000,
    },
    nextBillingDate: "2026-04-07",
    usage: {
      orders: 3245,
      shipments: 5120,
      apiCalls: 45230,
    },
    availablePlans: [
      {
        id: "plan-starter",
        name: "Starter",
        price: 99,
        currency: "USD",
        billingCycle: "monthly",
        features: [
          "Up to 1,000 orders/month",
          "Basic analytics",
          "Email support",
          "Standard integrations",
        ],
        maxOrders: 1000,
        maxShipments: 1500,
        maxApiCalls: 10000,
      },
      {
        id: "plan-professional",
        name: "Professional",
        price: 299,
        currency: "USD",
        billingCycle: "monthly",
        features: [
          "Up to 10,000 orders/month",
          "Advanced analytics",
          "Priority support",
          "Custom integrations",
        ],
        maxOrders: 10000,
        maxShipments: 15000,
        maxApiCalls: 100000,
      },
      {
        id: "plan-enterprise",
        name: "Enterprise",
        price: 999,
        currency: "USD",
        billingCycle: "monthly",
        features: [
          "Unlimited orders",
          "Real-time analytics",
          "24/7 support",
          "Custom development",
        ],
        maxOrders: 999999,
        maxShipments: 999999,
        maxApiCalls: 999999,
      },
    ],
    invoices: [
      {
        id: "inv-2026-03",
        date: "2026-03-07",
        amount: 299.0,
        status: "paid",
        pdfUrl: "/invoices/2026-03.pdf",
      },
      {
        id: "inv-2026-02",
        date: "2026-02-07",
        amount: 299.0,
        status: "paid",
        pdfUrl: "/invoices/2026-02.pdf",
      },
      {
        id: "inv-2026-01",
        date: "2026-01-07",
        amount: 299.0,
        status: "paid",
        pdfUrl: "/invoices/2026-01.pdf",
      },
      {
        id: "inv-2025-12",
        date: "2025-12-07",
        amount: 299.0,
        status: "paid",
        pdfUrl: "/invoices/2025-12.pdf",
      },
    ],
  };

  return billingData;
}

// ─── Component ─────────────────────────────────────────────

export default function BillingIndex() {
  const { currentPlan, nextBillingDate, usage, availablePlans, invoices } =
    useLoaderData<BillingPageData>();

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const ordersPercent = (usage.orders / currentPlan.maxOrders) * 100;
  const shipmentsPercent = (usage.shipments / currentPlan.maxShipments) * 100;
  const apiCallsPercent = (usage.apiCalls / currentPlan.maxApiCalls) * 100;

  const handlePlanChange = (planId: string) => {
    setSelectedPlan(planId);
    setShowPlanModal(true);
  };

  const confirmPlanChange = () => {
    // Mock action - would call API in production
    setShowPlanModal(false);
    setSelectedPlan(null);
  };

  return (
    <Page title="Billing & Plans">
      <Layout>
        {/* Current Plan Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Current Plan
                  </Text>
                  <Badge>{currentPlan.name}</Badge>
                </BlockStack>
                <div>
                  <Text as="p" variant="headingMd">
                    {currentPlan.currency} {currentPlan.price}
                  </Text>
                  <Text as="p" variant="bodySm">
                    per month
                  </Text>
                </div>
              </InlineStack>

              <Divider />

              <Box>
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    Next billing date: {new Date(nextBillingDate).toLocaleDateString()}
                  </Text>
                  <InlineStack gap="300">
                    <Button variant="secondary" onClick={() => handlePlanChange("downgrade")}>
                      Downgrade Plan
                    </Button>
                    <Button variant="primary" onClick={() => handlePlanChange("upgrade")}>
                      Upgrade Plan
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Usage Statistics */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Monthly Usage
              </Text>

              <Box>
                <BlockStack gap="300">
                  {/* Orders */}
                  <Box>
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodySm">
                          Orders
                        </Text>
                        <Text as="span" variant="bodySm">
                          {usage.orders.toLocaleString()} / {currentPlan.maxOrders.toLocaleString()}
                        </Text>
                      </InlineStack>
                      <ProgressBar progress={ordersPercent} tone="primary" />
                    </BlockStack>
                  </Box>

                  {/* Shipments */}
                  <Box>
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodySm">
                          Shipments
                        </Text>
                        <Text as="span" variant="bodySm">
                          {usage.shipments.toLocaleString()} / {currentPlan.maxShipments.toLocaleString()}
                        </Text>
                      </InlineStack>
                      <ProgressBar progress={shipmentsPercent} tone="primary" />
                    </BlockStack>
                  </Box>

                  {/* API Calls */}
                  <Box>
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodySm">
                          API Calls
                        </Text>
                        <Text as="span" variant="bodySm">
                          {usage.apiCalls.toLocaleString()} / {currentPlan.maxApiCalls.toLocaleString()}
                        </Text>
                      </InlineStack>
                      <ProgressBar progress={apiCallsPercent} tone="primary" />
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Plan Comparison */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Compare Plans
              </Text>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                {availablePlans.map((plan) => (
                  <Box
                    key={plan.id}
                    padding="400"
                    background={plan.id === currentPlan.id ? "bg-surface-selected" : "bg-surface"}
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="300">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">
                          {plan.name}
                        </Text>
                        <Text as="p" variant="headingLg">
                          {plan.currency} {plan.price}
                        </Text>
                        <Text as="p" variant="bodySm">
                          per month
                        </Text>
                      </BlockStack>

                      <Divider />

                      <BlockStack gap="200">
                        {plan.features.map((feature, idx) => (
                          <Text key={idx} as="p" variant="bodySm">
                            ✓ {feature}
                          </Text>
                        ))}
                      </BlockStack>

                      <Divider />

                      {plan.id === currentPlan.id ? (
                        <Button variant="secondary" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => handlePlanChange(plan.id)}
                        >
                          {plan.price > currentPlan.price ? "Upgrade" : "Downgrade"}
                        </Button>
                      )}
                    </BlockStack>
                  </Box>
                ))}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Invoice History */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Invoice History
              </Text>

              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderRowStyle}>
                      <th style={tableHeaderCellStyle}>Date</th>
                      <th style={tableHeaderCellStyle}>Amount</th>
                      <th style={tableHeaderCellStyle}>Status</th>
                      <th style={tableHeaderCellStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} style={tableRowStyle}>
                        <td style={tableCellStyle}>
                          {new Date(invoice.date).toLocaleDateString()}
                        </td>
                        <td style={tableCellStyle}>
                          {invoice.amount.toLocaleString("en-US", {
                            style: "currency",
                            currency: invoice.amount > 0 ? "USD" : "EUR",
                          })}
                        </td>
                        <td style={tableCellStyle}>
                          <Badge
                            tone={
                              invoice.status === "paid"
                                ? "success"
                                : invoice.status === "pending"
                                  ? "attention"
                                  : "critical"
                            }
                          >
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </td>
                        <td style={tableCellStyle}>
                          <Button
                            variant="plain"
                            onClick={() => {
                              // Mock download
                            }}
                          >
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Plan Change Modal (placeholder) */}
      {showPlanModal && (
        <div style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            maxWidth: 400,
            background: "var(--p-color-bg-surface)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--p-color-border)",
          }}
        >
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Confirm Plan Change
            </Text>
            <Text as="p" variant="bodySm">
              Your plan change will take effect at the next billing cycle.
            </Text>
            <InlineStack gap="200">
              <Button variant="secondary" onClick={() => setShowPlanModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmPlanChange}>
                Confirm
              </Button>
            </InlineStack>
          </BlockStack>
        </div>
      )}
    </Page>
  );
}

// ─── Error Boundary ────────────────────────────────────────

export function ErrorBoundary() {
  return (
    <Page title="Billing & Plans">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Error Loading Billing Information
              </Text>
              <Text as="p" variant="bodySm">
                We encountered an error while loading your billing data. Please try refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ─── Styles ────────────────────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const tableHeaderRowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tableHeaderCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};
