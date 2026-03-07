/**
 * Drivers List — Resource list with table/map toggle view.
 *
 * Features:
 *   - Table view: name, phone, vehicle, status, active orders, last seen
 *   - Map view: driver markers on Mapbox map (client-side rendered)
 *   - Status filter: ALL | AVAILABLE | ON_DELIVERY | OFFLINE
 *   - Search by name or phone
 *   - Add Driver button → modal or /drivers/new
 *   - Row click → driver detail
 *
 * The map view uses a client-only component to avoid SSR issues with Mapbox GL.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  vehicleType: string;
  vehiclePlate: string | null;
  maxCapacity: number;
  status: string;
  isActive: boolean;
  activeOrderCount?: number;
  lastSeenAt?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
}

interface DriversPageData {
  drivers: Driver[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const DRIVER_STATUSES = ["AVAILABLE", "ON_DELIVERY", "OFFLINE"];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  AVAILABLE: { bg: "#ccf1e2", text: "#005c35" },
  ON_DELIVERY: { bg: "#e8f0fe", text: "#1a3a6e" },
  OFFLINE: { bg: "#f1f2f3", text: "#6d7175" },
};

const VEHICLE_ICONS: Record<string, string> = {
  BICYCLE: "🚲",
  MOTORCYCLE: "🏍️",
  CAR: "🚗",
  VAN: "🚐",
  TRUCK: "🚛",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const response = await api.get<PaginatedResponse<Driver>>("/api/v4/drivers", {
    page,
    limit,
    status,
    search,
  });

  return { drivers: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const driver = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || undefined,
      vehicleType: formData.get("vehicleType") as string,
      vehiclePlate: (formData.get("vehiclePlate") as string) || undefined,
      maxCapacity: Number(formData.get("maxCapacity") ?? 20),
    };
    const result = await api.post<{ data: { id: string } }>("/api/v4/drivers", driver);
    return redirect(`/drivers/${result.data.id}`);
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function DriversList() {
  const { drivers, meta } = useLoaderData<DriversPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentPage = meta.page;

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1");
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Drivers</h1>
          <p style={subtextStyle}>{meta.total} total drivers</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* View Toggle */}
          <div style={toggleGroupStyle}>
            <button
              onClick={() => setViewMode("table")}
              style={viewMode === "table" ? toggleActiveStyle : toggleInactiveStyle}
              type="button"
            >
              Table
            </button>
            <button
              onClick={() => setViewMode("map")}
              style={viewMode === "map" ? toggleActiveStyle : toggleInactiveStyle}
              type="button"
            >
              Map
            </button>
          </div>
          <button onClick={() => setShowCreateModal(true)} style={primaryBtnStyle} type="button">
            Add Driver
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={filtersStyle}>
        <input
          type="text"
          placeholder="Search drivers..."
          value={currentSearch}
          onChange={(e) => updateFilter("search", e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          style={selectStyle}
        >
          <option value="">All statuses</option>
          {DRIVER_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {drivers.length === 0 ? (
        <EmptyState
          title="No drivers found"
          description={
            currentSearch || currentStatus
              ? "Try adjusting your filters."
              : "Add drivers so you can assign them to deliveries."
          }
          actionLabel="Add Driver"
          onAction={() => setShowCreateModal(true)}
        />
      ) : viewMode === "table" ? (
        <>
          <div style={tableContainerStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Vehicle</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Active Orders</th>
                  <th style={thStyle}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link to={`/drivers/${driver.id}`} style={linkStyle}>
                        {driver.name}
                      </Link>
                      {driver.email && <div style={cellSubStyle}>{driver.email}</div>}
                    </td>
                    <td style={tdStyle}>{driver.phone}</td>
                    <td style={tdStyle}>
                      <span style={{ marginRight: 4 }}>
                        {VEHICLE_ICONS[driver.vehicleType] ?? "🚗"}
                      </span>
                      {driver.vehicleType.toLowerCase()}
                      {driver.vehiclePlate && (
                        <div style={cellSubStyle}>{driver.vehiclePlate}</div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <DriverStatusBadge status={driver.status} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {driver.activeOrderCount ?? 0}
                    </td>
                    <td style={tdStyle}>
                      {driver.lastSeenAt
                        ? formatRelative(driver.lastSeenAt)
                        : <span style={cellSubStyle}>Never</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={paginationStyle}>
            <span style={subtextStyle}>
              Page {currentPage} of {meta.totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} style={pageBtnStyle} type="button">
                Previous
              </button>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= meta.totalPages} style={pageBtnStyle} type="button">
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Map View Placeholder */
        <div style={mapPlaceholderStyle}>
          <div style={{ textAlign: "center", color: "var(--p-color-text-subdued, #6d7175)" }}>
            <p style={{ fontSize: 14, margin: "0 0 8px" }}>
              Map view shows live driver locations.
            </p>
            <p style={{ fontSize: 13 }}>
              {drivers.filter((d) => d.lastLatitude && d.lastLongitude).length} of{" "}
              {drivers.length} drivers have GPS data.
            </p>
            {/* MapboxGL will render here client-side */}
            <div id="drivers-map" style={{ width: "100%", height: 500, borderRadius: 8, marginTop: 16, backgroundColor: "#e8eaed" }} />
          </div>
        </div>
      )}

      {/* Create Driver Modal */}
      {showCreateModal && (
        <DriverCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function DriverStatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#f1f2f3", text: "#6d7175" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 20,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DriverCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Add New Driver</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">&times;</button>
        </div>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value="create" />

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Name *</label>
            <input name="name" required style={formInputStyle} placeholder="Full name" />
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Phone *</label>
            <input name="phone" required style={formInputStyle} placeholder="+1 (555) 000-0000" />
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Email</label>
            <input name="email" type="email" style={formInputStyle} placeholder="driver@example.com" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Vehicle Type</label>
              <select name="vehicleType" style={formInputStyle} defaultValue="CAR">
                <option value="BICYCLE">Bicycle</option>
                <option value="MOTORCYCLE">Motorcycle</option>
                <option value="CAR">Car</option>
                <option value="VAN">Van</option>
                <option value="TRUCK">Truck</option>
              </select>
            </div>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>License Plate</label>
              <input name="vehiclePlate" style={formInputStyle} placeholder="ABC 1234" />
            </div>
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Max Capacity (orders)</label>
            <input name="maxCapacity" type="number" defaultValue={20} min={1} style={formInputStyle} />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Add Driver</button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

// ─── Styles ────────────────────────────────────────────────

const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 16px" };
const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: 0 };
const subtextStyle: React.CSSProperties = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)", margin: "4px 0 0" };
const filtersStyle: React.CSSProperties = { display: "flex", gap: 12, marginBottom: 16 };
const searchInputStyle: React.CSSProperties = { flex: "1 1 200px", padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, backgroundColor: "white" };
const selectStyle: React.CSSProperties = { padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, backgroundColor: "white", cursor: "pointer" };

const toggleGroupStyle: React.CSSProperties = { display: "flex", border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, overflow: "hidden" };
const toggleActiveStyle: React.CSSProperties = { padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "none", backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)", color: "white", cursor: "pointer" };
const toggleInactiveStyle: React.CSSProperties = { padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "none", backgroundColor: "white", color: "var(--p-color-text, #303030)", cursor: "pointer" };

const tableContainerStyle: React.CSSProperties = { backgroundColor: "white", borderRadius: 12, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", overflow: "hidden" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)", backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)" };
const trStyle: React.CSSProperties = { borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", fontWeight: 600, textDecoration: "none" };
const cellSubStyle: React.CSSProperties = { fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)", marginTop: 2 };

const paginationStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" };
const pageBtnStyle: React.CSSProperties = { padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 6, backgroundColor: "white", cursor: "pointer" };

const primaryBtnStyle: React.CSSProperties = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "white", backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)", border: "none", borderRadius: 8, cursor: "pointer" };
const secondaryBtnStyle: React.CSSProperties = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "var(--p-color-text, #303030)", backgroundColor: "white", border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, cursor: "pointer" };

const mapPlaceholderStyle: React.CSSProperties = { padding: 40, backgroundColor: "white", borderRadius: 12, border: "1px solid var(--p-color-border-subdued, #e1e3e5)" };

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: 500, maxHeight: "90vh", overflow: "auto", backgroundColor: "white", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const closeBtnStyle: React.CSSProperties = { fontSize: 24, lineHeight: 1, color: "var(--p-color-text-subdued, #6d7175)", background: "none", border: "none", cursor: "pointer" };

const formFieldStyle: React.CSSProperties = { marginBottom: 12 };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "var(--p-color-text, #202223)", marginBottom: 4 };
const formInputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, boxSizing: "border-box" as const };
