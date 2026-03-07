"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Users,
  UserCheck,
  UserX,
  Key,
  Shield,
  Mail,
  Search,
  Filter,
  MoreVertical,
  Plus,
  LogIn,
  AlertCircle,
  Zap,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Types
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "operator" | "viewer";
  store: string;
  status: "active" | "suspended" | "invited";
  lastLogin: string;
  created: string;
  permissions: string[];
  authProviders: string[];
}

// Mock users data
const mockUsers: User[] = [
  {
    id: "user-001",
    name: "Sarah Chen",
    email: "sarah.chen@example.com",
    role: "admin",
    store: "All Stores",
    status: "active",
    lastLogin: "2026-03-07 14:32:10",
    created: "2024-01-15",
    permissions: ["read:*", "write:*", "admin:*"],
    authProviders: ["email", "google"],
  },
  {
    id: "user-002",
    name: "Marcus Johnson",
    email: "marcus.j@logistics.io",
    role: "manager",
    store: "Eastern Distribution",
    status: "active",
    lastLogin: "2026-03-07 10:15:42",
    created: "2024-02-20",
    permissions: ["read:orders", "write:orders", "read:shipments", "write:shipments"],
    authProviders: ["email"],
  },
  {
    id: "user-003",
    name: "Emily Rodriguez",
    email: "emily.r@logistics.io",
    role: "operator",
    store: "Western Hub",
    status: "active",
    lastLogin: "2026-03-06 16:45:20",
    created: "2024-03-10",
    permissions: ["read:shipments", "write:shipments"],
    authProviders: ["email", "microsoft"],
  },
  {
    id: "user-004",
    name: "David Park",
    email: "david.park@example.com",
    role: "manager",
    store: "Central Warehouse",
    status: "suspended",
    lastLogin: "2026-02-28 09:20:15",
    created: "2024-04-05",
    permissions: ["read:orders", "write:orders"],
    authProviders: ["email"],
  },
  {
    id: "user-005",
    name: "Jessica Wong",
    email: "j.wong@logistics.io",
    role: "viewer",
    store: "Southern Terminal",
    status: "active",
    lastLogin: "2026-03-07 11:30:05",
    created: "2024-05-12",
    permissions: ["read:orders", "read:shipments"],
    authProviders: ["email", "okta"],
  },
  {
    id: "user-006",
    name: "Robert Anderson",
    email: "robert.a@logistics.io",
    role: "manager",
    store: "Northern Facility",
    status: "active",
    lastLogin: "2026-03-07 13:15:30",
    created: "2024-06-01",
    permissions: ["read:orders", "write:orders", "read:drivers"],
    authProviders: ["email"],
  },
  {
    id: "user-007",
    name: "Lisa Thompson",
    email: "lisa.t@example.com",
    role: "operator",
    store: "Eastern Distribution",
    status: "invited",
    lastLogin: "—",
    created: "2026-03-05",
    permissions: ["read:shipments"],
    authProviders: [],
  },
  {
    id: "user-008",
    name: "Michael Green",
    email: "m.green@logistics.io",
    role: "viewer",
    store: "All Stores",
    status: "active",
    lastLogin: "2026-03-07 08:45:22",
    created: "2024-07-20",
    permissions: ["read:*"],
    authProviders: ["email", "github"],
  },
];

const getRoleColor = (role: User["role"]): string => {
  switch (role) {
    case "admin":
      return "#ef4444";
    case "manager":
      return "#8b5cf6";
    case "operator":
      return "#3b82f6";
    case "viewer":
      return "#6b7280";
    default:
      return "#6b7280";
  }
};

const getStatusBadgeVariant = (status: User["status"]): "success" | "warning" | "danger" | "info" | "default" => {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    case "invited":
      return "info";
    default:
      return "default";
  }
};

// User Detail Modal
const UserDetailModal = ({ user, isOpen, onClose }: { user: User | null; isOpen: boolean; onClose: () => void }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview"]);

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`User Details: ${user.name}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
        {/* Overview Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("overview")
                  ? expandedSections.filter((s) => s !== "overview")
                  : [...expandedSections, "overview"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("overview") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Overview
          </button>
          {expandedSections.includes("overview") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-4)", marginTop: "var(--wl-space-3)" }}>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Name
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {user.name}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Email
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {user.email}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Role
                </p>
                <Badge
                  variant="default"
                  style={{
                    backgroundColor: getRoleColor(user.role) + "20",
                    color: getRoleColor(user.role),
                    fontSize: "var(--wl-text-xs)",
                    border: `1px solid ${getRoleColor(user.role)}40`,
                  }}
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Store
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {user.store}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Activity Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("activity")
                  ? expandedSections.filter((s) => s !== "activity")
                  : [...expandedSections, "activity"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("activity") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Activity
          </button>
          {expandedSections.includes("activity") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-4)", marginTop: "var(--wl-space-3)" }}>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Last Login
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {user.lastLogin}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Created
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {user.created}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Permissions Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("permissions")
                  ? expandedSections.filter((s) => s !== "permissions")
                  : [...expandedSections, "permissions"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("permissions") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Permissions ({user.permissions.length})
          </button>
          {expandedSections.includes("permissions") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--wl-space-2)", marginTop: "var(--wl-space-3)" }}>
              {user.permissions.map((perm) => (
                <Badge key={perm} variant="info" style={{ fontSize: "var(--wl-text-xs)" }}>
                  {perm}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Auth Providers Section */}
        <div>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("auth")
                  ? expandedSections.filter((s) => s !== "auth")
                  : [...expandedSections, "auth"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("auth") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Auth Providers ({user.authProviders.length})
          </button>
          {expandedSections.includes("auth") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--wl-space-2)", marginTop: "var(--wl-space-3)" }}>
              {user.authProviders.length > 0 ? (
                user.authProviders.map((provider) => (
                  <Badge key={provider} variant="success" style={{ fontSize: "var(--wl-text-xs)", textTransform: "capitalize" }}>
                    {provider}
                  </Badge>
                ))
              ) : (
                <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)", margin: 0 }}>
                  No auth providers connected
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-2)",
            marginTop: "var(--wl-space-4)",
            borderTop: "1px solid var(--wl-border-subtle)",
            paddingTop: "var(--wl-space-4)",
          }}
        >
          <Button variant="secondary" size="sm">
            Reset Password
          </Button>
          <Button variant={user.status === "active" ? "danger" : "primary"} size="sm">
            {user.status === "active" ? "Suspend" : "Activate"}
          </Button>
          <Button variant="ghost" size="sm">
            Impersonate
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Stats Bar
const StatsBar = ({ users }: { users: User[] }) => {
  const activeUsers = users.filter((u) => u.status === "active").length;
  const todayLogins = users.filter((u) => u.lastLogin !== "—" && u.lastLogin.includes("2026-03-07")).length;
  const invitedUsers = users.filter((u) => u.status === "invited").length;
  const suspendedUsers = users.filter((u) => u.status === "suspended").length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--wl-space-4)",
        marginBottom: "var(--wl-space-6)",
      }}
    >
      {[
        { label: "Total Users", value: users.length.toString(), icon: Users, color: "#6366f1" },
        { label: "Active Today", value: todayLogins.toString(), icon: LogIn, color: "#10b981" },
        { label: "Invited", value: invitedUsers.toString(), icon: Mail, color: "#f59e0b" },
        { label: "Suspended", value: suspendedUsers.toString(), icon: AlertCircle, color: "#ef4444" },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            style={{
              backgroundColor: "var(--wl-bg-surface)",
              borderColor: "var(--wl-border-subtle)",
              animation: `fadeInUp 0.4s ease-out ${idx * 50}ms both`,
            }}
          >
            <CardContent style={{ padding: "var(--wl-space-4)", display: "flex", gap: "var(--wl-space-3)", alignItems: "flex-start" }}>
              <div
                style={{
                  padding: "var(--wl-space-2)",
                  borderRadius: "var(--wl-radius-md)",
                  backgroundColor: stat.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon style={{ color: stat.color, width: "20px", height: "20px" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {stat.label}
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-lg)", fontWeight: 700, margin: "var(--wl-space-1) 0 0 0" }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Main Page
export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "operator" | "viewer">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "invited">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    return mockUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.store.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchTerm, roleFilter, statusFilter]);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const csv = [["Name", "Email", "Role", "Store", "Status", "Last Login", "Created"]];
    filteredUsers.forEach((user) => {
      csv.push([user.name, user.email, user.role, user.store, user.status, user.lastLogin, user.created]);
    });
    const csvString = csv.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div style={{ backgroundColor: "var(--wl-bg-base)" }}>
      <Header
        title="User Management"
        subtitle="Manage all users across all stores"
        actions={
          <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download style={{ width: "14px", height: "14px", marginRight: "4px" }} />
              Export
            </Button>
            <Button variant="primary" size="sm">
              <Plus style={{ width: "14px", height: "14px", marginRight: "4px" }} />
              Invite User
            </Button>
          </div>
        }
      />

      <main style={{ flex: 1, padding: "var(--wl-space-6)", maxWidth: "1400px", margin: "0 auto" }}>
        <StatsBar users={mockUsers} />

        <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-6)" }}>
          <CardContent style={{ padding: "var(--wl-space-4)" }}>
            {/* Search */}
            <div style={{ marginBottom: "var(--wl-space-4)", position: "relative" }}>
              <input
                type="text"
                placeholder="Search by name, email, or store..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--wl-space-2) var(--wl-space-3) var(--wl-space-2) var(--wl-space-8)",
                  backgroundColor: "var(--wl-bg-base)",
                  color: "var(--wl-text-primary)",
                  border: "1px solid var(--wl-border-subtle)",
                  borderRadius: "var(--wl-radius-md)",
                  fontSize: "var(--wl-text-sm)",
                }}
              />
              <Search style={{ position: "absolute", left: "var(--wl-space-2)", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--wl-text-secondary)", pointerEvents: "none" }} />
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "var(--wl-space-3)", flexWrap: "wrap", marginBottom: "var(--wl-space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <Filter style={{ width: "16px", height: "16px", color: "var(--wl-text-secondary)" }} />
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                  Role:
                </span>
              </div>
              {(["all", "admin", "manager", "operator", "viewer"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  style={{
                    padding: "4px 12px",
                    background: roleFilter === role ? "var(--wl-brand-primary)" : "var(--wl-bg-base)",
                    color: roleFilter === role ? "white" : "var(--wl-text-primary)",
                    border: `1px solid ${roleFilter === role ? "var(--wl-brand-primary)" : "var(--wl-border-subtle)"}`,
                    borderRadius: "var(--wl-radius-md)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {role}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "var(--wl-space-3)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                  Status:
                </span>
              </div>
              {(["all", "active", "suspended", "invited"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: "4px 12px",
                    background: statusFilter === status ? "var(--wl-brand-primary)" : "var(--wl-bg-base)",
                    color: statusFilter === status ? "white" : "var(--wl-text-primary)",
                    border: `1px solid ${statusFilter === status ? "var(--wl-brand-primary)" : "var(--wl-border-subtle)"}`,
                    borderRadius: "var(--wl-radius-md)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
          {filteredUsers.length > 0 ? (
            <>
              <div
                style={{
                  padding: "var(--wl-space-3) var(--wl-space-4)",
                  borderBottom: "1px solid var(--wl-border-subtle)",
                  fontSize: "var(--wl-text-xs)",
                  color: "var(--wl-text-secondary)",
                }}
              >
                Showing {filteredUsers.length} of {mockUsers.length} users
              </div>
              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "var(--wl-text-sm)",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--wl-border-subtle)", backgroundColor: "var(--wl-bg-base)" }}>
                        {["Name", "Email", "Role", "Store", "Status", "Last Login", "Created", "Actions"].map((header) => (
                          <th
                            key={header}
                            style={{
                              padding: "var(--wl-space-3)",
                              textAlign: header === "Actions" ? "center" : "left",
                              color: "var(--wl-text-secondary)",
                              fontWeight: 600,
                              fontSize: "var(--wl-text-xs)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, idx) => (
                        <tr
                          key={user.id}
                          style={{
                            borderBottom: "1px solid var(--wl-border-subtle)",
                            backgroundColor: idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)",
                            transition: "all 0.2s",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--wl-bg-surface)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)";
                          }}
                          onClick={() => handleUserClick(user)}
                        >
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                            {user.name}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {user.email}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)" }}>
                            <Badge
                              variant="default"
                              style={{
                                backgroundColor: getRoleColor(user.role) + "20",
                                color: getRoleColor(user.role),
                                fontSize: "var(--wl-text-xs)",
                                border: `1px solid ${getRoleColor(user.role)}40`,
                              }}
                            >
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)" }}>
                            {user.store}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)" }}>
                            <Badge variant={getStatusBadgeVariant(user.status)} style={{ fontSize: "var(--wl-text-xs)" }}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </Badge>
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {user.lastLogin}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {user.created}
                          </td>
                          <td
                            style={{
                              padding: "var(--wl-space-3)",
                              textAlign: "center",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--wl-text-secondary)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-primary)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-secondary)";
                              }}
                            >
                              <MoreVertical style={{ width: "16px", height: "16px" }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent
              style={{
                padding: "var(--wl-space-12)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserX style={{ width: "48px", height: "48px", color: "var(--wl-text-secondary)", marginBottom: "var(--wl-space-3)", opacity: 0.3 }} />
              <p style={{ color: "var(--wl-text-primary)", fontWeight: 500, margin: 0, marginBottom: "4px" }}>
                No users found
              </p>
              <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-sm)", margin: 0 }}>
                Try adjusting your filters
              </p>
            </CardContent>
          )}
        </Card>
      </main>

      <UserDetailModal user={selectedUser} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
