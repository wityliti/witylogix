/**
 * Time Slots List — Delivery time slots management.
 *
 * Features:
 *   - Table view: Label, Start Time, End Time, Max Orders, Active status toggle
 *   - Create Time Slot modal with form
 *   - Pagination
 *   - Toggle active/inactive status
 *
 * Time slot management for delivery window availability.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form, redirect } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive: boolean;
}

interface TimeSlotsPageData {
  timeSlots: TimeSlot[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");

  const response = await api.get<PaginatedResponse<TimeSlot>>("/api/v4/time-slots", {
    page,
    limit,
  });

  return { timeSlots: response.data, meta: response.meta };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const timeSlot = {
      label: formData.get("label") as string,
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      maxOrders: Number(formData.get("maxOrders") ?? 10),
    };
    const result = await api.post<{ data: { id: string } }>(
      "/api/v4/time-slots",
      timeSlot
    );
    return redirect(`/time-slots/${result.data.id}`);
  }

  if (intent === "toggle") {
    const slotId = formData.get("slotId") as string;
    const isActive = formData.get("isActive") === "true";
    await api.patch(`/api/v4/time-slots/${slotId}`, {
      isActive: !isActive,
    });
    return null;
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function TimeSlotsList() {
  const { timeSlots, meta } = useLoaderData<TimeSlotsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentPage = meta.page;

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
          <h1 style={headingStyle}>Time Slots</h1>
          <p style={subtextStyle}>{meta.total} total time slots</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={primaryBtnStyle} type="button">
          Create Time Slot
        </button>
      </div>

      {/* Content */}
      {timeSlots.length === 0 ? (
        <EmptyState
          title="No time slots found"
          description="Create delivery time slots to define available delivery windows."
          actionLabel="Create Time Slot"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <>
          <div style={tableContainerStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Label</th>
                  <th style={thStyle}>Start Time</th>
                  <th style={thStyle}>End Time</th>
                  <th style={thStyle}>Max Orders</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link to={`/time-slots/${slot.id}`} style={linkStyle}>
                        {slot.label}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {formatTime(slot.startTime)}
                    </td>
                    <td style={tdStyle}>
                      {formatTime(slot.endTime)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {slot.maxOrders}
                    </td>
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="slotId" value={slot.id} />
                        <input type="hidden" name="isActive" value={String(slot.isActive)} />
                        <button
                          type="submit"
                          style={{
                            padding: "2px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 20,
                            border: "none",
                            cursor: "pointer",
                            backgroundColor: slot.isActive
                              ? "#ccf1e2"
                              : "#f1f2f3",
                            color: slot.isActive ? "#005c35" : "#6d7175",
                          }}
                        >
                          {slot.isActive ? "Active" : "Inactive"}
                        </button>
                      </Form>
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
      )}

      {/* Create Time Slot Modal */}
      {showCreateModal && (
        <TimeSlotCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function TimeSlotCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Create New Time Slot</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">&times;</button>
        </div>
        <Form method="post" onSubmit={onClose}>
          <input type="hidden" name="intent" value="create" />

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Slot Label *</label>
            <input
              name="label"
              required
              style={formInputStyle}
              placeholder="e.g., Morning (8am - 12pm)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>Start Time *</label>
              <input
                name="startTime"
                type="time"
                required
                style={formInputStyle}
              />
            </div>
            <div style={formFieldStyle}>
              <label style={formLabelStyle}>End Time *</label>
              <input
                name="endTime"
                type="time"
                required
                style={formInputStyle}
              />
            </div>
          </div>

          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Max Orders</label>
            <input
              name="maxOrders"
              type="number"
              defaultValue={10}
              min={1}
              style={formInputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button type="submit" style={primaryBtnStyle}>Create Time Slot</button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatTime(timeStr: string): string {
  try {
    if (timeStr.includes("T")) {
      // ISO format with date
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    // HH:mm format
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

// ─── Styles ────────────────────────────────────────────────

const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 16px" };
const headingStyle: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: 0 };
const subtextStyle: React.CSSProperties = { fontSize: 13, color: "var(--p-color-text-subdued, #6d7175)", margin: "4px 0 0" };

const tableContainerStyle: React.CSSProperties = { backgroundColor: "white", borderRadius: 12, border: "1px solid var(--p-color-border-subdued, #e1e3e5)", overflow: "hidden" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--p-color-text-subdued, #6d7175)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)", backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)" };
const trStyle: React.CSSProperties = { borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
const linkStyle: React.CSSProperties = { color: "var(--p-color-text-primary, #005bd3)", fontWeight: 600, textDecoration: "none" };

const paginationStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" };
const pageBtnStyle: React.CSSProperties = { padding: "6px 14px", fontSize: 13, fontWeight: 500, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 6, backgroundColor: "white", cursor: "pointer" };

const primaryBtnStyle: React.CSSProperties = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "white", backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)", border: "none", borderRadius: 8, cursor: "pointer" };
const secondaryBtnStyle: React.CSSProperties = { padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "var(--p-color-text, #303030)", backgroundColor: "white", border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, cursor: "pointer" };

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle: React.CSSProperties = { width: 500, maxHeight: "90vh", overflow: "auto", backgroundColor: "white", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const closeBtnStyle: React.CSSProperties = { fontSize: 24, lineHeight: 1, color: "var(--p-color-text-subdued, #6d7175)", background: "none", border: "none", cursor: "pointer" };

const formFieldStyle: React.CSSProperties = { marginBottom: 12 };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "var(--p-color-text, #202223)", marginBottom: 4 };
const formInputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid var(--p-color-border, #c9cccf)", borderRadius: 8, boxSizing: "border-box" as const };
