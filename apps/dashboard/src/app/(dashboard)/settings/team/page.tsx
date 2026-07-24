"use client";

import { useState } from "react";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { useToast } from "@/components/ui/toast";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Mail, Trash2, Clock, AlertCircle, Send, X } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  avatar: string;
  lastActive: string;
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  invitedAt: string;
}

export default function TeamPage() {
  const {
    items: apiMembers,
    loading,
    error,
    refetch,
  } = useApiList<TeamMember>("/api/v4/users");
  const { items: apiInvitations } = useApiList<PendingInvitation>(
    "/api/v4/invitations",
  );
  const [members, setMembers] = useState<TeamMember[]>(apiMembers);
  const [invitations, setInvitations] =
    useState<PendingInvitation[]>(apiInvitations);
  const { execute: removeMember } = useApiMutation(
    "DELETE",
    "/api/v4/users/:id",
  );
  const { execute: inviteMember } = useApiMutation(
    "POST",
    "/api/v4/invitations",
  );
  const { execute: resendInvite } = useApiMutation(
    "POST",
    "/api/v4/invitations/:id/resend",
  );
  const { addToast } = useToast();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [changeRoleId, setChangeRoleId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );

  const ROLE_BADGES = {
    owner: { variant: "primary" as const, label: "Owner" },
    admin: { variant: "success" as const, label: "Admin" },
    member: { variant: "default" as const, label: "Member" },
    viewer: { variant: "info" as const, label: "Viewer" },
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const handleInviteMember = async () => {
    if (!inviteEmail) return;
    const newInvitation: PendingInvitation = {
      id: `inv-${Date.now()}`,
      email: inviteEmail,
      role: inviteRole,
      invitedAt: new Date().toISOString().split("T")[0],
    };
    setInvitations([...invitations, newInvitation]);
    setInviteEmail("");
    setInviteRole("member");
    setShowInviteDialog(false);
  };

  const handleRemoveMember = (id: string) => {
    removeMember({ params: { id } });
    setRemoveConfirmId(null);
    refetch();
  };

  const changeRole = (id: string, role: "admin" | "member" | "viewer") => {
    setMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, role } : member)),
    );
    setChangeRoleId(null);
  };

  const resendInvitation = async (id: string) => {
    try {
      await resendInvite({ params: { id } });
      addToast({
        type: "success",
        title: "Invitation resent",
        message: "The invitation email has been resent.",
      });
    } catch {
      addToast({
        type: "error",
        title: "Failed to resend",
        message: "Could not resend the invitation. Please try again.",
      });
    }
  };

  const revokeInvitation = (id: string) => {
    setInvitations((prev) => prev.filter((inv) => inv.id !== id));
  };

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Team Management"
        subtitle="Manage team members and their roles"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Invite Button */}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowInviteDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Invite Team Member
            </Button>
          </div>

          {/* Invite Dialog */}
          {showInviteDialog && (
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle>Invite Team Member</CardTitle>
                <CardDescription>Add a new member to your team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as typeof inviteRole)
                    }
                    className="w-full px-3 py-2 bg-wl-bg-elevated text-white border border-wl-border-default rounded-md text-sm"
                  >
                    <option value="viewer">Viewer - Read-only access</option>
                    <option value="member">Member - Can edit content</option>
                    <option value="admin">Admin - Full access</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleInviteMember}
                  disabled={!inviteEmail}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Invitation
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowInviteDialog(false);
                    setInviteEmail("");
                    setInviteRole("member");
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Team Members */}
          <Card className="border border-wl-border-default bg-wl-bg-surface">
            <CardHeader>
              <CardTitle>Team Members ({members.length})</CardTitle>
              <CardDescription>
                Manage your team and their permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 border border-wl-border-default rounded-lg hover:bg-wl-bg-elevated transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-white">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {changeRoleId === member.id ? (
                          <select
                            value={newRole}
                            onChange={(e) =>
                              setNewRole(e.target.value as typeof newRole)
                            }
                            className="px-2 py-1 bg-wl-bg-elevated text-white border border-wl-border-default rounded text-sm"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <Badge variant={ROLE_BADGES[member.role].variant}>
                            {ROLE_BADGES[member.role].label}
                          </Badge>
                        )}
                        {changeRoleId === member.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => changeRole(member.id, newRole)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setChangeRoleId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : member.role !== "owner" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setChangeRoleId(member.id);
                                if (member.role !== "owner")
                                  setNewRole(member.role);
                              }}
                            >
                              Change Role
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setRemoveConfirmId(member.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Last active: {member.lastActive}</span>
                      </div>
                      <span>Joined: {member.joinedAt}</span>
                    </div>

                    {removeConfirmId === member.id && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between gap-3">
                        <p className="text-xs text-white">
                          Remove this member from the team?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Remove
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRemoveConfirmId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <Card className="border border-wl-border-default bg-wl-bg-surface">
              <CardHeader>
                <CardTitle>
                  Pending Invitations ({invitations.length})
                </CardTitle>
                <CardDescription>Awaiting acceptance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="p-4 border border-wl-border-default rounded-lg hover:bg-wl-bg-elevated transition-all"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Mail className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-semibold text-white">
                              {invitation.email}
                            </p>
                            <p className="text-xs text-gray-400">
                              Invited: {invitation.invitedAt}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="info">{invitation.role}</Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => resendInvitation(invitation.id)}
                            >
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => revokeInvitation(invitation.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card className="bg-blue-500/5 border border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Role Permissions
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>
                      <strong>Owner:</strong> Full access, can manage team and
                      billing
                    </li>
                    <li>
                      <strong>Admin:</strong> Full access to all features and
                      settings
                    </li>
                    <li>
                      <strong>Member:</strong> Can create and edit content
                    </li>
                    <li>
                      <strong>Viewer:</strong> Read-only access to view content
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
