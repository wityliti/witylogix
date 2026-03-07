/**
 * Zones List — Delivery zones management.
 *
 * Features:
 *   - Table view: Name, Base Rate, Per Km Rate, Min Order, Free Above, Priority, Order Count
 *   - Create Zone modal with form
 *   - Pagination
 *   - Row click → zone detail
 *
 * Zone management for delivery service coverage and pricing.
 */
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
// ─── Loader ────────────────────────────────────────────────
export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const response = await api.get("/api/v4/zones", {
        page,
        limit,
    });
    return { zones: response.data, meta: response.meta };
}
// ─── Action ────────────────────────────────────────────────
export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const formData = await request.formData();
    const intent = formData.get("intent");
    if (intent === "create") {
        const zone = {
            name: formData.get("name"),
            baseRate: Number(formData.get("baseRate") ?? 0),
            perKmRate: Number(formData.get("perKmRate") ?? 0),
            minOrder: Number(formData.get("minOrder") ?? 0),
            freeAbove: formData.get("freeAbove")
                ? Number(formData.get("freeAbove"))
                : null,
            priority: Number(formData.get("priority") ?? 1),
        };
        const result = await api.post("/api/v4/zones", zone);
        return redirect(`/zones/${result.data.id}`);
    }
    return null;
}
// ─── Component ─────────────────────────────────────────────
export default function ZonesList() {
    const { zones, meta } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const currentPage = meta.page;
    function goToPage(page) {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(page));
        setSearchParams(next);
    }
    return (<div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Delivery Zones</h1>
          <p style={subtextStyle}>{meta.total} total zones</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={primaryBtnStyle} type="button">
          Create Zone
        </button>
      </div>

      {/* Content */}
      {zones.length === 0 ? (<EmptyState title="No delivery zones found" description="Create a delivery zone to define service areas and pricing." actionLabel="Create Zone" onAction={() => setShowCreateModal(true)}/>) : (<>
          <div style={tableContainerStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Zone Name</th>
                  <th style={thStyle}>Base Rate</th>
                  <th style={thStyle}>Per Km Rate</th>
                  <th style={thStyle}>Min Order</th>
                  <th style={thStyle}>Free Above</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Order Count</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (<tr key={zone.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link to={`/zones/${zone.id}`} style={linkStyle}>
                        {zone.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {formatCurrency(zone.baseRate)}
                    </td>
                    <td style={tdStyle}>
                      {formatCurrency(zone.perKmRate)} / km
                    </td>
                    <td style={tdStyle}>
                      {formatCurrency(zone.minOrder)}
                    </td>
                    <td style={tdStyle}>
                      {zone.freeAbove ? formatCurrency(zone.freeAbove) : <span style={cellSubStyle}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {zone.priority}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {zone.orderCount}
                    </td>
                    <td style={tdStyle}>
                      <ZoneStatusBadge isActive={zone.isActive}/>
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

      {/* Create Zone Modal */}
      {showCreateModal && (<ZoneCreateModal onClose={() => setShowCreateModal(false)}/>)}
    </div>);
}
// ─── Sub-components ────────────────────────────────────────
function ZoneStatusBadge({ isActive }) {
    const colors = isActive
        ? { bg: "#ccf1e2", text: "#005c35" }
        : { bg: "#f1f2f3", text: "#6d7175" };
    return (<span style={{
            display: "inline-block",
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 20,
            backgroundColor: colors.bg,
            color: colors.text,
        }}>
      {isActive ? "Active" : "Inactive"}
    </span>);
}
function ZoneCreateModal({ onClose }) {
    return (<div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Create New Zone</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">&times;</button>
        </div>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value="create"/>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Zone Name *</label>
            <input name="name" required style={formInputStyle} placeholder="e.g., Downtown Zone"/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Base Rate *</label>
              <input name="baseRate" type="number" step="0.01" required style={formInputStyle} placeholder="0.00"/>
            </div>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Per Km Rate *</label>
              <input name="perKmRate" type="number" step="0.01" required style={formInputStyle} placeholder="0.00"/>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Min Order *</label>
              <input name="minOrder" type="number" step="0.01" required style={formInputStyle} placeholder="0.00"/>
            </div>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Free Above</label>
              <input name="freeAbove" type="number" step="0.01" style={formInputStyle} placeholder="Leave blank for no free threshold"/>
            </div>
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Priority (higher = more priority)</label>
            <input name="priority" type="number" defaultValue={1} min={1} style={formInputStyle}/>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Create Zone</button>
          </div>
        </Form>
      </div>
    </div>);
}
// ─── Helpers ───────────────────────────────────────────────
function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}
// ─── Styles ────────────────────────────────────────────────
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 16px" };
const headingStyle = { fontSize: 20, fontWeight: 600, margin: 0 };
const subtextStyle = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)", margin: "4px 0 0" };
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
//# sourceMappingURL=zones._index.js.map