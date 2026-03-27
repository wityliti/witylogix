/**
 * Driver Detail — Full driver view with performance metrics, activity timeline, and actions.
 *
 * Layout:
 *   Left column (60%): Profile, vehicle info, zones, performance metrics
 *   Right column (40%): Today's route, recent deliveries, activity timeline
 *
 * Actions:
 *   - Edit driver (admin panel link)
 *   - Assign route (modal)
 *   - Deactivate driver (status update)
 *   - Message driver (external link)
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
import {
  Page,
  Layout,
  Card,
  DescriptionList,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Text,
  IndexTable,
  Box,
  Divider,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  hireDate: string;
  status: "ACTIVE" | "INACTIVE" | "ON_DELIVERY" | "ON_BREAK";
  avatar: string | null;
  vehicle: {
    type: string;
    plate: string | null;
    model: string | null;
  };
  zones: Array<{
    id: string;
    name: string;
  }>;
  performance: {
    rating: number;
    onTimePercentage: number;
    totalDeliveries: number;
    avgDeliveryTime: number;
  };
}

interface RouteStop {
  id: string;
  address: string;
  customerName: string;
  timeWindow: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED";
  deliveryType: string;
}

interface Delivery {
  id: string;
  shipmentId: string;
  deliveryDate: string;
  location: string;
  status: string;
  duration: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface DriverPageData {
  driver: Driver;
  todayRoute: RouteStop[];
  recentDeliveries: Delivery[];
  timeline: Activity[];
}

const STATUS_BADGE_TONE: Record<string, BadgeProps["tone"]> = {
  ACTIVE: "success",
  INACTIVE: undefined,
  ON_DELIVERY: "info",
  ON_BREAK: "attention",
};

const STOP_STATUS_BADGE_TONE: Record<string, BadgeProps["tone"]> = {
  COMPLETED: "success",
  PENDING: "attention",
  SKIPPED: undefined,
  FAILED: "critical",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  // Mock data for driver detail page
  const mockDriver: Driver = {
    id: params.id!,
    name: "Marcus Johnson",
    email: "marcus.johnson@delivery.com",
    phone: "+1 (555) 123-4567",
    hireDate: "2022-03-15",
    status: "ON_DELIVERY",
    avatar: null,
    vehicle: {
      type: "Van",
      plate: "DLV-2847",
      model: "Ford Transit 2023",
    },
    zones: [
      { id: "z1", name: "Downtown Core" },
      { id: "z2", name: "Midtown East" },
    ],
    performance: {
      rating: 4.8,
      onTimePercentage: 96,
      totalDeliveries: 1247,
      avgDeliveryTime: 8.5,
    },
  };

  const mockTodayRoute: RouteStop[] = [
    {
      id: "rs1",
      address: "123 Main St, Downtown",
      customerName: "Acme Corp",
      timeWindow: "09:00 - 10:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
    },
    {
      id: "rs2",
      address: "456 Oak Ave, Midtown",
      customerName: "Tech Solutions Inc",
      timeWindow: "10:15 - 11:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
    },
    {
      id: "rs3",
      address: "789 Maple Dr, Downtown",
      customerName: "Creative Agency Ltd",
      timeWindow: "11:30 - 12:30",
      status: "PENDING",
      deliveryType: "Delivery",
    },
    {
      id: "rs4",
      address: "321 Pine Ln, Midtown",
      customerName: "Marketing Solutions",
      timeWindow: "13:00 - 14:00",
      status: "PENDING",
      deliveryType: "Delivery",
    },
  ];

  const mockRecentDeliveries: Delivery[] = [
    {
      id: "d1",
      shipmentId: "SH-001",
      deliveryDate: "2024-03-05",
      location: "123 Main St",
      status: "DELIVERED",
      duration: 9,
    },
    {
      id: "d2",
      shipmentId: "SH-002",
      deliveryDate: "2024-03-05",
      location: "456 Oak Ave",
      status: "DELIVERED",
      duration: 7,
    },
    {
      id: "d3",
      shipmentId: "SH-003",
      deliveryDate: "2024-03-04",
      location: "789 Maple Dr",
      status: "DELIVERED",
      duration: 10,
    },
    {
      id: "d4",
      shipmentId: "SH-004",
      deliveryDate: "2024-03-04",
      location: "321 Pine Ln",
      status: "DELIVERED",
      duration: 8,
    },
    {
      id: "d5",
      shipmentId: "SH-005",
      deliveryDate: "2024-03-04",
      location: "654 Cedar St",
      status: "DELIVERED",
      duration: 6,
    },
  ];

  const mockTimeline: Activity[] = [
    {
      id: "a1",
      type: "route_started",
      message: "Started today's route",
      timestamp: "2024-03-06T08:00:00Z",
    },
    {
      id: "a2",
      type: "stop_completed",
      message: "Completed stop 1 at 123 Main St",
      timestamp: "2024-03-06T09:45:00Z",
    },
    {
      id: "a3",
      type: "stop_completed",
      message: "Completed stop 2 at 456 Oak Ave",
      timestamp: "2024-03-06T10:50:00Z",
    },
    {
      id: "a4",
      type: "on_break",
      message: "On break",
      timestamp: "2024-03-06T11:15:00Z",
    },
  ];

  return {
    driver: mockDriver,
    todayRoute: mockTodayRoute,
    recentDeliveries: mockRecentDeliveries,
    timeline: mockTimeline,
  };
}

// ─── Component ─────────────────────────────────────────────

export default function DriverDetailPage() {
  const { driver, todayRoute, recentDeliveries, timeline } = useLoaderData<DriverPageData>();

  return (
    <Page
      backAction={{ content: "Drivers", url: "/drivers" }}
      title={driver.name}
      titleMetadata={
        <Badge tone={STATUS_BADGE_TONE[driver.status]}>
          {driver.status.replace(/_/g, " ")}
        </Badge>
      }
      subtitle={`Hired ${new Date(driver.hireDate).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })}`}
    >
      <Layout>
        {/* Left Column */}
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Contact Information
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "Email",
                      description: (
                        <a href={`mailto:${driver.email}`}>
                          <Text as="span" tone="magic">
                            {driver.email}
                          </Text>
                        </a>
                      ),
                    },
                    {
                      term: "Phone",
                      description: (
                        <a href={`tel:${driver.phone}`}>
                          <Text as="span" tone="magic">
                            {driver.phone}
                          </Text>
                        </a>
                      ),
                    },
                    {
                      term: "Hire Date",
                      description: new Date(driver.hireDate).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      ),
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            {driver.vehicle && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Vehicle Information
                  </Text>
                  <DescriptionList
                    items={[
                      { term: "Type", description: driver.vehicle.type },
                      {
                        term: "Plate",
                        description: driver.vehicle.plate ?? "\u2014",
                      },
                      {
                        term: "Model",
                        description: driver.vehicle.model ?? "\u2014",
                      },
                    ]}
                  />
                </BlockStack>
              </Card>
            )}

            {driver.zones.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Assigned Zones
                  </Text>
                  <InlineStack gap="200" wrap>
                    {driver.zones.map((zone) => (
                      <Link key={zone.id} to={`/zones/${zone.id}`}>
                        <Badge tone="info">{zone.name}</Badge>
                      </Link>
                    ))}
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Performance Metrics
                </Text>
                <InlineStack gap="400" wrap>
                  <MetricBox
                    label="Rating"
                    value={driver.performance.rating.toFixed(1)}
                  />
                  <MetricBox
                    label="On-Time"
                    value={`${driver.performance.onTimePercentage}%`}
                  />
                  <MetricBox
                    label="Total Deliveries"
                    value={String(driver.performance.totalDeliveries)}
                  />
                  <MetricBox
                    label="Avg. Time"
                    value={`${driver.performance.avgDeliveryTime}m`}
                  />
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Right Column */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Actions
                </Text>
                <Button variant="primary" fullWidth>
                  Edit Driver
                </Button>
                <Button fullWidth>Assign Route</Button>
                <Button fullWidth>Message</Button>
                {driver.status === "ACTIVE" && (
                  <Button fullWidth tone="critical">
                    Deactivate
                  </Button>
                )}
              </BlockStack>
            </Card>

            {todayRoute.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Today's Route
                  </Text>
                  {todayRoute.map((stop, idx) => (
                    <Card key={stop.id}>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodySm" fontWeight="semibold" tone="subdued">
                            Stop {idx + 1}
                          </Text>
                          <Badge tone={STOP_STATUS_BADGE_TONE[stop.status]} size="small">
                            {stop.status}
                          </Badge>
                        </InlineStack>
                        <Text as="span" variant="bodyMd" fontWeight="medium">
                          {stop.customerName}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {stop.address}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {stop.timeWindow}
                        </Text>
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>
              </Card>
            )}

            {recentDeliveries.length > 0 && (
              <Card padding="0">
                <Box padding="400" paddingBlockEnd="0">
                  <Text as="h3" variant="headingSm">
                    Recent Deliveries
                  </Text>
                </Box>
                <IndexTable
                  resourceName={{ singular: "delivery", plural: "deliveries" }}
                  itemCount={recentDeliveries.length}
                  headings={[
                    { title: "Shipment" },
                    { title: "Date" },
                    { title: "Time", alignment: "center" },
                  ]}
                  selectable={false}
                >
                  {recentDeliveries.slice(0, 5).map((delivery, index) => (
                    <IndexTable.Row
                      id={delivery.id}
                      key={delivery.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Link to={`/shipments/${delivery.shipmentId}`}>
                          <Text as="span" tone="magic" fontWeight="semibold">
                            {delivery.shipmentId}
                          </Text>
                        </Link>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd">
                          {new Date(delivery.deliveryDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" alignment="center">
                          {delivery.duration}m
                        </Text>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              </Card>
            )}

            {timeline.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Activity
                  </Text>
                  {timeline.map((event) => (
                    <BlockStack key={event.id} gap="050">
                      <Text as="span" variant="bodyMd">
                        {event.message}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {new Date(event.timestamp).toLocaleTimeString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </BlockStack>
                  ))}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ─── Sub-components ────────────────────────────────────────

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <Box
      background="bg-surface-secondary"
      padding="300"
      borderRadius="200"
      minWidth="120px"
    >
      <BlockStack gap="100" inlineAlign="center">
        <Text as="span" variant="headingMd" fontWeight="bold">
          {value}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
      </BlockStack>
    </Box>
  );
}
