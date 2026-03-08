"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
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
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Widget Configuration
          </h1>
          <p className="text-slate-400 text-sm">
            Configure and customize your storefront widget
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">&nbsp;
          {/* Left Column - Settings */}
          <div className="flex flex-col gap-6">
            {/* Widget Features */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Widget Features</CardTitle>
                <CardDescription className="text-slate-400">Enable widget features</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">&nbsp;
                {/* Cart Selector Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Settings size={18} className="text-indigo-400" />
                    <div>
                      <p className="text-slate-100 text-sm font-medium">Cart Delivery Selector</p>
                      <p className="text-slate-400 text-xs">Show delivery options</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCartSelectorEnabled(!cartSelectorEnabled)}
                    className={cn(
                      'w-12 h-7 rounded-full border-none cursor-pointer transition-colors',
                      cartSelectorEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    )}
                  />
                </div>

                {/* Shipping Calculator Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-indigo-400" />
                    <div>
                      <p className="text-slate-100 text-sm font-medium">Shipping Calculator</p>
                      <p className="text-slate-400 text-xs">Calculate shipping costs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShippingCalcEnabled(!shippingCalcEnabled)}
                    className={cn(
                      'w-12 h-7 rounded-full border-none cursor-pointer transition-colors',
                      shippingCalcEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Widget Appearance */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Appearance</CardTitle>
                <CardDescription className="text-slate-400">Customize widget look and feel</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">&nbsp;
                {/* Position */}
                <div>
                  <label className="block text-slate-100 text-xs font-medium mb-1.5">
                    Position
                  </label>
                  <select
                    value={widgetPosition}
                    onChange={(e) => setWidgetPosition(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs cursor-pointer hover:border-slate-600"
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
                    <label className="block text-slate-100 text-xs font-medium mb-1.5">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={widgetWidth}
                      onChange={(e) => setWidgetWidth(e.target.value)}
                      min="250"
                      max="600"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-100 text-xs font-medium mb-1.5">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={widgetHeight}
                      onChange={(e) => setWidgetHeight(e.target.value)}
                      min="400"
                      max="900"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs"
                    />
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <label className="block text-slate-100 text-xs font-medium mb-1.5">
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
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded">
                  <span className="text-slate-100 text-xs">Drop Shadow</span>
                  <button
                    onClick={() => setShadowEnabled(!shadowEnabled)}
                    className={cn(
                      'w-11 h-6 rounded-full border-none cursor-pointer transition-colors',
                      shadowEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    )}
                  />
                </div>

                {/* Font */}
                <div>
                  <label className="block text-slate-100 text-xs font-medium mb-1.5">
                    Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs cursor-pointer"
                  >
                    <option value="system">System Default</option>
                    <option value="inter">Inter</option>
                    <option value="poppins">Poppins</option>
                    <option value="roboto">Roboto</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-slate-100 text-xs font-medium mb-1.5">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs cursor-pointer"
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
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Palette size={18} />
                  Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">&nbsp;
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
                    Background Color
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      style={{ width: "48px", height: "40px", borderRadius: "6px", border: "1px solid var(--wl-border)", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
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
                    Text Color
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      style={{ width: "48px", height: "40px", borderRadius: "6px", border: "1px solid var(--wl-border)", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
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
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview & Code */}
          <div className="flex flex-col gap-6">
            {/* Widget Preview */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Eye size={18} />
                  Widget Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    backgroundColor: "var(--wl-bg)",
                    borderRadius: "8px",
                    border: "1px solid var(--wl-border)",
                    padding: "16px",
                    minHeight: "400px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(parseInt(widgetWidth), 280)}px`,
                      height: `${Math.min(parseInt(widgetHeight), 380)}px`,
                      backgroundColor: backgroundColor,
                      borderRadius: `${borderRadius}px`,
                      border: `1px solid ${primaryColor}`,
                      padding: "16px",
                      boxShadow: shadowEnabled ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ color: textColor, fontWeight: "600", fontSize: "14px" }}>
                      Witylogix Widget
                    </div>

                    {cartSelectorEnabled && (
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: primaryColor,
                          borderRadius: "4px",
                          color: "white",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        Select Delivery
                      </div>
                    )}

                    {shippingCalcEnabled && (
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: primaryColor,
                          borderRadius: "4px",
                          color: "white",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        Calculate Shipping
                      </div>
                    )}

                    <p style={{ color: textColor, fontSize: "11px", flex: 1, marginTop: "auto" }}>
                      Widget configured with {language} language
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Embed Code */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Code size={18} />
                  Embed Code
                </CardTitle>
                <CardDescription className="text-slate-400">Copy and paste to your website</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    backgroundColor: "var(--wl-bg)",
                    borderRadius: "6px",
                    border: "1px solid var(--wl-border)",
                    padding: "12px",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  <pre
                    style={{
                      color: "var(--wl-primary)",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      margin: "0",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {embedCode}
                  </pre>
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "var(--wl-primary)",
                    border: "none",
                    borderRadius: "6px",
                    color: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card className="bg-slate-900 border border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Installation</CardTitle>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <p style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", marginBottom: "4px" }}>
                    1. Copy the embed code above
                  </p>
                  <p style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", marginBottom: "4px" }}>
                    2. Paste before closing &lt;/body&gt; tag
                  </p>
                  <p style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", marginBottom: "4px" }}>
                    3. Replace 'your-api-key-here' with your API key
                  </p>
                  <p style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "500" }}>
                    4. Test on your website
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
                  View Full Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 justify-end">
          <Button
            className="px-5 py-2 bg-slate-700 text-slate-100 border-none rounded cursor-pointer text-sm font-medium hover:bg-slate-600"
          >
            Discard
          </Button>
          <Button
            className="px-5 py-2 bg-indigo-500 text-white border-none rounded cursor-pointer text-sm font-medium hover:bg-indigo-600"
          >
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
