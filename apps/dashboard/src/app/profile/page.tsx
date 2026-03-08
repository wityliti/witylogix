"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Shield,
  LogOut,
  Clock,
  Globe,
  Lock,
  Smartphone,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

interface Session {
  id: string;
  browser: string;
  platform: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "Arjun",
    lastName: "Rajput",
    email: "arjun@witylogix.com",
    phone: "+1 (555) 123-4567",
    timezone: "America/New_York",
    role: "CTO",
  });

  const [editForm, setEditForm] = useState({ ...profile });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: "1",
      browser: "Chrome",
      platform: "Mac OS",
      ip: "192.168.1.100",
      location: "San Francisco, CA",
      lastActive: "Just now",
      current: true,
    },
    {
      id: "2",
      browser: "Safari",
      platform: "iOS",
      ip: "192.168.1.101",
      location: "San Francisco, CA",
      lastActive: "2 hours ago",
      current: false,
    },
    {
      id: "3",
      browser: "Firefox",
      platform: "Ubuntu",
      ip: "192.168.1.102",
      location: "San Francisco, CA",
      lastActive: "3 days ago",
      current: false,
    },
  ]);

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = () => {
    setProfile(editForm);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  const handleLogoutSession = (id: string) => {
    setSessions(sessions.filter((s) => s.id !== id));
  };

  return (
    <div className="bg-wl-bg min-h-screen">
      <Header title="Profile Settings" subtitle="Manage your account and security settings" />

      <main className="flex-1 p-6 max-w-4xl mx-auto">
        {/* Personal Information */}
        <Card className="bg-wl-card border border-wl-border mb-6">
          <CardHeader>
            <CardTitle className="text-wl-text flex items-center justify-between">
              Personal Information
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-wl-primary bg-wl-primary bg-opacity-10 px-3 py-1.5 rounded hover:opacity-80"
                >
                  Edit
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => handleEditChange("firstName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                  />
                ) : (
                  <p className="text-wl-text">{profile.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => handleEditChange("lastName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                  />
                ) : (
                  <p className="text-wl-text">{profile.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleEditChange("email", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                  />
                ) : (
                  <p className="text-wl-text">{profile.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => handleEditChange("phone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                  />
                ) : (
                  <p className="text-wl-text">{profile.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  Timezone
                </label>
                {isEditing ? (
                  <select
                    value={editForm.timezone}
                    onChange={(e) => handleEditChange("timezone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm"
                  >
                    <option>America/New_York</option>
                    <option>America/Chicago</option>
                    <option>America/Denver</option>
                    <option>America/Los_Angeles</option>
                  </select>
                ) : (
                  <p className="text-wl-text">{profile.timezone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text mb-2">
                  Role
                </label>
                <p className="text-wl-text">{profile.role}</p>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4 border-t border-wl-border">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2 bg-wl-primary text-white rounded text-sm font-medium cursor-pointer hover:opacity-90"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-wl-border text-wl-text rounded text-sm font-medium cursor-pointer hover:opacity-90"
                >
                  Cancel
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-wl-card border border-wl-border mb-6">
          <CardHeader>
            <CardTitle className="text-wl-text flex items-center gap-2">
              <Shield size={20} />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Change Password */}
            <div>
              <h4 className="text-base font-semibold text-wl-text mb-3">
                Change Password
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-wl-text mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, current: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-muted cursor-pointer hover:opacity-70"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, new: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm pr-10"
                    />
                    <button
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-muted cursor-pointer hover:opacity-70"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm pr-10"
                    />
                    <button
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-muted cursor-pointer hover:opacity-70"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <button className="mt-4 px-4 py-2 bg-wl-primary text-white rounded text-sm font-medium cursor-pointer hover:opacity-90">
                Update Password
              </button>
            </div>

            <div className="border-t border-wl-border pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-wl-text mb-1">
                    Two-Factor Authentication
                  </h4>
                  <p className="text-wl-muted text-sm">
                    {twoFAEnabled
                      ? "Your account is protected with 2FA"
                      : "Add an extra layer of security to your account"}
                  </p>
                </div>
                <button
                  onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                  className={cn(
                    "w-12 h-7 rounded-full border-none cursor-pointer transition-colors",
                    twoFAEnabled ? "bg-wl-success" : "bg-wl-border"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card className="bg-wl-card border border-wl-border mb-6">
          <CardHeader>
            <CardTitle className="text-wl-text flex items-center gap-2">
              <Globe size={20} />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center justify-between p-4 bg-wl-bg rounded border border-wl-border",
                    index !== sessions.length - 1 && "mb-2"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Smartphone size={20} className="text-wl-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-wl-text">
                          {session.browser} on {session.platform}
                        </p>
                        {session.current && (
                          <Badge className="bg-wl-success text-white text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-wl-muted">
                        {session.location} • {session.ip}
                      </p>
                      <p className="text-xs text-wl-muted">
                        Last active: {session.lastActive}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <button
                      onClick={() => handleLogoutSession(session.id)}
                      className="text-wl-danger text-xs font-medium hover:opacity-70 cursor-pointer"
                    >
                      Log Out
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="bg-wl-card border border-wl-border">
          <CardHeader>
            <CardTitle className="text-wl-text flex items-center gap-2">
              <AlertTriangle size={20} className="text-wl-danger" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-wl-muted text-sm mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-wl-danger text-white rounded text-sm font-medium cursor-pointer hover:opacity-90"
              >
                Delete Account
              </button>
            )}
            {showDeleteConfirm && (
              <div className="p-4 bg-wl-bg rounded border border-wl-danger border-opacity-30">
                <p className="text-wl-text text-sm mb-4">
                  Are you absolutely sure? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-wl-border text-wl-text rounded text-sm font-medium cursor-pointer hover:opacity-90"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-wl-danger text-white rounded text-sm font-medium cursor-pointer hover:opacity-90">
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
