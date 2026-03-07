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
    <div style={{ minHeight: "100vh", backgroundColor: "var(--wl-bg)", padding: "24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", marginBottom: "8px" }}>
            Widget Configuration
          </h1>
          <p style={{ color: "var(--wl-muted)", fontSize: "14px" }}>
            Configure and customize your storefront widget
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* Left Column - Settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Widget Features */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Widget Features</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Enable widget features</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Cart Selector Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Settings size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>Cart Delivery Selector</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Show delivery options</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCartSelectorEnabled(!cartSelectorEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: cartSelectorEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>

                {/* Shipping Calculator Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--wl-bg)", borderRadius: "8px", border: "1px solid var(--wl-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Globe size={18} style={{ color: "var(--wl-primary)" }} />
                    <div>
                      <p style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>Shipping Calculator</p>
                      <p style={{ color: "var(--wl-muted)", fontSize: "12px" }}>Calculate shipping costs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShippingCalcEnabled(!shippingCalcEnabled)}
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      border: "none",
                      backgroundColor: shippingCalcEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Widget Appearance */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Appearance</CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Customize widget look and feel</CardDescription>
              </CardHeader>
              <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Position */}
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Position
                  </label>
                  <select
                    value={widgetPosition}
                    onChange={(e) => setWidgetPosition(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                {/* Dimensions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={widgetWidth}
                      onChange={(e) => setWidgetWidth(e.target.value)}
                      min="250"
                      max="600"
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
                  </div>
                  <div>
                    <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={widgetHeight}
                      onChange={(e) => setWidgetHeight(e.target.value)}
                      min="400"
                      max="900"
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
                  </div>
                </div>

                {/* Border Radius */}
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Border Radius: {borderRadius}px
                  </label>
                  <input
                    type="range"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value)}
                    min="0"
                    max="20"
                    style={{ width: "100%", cursor: "pointer" }}
                  />
                </div>

                {/* Shadow Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", backgroundColor: "var(--wl-bg)", borderRadius: "6px" }}>
                  <span style={{ color: "var(--wl-text)", fontSize: "13px" }}>Drop Shadow</span>
                  <button
                    onClick={() => setShadowEnabled(!shadowEnabled)}
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      border: "none",
                      backgroundColor: shadowEnabled ? "var(--wl-primary)" : "var(--wl-border)",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                  />
                </div>

                {/* Font */}
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="system">System Default</option>
                    <option value="inter">Inter</option>
                    <option value="poppins">Poppins</option>
                    <option value="roboto">Roboto</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label style={{ display: "block", color: "var(--wl-text)", fontSize: "13px", fontWeight: "500", marginBottom: "6px" }}>
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
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
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Palette size={18} />
                  Colors
                </CardTitle>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Widget Preview */}
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
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
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Code size={18} />
                  Embed Code
                </CardTitle>
                <CardDescription style={{ color: "var(--wl-muted)" }}>Copy and paste to your website</CardDescription>
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
            <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
              <CardHeader>
                <CardTitle style={{ color: "var(--wl-text)" }}>Installation</CardTitle>
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
