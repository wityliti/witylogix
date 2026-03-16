"use client";

import { useState } from "react";
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
import {
  Upload,
  AlertTriangle,
  Trash2,
} from "lucide-react";

export default function OrganizationPage() {
  const [org, setOrg] = useState({
    name: "Witylogix Inc.",
    logo: "https://api.dicebear.com/7.x/icons/svg?seed=witylogix",
    website: "https://witylogix.com",
    industry: "Logistics & Delivery",
    companySize: "50-100",
  });

  const [billing, setBilling] = useState({
    plan: "Pro",
    monthlyPrice: 299,
    cycleStart: "2025-03-15",
    nextBilling: "2025-04-15",
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOrg({ ...org, logo: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const usageStats = [
    { label: "Orders/Month", current: 8450, limit: 10000, color: "bg-[var(--wl-primary)]" },
    { label: "Active Drivers", current: 45, limit: 100, color: "bg-[var(--wl-success)]" },
    { label: "API Calls/Month", current: 2800000, limit: 5000000, color: "bg-[var(--wl-warning)]" },
  ];

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Organization Settings"
        subtitle="Manage your organization profile and billing"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Organization Details */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Update your organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-3">
                  Organization Logo
                </label>
                <div className="flex items-center gap-6">
                  <img
                    src={org.logo}
                    alt="Logo"
                    className="w-20 h-20 rounded-lg border border-[var(--wl-border)] object-cover"
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
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Organization Name
                </label>
                <Input
                  type="text"
                  value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value })}
                  placeholder="Organization name"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                  Website
                </label>
                <Input
                  type="url"
                  value={org.website}
                  onChange={(e) => setOrg({ ...org, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                    Industry
                  </label>
                  <select
                    value={org.industry}
                    onChange={(e) => setOrg({ ...org, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
                  >
                    <option value="Logistics & Delivery">Logistics & Delivery</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Retail">Retail</option>
                    <option value="Manufacturing">Manufacturing</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                    Company Size
                  </label>
                  <select
                    value={org.companySize}
                    onChange={(e) => setOrg({ ...org, companySize: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
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
          <Card className="border-l-4 border-l-[var(--wl-primary)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Manage your billing and subscription</CardDescription>
                </div>
                <Badge variant="primary">{billing.plan} Plan</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                    Monthly Cost
                  </p>
                  <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                    ${billing.monthlyPrice}
                  </p>
                </div>
                <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                    Cycle Start
                  </p>
                  <p className="text-lg font-semibold text-[var(--wl-text-primary)]">
                    {billing.cycleStart}
                  </p>
                </div>
                <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
                  <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                    Next Billing
                  </p>
                  <p className="text-lg font-semibold text-[var(--wl-text-primary)]">
                    {billing.nextBilling}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[var(--wl-text-primary)] mb-4">
                  Usage Statistics
                </h4>
                <div className="space-y-4">
                  {usageStats.map((stat, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-[var(--wl-text-primary)]">{stat.label}</span>
                        <span className="text-xs text-[var(--wl-text-secondary)]">
                          {stat.current.toLocaleString()} / {stat.limit.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-[var(--wl-bg-primary)] rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full transition-all", stat.color)}
                          style={{ width: `${Math.min((stat.current / stat.limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="primary">Upgrade Plan</Button>
            </CardFooter>
          </Card>

          {/* Danger Zone */}
          <Card className="border-[var(--wl-danger)]">
            <CardHeader>
              <CardTitle className="text-[var(--wl-danger)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-[var(--wl-danger)]/5 border border-[var(--wl-danger)]/30 rounded-lg">
                <h4 className="font-semibold text-[var(--wl-text-primary)] mb-2">
                  Delete Organization
                </h4>
                <p className="text-sm text-[var(--wl-text-secondary)] mb-3">
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
                <div className="p-4 bg-[var(--wl-danger)]/10 border border-[var(--wl-danger)]/50 rounded-lg">
                  <p className="text-sm font-semibold text-[var(--wl-text-primary)] mb-3">
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
