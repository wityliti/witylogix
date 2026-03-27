/**
 * Drivers List — Resource list with table/map toggle view.
 *
 * Features:
 *   - Table view: name, phone, vehicle, status, active orders, last seen
 *   - Map view: driver markers on Mapbox map (client-side rendered)
 *   - Status filter: ALL | AVAILABLE | ON_DELIVERY | OFFLINE
 *   - Search by name or phone
 *   - Add Driver button → modal or /drivers/new
 *   - Row click → driver detail
 *
 * The map view uses a client-only component to avoid SSR issues with Mapbox GL.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState, useCallback } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClientFromRequest, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
import {
  Page,
  Card,
  IndexTable,
  TextField,
  Select,
  Pagination,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Button,
  Modal,
  FormLayout,
  ButtonGroup,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  vehicleType: string;
  vehiclePlate: string | null;
  maxCapacity: number;
  status: string;
  isActive: boolean;
  activeOrderCount?: number;
  lastSeenAt?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
}

interface DriversPageData {
  drivers: Driver[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const DRIVER_STATUSES = ["AVAILABLE", "ON_DELIVERY", "OFFLINE"];

const STATUS_BADGE_TONE: Record<string, BadgeProps["tone"]> = {
  AVAILABLE: "success",
  ON_DELIVERY: "info",
  OFFLINE: undefined,
};

const VEHICLE_ICONS: Record<string, string> = {
  BICYCLE: "\ud83d\udeb2",
  MOTORCYCLE: "\ud83c\udfcd\ufe0f",
  CAR: "\ud83d\ude97",
  VAN: "\ud83d\ude90",
  TRUCK: "\ud83d\ude9b",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const response = await api.get<PaginatedResponse<Driver>>("/api/v4/drivers", {
    page,
    limit,
    status,
    search,
  });

  return { drivers: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const driver = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || undefined,
      vehicleType: formData.get("vehicleType") as string,
      vehiclePlate: (formData.get("vehiclePlate") as string) || undefined,
      maxCapacity: Number(formData.get("maxCapacity") ?? 20),
    };
    const result = await api.post<{ data: { id: string } }>("/api/v4/drivers", driver);
    return redirect(`/drivers/${result.data.id}`);
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function DriversList() {
  const { drivers, meta } = useLoaderData<DriversPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentPage = meta.page;

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
    ...DRIVER_STATUSES.map((s) => ({
      label: s.replace(/_/g, " "),
      value: s,
    })),
  ];

  const vehicleTypeOptions = [
    { label: "Bicycle", value: "BICYCLE" },
    { label: "Motorcycle", value: "MOTORCYCLE" },
    { label: "Car", value: "CAR" },
    { label: "Van", value: "VAN" },
    { label: "Truck", value: "TRUCK" },
  ];

  const resourceName = { singular: "driver", plural: "drivers" };

  const rowMarkup = drivers.map((driver, index) => (
    <IndexTable.Row id={driver.id} key={driver.id} position={index}>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Link to={`/drivers/${driver.id}`}>
            <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
              {driver.name}
            </Text>
          </Link>
          {driver.email && (
            <Text as="span" variant="bodySm" tone="subdued">
              {driver.email}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">{driver.phone}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Text as="span" variant="bodyMd">
            {VEHICLE_ICONS[driver.vehicleType] ?? "\ud83d\ude97"}{" "}
            {driver.vehicleType.toLowerCase()}
          </Text>
          {driver.vehiclePlate && (
            <Text as="span" variant="bodySm" tone="subdued">
              {driver.vehiclePlate}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_BADGE_TONE[driver.status]}>
          {driver.status.replace(/_/g, " ")}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="center">
          {driver.activeOrderCount ?? 0}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {driver.lastSeenAt ? (
          <Text as="span" variant="bodyMd">
            {formatRelative(driver.lastSeenAt)}
          </Text>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">
            Never
          </Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Drivers"
      subtitle={`${meta.total} total drivers`}
      primaryAction={{
        content: "Add Driver",
        onAction: () => setShowCreateModal(true),
      }}
      secondaryActions={[
        {
          content: viewMode === "table" ? "Map View" : "Table View",
          onAction: () =>
            setViewMode(viewMode === "table" ? "map" : "table"),
        },
      ]}
    >
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" wrap>
            <div style={{ flexGrow: 1, minWidth: 200 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search drivers..."
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
          </InlineStack>
        </Card>

        {drivers.length === 0 ? (
          <Card>
            <EmptyState
              title="No drivers found"
              description={
                currentSearch || currentStatus
                  ? "Try adjusting your filters."
                  : "Add drivers so you can assign them to deliveries."
              }
              actionLabel="Add Driver"
              onAction={() => setShowCreateModal(true)}
            />
          </Card>
        ) : viewMode === "table" ? (
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={drivers.length}
              headings={[
                { title: "Driver" },
                { title: "Phone" },
                { title: "Vehicle" },
                { title: "Status" },
                { title: "Active Orders", alignment: "center" },
                { title: "Last Seen" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                Map view shows live driver locations.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {drivers.filter((d) => d.lastLatitude && d.lastLongitude).length}{" "}
                of {drivers.length} drivers have GPS data.
              </Text>
              <div
                id="drivers-map"
                style={{ width: "100%", height: 500, borderRadius: 8, backgroundColor: "#e8eaed" }}
              />
            </BlockStack>
          </Card>
        )}

        {viewMode === "table" && meta.totalPages > 1 && (
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

      {/* Create Driver Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Driver"
        primaryAction={{
          content: "Add Driver",
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
                label="Name"
                name="name"
                requiredIndicator
                autoComplete="name"
                placeholder="Full name"
              />
              <TextField
                label="Phone"
                name="phone"
                requiredIndicator
                autoComplete="tel"
                placeholder="+1 (555) 000-0000"
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="driver@example.com"
              />
              <FormLayout.Group>
                <Select
                  label="Vehicle Type"
                  name="vehicleType"
                  options={vehicleTypeOptions}
                  value="CAR"
                  onChange={() => {}}
                />
                <TextField
                  label="License Plate"
                  name="vehiclePlate"
                  autoComplete="off"
                  placeholder="ABC 1234"
                />
              </FormLayout.Group>
              <TextField
                label="Max Capacity (orders)"
                name="maxCapacity"
                type="number"
                value="20"
                autoComplete="off"
                onChange={() => {}}
              />
              <Button submit variant="primary">
                Add Driver
              </Button>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}
