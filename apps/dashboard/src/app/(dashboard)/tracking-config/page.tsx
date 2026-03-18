"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-wl-bg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-wl-text mb-2">
            Tracking Page Configuration
          </h1>
          <p className="text-wl-muted text-sm">
            Customize your branded tracking page for customers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Settings */}
          <div className="flex flex-col gap-6">
            {/* Feature Toggles */}
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text">Page Features</CardTitle>
                <CardDescription className="text-wl-muted">Enable/disable tracking page features</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Live Map Toggle */}
                <div className="flex items-center justify-between p-3 bg-wl-bg rounded-lg border border-wl-border">
                  <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-wl-primary" />
                    <div>
                      <p className="text-wl-text text-sm font-medium">Live Map</p>
                      <p className="text-wl-muted text-xs">Show real-time driver location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLiveMapEnabled(!liveMapEnabled)}
                    className={cn("w-12 h-7 rounded-full border-none cursor-pointer transition-colors", liveMapEnabled ? "bg-wl-primary" : "bg-wl-border")}
                  />
                </div>

                {/* ETA Toggle */}
                <div className="flex items-center justify-between p-3 bg-wl-bg rounded-lg border border-wl-border">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-wl-primary" />
                    <div>
                      <p className="text-wl-text text-sm font-medium">ETA Display</p>
                      <p className="text-wl-muted text-xs">Show estimated time of arrival</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEtaEnabled(!etaEnabled)}
                    className={cn("w-12 h-7 rounded-full border-none cursor-pointer transition-colors", etaEnabled ? "bg-wl-primary" : "bg-wl-border")}
                  />
                </div>

                {/* Rating Toggle */}
                <div className="flex items-center justify-between p-3 bg-wl-bg rounded-lg border border-wl-border">
                  <div className="flex items-center gap-3">
                    <Star size={18} className="text-wl-primary" />
                    <div>
                      <p className="text-wl-text text-sm font-medium">Rating Widget</p>
                      <p className="text-wl-muted text-xs">Allow customer delivery ratings</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRatingEnabled(!ratingEnabled)}
                    className={cn("w-12 h-7 rounded-full border-none cursor-pointer transition-colors", ratingEnabled ? "bg-wl-primary" : "bg-wl-border")}
                  />
                </div>

                {/* Preferences Toggle */}
                <div className="flex items-center justify-between p-3 bg-wl-bg rounded-lg border border-wl-border">
                  <div className="flex items-center gap-3">
                    <Settings size={18} className="text-wl-primary" />
                    <div>
                      <p className="text-wl-text text-sm font-medium">Delivery Preferences</p>
                      <p className="text-wl-muted text-xs">Let customers set delivery notes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreferencesEnabled(!preferencesEnabled)}
                    className={cn("w-12 h-7 rounded-full border-none cursor-pointer transition-colors", preferencesEnabled ? "bg-wl-primary" : "bg-wl-border")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Domain */}
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text">Custom Domain</CardTitle>
                <CardDescription className="text-wl-muted">Your branded tracking page domain</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-sm font-mono"
                    />
                  </div>
                  <button
                    onClick={handleCopyDomain}
                    className="px-3 py-2 bg-wl-primary border-none rounded text-white cursor-pointer flex items-center gap-1.5 text-xs font-medium hover:opacity-90"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-wl-muted text-xs">
                  Configure your DNS to point to witylogix.com
                </p>
              </CardContent>
            </Card>

            {/* SEO Settings */}
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text">SEO Configuration</CardTitle>
                <CardDescription className="text-wl-muted">Meta tags and SEO settings</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <label className="block text-wl-text text-xs font-medium mb-1.5">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-xs"
                  />
                  <p className="text-wl-muted text-xs mt-1">
                    {metaTitle.length}/60 characters
                  </p>
                </div>

                <div>
                  <label className="block text-wl-text text-xs font-medium mb-1.5">
                    Meta Description
                  </label>
                  <textarea
                    value={metaDesc}
                    onChange={(e) => setMetaDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-xs min-h-fit resize-vertical"
                  />
                  <p className="text-wl-muted text-xs mt-1">
                    {metaDesc.length}/160 characters
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview & Branding */}
          <div className="flex flex-col gap-6">
            {/* Tracking Page Preview */}
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text flex items-center gap-2">
                  <Eye size={18} />
                  Page Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-wl-bg rounded-lg border border-wl-border p-4 min-h-80 flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-3 border-b border-wl-border">
                    <p className="text-wl-muted text-xs">Preview URL:</p>
                    <code className="text-wl-primary text-xs font-mono">
                      {trackingPageUrl}
                    </code>
                  </div>

                  {/* Mock Preview */}
                  <div className="p-4 bg-wl-card rounded">
                    <div className="mb-4">
                      <p className="text-wl-text text-base font-semibold mb-2">
                        Order #12345 Status
                      </p>
                      <Badge className="bg-wl-primary text-white">In Transit</Badge>
                    </div>

                    {/* Live Map Indicator */}
                    {liveMapEnabled && (
                      <div className="p-3 bg-wl-bg rounded text-xs mb-3">
                        <p className="text-wl-muted italic">
                          Live map would display here
                        </p>
                      </div>
                    )}

                    {/* ETA Indicator */}
                    {etaEnabled && (
                      <div className="flex items-center gap-2 p-2 bg-wl-bg rounded text-xs mb-3">
                        <Clock size={14} className="text-wl-primary" />
                        <span className="text-wl-text">
                          Arrives today by 6:30 PM
                        </span>
                      </div>
                    )}

                    {/* Rating Indicator */}
                    {ratingEnabled && (
                      <div className="p-2 bg-wl-bg rounded text-xs mb-3">
                        <p className="text-wl-muted mb-1">Rate your delivery</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} size={16} className="text-wl-primary cursor-pointer" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preferences Indicator */}
                    {preferencesEnabled && (
                      <div className="p-2 bg-wl-bg rounded">
                        <p className="text-wl-muted text-xs">
                          Delivery preferences configured
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Button className="w-full mt-3 bg-wl-primary text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90">
                  Open Full Preview
                </Button>
              </CardContent>
            </Card>

            {/* Branding Configuration */}
            <Card className="bg-wl-card border border-wl-border">
              <CardHeader>
                <CardTitle className="text-wl-text flex items-center gap-2">
                  <Palette size={18} />
                  Branding
                </CardTitle>
                <CardDescription className="text-wl-muted">Customize colors and logo</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <label className="block text-wl-text text-xs font-medium mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-wl-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-wl-bg border border-wl-border rounded text-wl-text text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-wl-text text-xs font-medium mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-wl-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-wl-bg border border-wl-border rounded text-wl-text text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-wl-text text-xs font-medium mb-1.5">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-xs"
                  />
                  <p className="text-wl-muted text-xs mt-1">
                    Recommended size: 200x50px
                  </p>
                </div>

                <Button className="w-full bg-wl-primary text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90">
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 justify-end">
          <Button className="px-5 py-2 bg-wl-border text-wl-text border-none rounded text-sm font-medium cursor-pointer hover:opacity-90">
            Discard
          </Button>
          <Button className="px-5 py-2 bg-wl-primary text-white border-none rounded text-sm font-medium cursor-pointer hover:opacity-90">
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
