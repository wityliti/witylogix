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
import { useLoaderData, Link } from "react-router";
import { KPICard } from "~/components/KPICard";
import { StatusTimeline } from "~/components/StatusTimeline";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
// ─── Loader ────────────────────────────────────────────────
export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    // Fetch dashboard stats and recent activity in parallel
    const [statsResponse, activityResponse] = await Promise.allSettled([
        api.get("/api/v4/shops/me/stats"),
        api.get("/api/v4/shops/me/activity", {
            limit: 20,
        }),
    ]);
    // Provide fallback data if API calls fail (graceful degradation)
    const stats = statsResponse.status === "fulfilled"
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
    const recentActivity = activityResponse.status === "fulfilled"
        ? activityResponse.value.data
        : [];
    return { stats, recentActivity };
}
// ─── Component ─────────────────────────────────────────────
export default function Dashboard() {
    const { stats, recentActivity } = useLoaderData();
    return (<div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px 0 16px",
        }}>
        <div>
          <h1 style={headingStyle}>Dashboard</h1>
          <p style={subtextStyle}>
            Overview of today&apos;s delivery operations
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={kpiGridStyle}>
        <KPICard title="Orders Today" value={stats.ordersToday} delta={stats.ordersDelta} deltaPeriod="vs yesterday"/>
        <KPICard title="Active Deliveries" value={stats.activeDeliveries} description="Currently in progress"/>
        <KPICard title="Drivers Online" value={`${stats.driversOnline} / ${stats.driversTotal}`} description="Available now"/>
        <KPICard title="Success Rate" value={`${stats.successRate}%`} delta={stats.successRateDelta} deltaUnit="%" deltaPeriod="vs last 7 days"/>
      </div>

      {/* Quick Actions */}
      <div style={quickActionsStyle}>
        <Link to="/orders?status=PENDING" style={actionButtonSecondary}>
          {stats.unassignedCount > 0 && (<span style={badgeStyle}>{stats.unassignedCount}</span>)}
          View Unassigned
        </Link>
        <Link to="/routes/new" style={actionButtonPrimary}>
          Build Route
        </Link>
      </div>

      {/* Recent Activity */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Recent Activity</h2>
          <span style={subtextStyle}>Real-time updates</span>
        </div>
        <div style={cardStyle}>
          <StatusTimeline events={recentActivity}/>
        </div>
      </div>
    </div>);
}
// ─── Styles ────────────────────────────────────────────────
const headingStyle = {
    fontSize: 20,
    fontWeight: 600,
    color: "var(--p-color-text, #202223)",
    margin: 0,
};
const subtextStyle = {
    fontSize: 13,
    color: "var(--p-color-text-subdued, #6d7175)",
    margin: "4px 0 0",
};
const kpiGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 24,
};
const quickActionsStyle = {
    display: "flex",
    gap: 12,
    marginBottom: 32,
};
const actionButtonPrimary = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: "white",
    backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
};
const actionButtonSecondary = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--p-color-text, #303030)",
    backgroundColor: "var(--p-color-bg-surface, white)",
    border: "1px solid var(--p-color-border, #c9cccf)",
    borderRadius: 8,
    cursor: "pointer",
    textDecoration: "none",
};
const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    fontSize: 11,
    fontWeight: 600,
    color: "white",
    backgroundColor: "var(--p-color-bg-fill-critical, #d72c0d)",
    borderRadius: 10,
};
const sectionStyle = {
    marginBottom: 32,
};
const sectionHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
};
const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--p-color-text, #202223)",
    margin: 0,
};
const cardStyle = {
    padding: 16,
    backgroundColor: "var(--p-color-bg-surface, white)",
    borderRadius: 12,
    border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
    boxShadow: "var(--p-shadow-sm, 0 1px 0 rgba(0,0,0,.05))",
};
//# sourceMappingURL=_index.js.map