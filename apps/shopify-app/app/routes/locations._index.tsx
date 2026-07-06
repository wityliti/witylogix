/**
 * Locations Index — Manage warehouse, store, hub, and drop-point locations.
 *
 * Features:
 *   - Card grid layout (3-column) showing each location
 *   - Location name, type badge (WAREHOUSE, STORE, HUB, DROP_POINT)
 *   - Address (line1, line2, city, state, zip)
 *   - Operating hours summary
 *   - Active/Inactive status
 *   - "Edit" and "Deactivate" action buttons
 *   - Search bar + type filter dropdown
 *   - "Add Location" button in header
 *   - Empty state when no locations
 *   - Link to detail/edit: `/locations/:id`
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useSearchParams, Link } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  InlineGrid,
  Card,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  Box,
  Filters,
  ChoiceList,
  EmptyState as PolarisEmptyState,
  Modal,
  Pagination,
  Divider,
} from "@shopify/polaris";
import {
  createApiClientFromRequest,
  type PaginatedResponse,
} from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  type: string; // WAREHOUSE | STORE | HUB | DROP_POINT
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
  operatingHours?: Array<{
    day: string;
    open?: string;
    close?: string;
    closed?: boolean;
  }>;
  isActive: boolean;
  createdAt?: string;
}

interface LocationsPageData {
  locations: Location[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const LOCATION_TYPES = ["WAREHOUSE", "STORE", "HUB", "DROP_POINT"];

const TYPE_BADGE_TONE: Record<
  string,
  "info" | "success" | "critical" | "warning" | "attention"
> = {
  WAREHOUSE: "info",
  STORE: "success",
  HUB: "critical",
  DROP_POINT: "warning",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const type = url.searchParams.get("type") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const response = await api.get<PaginatedResponse<Location>>(
    "/api/v4/locations",
    {
      page,
      limit,
      type,
      search,
    },
  );

  return { locations: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "deactivate") {
    const id = formData.get("id") as string;
    await api.delete(`/api/v4/locations/${id}`);
    return { ok: true };
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function LocationsList() {
  const { locations, meta } = useLoaderData<LocationsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const currentSearch = searchParams.get("search") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentPage = meta.page;

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1");
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const handleSearchChange = useCallback(
    (value: string) => updateFilter("search", value),
    [searchParams],
  );

  const handleSearchClear = useCallback(
    () => updateFilter("search", ""),
    [searchParams],
  );

  const handleTypeFilterChange = useCallback(
    (value: string[]) => updateFilter("type", value[0] ?? ""),
    [searchParams],
  );

  const handleTypeFilterRemove = useCallback(
    () => updateFilter("type", ""),
    [searchParams],
  );

  const handleFiltersClearAll = useCallback(() => {
    const next = new URLSearchParams();
    next.set("page", "1");
    setSearchParams(next);
  }, [setSearchParams]);

  const formatAddress = (location: Location): string => {
    const parts = [location.line1];
    if (location.line2) parts.push(location.line2);
    parts.push(`${location.city}, ${location.state} ${location.zip}`);
    return parts.join(", ");
  };

  const getOperatingHoursSummary = (location: Location): string => {
    if (!location.operatingHours || location.operatingHours.length === 0) {
      return "Hours not set";
    }
    const openDays = location.operatingHours.filter((h) => !h.closed);
    return openDays.length > 0 ? `${openDays.length} days/week` : "Closed";
  };

  const deactivatingLocation = deactivatingId
    ? locations.find((l) => l.id === deactivatingId)
    : null;

  const filters = [
    {
      key: "type",
      label: "Type",
      filter: (
        <ChoiceList
          title="Type"
          titleHidden
          choices={LOCATION_TYPES.map((t) => ({
            label: t.replace(/_/g, " "),
            value: t,
          }))}
          selected={currentType ? [currentType] : []}
          onChange={handleTypeFilterChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = currentType
    ? [
        {
          key: "type",
          label: `Type: ${currentType.replace(/_/g, " ")}`,
          onRemove: handleTypeFilterRemove,
        },
      ]
    : [];

  return (
    <Page
      title="Locations"
      subtitle={`${meta.total} total locations`}
      primaryAction={{ content: "Add Location", url: "/locations/new" }}
    >
      <BlockStack gap="400">
        <Filters
          queryValue={currentSearch}
          queryPlaceholder="Search locations..."
          onQueryChange={handleSearchChange}
          onQueryClear={handleSearchClear}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={handleFiltersClearAll}
        />

        {locations.length === 0 ? (
          <Card>
            <PolarisEmptyState
              heading="No locations found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Add Location", url: "/locations/new" }}
            >
              <p>
                {currentSearch || currentType
                  ? "Try adjusting your filters."
                  : "Add locations to manage warehouses, stores, hubs, and drop points."}
              </p>
            </PolarisEmptyState>
          </Card>
        ) : (
          <>
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
              {locations.map((location) => (
                <Card key={location.id}>
                  <BlockStack gap="300">
                    <InlineStack
                      align="space-between"
                      blockAlign="start"
                      gap="200"
                    >
                      <Text as="h3" variant="headingSm" fontWeight="semibold">
                        {location.name}
                      </Text>
                      <Badge tone={TYPE_BADGE_TONE[location.type] ?? "info"}>
                        {location.type.replace(/_/g, " ")}
                      </Badge>
                    </InlineStack>

                    <Divider />

                    <Text as="p" variant="bodySm">
                      {formatAddress(location)}
                    </Text>

                    <Divider />

                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Operating Hours
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {getOperatingHoursSummary(location)}
                      </Text>
                    </BlockStack>

                    <Divider />

                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={location.isActive ? "success" : undefined}>
                        {location.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </InlineStack>

                    <Divider />

                    <InlineStack gap="200">
                      <Button url={`/locations/${location.id}`} size="slim">
                        Edit
                      </Button>
                      <Button
                        size="slim"
                        tone={location.isActive ? "critical" : undefined}
                        onClick={() => setDeactivatingId(location.id)}
                      >
                        {location.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>

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
          </>
        )}
      </BlockStack>

      {deactivatingId && (
        <Modal
          open={true}
          onClose={() => setDeactivatingId(null)}
          title="Deactivate Location?"
          primaryAction={{
            content: "Deactivate",
            destructive: true,
            submit: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setDeactivatingId(null),
            },
          ]}
        >
          <Modal.Section>
            <Form method="post" onSubmit={() => setDeactivatingId(null)}>
              <input type="hidden" name="intent" value="deactivate" />
              <input type="hidden" name="id" value={deactivatingId} />
              <Text as="p">
                This location will no longer be available for orders and
                assignments.
              </Text>
            </Form>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
