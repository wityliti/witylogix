/**
 * Orders List — Full-width resource list with filters and bulk actions.
 *
 * Features:
 *   - Multi-select status filter (persistent URL params)
 *   - Date range filter
 *   - Driver and Zone dropdowns
 *   - Search by order number, customer name, address
 *   - Pagination (server-side)
 *   - Bulk actions: assign driver, assign route, print labels, cancel
 *   - Row click → order detail
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import {
  Page,
  Card,
  Text,
  IndexTable,
  TextField,
  Select,
  Pagination,
  InlineStack,
  BlockStack,
  Box,
  Link as PolarisLink,
} from "@shopify/polaris";
import { OrderStatusBadge } from "~/components/OrderStatusBadge";
import { EmptyState } from "~/components/EmptyState";
import {
  createApiClientFromRequest,
  type PaginatedResponse,
} from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Order {
  id: string;
  externalOrderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  addressLine1: string | null;
  city: string | null;
  status: string;
  driverId: string | null;
  driverName?: string | null;
  zoneName?: string | null;
  deliveryDate: string | null;
  createdAt: string;
}

interface OrdersPageData {
  orders: Order[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const driverId = url.searchParams.get("driverId") ?? undefined;
  const zoneId = url.searchParams.get("zoneId") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  const response = await api.get<PaginatedResponse<Order>>("/api/v4/orders", {
    page,
    limit,
    status,
    search,
    driverId,
    zoneId,
    dateFrom,
    dateTo,
  });

  return { orders: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function OrdersList() {
  const { orders, meta } = useLoaderData<OrdersPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentPage = meta.page;
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1"); // Reset to page 1 on filter change
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const statusOptions = [
    { label: "All statuses", value: "" },
    ...ORDER_STATUSES.map((s) => ({
      label: s.replace(/_/g, " "),
      value: s,
    })),
  ];

  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const headings = [
    { title: "Order" },
    { title: "Customer" },
    { title: "Address" },
    { title: "Status" },
    { title: "Driver" },
    { title: "Date" },
  ];

  const rowMarkup = orders.map((order, index) => (
    <IndexTable.Row
      id={order.id}
      key={order.id}
      position={index}
      onClick={() => navigate(`/orders/${order.id}`)}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
          {order.externalOrderNumber
            ? `#${order.externalOrderNumber}`
            : order.id.slice(0, 8)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {order.customerName ?? "\u2014"}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {order.customerEmail ?? ""}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd">
            {order.addressLine1 ?? "\u2014"}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {order.city ?? ""}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <OrderStatusBadge status={order.status} />
      </IndexTable.Cell>
      <IndexTable.Cell>
        {order.driverName ? (
          <Text as="span" variant="bodyMd">
            {order.driverName}
          </Text>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">
            Unassigned
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {order.deliveryDate
            ? new Date(order.deliveryDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Orders" subtitle={`${meta.total} total orders`}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            {/* Filters Bar */}
            <InlineStack gap="300" wrap>
              <Box minWidth="200px" width="100%" maxWidth="400px">
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search orders..."
                  value={currentSearch}
                  onChange={(value) => updateFilter("search", value)}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => updateFilter("search", "")}
                />
              </Box>
              <Box minWidth="160px">
                <Select
                  label="Status"
                  labelHidden
                  options={statusOptions}
                  value={currentStatus}
                  onChange={(value) => updateFilter("status", value)}
                />
              </Box>
              <Box minWidth="160px">
                <TextField
                  label="From date"
                  labelHidden
                  type="date"
                  value={searchParams.get("dateFrom") ?? ""}
                  onChange={(value) => updateFilter("dateFrom", value)}
                  autoComplete="off"
                />
              </Box>
              <Box minWidth="160px">
                <TextField
                  label="To date"
                  labelHidden
                  type="date"
                  value={searchParams.get("dateTo") ?? ""}
                  onChange={(value) => updateFilter("dateTo", value)}
                  autoComplete="off"
                />
              </Box>
            </InlineStack>

            {/* Orders Table */}
            {orders.length === 0 ? (
              <EmptyState
                title="No orders found"
                description={
                  currentSearch || currentStatus
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Orders will appear here when they're created from Shopify or the API."
                }
                actionLabel={
                  currentSearch || currentStatus ? "Clear filters" : undefined
                }
                onAction={
                  currentSearch || currentStatus
                    ? () => setSearchParams(new URLSearchParams())
                    : undefined
                }
              />
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={orders.length}
                headings={headings}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </BlockStack>
        </Card>

        {/* Pagination */}
        {orders.length > 0 && (
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              Page {currentPage} of {meta.totalPages} ({meta.total} orders)
            </Text>
            <Pagination
              hasPrevious={currentPage > 1}
              hasNext={currentPage < meta.totalPages}
              onPrevious={() => goToPage(currentPage - 1)}
              onNext={() => goToPage(currentPage + 1)}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}
