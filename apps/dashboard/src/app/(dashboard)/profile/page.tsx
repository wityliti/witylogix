'use client';

import { useState } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Globe,
  Smartphone,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  role: string;
}

export default function ProfilePage() {
  const { data: userProfile, loading, error, refetch } = useApiQuery<User>('/api/v4/users/me');
  const { items: sessions, loading: sessionsLoading } = useApiList<Session>('/api/v4/users/me/sessions');

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const profile = userProfile ?? { firstName: '', lastName: '', email: '', phone: '', timezone: 'America/New_York', role: 'User' };
  const formData = Object.keys(editForm).length > 0 ? editForm : profile;

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    void refetch();
    setIsEditing(false);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const formatLastActive = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    return `${Math.floor(diff / 86_400_000)} days ago`;
  };

  return (
    <div className="bg-wl-bg-primary min-h-screen">
      <Header title="Profile Settings" subtitle="Manage your account and security settings" />

      <main className="flex-1 p-6 max-w-4xl mx-auto">
        {/* Personal Information */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Personal Information
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded hover:bg-blue-500/20 transition-colors"
                >
                  Edit
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "First Name", field: "firstName" },
                { label: "Last Name", field: "lastName" },
                { label: "Email", field: "email", type: "email" },
                { label: "Phone", field: "phone", type: "tel" },
              ].map(({ label, field, type = "text" }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                  {isEditing ? (
                    <input
                      type={type}
                      value={(formData as Record<string, string>)[field] ?? ""}
                      onChange={(e) => handleEditChange(field, e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                  ) : (
                    <p className="text-white">{(profile as Record<string, string>)[field] || "—"}</p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                {isEditing ? (
                  <select
                    value={(formData as Record<string, string>).timezone ?? "America/New_York"}
                    onChange={(e) => handleEditChange("timezone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 cursor-pointer transition-colors"
                  >
                    <option>America/New_York</option>
                    <option>America/Chicago</option>
                    <option>America/Denver</option>
                    <option>America/Los_Angeles</option>
                  </select>
                ) : (
                  <p className="text-white">{profile.timezone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                <p className="text-white">{profile.role}</p>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4 border-t border-wl-border-default">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-wl-bg-elevated text-wl-text-secondary rounded text-sm font-medium cursor-pointer hover:bg-wl-bg-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield size={20} />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-base font-semibold text-white mb-3">Change Password</h4>
              <div className="space-y-3">
                {[
                  { label: "Current Password", key: "current", show: showPassword, toggle: () => setShowPassword(!showPassword) },
                  { label: "New Password", key: "new", show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword) },
                  { label: "Confirm Password", key: "confirm", show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
                ].map(({ label, key, show, toggle }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                    <div className="relative">
                      <input
                        type={show ? "text" : "password"}
                        value={(passwordForm as Record<string, string>)[key]}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm pr-10 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                      />
                      <button
                        onClick={toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-gray-300 transition-colors"
                      >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors">
                Update Password
              </button>
            </div>

            <div className="border-t border-wl-border-default pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-white mb-1">Two-Factor Authentication</h4>
                  <p className="text-gray-400 text-sm">
                    {twoFAEnabled ? "Your account is protected with 2FA" : "Add an extra layer of security"}
                  </p>
                </div>
                <button
                  onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                  className={cn(
                    "w-12 h-7 rounded-full border-none cursor-pointer transition-colors",
                    twoFAEnabled ? "bg-emerald-500" : "bg-wl-bg-elevated"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe size={20} />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-16 bg-[#1a1a2e] rounded border border-[#1e1e2e] animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <Smartphone size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No active sessions found.</p>
                <p className="text-gray-500 text-xs mt-1">Sessions are only tracked when using SSO providers.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session, index) => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-center justify-between p-4 bg-[#1a1a2e] rounded border border-[#1e1e2e]",
                      index !== sessions.length - 1 && "mb-2"
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Smartphone size={20} className="text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">
                            {session.browser} on {session.platform}
                          </p>
                          {session.current && <Badge variant="success" className="text-xs">Current</Badge>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {session.location !== "Unknown" ? `${session.location} • ` : ""}{session.ip}
                        </p>
                        <p className="text-xs text-gray-400">
                          Last active: {formatLastActive(session.lastActive)}
                        </p>
                      </div>
                    </div>
                    {!session.current && (
                      <button className="text-red-500 text-xs font-medium hover:text-red-400 cursor-pointer transition-colors">
                        Log Out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-wl-text-muted text-sm mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
              >
                Delete Account
              </button>
            )}
            {showDeleteConfirm && (
              <div className="p-4 bg-[#1a1a2e] rounded border border-red-500/30">
                <p className="text-white text-sm mb-4">Are you absolutely sure? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-wl-bg-elevated text-wl-text-secondary rounded text-sm font-medium cursor-pointer hover:bg-wl-bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors">
                    Delete My Account
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
