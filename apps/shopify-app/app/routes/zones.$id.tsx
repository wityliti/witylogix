/**
 * Zone Detail — Full zone view with coverage, capacity, drivers, and timeslots.
 *
 * Layout:
 *   Left column (60%): Zone info, coverage area, capacity, drivers
 *   Right column (40%): Time slots grid, active shipments, actions
 *
 * Actions:
 *   - Edit zone
 *   - Manage drivers
 *   - Adjust capacity
 *
 * Data loaded server-side. Mock data used in loaders.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  DescriptionList,
  ResourceList,
  ResourceItem,
  Avatar,
  ProgressBar,
  Divider,
  Box,
} from "@shopify/polaris";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Zone {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "CLOSED";
  type: string;
  coverageArea: string;
  boundaryNorth: number;
  boundarySouth: number;
  boundaryEast: number;
  boundaryWest: number;
  maxDeliveriesPerDay: number;
  currentUtilization: number;
}

interface ZoneDriver {
  id: string;
  name: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE" | "ON_DELIVERY";
}

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  capacity: number;
  utilization: number;
}

interface ActiveShipment {
  id: string;
  shipmentId: string;
  customerName: string;
  address: string;
  status: string;
}

interface ZonePageData {
  zone: Zone;
  drivers: ZoneDriver[];
  timeSlots: TimeSlot[];
  activeShipments: ActiveShipment[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  // Mock data for zone detail page
  const mockZone: Zone = {
    id: params.id!,
    name: "Downtown Core",
    status: "ACTIVE",
    type: "Urban",
    coverageArea: "Manhattan CBD, bounded by 5th Ave to 8th Ave, Canal St to Central Park South",
    boundaryNorth: 40.7764,
    boundarySouth: 40.7128,
    boundaryEast: -73.9776,
    boundaryWest: -74.0060,
    maxDeliveriesPerDay: 150,
    currentUtilization: 68,
  };

  const mockDrivers: ZoneDriver[] = [
    { id: "d1", name: "Marcus Johnson", phone: "+1 (555) 123-4567", status: "ACTIVE" },
    { id: "d2", name: "Sarah Chen", phone: "+1 (555) 234-5678", status: "ON_DELIVERY" },
    { id: "d3", name: "James Williams", phone: "+1 (555) 345-6789", status: "ACTIVE" },
  ];

  const mockTimeSlots: TimeSlot[] = [
    { id: "t1", day: "Monday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 44 },
    { id: "t2", day: "Monday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 38 },
    { id: "t3", day: "Monday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 32 },
    { id: "t4", day: "Tuesday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 48 },
    { id: "t5", day: "Tuesday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 42 },
    { id: "t6", day: "Tuesday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 35 },
    { id: "t7", day: "Wednesday", startTime: "09:00", endTime: "12:00", capacity: 50, utilization: 46 },
    { id: "t8", day: "Wednesday", startTime: "12:00", endTime: "15:00", capacity: 50, utilization: 40 },
    { id: "t9", day: "Wednesday", startTime: "15:00", endTime: "18:00", capacity: 50, utilization: 28 },
  ];

  const mockActiveShipments: ActiveShipment[] = [
    {
      id: "as1",
      shipmentId: "SH-001",
      customerName: "Acme Corp",
      address: "123 Main St",
      status: "IN_TRANSIT",
    },
    {
      id: "as2",
      shipmentId: "SH-002",
      customerName: "Tech Solutions Inc",
      address: "456 Oak Ave",
      status: "OUT_FOR_DELIVERY",
    },
    {
      id: "as3",
      shipmentId: "SH-003",
      customerName: "Creative Agency Ltd",
      address: "789 Maple Dr",
      status: "OUT_FOR_DELIVERY",
    },
    {
      id: "as4",
      shipmentId: "SH-004",
      customerName: "Marketing Solutions",
      address: "321 Pine Ln",
      status: "IN_TRANSIT",
    },
  ];

  return {
    zone: mockZone,
    drivers: mockDrivers,
    timeSlots: mockTimeSlots,
    activeShipments: mockActiveShipments,
  };
}

// ─── Helpers ───────────────────────────────────────────────

function getStatusBadgeTone(status: string): "success" | "critical" | undefined {
  if (status === "ACTIVE") return "success";
  if (status === "CLOSED") return "critical";
  return undefined;
}

function getDriverBadgeTone(status: string): "success" | "info" | undefined {
  if (status === "ACTIVE") return "success";
  if (status === "ON_DELIVERY") return "info";
  return undefined;
}

function getShipmentBadgeTone(status: string): "info" | undefined {
  if (status === "OUT_FOR_DELIVERY") return "info";
  return undefined;
}

function getUtilizationTone(percent: number): "critical" | "warning" | "success" {
  if (percent > 80) return "critical";
  if (percent > 60) return "warning";
  return "success";
}

// ─── Component ─────────────────────────────────────────────

export default function ZoneDetailPage() {
  const { zone, drivers, timeSlots, activeShipments } = useLoaderData<ZonePageData>();

  const dayGroups = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <Page
      backAction={{ content: "Zones", url: "/zones" }}
      title={zone.name}
      titleMetadata={
        <InlineStack gap="200">
          <Badge tone={getStatusBadgeTone(zone.status)}>
            {zone.status}
          </Badge>
          <Text as="span" variant="bodySm" tone="subdued">
            {zone.type}
          </Text>
        </InlineStack>
      }
    >
      <Layout>
        {/* Left Column */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Coverage Area Card */}
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Coverage Area
                </Text>
                <Text as="p" variant="bodyMd">
                  {zone.coverageArea}
                </Text>
                <Divider />
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  BOUNDARIES
                </Text>
                <DescriptionList
                  items={[
                    {
                      term: "North",
                      description: zone.boundaryNorth.toFixed(4),
                    },
                    {
                      term: "South",
                      description: zone.boundarySouth.toFixed(4),
                    },
                    {
                      term: "East",
                      description: zone.boundaryEast.toFixed(4),
                    },
                    {
                      term: "West",
                      description: zone.boundaryWest.toFixed(4),
                    },
                  ]}
                />
              </BlockStack>
            </Card>

            {/* Capacity Card */}
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingSm">
                  Capacity
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Utilization
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      {zone.currentUtilization}%
                    </Text>
                  </InlineStack>
                  <ProgressBar
                    progress={zone.currentUtilization}
                    tone={getUtilizationTone(zone.currentUtilization)}
                    size="small"
                  />
                </BlockStack>
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Max per day
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      {zone.maxDeliveriesPerDay}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Current
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      {Math.round((zone.currentUtilization / 100) * zone.maxDeliveriesPerDay)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Assigned Drivers Card */}
            {drivers.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Assigned Drivers ({drivers.length})
                  </Text>
                  <ResourceList
                    resourceName={{ singular: "driver", plural: "drivers" }}
                    items={drivers}
                    renderItem={(driver) => (
                      <ResourceItem
                        id={driver.id}
                        url={`/drivers/${driver.id}`}
                        media={
                          <Avatar
                            initials={driver.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                            name={driver.name}
                            size="sm"
                          />
                        }
                        accessibilityLabel={`View ${driver.name}`}
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodyMd" fontWeight="medium">
                              {driver.name}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {driver.phone}
                            </Text>
                          </BlockStack>
                          <Badge tone={getDriverBadgeTone(driver.status)}>
                            {driver.status.replace(/_/g, " ")}
                          </Badge>
                        </InlineStack>
                      </ResourceItem>
                    )}
                  />
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        {/* Right Column */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Actions Card */}
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Actions
                </Text>
                <Button variant="primary" fullWidth>
                  Edit Zone
                </Button>
                <Button fullWidth>
                  Manage Drivers
                </Button>
                <Button fullWidth>
                  Adjust Capacity
                </Button>
              </BlockStack>
            </Card>

            {/* Time Slots Card */}
            {timeSlots.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Time Slots
                  </Text>
                  {dayGroups.slice(0, 3).map((day) => {
                    const daySlots = timeSlots.filter((slot) => slot.day === day);
                    if (daySlots.length === 0) return null;
                    return (
                      <BlockStack key={day} gap="200">
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          {day}
                        </Text>
                        {daySlots.map((slot) => {
                          const utilizationPercent = Math.round(
                            (slot.utilization / slot.capacity) * 100,
                          );
                          return (
                            <Box
                              key={slot.id}
                              background="bg-surface-secondary"
                              padding="200"
                              borderRadius="100"
                            >
                              <BlockStack gap="100">
                                <Text as="span" variant="bodySm" fontWeight="medium">
                                  {slot.startTime} – {slot.endTime}
                                </Text>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {slot.utilization}/{slot.capacity}
                                </Text>
                                <ProgressBar
                                  progress={utilizationPercent}
                                  tone={getUtilizationTone(utilizationPercent)}
                                  size="small"
                                />
                              </BlockStack>
                            </Box>
                          );
                        })}
                      </BlockStack>
                    );
                  })}
                </BlockStack>
              </Card>
            )}

            {/* Active Shipments Card */}
            {activeShipments.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingSm">
                    Active Shipments ({activeShipments.length})
                  </Text>
                  <ResourceList
                    resourceName={{ singular: "shipment", plural: "shipments" }}
                    items={activeShipments}
                    renderItem={(shipment) => (
                      <ResourceItem
                        id={shipment.id}
                        url={`/shipments/${shipment.shipmentId}`}
                        accessibilityLabel={`View shipment ${shipment.shipmentId}`}
                      >
                        <InlineStack align="space-between" blockAlign="start" wrap={false} gap="200">
                          <BlockStack gap="050">
                            <Text as="span" variant="bodyMd" fontWeight="medium" tone="magic">
                              {shipment.shipmentId}
                            </Text>
                            <Text as="span" variant="bodySm">
                              {shipment.customerName}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {shipment.address}
                            </Text>
                          </BlockStack>
                          <Badge tone={getShipmentBadgeTone(shipment.status)}>
                            {shipment.status.replace(/_/g, " ")}
                          </Badge>
                        </InlineStack>
                      </ResourceItem>
                    )}
                  />
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
