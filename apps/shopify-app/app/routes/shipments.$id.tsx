/**
 * Shipment Detail — Full shipment view with status timeline, delivery info, and actions.
 *
 * Layout:
 *   Left column (60%): Shipment details, customer info, driver info, activity log
 *   Right column (40%): Status timeline, delivery proof, actions
 *
 * Actions:
 *   - Update Status (dropdown)
 *   - Assign Driver (dropdown)
 *   - Print Label
 *   - Cancel Shipment
 *
 * Data loaded server-side. Status updates via action (form submission).
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, Link, useNavigation, redirect } from "react-router";
import { ShipmentStatusBadge } from "~/components/ShipmentStatusBadge";
import { StatusTimeline } from "~/components/StatusTimeline";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
import {
  Page,
  Layout,
  Card,
  DescriptionList,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Select,
  TextField,
  Box,
  Divider,
  Thumbnail,
  Banner,
} from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  status: string;
  carrier: string | null;
  deliveryMethod: string | null;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
  originAddress: {
    name: string;
    email: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
  destinationAddress: {
    name: string;
    email: string | null;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    province: string | null;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  driver: { id: string; name: string; phone: string; vehicleType: string; vehiclePlate: string | null } | null;
  deliveryProof: { photos: string[]; signatureUrl: string | null; notes: string | null } | null;
  eta: string | null;
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

interface ShipmentPageData {
  shipment: ShipmentDetail;
  timeline: TimelineEvent[];
  availableDrivers: { id: string; name: string; phone: string; activeShipments: number }[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "ATTEMPTED", "FAILED"],
  ATTEMPTED: ["OUT_FOR_DELIVERY", "FAILED"],
  FAILED: ["IN_TRANSIT", "RETURNED"],
  RETURNED: [],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const [shipmentRes, timelineRes, driversRes] = await Promise.allSettled([
    api.get<SingleResponse<ShipmentDetail>>(`/api/v4/shipments/${params.id}`),
    api.get<SingleResponse<TimelineEvent[]>>(`/api/v4/shipments/${params.id}/timeline`),
    api.get<SingleResponse<{ id: string; name: string; phone: string; activeShipments: number }[]>>(
      "/api/v4/drivers",
      { status: "AVAILABLE", limit: 50 },
    ),
  ]);

  if (shipmentRes.status === "rejected") {
    throw new Response("Shipment not found", { status: 404 });
  }

  return {
    shipment: shipmentRes.value.data,
    timeline: timelineRes.status === "fulfilled" ? timelineRes.value.data : [],
    availableDrivers: driversRes.status === "fulfilled" ? driversRes.value.data : [],
  };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string | null;
    await api.patch(`/api/v4/shipments/${params.id}/status`, {
      status,
      notes: notes || undefined,
    });
  }

  if (intent === "assign-driver") {
    const driverId = formData.get("driverId") as string;
    await api.patch(`/api/v4/shipments/${params.id}`, { driverId });
  }

  if (intent === "print-label") {
    await api.post(`/api/v4/shipments/${params.id}/print-label`, {});
  }

  if (intent === "cancel") {
    await api.patch(`/api/v4/shipments/${params.id}/status`, {
      status: "CANCELLED",
      notes: "Cancelled by admin",
    });
  }

  return redirect(`/shipments/${params.id}`);
}

// ─── Helpers ──────────────────────────────────────────────

function formatAddress(addr: ShipmentDetail["originAddress"]): string {
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.province, addr.postalCode].filter(Boolean).join(", "),
    addr.country,
  ].filter(Boolean);
  return parts.join("\n");
}

// ─── Component ─────────────────────────────────────────────

export default function ShipmentDetailPage() {
  const { shipment, timeline, availableDrivers } = useLoaderData<ShipmentPageData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const nextStatuses = STATUS_TRANSITIONS[shipment.status] ?? [];

  const statusOptions = nextStatuses.map((s) => ({
    label: s.replace(/_/g, " "),
    value: s,
  }));

  const driverOptions = [
    { label: "Select a driver...", value: "" },
    ...availableDrivers.map((d) => ({
      label: `${d.name} (${d.activeShipments} active)`,
      value: d.id,
    })),
  ];

  const shipmentDetailsItems = [
    { term: "Carrier", description: shipment.carrier ?? "\u2014" },
    {
      term: "Delivery Method",
      description: shipment.deliveryMethod
        ? shipment.deliveryMethod.replace(/_/g, " ")
        : "\u2014",
    },
    {
      term: "ETA",
      description: shipment.eta
        ? new Date(shipment.eta).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "Not available",
    },
    {
      term: "Weight",
      description: shipment.weight != null ? `${shipment.weight}g` : "\u2014",
    },
    ...(shipment.dimensions
      ? [
          {
            term: "Dimensions",
            description: `${shipment.dimensions.length} x ${shipment.dimensions.width} x ${shipment.dimensions.height} cm`,
          },
        ]
      : []),
  ];

  const originItems = [
    { term: "Name", description: shipment.originAddress.name },
    { term: "Address", description: formatAddress(shipment.originAddress) },
    ...(shipment.originAddress.phone
      ? [{ term: "Phone", description: shipment.originAddress.phone }]
      : []),
    ...(shipment.originAddress.email
      ? [{ term: "Email", description: shipment.originAddress.email }]
      : []),
    ...(shipment.originAddress.latitude && shipment.originAddress.longitude
      ? [
          {
            term: "GPS",
            description: `${shipment.originAddress.latitude.toFixed(6)}, ${shipment.originAddress.longitude.toFixed(6)}`,
          },
        ]
      : []),
  ];

  const destinationItems = [
    { term: "Name", description: shipment.destinationAddress.name },
    { term: "Address", description: formatAddress(shipment.destinationAddress) },
    ...(shipment.destinationAddress.phone
      ? [{ term: "Phone", description: shipment.destinationAddress.phone }]
      : []),
    ...(shipment.destinationAddress.email
      ? [{ term: "Email", description: shipment.destinationAddress.email }]
      : []),
    ...(shipment.destinationAddress.latitude && shipment.destinationAddress.longitude
      ? [
          {
            term: "GPS",
            description: `${shipment.destinationAddress.latitude.toFixed(6)}, ${shipment.destinationAddress.longitude.toFixed(6)}`,
          },
        ]
      : []),
  ];

  return (
    <Page
      backAction={{ content: "Shipments", url: "/shipments" }}
      title={shipment.trackingNumber}
      titleMetadata={<ShipmentStatusBadge status={shipment.status} />}
      subtitle={`Created ${new Date(shipment.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`}
    >
      <Layout>
        {/* Left Column */}
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Shipment Details
                </Text>
                <DescriptionList items={shipmentDetailsItems} />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Origin Address
                </Text>
                <DescriptionList items={originItems} />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Destination Address
                </Text>
                <DescriptionList items={destinationItems} />
              </BlockStack>
            </Card>

            {shipment.customerName && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Customer Info
                  </Text>
                  <DescriptionList
                    items={[
                      { term: "Name", description: shipment.customerName },
                      ...(shipment.customerEmail
                        ? [{ term: "Email", description: shipment.customerEmail }]
                        : []),
                      ...(shipment.customerPhone
                        ? [{ term: "Phone", description: shipment.customerPhone }]
                        : []),
                    ]}
                  />
                </BlockStack>
              </Card>
            )}

            {shipment.driver && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Driver Info
                  </Text>
                  <DescriptionList
                    items={[
                      {
                        term: "Name",
                        description: (
                          <Link to={`/drivers/${shipment.driver.id}`}>
                            <Text as="span" tone="magic" fontWeight="semibold">
                              {shipment.driver.name}
                            </Text>
                          </Link>
                        ),
                      },
                      { term: "Phone", description: shipment.driver.phone },
                      {
                        term: "Vehicle",
                        description: `${shipment.driver.vehicleType}${
                          shipment.driver.vehiclePlate
                            ? ` (${shipment.driver.vehiclePlate})`
                            : ""
                        }`,
                      },
                    ]}
                  />
                </BlockStack>
              </Card>
            )}

            {shipment.deliveryProof && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Proof of Delivery
                  </Text>
                  {shipment.deliveryProof.signatureUrl && (
                    <BlockStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="medium">
                        Signature
                      </Text>
                      <img
                        src={shipment.deliveryProof.signatureUrl}
                        alt="Signature"
                        style={{ maxWidth: 300, borderRadius: 8 }}
                      />
                    </BlockStack>
                  )}
                  {shipment.deliveryProof.photos.length > 0 && (
                    <BlockStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="medium">
                        Photos
                      </Text>
                      <InlineStack gap="200" wrap>
                        {shipment.deliveryProof.photos.map((url, i) => (
                          <Thumbnail
                            key={i}
                            source={url}
                            alt={`Delivery photo ${i + 1}`}
                            size="large"
                          />
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                  {shipment.deliveryProof.notes && (
                    <BlockStack gap="200">
                      <Text as="span" variant="bodySm" fontWeight="medium">
                        Delivery Notes
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {shipment.deliveryProof.notes}
                      </Text>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        {/* Right Column */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Actions
                </Text>

                {nextStatuses.length > 0 && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="update-status" />
                    <BlockStack gap="300">
                      <Select
                        label="Update Status"
                        options={statusOptions}
                        name="status"
                        value={nextStatuses[0]}
                        onChange={() => {}}
                      />
                      <TextField
                        label="Notes"
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

                <Divider />

                <Form method="post">
                  <input type="hidden" name="intent" value="assign-driver" />
                  <BlockStack gap="300">
                    <Select
                      label={shipment.driver ? "Reassign Driver" : "Assign Driver"}
                      options={driverOptions}
                      name="driverId"
                      value={shipment.driver?.id ?? ""}
                      onChange={() => {}}
                    />
                    <Button submit loading={isSubmitting}>
                      {shipment.driver ? "Reassign" : "Assign Driver"}
                    </Button>
                  </BlockStack>
                </Form>

                <Form method="post">
                  <input type="hidden" name="intent" value="print-label" />
                  <Button submit fullWidth loading={isSubmitting}>
                    Print Label
                  </Button>
                </Form>

                {STATUS_TRANSITIONS[shipment.status]?.includes("CANCELLED") && (
                  <>
                    <Divider />
                    <Form method="post">
                      <input type="hidden" name="intent" value="cancel" />
                      <Button
                        submit
                        fullWidth
                        tone="critical"
                        loading={isSubmitting}
                      >
                        Cancel Shipment
                      </Button>
                    </Form>
                  </>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Status Timeline
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
