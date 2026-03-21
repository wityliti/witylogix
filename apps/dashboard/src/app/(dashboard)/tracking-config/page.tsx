"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Eye,
  Clock,
  Star,
  Settings,
  Copy,
  Check,
  Palette,
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
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(customDomain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingPageUrl = `https://${customDomain}/track/order-123`;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Tracking Page Configuration</h1>
          <p className="text-gray-400 text-sm">Customize your branded tracking page for customers</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Settings */}
          <div className="flex flex-col gap-6">
            {/* Feature Toggles */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Page Features</h3>
              <p className="text-gray-400 text-xs mb-4">Enable/disable tracking page features</p>
              <div className="space-y-3">
                {[
                  { icon: MapPin, label: "Live Map", desc: "Show real-time driver location", enabled: liveMapEnabled, setter: setLiveMapEnabled },
                  { icon: Clock, label: "ETA Display", desc: "Show estimated time of arrival", enabled: etaEnabled, setter: setEtaEnabled },
                  { icon: Star, label: "Rating Widget", desc: "Allow customer delivery ratings", enabled: ratingEnabled, setter: setRatingEnabled },
                  { icon: Settings, label: "Delivery Preferences", desc: "Let customers set delivery notes", enabled: preferencesEnabled, setter: setPreferencesEnabled },
                ].map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.label}
                      className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg border border-[#1e1e2e] hover:border-blue-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-blue-500" />
                        <div>
                          <p className="text-white text-sm font-medium">{feature.label}</p>
                          <p className="text-gray-400 text-xs">{feature.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => feature.setter(!feature.enabled)}
                        className={cn(
                          "w-12 h-7 rounded-full border-none cursor-pointer transition-colors",
                          feature.enabled ? "bg-blue-500" : "bg-[#1e1e2e]"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Custom Domain */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-1">Custom Domain</h3>
              <p className="text-gray-400 text-xs mb-4">Your branded tracking page domain</p>
              <div className="flex gap-2 items-center mb-3">
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500/50"
                />
                <Button
                  onClick={handleCopyDomain}
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-gray-500 text-xs">Configure your DNS to point to witylogix.com</p>
            </Card>

            {/* SEO Settings */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-1">SEO Configuration</h3>
              <p className="text-gray-400 text-xs mb-4">Meta tags and SEO settings</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">Meta Title</label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-xs focus:outline-none focus:border-blue-500/50"
                  />
                  <p className="text-gray-500 text-xs mt-1">{metaTitle.length}/60 characters</p>
                </div>

                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">Meta Description</label>
                  <textarea
                    value={metaDesc}
                    onChange={(e) => setMetaDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-white text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                    rows={3}
                  />
                  <p className="text-gray-500 text-xs mt-1">{metaDesc.length}/160 characters</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Preview & Branding */}
          <div className="flex flex-col gap-6">
            {/* Tracking Page Preview */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye size={18} className="text-blue-500" />
                <h3 className="text-lg font-semibold text-white">Page Preview</h3>
              </div>
              <div className="bg-[#1a1a2e] rounded-lg border border-[#1e1e2e] p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#1e1e2e]">
                  <p className="text-gray-400 text-xs">Preview URL:</p>
                  <code className="text-blue-500 text-xs font-mono">{trackingPageUrl}</code>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-white text-sm font-semibold mb-2">Order #12345 Status</p>
                    <Badge variant="primary">In Transit</Badge>
                  </div>

                  {liveMapEnabled && (
                    <div className="p-3 bg-[#0a0a0f] rounded text-xs border border-[#1e1e2e]">
                      <p className="text-gray-400 italic">Live map would display here</p>
                    </div>
                  )}

                  {etaEnabled && (
                    <div className="flex items-center gap-2 p-2 bg-[#0a0a0f] rounded text-xs border border-[#1e1e2e]">
                      <Clock size={14} className="text-blue-500" />
                      <span className="text-gray-300">Arrives today by 6:30 PM</span>
                    </div>
                  )}

                  {ratingEnabled && (
                    <div className="p-2 bg-[#0a0a0f] rounded text-xs border border-[#1e1e2e]">
                      <p className="text-gray-400 mb-1">Rate your delivery</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={16} className="text-yellow-500 cursor-pointer" />
                        ))}
                      </div>
                    </div>
                  )}

                  {preferencesEnabled && (
                    <div className="p-2 bg-[#0a0a0f] rounded text-xs border border-[#1e1e2e]">
                      <p className="text-gray-400">Delivery preferences configured</p>
                    </div>
                  )}
                </div>
              </div>
              <Button variant="primary" className="w-full mt-4">Open Full Preview</Button>
            </Card>

            {/* Branding Configuration */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={18} className="text-blue-500" />
                <h3 className="text-lg font-semibold text-white">Branding</h3>
              </div>
              <p className="text-gray-400 text-xs mb-4">Customize colors and logo</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-[#1e1e2e] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-gray-300 text-xs font-mono focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">Secondary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded border border-[#1e1e2e] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-gray-300 text-xs font-mono focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-xs font-medium mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#1e1e2e] rounded text-gray-300 text-xs focus:outline-none focus:border-blue-500/50"
                  />
                  <p className="text-gray-500 text-xs mt-1">Recommended size: 200x50px</p>
                </div>

                <Button variant="primary" className="w-full">Save Branding</Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary">Discard</Button>
          <Button variant="primary">Save Configuration</Button>
        </div>
      </div>
    </div>
  );
}
