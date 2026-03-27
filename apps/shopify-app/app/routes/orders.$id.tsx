/**
 * Order Detail — Full order view with status timeline and driver assignment.
 *
 * Layout:
 *   Left column (60%): Customer info, line items, delivery details
 *   Right column (40%): Status timeline, driver assignment, actions
 *
 * Actions:
 *   - Assign/reassign driver (modal with driver search)
 *   - Update status (dropdown)
 *   - Cancel order
 *   - View on Shopify (external link)
 *   - Print label
 *
 * Data loaded server-side. Status updates via action (form submission).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation, redirect } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  DescriptionList,
  Box,
  Divider,
  Select,
  TextField,
  IndexTable,
  Link as PolarisLink,
} from "@shopify/polaris";
import { OrderStatusBadge } from "~/components/OrderStatusBadge";
import { StatusTimeline } from "~/components/StatusTimeline";
import { createApiClientFromRequest, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface OrderDetail {
  id: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryDate: string | null;
  timeSlot: { id: string; label: string; startTime: string; endTime: string } | null;
  totalPrice: number | null;
  totalWeight: number | null;
  itemCount: number;
  lineItems: Record<string, unknown>[];
  notes: string | null;
  tags: string[];
  driver: { id: string; name: string; phone: string } | null;
  zone: { id: string; name: string } | null;
  route: { id: string; name: string } | null;
  proofOfDelivery: { photos: string[]; signatureUrl: string | null; notes: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface OrderPageData {
  order: OrderDetail;
  timeline: TimelineEvent[];
  availableDrivers: { id: string; name: string; phone: string; activeOrders: number }[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  FAILED: ["RETURNED", "ASSIGNED"],
  RETURNED: [],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const [orderRes, timelineRes, driversRes] = await Promise.allSettled([
    api.get<SingleResponse<OrderDetail>>(`/api/v4/orders/${params.id}`),
    api.get<SingleResponse<TimelineEvent[]>>(`/api/v4/orders/${params.id}/timeline`),
    api.get<SingleResponse<{ id: string; name: string; phone: string; activeOrders: number }[]>>(
      "/api/v4/drivers",
      { status: "AVAILABLE", limit: 50 },
    ),
  ]);

  if (orderRes.status === "rejected") {
    throw new Response("Order not found", { status: 404 });
  }

  return {
    order: orderRes.value.data,
    timeline: timelineRes.status === "fulfilled" ? timelineRes.value.data : [],
    availableDrivers: driversRes.status === "fulfilled" ? driversRes.value.data : [],
  };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string | null;
    await api.patch(`/api/v4/orders/${params.id}/status`, {
      status,
      notes: notes || undefined,
    });
  }

  if (intent === "assign-driver") {
    const driverId = formData.get("driverId") as string;
    await api.patch(`/api/v4/orders/${params.id}`, { driverId });
  }

  if (intent === "cancel") {
    await api.patch(`/api/v4/orders/${params.id}/status`, {
      status: "CANCELLED",
      notes: "Cancelled by admin",
    });
  }

  return redirect(`/orders/${params.id}`);
}

// ─── Helpers ──────────────────────────────────────────────

function formatAddress(order: OrderDetail): string {
  const parts = [
    order.addressLine1,
    order.addressLine2,
    [order.city, order.province, order.postalCode].filter(Boolean).join(", "),
    order.country,
  ].filter(Boolean);
  return parts.join("\n");
}

// ─── Component ─────────────────────────────────────────────

export default function OrderDetailPage() {
  const { order, timeline, availableDrivers } = useLoaderData<OrderPageData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];

  const orderTitle = order.externalOrderNumber
    ? `Order #${order.externalOrderNumber}`
    : `Order ${order.id.slice(0, 8)}`;

  const statusOptions = nextStatuses.map((s) => ({
    label: s.replace(/_/g, " "),
    value: s,
  }));

  const driverOptions = [
    { label: "Select a driver...", value: "" },
    ...availableDrivers.map((d) => ({
      label: `${d.name} (${d.activeOrders} active)`,
      value: d.id,
    })),
  ];

  return (
    <Page
      backAction={{ url: "/orders" }}
      title={orderTitle}
      titleMetadata={<OrderStatusBadge status={order.status} />}
      subtitle={`Created ${new Date(order.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`}
    >
      <Layout>
        {/* ── Left Column: Order Information ── */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Customer Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Customer
                </Text>
                <DescriptionList
                  items={[
                    { term: "Name", description: order.customerName ?? "\u2014" },
                    { term: "Email", description: order.customerEmail ?? "\u2014" },
                    { term: "Phone", description: order.customerPhone ?? "\u2014" },
                  ]}
                />
              </BlockStack>
            </Card>

            {/* Delivery Address Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Delivery Address
                </Text>
                <Text as="p" variant="bodyMd">
                  {formatAddress(order) || "\u2014"}
                </Text>
                {order.latitude != null && order.longitude != null && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    GPS: {order.latitude.toFixed(6)}, {order.longitude.toFixed(6)}
                  </Text>
                )}
              </BlockStack>
            </Card>

            {/* Delivery Details Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Delivery Details
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "Delivery Date",
                      description: order.deliveryDate
                        ? new Date(order.deliveryDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "Not scheduled",
                    },
                    { term: "Time Slot", description: order.timeSlot?.label ?? "Any time" },
                    { term: "Zone", description: order.zone?.name ?? "Unzoned" },
                    { term: "Items", description: String(order.itemCount) },
                    {
                      term: "Total",
                      description:
                        order.totalPrice != null ? `$${order.totalPrice.toFixed(2)}` : "\u2014",
                    },
                    {
                      term: "Weight",
                      description:
                        order.totalWeight != null ? `${order.totalWeight}g` : "\u2014",
                    },
                  ]}
                />
                {order.notes && (
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                      Notes
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {order.notes}
                    </Text>
                  </BlockStack>
                )}
                {order.tags.length > 0 && (
                  <InlineStack gap="200" wrap>
                    {order.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </InlineStack>
                )}
              </BlockStack>
            </Card>

            {/* Line Items Card */}
            {order.lineItems.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Line Items
                  </Text>
                  <IndexTable
                    resourceName={{ singular: "item", plural: "items" }}
                    itemCount={order.lineItems.length}
                    headings={[
                      { title: "Item" },
                      { title: "Qty", alignment: "center" },
                      { title: "Price", alignment: "end" },
                    ]}
                    selectable={false}
                  >
                    {order.lineItems.map((item, i) => (
                      <IndexTable.Row id={String(i)} key={i} position={i}>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd">
                            {String(item.name ?? item.sku ?? `Item ${i + 1}`)}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd" alignment="center">
                            {String(item.quantity ?? 1)}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" variant="bodyMd" alignment="end">
                            {item.price != null ? `$${Number(item.price).toFixed(2)}` : "\u2014"}
                          </Text>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </BlockStack>
              </Card>
            )}

            {/* Proof of Delivery Card */}
            {order.proofOfDelivery && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Proof of Delivery
                  </Text>
                  {order.proofOfDelivery.signatureUrl && (
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                        Signature
                      </Text>
                      <img
                        src={order.proofOfDelivery.signatureUrl}
                        alt="Customer signature"
                        style={{ maxWidth: 300 }}
                      />
                    </BlockStack>
                  )}
                  {order.proofOfDelivery.photos.length > 0 && (
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                        Photos
                      </Text>
                      <InlineStack gap="200" wrap>
                        {order.proofOfDelivery.photos.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Delivery photo ${i + 1}`}
                            style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }}
                          />
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                  {order.proofOfDelivery.notes && (
                    <BlockStack gap="100">
                      <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">
                        Delivery Notes
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {order.proofOfDelivery.notes}
                      </Text>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        {/* ── Right Column: Actions, Driver, Route, Timeline ── */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Actions Card */}
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Actions
                </Text>

                {/* Status Update */}
                {nextStatuses.length > 0 && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="update-status" />
                    <BlockStack gap="300">
                      <Select
                        label="Update Status"
                        options={statusOptions}
                        name="status"
                        value={nextStatuses[0]}
                      />
                      <TextField
                        label="Note"
                        labelHidden
                        name="notes"
                        placeholder="Add a note (optional)"
                        autoComplete="off"
                      />
                      <Button submit variant="primary" loading={isSubmitting}>
                        Update Status
                      </Button>
                    </BlockStack>
                  </Form>
                )}

                {nextStatuses.length > 0 && <Divider />}

                {/* Driver Assignment */}
                <Form method="post">
                  <input type="hidden" name="intent" value="assign-driver" />
                  <BlockStack gap="300">
                    <Select
                      label={order.driver ? "Reassign Driver" : "Assign Driver"}
                      options={driverOptions}
                      name="driverId"
                      value={order.driver?.id ?? ""}
                    />
                    <Button submit loading={isSubmitting}>
                      {order.driver ? "Reassign" : "Assign Driver"}
                    </Button>
                  </BlockStack>
                </Form>

                {/* Cancel */}
                {STATUS_TRANSITIONS[order.status]?.includes("CANCELLED") && (
                  <>
                    <Divider />
                    <Form method="post">
                      <input type="hidden" name="intent" value="cancel" />
                      <Button submit tone="critical" loading={isSubmitting}>
                        Cancel Order
                      </Button>
                    </Form>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* Current Driver Card */}
            {order.driver && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Assigned Driver
                  </Text>
                  <BlockStack gap="100">
                    <PolarisLink url={`/drivers/${order.driver.id}`} removeUnderline>
                      {order.driver.name}
                    </PolarisLink>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {order.driver.phone}
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

            {/* Route Card */}
            {order.route && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Route
                  </Text>
                  <PolarisLink url={`/routes/${order.route.id}`} removeUnderline>
                    {order.route.name}
                  </PolarisLink>
                </BlockStack>
              </Card>
            )}

            {/* Timeline Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Timeline
                </Text>
                <StatusTimeline events={timeline} />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
