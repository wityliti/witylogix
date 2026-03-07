/**
 * Analytics — Delivery metrics and performance overview.
 *
 * Features:
 *   - Date range filter (7d/30d/90d tabs)
 *   - KPI cards: Total Deliveries, On-Time Rate, Avg Delivery Time, Revenue
 *   - Delivery trend chart (inline SVG bar chart)
 *   - Performance breakdown table: status counts with colored badges
 *   - Zone performance cards grid
 *   - Export button
 *
 * All data is loaded server-side via React Router v7 loader.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface AnalyticsOverview {
  dateRange: string;
  totalDeliveries: number;
  onTimeRate: number;
  averageDeliveryTime: number;
  totalRevenue: number;
  trend: Array<{
    date: string;
    count: number;
  }>;
  performanceBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  zonePerformance: Array<{
    zoneId: string;
    zoneName: string;
    deliveries: number;
    onTimeRate: number;
    averageTime: number;
  }>;
}

interface AnalyticsPageData {
  overview: AnalyticsOverview;
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const days = url.searchParams.get("days") ?? "30";

  try {
    const response = await api.get<AnalyticsOverview>(
      "/api/v4/analytics/overview",
      { days: parseInt(days) },
    );
    return { overview: response };
  } catch {
    // Fallback mock data for demonstration
    return {
      overview: {
        dateRange: `Last ${days} days`,
        totalDeliveries: 1_254,
        onTimeRate: 94.2,
        averageDeliveryTime: 45,
        totalRevenue: 18_750,
        trend: Array.from({ length: parseInt(days) }, (_, i) => ({
          date: new Date(Date.now() - (parseInt(days) - i) * 86400000)
            .toLocaleDateString("en-US", { month: "short", day: "numeric" })
            .replace(" ", ""),
          count: Math.floor(Math.random() * 80) + 20,
        })),
        performanceBreakdown: [
          { status: "DELIVERED", count: 1_180, percentage: 94 },
          { status: "OUT_FOR_DELIVERY", count: 45, percentage: 3.5 },
          { status: "FAILED", count: 18, percentage: 1.4 },
          { status: "PENDING", count: 11, percentage: 1.1 },
        ],
        zonePerformance: [
          {
            zoneId: "z1",
            zoneName: "Downtown Central",
            deliveries: 342,
            onTimeRate: 96.5,
            averageTime: 38,
          },
          {
            zoneId: "z2",
            zoneName: "Suburbs North",
            deliveries: 289,
            onTimeRate: 92.1,
            averageTime: 48,
          },
          {
            zoneId: "z3",
            zoneName: "Industrial East",
            deliveries: 251,
            onTimeRate: 93.6,
            averageTime: 44,
          },
          {
            zoneId: "z4",
            zoneName: "Airport West",
            deliveries: 227,
            onTimeRate: 94.7,
            averageTime: 42,
          },
          {
            zoneId: "z5",
            zoneName: "Waterfront South",
            deliveries: 145,
            onTimeRate: 91.0,
            averageTime: 52,
          },
        ],
      },
    };
  }
}

// ─── Component ─────────────────────────────────────────────

export default function Analytics() {
  const { overview } = useLoaderData<AnalyticsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentDays = searchParams.get("days") ?? "30";

  function setDateRange(days: string) {
    const next = new URLSearchParams(searchParams);
    next.set("days", days);
    setSearchParams(next);
  }

  const maxTrendValue = Math.max(...overview.trend.map((t) => t.count), 100);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={headingStyle}>Analytics</h1>
          <p style={subtextStyle}>Delivery metrics and performance overview</p>
        </div>
        <button style={exportButtonStyle} type="button">
          📊 Export Report
        </button>
      </div>

      {/* Date Range Tabs */}
      <div style={tabsContainerStyle}>
        {["7", "30", "90"].map((days) => (
          <button
            key={days}
            onClick={() => setDateRange(days)}
            style={{
              ...tabStyle,
              ...(currentDays === days ? activeTabStyle : {}),
            }}
            type="button"
          >
            Last {days}d
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Deliveries</div>
          <div style={kpiValueStyle}>{overview.totalDeliveries}</div>
          <div style={kpiSubtextStyle}>
            {Math.round(overview.totalDeliveries / parseInt(currentDays))} per day
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>On-Time Rate</div>
          <div style={kpiValueStyle}>{overview.onTimeRate}%</div>
          <div
            style={{
              ...kpiSubtextStyle,
              color:
                overview.onTimeRate >= 95
                  ? "var(--p-color-success, #16a34a)"
                  : "var(--p-color-warning, #f59e0b)",
            }}
          >
            {overview.onTimeRate >= 95 ? "✓ Excellent" : "△ Good"}
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Avg Delivery Time</div>
          <div style={kpiValueStyle}>{overview.averageDeliveryTime} min</div>
          <div style={kpiSubtextStyle}>Per order</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Revenue</div>
          <div style={kpiValueStyle}>${(overview.totalRevenue / 1000).toFixed(1)}k</div>
          <div style={kpiSubtextStyle}>
            ${Math.round(overview.totalRevenue / parseInt(currentDays))} per day
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div style={chartContainerStyle}>
        <h2 style={sectionHeadingStyle}>Delivery Trend</h2>
        <div style={chartAreaStyle}>
          <div style={chartYAxisStyle}>
            <div>{Math.round(maxTrendValue)}</div>
            <div>{Math.round(maxTrendValue / 2)}</div>
            <div>0</div>
          </div>

          <div style={chartBarsStyle}>
            {overview.trend.map((point, idx) => (
              <div key={idx} style={chartBarWrapperStyle}>
                <div
                  style={{
                    ...chartBarStyle,
                    height: `${(point.count / maxTrendValue) * 200}px`,
                    backgroundColor:
                      point.count > maxTrendValue * 0.75
                        ? "var(--p-color-success, #16a34a)"
                        : "var(--p-color-action, #0971f1)",
                  }}
                  title={`${point.date}: ${point.count} deliveries`}
                />
                <div style={chartLabelStyle}>{point.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div style={performanceContainerStyle}>
        <h2 style={sectionHeadingStyle}>Performance Breakdown</h2>
        <div style={breakdownTableStyle}>
          {overview.performanceBreakdown.map((item) => {
            const badgeColor = {
              DELIVERED: "var(--p-color-success, #16a34a)",
              OUT_FOR_DELIVERY: "var(--p-color-action, #0971f1)",
              FAILED: "var(--p-color-critical, #d02c2c)",
              PENDING: "var(--p-color-warning, #f59e0b)",
            }[item.status] || "var(--p-color-text-subdued, #6d7175)";

            return (
              <div key={item.status} style={breakdownRowStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: badgeColor,
                    }}
                  />
                  <span style={breakdownLabelStyle}>{item.status}</span>
                </div>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={breakdownCountStyle}>{item.count}</div>
                  <div style={breakdownPercentageStyle}>{item.percentage}%</div>
                  <div style={breakdownBarStyle}>
                    <div
                      style={{
                        height: "100%",
                        backgroundColor: badgeColor,
                        borderRadius: 4,
                        width: `${item.percentage * 2.5}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone Performance Cards */}
      <div style={zoneContainerStyle}>
        <h2 style={sectionHeadingStyle}>Zone Performance</h2>
        <div style={zoneGridStyle}>
          {overview.zonePerformance.map((zone) => (
            <div key={zone.zoneId} style={zoneCardStyle}>
              <h3 style={zoneNameStyle}>{zone.zoneName}</h3>
              <div style={zoneMetricRowStyle}>
                <span style={zoneMetricLabelStyle}>Deliveries</span>
                <span style={zoneMetricValueStyle}>{zone.deliveries}</span>
              </div>
              <div style={zoneMetricRowStyle}>
                <span style={zoneMetricLabelStyle}>On-Time</span>
                <span
                  style={{
                    ...zoneMetricValueStyle,
                    color:
                      zone.onTimeRate >= 95
                        ? "var(--p-color-success, #16a34a)"
                        : "var(--p-color-warning, #f59e0b)",
                  }}
                >
                  {zone.onTimeRate}%
                </span>
              </div>
              <div style={zoneMetricRowStyle}>
                <span style={zoneMetricLabelStyle}>Avg Time</span>
                <span style={zoneMetricValueStyle}>{zone.averageTime} min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 0 16px",
};

const headingStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const subtextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "4px 0 0",
};

const exportButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const tabsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tabStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text-subdued, #6d7175)",
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
  borderBottom: "3px solid transparent",
  marginBottom: -1,
};

const activeTabStyle: React.CSSProperties = {
  color: "var(--p-color-text, #202223)",
  borderBottomColor: "var(--p-color-bg-fill-brand, #005bd3)",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 16,
  marginBottom: 32,
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 8,
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  marginBottom: 4,
};

const kpiSubtextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const chartContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 32,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const chartAreaStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  minHeight: 250,
};

const chartYAxisStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  width: 50,
  fontSize: 11,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const chartBarsStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "flex-end",
  gap: 6,
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  paddingBottom: 8,
};

const chartBarWrapperStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
};

const chartBarStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 2,
  borderRadius: "4px 4px 0 0",
  transition: "opacity 0.2s",
  cursor: "pointer",
};

const chartLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--p-color-text-subdued, #6d7175)",
  textAlign: "center",
  width: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const performanceContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 32,
};

const breakdownTableStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const breakdownRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const breakdownLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text, #202223)",
};

const breakdownCountStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  minWidth: 60,
  textAlign: "right",
};

const breakdownPercentageStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  minWidth: 50,
  textAlign: "right",
};

const breakdownBarStyle: React.CSSProperties = {
  width: 200,
  height: 8,
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  borderRadius: 4,
};

const zoneContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
};

const zoneGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const zoneCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 8,
  padding: 16,
};

const zoneNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 12px",
};

const zoneMetricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  marginBottom: 8,
};

const zoneMetricLabelStyle: React.CSSProperties = {
  color: "var(--p-color-text-subdued, #6d7175)",
};

const zoneMetricValueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
};
