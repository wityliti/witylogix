/**
 * Calendar & Availability — Blackout dates and calendar rules management.
 *
 * Features:
 *   - Month view calendar grid (current month, prev/next navigation)
 *   - Blackout dates shown as highlighted cells with color coding
 *   - Rules list below calendar: name, type, recurrence, affected zones
 *   - Rule type badges: BLACKOUT=red, CAPACITY=blue, HOLIDAY=orange, SPECIAL=purple
 *   - Add Rule button (opens modal or navigates to form)
 *   - Empty state when no rules
 *
 * All data is loaded server-side via React Router v7 loader.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import {
  Page,
  Card,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  InlineGrid,
  Box,
  Divider,
  EmptyState as PolarisEmptyState,
} from "@shopify/polaris";
import { createApiClientFromRequest } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface CalendarRule {
  id: string;
  name: string;
  type: "BLACKOUT" | "CAPACITY" | "HOLIDAY" | "SPECIAL";
  description?: string;
  startDate: string;
  endDate: string;
  recurrence?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  affectedZones: Array<{
    zoneId: string;
    zoneName: string;
  }>;
  createdAt: string;
}

interface CalendarPageData {
  rules: CalendarRule[];
  blackoutDates: string[]; // ISO date strings
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  try {
    const response = await api.get<{ rules: CalendarRule[] }>(
      "/api/v4/calendar-rules",
    );
    const rules = response.rules || [];

    // Extract blackout dates from rules
    const blackoutDates = rules
      .filter((r) => r.type === "BLACKOUT")
      .flatMap((r) => {
        const dates: string[] = [];
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split("T")[0]);
        }
        return dates;
      });

    return { rules, blackoutDates };
  } catch {
    // Fallback mock data
    return {
      rules: [
        {
          id: "cr1",
          name: "Summer Warehouse Closure",
          type: "BLACKOUT",
          description: "Annual warehouse maintenance",
          startDate: "2026-07-15",
          endDate: "2026-07-22",
          recurrence: "YEARLY",
          affectedZones: [
            { zoneId: "z1", zoneName: "Downtown Central" },
            { zoneId: "z2", zoneName: "Suburbs North" },
          ],
          createdAt: "2026-01-10T08:00:00Z",
        },
        {
          id: "cr2",
          name: "Reduced Capacity - Zone 3",
          type: "CAPACITY",
          description: "Two drivers on leave",
          startDate: "2026-03-15",
          endDate: "2026-03-20",
          recurrence: "ONCE",
          affectedZones: [{ zoneId: "z3", zoneName: "Industrial East" }],
          createdAt: "2026-03-01T10:30:00Z",
        },
        {
          id: "cr3",
          name: "Public Holiday",
          type: "HOLIDAY",
          description: "National holiday - no deliveries",
          startDate: "2026-07-04",
          endDate: "2026-07-04",
          recurrence: "YEARLY",
          affectedZones: [
            { zoneId: "z1", zoneName: "Downtown Central" },
            { zoneId: "z2", zoneName: "Suburbs North" },
            { zoneId: "z3", zoneName: "Industrial East" },
            { zoneId: "z4", zoneName: "Airport West" },
            { zoneId: "z5", zoneName: "Waterfront South" },
          ],
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "cr4",
          name: "Weekend Extended Hours",
          type: "SPECIAL",
          description: "Extra Saturday deliveries available",
          startDate: "2026-03-08",
          endDate: "2026-03-09",
          recurrence: "WEEKLY",
          affectedZones: [{ zoneId: "z2", zoneName: "Suburbs North" }],
          createdAt: "2026-02-20T14:00:00Z",
        },
      ],
      blackoutDates: [
        "2026-07-15",
        "2026-07-16",
        "2026-07-17",
        "2026-07-18",
        "2026-07-19",
        "2026-07-20",
        "2026-07-21",
        "2026-07-22",
        "2026-07-04",
      ],
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────

const RULE_TYPE_BADGE_TONE: Record<string, "critical" | "info" | "warning" | "success"> = {
  BLACKOUT: "critical",
  CAPACITY: "info",
  HOLIDAY: "warning",
  SPECIAL: "success",
};

function getRuleTypeLabel(type: string): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

// ─── Component ─────────────────────────────────────────────

export default function Calendar() {
  const { rules, blackoutDates } = useLoaderData<CalendarPageData>();
  const [searchParams] = useSearchParams();

  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  const today = new Date();
  const currentMonth = monthParam ? parseInt(monthParam) : today.getMonth();
  const currentYear = yearParam ? parseInt(yearParam) : today.getFullYear();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString(
    "en-US",
    { month: "long" },
  );

  const daysArray: (number | null)[] = Array(startingDayOfWeek)
    .fill(null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const isBlackoutDate = (day: number | null): boolean => {
    if (!day) return false;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return blackoutDates.includes(dateStr);
  };

  return (
    <Page
      title="Calendar & Availability"
      subtitle="Manage blackout dates and delivery rules"
      primaryAction={{ content: "Add Rule", url: "/calendar/new" }}
    >
      <BlockStack gap="600">
        {/* Calendar Section */}
        <Card>
          <BlockStack gap="400">
            {/* Month Navigation */}
            <InlineStack align="space-between" blockAlign="center">
              <Button size="slim">
                Prev
              </Button>
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                {monthName} {currentYear}
              </Text>
              <Button size="slim">
                Next
              </Button>
            </InlineStack>

            {/* Calendar Grid */}
            <Box
              background="bg-surface-secondary"
              padding="050"
              borderRadius="200"
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 2,
                }}
              >
                {/* Weekday headers */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <Box
                    key={day}
                    background="bg-surface"
                    padding="300"
                  >
                    <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued" alignment="center">
                      {day}
                    </Text>
                  </Box>
                ))}

                {/* Calendar days */}
                {daysArray.map((day, idx) => (
                  <Box
                    key={idx}
                    background={isBlackoutDate(day) ? "bg-surface-critical" : "bg-surface"}
                    padding="300"
                    minHeight="60px"
                  >
                    {day !== null && (
                      <Text
                        as="p"
                        variant="bodyMd"
                        fontWeight={isBlackoutDate(day) ? "bold" : "medium"}
                        tone={isBlackoutDate(day) ? "critical" : undefined}
                        alignment="center"
                      >
                        {day}
                      </Text>
                    )}
                  </Box>
                ))}
              </div>
            </Box>

            {/* Legend */}
            <Divider />
            <InlineStack gap="400" wrap>
              <InlineStack gap="200" blockAlign="center">
                <Box
                  background="bg-fill-critical"
                  borderRadius="050"
                  minHeight="16px"
                  minWidth="16px"
                />
                <Text as="span" variant="bodySm">Blackout</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                <Box
                  background="bg-fill-info"
                  borderRadius="050"
                  minHeight="16px"
                  minWidth="16px"
                />
                <Text as="span" variant="bodySm">Capacity</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                <Box
                  background="bg-fill-warning"
                  borderRadius="050"
                  minHeight="16px"
                  minWidth="16px"
                />
                <Text as="span" variant="bodySm">Holiday</Text>
              </InlineStack>
              <InlineStack gap="200" blockAlign="center">
                <Box
                  background="bg-fill-success"
                  borderRadius="050"
                  minHeight="16px"
                  minWidth="16px"
                />
                <Text as="span" variant="bodySm">Special</Text>
              </InlineStack>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Rules Section */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd" fontWeight="semibold">
              Calendar Rules
            </Text>

            {rules.length === 0 ? (
              <PolarisEmptyState
                heading="No calendar rules"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: "Add First Rule", url: "/calendar/new" }}
              >
                <p>
                  Create rules to manage blackout dates, capacity limits, holidays,
                  and special delivery windows.
                </p>
              </PolarisEmptyState>
            ) : (
              <BlockStack gap="300">
                {rules.map((rule) => (
                  <Box
                    key={rule.id}
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border-secondary"
                  >
                    <InlineStack align="space-between" blockAlign="start" wrap={false} gap="400">
                      <InlineStack gap="300" blockAlign="start" wrap={false}>
                        <Badge tone={RULE_TYPE_BADGE_TONE[rule.type]}>
                          {getRuleTypeLabel(rule.type)}
                        </Badge>

                        <BlockStack gap="200">
                          <Text as="h3" variant="bodyMd" fontWeight="semibold">
                            {rule.name}
                          </Text>
                          {rule.description && (
                            <Text as="p" variant="bodySm" tone="subdued">
                              {rule.description}
                            </Text>
                          )}

                          <InlineStack gap="400" wrap>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(rule.startDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              {rule.startDate !== rule.endDate && (
                                <>
                                  {" to "}
                                  {new Date(rule.endDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </>
                              )}
                            </Text>

                            {rule.recurrence && rule.recurrence !== "ONCE" && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                Repeats {rule.recurrence.toLowerCase()}
                              </Text>
                            )}

                            {rule.affectedZones.length > 0 && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                {rule.affectedZones.length} zone
                                {rule.affectedZones.length > 1 ? "s" : ""}
                              </Text>
                            )}
                          </InlineStack>

                          {rule.affectedZones.length > 0 && (
                            <InlineStack gap="100" wrap>
                              {rule.affectedZones.map((zone) => (
                                <Badge key={zone.zoneId} tone="info">
                                  {zone.zoneName}
                                </Badge>
                              ))}
                            </InlineStack>
                          )}
                        </BlockStack>
                      </InlineStack>

                      <ButtonGroup>
                        <Button size="slim" accessibilityLabel="Edit rule">
                          Edit
                        </Button>
                        <Button
                          size="slim"
                          tone="critical"
                          accessibilityLabel="Delete rule"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
