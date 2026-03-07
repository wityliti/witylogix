/**
 * Driver Detail — Full driver profile with tabs: Overview, Orders, History.
 *
 * Overview tab: Profile info, current location, vehicle, stats
 * Orders tab: Active and recent orders assigned to this driver
 * History tab: Delivery history with metrics (completion rate, avg time)
 *
 * Actions: Edit driver, deactivate, assign orders
 */
import { useLoaderData, Form, Link, useSearchParams, redirect } from "react-router";
import { useState } from "react";
import { OrderStatusBadge } from "~/components/OrderStatusBadge";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";
// ─── Loader ────────────────────────────────────────────────
export async function loader({ request, params }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") ?? "overview";
    const [driverRes, ordersRes] = await Promise.allSettled([
        api.get(`/api/v4/drivers/${params.id}`),
        api.get(`/api/v4/drivers/${params.id}/orders`, {
            limit: 20,
            ...(tab === "history" ? { status: "DELIVERED,FAILED,RETURNED" } : {}),
        }),
    ]);
    if (driverRes.status === "rejected") {
        throw new Response("Driver not found", { status: 404 });
    }
    return {
        driver: driverRes.value.data,
        orders: ordersRes.status === "fulfilled" ? ordersRes.value.data : [],
        tab,
    };
}
// ─── Action ────────────────────────────────────────────────
export async function action({ request, params }) {
    const { session } = await authenticate.admin(request);
    const api = createApiClient(session.accessToken);
    const formData = await request.formData();
    const intent = formData.get("intent");
    if (intent === "update") {
        const body = {};
        for (const [key, value] of formData.entries()) {
            if (key !== "intent" && value !== "")
                body[key] = value;
        }
        await api.patch(`/api/v4/drivers/${params.id}`, body);
    }
    if (intent === "deactivate") {
        await api.delete(`/api/v4/drivers/${params.id}`);
        return redirect("/drivers");
    }
    return redirect(`/drivers/${params.id}`);
}
// ─── Component ─────────────────────────────────────────────
export default function DriverDetailPage() {
    const { driver, orders, tab } = useLoaderData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [editing, setEditing] = useState(false);
    function switchTab(t) {
        const next = new URLSearchParams(searchParams);
        next.set("tab", t);
        setSearchParams(next);
    }
    const VEHICLE_ICONS = {
        BICYCLE: "🚲", MOTORCYCLE: "🏍️", CAR: "🚗", VAN: "🚐", TRUCK: "🚛",
    };
    return (<div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/drivers" style={backLinkStyle}>&larr;</Link>
          <div>
            <h1 style={headingStyle}>{driver.name}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <span style={{
            display: "inline-block", padding: "2px 10px", fontSize: 12, fontWeight: 600, borderRadius: 20,
            backgroundColor: driver.status === "AVAILABLE" ? "#ccf1e2" : driver.status === "ON_DELIVERY" ? "#e8f0fe" : "#f1f2f3",
            color: driver.status === "AVAILABLE" ? "#005c35" : driver.status === "ON_DELIVERY" ? "#1a3a6e" : "#6d7175",
        }}>
                {driver.status.replace(/_/g, " ")}
              </span>
              <span style={subtextStyle}>
                {VEHICLE_ICONS[driver.vehicleType] ?? "🚗"} {driver.vehicleType.toLowerCase()}
                {driver.vehiclePlate && ` · ${driver.vehiclePlate}`}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEditing(!editing)} style={secondaryBtnStyle} type="button">
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        {["overview", "orders", "history"].map((t) => (<button key={t} onClick={() => switchTab(t)} style={tab === t ? tabActiveStyle : tabStyle} type="button">
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (<div style={columnsStyle}>
          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Performance</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                <StatBlock label="Total Deliveries" value={String(driver.stats.totalDeliveries)}/>
                <StatBlock label="Today" value={String(driver.stats.completedToday)}/>
                <StatBlock label="Success Rate" value={`${driver.stats.successRate}%`}/>
                <StatBlock label="Avg Delivery" value={`${driver.stats.avgDeliveryTime}m`}/>
              </div>
              {driver.stats.rating != null && (<div style={{ marginTop: 12 }}>
                  <span style={labelStyle}>Rating</span>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
                    {"★".repeat(Math.round(driver.stats.rating))}
                    {"☆".repeat(5 - Math.round(driver.stats.rating))}
                    <span style={{ ...subtextStyle, marginLeft: 6 }}>
                      {driver.stats.rating.toFixed(1)}
                    </span>
                  </div>
                </div>)}
            </div>

            {/* Contact */}
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Contact</h3>
              <div style={{ fontSize: 14 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={labelStyle}>Phone</span>
                  <div>{driver.phone}</div>
                </div>
                {driver.email && (<div style={{ marginBottom: 8 }}>
                    <span style={labelStyle}>Email</span>
                    <div>{driver.email}</div>
                  </div>)}
                <div>
                  <span style={labelStyle}>Capacity</span>
                  <div>{driver.maxCapacity} orders max</div>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            {editing && (<div style={cardStyle}>
                <h3 style={cardTitleStyle}>Edit Driver</h3>
                <Form method="post">
                  <input type="hidden" name="intent" value="update"/>
                  <div style={formFieldStyle}>
                    <label style={formLabelStyle}>Name</label>
                    <input name="name" defaultValue={driver.name} style={formInputStyle}/>
                  </div>
                  <div style={formFieldStyle}>
                    <label style={formLabelStyle}>Phone</label>
                    <input name="phone" defaultValue={driver.phone} style={formInputStyle}/>
                  </div>
                  <div style={formFieldStyle}>
                    <label style={formLabelStyle}>Email</label>
                    <input name="email" defaultValue={driver.email ?? ""} style={formInputStyle}/>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="submit" style={primaryBtnStyle}>Save Changes</button>
                  </div>
                </Form>

                <div style={{ marginTop: 20, borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)", paddingTop: 16 }}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="deactivate"/>
                    <button type="submit" style={dangerBtnStyle}>Deactivate Driver</button>
                  </Form>
                </div>
              </div>)}
          </div>

          {/* Location */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Last Known Location</h3>
              {driver.lastLocation ? (<>
                  <div id="driver-detail-map" style={{ width: "100%", height: 300, borderRadius: 8, backgroundColor: "#e8eaed" }}/>
                  <div style={{ ...subtextStyle, marginTop: 8 }}>
                    Updated {formatRelative(driver.lastLocation.updatedAt)}
                  </div>
                </>) : (<div style={{ padding: 20, textAlign: "center", color: "var(--p-color-text-subdued, #6d7175)", fontSize: 13 }}>
                  No location data available.
                </div>)}
            </div>
          </div>
        </div>)}

      {(tab === "orders" || tab === "history") && (<div style={cardStyle}>
          <h3 style={cardTitleStyle}>
            {tab === "orders" ? "Active Orders" : "Delivery History"}
          </h3>
          {orders.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: "var(--p-color-text-subdued, #6d7175)", fontSize: 13 }}>
              {tab === "orders" ? "No active orders assigned." : "No delivery history yet."}
            </div>) : (<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Order</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (<tr key={o.id} style={{ borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" }}>
                    <td style={tdStyle}>
                      <Link to={`/orders/${o.id}`} style={linkStyle}>
                        {o.shopifyOrderNumber ? `#${o.shopifyOrderNumber}` : o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={tdStyle}>{o.customerName ?? "—"}</td>
                    <td style={tdStyle}>
                      {o.addressLine1 ?? "—"}
                      {o.city && <div style={{ fontSize: 12, color: "#6d7175" }}>{o.city}</div>}
                    </td>
                    <td style={tdStyle}><OrderStatusBadge status={o.status} size="small"/></td>
                    <td style={tdStyle}>{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                  </tr>))}
              </tbody>
            </table>)}
        </div>)}
    </div>);
}
// ─── Sub-components ────────────────────────────────────────
function StatBlock({ label, value }) {
    return (<div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: "var(--p-color-text, #202223)" }}>
        {value}
      </div>
    </div>);
}
function formatRelative(iso) {
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)
            return "just now";
        if (mins < 60)
            return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24)
            return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }
    catch {
        return iso;
    }
}
// ─── Styles ────────────────────────────────────────────────
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 16px" };
const headingStyle = { fontSize: 20, fontWeight: 600, margin: 0 };
const subtextStyle = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)" };
const backLinkStyle = { fontSize: 20, color: "var(--p-color-text-subdued, #6d7175)", textDecoration: "none", padding: 4 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 };
const tabBarStyle = { display: "flex", gap: 0, borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)", marginBottom: 20 };
const tabStyle = { padding: "10px 16px", fontSize: 14, fontWeight: 500, border: "none", borderBottom: "2px solid transparent", backgroundColor: "transparent", color: "var(--p-color-text-subdued, #6d7175)", cursor: "pointer" };
const tabActiveStyle = { ...tabStyle, color: "var(--p-color-text-primary, #005bd3)", borderBottomColor: "var(--p-color-bg-fill-brand, #005bd3)" };
const columnsStyle = { display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" };
const cardStyle = { padding: 20, backgroundColor: "white", borderRadius: 12, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", boxShadow: "0 1px 0 rgba(0,0,0,.05)" };
const cardTitleStyle = { fontSize: 14, fontWeight: 600, margin: "0 0 12px" };
const thStyle = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "#6d7175", textTransform: "uppercase", borderBottom: "1px solid #e1e3e5" };
const tdStyle = { padding: "10px 12px", verticalAlign: "top" };
const linkStyle = { color: "var(--p-color-text-primary, #005bd3)", fontWeight: 600, textDecoration: "none" };
const primaryBtnStyle = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "white", backgroundColor: "#005bd3", border: "none", borderRadius: 8, cursor: "pointer" };
const secondaryBtnStyle = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "#303030", backgroundColor: "white", border: "1px solid #c9cccf", borderRadius: 8, cursor: "pointer" };
const dangerBtnStyle = { width: "100%", padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "#d72c0d", backgroundColor: "white", border: "1px solid #d72c0d", borderRadius: 8, cursor: "pointer" };
const formFieldStyle = { marginBottom: 12 };
const formLabelStyle = { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 };
const formInputStyle = { width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid #c9cccf", borderRadius: 8, boxSizing: "border-box" };
//# sourceMappingURL=drivers.$id.js.map