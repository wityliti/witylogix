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
import { useApiQuery } from '@/hooks/use-api';
import {
  Code,
  Eye,
  Settings,
  Palette,
  Copy,
  Check,
  Globe,
  TypeIcon,
  Layout,
} from "lucide-react";

export default function WidgetConfigPage() {
  const [cartSelectorEnabled, setCartSelectorEnabled] = useState(true);
  const [shippingCalcEnabled, setShippingCalcEnabled] = useState(true);
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [fontFamily, setFontFamily] = useState("system");
  const [language, setLanguage] = useState("en");
  const [widgetWidth, setWidgetWidth] = useState("400");
  const [widgetHeight, setWidgetHeight] = useState("600");
  const [primaryColor, setPrimaryColor] = useState("#6C63FF");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#000000");
  const [borderRadius, setBorderRadius] = useState("8");
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const embedCode = `<script src="https://witylogix.com/widget/latest.js"></script>
<div id="witylogix-widget"></div>
<script>
  WitylogixWidget.init({
    apiKey: 'your-api-key-here',
    position: '${widgetPosition}',
    width: ${widgetWidth},
    height: ${widgetHeight},
    colors: {
      primary: '${primaryColor}',
      background: '${backgroundColor}',
      text: '${textColor}'
    },
    features: {
      cartSelector: ${cartSelectorEnabled},
      shippingCalc: ${shippingCalcEnabled}
    },
    language: '${language}'
  });
</script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Widget Configuration
          </h1>
          <p className="text-gray-400 text-sm">
            Configure and customize your storefront widget
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left Column - Settings */}
          <div className="flex flex-col gap-6">
            {/* Widget Features */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Widget Features</CardTitle>
                <CardDescription className="text-gray-400">Enable widget features</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Cart Selector Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  <div className="flex items-center gap-3">
                    <Settings size={18} className="text-blue-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Cart Delivery Selector</p>
                      <p className="text-gray-400 text-xs">Show delivery options</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCartSelectorEnabled(!cartSelectorEnabled)}
                    className={cn(
                      'w-12 h-7 rounded-full border-none cursor-pointer transition-colors',
                      cartSelectorEnabled ? 'bg-blue-500' : 'bg-[#1a1a2e]'
                    )}
                  />
                </div>

                {/* Shipping Calculator Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-blue-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Shipping Calculator</p>
                      <p className="text-gray-400 text-xs">Calculate shipping costs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShippingCalcEnabled(!shippingCalcEnabled)}
                    className={cn(
                      'w-12 h-7 rounded-full border-none cursor-pointer transition-colors',
                      shippingCalcEnabled ? 'bg-blue-500' : 'bg-[#1a1a2e]'
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Widget Appearance */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Appearance</CardTitle>
                <CardDescription className="text-gray-400">Customize widget look and feel</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Position */}
                <div>
                  <label className="block text-white text-xs font-medium mb-1.5">
                    Position
                  </label>
                  <select
                    value={widgetPosition}
                    onChange={(e) => setWidgetPosition(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs cursor-pointer hover:border-[#2a2a3e]"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white text-xs font-medium mb-1.5">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={widgetWidth}
                      onChange={(e) => setWidgetWidth(e.target.value)}
                      min="250"
                      max="600"
                      className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-white text-xs font-medium mb-1.5">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={widgetHeight}
                      onChange={(e) => setWidgetHeight(e.target.value)}
                      min="400"
                      max="900"
                      className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs"
                    />
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <label className="block text-white text-xs font-medium mb-1.5">
                    Border Radius: {borderRadius}px
                  </label>
                  <input
                    type="range"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value)}
                    min="0"
                    max="20"
                    className="w-full cursor-pointer"
                  />
                </div>

                {/* Shadow Toggle */}
                <div className="flex items-center justify-between p-2.5 bg-[#0a0a0f] rounded">
                  <span className="text-white text-xs">Drop Shadow</span>
                  <button
                    onClick={() => setShadowEnabled(!shadowEnabled)}
                    className={cn(
                      'w-11 h-6 rounded-full border-none cursor-pointer transition-colors',
                      shadowEnabled ? 'bg-blue-500' : 'bg-[#1a1a2e]'
                    )}
                  />
                </div>

                {/* Font */}
                <div>
                  <label className="block text-white text-xs font-medium mb-1.5">
                    Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs cursor-pointer"
                  >
                    <option value="system">System Default</option>
                    <option value="inter">Inter</option>
                    <option value="poppins">Poppins</option>
                    <option value="roboto">Roboto</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-white text-xs font-medium mb-1.5">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs cursor-pointer"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Color Scheme */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Palette size={18} />
                  Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <label className="block text-white text-xs font-medium mb-2">
                    Primary Color
                  </label>
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
                      className="flex-1 px-2.5 py-1.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white text-xs font-medium mb-2">
                    Background Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-12 h-10 rounded border border-[#1e1e2e] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white text-xs font-medium mb-2">
                    Text Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-12 h-10 rounded border border-[#1e1e2e] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview & Code */}
          <div className="flex flex-col gap-6">
            {/* Widget Preview */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye size={18} />
                  Widget Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] p-4 min-h-96 flex items-center justify-center">
                  <div
                    className="flex flex-col gap-3 overflow-hidden rounded"
                    style={{
                      width: `${Math.min(parseInt(widgetWidth), 280)}px`,
                      height: `${Math.min(parseInt(widgetHeight), 380)}px`,
                      backgroundColor: backgroundColor,
                      borderRadius: `${borderRadius}px`,
                      border: `1px solid ${primaryColor}`,
                      padding: "16px",
                      boxShadow: shadowEnabled ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                    }}
                  >
                    <div className="font-semibold text-sm" style={{ color: textColor }}>
                      Witylogix Widget
                    </div>

                    {cartSelectorEnabled && (
                      <div
                        className="p-2.5 rounded text-white text-xs font-medium"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Select Delivery
                      </div>
                    )}

                    {shippingCalcEnabled && (
                      <div
                        className="p-2.5 rounded text-white text-xs font-medium"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Calculate Shipping
                      </div>
                    )}

                    <p className="text-xs flex-1 mt-auto" style={{ color: textColor }}>
                      Widget configured with {language} language
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Embed Code */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code size={18} />
                  Embed Code
                </CardTitle>
                <CardDescription className="text-gray-400">Copy and paste to your website</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="bg-[#0a0a0f] rounded border border-[#1e1e2e] p-3 max-h-64 overflow-y-auto">
                  <pre className="text-blue-400 text-xs font-mono m-0 leading-relaxed whitespace-pre-wrap break-words">
                    {embedCode}
                  </pre>
                </div>
                <Button
                  onClick={handleCopyCode}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                  {copiedCode ? "Copied!" : "Copy Code"}
                </Button>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Installation</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5">
                <div>
                  <p className="text-white text-xs font-medium mb-1">
                    1. Copy the embed code above
                  </p>
                  <p className="text-white text-xs font-medium mb-1">
                    2. Paste before closing &lt;/body&gt; tag
                  </p>
                  <p className="text-white text-xs font-medium mb-1">
                    3. Replace 'your-api-key-here' with your API key
                  </p>
                  <p className="text-white text-xs font-medium">
                    4. Test on your website
                  </p>
                </div>
                <Button variant="primary" className="w-full">
                  View Full Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary">
            Discard
          </Button>
          <Button variant="primary">
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
