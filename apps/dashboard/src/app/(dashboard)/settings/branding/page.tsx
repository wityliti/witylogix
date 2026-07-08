"use client";

import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  RotateCcw,
  Eye,
  Paintbrush,
  Globe,
} from "lucide-react";

interface BrandingSettings {
  primaryLogo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  [key: string]: unknown;
}

export default function BrandingPage() {
  const {
    data: branding,
    loading,
    error,
    refetch,
  } = useApiQuery<BrandingSettings>("/api/v4/settings/branding");
  const { execute: updateBranding } = useApiMutation(
    "PATCH",
    "/api/v4/settings/branding",
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Branding"
        subtitle="Customize your brand colors, logo, and communication templates"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Logo Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Upload className="w-5 h-5" />
              Logo Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Upload */}
              <div>
                <h4 className="font-medium text-white mb-4">Primary Logo</h4>
                <div className="border-2 border-dashed border-wl-border-default rounded-lg p-8 text-center hover:border-blue-500/50 transition-colors cursor-pointer">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-wl-bg-elevated flex items-center justify-center">
                      <img
                        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%234f46e5' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='48' fill='white' text-anchor='middle' dy='.3em' font-weight='bold'%3EWL%3C/text%3E%3C/svg%3E"
                        alt="Current Logo"
                        className="w-16 h-16"
                      />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white mb-2">
                    Drag and drop your logo
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    PNG, SVG, or JPG (up to 5MB)
                  </p>
                  <Button
                    variant="secondary"
                    className="border-wl-border-default text-white hover:bg-wl-bg-elevated"
                  >
                    Choose File
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Uploaded: 2026-02-15
                </p>
              </div>

              {/* Favicon Upload */}
              <div>
                <h4 className="font-medium text-white mb-4">Favicon</h4>
                <div className="border-2 border-dashed border-wl-border-default rounded-lg p-8 text-center hover:border-blue-500/50 transition-colors cursor-pointer">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-wl-bg-elevated flex items-center justify-center">
                      <div className="w-8 h-8 rounded bg-blue-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white mb-2">
                    Upload your favicon
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    ICO or PNG (32x32)
                  </p>
                  <Button
                    variant="secondary"
                    className="border-wl-border-default text-white hover:bg-wl-bg-elevated"
                  >
                    Choose File
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-3">Not uploaded yet</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Scheme */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Paintbrush className="w-5 h-5" />
              Color Scheme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-[var(--wl-primary)] border border-[var(--wl-border)] cursor-pointer hover:shadow-lg transition-shadow" />
                  <div className="flex-1">
                    <input
                      type="text"
                      defaultValue="#4f46e5"
                      className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Secondary Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-violet-400 border border-[var(--wl-border)] cursor-pointer hover:shadow-lg transition-shadow" />
                  <div className="flex-1">
                    <input
                      type="text"
                      defaultValue="#a78bfa"
                      className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-amber-500 border border-[var(--wl-border)] cursor-pointer hover:shadow-lg transition-shadow" />
                  <div className="flex-1">
                    <input
                      type="text"
                      defaultValue="#f59e0b"
                      className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Success Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-emerald-500 border border-[var(--wl-border)] cursor-pointer hover:shadow-lg transition-shadow" />
                  <div className="flex-1">
                    <input
                      type="text"
                      defaultValue="#10b981"
                      className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-wl-bg-elevated p-4 rounded-lg">
              <Button variant="secondary" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Page Branding */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Eye className="w-5 h-5" />
              Tracking Page Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Page Title
              </label>
              <input
                type="text"
                defaultValue="Track Your Shipment - Witylogix"
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Page Description
              </label>
              <textarea
                rows={3}
                defaultValue="Enter your tracking number to see real-time updates about your shipment."
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Custom Footer Text
              </label>
              <input
                type="text"
                defaultValue="© 2026 Witylogix Inc. All rights reserved."
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Show Logo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-[var(--wl-border)]"
                />
                <span className="text-sm text-[var(--wl-text-secondary)]">
                  Display company logo on tracking page
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Template Branding */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">
              Email Template Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Email Header
              </label>
              <input
                type="text"
                defaultValue="Real-time Shipment Updates"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Email Footer
              </label>
              <textarea
                rows={2}
                defaultValue="This is an automated notification from Witylogix. Please do not reply to this email."
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Include Company Logo in Emails
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-[var(--wl-border)]"
                />
                <span className="text-sm text-[var(--wl-text-secondary)]">
                  Include logo in email header
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Domain */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Globe className="w-5 h-5" />
              Custom Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--wl-text-primary)] mb-2">
                Custom Domain for Tracking
              </label>
              <input
                type="text"
                placeholder="track.yourcompany.com"
                className="w-full px-4 py-2 rounded-lg border border-[var(--wl-border)] bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]"
              />
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Configure DNS records to point to your custom domain
              </p>
            </div>

            <div className="bg-wl-bg-elevated p-4 rounded-lg">
              <p className="text-sm font-medium text-white mb-2">
                DNS Configuration
              </p>
              <code className="text-xs text-gray-400 block bg-wl-bg-root p-2 rounded border border-wl-border-default font-mono">
                track.witylogix.com.wl-cdn.com
              </code>
              <p className="text-xs text-gray-500 mt-2">
                CNAME record required for custom domain
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="secondary"
            className="border-wl-border-default text-white hover:bg-wl-bg-elevated"
          >
            Preview
          </Button>
          <Button variant="primary" className="bg-blue-500 hover:bg-blue-600">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
