'use client';

import { useState, useEffect } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Upload, RotateCcw, Eye, Paintbrush, Globe, Save, RefreshCw } from 'lucide-react';

interface BrandingSettings {
  primaryLogo?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  successColor?: string;
  trackingPage?: {
    title?: string;
    description?: string;
    footerText?: string;
    showLogo?: boolean;
  };
  emailTemplate?: {
    header?: string;
    footer?: string;
    includeLogo?: boolean;
  };
  customDomain?: string;
}

export default function BrandingPage() {
  const { data: branding, loading, error, refetch } = useApiQuery<BrandingSettings>('/api/v4/settings/branding');
  const { execute: updateBranding, loading: saving } = useApiMutation('PATCH', '/api/v4/settings/branding');

  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#a78bfa');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [successColor, setSuccessColor] = useState('#10b981');
  const [trackingTitle, setTrackingTitle] = useState('');
  const [trackingDescription, setTrackingDescription] = useState('');
  const [trackingFooter, setTrackingFooter] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [emailHeader, setEmailHeader] = useState('');
  const [emailFooter, setEmailFooter] = useState('');
  const [includeLogoInEmails, setIncludeLogoInEmails] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (branding) {
      setPrimaryColor(branding.primaryColor ?? '#4f46e5');
      setSecondaryColor(branding.secondaryColor ?? '#a78bfa');
      setAccentColor(branding.accentColor ?? '#f59e0b');
      setSuccessColor(branding.successColor ?? '#10b981');
      setTrackingTitle(branding.trackingPage?.title ?? '');
      setTrackingDescription(branding.trackingPage?.description ?? '');
      setTrackingFooter(branding.trackingPage?.footerText ?? '');
      setShowLogo(branding.trackingPage?.showLogo ?? true);
      setEmailHeader(branding.emailTemplate?.header ?? '');
      setEmailFooter(branding.emailTemplate?.footer ?? '');
      setIncludeLogoInEmails(branding.emailTemplate?.includeLogo ?? true);
      setCustomDomain(branding.customDomain ?? '');
    }
  }, [branding]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  async function handleSave() {
    setSaveError(null);
    setSaved(false);
    try {
      await updateBranding({
        primaryColor,
        secondaryColor,
        accentColor,
        successColor,
        trackingPage: { title: trackingTitle, description: trackingDescription, footerText: trackingFooter, showLogo },
        emailTemplate: { header: emailHeader, footer: emailFooter, includeLogo: includeLogoInEmails },
        customDomain: customDomain || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refetch();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save branding settings');
    }
  }

  const resetColors = () => {
    setPrimaryColor('#4f46e5');
    setSecondaryColor('#a78bfa');
    setAccentColor('#f59e0b');
    setSuccessColor('#10b981');
  };

  const colorFields = [
    { label: 'Primary Color', value: primaryColor, onChange: setPrimaryColor, previewClass: 'bg-[var(--wl-primary)]' },
    { label: 'Secondary Color', value: secondaryColor, onChange: setSecondaryColor, previewClass: 'bg-violet-400' },
    { label: 'Accent Color', value: accentColor, onChange: setAccentColor, previewClass: 'bg-wl-warning-500' },
    { label: 'Success Color', value: successColor, onChange: setSuccessColor, previewClass: 'bg-wl-success-500' },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Branding"
        subtitle="Customize your brand colors, logo, and communication templates"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button variant="ghost" className="mb-8 text-wl-text-secondary hover:text-wl-text-primary">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Logo Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Upload className="w-5 h-5" />
              Logo Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Upload */}
              <div>
                <h4 className="font-medium text-wl-text-primary mb-4">Primary Logo</h4>
                <div className="border-2 border-dashed border-wl-border-default rounded-lg p-8 text-center hover:border-wl-info-500/50 transition-colors cursor-pointer">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-wl-bg-elevated flex items-center justify-center overflow-hidden">
                      {branding?.primaryLogo ? (
                        <img src={branding.primaryLogo} alt="Current Logo" className="w-16 h-16 object-contain" />
                      ) : (
                        <span className="text-wl-text-tertiary text-xs text-center px-1">No logo</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-wl-text-primary mb-2">Drag and drop your logo</p>
                  <p className="text-xs text-wl-text-tertiary mb-4">PNG, SVG, or JPG (up to 5MB)</p>
                  <Button variant="secondary" className="border-wl-border-default text-wl-text-primary hover:bg-wl-bg-elevated">
                    Choose File
                  </Button>
                </div>
              </div>

              {/* Favicon Upload */}
              <div>
                <h4 className="font-medium text-wl-text-primary mb-4">Favicon</h4>
                <div className="border-2 border-dashed border-wl-border-default rounded-lg p-8 text-center hover:border-wl-info-500/50 transition-colors cursor-pointer">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-wl-bg-elevated flex items-center justify-center overflow-hidden">
                      {branding?.favicon ? (
                        <img src={branding.favicon} alt="Favicon" className="w-8 h-8 object-contain" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-wl-info-500" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-wl-text-primary mb-2">Upload your favicon</p>
                  <p className="text-xs text-wl-text-tertiary mb-4">ICO or PNG (32x32)</p>
                  <Button variant="secondary" className="border-wl-border-default text-wl-text-primary hover:bg-wl-bg-elevated">
                    Choose File
                  </Button>
                </div>
                <p className="text-xs text-wl-text-tertiary mt-3">
                  {branding?.favicon ? 'Favicon uploaded' : 'Not uploaded yet'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Scheme */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Paintbrush className="w-5 h-5" />
              Color Scheme
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {colorFields.map(({ label, value, onChange, previewClass }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-wl-text-primary mb-3">{label}</label>
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-lg border border-wl-border-default cursor-pointer hover:shadow-lg transition-shadow ${previewClass}`} />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-wl-bg-elevated p-4 rounded-lg">
              <Button variant="secondary" className="gap-2" onClick={resetColors}>
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Page Branding */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Eye className="w-5 h-5" />
              Tracking Page Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Page Title</label>
              <input
                type="text"
                value={trackingTitle}
                onChange={(e) => setTrackingTitle(e.target.value)}
                placeholder="Track Your Shipment"
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Page Description</label>
              <textarea
                rows={3}
                value={trackingDescription}
                onChange={(e) => setTrackingDescription(e.target.value)}
                placeholder="Enter your tracking number to see real-time updates about your shipment."
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Custom Footer Text</label>
              <input
                type="text"
                value={trackingFooter}
                onChange={(e) => setTrackingFooter(e.target.value)}
                placeholder="© 2026 Your Company. All rights reserved."
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Show Logo</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="w-4 h-4 rounded border-wl-border-default"
                />
                <span className="text-sm text-wl-text-secondary">Display company logo on tracking page</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Template Branding */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-wl-text-primary">Email Template Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Email Header</label>
              <input
                type="text"
                value={emailHeader}
                onChange={(e) => setEmailHeader(e.target.value)}
                placeholder="Real-time Shipment Updates"
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Email Footer</label>
              <textarea
                rows={2}
                value={emailFooter}
                onChange={(e) => setEmailFooter(e.target.value)}
                placeholder="This is an automated notification. Please do not reply to this email."
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Include Company Logo in Emails</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeLogoInEmails}
                  onChange={(e) => setIncludeLogoInEmails(e.target.checked)}
                  className="w-4 h-4 rounded border-wl-border-default"
                />
                <span className="text-sm text-wl-text-secondary">Include logo in email header</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Domain */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-text-primary">
              <Globe className="w-5 h-5" />
              Custom Domain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-wl-text-primary mb-2">Custom Domain for Tracking</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="track.yourcompany.com"
                className="w-full px-4 py-2 rounded-lg border border-wl-border-default bg-wl-bg-root text-wl-text-primary placeholder:text-wl-text-tertiary focus:outline-none focus:ring-2 focus:ring-wl-primary-500"
              />
              <p className="text-xs text-wl-text-tertiary mt-2">Configure DNS records to point to your custom domain</p>
            </div>

            {customDomain && (
              <div className="bg-wl-bg-elevated p-4 rounded-lg">
                <p className="text-sm font-medium text-wl-text-primary mb-2">DNS Configuration</p>
                <code className="text-xs text-wl-text-secondary block bg-wl-bg-root p-2 rounded border border-wl-border-default font-mono">
                  {customDomain}.wl-cdn.com
                </code>
                <p className="text-xs text-wl-text-tertiary mt-2">CNAME record required for custom domain</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {saveError && (
          <p className="text-wl-danger-400 text-sm mb-4">{saveError}</p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="secondary"
            className="border-wl-border-default text-wl-text-secondary hover:bg-wl-bg-elevated"
            onClick={() => refetch()}
            disabled={saving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="secondary"
            className="border-wl-border-default text-wl-text-primary hover:bg-wl-bg-elevated"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
