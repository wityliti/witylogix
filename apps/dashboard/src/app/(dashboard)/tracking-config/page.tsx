"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import {
  MapPin,
  Eye,
  Clock,
  Star,
  Settings,
  Copy,
  Check,
  Palette,
  Save,
  Loader2,
} from "lucide-react";

interface TrackingConfig {
  liveMap: boolean;
  etaDisplay: boolean;
  ratingWidget: boolean;
  deliveryPreferences: boolean;
  customDomain: string;
  metaTitle: string;
  metaDescription: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
}

interface ShopData {
  id: string;
  name: string;
  shopifyDomain: string;
  settings: Record<string, unknown>;
}

const DEFAULT_CONFIG: TrackingConfig = {
  liveMap: true,
  etaDisplay: true,
  ratingWidget: true,
  deliveryPreferences: true,
  customDomain: "",
  metaTitle: "Track Your Delivery",
  metaDescription: "Real-time order tracking with live map",
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
  logoUrl: "",
};

export default function TrackingConfigPage() {
  const { data: shop, loading, error } = useApiQuery<ShopData>("/api/v4/shops/me");
  const saveMutation = useApiMutation<{ data: ShopData }>("PATCH", "/api/v4/shops/me");

  const [config, setConfig] = useState<TrackingConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Hydrate config from shop settings once loaded
  useEffect(() => {
    if (!shop) return;
    const stored = (shop.settings as any)?.trackingConfig ?? {};
    setConfig({ ...DEFAULT_CONFIG, ...stored });
  }, [shop]);

  const update = <K extends keyof TrackingConfig>(key: K, value: TrackingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.execute({
        settings: {
          ...(shop?.settings ?? {}),
          trackingConfig: config,
        },
      });
      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // error surfaced via saveMutation.error
    }
  };

  const handleDiscard = () => {
    if (!shop) return;
    const stored = (shop.settings as any)?.trackingConfig ?? {};
    setConfig({ ...DEFAULT_CONFIG, ...stored });
    setIsDirty(false);
  };

  const handleCopyDomain = () => {
    if (!config.customDomain) return;
    navigator.clipboard.writeText(config.customDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingPageUrl = config.customDomain
    ? `https://${config.customDomain}/track/order-123`
    : `https://${shop?.shopifyDomain ?? "yourshop.com"}/pages/track`;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  const featureToggles = [
    { key: "liveMap" as const, icon: MapPin, label: "Live Map", desc: "Show real-time driver location on the tracking page" },
    { key: "etaDisplay" as const, icon: Clock, label: "ETA Display", desc: "Show estimated time of arrival" },
    { key: "ratingWidget" as const, icon: Star, label: "Rating Widget", desc: "Allow customers to rate their delivery" },
    { key: "deliveryPreferences" as const, icon: Settings, label: "Delivery Preferences", desc: "Let customers set delivery notes and preferences" },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-root">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary">Tracking Page Configuration</h1>
            <p className="text-wl-text-secondary text-sm mt-0.5">Customize your branded tracking page for customers</p>
          </div>
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={handleDiscard}>Discard</Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                disabled={saveMutation.loading}
                className="flex items-center gap-2"
              >
                {saveMutation.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveSuccess ? "Saved" : "Save Configuration"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {saveMutation.error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="px-4 py-3 rounded-lg bg-wl-danger-500/10 border border-wl-danger-500/30 text-sm text-wl-danger-400">
            Failed to save: {saveMutation.error.message}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Settings */}
          <div className="flex flex-col gap-6">
            {/* Feature Toggles */}
            <Card className="bg-wl-bg-surface border border-wl-border-default p-6">
              <h3 className="text-lg font-semibold text-wl-text-primary mb-1">Page Features</h3>
              <p className="text-wl-text-secondary text-xs mb-4">Enable or disable tracking page features</p>
              <div className="space-y-3">
                {featureToggles.map((feature) => {
                  const Icon = feature.icon;
                  const enabled = config[feature.key] as boolean;
                  return (
                    <div
                      key={feature.key}
                      className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default hover:border-wl-info-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-wl-info-500 shrink-0" />
                        <div>
                          <p className="text-white text-sm font-medium">{feature.label}</p>
                          <p className="text-wl-text-secondary text-xs">{feature.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => update(feature.key, !enabled)}
                        aria-pressed={enabled}
                        aria-label={`Toggle ${feature.label}`}
                        className={cn(
                          "relative w-12 h-7 rounded-full border-none cursor-pointer transition-colors shrink-0",
                          enabled ? "bg-wl-info-500" : "bg-wl-bg-overlay"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-1 w-5 h-5 rounded-full bg-white transition-transform",
                            enabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Custom Domain */}
            <Card className="bg-wl-bg-surface border border-wl-border-default p-6">
              <h3 className="text-lg font-semibold text-wl-text-primary mb-1">Custom Domain</h3>
              <p className="text-wl-text-secondary text-xs mb-4">Your branded tracking page domain</p>
              <div className="flex gap-2 items-center mb-3">
                <input
                  type="text"
                  value={config.customDomain}
                  onChange={(e) => update("customDomain", e.target.value)}
                  placeholder="track.yourshop.com"
                  className="flex-1 px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm font-mono focus:outline-none focus:border-wl-info-500/50"
                />
                <Button
                  onClick={handleCopyDomain}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1.5"
                  disabled={!config.customDomain}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-wl-text-tertiary text-xs">Configure a CNAME DNS record pointing to <code className="text-wl-info-400">tracking.witylogix.com</code></p>
            </Card>

            {/* SEO Settings */}
            <Card className="bg-wl-bg-surface border border-wl-border-default p-6">
              <h3 className="text-lg font-semibold text-wl-text-primary mb-1">SEO Configuration</h3>
              <p className="text-wl-text-secondary text-xs mb-4">Meta tags shown in search results</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-wl-neutral-300 text-xs font-medium mb-2">Meta Title</label>
                  <input
                    type="text"
                    value={config.metaTitle}
                    onChange={(e) => update("metaTitle", e.target.value)}
                    maxLength={60}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs focus:outline-none focus:border-wl-info-500/50"
                  />
                  <p className={cn("text-xs mt-1", config.metaTitle.length > 55 ? "text-wl-warning-400" : "text-wl-text-tertiary")}>
                    {config.metaTitle.length}/60 characters
                  </p>
                </div>
                <div>
                  <label className="block text-wl-neutral-300 text-xs font-medium mb-2">Meta Description</label>
                  <textarea
                    value={config.metaDescription}
                    onChange={(e) => update("metaDescription", e.target.value)}
                    maxLength={160}
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs focus:outline-none focus:border-wl-info-500/50 resize-none"
                    rows={3}
                  />
                  <p className={cn("text-xs mt-1", config.metaDescription.length > 150 ? "text-wl-warning-400" : "text-wl-text-tertiary")}>
                    {config.metaDescription.length}/160 characters
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Preview & Branding */}
          <div className="flex flex-col gap-6">
            {/* Tracking Page Preview */}
            <Card className="bg-wl-bg-surface border border-wl-border-default p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye size={18} className="text-wl-info-500" />
                <h3 className="text-lg font-semibold text-wl-text-primary">Page Preview</h3>
              </div>

              {/* Mini preview */}
              <div
                className="rounded-lg border border-wl-border-default p-4 space-y-3 bg-wl-bg-root"
              >
                {config.logoUrl && (
                  <div className="pb-3 border-b border-white/10">
                    <img src={config.logoUrl} alt="Logo" className="h-7 object-contain" />
                  </div>
                )}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <p className="text-wl-text-secondary text-xs">Preview URL:</p>
                  <code className="text-wl-info-400 text-xs font-mono truncate max-w-[180px]">{trackingPageUrl}</code>
                </div>
                <div className="space-y-2">
                  <p className="text-white text-sm font-semibold">Order #12345</p>
                  <Badge variant="primary">In Transit</Badge>
                  {config.liveMap && (
                    <div className="p-3 rounded text-xs border border-white/10 bg-white/5 flex items-center gap-2">
                      <MapPin size={14} style={{ color: config.primaryColor }} />
                      <span className="text-wl-neutral-300">Live map enabled</span>
                    </div>
                  )}
                  {config.etaDisplay && (
                    <div className="flex items-center gap-2 p-2 rounded text-xs border border-white/10 bg-white/5">
                      <Clock size={14} style={{ color: config.primaryColor }} />
                      <span className="text-wl-neutral-300">Arrives today by 6:30 PM</span>
                    </div>
                  )}
                  {config.ratingWidget && (
                    <div className="p-2 rounded text-xs border border-white/10 bg-white/5">
                      <p className="text-wl-text-secondary mb-1">Rate your delivery</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={14} style={{ color: config.primaryColor }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active features summary */}
              <div className="flex flex-wrap gap-2 mt-3">
                {featureToggles.filter((f) => config[f.key]).map((f) => (
                  <Badge key={f.key} variant="success" className="text-xs">{f.label}</Badge>
                ))}
                {featureToggles.filter((f) => !config[f.key]).map((f) => (
                  <Badge key={f.key} variant="default" className="text-xs opacity-50">{f.label}</Badge>
                ))}
              </div>
            </Card>

            {/* Branding Configuration */}
            <Card className="bg-wl-bg-surface border border-wl-border-default p-6">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={18} className="text-wl-info-500" />
                <h3 className="text-lg font-semibold text-wl-text-primary">Branding</h3>
              </div>
              <p className="text-wl-text-secondary text-xs mb-4">Customize colors and logo for the tracking page</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-wl-neutral-300 text-xs font-medium mb-2">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => update("primaryColor", e.target.value)}
                      className="w-10 h-10 rounded border border-wl-border-default cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => update("primaryColor", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-neutral-300 text-xs font-mono focus:outline-none focus:border-wl-info-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-wl-neutral-300 text-xs font-medium mb-2">Secondary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => update("secondaryColor", e.target.value)}
                      className="w-10 h-10 rounded border border-wl-border-default cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={config.secondaryColor}
                      onChange={(e) => update("secondaryColor", e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-neutral-300 text-xs font-mono focus:outline-none focus:border-wl-info-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-wl-neutral-300 text-xs font-medium mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={config.logoUrl}
                    onChange={(e) => update("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-neutral-300 text-xs focus:outline-none focus:border-wl-info-500/50"
                  />
                  <p className="text-wl-text-tertiary text-xs mt-1">Recommended: 200×50px PNG or SVG</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Save Button (bottom) */}
        <div className="flex gap-3 justify-end mt-4 pb-8">
          <Button variant="secondary" onClick={handleDiscard} disabled={!isDirty || saveMutation.loading}>
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || saveMutation.loading}
            className="flex items-center gap-2"
          >
            {saveMutation.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveSuccess ? "Configuration saved!" : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
