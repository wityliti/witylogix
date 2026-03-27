/**
 * Route Detail — Full route view with stops, timeline, and optimization actions.
 *
 * Layout:
 *   Left column (60%): Route header, stats, stops list, timeline
 *   Right column (40%): Map placeholder, actions, summary
 *
 * Actions:
 *   - Optimize route (re-sequence stops)
 *   - Reassign driver
 *   - Export route
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClientFromRequest, type SingleResponse } from "~/lib/api.server";
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
  Box,
  ProgressBar,
  Divider,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

// ─── Types ─────────────────────────────────────────────────

interface Route {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "FAILED";
  driver: {
    id: string;
    name: string;
    phone: string;
  } | null;
  date: string;
  vehicle: string;
  totalStops: number;
  completedStops: number;
  totalDistance: number;
  estimatedDuration: number;
}

interface Stop {
  id: string;
  stopNumber: number;
  address: string;
  customerName: string;
  timeWindow: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED";
  deliveryType: string;
  lat: number;
  lng: number;
}

interface RouteEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface RoutePageData {
  route: Route;
  stops: Stop[];
  timeline: RouteEvent[];
}

const STATUS_BADGE_TONE: Record<string, BadgeProps["tone"]> = {
  PLANNED: "attention",
  ACTIVE: "info",
  COMPLETED: "success",
  FAILED: "critical",
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
  const api = createApiClientFromRequest(request, session);

  // Mock data for route detail page
  const mockRoute: Route = {
    id: params.id!,
    name: "Route DT-2024-03-06-001",
    status: "ACTIVE",
    driver: {
      id: "drv1",
      name: "Marcus Johnson",
      phone: "+1 (555) 123-4567",
    },
    date: "2024-03-06",
    vehicle: "Van (DLV-2847)",
    totalStops: 12,
    completedStops: 4,
    totalDistance: 28.5,
    estimatedDuration: 240,
  };

  const mockStops: Stop[] = [
    {
      id: "s1",
      stopNumber: 1,
      address: "123 Main St, Downtown",
      customerName: "Acme Corp",
      timeWindow: "09:00 - 10:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7128,
      lng: -74.006,
    },
    {
      id: "s2",
      stopNumber: 2,
      address: "456 Oak Ave, Midtown",
      customerName: "Tech Solutions Inc",
      timeWindow: "10:15 - 11:00",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7505,
      lng: -73.9972,
    },
    {
      id: "s3",
      stopNumber: 3,
      address: "789 Maple Dr, Downtown",
      customerName: "Creative Agency Ltd",
      timeWindow: "11:30 - 12:30",
      status: "COMPLETED",
      deliveryType: "Delivery",
      lat: 40.7489,
      lng: -73.968,
    },
    {
      id: "s4",
      stopNumber: 4,
      address: "321 Pine Ln, Midtown",
      customerName: "Marketing Solutions",
      timeWindow: "13:00 - 14:00",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7614,
      lng: -73.9776,
    },
    {
      id: "s5",
      stopNumber: 5,
      address: "654 Cedar St, Downtown",
      customerName: "Digital Studio",
      timeWindow: "14:15 - 15:00",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7549,
      lng: -73.984,
    },
    {
      id: "s6",
      stopNumber: 6,
      address: "987 Elm Ave, Uptown",
      customerName: "Finance Corp",
      timeWindow: "15:30 - 16:30",
      status: "PENDING",
      deliveryType: "Delivery",
      lat: 40.7282,
      lng: -73.7949,
    },
  ];

  const mockTimeline: RouteEvent[] = [
    {
      id: "e1",
      type: "route_started",
      message: "Route started",
      timestamp: "2024-03-06T08:00:00Z",
    },
    {
      id: "e2",
      type: "arrived_at_stop",
      message: "Arrived at stop 1 (123 Main St)",
      timestamp: "2024-03-06T08:50:00Z",
    },
    {
      id: "e3",
      type: "stop_completed",
      message: "Completed delivery at stop 1",
      timestamp: "2024-03-06T09:45:00Z",
    },
    {
      id: "e4",
      type: "arrived_at_stop",
      message: "Arrived at stop 2 (456 Oak Ave)",
      timestamp: "2024-03-06T10:10:00Z",
    },
    {
      id: "e5",
      type: "stop_completed",
      message: "Completed delivery at stop 2",
      timestamp: "2024-03-06T10:50:00Z",
    },
  ];

  return {
    route: mockRoute,
    stops: mockStops,
    timeline: mockTimeline,
  };
}

// ─── Component ─────────────────────────────────────────────

export default function RouteDetailPage() {
  const { route, stops, timeline } = useLoaderData<RoutePageData>();
  const pendingStops = stops.filter((s) => s.status === "PENDING").length;
  const progressPercent = Math.round(
    (route.completedStops / route.totalStops) * 100,
  );

  return (
    <Page
      backAction={{ content: "Routes", url: "/routes" }}
      title={route.name}
      titleMetadata={
        <Badge tone={STATUS_BADGE_TONE[route.status]}>
          {route.status}
        </Badge>
      }
      subtitle={new Date(route.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    >
      <BlockStack gap="400">
        {/* Stats Row */}
        <InlineStack gap="400" wrap>
          <StatBox label="Total Stops" value={String(route.totalStops)} />
          <StatBox
            label="Completed"
            value={`${route.completedStops}/${route.totalStops}`}
          />
          <StatBox label="Distance" value={`${route.totalDistance} km`} />
          <StatBox
            label="Est. Duration"
            value={`${Math.floor(route.estimatedDuration / 60)}h ${route.estimatedDuration % 60}m`}
          />
        </InlineStack>

        <Layout>
          {/* Left Column */}
          <Layout.Section>
            <BlockStack gap="400">
              {route.driver && (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      Assigned Driver
                    </Text>
                    <DescriptionList
                      items={[
                        {
                          term: "Name",
                          description: (
                            <Link to={`/drivers/${route.driver.id}`}>
                              <Text as="span" tone="magic" fontWeight="semibold">
                                {route.driver.name}
                              </Text>
                            </Link>
                          ),
                        },
                        { term: "Phone", description: route.driver.phone },
                      ]}
                    />
                  </BlockStack>
                </Card>
              )}

              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Vehicle
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {route.vehicle}
                  </Text>
                </BlockStack>
              </Card>

              {stops.length > 0 && (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      Route Stops ({stops.length})
                    </Text>
                    {stops.map((stop) => (
                      <Card key={stop.id}>
                        <BlockStack gap="100">
                          <InlineStack align="space-between">
                            <Text
                              as="span"
                              variant="bodySm"
                              fontWeight="semibold"
                              tone="subdued"
                            >
                              Stop {stop.stopNumber}
                            </Text>
                            <Badge
                              tone={STOP_STATUS_BADGE_TONE[stop.status]}
                              size="small"
                            >
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
                    Optimize Route
                  </Button>
                  <Button fullWidth>Reassign Driver</Button>
                  <Button fullWidth>Export Route</Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Route Visualization
                  </Text>
                  <Box
                    background="bg-surface-secondary"
                    padding="800"
                    borderRadius="200"
                  >
                    <BlockStack gap="200" inlineAlign="center">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Map: {route.totalStops} stops route for {route.date}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {pendingStops} stops remaining
                      </Text>
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Summary
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Progress
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {progressPercent}%
                      </Text>
                    </InlineStack>
                    <ProgressBar progress={progressPercent} size="small" />
                  </BlockStack>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Completed
                      </Text>
                      <Text as="span" variant="bodyMd" tone="success">
                        {route.completedStops}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Remaining
                      </Text>
                      <Text as="span" variant="bodyMd" tone="caution">
                        {pendingStops}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {timeline.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      Timeline
                    </Text>
                    {timeline.map((event) => (
                      <BlockStack key={event.id} gap="050">
                        <Text as="span" variant="bodyMd">
                          {event.message}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {new Date(event.timestamp).toLocaleTimeString(
                            "en-US",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </Text>
                      </BlockStack>
                    ))}
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

// ─── Sub-components ────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Box
      background="bg-surface"
      padding="300"
      borderRadius="200"
      borderWidth="025"
      borderColor="border"
      minWidth="140px"
    >
      <BlockStack gap="100" inlineAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="span" variant="headingMd" fontWeight="bold">
          {value}
        </Text>
      </BlockStack>
    </Box>
  );
}
