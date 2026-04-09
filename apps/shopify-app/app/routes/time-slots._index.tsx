/**
 * Time Slots List — Delivery time slots management.
 *
 * Features:
 *   - Table view: Label, Start Time, End Time, Max Orders, Active status toggle
 *   - Create Time Slot modal with form
 *   - Pagination
 *   - Toggle active/inactive status
 *
 * Time slot management for delivery window availability.
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

interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive: boolean;
}

interface TimeSlotsPageData {
  timeSlots: TimeSlot[];
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

  const response = await api.get<PaginatedResponse<TimeSlot>>("/api/v4/time-slots", {
    page,
    limit,
  });

  return { timeSlots: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const timeSlot = {
      label: formData.get("label") as string,
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      maxOrders: Number(formData.get("maxOrders") ?? 10),
    };
    const result = await api.post<{ data: { id: string } }>(
      "/api/v4/time-slots",
      timeSlot
    );
    return redirect(`/time-slots/${result.data.id}`);
  }

  if (intent === "toggle") {
    const slotId = formData.get("slotId") as string;
    const isActive = formData.get("isActive") === "true";
    await api.patch(`/api/v4/time-slots/${slotId}`, {
      isActive: !isActive,
    });
    return null;
  }

  return null;
}

// ─── Helpers ───────────────────────────────────────────────

function formatTime(timeStr: string): string {
  try {
    if (timeStr.includes("T")) {
      // ISO format with date
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    // HH:mm format
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

// ─── Component ─────────────────────────────────────────────

export default function TimeSlotsList() {
  const { timeSlots, meta } = useLoaderData<TimeSlotsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentPage = meta.page;

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const resourceName = {
    singular: "time slot",
    plural: "time slots",
  };

  const rowMarkup = timeSlots.map((slot, index) => (
    <IndexTable.Row id={slot.id} key={slot.id} position={index}>
      <IndexTable.Cell>
        <Link
          to={`/time-slots/${slot.id}`}
          style={{ textDecoration: "none" }}
        >
          <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
            {slot.label}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatTime(slot.startTime)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatTime(slot.endTime)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="center">
          {slot.maxOrders}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Form method="post">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="slotId" value={slot.id} />
          <input type="hidden" name="isActive" value={String(slot.isActive)} />
          <button
            type="submit"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Badge tone={slot.isActive ? "success" : undefined}>
              {slot.isActive ? "Active" : "Inactive"}
            </Badge>
          </button>
        </Form>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Time Slots"
      subtitle={`${meta.total} total time slots`}
      primaryAction={{
        content: "Create Time Slot",
        onAction: () => setShowCreateModal(true),
      }}
    >
      <BlockStack gap="400">
        {timeSlots.length === 0 ? (
          <Card>
            <PolarisEmptyState
              heading="No time slots found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{
                content: "Create Time Slot",
                onAction: () => setShowCreateModal(true),
              }}
            >
              <p>Create delivery time slots to define available delivery windows.</p>
            </PolarisEmptyState>
          </Card>
        ) : (
          <>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={timeSlots.length}
                headings={[
                  { title: "Label" },
                  { title: "Start Time" },
                  { title: "End Time" },
                  { title: "Max Orders", alignment: "center" },
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
        <TimeSlotCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </Page>
  );
}

// ─── Sub-components ────────────────────────────────────────

function TimeSlotCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Create New Time Slot"
      primaryAction={{
        content: "Create Time Slot"
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
              label="Slot Label"
              name="label"
              requiredIndicator
              autoComplete="off"
              placeholder="e.g., Morning (8am - 12pm)"
            />
            <FormLayout.Group>
              <TextField
                label="Start Time"
                name="startTime"
                type="time"
                requiredIndicator
                autoComplete="off"
              />
              <TextField
                label="End Time"
                name="endTime"
                type="time"
                requiredIndicator
                autoComplete="off"
              />
            </FormLayout.Group>
            <TextField
              label="Max Orders"
              name="maxOrders"
              type="number"
              value="10"
              autoComplete="off"
            />
            <InlineStack align="end" gap="200">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" submit>
                Create Time Slot
              </Button>
            </InlineStack>
          </FormLayout>
        </Form>
      </Modal.Section>
    </Modal>
  );
}
