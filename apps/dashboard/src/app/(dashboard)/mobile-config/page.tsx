"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import {
  Smartphone,
  Palette,
  Zap,
  Bell,
  MapPin,
  Save,
  Upload,
  Copy,
  CheckCircle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   MOBILE CONFIG PAGE — Driver Mobile App Configuration
   ═══════════════════════════════════════════════════════════ */

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface NotificationSetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface ShopData {
  id: string;
  settings: Record<string, unknown> | null;
}

export default function MobileConfigPage() {
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { data: shopResp, loading: shopLoading, error: shopError, refetch: refetchShop } = useApiQuery<{ data: ShopData }>('/api/v4/shops/me');
  const saveMutation = useApiMutation<unknown>('PATCH', '/api/v4/shops/me');

  // Branding state
  const [appName, setAppName] = useState("Witylogix Driver");
  const [primaryColor, setPrimaryColor] = useState("#F5A623");
  const [logoUrl, setLogoUrl] = useState("/logo.png");

  // Feature toggles
  const [features, setFeatures] = useState<FeatureToggle[]>([
    {
      id: "photo-proof",
      name: "Photo Proof of Delivery",
      description: "Require drivers to capture delivery confirmation photos",
      enabled: true,
    },
    {
      id: "signature",
      name: "Signature Capture",
      description: "Collect customer signatures for proof of delivery",
      enabled: true,
    },
    {
      id: "barcode",
      name: "Barcode Scanning",
      description: "Enable package barcode scanning functionality",
      enabled: true,
    },
    {
      id: "chat",
      name: "Customer Chat",
      description: "Allow drivers to chat with customers",
      enabled: false,
    },
    {
      id: "cash",
      name: "Cash Collection",
      description: "Enable cash payment collection feature",
      enabled: true,
    },
  ]);

  // Route navigation options
  const [navigationMap, setNavigationMap] = useState("google-maps");

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSetting[]>([
    {
      id: "new-order",
      name: "New Order Assigned",
      description: "Notify when new orders are assigned to driver",
      enabled: true,
    },
    {
      id: "route-optimized",
      name: "Route Optimized",
      description: "Notify when delivery route is optimized",
      enabled: true,
    },
    {
      id: "customer-message",
      name: "Customer Message",
      description: "Notify when customers send messages",
      enabled: true,
    },
    {
      id: "window-approaching",
      name: "Delivery Window Approaching",
      description: "Notify when approaching delivery time window",
      enabled: true,
    },
    {
      id: "geofence",
      name: "Geofence Enter/Exit",
      description: "Notify on zone entry and exit events",
      enabled: false,
    },
  ]);

  // GPS settings
  const [trackingInterval, setTrackingInterval] = useState("30s");
  const [batteryMode, setBatteryMode] = useState("balanced");
  const [backgroundTracking, setBackgroundTracking] = useState(true);

  // Offline settings
  const [cacheSize, setCacheSize] = useState("100mb");
  const [syncInterval, setSyncInterval] = useState("5m");
  const [autoRetry, setAutoRetry] = useState(true);

  // Load saved config from shop settings
  useEffect(() => {
    const cfg = (shopResp?.data?.settings as any)?.mobileConfig;
    if (!cfg) return;
    if (cfg.appName) setAppName(cfg.appName);
    if (cfg.primaryColor) setPrimaryColor(cfg.primaryColor);
    if (cfg.logoUrl) setLogoUrl(cfg.logoUrl);
    if (cfg.features) setFeatures(cfg.features);
    if (cfg.navigationMap) setNavigationMap(cfg.navigationMap);
    if (cfg.notifications) setNotifications(cfg.notifications);
    if (cfg.trackingInterval) setTrackingInterval(cfg.trackingInterval);
    if (cfg.batteryMode) setBatteryMode(cfg.batteryMode);
    if (cfg.backgroundTracking !== undefined) setBackgroundTracking(cfg.backgroundTracking);
    if (cfg.cacheSize) setCacheSize(cfg.cacheSize);
    if (cfg.syncInterval) setSyncInterval(cfg.syncInterval);
    if (cfg.autoRetry !== undefined) setAutoRetry(cfg.autoRetry);
  }, [shopResp]);

  if (shopLoading) return <TableSkeleton rows={8} columns={2} />;
  if (shopError) return <ErrorState title="Failed to load mobile configuration" error={shopError} onRetry={refetchShop} />;

  // Toggle feature
  const toggleFeature = (featureId: string) => {
    setFeatures(
      features.map((f) =>
        f.id === featureId ? { ...f, enabled: !f.enabled } : f
      )
    );
  };

  // Toggle notification
  const toggleNotification = (notificationId: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === notificationId ? { ...n, enabled: !n.enabled } : n
      )
    );
  };

  // Handle save
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveMutation.execute({
        settings: {
          mobileConfig: {
            appName, primaryColor, logoUrl, features, navigationMap,
            notifications, trackingInterval, batteryMode, backgroundTracking,
            cacheSize, syncInterval, autoRetry,
          },
        },
      });
      addToast({
        type: 'success',
        title: 'Configuration saved',
        message: 'Mobile app configuration has been updated.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to save configuration',
        message: err instanceof Error ? err.message : 'Could not save configuration. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Mobile App Configuration"
        subtitle="Configure the driver mobile app settings and features"
        actions={
          <Button variant="primary" size="md" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        }
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* App Branding Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Palette className="w-5 h-5" />
              App Branding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  App Logo
                </label>
                <div
                  className="border-2 border-dashed border-wl-border-default rounded-lg p-8 text-center cursor-pointer transition-all bg-wl-bg-elevated hover:border-wl-info-500 hover:bg-wl-info-500/8"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-wl-text-secondary" />
                  <p className="text-sm font-medium text-white">
                    Drag logo or click to upload
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    PNG, JPG, WEBP (Max 2MB)
                  </p>
                </div>
                {logoUrl && (
                  <div className="mt-3 p-3 bg-wl-bg-elevated rounded-lg text-center">
                    <div
                      className="w-15 h-15 mx-auto mb-2 bg-wl-bg-root rounded-lg flex items-center justify-center text-xs text-wl-text-secondary"
                    >
                      LOGO
                    </div>
                    <p className="text-xs text-wl-text-secondary">
                      {logoUrl}
                    </p>
                  </div>
                )}
              </div>

              {/* App Name */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  App Name
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3 py-2 border border-wl-border-default rounded-lg bg-wl-bg-elevated text-white text-sm outline-none transition-colors focus:border-wl-info-500"
                />
                <p className="text-xs text-wl-text-secondary mt-1">
                  Displayed on home screen
                </p>
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Primary Color (Hex)
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-15 h-10 border border-wl-border-default rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-wl-border-default rounded-lg bg-wl-bg-elevated text-white text-sm font-mono outline-none transition-colors focus:border-wl-info-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Feature Toggles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {feature.name}
                    </p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {feature.description}
                    </p>
                  </div>
                  <label
                    className="flex items-center gap-2 ml-4 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={() => toggleFeature(feature.id)}
                      className="w-5 h-5 cursor-pointer accent-wl-info-500"
                    />
                  </label>
                </div>
              ))}

              {/* Route Navigation Options */}
              <div className="mt-4 pt-4 border-t border-wl-border-default">
                <label className="block text-sm font-semibold text-white mb-2">
                  Route Navigation Service
                </label>
                <Select
                  value={navigationMap}
                  onValueChange={setNavigationMap}
                  options={[
                    { value: "google-maps", label: "Google Maps" },
                    { value: "waze", label: "Waze" },
                    { value: "apple-maps", label: "Apple Maps" },
                  ]}
                />
                <p className="text-xs text-wl-text-secondary mt-1">
                  Default navigation app for route guidance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {notification.name}
                    </p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {notification.description}
                    </p>
                  </div>
                  <label
                    className="flex items-center gap-2 ml-4 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={notification.enabled}
                      onChange={() => toggleNotification(notification.id)}
                      className="w-5 h-5 cursor-pointer accent-wl-info-500"
                    />
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GPS Settings Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              GPS Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Tracking Interval"
                value={trackingInterval}
                onValueChange={setTrackingInterval}
                options={[
                  { value: "15s", label: "15 seconds" },
                  { value: "30s", label: "30 seconds" },
                  { value: "60s", label: "1 minute" },
                  { value: "120s", label: "2 minutes" },
                ]}
              />

              <Select
                label="Battery Optimization"
                value={batteryMode}
                onValueChange={setBatteryMode}
                options={[
                  { value: "aggressive", label: "Aggressive" },
                  { value: "balanced", label: "Balanced" },
                  { value: "quality", label: "Quality" },
                ]}
              />

              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={backgroundTracking}
                    onChange={(e) => setBackgroundTracking(e.target.checked)}
                    className="w-5 h-5 cursor-pointer accent-wl-primary-500"
                  />
                  <span className="text-sm font-semibold text-wl-text-primary">
                    Background Tracking
                  </span>
                </label>
                <p className="text-xs text-wl-text-tertiary">
                  Continue tracking when app is in background
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offline Mode Section */}
        <Card className="mb-6 bg-wl-bg-surface border border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Offline Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Max Offline Cache Size"
                value={cacheSize}
                onValueChange={setCacheSize}
                options={[
                  { value: "50mb", label: "50 MB" },
                  { value: "100mb", label: "100 MB" },
                  { value: "250mb", label: "250 MB" },
                  { value: "500mb", label: "500 MB" },
                ]}
              />

              <Select
                label="Sync Interval (Online)"
                value={syncInterval}
                onValueChange={setSyncInterval}
                options={[
                  { value: "1m", label: "1 minute" },
                  { value: "5m", label: "5 minutes" },
                  { value: "10m", label: "10 minutes" },
                  { value: "30m", label: "30 minutes" },
                ]}
              />

              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={autoRetry}
                    onChange={(e) => setAutoRetry(e.target.checked)}
                    className="w-5 h-5 cursor-pointer accent-wl-primary-500"
                  />
                  <span className="text-sm font-semibold text-wl-text-primary">
                    Auto-retry on Reconnect
                  </span>
                </label>
                <p className="text-xs text-wl-text-tertiary">
                  Automatically sync pending data when connection restored
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Summary */}
        <Card className="bg-wl-success-bg border border-wl-success-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-wl-success-400">
              <CheckCircle className="w-5 h-5" />
              Ready to Deploy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-wl-text-secondary">
                  Features Enabled
                </p>
                <p className="text-lg font-bold text-white mt-1">
                  {features.filter((f) => f.enabled).length} / {features.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-secondary">
                  Notifications Enabled
                </p>
                <p className="text-lg font-bold text-white mt-1">
                  {notifications.filter((n) => n.enabled).length} / {notifications.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-secondary">
                  Configuration Status
                </p>
                <Badge variant="success" className="mt-1">
                  Configured
                </Badge>
              </div>
            </div>

            <div className="p-3 bg-wl-bg-elevated rounded-lg mb-4">
              <p className="text-xs font-semibold text-wl-text-secondary mb-2">
                DEPLOYMENT NOTES
              </p>
              <p className="text-sm text-wl-text-secondary">
                All configurations are ready for deployment to production. Click "Save Configuration" to apply these settings to the driver mobile app.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="primary" onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save & Deploy
              </Button>
              <Button variant="secondary" className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copy Config
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
