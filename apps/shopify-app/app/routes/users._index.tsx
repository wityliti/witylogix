/**
 * Users List — User management with invite and role management.
 *
 * Features:
 *   - Table: Name, Email, Role (with color badges), Status, Created date
 *   - Invite User button → modal with name, email, role select
 *   - Inline role editing via dropdown
 *   - Deactivate button (DELETE action)
 *   - Role colors: SUPER_ADMIN=purple, ADMIN=blue, DISPATCHER=green, VIEWER=gray
 *   - Server-side loader fetches users from /api/v4/users
 *   - Actions: POST create, PATCH update role, DELETE deactivate
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, redirect, useActionData } from "react-router";
import { useState } from "react";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

interface UsersPageData {
  users: User[];
}

const ROLES = ["SUPER_ADMIN", "ADMIN", "DISPATCHER", "VIEWER"] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: "#ddd6fe", text: "#6b21a8" },
  ADMIN: { bg: "#dbeafe", text: "#1e40af" },
  DISPATCHER: { bg: "#dcfce7", text: "#166534" },
  VIEWER: { bg: "#f3f4f6", text: "#4b5563" },
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const response = await api.get<SingleResponse<User[]>>("/api/v4/users");

  return { users: response.data };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const user = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
    };

    try {
      await api.post("/api/v4/users", user);
      return redirect("/users");
    } catch (error) {
      return { error: "Failed to create user" };
    }
  }

  if (intent === "update-role") {
    const userId = formData.get("userId") as string;
    const newRole = formData.get("role") as string;

    try {
      await api.patch(`/api/v4/users/${userId}`, { role: newRole });
      return { success: true };
    } catch (error) {
      return { error: "Failed to update user role" };
    }
  }

  if (intent === "deactivate") {
    const userId = formData.get("userId") as string;

    try {
      await api.delete(`/api/v4/users/${userId}`);
      return { success: true };
    } catch (error) {
      return { error: "Failed to deactivate user" };
    }
  }

  return { error: "Unknown action" };
}

// ─── Component ─────────────────────────────────────────────

export default function UsersList() {
  const { users } = useLoaderData<UsersPageData>();
  const actionData = useActionData();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div style={containerStyle}>
      {/* Page Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={headingStyle}>Users</h1>
          <p style={subtextStyle}>{users.length} total users</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={primaryButtonStyle}
        >
          Invite User
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={modalHeadingStyle}>Invite User</h2>
              <button
                onClick={() => setShowModal(false)}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <Form method="post" style={formStyle}>
              <input type="hidden" name="intent" value="create" />

              <div style={formGroupStyle}>
                <label style={labelStyle} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  required
                  style={inputStyle}
                  placeholder="John Doe"
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  style={inputStyle}
                  placeholder="john@example.com"
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle} htmlFor="role">
                  Role
                </label>
                <select name="role" id="role" required style={selectStyle}>
                  <option value="">Select a role</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {actionData?.error && (
                <p style={errorStyle}>{actionData.error}</p>
              )}

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={secondaryButtonStyle}
                >
                  Cancel
                </button>
                <button type="submit" style={primaryButtonStyle}>
                  Invite
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Users Table */}
      {users.length > 0 ? (
        <div style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={tableHeaderCellStyle}>Name</th>
                <th style={tableHeaderCellStyle}>Email</th>
                <th style={tableHeaderCellStyle}>Role</th>
                <th style={tableHeaderCellStyle}>Status</th>
                <th style={tableHeaderCellStyle}>Created</th>
                <th style={tableHeaderCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={tableRowStyle}>
                  <td style={tableCellStyle}>{user.name}</td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>
                    {editingRole[user.id] ? (
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="update-role" />
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          onChange={(e) => {
                            const form = e.currentTarget.form;
                            if (form) {
                              form.submit();
                              setEditingRole((prev) => ({
                                ...prev,
                                [user.id]: "",
                              }));
                            }
                          }}
                          style={selectStyle}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </Form>
                    ) : (
                      <div
                        style={{
                          ...roleBadgeStyle,
                          backgroundColor: ROLE_COLORS[user.role]?.bg,
                          color: ROLE_COLORS[user.role]?.text,
                        }}
                        onClick={() =>
                          setEditingRole((prev) => ({
                            ...prev,
                            [user.id]: user.role,
                          }))
                        }
                      >
                        {user.role.replace(/_/g, " ")}
                      </div>
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    <div
                      style={{
                        ...statusBadgeStyle,
                        backgroundColor: user.isActive ? "#dcfce7" : "#fee2e2",
                        color: user.isActive ? "#166534" : "#991b1b",
                      }}
                    >
                      {user.isActive ? "Active" : "Deactivated"}
                    </div>
                  </td>
                  <td style={tableCellStyle}>{formatDate(user.createdAt)}</td>
                  <td style={tableCellStyle}>
                    <Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="intent" value="deactivate" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={!user.isActive}
                        style={{
                          ...deactivateButtonStyle,
                          opacity: user.isActive ? 1 : 0.5,
                        }}
                      >
                        Deactivate
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={emptyStateStyle}>
          <p style={emptyStateTextStyle}>No users yet</p>
          <p style={emptyStateSubtextStyle}>
            Click "Invite User" to add team members
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "20px",
};

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
  paddingBottom: "16px",
  borderBottom: "1px solid var(--p-color-border)",
};

const headingStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "600",
  margin: "0 0 8px 0",
  color: "var(--p-color-text)",
};

const subtextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--p-color-text-subdued)",
  margin: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "var(--p-color-bg-interactive)",
  color: "white",
  border: "none",
  borderRadius: "4px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "background-color 0.2s",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "transparent",
  color: "var(--p-color-text-interactive)",
  border: "1px solid var(--p-color-border)",
  borderRadius: "4px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
};

const deactivateButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: "500",
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface)",
  borderRadius: "8px",
  width: "90%",
  maxWidth: "500px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px",
  borderBottom: "1px solid var(--p-color-border)",
};

const modalHeadingStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  margin: 0,
  color: "var(--p-color-text)",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "24px",
  color: "var(--p-color-text-subdued)",
  cursor: "pointer",
  padding: 0,
};

const formStyle: React.CSSProperties = {
  padding: "20px",
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: "500",
  marginBottom: "6px",
  color: "var(--p-color-text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  border: "1px solid var(--p-color-border)",
  borderRadius: "4px",
  fontSize: "14px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  border: "1px solid var(--p-color-border)",
  borderRadius: "4px",
  fontSize: "14px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const errorStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: "14px",
  marginBottom: "16px",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  padding: "20px",
  borderTop: "1px solid var(--p-color-border)",
};

const tableContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface)",
  borderRadius: "8px",
  border: "1px solid var(--p-color-border)",
  overflow: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
};

const tableHeaderRowStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary)",
  borderBottom: "1px solid var(--p-color-border)",
};

const tableHeaderCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontWeight: "600",
  color: "var(--p-color-text-subdued)",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--p-color-border)",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  color: "var(--p-color-text)",
  verticalAlign: "middle",
};

const roleBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: "500",
  cursor: "pointer",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: "500",
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  backgroundColor: "var(--p-color-bg-surface)",
  borderRadius: "8px",
  border: "1px solid var(--p-color-border)",
  textAlign: "center",
};

const emptyStateTextStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "var(--p-color-text)",
  margin: "0 0 8px 0",
};

const emptyStateSubtextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--p-color-text-subdued)",
  margin: 0,
};
