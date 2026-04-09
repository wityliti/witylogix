/**
 * Zones List — Delivery zones management.
 *
 * Features:
 *   - Table view: Name, Base Rate, Per Km Rate, Min Order, Free Above, Priority, Order Count
 *   - Create Zone modal with form
 *   - Pagination
 *   - Row click → zone detail
 *
 * Zone management for delivery service coverage and pricing.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  EmptyState as PolarisEmptyState,
  Modal,
  Pagination,
  TextField,
  FormLayout,
} from "@shopify/polaris";
import { createApiClientFromRequest, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Zone {
  id: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove: number | null;
  priority: number;
  orderCount: number;
  isActive: boolean;
}

interface ZonesPageData {
  zones: Zone[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");

  const response = await api.get<PaginatedResponse<Zone>>("/api/v4/zones", {
    page,
    limit,
  });

  return { zones: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const zone = {
      name: formData.get("name") as string,
      baseRate: Number(formData.get("baseRate") ?? 0),
      perKmRate: Number(formData.get("perKmRate") ?? 0),
      minOrder: Number(formData.get("minOrder") ?? 0),
      freeAbove: formData.get("freeAbove")
        ? Number(formData.get("freeAbove"))
        : null,
      priority: Number(formData.get("priority") ?? 1),
    };
    const result = await api.post<{ data: { id: string } }>("/api/v4/zones", zone);
    return redirect(`/zones/${result.data.id}`);
  }

  return null;
}

// ─── Helpers ───────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Component ─────────────────────────────────────────────

export default function ZonesList() {
  const { zones, meta } = useLoaderData<ZonesPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentPage = meta.page;

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const resourceName = {
    singular: "zone",
    plural: "zones",
  };

  const rowMarkup = zones.map((zone, index) => (
    <IndexTable.Row id={zone.id} key={zone.id} position={index}>
      <IndexTable.Cell>
        <Link
          to={`/zones/${zone.id}`}
          style={{ textDecoration: "none" }}
        >
          <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
            {zone.name}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatCurrency(zone.baseRate)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatCurrency(zone.perKmRate)} / km
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatCurrency(zone.minOrder)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {zone.freeAbove ? (
          <Text as="span" variant="bodyMd">
            {formatCurrency(zone.freeAbove)}
          </Text>
        ) : (
          <Text as="span" variant="bodyMd" tone="subdued">
            —
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="center">
          {zone.priority}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="center">
          {zone.orderCount}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={zone.isActive ? "success" : undefined}>
          {zone.isActive ? "Active" : "Inactive"}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Delivery Zones"
      subtitle={`${meta.total} total zones`}
      primaryAction={{
        content: "Create Zone",
        onAction: () => setShowCreateModal(true),
      }}
    >
      <BlockStack gap="400">
        {zones.length === 0 ? (
          <Card>
            <PolarisEmptyState
              heading="No delivery zones found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{
                content: "Create Zone",
                onAction: () => setShowCreateModal(true),
              }}
            >
              <p>Create a delivery zone to define service areas and pricing.</p>
            </PolarisEmptyState>
          </Card>
        ) : (
          <>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={zones.length}
                headings={[
                  { title: "Zone Name" },
                  { title: "Base Rate" },
                  { title: "Per Km Rate" },
                  { title: "Min Order" },
                  { title: "Free Above" },
                  { title: "Priority", alignment: "center" },
                  { title: "Order Count", alignment: "center" },
                  { title: "Status" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>

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

      {showCreateModal && (
        <ZoneCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </Page>
  );
}

// ─── Sub-components ────────────────────────────────────────

function ZoneCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Create New Zone"
      primaryAction={{
        content: "Create Zone"
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value="create" />
          <FormLayout>
            <TextField
              label="Zone Name"
              name="name"
              requiredIndicator
              autoComplete="off"
              placeholder="e.g., Downtown Zone"
            />
            <FormLayout.Group>
              <TextField
                label="Base Rate"
                name="baseRate"
                type="number"
                requiredIndicator
                autoComplete="off"
                placeholder="0.00"
              />
              <TextField
                label="Per Km Rate"
                name="perKmRate"
                type="number"
                requiredIndicator
                autoComplete="off"
                placeholder="0.00"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Min Order"
                name="minOrder"
                type="number"
                requiredIndicator
                autoComplete="off"
                placeholder="0.00"
              />
              <TextField
                label="Free Above"
                name="freeAbove"
                type="number"
                autoComplete="off"
                placeholder="Leave blank for no free threshold"
              />
            </FormLayout.Group>
            <TextField
              label="Priority (higher = more priority)"
              name="priority"
              type="number"
              value="1"
              autoComplete="off"
            />
            <InlineStack align="end" gap="200">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" submit>
                Create Zone
              </Button>
            </InlineStack>
          </FormLayout>
        </Form>
      </Modal.Section>
    </Modal>
  );
}
