/**
 * Shipments List — Full-width resource list with filters and pagination.
 *
 * Features:
 *   - Multi-status filter (11 shipment statuses)
 *   - Delivery method and carrier filters
 *   - Search by tracking #, customer name, address
 *   - Date range filter
 *   - Pagination (server-side)
 *   - Row click → shipment detail
 *   - "Create Shipment" button in header
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { ShipmentStatusBadge } from "~/components/ShipmentStatusBadge";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
import {
  Page,
  Card,
  IndexTable,
  TextField,
  Select,
  Pagination,
  InlineStack,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────

interface Shipment {
  id: string;
  trackingNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  carrier: string | null;
  deliveryMethod: string | null;
  driverName?: string | null;
  eta: string | null;
  createdAt: string;
}

interface ShipmentsPageData {
  shipments: Shipment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const SHIPMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "LABEL_CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "ATTEMPTED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

const DELIVERY_METHODS = ["STANDARD", "EXPRESS", "OVERNIGHT", "SAME_DAY"];
const CARRIERS = ["FEDEX", "UPS", "USPS", "DHL", "LOCAL"];

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const deliveryMethod = url.searchParams.get("deliveryMethod") ?? undefined;
  const carrier = url.searchParams.get("carrier") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  const response = await api.get<PaginatedResponse<Shipment>>("/api/v4/shipments", {
    page,
    limit,
    status,
    search,
    deliveryMethod,
    carrier,
    dateFrom,
    dateTo,
  });

  return { shipments: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function ShipmentsList() {
  const { shipments, meta } = useLoaderData<ShipmentsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = meta.page;
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.set("page", "1");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const goToPage = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(page));
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const statusOptions = [
    { label: "All statuses", value: "" },
    ...SHIPMENT_STATUSES.map((s) => ({
      label: s.replace(/_/g, " "),
      value: s,
    })),
  ];

  const carrierOptions = [
    { label: "All carriers", value: "" },
    ...CARRIERS.map((c) => ({ label: c, value: c })),
  ];

  const deliveryMethodOptions = [
    { label: "All methods", value: "" },
    ...DELIVERY_METHODS.map((m) => ({
      label: m.replace(/_/g, " "),
      value: m,
    })),
  ];

  const resourceName = { singular: "shipment", plural: "shipments" };

  const rowMarkup = shipments.map((shipment, index) => (
    <IndexTable.Row
      id={shipment.id}
      key={shipment.id}
      position={index}
    >
      <IndexTable.Cell>
        <Link to={`/shipments/${shipment.id}`}>
          <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
            {shipment.trackingNumber}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {shipment.customerName ?? "\u2014"}
          </Text>
          {shipment.customerEmail && (
            <Text as="span" variant="bodySm" tone="subdued">
              {shipment.customerEmail}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <ShipmentStatusBadge status={shipment.status} />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {shipment.carrier ?? "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {shipment.deliveryMethod
            ? shipment.deliveryMethod.replace(/_/g, " ")
            : "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {shipment.driverName ? (
          <Text as="span" variant="bodyMd">
            {shipment.driverName}
          </Text>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">
            Unassigned
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {shipment.eta
            ? new Date(shipment.eta).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {new Date(shipment.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Shipments"
      subtitle={`${meta.total} total shipments`}
      primaryAction={{ content: "Create Shipment", url: "/shipments/new" }}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" wrap>
              <div style={{ flexGrow: 1, minWidth: 200 }}>
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search shipments..."
                  value={currentSearch}
                  onChange={(value) => updateFilter("search", value)}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => updateFilter("search", "")}
                />
              </div>
              <Select
                label="Status"
                labelHidden
                options={statusOptions}
                value={currentStatus}
                onChange={(value) => updateFilter("status", value)}
              />
              <Select
                label="Carrier"
                labelHidden
                options={carrierOptions}
                value={searchParams.get("carrier") ?? ""}
                onChange={(value) => updateFilter("carrier", value)}
              />
              <Select
                label="Delivery method"
                labelHidden
                options={deliveryMethodOptions}
                value={searchParams.get("deliveryMethod") ?? ""}
                onChange={(value) => updateFilter("deliveryMethod", value)}
              />
              <TextField
                label="From date"
                labelHidden
                type="date"
                value={searchParams.get("dateFrom") ?? ""}
                onChange={(value) => updateFilter("dateFrom", value)}
                autoComplete="off"
              />
              <TextField
                label="To date"
                labelHidden
                type="date"
                value={searchParams.get("dateTo") ?? ""}
                onChange={(value) => updateFilter("dateTo", value)}
                autoComplete="off"
              />
            </InlineStack>
          </BlockStack>
        </Card>

        {shipments.length === 0 ? (
          <Card>
            <EmptyState
              title="No shipments found"
              description={
                currentSearch || currentStatus
                  ? "Try adjusting your filters to find what you're looking for."
                  : "Shipments will appear here when they're created."
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
          </Card>
        ) : (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={shipments.length}
              headings={[
                { title: "Tracking #" },
                { title: "Customer" },
                { title: "Status" },
                { title: "Carrier" },
                { title: "Method" },
                { title: "Driver" },
                { title: "ETA" },
                { title: "Created" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}

        {meta.totalPages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={currentPage > 1}
              hasNext={currentPage < meta.totalPages}
              onPrevious={() => goToPage(currentPage - 1)}
              onNext={() => goToPage(currentPage + 1)}
              label={`Page ${currentPage} of ${meta.totalPages} (${meta.total} shipments)`}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}
