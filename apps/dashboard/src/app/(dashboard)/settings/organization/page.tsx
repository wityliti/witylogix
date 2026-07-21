'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Upload,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

interface Organization {
  name: string;
  logo: string;
  website: string;
  industry: string;
  companySize: string;
}

interface BillingInfo {
  plan: string;
  monthlyPrice: number;
  cycleStart: string;
  nextBilling: string;
  usageMetrics?: UsageMetric[];
}

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  unit: string;
}

export default function OrganizationPage() {
  const { addToast } = useToast();
  const { data: org, loading, error, refetch } = useApiQuery<Organization>('/api/v4/settings/organization');
  const { data: billing } = useApiQuery<BillingInfo>('/api/v4/billing');
  const { execute: updateOrg } = useApiMutation('PATCH', '/api/v4/settings/organization');

  const [orgData, setOrgData] = useState(org || {
    name: '',
    logo: '',
    website: '',
    industry: '',
    companySize: '',
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOrgData({ ...orgData, logo: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateOrg(orgData);
      refetch();
      addToast({ type: 'success', title: 'Organization saved' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to save organization', message: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const usageMetrics = billing?.usageMetrics ?? [];

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Organization Settings"
        subtitle="Manage your organization profile and billing"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Organization Details */}
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">Organization Details</CardTitle>
              <CardDescription className="text-wl-text-secondary">Update your organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-3">
                  Organization Logo
                </label>
                <div className="flex items-center gap-6">
                  <img
                    src={orgData.logo}
                    alt="Logo"
                    className="w-20 h-20 rounded-lg border border-wl-border-default object-cover"
                  />
                  <Button variant="secondary" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Organization Name
                </label>
                <Input
                  type="text"
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  placeholder="Organization name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                  Website
                </label>
                <Input
                  type="url"
                  value={orgData.website}
                  onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                    Industry
                  </label>
                  <select
                    value={orgData.industry}
                    onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-wl-bg-root text-wl-text-primary border border-wl-border-default rounded-md text-sm"
                  >
                    <option value="Logistics & Delivery">Logistics & Delivery</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Retail">Retail</option>
                    <option value="Manufacturing">Manufacturing</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-wl-text-primary block mb-2">
                    Company Size
                  </label>
                  <select
                    value={orgData.companySize}
                    onChange={(e) => setOrgData({ ...orgData, companySize: e.target.value })}
                    className="w-full px-3 py-2 bg-wl-bg-root text-wl-text-primary border border-wl-border-default rounded-md text-sm"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="10-50">10-50 employees</option>
                    <option value="50-100">50-100 employees</option>
                    <option value="100-500">100-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary">Cancel</Button>
            </CardFooter>
          </Card>

          {/* Billing Information */}
          <Card className="bg-wl-bg-surface border border-wl-border-default border-l-4 border-l-wl-info-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-wl-text-primary">Current Plan</CardTitle>
                  <CardDescription className="text-wl-text-secondary">Manage your billing and subscription</CardDescription>
                </div>
                <Badge variant="primary" className="bg-wl-info-500 text-white">{billing?.plan ?? 'Free'} Plan</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-wl-bg-elevated rounded-lg">
                  <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wide mb-1">
                    Monthly Cost
                  </p>
                  <p className="text-2xl font-bold text-wl-text-primary">
                    ${billing?.monthlyPrice ?? 0}
                  </p>
                </div>
                <div className="p-4 bg-wl-bg-elevated rounded-lg">
                  <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wide mb-1">
                    Cycle Start
                  </p>
                  <p className="text-lg font-semibold text-wl-text-primary">
                    {billing?.cycleStart ?? '—'}
                  </p>
                </div>
                <div className="p-4 bg-wl-bg-elevated rounded-lg">
                  <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wide mb-1">
                    Next Billing
                  </p>
                  <p className="text-lg font-semibold text-wl-text-primary">
                    {billing?.nextBilling ?? '—'}
                  </p>
                </div>
              </div>

              {usageMetrics.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-wl-text-primary mb-4">
                    Usage Statistics
                  </h4>
                  <div className="space-y-4">
                    {usageMetrics.map((metric) => {
                      const barColor =
                        metric.percentage >= 90 ? "bg-wl-danger-500"
                        : metric.percentage >= 70 ? "bg-wl-warning-500"
                        : "bg-wl-info-500";
                      return (
                        <div key={metric.name}>
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-sm text-wl-text-primary">{metric.name}</span>
                            <span className="text-xs text-wl-text-secondary">
                              {metric.current.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                            </span>
                          </div>
                          <div className="w-full bg-wl-bg-root rounded-full h-2">
                            <div
                              className={cn("h-2 rounded-full transition-all", barColor)}
                              style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="primary">Upgrade Plan</Button>
            </CardFooter>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-wl-bg-surface border border-wl-danger-500/30">
            <CardHeader>
              <CardTitle className="text-wl-danger-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-wl-danger-bg border border-wl-danger-500/30 rounded-lg">
                <h4 className="font-semibold text-wl-text-primary mb-2">
                  Delete Organization
                </h4>
                <p className="text-sm text-wl-text-secondary mb-3">
                  This will permanently delete your organization, all data, and cannot be undone.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Organization
                </Button>
              </div>

              {showDeleteConfirm && (
                <div className="p-4 bg-wl-danger-500/10 border border-wl-danger-500/50 rounded-lg">
                  <p className="text-sm font-semibold text-wl-text-primary mb-3">
                    Are you absolutely sure? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="danger" size="sm">
                      Yes, Delete Organization
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
