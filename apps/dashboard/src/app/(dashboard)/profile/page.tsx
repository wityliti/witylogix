'use client';

import { useCallback, useEffect, useState } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Globe,
  Smartphone,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  lastLogin?: string;
  shop?: { name: string };
}

export default function ProfilePage() {
  const { data: userProfile, loading, error, refetch } = useApiQuery<UserMe>('/api/v4/users/me');

  // All state declared before any conditional return
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync edit form when profile loads
  useEffect(() => {
    if (userProfile) {
      setEditForm({ name: userProfile.name ?? '', email: userProfile.email ?? '' });
    }
  }, [userProfile]);

  const handleSaveProfile = useCallback(async () => {
    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.patch('/api/v4/users/me', editForm);
      await refetch();
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaveLoading(false);
    }
  }, [editForm, refetch]);

  const handleCancelEdit = useCallback(() => {
    if (userProfile) setEditForm({ name: userProfile.name ?? '', email: userProfile.email ?? '' });
    setIsEditing(false);
    setSaveError(null);
  }, [userProfile]);

  const handleChangePassword = useCallback(async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    if (passwordForm.new.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      if (!userProfile?.id) throw new Error('User not loaded');
      await api.patch(`/api/v4/users/${userProfile.id}/password`, {
        password: passwordForm.new,
        currentPassword: passwordForm.current,
      });
      setPwSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }, [passwordForm, userProfile]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!user) return <ErrorState message="User profile unavailable" onRetry={refetch} />;

  const profile = userProfile || {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    timezone: 'America/New_York',
    role: 'User',
  };

  const [editForm, setEditForm] = useState({ ...profile });

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = () => {
    void refetch();
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  return (
    <div className="bg-wl-bg-primary min-h-screen">
      <Header title="Profile Settings" subtitle="Manage your account and security settings" />

      <main className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
        {/* Personal Information */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Personal Information
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded hover:bg-blue-500/20 transition-colors"
                >
                  Edit
                </button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                <CheckCircle size={16} />
                Profile saved successfully
              </div>
            )}
            {saveError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">{saveError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => handleEditChange("firstName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                ) : (
                  <p className="text-white">{profile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => handleEditChange("lastName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                ) : (
                  <p className="text-white">{profile.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleEditChange("email", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                ) : (
                  <p className="text-white">{user.email || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => handleEditChange("phone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                ) : (
                  <p className="text-white">{profile.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Timezone
                </label>
                {isEditing ? (
                  <select
                    value={editForm.timezone}
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
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Role
                </label>
                <p className="text-white">{profile.role}</p>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4 border-t border-wl-border-default">
                <button
                  onClick={() => { void handleSaveProfile(); }}
                  disabled={saveLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {saveLoading ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-[#1e1e2e] text-wl-text-secondary rounded text-sm font-medium cursor-pointer hover:bg-wl-bg-surface transition-colors"
                >
                  {profileMutation.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {profileMutation.loading ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button variant="ghost" size="md" onClick={handleCancelEdit}>
                  Cancel
                </Button>
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
              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-3">
                  <CheckCircle size={16} />
                  Password changed successfully
                </div>
              )}
              {pwError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3 mb-3">{pwError}</p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, current: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm pr-10 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-wl-text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, new: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm pr-10 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                    <button
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-wl-text-secondary transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-white text-sm pr-10 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                    />
                    <button
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-wl-text-secondary transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { void handleChangePassword(); }}
                disabled={pwLoading || !passwordForm.current || !passwordForm.new}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </div>

            <div className="border-t border-wl-border-default pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-white mb-1">
                    Two-Factor Authentication
                  </h4>
                  <p className="text-wl-text-muted text-sm">
                    {twoFAEnabled
                      ? "Your account is protected with 2FA"
                      : "Add an extra layer of security to your account"}
                  </p>
                </div>
                <button
                  onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                  className={cn(
                    "w-12 h-7 rounded-full border-none cursor-pointer transition-colors",
                    twoFAEnabled ? "bg-emerald-500" : "bg-[#1e1e2e]"
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
            <div className="flex items-center justify-between p-4 bg-wl-bg-overlay rounded border border-wl-border-default">
              <div className="flex items-center gap-4">
                <Smartphone size={20} className="text-blue-400 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white">Current session</p>
                    <Badge variant="success" className="text-xs">Active</Badge>
                  </div>
                  <p className="text-xs text-wl-text-muted">Signed in as {profile.email || '—'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle size={20} className={cn('text-red-500')} />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-wl-text-muted text-sm mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-red-500/30 text-red-400 rounded text-sm font-medium cursor-pointer hover:bg-red-500/10 transition-colors"
              >
                Request Account Deletion
              </button>
            )}
            {showDeleteConfirm && (
              <div className="p-4 bg-wl-bg-overlay rounded border border-red-500/30">
                <p className="text-white text-sm mb-4">
                  Send a deletion request to support@witylogix.com? We&apos;ll follow up within 24 hours.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-[#1e1e2e] text-wl-text-secondary rounded text-sm font-medium cursor-pointer hover:bg-wl-bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <a
                    href="mailto:support@witylogix.com?subject=Account%20Deletion%20Request"
                    className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    Send Email
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
