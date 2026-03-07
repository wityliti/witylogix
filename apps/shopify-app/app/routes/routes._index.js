/**
 * Routes List — Delivery routes management.
 *
 * Features:
 *   - Table view: Name, Driver, Stops count, Status, Distance, Duration, Date
 *   - Status filter: DRAFT | OPTIMIZING | READY | IN_PROGRESS | COMPLETED
 *   - Date filter
 *   - Create Route button
 *   - Optimize selected routes action
 *   - Pagination
 *
 * Status colors and route management for delivery logistics.
 */
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
const ROUTE_STATUSES = ["DRAFT", "OPTIMIZING", "READY", "IN_PROGRESS", "COMPLETED"];
const STATUS_COLORS = {
    DRAFT: { bg: "#f1f2f3", text: "#6d7175" },
    OPTIMIZING: { bg: "#fff4e6", text: "#7d2e0f" },
    READY: { bg: "#ccf1e2", text: "#005c35" },
    IN_PROGRESS: { bg: "#e8f0fe", text: "#1a3a6e" },
    COMPLETED: { bg: "#e8f5e9", text: "#2e7d32" },
};
// ─── Loader ────────────────────────────────────────────────
export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const status = url.searchParams.get("status") ?? undefined;
    const date = url.searchParams.get("date") ?? undefined;
    const response = await api.get("/api/v4/routes", {
        page,
        limit,
        status,
        date,
    });
    return { routes: response.data, meta: response.meta };
}
// ─── Action ────────────────────────────────────────────────
export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const formData = await request.formData();
    const intent = formData.get("intent");
    if (intent === "create") {
        const route = {
            name: formData.get("name"),
            date: formData.get("date"),
            driverId: formData.get("driverId") || undefined,
        };
        const result = await api.post("/api/v4/routes", route);
        return redirect(`/routes/${result.data.id}`);
    }
    if (intent === "optimize") {
        const routeIds = formData.getAll("routeIds");
        await api.post("/api/v4/routes/optimize", { routeIds });
        return null;
    }
    return null;
}
// ─── Component ─────────────────────────────────────────────
export default function RoutesList() {
    const { routes, meta } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedRoutes, setSelectedRoutes] = useState(new Set());
    const currentStatus = searchParams.get("status") ?? "";
    const currentDate = searchParams.get("date") ?? "";
    const currentPage = meta.page;
    function updateFilter(key, value) {
        const next = new URLSearchParams(searchParams);
        if (value) {
            next.set(key, value);
        }
        else {
            next.delete(key);
        }
        next.set("page", "1");
        setSearchParams(next);
    }
    function goToPage(page) {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(page));
        setSearchParams(next);
    }
    function toggleRoute(routeId) {
        const next = new Set(selectedRoutes);
        if (next.has(routeId)) {
            next.delete(routeId);
        }
        else {
            next.add(routeId);
        }
        setSelectedRoutes(next);
    }
    function toggleAll() {
        if (selectedRoutes.size === routes.length) {
            setSelectedRoutes(new Set());
        }
        else {
            setSelectedRoutes(new Set(routes.map((r) => r.id)));
        }
    }
    return (<div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Routes</h1>
          <p style={subtextStyle}>{meta.total} total routes</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={primaryBtnStyle} type="button">
          Create Route
        </button>
      </div>

      {/* Filters */}
      <div style={filtersStyle}>
        <select value={currentStatus} onChange={(e) => updateFilter("status", e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {ROUTE_STATUSES.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
        </select>
        <input type="date" value={currentDate} onChange={(e) => updateFilter("date", e.target.value)} style={selectStyle}/>
      </div>

      {/* Bulk Actions */}
      {selectedRoutes.size > 0 && (<div style={bulkActionsStyle}>
          <span style={subtextStyle}>{selectedRoutes.size} selected</span>
          <Form method="post" style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="intent" value="optimize"/>
            {Array.from(selectedRoutes).map((id) => (<input key={id} type="hidden" name="routeIds" value={id}/>))}
            <button type="submit" style={primaryBtnStyle}>
              Optimize Selected
            </button>
          </Form>
        </div>)}

      {/* Content */}
      {routes.length === 0 ? (<EmptyState title="No routes found" description={currentStatus || currentDate
                ? "Try adjusting your filters."
                : "Create a delivery route to get started."} actionLabel="Create Route" onAction={() => setShowCreateModal(true)}/>) : (<>
          <div style={tableContainerStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>
                    <input type="checkbox" checked={selectedRoutes.size === routes.length && routes.length > 0} onChange={toggleAll}/>
                  </th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Stops</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Distance</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (<tr key={route.id} style={trStyle}>
                    <td style={{ ...tdStyle, width: 40 }}>
                      <input type="checkbox" checked={selectedRoutes.has(route.id)} onChange={() => toggleRoute(route.id)}/>
                    </td>
                    <td style={tdStyle}>
                      <Link to={`/routes/${route.id}`} style={linkStyle}>
                        {route.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {route.driverName ? (<Link to={`/drivers/${route.driverId}`} style={linkStyle}>
                          {route.driverName}
                        </Link>) : (<span style={cellSubStyle}>Unassigned</span>)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {route.stopsCount}
                    </td>
                    <td style={tdStyle}>
                      <RouteStatusBadge status={route.status}/>
                    </td>
                    <td style={tdStyle}>
                      {(route.distance / 1000).toFixed(2)} km
                    </td>
                    <td style={tdStyle}>
                      {formatDuration(route.duration)}
                    </td>
                    <td style={tdStyle}>
                      {formatDate(route.date)}
                    </td>
                  </tr>))}
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
        </>)}

      {/* Create Route Modal */}
      {showCreateModal && (<RouteCreateModal onClose={() => setShowCreateModal(false)}/>)}
    </div>);
}
// ─── Sub-components ────────────────────────────────────────
function RouteStatusBadge({ status }) {
    const colors = STATUS_COLORS[status] ?? { bg: "#f1f2f3", text: "#6d7175" };
    return (<span style={{
            display: "inline-block",
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 20,
            backgroundColor: colors.bg,
            color: colors.text,
        }}>
      {status.replace(/_/g, " ")}
    </span>);
}
function RouteCreateModal({ onClose }) {
    return (<div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Create New Route</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">&times;</button>
        </div>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value="create"/>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Route Name *</label>
            <input name="name" required style={formInputStyle} placeholder="e.g., Downtown Morning Run"/>
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Date *</label>
            <input name="date" type="date" required style={formInputStyle}/>
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Driver (Optional)</label>
            <select name="driverId" style={formInputStyle}>
              <option value="">Select a driver</option>
              {/* Options would be populated from API */}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Create Route</button>
          </div>
        </Form>
      </div>
    </div>);
}
// ─── Helpers ───────────────────────────────────────────────
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
    catch {
        return iso;
    }
}
// ─── Styles ────────────────────────────────────────────────
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 16px" };
const headingStyle = { fontSize: 20, fontWeight: 600, margin: 0 };
const subtextStyle = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)", margin: "4px 0 0" };
const filtersStyle = { display: "flex", gap: 12, marginBottom: 16 };
const selectStyle = { padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, backgroundColor: "white", cursor: "pointer" };
const bulkActionsStyle = { display: "flex", gap: 16, alignItems: "center", padding: 12, marginBottom: 16, backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)", borderRadius: 8, border: "1px solid var(--p-color-border-subdued, #e1e3e5)" };
const tableContainerStyle = { backgroundColor: "white", borderRadius: 12, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", overflow: "hidden" };
const thStyle = { textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)", backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)" };
const trStyle = { borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" };
const tdStyle = { padding: "12px 16px", verticalAlign: "top" };
const linkStyle = { color: "var(--p-color-text-primary, #005bd3)", fontWeight: 600, textDecoration: "none" };
const cellSubStyle = { fontSize: 12, color: "var(--p-color-text-subdued, #6d7175)" };
const paginationStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" };
const pageBtnStyle = { padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 6, backgroundColor: "white", cursor: "pointer" };
const primaryBtnStyle = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "white", backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)", border: "none", borderRadius: 8, cursor: "pointer" };
const secondaryBtnStyle = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "var(--p-color-text, #303030)", backgroundColor: "white", border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, cursor: "pointer" };
const overlayStyle = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle = { width: 500, maxHeight: "90vh", overflow: "auto", backgroundColor: "white", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const closeBtnStyle = { fontSize: 24, lineHeight: 1, color: "var(--p-color-text-subdued, #6d7175)", background: "none", border: "none", cursor: "pointer" };
const formFieldStyle = { marginBottom: 12 };
const formLabelStyle = { display: "block", fontSize: 13, fontWeight: 500, color: "var(--p-color-text, #202223)", marginBottom: 4 };
const formInputStyle = { width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, boxSizing: "border-box" };
//# sourceMappingURL=routes._index.js.map