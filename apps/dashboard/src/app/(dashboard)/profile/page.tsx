'use client';

import { useState, useEffect } from 'react';
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
  Save,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt?: string;
  shop?: { id: string; name: string; shopifyDomain: string } | null;
}

export default function ProfilePage() {
  const { data: user, loading, error, refetch } = useApiQuery<UserMe>('/api/v4/users/me');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const profileMutation = useApiMutation<{ data: UserMe }>('PATCH', '/api/v4/users/me');

  // Hydrate edit form when user loads
  useEffect(() => {
    if (!user) return;
    setEditName(user.name ?? '');
    setEditEmail(user.email ?? '');
  }, [user]);

  // Password change mutation — endpoint is PATCH /api/v4/users/:id/password
  const [pwLoading, setPwLoading] = useState(false);

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
    setEditName(user.name ?? '');
    setEditEmail(user.email ?? '');
    setIsEditing(false);
  };

  return (
    <div className="bg-wl-bg-primary min-h-screen">
      <Header title="Profile Settings" subtitle="Manage your account and security settings" />

      <main className="flex-1 p-6 max-w-4xl mx-auto">
        {/* Success banner */}
        {saveSuccess && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Profile updated successfully
          </div>
        )}

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
            {profileMutation.error && (
              <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {profileMutation.error.message}
              </div>
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
                  <p className="text-white">{user.name || '—'}</p>
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
                <p className="text-white">{user.role}</p>
              </div>

              {user.shop && (
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                    Shop
                  </label>
                  <p className="text-white">{user.shop.name}</p>
                </div>
              )}

              {user.lastLogin && (
                <div>
                  <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                    Last Login
                  </label>
                  <p className="text-white text-sm">
                    {new Date(user.lastLogin).toLocaleString()}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Account Status
                </label>
                <Badge variant={user.isActive ? 'success' : 'default'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
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
            {/* Change Password */}
            <div>
              <h4 className="text-base font-semibold text-white mb-3">
                Change Password
              </h4>
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
                    twoFAEnabled ? "bg-emerald-500" : "bg-wl-bg-elevated"
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-secondary mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPwConfirm ? 'text' : 'password'}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    required
                    minLength={8}
                    className={cn(
                      "w-full px-3 py-2 bg-wl-bg-overlay border rounded text-white text-sm pr-10 placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors",
                      pwConfirm && pwNew !== pwConfirm
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                        : "border-wl-border-default focus:border-blue-500 focus:ring-blue-500/30"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm(!showPwConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-wl-text-secondary transition-colors"
                  >
                    {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwConfirm && pwNew !== pwConfirm && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
                className="flex items-center gap-2"
              >
                {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {pwLoading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
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
              <AlertTriangle size={20} className="text-red-500" />
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
                className="px-4 py-2 bg-red-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
              >
                Request Account Deletion
              </button>
            )}
            {showDeleteConfirm && (
              <div className="p-4 bg-wl-bg-overlay rounded border border-red-500/30">
                <p className="text-white text-sm mb-4">
                  To delete your account, contact{' '}
                  <span className="text-blue-400">support@witylogix.com</span>.
                  Provide your email ({user.email}) for verification.
                </p>
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
