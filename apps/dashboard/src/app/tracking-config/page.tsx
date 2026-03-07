"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Globe,
  Eye,
  MapPin,
  Clock,
  Star,
  Settings,
  Copy,
  Check,
  Palette,
  FileText,
} from "lucide-react";

export default function TrackingConfigPage() {
  const [liveMapEnabled, setLiveMapEnabled] = useState(true);
  const [etaEnabled, setEtaEnabled] = useState(true);
  const [ratingEnabled, setRatingEnabled] = useState(true);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);
  const [customDomain, setCustomDomain] = useState("track.myshop.com");
  const [copied, setCopied] = useState(false);
  const [metaTitle, setMetaTitle] = useState("Track Your Delivery");
  const [metaDesc, setMetaDesc] = useState("Real-time order tracking with live map");
  const [primaryColor, setPrimaryColor] = useState("#6C63FF");
  const [secondaryColor, setSecondaryColor] = useState("#00d4ff");
  const [logoUrl, setLogoUrl] = useState("");

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(customDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingPageUrl = `https://${customDomain}/track/order-123`;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--wl-bg)", padding: "24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", marginBottom: "8px" }}>
            Tracking Page Configuration
          </h1>
          <p style={{ color: "var(--wl-muted)", fontSize: "14px" }}>
            Customize your branded tracking page for customers
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* Left Column - Settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Feature Toggles */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Page Features</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Enable/disable tracking page features</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Live Map Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <MapPin size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>Live Map</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Show real-time driver location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLiveMapEnabled(!liveMapEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: liveMapEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>

                {/* ETA Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Clock size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>ETA Display</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Show estimated time of arrival</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEtaEnabled(!etaEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: etaEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>

                {/* Rating Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Star size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>Rating Widget</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Allow customer delivery ratings</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRatingEnabled(!ratingEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: ratingEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>

                {/* Preferences Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Settings size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>Delivery Preferences</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Let customers set delivery notes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreferencesEnabled(!preferencesEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: preferencesEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Domain */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Custom Domain</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Your branded tracking page domain</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "6px",
                        color: "var(--wl-text)",
                        fontSize: "14px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                  <button
                    onClick={handleCopyDomain}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-primary)",
                      border: "none",
                      borderRadius: "6px",
                      color: "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>
                  Configure your DNS to point to witylogix.com
                </p>
              </CardContent>
            </Card>

            {/* SEO Settings */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>SEO Configuration</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Meta tags and SEO settings</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "13px",
                    }}
                  />
                  <p style={{ color: "var(--wl-muted)", fontSize: "11px", marginTop: "4px" }}>
                    {metaTitle.length}/60 characters
                  </p>
                </div>

                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Meta Description
                  </label>
                  <textarea
                    value={metaDesc}
                    onChange={(e) => setMetaDesc(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "13px",
                      fontFamily: "sans-serif",
                      minHeight: "70px",
                      resize: "vertical",
                    }}
                  />
                  <p style={{ color: "var(--wl-muted)", fontSize: "11px", marginTop: "4px" }}>
                    {metaDesc.length}/160 characters
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview & Branding */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Tracking Page Preview */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Eye size={18} />
                  Page Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    backgroundColor: "var(--wl-bg)",
                    borderRadius: "8px",
                    border: "1px solid var(--wl-border)",
                    padding: "16px",
                    minHeight: "300px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--wl-border)" }}>
                    <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Preview URL:</p>
                    <code style={{ color: "var(--wl-primary)", fontSize: "11px", fontFamily: "monospace" }}>
                      {trackingPageUrl}
                    </code>
                  </div>

                  {/* Mock Preview */}
                  <div style={{ padding: "16px", backgroundColor: "var(--wl-card)", borderRadius: "6px" }}>
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ color: "var(--wl-text)", fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                        Order #12345 Status
                      </p>
                      <Badge style={{ backgroundColor: "var(--wl-primary)", color: "white" }}>In Transit</Badge>
                    </div>

                    {/* Live Map Indicator */}
                    {liveMapEnabled && (
                      <div style={{ padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "4px", marginBottom: "12px" }}>
                        <p style={{ color: "var(--wl-muted)", fontSize: "12px", fontStyle: "italic" }}>
                          Live map would display here
                        </p>
                      </div>
                    )}

                    {/* ETA Indicator */}
                    {etaEnabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", backgroundColor: "var(--wl-bg)", borderRadius: "4px", marginBottom: "12px" }}>
                        <Clock size={14} style={{ color: "var(--wl-primary)" }} />
                        <span style={{ color: "var(--wl-text)", fontSize: "13px" }}>
                          Arrives today by 6:30 PM
                        </span>
                      </div>
                    )}

                    {/* Rating Indicator */}
                    {ratingEnabled && (
                      <div style={{ padding: "8px", backgroundColor: "var(--wl-bg)", borderRadius: "4px", marginBottom: "12px" }}>
                        <p style={{ color: "var(--wl-muted)", fontSize: "12px", marginBottom: "4px" }}>Rate your delivery</p>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} size={16} style={{ color: "var(--wl-primary)", cursor: "pointer" }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preferences Indicator */}
                    {preferencesEnabled && (
                      <div style={{ padding: "8px", backgroundColor: "var(--wl-bg)", borderRadius: "4px" }}>
                        <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>
                          Delivery preferences configured
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    backgroundColor: "var(--wl-primary)",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Open Full Preview
                </Button>
              </CardContent>
            </Card>

            {/* Branding Configuration */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Palette size={18} />
                  Branding
                </CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Customize colors and logo</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "8px" }}>
                    Primary Color
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{ width: "48px", height: "40px", borderRadius: "6px", border: "1px solid var(--wl-border)", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "4px",
                        color: "var(--wl-text)",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "8px" }}>
                    Secondary Color
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{ width: "48px", height: "40px", borderRadius: "6px", border: "1px solid var(--wl-border)", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        backgroundColor: "var(--wl-bg)",
                        border: "1px solid var(--wl-border)",
                        borderRadius: "4px",
                        color: "var(--wl-text)",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "12px",
                    }}
                  />
                  <p style={{ color: "var(--wl-muted)", fontSize: "11px", marginTop: "4px" }}>
                    Recommended size: 200x50px
                  </p>
                </div>

                <Button
                  style={{
                    width: "100%",
                    backgroundColor: "var(--wl-primary)",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <Button
            style={{
              padding: "10px 20px",
              backgroundColor: "var(--wl-border)",
              color: "var(--wl-text)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Discard
          </Button>
          <Button
            style={{
              padding: "10px 20px",
              backgroundColor: "var(--wl-primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
