import { Header } from "../../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Mail,
  Trash2,
  Shield,
  User,
  Clock,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "user";
  joinedDate: string;
  lastActive: string;
  avatar: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invitedDate: string;
  expiresAt: string;
}

const teamMembers: TeamMember[] = [
  {
    id: "user-001",
    name: "Sarah Johnson",
    email: "sarah@witylogix.com",
    role: "admin",
    joinedDate: "2024-01-15",
    lastActive: "2026-03-06",
    avatar: "SJ",
  },
  {
    id: "user-002",
    name: "Michael Chen",
    email: "michael@witylogix.com",
    role: "manager",
    joinedDate: "2024-03-20",
    lastActive: "2026-03-05",
    avatar: "MC",
  },
  {
    id: "user-003",
    name: "Emma Williams",
    email: "emma@witylogix.com",
    role: "user",
    joinedDate: "2024-06-10",
    lastActive: "2026-03-04",
    avatar: "EW",
  },
  {
    id: "user-004",
    name: "David Martinez",
    email: "david@witylogix.com",
    role: "user",
    joinedDate: "2024-08-05",
    lastActive: "2026-03-03",
    avatar: "DM",
  },
  {
    id: "user-005",
    name: "Lisa Anderson",
    email: "lisa@witylogix.com",
    role: "manager",
    joinedDate: "2024-09-12",
    lastActive: "2026-03-06",
    avatar: "LA",
  },
];

const pendingInvitations: PendingInvitation[] = [
  {
    id: "inv-001",
    email: "john.doe@company.com",
    role: "Manager",
    invitedDate: "2026-02-28",
    expiresAt: "2026-03-14",
  },
  {
    id: "inv-002",
    email: "jane.smith@company.com",
    role: "User",
    invitedDate: "2026-03-01",
    expiresAt: "2026-03-17",
  },
];

const roleDescriptions: Record<string, string> = {
  admin: "Full access to all settings, team management, and billing",
  manager: "Can manage shipments, drivers, and view reports",
  user: "Can view and manage assigned shipments only",
};

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="Team Members"
        subtitle="Invite and manage your team members"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Invite Section */}
        <Card className="mb-8 bg-[var(--wl-bg-tertiary)] border-[var(--wl-primary)]/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--wl-text-primary)] mb-1">
                  Invite Team Members
                </h3>
                <p className="text-sm text-[var(--wl-text-secondary)]">
                  Add new members to your workspace and assign roles
                </p>
              </div>
              <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90 whitespace-nowrap">
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Role Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Role Descriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(roleDescriptions).map(([role, description]) => (
                <div
                  key={role}
                  className="flex items-start gap-4 p-4 rounded-lg border border-[var(--wl-border)] hover:bg-[var(--wl-bg-tertiary)] transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--wl-primary)]/10 text-[var(--wl-primary)]">
                      {role.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-[var(--wl-text-primary)] capitalize">
                      {role}
                    </h4>
                    <p className="text-sm text-[var(--wl-text-secondary)] mt-1">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Members List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Team Members ({teamMembers.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[var(--wl-border)] hover:bg-[var(--wl-bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[var(--wl-primary)]/20 text-[var(--wl-primary)] font-medium">
                      {member.avatar}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-[var(--wl-text-primary)]">
                        {member.name}
                      </h4>
                      <p className="text-sm text-[var(--wl-text-tertiary)]">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                        Last Active
                      </p>
                      <p className="text-sm text-[var(--wl-text-secondary)]">
                        {new Date(member.lastActive).toLocaleDateString()}
                      </p>
                    </div>

                    <select
                      defaultValue={member.role}
                      className="px-3 py-2 text-sm rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="user">User</option>
                    </select>

                    {member.role !== "admin" && (
                      <Button
                        variant="ghost"
                        className="text-[var(--wl-error)] hover:bg-[var(--wl-error)]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Pending Invitations ({pendingInvitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-tertiary)]/50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[var(--wl-warning)]/20 text-[var(--wl-warning)]">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-[var(--wl-text-primary)]">
                          {invitation.email}
                        </h4>
                        <p className="text-sm text-[var(--wl-text-tertiary)]">
                          Invited as {invitation.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-1">
                          <Clock className="w-3 h-3" />
                          Expires
                        </div>
                        <p className="text-sm text-[var(--wl-text-secondary)]">
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>

                      <Badge variant="secondary" className="bg-[var(--wl-warning)]/10 text-[var(--wl-warning)]">
                        Pending
                      </Badge>

                      <Button
                        variant="ghost"
                        className="text-[var(--wl-error)] hover:bg-[var(--wl-error)]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Team Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Team Name
              </label>
              <input
                type="text"
                defaultValue="Witylogix Operations"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Default Role for New Members
              </label>
              <select className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]">
                <option>User</option>
                <option>Manager</option>
                <option>Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Allow Team Members to Invite Others
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-[var(--wl-border)]"
                />
                <span className="text-sm text-[var(--wl-text-secondary)]">
                  Only admins and managers can invite team members
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end mt-8">
          <Button
            variant="outline"
            className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
          >
            Cancel
          </Button>
          <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
