/**
 * Payment Detail — Payment transaction detail page with status management.
 *
 * Features:
 *   - Payment info card: full ID, type, method, amount, currency, status with timeline
 *   - Status transition buttons (based on valid transitions)
 *   - Related shipment link (if shipmentId exists)
 *   - Provider transaction reference
 *   - Metadata display (JSON pretty-printed)
 *   - Refund button (only for COMPLETED payments)
 *   - Back to payments link
 *
 * Loader fetches single payment with relations from API.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useActionData } from "react-router";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  DescriptionList,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface PaymentStatusEvent {
  status: string;
  timestamp: string;
}

interface Payment {
  id: string;
  type: "CHARGE" | "COD_COLLECTION" | "REFUND" | "ADJUSTMENT";
  method: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  providerTransactionId: string | null;
  shipmentId: string | null;
  customerId: string | null;
  metadata: Record<string, unknown> | null;
  statusHistory: PaymentStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

interface PaymentDetailData {
  payment: Payment;
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const paymentId = params.id;
  if (!paymentId) {
    throw new Error("Payment ID not found");
  }

  try {
    const response = await client.get<{ data: PaymentDetailData }>(
      `/api/v4/payments/${paymentId}`
    );

    return response;
  } catch (error) {
    console.error("Failed to fetch payment:", error);
    throw new Error("Payment not found");
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return null;
  }

  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const paymentId = params.id;

  if (!paymentId) {
    return { success: false, error: "Payment ID not found" };
  }

  if (intent === "update-status") {
    const newStatus = formData.get("newStatus");
    try {
      await client.patch(`/api/v4/payments/${paymentId}`, {
        status: newStatus,
      });
      return { success: true, message: "Payment status updated" };
    } catch (error) {
      return { success: false, error: "Failed to update payment status" };
    }
  }

  if (intent === "refund") {
    try {
      await client.post(`/api/v4/payments/${paymentId}/refund`, {});
      return { success: true, message: "Refund initiated" };
    } catch (error) {
      return { success: false, error: "Failed to initiate refund" };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function PaymentDetail() {
  const { payment } = useLoaderData<PaymentDetailData>();
  const actionData = useActionData();
  const [isRefunding, setIsRefunding] = useState(false);

  const getStatusTone = (status: string): "success" | "info" | "warning" | "critical" | undefined => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "PROCESSING":
        return "info";
      case "PENDING":
        return "warning";
      case "FAILED":
        return "critical";
      default:
        return undefined;
    }
  };

  const getTypeTone = (type: string): "info" | "success" | "critical" | "warning" | undefined => {
    switch (type) {
      case "CHARGE":
        return "info";
      case "COD_COLLECTION":
        return "success";
      case "REFUND":
        return "critical";
      case "ADJUSTMENT":
        return "warning";
      default:
        return undefined;
    }
  };

  const getValidTransitions = (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      PENDING: ["PROCESSING", "FAILED"],
      PROCESSING: ["COMPLETED", "FAILED"],
      COMPLETED: [],
      FAILED: [],
      REFUNDED: [],
    };
    return transitions[currentStatus] || [];
  };

  const validTransitions = getValidTransitions(payment.status);

  const paymentInfoItems = [
    { term: "Payment ID", description: payment.id },
    {
      term: "Type",
      description: (
        <Badge tone={getTypeTone(payment.type)}>
          {payment.type === "COD_COLLECTION" ? "COD" : payment.type}
        </Badge>
      ),
    },
    { term: "Method", description: payment.method },
    { term: "Amount", description: `${payment.currency} ${payment.amount.toFixed(2)}` },
    {
      term: "Status",
      description: (
        <Badge tone={getStatusTone(payment.status)}>{payment.status}</Badge>
      ),
    },
    {
      term: "Provider Transaction ID",
      description: payment.providerTransactionId || "\u2014",
    },
    { term: "Created", description: new Date(payment.createdAt).toLocaleString() },
    { term: "Updated", description: new Date(payment.updatedAt).toLocaleString() },
  ];

  return (
    <Page
      backAction={{ content: "Payments", url: "/payments" }}
      title="Payment Details"
    >
      <Layout>
        {/* Action Feedback */}
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success">{actionData.message}</Banner>
          </Layout.Section>
        )}
        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">{actionData.error}</Banner>
          </Layout.Section>
        )}

        {/* Payment Information */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Payment Information
              </Text>
              <DescriptionList items={paymentInfoItems} />

              {/* Status Transitions */}
              {validTransitions.length > 0 && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="span" variant="bodySm" fontWeight="semibold" tone="subdued">
                      Update Status
                    </Text>
                    <InlineStack gap="200">
                      {validTransitions.map((status) => (
                        <Form key={status} method="post">
                          <input type="hidden" name="intent" value="update-status" />
                          <input type="hidden" name="newStatus" value={status} />
                          <Button submit size="slim">
                            Mark as {status}
                          </Button>
                        </Form>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </>
              )}

              {/* Refund Button */}
              {payment.status === "COMPLETED" && (
                <>
                  <Divider />
                  <Form method="post">
                    <input type="hidden" name="intent" value="refund" />
                    <Button
                      submit
                      tone="critical"
                      disabled={isRefunding}
                      onClick={() => setIsRefunding(true)}
                    >
                      {isRefunding ? "Processing..." : "Refund Payment"}
                    </Button>
                  </Form>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Related Shipment */}
        {payment.shipmentId && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Related Shipment
                </Text>
                <Link to={`/shipments/${payment.shipmentId}`}>
                  <Button variant="plain">
                    View Shipment {payment.shipmentId}
                  </Button>
                </Link>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Status History */}
        {payment.statusHistory && payment.statusHistory.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Status History
                </Text>
                <BlockStack gap="300">
                  {payment.statusHistory.map((event, index) => (
                    <InlineStack key={index} gap="300" blockAlign="center">
                      <Badge tone={getStatusTone(event.status)}>
                        {event.status}
                      </Badge>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {new Date(event.timestamp).toLocaleString()}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Metadata */}
        {payment.metadata && Object.keys(payment.metadata).length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Metadata
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <pre>
                    <Text as="span" variant="bodySm">
                      {JSON.stringify(payment.metadata, null, 2)}
                    </Text>
                  </pre>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
