'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Upload,
  Check,
  X,
  Lock,
  Shield,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string;
}

interface MFAStatus {
  enabled: boolean;
  qrCode?: string;
  backupCodes?: string[];
}

export default function ProfilePage() {
  const { data: profile, loading, error, refetch } = useApiQuery<UserProfile>('/api/v4/users/profile');
  const { data: mfaStatus } = useApiQuery<MFAStatus>('/api/v4/users/mfa');
  const { execute: updateProfile } = useApiMutation('PATCH', '/api/v4/users/profile');
  const { execute: changePassword } = useApiMutation('POST', '/api/v4/users/change-password');
  const { execute: setupMFA } = useApiMutation('POST', '/api/v4/users/mfa/setup');

  const [profileData, setProfileData] = useState(profile || {
    name: '',
    email: '',
    phone: '',
    avatar: '',
  });

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [mfaEnabled, setMfaEnabled] = useState(mfaStatus?.enabled ?? false);
  const [mfaSetup, setMfaSetup] = useState(false);
  const [qrCode, setQrCode] = useState(mfaStatus?.qrCode ?? '');
  const [backupCodes, setBackupCodes] = useState(mfaStatus?.backupCodes ?? []);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfile({ ...profile, avatar: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 25;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword({ ...password, new: value });
    calculatePasswordStrength(value);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile(profileData);
      refetch();
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      await changePassword({
        currentPassword: password.current,
        newPassword: password.new,
      });
      setPassword({ current: '', new: '', confirm: '' });
    } catch (err) {
      console.error('Failed to change password:', err);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 25) return "bg-[var(--wl-danger)]";
    if (passwordStrength < 50) return "bg-[var(--wl-warning)]";
    if (passwordStrength < 75) return "bg-[var(--wl-info)]";
    return "bg-[var(--wl-success)]";
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Profile Settings"
        subtitle="Manage your personal information and security"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Avatar and Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-3">
                  Avatar
                </label>
                <div className="flex items-center gap-6">
                  <img
                    src={profileData.avatar}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full border-2 border-[var(--wl-border)] object-cover"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" asChild>
                      <label className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setProfileData({ ...profileData, avatar: event.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Email Address (Read-only)
                </label>
                <Input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="bg-[var(--wl-bg-secondary)]"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="primary" onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary">Cancel</Button>
            </CardFooter>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password regularly for security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={password.current}
                  onChange={(e) => setPassword({ ...password, current: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password.new}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.new && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="text-[var(--wl-text-secondary)]">Strength:</span>
                      <div className="flex-1 h-2 bg-[var(--wl-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", getStrengthColor())}
                          style={{ width: `${passwordStrength}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="primary" disabled={!password.current || !password.new || password.new !== password.confirm}>
                Update Password
              </Button>
              <Button variant="secondary">Cancel</Button>
            </CardFooter>
          </Card>

          {/* MFA Setup */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </div>
                {mfaEnabled && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-[var(--wl-success)]/10 text-[var(--wl-success)] text-xs font-semibold rounded-full">
                    <Check className="w-3 h-3" />
                    Enabled
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!mfaSetup ? (
                <div className="text-center py-8">
                  <p className="text-[var(--wl-text-secondary)] mb-4">
                    Set up two-factor authentication using an authenticator app
                  </p>
                  <Button variant="primary" onClick={() => setMfaSetup(true)}>
                    Enable MFA
                  </Button>
                </div>
              ) : (
                <>
                  <div className="text-center py-4">
                    <p className="text-sm text-[var(--wl-text-secondary)] mb-3">
                      Scan this QR code with your authenticator app
                    </p>
                    <img src={qrCode} alt="MFA QR Code" className="mx-auto border border-[var(--wl-border)] p-2 rounded" />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                      Enter verification code to confirm
                    </label>
                    <Input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="text-center font-mono text-lg tracking-widest"
                    />
                  </div>

                  <div className="bg-[var(--wl-bg-secondary)] p-4 rounded-lg border border-[var(--wl-border)]">
                    <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-3">
                      Backup Codes
                    </p>
                    <p className="text-xs text-[var(--wl-text-secondary)] mb-3">
                      Save these codes in a secure location. Use them if you lose access to your authenticator.
                    </p>
                    <div className="space-y-2">
                      {backupCodes.map((code, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-[var(--wl-bg-primary)] rounded font-mono text-sm"
                        >
                          <span>{code}</span>
                          <button className="text-[var(--wl-primary)] hover:text-[var(--wl-primary)]/80">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            {mfaSetup && (
              <CardFooter className="flex gap-3">
                <Button variant="primary" onClick={() => { setMfaEnabled(true); setMfaSetup(false); }}>
                  Confirm & Enable MFA
                </Button>
                <Button variant="secondary" onClick={() => setMfaSetup(false)}>
                  Cancel
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
