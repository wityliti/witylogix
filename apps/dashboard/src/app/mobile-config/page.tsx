"use client";

import { useState } from "react";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Select } from "../../components/ui/select";
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

export default function MobileConfigPage() {
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
  const handleSave = () => {
    // In a real app, this would call an API
    console.log({
      appName,
      primaryColor,
      features,
      navigationMap,
      notifications,
      trackingInterval,
      batteryMode,
      backgroundTracking,
      cacheSize,
      syncInterval,
      autoRetry,
    });
    alert("Configuration saved successfully!");
  };

  return (
    <>
      <Header
        title="Mobile App Configuration"
        subtitle="Configure the driver mobile app settings and features"
        actions={
          <Button variant="primary" size="md" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* App Branding Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <Palette className="w-5 h-5" />
              App Branding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--wl-space-6)" }}>
              {/* Logo Upload */}
              <div>
                <label style={{ display: "block", fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-3)" }}>
                  App Logo
                </label>
                <div
                  style={{
                    border: "2px dashed var(--wl-border-subtle)",
                    borderRadius: "var(--wl-radius-lg)",
                    padding: "var(--wl-space-8)",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all var(--wl-duration-fast) var(--wl-ease-default)",
                    background: "var(--wl-bg-surface)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--wl-primary-500)";
                    e.currentTarget.style.background = "rgba(245, 166, 35, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--wl-border-subtle)";
                    e.currentTarget.style.background = "var(--wl-bg-surface)";
                  }}
                >
                  <Upload className="w-8 h-8" style={{ margin: "0 auto var(--wl-space-2)", color: "var(--wl-text-secondary)" }} />
                  <p style={{ fontSize: "var(--wl-text-sm)", fontWeight: 500, color: "var(--wl-text-primary)", margin: 0 }}>
                    Drag logo or click to upload
                  </p>
                  <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: "var(--wl-space-1)" }}>
                    PNG, JPG, WEBP (Max 2MB)
                  </p>
                </div>
                {logoUrl && (
                  <div style={{ marginTop: "var(--wl-space-3)", padding: "var(--wl-space-3)", background: "var(--wl-bg-surface)", borderRadius: "var(--wl-radius-md)", textAlign: "center" }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        margin: "0 auto var(--wl-space-2)",
                        background: "var(--wl-bg-elevated)",
                        borderRadius: "var(--wl-radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        color: "var(--wl-text-tertiary)",
                      }}
                    >
                      LOGO
                    </div>
                    <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0 }}>
                      {logoUrl}
                    </p>
                  </div>
                )}
              </div>

              {/* App Name */}
              <div>
                <label style={{ display: "block", fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)" }}>
                  App Name
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    border: "1px solid var(--wl-border-subtle)",
                    borderRadius: "var(--wl-radius-md)",
                    background: "var(--wl-bg-surface)",
                    color: "var(--wl-text-primary)",
                    fontSize: "var(--wl-text-sm)",
                    outline: "none",
                    transition: "border-color var(--wl-duration-fast) var(--wl-ease-default)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--wl-primary-500)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--wl-border-subtle)")}
                />
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: "var(--wl-space-1)" }}>
                  Displayed on home screen
                </p>
              </div>

              {/* Primary Color */}
              <div>
                <label style={{ display: "block", fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)" }}>
                  Primary Color (Hex)
                </label>
                <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{
                      width: 60,
                      height: 40,
                      border: "1px solid var(--wl-border-subtle)",
                      borderRadius: "var(--wl-radius-md)",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "var(--wl-space-2) var(--wl-space-3)",
                      border: "1px solid var(--wl-border-subtle)",
                      borderRadius: "var(--wl-radius-md)",
                      background: "var(--wl-bg-surface)",
                      color: "var(--wl-text-primary)",
                      fontSize: "var(--wl-text-sm)",
                      fontFamily: "var(--wl-font-mono)",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--wl-primary-500)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--wl-border-subtle)")}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <Zap className="w-5 h-5" />
              Feature Toggles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
              {features.map((feature) => (
                <div
                  key={feature.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--wl-space-3)",
                    background: "var(--wl-bg-surface)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border-subtle)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", margin: 0 }}>
                      {feature.name}
                    </p>
                    <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: "var(--wl-space-1)" }}>
                      {feature.description}
                    </p>
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-2)",
                      marginLeft: "var(--wl-space-4)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={() => toggleFeature(feature.id)}
                      style={{
                        width: 20,
                        height: 20,
                        cursor: "pointer",
                        accentColor: "var(--wl-primary-500)",
                      }}
                    />
                  </label>
                </div>
              ))}

              {/* Route Navigation Options */}
              <div style={{ marginTop: "var(--wl-space-4)", paddingTop: "var(--wl-space-4)", borderTop: "1px solid var(--wl-border-subtle)" }}>
                <label style={{ display: "block", fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "var(--wl-space-2)" }}>
                  Route Navigation Service
                </label>
                <Select
                  value={navigationMap}
                  onChange={setNavigationMap}
                  options={[
                    { value: "google-maps", label: "Google Maps" },
                    { value: "waze", label: "Waze" },
                    { value: "apple-maps", label: "Apple Maps" },
                  ]}
                />
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: "var(--wl-space-1)" }}>
                  Default navigation app for route guidance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <Bell className="w-5 h-5" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)" }}>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--wl-space-3)",
                    background: "var(--wl-bg-surface)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border-subtle)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)", margin: 0 }}>
                      {notification.name}
                    </p>
                    <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: "var(--wl-space-1)" }}>
                      {notification.description}
                    </p>
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--wl-space-2)",
                      marginLeft: "var(--wl-space-4)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={notification.enabled}
                      onChange={() => toggleNotification(notification.id)}
                      style={{
                        width: 20,
                        height: 20,
                        cursor: "pointer",
                        accentColor: "var(--wl-primary-500)",
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GPS Settings Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <MapPin className="w-5 h-5" />
              GPS Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--wl-space-4)" }}>
              <Select
                label="Tracking Interval"
                value={trackingInterval}
                onChange={setTrackingInterval}
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
                onChange={setBatteryMode}
                options={[
                  { value: "aggressive", label: "Aggressive" },
                  { value: "balanced", label: "Balanced" },
                  { value: "quality", label: "Quality" },
                ]}
              />

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", cursor: "pointer", marginBottom: "var(--wl-space-2)" }}>
                  <input
                    type="checkbox"
                    checked={backgroundTracking}
                    onChange={(e) => setBackgroundTracking(e.target.checked)}
                    style={{
                      width: 20,
                      height: 20,
                      cursor: "pointer",
                      accentColor: "var(--wl-primary-500)",
                    }}
                  />
                  <span style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                    Background Tracking
                  </span>
                </label>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Continue tracking when app is in background
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offline Mode Section */}
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
              <Smartphone className="w-5 h-5" />
              Offline Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--wl-space-4)" }}>
              <Select
                label="Max Offline Cache Size"
                value={cacheSize}
                onChange={setCacheSize}
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
                onChange={setSyncInterval}
                options={[
                  { value: "1m", label: "1 minute" },
                  { value: "5m", label: "5 minutes" },
                  { value: "10m", label: "10 minutes" },
                  { value: "30m", label: "30 minutes" },
                ]}
              />

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", cursor: "pointer", marginBottom: "var(--wl-space-2)" }}>
                  <input
                    type="checkbox"
                    checked={autoRetry}
                    onChange={(e) => setAutoRetry(e.target.checked)}
                    style={{
                      width: 20,
                      height: 20,
                      cursor: "pointer",
                      accentColor: "var(--wl-primary-500)",
                    }}
                  />
                  <span style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                    Auto-retry on Reconnect
                  </span>
                </label>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Automatically sync pending data when connection restored
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Summary */}
        <Card style={{ background: "rgba(34, 197, 94, 0.08)", borderColor: "var(--wl-success-400)" }}>
          <CardHeader>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)", color: "var(--wl-success-400)" }}>
              <CheckCircle className="w-5 h-5" />
              Ready to Deploy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--wl-space-4)", marginBottom: "var(--wl-space-4)" }}>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Features Enabled
                </p>
                <p style={{ fontSize: "var(--wl-text-lg)", fontWeight: 700, color: "var(--wl-text-primary)", marginTop: 4 }}>
                  {features.filter((f) => f.enabled).length} / {features.length}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Notifications Enabled
                </p>
                <p style={{ fontSize: "var(--wl-text-lg)", fontWeight: 700, color: "var(--wl-text-primary)", marginTop: 4 }}>
                  {notifications.filter((n) => n.enabled).length} / {notifications.length}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  Configuration Status
                </p>
                <Badge variant="success" style={{ marginTop: 4 }}>
                  Configured
                </Badge>
              </div>
            </div>

            <div style={{ padding: "var(--wl-space-3)", background: "var(--wl-bg-surface)", borderRadius: "var(--wl-radius-md)", marginBottom: "var(--wl-space-4)" }}>
              <p style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", margin: 0, marginBottom: "var(--wl-space-2)" }}>
                DEPLOYMENT NOTES
              </p>
              <p style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", margin: 0 }}>
                All configurations are ready for deployment to production. Click "Save Configuration" to apply these settings to the driver mobile app.
              </p>
            </div>

            <div style={{ display: "flex", gap: "var(--wl-space-3)" }}>
              <Button variant="primary" onClick={handleSave} style={{ flex: 1 }}>
                <Save className="w-4 h-4 mr-2" />
                Save & Deploy
              </Button>
              <Button variant="secondary" style={{ flex: 1 }}>
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
