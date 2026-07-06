/**
 * Dashboard (Home) — Landing page for the Shopify embedded admin app.
 *
 * Displays:
 *   - KPI summary cards (4-column grid): Orders Today, Active Deliveries,
 *     Drivers Online, Delivery Success Rate
 *   - Quick action buttons: Create Order, Build Route, View Unassigned
 *   - Real-time activity timeline (Socket.io powered)
 *
 * Data is loaded server-side via the loader. Activity timeline
 * updates are pushed client-side via WebSocket.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  ButtonGroup,
  InlineGrid,
  InlineStack,
  BlockStack,
  Box,
} from "@shopify/polaris";
import { KPICard } from "~/components/KPICard";
import { StatusTimeline } from "~/components/StatusTimeline";
import {
  createApiClientFromRequest,
  type SingleResponse,
} from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface DashboardStats {
  ordersToday: number;
  ordersDelta: number;
  activeDeliveries: number;
  driversOnline: number;
  driversTotal: number;
  successRate: number;
  successRateDelta: number;
  unassignedCount: number;
}

interface ActivityEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: ActivityEvent[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const api = createApiClientFromRequest(request, session);

  // Fetch dashboard stats and recent activity in parallel
  const [statsResponse, activityResponse] = await Promise.allSettled([
    api.get<SingleResponse<DashboardStats>>("/api/v4/shops/me/stats"),
    api.get<SingleResponse<ActivityEvent[]>>("/api/v4/shops/me/activity", {
      limit: 20,
    }),
  ]);

  // Provide fallback data if API calls fail (graceful degradation)
  const stats: DashboardStats =
    statsResponse.status === "fulfilled"
      ? statsResponse.value.data
      : {
          ordersToday: 0,
          ordersDelta: 0,
          activeDeliveries: 0,
          driversOnline: 0,
          driversTotal: 0,
          successRate: 0,
          successRateDelta: 0,
          unassignedCount: 0,
        };

  const recentActivity: ActivityEvent[] =
    activityResponse.status === "fulfilled" ? activityResponse.value.data : [];

  return { stats, recentActivity };
}

// ─── Component ─────────────────────────────────────────────

export default function Dashboard() {
  const { stats, recentActivity } = useLoaderData<DashboardData>();

  return (
    <Page title="Dashboard" subtitle="Overview of today's delivery operations">
      <Layout>
        {/* KPI Cards */}
        <Layout.Section>
          <InlineGrid columns={4} gap="400">
            <KPICard
              title="Orders Today"
              value={stats.ordersToday}
              delta={stats.ordersDelta}
              deltaPeriod="vs yesterday"
            />
            <KPICard
              title="Active Deliveries"
              value={stats.activeDeliveries}
              description="Currently in progress"
            />
            <KPICard
              title="Drivers Online"
              value={`${stats.driversOnline} / ${stats.driversTotal}`}
              description="Available now"
            />
            <KPICard
              title="Success Rate"
              value={`${stats.successRate}%`}
              delta={stats.successRateDelta}
              deltaUnit="%"
              deltaPeriod="vs last 7 days"
            />
          </InlineGrid>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section>
          <ButtonGroup>
            <Button url="/orders?status=PENDING">
              <InlineStack gap="200" align="center">
                {stats.unassignedCount > 0 && (
                  <Badge tone="critical">{String(stats.unassignedCount)}</Badge>
                )}
                <span>View Unassigned</span>
              </InlineStack>
            </Button>
            <Button variant="primary" url="/routes/new">
              Build Route
            </Button>
          </ButtonGroup>
        </Layout.Section>

        {/* Recent Activity */}
        <Layout.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="baseline">
              <Text as="h2" variant="headingMd">
                Recent Activity
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                Real-time updates
              </Text>
            </InlineStack>
            <Card>
              <StatusTimeline events={recentActivity} />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
