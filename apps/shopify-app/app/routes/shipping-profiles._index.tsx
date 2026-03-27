/**
 * Shipping Profiles Index — Configure shipping profiles and rates.
 *
 * Features:
 *   - Card list layout showing each profile
 *   - Profile name + delivery method badge (LOCAL_DELIVERY, STORE_PICKUP, STANDARD_SHIPPING, EXPRESS_SHIPPING, SAME_DAY)
 *   - Rate type: FLAT, WEIGHT_BASED, DISTANCE_BASED, TIERED
 *   - Base rate, currency
 *   - Linked locations count
 *   - Active/Inactive status
 *   - "Edit" and "Duplicate" action buttons
 *   - Filter: delivery method, rate type, active status
 *   - "Create Profile" button in header
 *   - Empty state when no profiles
 *   - Link to detail/edit: `/shipping-profiles/:id`
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Filters,
  ChoiceList,
  EmptyState as PolarisEmptyState,
  Modal,
  Pagination,
  Divider,
  Box,
} from "@shopify/polaris";
import { createApiClientFromRequest, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface ShippingProfile {
  id: string;
  name: string;
  deliveryMethod: string; // LOCAL_DELIVERY | STORE_PICKUP | STANDARD_SHIPPING | EXPRESS_SHIPPING | SAME_DAY
  rateType: string; // FLAT | WEIGHT_BASED | DISTANCE_BASED | TIERED
  baseRate: number;
  currency: string;
  linkedLocationsCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ShippingProfilesPageData {
  profiles: ShippingProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const DELIVERY_METHODS = [
  "LOCAL_DELIVERY",
  "STORE_PICKUP",
  "STANDARD_SHIPPING",
  "EXPRESS_SHIPPING",
  "SAME_DAY",
];

const RATE_TYPES = ["FLAT", "WEIGHT_BASED", "DISTANCE_BASED", "TIERED"];

const DELIVERY_METHOD_TONE: Record<string, "success" | "info" | "critical" | "warning" | "attention"> = {
  LOCAL_DELIVERY: "success",
  STORE_PICKUP: "info",
  STANDARD_SHIPPING: "critical",
  EXPRESS_SHIPPING: "warning",
  SAME_DAY: "attention",
};

const RATE_TYPE_LABELS: Record<string, string> = {
  FLAT: "Flat Rate",
  WEIGHT_BASED: "Weight Based",
  DISTANCE_BASED: "Distance Based",
  TIERED: "Tiered Pricing",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const deliveryMethod = url.searchParams.get("deliveryMethod") ?? undefined;
  const rateType = url.searchParams.get("rateType") ?? undefined;
  const activeStatus = url.searchParams.get("activeStatus") ?? undefined;

  const response = await api.get<PaginatedResponse<ShippingProfile>>(
    "/api/v4/shipping-profiles",
    {
      page,
      limit,
      deliveryMethod,
      rateType,
      activeStatus,
    }
  );

  return { profiles: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function ShippingProfilesList() {
  const { profiles, meta } = useLoaderData<ShippingProfilesPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const currentDeliveryMethod = searchParams.get("deliveryMethod") ?? "";
  const currentRateType = searchParams.get("rateType") ?? "";
  const currentActiveStatus = searchParams.get("activeStatus") ?? "";
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

  const handleFiltersClearAll = useCallback(() => {
    const next = new URLSearchParams();
    next.set("page", "1");
    setSearchParams(next);
  }, [setSearchParams]);

  const formatCurrency = (amount: number, currency: string): string => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getCurrencySymbol = (code: string): string => {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      CAD: "C$",
      AUD: "A$",
      JPY: "¥",
    };
    return symbols[code] ?? code;
  };

  const filters = [
    {
      key: "deliveryMethod",
      label: "Delivery Method",
      filter: (
        <ChoiceList
          title="Delivery Method"
          titleHidden
          choices={DELIVERY_METHODS.map((m) => ({
            label: m.replace(/_/g, " "),
            value: m,
          }))}
          selected={currentDeliveryMethod ? [currentDeliveryMethod] : []}
          onChange={(value) => updateFilter("deliveryMethod", value[0] ?? "")}
        />
      ),
      shortcut: true,
    },
    {
      key: "rateType",
      label: "Rate Type",
      filter: (
        <ChoiceList
          title="Rate Type"
          titleHidden
          choices={RATE_TYPES.map((t) => ({
            label: RATE_TYPE_LABELS[t],
            value: t,
          }))}
          selected={currentRateType ? [currentRateType] : []}
          onChange={(value) => updateFilter("rateType", value[0] ?? "")}
        />
      ),
      shortcut: true,
    },
    {
      key: "activeStatus",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
          selected={currentActiveStatus ? [currentActiveStatus] : []}
          onChange={(value) => updateFilter("activeStatus", value[0] ?? "")}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [
    ...(currentDeliveryMethod
      ? [
          {
            key: "deliveryMethod",
            label: `Method: ${currentDeliveryMethod.replace(/_/g, " ")}`,
            onRemove: () => updateFilter("deliveryMethod", ""),
          },
        ]
      : []),
    ...(currentRateType
      ? [
          {
            key: "rateType",
            label: `Rate: ${RATE_TYPE_LABELS[currentRateType]}`,
            onRemove: () => updateFilter("rateType", ""),
          },
        ]
      : []),
    ...(currentActiveStatus
      ? [
          {
            key: "activeStatus",
            label: `Status: ${currentActiveStatus}`,
            onRemove: () => updateFilter("activeStatus", ""),
          },
        ]
      : []),
  ];

  return (
    <Page
      title="Shipping Profiles"
      subtitle={`${meta.total} total profiles`}
      primaryAction={{ content: "Create Profile", url: "/shipping-profiles/new" }}
    >
      <BlockStack gap="400">
        <Filters
          queryValue=""
          queryPlaceholder=""
          queryHidden
          onQueryChange={() => {}}
          onQueryClear={() => {}}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={handleFiltersClearAll}
        />

        {profiles.length === 0 ? (
          <Card>
            <PolarisEmptyState
              heading="No shipping profiles found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Create Profile", url: "/shipping-profiles/new" }}
            >
              <p>
                {currentDeliveryMethod || currentRateType || currentActiveStatus
                  ? "Try adjusting your filters."
                  : "Create shipping profiles to define rates and delivery methods for your locations."}
              </p>
            </PolarisEmptyState>
          </Card>
        ) : (
          <>
            <BlockStack gap="300">
              {profiles.map((profile) => (
                <Card key={profile.id}>
                  <InlineStack align="space-between" blockAlign="start" wrap={false} gap="400">
                    <BlockStack gap="300">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h3" variant="headingSm" fontWeight="semibold">
                          {profile.name}
                        </Text>
                        <Badge
                          tone={DELIVERY_METHOD_TONE[profile.deliveryMethod] ?? "info"}
                        >
                          {profile.deliveryMethod.replace(/_/g, " ")}
                        </Badge>
                      </InlineStack>

                      <InlineStack gap="800">
                        <BlockStack gap="100">
                          <Text as="span" variant="bodySm" tone="subdued">
                            Rate Type
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            {RATE_TYPE_LABELS[profile.rateType]}
                          </Text>
                        </BlockStack>
                        <BlockStack gap="100">
                          <Text as="span" variant="bodySm" tone="subdued">
                            Base Rate
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            {formatCurrency(profile.baseRate, profile.currency)}
                          </Text>
                        </BlockStack>
                      </InlineStack>

                      <BlockStack gap="100">
                        <Text as="span" variant="bodySm" tone="subdued">
                          Linked Locations
                        </Text>
                        <Text as="span" variant="bodyMd" fontWeight="medium">
                          {profile.linkedLocationsCount}{" "}
                          <Text as="span" variant="bodySm" tone="subdued">
                            location{profile.linkedLocationsCount !== 1 ? "s" : ""}
                          </Text>
                        </Text>
                      </BlockStack>
                    </BlockStack>

                    <BlockStack gap="300" inlineAlign="end">
                      <Badge tone={profile.isActive ? "success" : undefined}>
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <InlineStack gap="200">
                        <Button size="slim" url={`/shipping-profiles/${profile.id}`}>
                          Edit
                        </Button>
                        <Button
                          size="slim"
                          onClick={() => setDuplicatingId(profile.id)}
                        >
                          Duplicate
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>

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

      {duplicatingId && (
        <Modal
          open={true}
          onClose={() => setDuplicatingId(null)}
          title="Duplicate Profile?"
          primaryAction={{
            content: "Duplicate",
            onAction: () => {
              // Call duplicate API
              setDuplicatingId(null);
            },
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setDuplicatingId(null),
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              A copy of this profile will be created with all the same settings.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
