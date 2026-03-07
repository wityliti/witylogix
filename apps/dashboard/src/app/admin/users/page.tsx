"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
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
      <div className="flex flex-col gap-4">
        {/* Overview Section */}
        <div className="border-b border-wl-border-subtle pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("overview")
                  ? expandedSections.filter((s) => s !== "overview")
                  : [...expandedSections, "overview"]
              )
            }
            className="bg-transparent border-0 text-wl-text-primary font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("overview") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Overview
          </button>
          {expandedSections.includes("overview") && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                  Name
                </p>
                <p className="text-wl-text-primary text-sm font-medium m-0">
                  {user.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                  Email
                </p>
                <p className="text-wl-text-primary text-sm font-medium m-0">
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
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
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                  Store
                </p>
                <p className="text-wl-text-primary text-sm font-medium m-0">
                  {user.store}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Activity Section */}
        <div className="border-b border-wl-border-subtle pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("activity")
                  ? expandedSections.filter((s) => s !== "activity")
                  : [...expandedSections, "activity"]
              )
            }
            className="bg-transparent border-0 text-wl-text-primary font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("activity") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Activity
          </button>
          {expandedSections.includes("activity") && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                  Last Login
                </p>
                <p className="text-wl-text-primary text-sm font-medium m-0">
                  {user.lastLogin}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                  Created
                </p>
                <p className="text-wl-text-primary text-sm font-medium m-0">
                  {user.created}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Permissions Section */}
        <div className="border-b border-wl-border-subtle pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("permissions")
                  ? expandedSections.filter((s) => s !== "permissions")
                  : [...expandedSections, "permissions"]
              )
            }
            className="bg-transparent border-0 text-wl-text-primary font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("permissions") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Permissions ({user.permissions.length})
          </button>
          {expandedSections.includes("permissions") && (
            <div className="flex flex-wrap gap-2 mt-3">
              {user.permissions.map((perm) => (
                <Badge key={perm} variant="info" className="text-xs">
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
            className="bg-transparent border-0 text-wl-text-primary font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("auth") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Auth Providers ({user.authProviders.length})
          </button>
          {expandedSections.includes("auth") && (
            <div className="flex flex-wrap gap-2 mt-3">
              {user.authProviders.length > 0 ? (
                user.authProviders.map((provider) => (
                  <Badge key={provider} variant="success" className="text-xs capitalize">
                    {provider}
                  </Badge>
                ))
              ) : (
                <p className="text-wl-text-secondary text-xs m-0">
                  No auth providers connected
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex gap-2 mt-4 border-t border-wl-border-subtle pt-4"
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

// Users Table
export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return mockUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mockUsers, searchTerm]);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  return (
    <>
      <Header
        title="User Management"
        subtitle="Manage platform users, roles, and permissions"
        actions={
          <Button variant="primary" size="md">
            <Plus style={{ width: "16px", height: "16px", marginRight: "6px" }} />
            Add User
          </Button>
        }
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Card className="bg-wl-bg-surface border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                    Total Users
                  </p>
                  <p className="text-wl-text-primary text-2xl font-bold m-0">
                    {mockUsers.length}
                  </p>
                </div>
                <Users style={{ width: "24px", height: "24px", color: "var(--wl-primary-500)" }} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                    Active
                  </p>
                  <p className="text-wl-text-primary text-2xl font-bold m-0">
                    {mockUsers.filter((u) => u.status === "active").length}
                  </p>
                </div>
                <UserCheck style={{ width: "24px", height: "24px", color: "#10b981" }} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                    Admins
                  </p>
                  <p className="text-wl-text-primary text-2xl font-bold m-0">
                    {mockUsers.filter((u) => u.role === "admin").length}
                  </p>
                </div>
                <Shield style={{ width: "24px", height: "24px", color: "#ef4444" }} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-subtle">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-wl-text-secondary m-0 mb-1 font-semibold uppercase">
                    Pending Invites
                  </p>
                  <p className="text-wl-text-primary text-2xl font-bold m-0">
                    {mockUsers.filter((u) => u.status === "invited").length}
                  </p>
                </div>
                <Mail style={{ width: "24px", height: "24px", color: "#f59e0b" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-8 bg-wl-bg-elevated text-wl-text-primary border border-wl-border-subtle rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
          </div>
          <Button variant="secondary" size="sm">
            <Filter style={{ width: "16px", height: "16px" }} />
          </Button>
          <Button variant="secondary" size="sm">
            <Download style={{ width: "16px", height: "16px" }} />
          </Button>
        </div>

        {/* Users Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-base">
                  <th className="p-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    User
                  </th>
                  <th className="p-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    Role
                  </th>
                  <th className="p-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    Store
                  </th>
                  <th className="p-3 text-center text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="p-3 text-center text-wl-text-secondary font-semibold text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className="border-b border-wl-border-subtle transition-colors duration-200 cursor-pointer"
                    style={{
                      backgroundColor: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                    }}
                    onClick={() => handleUserClick(user)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-wl-bg-elevated flex items-center justify-center text-xs font-semibold text-wl-text-primary">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-wl-text-primary font-medium m-0">
                            {user.name}
                          </p>
                          <p className="text-wl-text-secondary text-xs m-0">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
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
                    <td className="p-3 text-wl-text-primary text-sm">
                      {user.store}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={getStatusBadgeVariant(user.status)}
                        className="text-xs"
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="p-3 text-wl-text-secondary text-xs">
                      {user.lastLogin}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserClick(user);
                        }}
                      >
                        <MoreVertical style={{ width: "16px", height: "16px" }} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <UserDetailModal user={selectedUser} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
