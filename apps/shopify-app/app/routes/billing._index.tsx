/**
 * Billing & Plan Management Page
 *
 * Implements the Shopify Billing API (BFS requirement):
 *   - Reads active subscription via currentAppInstallation GraphQL query
 *   - Creates/upgrades subscriptions via appSubscriptionCreate mutation
 *   - Redirects to Shopify confirmationUrl for charge approval
 *   - Reads usage metrics from the Witylogix API
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, redirect } from "react-router";
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
  Banner,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify.server";
import { createApiClientFromRequest } from "~/lib/api.server";

// ─── Plan Definitions ──────────────────────────────────────

const PLANS: PlanDetails[] = [
  {
    id: "STARTER",
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
    id: "PROFESSIONAL",
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
    id: "ENTERPRISE",
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
];

const PLAN_PRICES: Record<string, number> = {
  STARTER: 99,
  PROFESSIONAL: 299,
  ENTERPRISE: 999,
};

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

interface BillingPageData {
  currentPlan:
    | (PlanDetails & { isActive: true; subscriptionId: string | null })
    | null;
  nextBillingDate: string | null;
  usage: UsageStats;
  availablePlans: PlanDetails[];
  isTest: boolean;
}

interface ActionResult {
  error?: string;
}

// ─── GraphQL Queries ───────────────────────────────────────

const GET_ACTIVE_SUBSCRIPTION = `#graphql
  query GetActiveSubscription {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        currentPeriodEnd
        test
        lineItems {
          id
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_SUBSCRIPTION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      userErrors {
        field
        message
      }
      appSubscription {
        id
        status
      }
      confirmationUrl
    }
  }
`;

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  // Fetch active subscription from Shopify Billing API
  const subscriptionResponse = await admin.graphql(GET_ACTIVE_SUBSCRIPTION);
  const subscriptionData = await subscriptionResponse.json();

  const activeSubscriptions =
    subscriptionData?.data?.currentAppInstallation?.activeSubscriptions ?? [];
  const activeSub = activeSubscriptions[0] ?? null;

  // Resolve current plan from active Shopify subscription
  let currentPlan: BillingPageData["currentPlan"] = null;
  let nextBillingDate: string | null = null;

  if (activeSub) {
    const lineItem = activeSub.lineItems?.[0];
    const pricing = lineItem?.plan?.pricingDetails;
    const priceAmount = pricing?.price?.amount
      ? Math.round(Number(pricing.price.amount))
      : 0;

    // Match plan by price
    const matchedPlanId =
      Object.entries(PLAN_PRICES).find(([, p]) => p === priceAmount)?.[0] ??
      "PROFESSIONAL";
    const planDef = PLANS.find((p) => p.id === matchedPlanId) ?? PLANS[1];

    currentPlan = {
      ...planDef,
      isActive: true,
      subscriptionId: activeSub.id,
    };
    nextBillingDate = activeSub.currentPeriodEnd ?? null;
  }

  // Fetch usage stats from Witylogix API (graceful fallback to zeros)
  let usage: UsageStats = { orders: 0, shipments: 0, apiCalls: 0 };
  try {
    const api = createApiClientFromRequest(request, session);
    const usageRes = await api.get<{
      data: { orders: number; shipments: number; apiCalls: number };
    }>("/api/v4/shopify/billing/usage");
    if (usageRes?.data) {
      usage = usageRes.data;
    }
  } catch {
    // Usage endpoint may not be available yet; display zeros
  }

  const billingData: BillingPageData = {
    currentPlan,
    nextBillingDate,
    usage,
    availablePlans: PLANS,
    isTest: activeSub?.test ?? true,
  };

  return billingData;
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const planId = formData.get("planId") as string;

  if (!planId || !PLAN_PRICES[planId]) {
    return { error: "Invalid plan selected." } satisfies ActionResult;
  }

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { error: "Plan not found." } satisfies ActionResult;
  }

  const appUrl = process.env.SHOPIFY_APP_URL ?? "https://localhost:9293";
  const returnUrl = `${appUrl}/billing?subscriptionSuccess=true`;
  const isTest = process.env.NODE_ENV !== "production";

  const response = await admin.graphql(CREATE_SUBSCRIPTION, {
    variables: {
      name: `Witylogix ${plan.name} Plan`,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.price.toFixed(2),
                currencyCode: "USD",
              },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
      returnUrl,
      test: isTest,
    },
  });

  const data = await response.json();
  const result = data?.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    return {
      error: result.userErrors
        .map((e: { message: string }) => e.message)
        .join(", "),
    } satisfies ActionResult;
  }

  if (result?.confirmationUrl) {
    return redirect(result.confirmationUrl);
  }

  return {
    error: "Failed to create subscription. Please try again.",
  } satisfies ActionResult;
}

// ─── Component ─────────────────────────────────────────────

export default function BillingIndex() {
  const { currentPlan, nextBillingDate, usage, availablePlans, isTest } =
    useLoaderData<BillingPageData>();

  const submit = useSubmit();
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null);

  const ordersPercent = currentPlan
    ? Math.min(100, (usage.orders / currentPlan.maxOrders) * 100)
    : 0;
  const shipmentsPercent = currentPlan
    ? Math.min(100, (usage.shipments / currentPlan.maxShipments) * 100)
    : 0;
  const apiCallsPercent = currentPlan
    ? Math.min(100, (usage.apiCalls / currentPlan.maxApiCalls) * 100)
    : 0;

  const handleSelectPlan = (planId: string) => {
    setConfirmingPlanId(planId);
  };

  const handleConfirmPlan = () => {
    if (!confirmingPlanId) return;
    const formData = new FormData();
    formData.set("planId", confirmingPlanId);
    submit(formData, { method: "post" });
    setConfirmingPlanId(null);
  };

  const confirmingPlan = PLANS.find((p) => p.id === confirmingPlanId);

  return (
    <Page title="Billing & Plans">
      <Layout>
        {isTest && (
          <Layout.Section>
            <Banner tone="warning">
              <Text as="p" variant="bodySm">
                Test mode — Shopify charges will not be real.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Current Plan Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Current Plan
                  </Text>
                  {currentPlan ? (
                    <Badge tone="success">{currentPlan.name}</Badge>
                  ) : (
                    <Badge>No active plan</Badge>
                  )}
                </BlockStack>
                {currentPlan && (
                  <div>
                    <Text as="p" variant="headingMd">
                      {currentPlan.currency} {currentPlan.price}
                    </Text>
                    <Text as="p" variant="bodySm">
                      per month
                    </Text>
                  </div>
                )}
              </InlineStack>

              <Divider />

              <Box>
                <BlockStack gap="200">
                  {nextBillingDate && (
                    <Text as="p" variant="bodySm">
                      Next billing date:{" "}
                      {new Date(nextBillingDate).toLocaleDateString()}
                    </Text>
                  )}
                  {!currentPlan && (
                    <Text as="p" variant="bodySm">
                      Select a plan below to get started.
                    </Text>
                  )}
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Usage Statistics */}
        {currentPlan && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Monthly Usage
                </Text>

                <Box>
                  <BlockStack gap="300">
                    <Box>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="p" variant="bodySm">
                            Orders
                          </Text>
                          <Text as="span" variant="bodySm">
                            {usage.orders.toLocaleString()} /{" "}
                            {currentPlan.maxOrders.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <ProgressBar progress={ordersPercent} tone="primary" />
                      </BlockStack>
                    </Box>

                    <Box>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="p" variant="bodySm">
                            Shipments
                          </Text>
                          <Text as="span" variant="bodySm">
                            {usage.shipments.toLocaleString()} /{" "}
                            {currentPlan.maxShipments.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <ProgressBar
                          progress={shipmentsPercent}
                          tone="primary"
                        />
                      </BlockStack>
                    </Box>

                    <Box>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="p" variant="bodySm">
                            API Calls
                          </Text>
                          <Text as="span" variant="bodySm">
                            {usage.apiCalls.toLocaleString()} /{" "}
                            {currentPlan.maxApiCalls.toLocaleString()}
                          </Text>
                        </InlineStack>
                        <ProgressBar
                          progress={apiCallsPercent}
                          tone="primary"
                        />
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Plan Comparison */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                {currentPlan ? "Change Plan" : "Choose a Plan"}
              </Text>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                {availablePlans.map((plan) => {
                  const isCurrent = currentPlan?.id === plan.id;
                  const isUpgrade =
                    currentPlan && plan.price > currentPlan.price;

                  return (
                    <Box
                      key={plan.id}
                      padding="400"
                      background={
                        isCurrent ? "bg-surface-selected" : "bg-surface"
                      }
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

                        {isCurrent ? (
                          <Button variant="secondary" disabled>
                            Current Plan
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => handleSelectPlan(plan.id)}
                          >
                            {!currentPlan
                              ? "Select Plan"
                              : isUpgrade
                                ? "Upgrade"
                                : "Downgrade"}
                          </Button>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Plan Confirmation Modal */}
      {confirmingPlan && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            maxWidth: 400,
            width: "90%",
            background: "var(--p-color-bg-surface)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid var(--p-color-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Confirm Plan Change
            </Text>
            <Text as="p" variant="bodySm">
              You&apos;re switching to the{" "}
              <strong>{confirmingPlan.name}</strong> plan for{" "}
              <strong>
                {confirmingPlan.currency} {confirmingPlan.price}/month
              </strong>
              . You&apos;ll be redirected to Shopify to approve the charge.
            </Text>
            <InlineStack gap="200">
              <Button
                variant="secondary"
                onClick={() => setConfirmingPlanId(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmPlan}>
                Continue to Shopify
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
                We encountered an error while loading your billing data. Please
                try refreshing the page.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
