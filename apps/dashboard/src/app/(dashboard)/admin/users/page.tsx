'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
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
        <div className="border-b border-wl-border-default pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("overview")
                  ? expandedSections.filter((s) => s !== "overview")
                  : [...expandedSections, "overview"]
              )
            }
            className="bg-transparent border-0 text-white font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("overview") ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Overview
          </button>
          {expandedSections.includes("overview") && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Name
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {user.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Email
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Role
                </p>
                <Badge
                  variant="default"
                  style={{
                    backgroundColor: getRoleColor(user.role) + "20",
                    color: getRoleColor(user.role),
                    fontSize: "'0.75rem'",
                    border: `1px solid ${getRoleColor(user.role)}40`,
                  }}
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Store
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {user.store}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Activity Section */}
        <div className="border-b border-wl-border-default pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("activity")
                  ? expandedSections.filter((s) => s !== "activity")
                  : [...expandedSections, "activity"]
              )
            }
            className="bg-transparent border-0 text-white font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("activity") ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Activity
          </button>
          {expandedSections.includes("activity") && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Last Login
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {user.lastLogin}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                  Created
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {user.created}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Permissions Section */}
        <div className="border-b border-wl-border-default pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("permissions")
                  ? expandedSections.filter((s) => s !== "permissions")
                  : [...expandedSections, "permissions"]
              )
            }
            className="bg-transparent border-0 text-white font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("permissions") ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
            className="bg-transparent border-0 text-white font-semibold text-sm cursor-pointer flex items-center gap-2 py-2"
          >
            {expandedSections.includes("auth") ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                <p className="text-gray-400 text-xs m-0">
                  No auth providers connected
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 border-t border-wl-border-default pt-4">
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
  const { items: users, loading, error, refetch } = useApiList<User>('/api/v4/users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (loading && users.length === 0) return <LoadingSkeleton />;
  if (error && users.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  const filteredUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

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
            <Plus className="w-4 h-4 mr-1.5" />
            Add User
          </Button>
        }
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                    Total Users
                  </p>
                  <p className="text-white text-2xl font-bold m-0">
                    {users.length}
                  </p>
                </div>
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                    Active
                  </p>
                  <p className="text-white text-2xl font-bold m-0">
                    {users.filter((u) => u.status === 'active').length}
                  </p>
                </div>
                <UserCheck className="w-6 h-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                    Admins
                  </p>
                  <p className="text-white text-2xl font-bold m-0">
                    {users.filter((u) => u.role === 'admin').length}
                  </p>
                </div>
                <Shield className="w-6 h-6 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 m-0 mb-1 font-semibold uppercase">
                    Pending Invites
                  </p>
                  <p className="text-white text-2xl font-bold m-0">
                    {users.filter((u) => u.status === 'invited').length}
                  </p>
                </div>
                <Mail className="w-6 h-6 text-amber-500" />
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
              className="w-full p-2 pl-8 bg-wl-bg-elevated text-white border border-wl-border-default rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Users Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-default bg-wl-bg-root min-h-screen">
                  <th className="p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    User
                  </th>
                  <th className="p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    Role
                  </th>
                  <th className="p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    Store
                  </th>
                  <th className="p-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="p-3 text-center text-gray-400 font-semibold text-xs uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className="border-b border-wl-border-default transition-colors duration-200 cursor-pointer"
                    style={{
                      backgroundColor: idx % 2 === 0 ? "transparent" : "#1a1a2e",
                    }}
                    onClick={() => handleUserClick(user)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-wl-bg-elevated flex items-center justify-center text-xs font-semibold text-white">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-medium m-0">
                            {user.name}
                          </p>
                          <p className="text-gray-400 text-xs m-0">
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
                          fontSize: "'0.75rem'",
                          border: `1px solid ${getRoleColor(user.role)}40`,
                        }}
                      >
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </td>
                    <td className="p-3 text-white text-sm">
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
                    <td className="p-3 text-gray-400 text-xs">
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
                        <MoreVertical className="w-4 h-4" />
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
