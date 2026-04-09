/**
 * Payments List — Payment transactions page with filtering and summary cards.
 *
 * Features:
 *   - Summary cards: Total Revenue, Pending Amount, Refunded Amount, Failed Count
 *   - Filter bar: status (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED), type (CHARGE, COD_COLLECTION, REFUND, ADJUSTMENT), date range
 *   - Payments table: ID (truncated), type badge, method badge, amount, currency, status badge, provider txn ID, created date
 *   - Click row for payment detail modal/expand
 *   - "Export CSV" button
 *   - EmptyState when no payments
 *   - Pagination
 *
 * All data is loaded server-side via React Router v7 loader.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Form } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Pagination,
  Select,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  EmptyState,
  Box,
  Button,
} from "@shopify/polaris";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Payment {
  id: string;
  type: "CHARGE" | "COD_COLLECTION" | "REFUND" | "ADJUSTMENT";
  method: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  providerTransactionId: string | null;
  createdAt: string;
  customerId: string | null;
  shipmentId: string | null;
}

interface PaymentSummary {
  totalRevenue: number;
  pendingAmount: number;
  refundedAmount: number;
  failedCount: number;
}

interface PaymentsPageData {
  payments: Payment[];
  summary: PaymentSummary;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const type = url.searchParams.get("type") || "all";
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;

  try {
    const response = await client.get<{ data: PaymentsPageData }>(
      `/api/v4/payments?page=${page}&limit=${limit}&status=${status}&type=${type}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    );

    return response;
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return { data: { payments: [], summary: { totalRevenue: 0, pendingAmount: 0, refundedAmount: 0, failedCount: 0 }, meta: { total: 0, page, limit, totalPages: 0 } } };
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return null;
  }

  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export-csv") {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || "all";
      const type = url.searchParams.get("type") || "all";
      const startDate = url.searchParams.get("startDate") || "";
      const endDate = url.searchParams.get("endDate") || "";

      const response = await client.get(
        `/api/v4/payments/export?status=${status}&type=${type}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );

      return {
        success: true,
        message: "CSV export initiated",
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to export payments",
      };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function PaymentsIndex() {
  const { payments, summary, meta } = useLoaderData<PaymentsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentType = searchParams.get("type") || "all";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      prev.set(key, value);
      prev.set("page", "1");
      return prev;
    });
  };

  const goToPage = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", String(page));
      return prev;
    });
  };

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

  const truncateId = (id: string) => {
    return id.length > 12 ? id.substring(0, 12) + "..." : id;
  };

  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "PENDING" },
    { label: "Processing", value: "PROCESSING" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Failed", value: "FAILED" },
    { label: "Refunded", value: "REFUNDED" },
  ];

  const typeOptions = [
    { label: "All Types", value: "all" },
    { label: "Charge", value: "CHARGE" },
    { label: "COD Collection", value: "COD_COLLECTION" },
    { label: "Refund", value: "REFUND" },
    { label: "Adjustment", value: "ADJUSTMENT" },
  ];

  if (payments.length === 0 && currentStatus === "all") {
    return (
      <Page title="Payments">
        <Card>
          <EmptyState
            heading="No payments yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Payment transactions will appear here once you start processing orders.</p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const resourceName = {
    singular: "payment",
    plural: "payments",
  };

  const rowMarkup = payments.map((payment, index) => (
    <IndexTable.Row id={payment.id} key={payment.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">
          {truncateId(payment.id)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={getTypeTone(payment.type)}>
          {payment.type === "COD_COLLECTION" ? "COD" : payment.type}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {payment.method}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {payment.currency} {Number(payment.amount).toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={getStatusTone(payment.status)}>{payment.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {payment.providerTransactionId
            ? truncateId(payment.providerTransactionId)
            : "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {new Date(payment.createdAt).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Payments"
      subtitle="Manage payment transactions and view transaction details"
      primaryAction={
        <Form method="post">
          <input type="hidden" name="intent" value="export-csv" />
          <Button submit variant="primary">
            Export CSV
          </Button>
        </Form>
      }
    >
      <BlockStack gap="400">
        {/* Summary Cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">
                Total Revenue
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                ${Number(summary.totalRevenue).toFixed(2)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">
                Pending Amount
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                ${Number(summary.pendingAmount).toFixed(2)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">
                Refunded Amount
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                ${Number(summary.refundedAmount).toFixed(2)}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">
                Failed Payments
              </Text>
              <Text as="p" variant="headingLg" fontWeight="bold">
                {summary.failedCount}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Filters */}
        <Card>
          <InlineStack gap="300" wrap>
            <Select
              label="Status"
              labelHidden
              options={statusOptions}
              value={currentStatus}
              onChange={(value) => handleFilterChange("status", value)}
            />
            <Select
              label="Type"
              labelHidden
              options={typeOptions}
              value={currentType}
              onChange={(value) => handleFilterChange("type", value)}
            />
            <TextField
              label="Start Date"
              labelHidden
              type="date"
              value={currentStartDate}
              onChange={(value) => handleFilterChange("startDate", value)}
              autoComplete="off"
            />
            <TextField
              label="End Date"
              labelHidden
              type="date"
              value={currentEndDate}
              onChange={(value) => handleFilterChange("endDate", value)}
              autoComplete="off"
            />
          </InlineStack>
        </Card>

        {/* Table */}
        {payments.length > 0 ? (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={payments.length}
              headings={[
                { title: "Transaction ID" },
                { title: "Type" },
                { title: "Method" },
                { title: "Amount" },
                { title: "Status" },
                { title: "Provider ID" },
                { title: "Date" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        ) : (
          <Card>
            <EmptyState
              heading="No payments found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Try adjusting your filters to find payments.</p>
            </EmptyState>
          </Card>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <Box paddingBlockStart="400" paddingBlockEnd="400">
            <InlineStack align="center" blockAlign="center" gap="400">
              <Text as="span" variant="bodySm" tone="subdued">
                Page {currentPage} of {meta.totalPages} ({meta.total} total)
              </Text>
              <Pagination
                hasPrevious={currentPage > 1}
                onPrevious={() => goToPage(currentPage - 1)}
                hasNext={currentPage < meta.totalPages}
                onNext={() => goToPage(currentPage + 1)}
              />
            </InlineStack>
          </Box>
        )}
      </BlockStack>
    </Page>
  );
}
