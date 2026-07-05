'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
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
  Save,
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

interface EditForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
}

interface PasswordForm {
  current: string;
  new: string;
  confirm: string;
}

export default function ProfilePage() {
  const { data: userProfile, loading, error, refetch } = useApiQuery<User>('/api/v4/users/me');
  const profileMutation = useApiMutation<User>('PATCH', '/api/v4/users/me');
  const passwordMutation = useApiMutation<void>('PATCH', `/api/v4/users/${userProfile?.id ?? ''}/password`);

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    timezone: 'America/New_York',
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current: '',
    new: '',
    confirm: '',
  });

  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setEditForm({
        firstName: userProfile.firstName ?? '',
        lastName: userProfile.lastName ?? '',
        email: userProfile.email ?? '',
        phone: userProfile.phone ?? '',
        timezone: userProfile.timezone ?? 'America/New_York',
      });
    }
  }, [userProfile]);

  const handleSaveProfile = useCallback(async () => {
    await profileMutation.execute(editForm);
    await refetch();
    setIsEditing(false);
  }, [editForm, profileMutation, refetch]);

  const handleCancelEdit = useCallback(() => {
    if (userProfile) {
      setEditForm({
        firstName: userProfile.firstName ?? '',
        lastName: userProfile.lastName ?? '',
        email: userProfile.email ?? '',
        phone: userProfile.phone ?? '',
        timezone: userProfile.timezone ?? 'America/New_York',
      });
    }
    setIsEditing(false);
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
    setPwError(null);
    setPwSuccess(false);
    await passwordMutation.execute({ password: passwordForm.new, currentPassword: passwordForm.current });
    setPwSuccess(true);
    setPasswordForm({ current: '', new: '', confirm: '' });
    setTimeout(() => setPwSuccess(false), 3000);
  }, [passwordForm, passwordMutation]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!userProfile) return <ErrorState message="User profile unavailable" onRetry={refetch} />;

  const profile = userProfile;

  const handleEditChange = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-wl-bg-primary min-h-screen">
      <Header title="Profile Settings" subtitle="Manage your account and security settings" />

      <main className="flex-1 p-6 max-w-4xl mx-auto">
        {/* Personal Information */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-wl-text-primary flex items-center justify-between">
              Personal Information
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-wl-primary-400 bg-wl-primary-500/10 px-3 py-1.5 rounded hover:bg-wl-primary-500/20 transition-colors"
                >
                  Edit
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => handleEditChange("firstName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500 transition-colors"
                  />
                ) : (
                  <p className="text-wl-text-primary">{profile.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => handleEditChange("lastName", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500 transition-colors"
                  />
                ) : (
                  <p className="text-wl-text-primary">{profile.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleEditChange("email", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500 transition-colors"
                  />
                ) : (
                  <p className="text-wl-text-primary">{profile.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => handleEditChange("phone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500 transition-colors"
                  />
                ) : (
                  <p className="text-wl-text-primary">{profile.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">Timezone</label>
                {isEditing ? (
                  <select
                    value={editForm.timezone}
                    onChange={(e) => handleEditChange("timezone", e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500 cursor-pointer transition-colors"
                  >
                    <option>America/New_York</option>
                    <option>America/Chicago</option>
                    <option>America/Denver</option>
                    <option>America/Los_Angeles</option>
                  </select>
                ) : (
                  <p className="text-wl-text-primary">{profile.timezone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">Role</label>
                <p className="text-wl-text-primary">{profile.role}</p>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4 border-t border-wl-border-default">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileMutation.loading}
                  className="flex items-center gap-2 px-4 py-2 bg-wl-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-wl-primary-600 disabled:opacity-50 transition-colors"
                >
                  {profileMutation.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {profileMutation.loading ? 'Saving…' : 'Save Changes'}
                </button>
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
            <CardTitle className="text-wl-text-primary flex items-center gap-2">
              <Shield size={20} />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Change Password */}
            <div>
              <h4 className="text-base font-semibold text-wl-text-primary mb-3">Change Password</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm pr-10 focus:outline-none focus:border-wl-primary-500 transition-colors"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary cursor-pointer hover:text-wl-text-secondary transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, new: e.target.value }))}
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm pr-10 focus:outline-none focus:border-wl-primary-500 transition-colors"
                    />
                    <button onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary cursor-pointer hover:text-wl-text-secondary transition-colors">
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                      className="w-full px-3 py-2 bg-wl-bg-overlay border border-wl-border-default rounded text-wl-text-primary text-sm pr-10 focus:outline-none focus:border-wl-primary-500 transition-colors"
                    />
                    <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary cursor-pointer hover:text-wl-text-secondary transition-colors">
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {pwError && <p className="mt-2 text-xs text-wl-danger-400">{pwError}</p>}
              {pwSuccess && <p className="mt-2 text-xs text-wl-success-400">Password updated successfully.</p>}

              <button
                onClick={handleChangePassword}
                disabled={passwordMutation.loading}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-wl-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-wl-primary-600 disabled:opacity-50 transition-colors"
              >
                {passwordMutation.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Password
              </button>
            </div>

            <div className="border-t border-wl-border-default pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-wl-text-primary mb-1">Two-Factor Authentication</h4>
                  <p className="text-wl-text-secondary text-sm">
                    {twoFAEnabled
                      ? "Your account is protected with 2FA"
                      : "Add an extra layer of security to your account"}
                  </p>
                </div>
                <button
                  onClick={() => setTwoFAEnabled(!twoFAEnabled)}
                  className={cn(
                    "w-12 h-7 rounded-full border-none cursor-pointer transition-colors",
                    twoFAEnabled ? "bg-wl-success-400" : "bg-wl-bg-elevated"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <CardTitle className="text-wl-text-primary flex items-center gap-2">
              <Globe size={20} />
              Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-wl-bg-overlay rounded border border-wl-border-default">
              <div className="flex items-center gap-4">
                <Smartphone size={20} className="text-wl-primary-400 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-wl-text-primary">Current session</p>
                    <Badge variant="success" className="text-xs">Active</Badge>
                  </div>
                  <p className="text-xs text-wl-text-secondary">Signed in as {profile.email || '—'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-wl-text-primary flex items-center gap-2">
              <AlertTriangle size={20} className="text-wl-danger-400" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-wl-text-secondary text-sm mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-wl-danger-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-wl-danger-600 transition-colors"
              >
                Delete Account
              </button>
            )}
            {showDeleteConfirm && (
              <div className="p-4 bg-wl-bg-overlay rounded border border-wl-danger-500/30">
                <p className="text-wl-text-primary text-sm mb-4">
                  Are you absolutely sure? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-wl-bg-elevated text-wl-text-secondary rounded text-sm font-medium cursor-pointer hover:bg-wl-bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-wl-danger-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-wl-danger-600 transition-colors">
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
