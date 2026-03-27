/**
 * Customers List — Full-width customer list with search, filters, and segmentation.
 *
 * Features:
 *   - Search bar (name, email, phone)
 *   - Status filter (active, inactive, all)
 *   - Segment chips: All, VIP, New, At Risk
 *   - Customer table: name, email, phone, orders count, total spent, last order date, sync status
 *   - Click row to expand/view customer details
 *   - "Sync Customers" action button
 *   - Pagination
 *   - EmptyState when no customers
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Pagination,
  TextField,
  Select,
  ButtonGroup,
  Button,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Customer {
  id: string;
  shopifyCustomerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  syncStatus: "synced" | "pending" | "failed";
  segment: "vip" | "new" | "at_risk" | "regular";
  createdAt: string;
}

interface CustomersPageData {
  customers: Customer[];
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
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "all";
  const segment = url.searchParams.get("segment") || "all";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;

  try {
    // Fetch customers from API with filters
    const response = await client.get<{ data: CustomersPageData }>(
      `/api/v4/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${status}&segment=${segment}`
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { customers: [], meta: { total: 0, page, limit, totalPages: 0 } };
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

  if (intent === "sync-customers") {
    try {
      await client.post("/api/v4/customers/sync", {});
      return { success: true, message: "Customer sync initiated" };
    } catch (error) {
      return {
        success: false,
        error: "Failed to initiate customer sync",
      };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function CustomersIndex() {
  const { customers, meta } = useLoaderData<CustomersPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "all";
  const currentSegment = searchParams.get("segment") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleSearch = (value: string) => {
    setSearchParams((prev) => {
      prev.set("search", value);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleStatusChange = (status: string) => {
    setSearchParams((prev) => {
      prev.set("status", status);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleSegmentChange = (segment: string) => {
    setSearchParams((prev) => {
      prev.set("segment", segment);
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

  const getSegmentBadgeTone = (segment: string): "warning" | "success" | "critical" | undefined => {
    switch (segment) {
      case "vip":
        return "warning";
      case "new":
        return "success";
      case "at_risk":
        return "critical";
      default:
        return undefined;
    }
  };

  const getSegmentLabel = (segment: string): string => {
    switch (segment) {
      case "vip":
        return "VIP";
      case "new":
        return "New";
      case "at_risk":
        return "At Risk";
      default:
        return "Regular";
    }
  };

  const getSyncStatusBadgeTone = (status: string): "success" | "warning" | "critical" | undefined => {
    switch (status) {
      case "synced":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "critical";
      default:
        return undefined;
    }
  };

  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  if (customers.length === 0 && !currentSearch && currentStatus === "all") {
    return (
      <Page title="Customers">
        <Card>
          <EmptyState
            heading="No customers yet"
            action={{
              content: "Sync Customers Now",
              onAction: () => {
                const form = document.createElement("form");
                form.method = "post";
                form.innerHTML = '<input type="hidden" name="intent" value="sync-customers">';
                document.body.appendChild(form);
                form.submit();
              },
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Your customers will appear here once you start syncing customer
              data from Shopify.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const resourceName = {
    singular: "customer",
    plural: "customers",
  };

  const rowMarkup = customers.map((customer, index) => (
    <IndexTable.Row id={customer.id} key={customer.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Link to={`/customers/${customer.id}`}>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {customer.firstName} {customer.lastName}
            </Text>
          </Link>
          <Badge tone={getSegmentBadgeTone(customer.segment)}>
            {getSegmentLabel(customer.segment)}
          </Badge>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {customer.email || "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {customer.phone || "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {customer.ordersCount}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          ${customer.totalSpent.toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {customer.lastOrderDate
            ? new Date(customer.lastOrderDate).toLocaleDateString()
            : "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={getSyncStatusBadgeTone(customer.syncStatus)}
        >
          {customer.syncStatus === "synced"
            ? "Synced"
            : customer.syncStatus === "pending"
            ? "Pending"
            : "Failed"}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Customers"
      subtitle={`Manage and sync your customer data (${meta.total} total)`}
      primaryAction={
        <Form method="post">
          <input type="hidden" name="intent" value="sync-customers" />
          <Button submit variant="primary">
            Sync Customers
          </Button>
        </Form>
      }
    >
      <BlockStack gap="400">
        {/* Search and Filters */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" wrap={false}>
              <Box minWidth="0" width="100%">
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search customers by name, email, or phone..."
                  value={currentSearch}
                  onChange={handleSearch}
                  autoComplete="off"
                />
              </Box>
              <Box minWidth="150px">
                <Select
                  label="Status"
                  labelHidden
                  options={statusOptions}
                  value={currentStatus}
                  onChange={handleStatusChange}
                />
              </Box>
            </InlineStack>
            <ButtonGroup variant="segmented">
              {(["all", "vip", "new", "at_risk"] as const).map((segment) => (
                <Button
                  key={segment}
                  pressed={currentSegment === segment}
                  onClick={() => handleSegmentChange(segment)}
                >
                  {segment === "all"
                    ? "All"
                    : segment === "vip"
                    ? "VIP"
                    : segment === "new"
                    ? "New"
                    : "At Risk"}
                </Button>
              ))}
            </ButtonGroup>
          </BlockStack>
        </Card>

        {/* Table */}
        {customers.length > 0 ? (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={customers.length}
              headings={[
                { title: "Customer" },
                { title: "Email" },
                { title: "Phone" },
                { title: "Orders" },
                { title: "Total Spent" },
                { title: "Last Order" },
                { title: "Sync Status" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        ) : (
          <Card>
            <EmptyState
              heading="No customers found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Try adjusting your search or filters to find customers.</p>
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
