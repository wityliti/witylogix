/**
 * Routes List — Delivery routes management.
 *
 * Features:
 *   - Table view: Name, Driver, Stops count, Status, Distance, Duration, Date
 *   - Status filter: DRAFT | OPTIMIZING | READY | IN_PROGRESS | COMPLETED
 *   - Date filter
 *   - Create Route button
 *   - Optimize selected routes action
 *   - Pagination
 *
 * Status colors and route management for delivery logistics.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState, useCallback } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
import {
  Page,
  Card,
  IndexTable,
  Select,
  TextField,
  Pagination,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Button,
  Modal,
  FormLayout,
  Banner,
  useIndexResourceState,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Route {
  id: string;
  name: string;
  driverId: string | null;
  driverName: string | null;
  stopsCount: number;
  status: string;
  distance: number;
  duration: number;
  date: string;
  createdAt: string;
}

interface RoutesPageData {
  routes: Route[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ROUTE_STATUSES = ["DRAFT", "OPTIMIZING", "READY", "IN_PROGRESS", "COMPLETED"];

const STATUS_BADGE_TONE: Record<string, BadgeProps["tone"]> = {
  DRAFT: undefined,
  OPTIMIZING: "attention",
  READY: "success",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const status = url.searchParams.get("status") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;

  const response = await api.get<PaginatedResponse<Route>>("/api/v4/routes", {
    page,
    limit,
    status,
    date,
  });

  return { routes: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const route = {
      name: formData.get("name") as string,
      date: formData.get("date") as string,
      driverId: (formData.get("driverId") as string) || undefined,
    };
    const result = await api.post<{ data: { id: string } }>("/api/v4/routes", route);
    return redirect(`/routes/${result.data.id}`);
  }

  if (intent === "optimize") {
    const routeIds = formData.getAll("routeIds") as string[];
    await api.post("/api/v4/routes/optimize", { routeIds });
    return null;
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function RoutesList() {
  const { routes, meta } = useLoaderData<RoutesPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentStatus = searchParams.get("status") ?? "";
  const currentDate = searchParams.get("date") ?? "";
  const currentPage = meta.page;

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(routes);

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
    ...ROUTE_STATUSES.map((s) => ({
      label: s.replace(/_/g, " "),
      value: s,
    })),
  ];

  const resourceName = { singular: "route", plural: "routes" };

  const promotedBulkActions = [
    {
      content: "Optimize Selected",
      onAction: () => {
        // Submit optimize form programmatically
        const form = document.getElementById("optimize-form") as HTMLFormElement;
        if (form) {
          form.submit();
        }
      },
    },
  ];

  const rowMarkup = routes.map((route, index) => (
    <IndexTable.Row
      id={route.id}
      key={route.id}
      position={index}
      selected={selectedResources.includes(route.id)}
    >
      <IndexTable.Cell>
        <Link to={`/routes/${route.id}`}>
          <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
            {route.name}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {route.driverName ? (
          <Link to={`/drivers/${route.driverId}`}>
            <Text as="span" tone="magic">{route.driverName}</Text>
          </Link>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">
            Unassigned
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="center">
          {route.stopsCount}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_BADGE_TONE[route.status]}>
          {route.status.replace(/_/g, " ")}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {(route.distance / 1000).toFixed(2)} km
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatDuration(route.duration)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatDate(route.date)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Routes"
      subtitle={`${meta.total} total routes`}
      primaryAction={{
        content: "Create Route",
        onAction: () => setShowCreateModal(true),
      }}
    >
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" wrap>
            <Select
              label="Status"
              labelHidden
              options={statusOptions}
              value={currentStatus}
              onChange={(value) => updateFilter("status", value)}
            />
            <TextField
              label="Date"
              labelHidden
              type="date"
              value={currentDate}
              onChange={(value) => updateFilter("date", value)}
              autoComplete="off"
            />
          </InlineStack>
        </Card>

        {/* Hidden form for bulk optimize action */}
        {selectedResources.length > 0 && (
          <Form method="post" id="optimize-form">
            <input type="hidden" name="intent" value="optimize" />
            {selectedResources.map((id) => (
              <input key={id} type="hidden" name="routeIds" value={id} />
            ))}
          </Form>
        )}

        {routes.length === 0 ? (
          <Card>
            <EmptyState
              title="No routes found"
              description={
                currentStatus || currentDate
                  ? "Try adjusting your filters."
                  : "Create a delivery route to get started."
              }
              actionLabel="Create Route"
              onAction={() => setShowCreateModal(true)}
            />
          </Card>
        ) : (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={routes.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Name" },
                { title: "Driver" },
                { title: "Stops", alignment: "center" },
                { title: "Status" },
                { title: "Distance" },
                { title: "Duration" },
                { title: "Date" },
              ]}
              promotedBulkActions={promotedBulkActions}
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
              label={`Page ${currentPage} of ${meta.totalPages}`}
            />
          </InlineStack>
        )}
      </BlockStack>

      {/* Create Route Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Route"
        primaryAction={{
          content: "Create Route",
          submit: true,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setShowCreateModal(false) },
        ]}
      >
        <Modal.Section>
          <Form method="post" onSubmit={() => setShowCreateModal(false)}>
            <input type="hidden" name="intent" value="create" />
            <FormLayout>
              <TextField
                label="Route Name"
                name="name"
                requiredIndicator
                autoComplete="off"
                placeholder="e.g., Downtown Morning Run"
              />
              <TextField
                label="Date"
                name="date"
                type="date"
                requiredIndicator
                autoComplete="off"
              />
              <Select
                label="Driver (Optional)"
                name="driverId"
                options={[{ label: "Select a driver", value: "" }]}
                value=""
                onChange={() => {}}
              />
              <Button submit variant="primary">
                Create Route
              </Button>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
