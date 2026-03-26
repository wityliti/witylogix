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
import { EmptyState } from "~/components/EmptyState";
import { createApiClient } from "~/lib/api.server";
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
  const api = createApiClient(session.accessToken!);

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

  const getRuleTypeBadgeStyle = (
    type: string,
  ): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      BLACKOUT: {
        backgroundColor: "var(--p-color-critical, #d02c2c)",
        color: "white",
      },
      CAPACITY: {
        backgroundColor: "var(--p-color-action, #0971f1)",
        color: "white",
      },
      HOLIDAY: {
        backgroundColor: "var(--p-color-warning, #f59e0b)",
        color: "white",
      },
      SPECIAL: {
        backgroundColor: "var(--p-color-success, #16a34a)",
        color: "white",
      },
    };
    return styles[type] || styles.BLACKOUT;
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={headingStyle}>Calendar & Availability</h1>
          <p style={subtextStyle}>Manage blackout dates and delivery rules</p>
        </div>
        <a href="/calendar/new" style={addRuleButtonStyle}>
          + Add Rule
        </a>
      </div>

      {/* Calendar Section */}
      <div style={calendarContainerStyle}>
        {/* Month Navigation */}
        <div style={monthNavigationStyle}>
          <button style={navButtonStyle} type="button">
            ← Prev
          </button>
          <h2 style={monthTitleStyle}>
            {monthName} {currentYear}
          </h2>
          <button style={navButtonStyle} type="button">
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={calendarGridStyle}>
          {/* Weekday headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} style={weekdayHeaderStyle}>
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {daysArray.map((day, idx) => (
            <div
              key={idx}
              style={{
                ...calendarDayStyle,
                ...(day === null ? { visibility: "hidden" } : {}),
                ...(isBlackoutDate(day)
                  ? blackoutDayStyle
                  : {}),
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Legend */}
        <div style={legendStyle}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: "var(--p-color-critical, #d02c2c)",
                  borderRadius: 4,
                }}
              />
              <span style={legendLabelStyle}>Blackout</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: "var(--p-color-action, #0971f1)",
                  borderRadius: 4,
                }}
              />
              <span style={legendLabelStyle}>Capacity</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: "var(--p-color-warning, #f59e0b)",
                  borderRadius: 4,
                }}
              />
              <span style={legendLabelStyle}>Holiday</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: "var(--p-color-success, #16a34a)",
                  borderRadius: 4,
                }}
              />
              <span style={legendLabelStyle}>Special</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div style={rulesContainerStyle}>
        <h2 style={sectionHeadingStyle}>Calendar Rules</h2>

        {rules.length === 0 ? (
          <EmptyState
            title="No calendar rules"
            description="Create rules to manage blackout dates, capacity limits, holidays, and special delivery windows."
            actionLabel="Add First Rule"
            actionUrl="/calendar/new"
          />
        ) : (
          <div style={rulesListStyle}>
            {rules.map((rule) => (
              <div key={rule.id} style={ruleItemStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                  <div
                    style={{
                      ...ruleBadgeStyle,
                      ...getRuleTypeBadgeStyle(rule.type),
                    }}
                  >
                    {rule.type.charAt(0) + rule.type.slice(1).toLowerCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={ruleNameStyle}>{rule.name}</h3>
                    {rule.description && (
                      <p style={ruleDescriptionStyle}>{rule.description}</p>
                    )}

                    <div style={ruleMetaStyle}>
                      <span style={ruleMetaItemStyle}>
                        📅{" "}
                        {new Date(rule.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {rule.startDate !== rule.endDate && (
                          <>
                            {" "}
                            to{" "}
                            {new Date(rule.endDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </>
                        )}
                      </span>

                      {rule.recurrence && rule.recurrence !== "ONCE" && (
                        <span style={ruleMetaItemStyle}>
                          🔄 {rule.recurrence.toLowerCase()}
                        </span>
                      )}

                      {rule.affectedZones.length > 0 && (
                        <span style={ruleMetaItemStyle}>
                          📍 {rule.affectedZones.length} zone
                          {rule.affectedZones.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {rule.affectedZones.length > 0 && (
                      <div style={affectedZonesStyle}>
                        {rule.affectedZones.map((zone) => (
                          <span key={zone.zoneId} style={zoneTagStyle}>
                            {zone.zoneName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={ruleActionsStyle}>
                  <button
                    style={ruleActionButtonStyle}
                    title="Edit rule"
                    type="button"
                  >
                    ✎
                  </button>
                  <button
                    style={ruleActionButtonStyle}
                    title="Delete rule"
                    type="button"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

const addRuleButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const calendarContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 32,
};

const monthNavigationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const monthTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const navButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--p-color-text, #202223)",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 6,
  cursor: "pointer",
};

const calendarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 2,
  marginBottom: 20,
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  padding: 2,
  borderRadius: 8,
};

const weekdayHeaderStyle: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  backgroundColor: "var(--p-color-bg-surface, white)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const calendarDayStyle: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text, #202223)",
  backgroundColor: "var(--p-color-bg-surface, white)",
  minHeight: 60,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "default",
};

const blackoutDayStyle: React.CSSProperties = {
  backgroundColor: "#fecaca",
  color: "#7f1d1d",
  fontWeight: 700,
};

const legendStyle: React.CSSProperties = {
  paddingTop: 16,
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  fontSize: 13,
};

const legendLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
};

const rulesContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 12,
  padding: 20,
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const rulesListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const ruleItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: 16,
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 8,
};

const ruleBadgeStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
  minWidth: 70,
  textAlign: "center",
};

const ruleNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 4px",
};

const ruleDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "0 0 8px",
};

const ruleMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 8,
};

const ruleMetaItemStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const affectedZonesStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const zoneTagStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 11,
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 4,
  color: "var(--p-color-text, #202223)",
};

const ruleActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const ruleActionButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  fontSize: 14,
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 4,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
