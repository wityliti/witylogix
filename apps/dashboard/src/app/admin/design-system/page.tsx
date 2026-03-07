"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  Select,
  Tabs,
  Modal,
  StatCard,
} from "@/components/ui";
import {
  Palette,
  Type,
  Layout,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Info,
  Bell,
  Filter,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   DESIGN SYSTEM GALLERY PAGE
   Interactive showcase of design tokens and UI components
   ═══════════════════════════════════════════════════════════ */

// Color tokens definition
const COLOR_TOKENS = {
  "Background Colors": {
    "--wl-bg-root": "#0a0a0c",
    "--wl-bg-base": "#0f0f13",
    "--wl-bg-surface": "#111114",
    "--wl-bg-elevated": "#19191e",
    "--wl-bg-overlay": "#1f1f26",
    "--wl-bg-sunken": "#07070a",
    "--wl-bg-sidebar": "#0c0c10",
  },
  "Neutral Colors": {
    "--wl-neutral-50": "#f8f8fa",
    "--wl-neutral-100": "#ececf1",
    "--wl-neutral-200": "#d5d5dd",
    "--wl-neutral-300": "#b0b0bf",
    "--wl-neutral-400": "#8585a0",
    "--wl-neutral-500": "#62627e",
    "--wl-neutral-600": "#4a4a62",
    "--wl-neutral-700": "#35354a",
    "--wl-neutral-800": "#232336",
    "--wl-neutral-900": "#17172a",
  },
  "Primary Colors (Amber)": {
    "--wl-primary-50": "#fff9eb",
    "--wl-primary-100": "#ffefc4",
    "--wl-primary-200": "#ffe09d",
    "--wl-primary-300": "#ffd06a",
    "--wl-primary-400": "#ffc240",
    "--wl-primary-500": "#f5a623",
    "--wl-primary-600": "#d98b0a",
    "--wl-primary-700": "#b06f05",
    "--wl-primary-800": "#8d5704",
    "--wl-primary-900": "#6b4203",
  },
  "Status Colors": {
    "--wl-success-500": "#10b981",
    "--wl-warning-500": "#f59e0b",
    "--wl-danger-500": "#ef4444",
    "--wl-info-500": "#3b82f6",
  },
  "Text Colors": {
    "--wl-text-primary": "#f0f0f5",
    "--wl-text-secondary": "#9494ac",
    "--wl-text-tertiary": "#5e5e78",
    "--wl-text-inverse": "#0a0a0c",
  },
  "Border Colors": {
    "--wl-border-subtle": "rgba(255, 255, 255, 0.06)",
    "--wl-border-default": "rgba(255, 255, 255, 0.10)",
    "--wl-border-strong": "rgba(255, 255, 255, 0.16)",
  },
};

// Typography samples
const TYPOGRAPHY_SAMPLES = [
  { name: "3XL Heading", size: "30px", weight: 700, text: "The Quick Brown Fox" },
  { name: "2XL Heading", size: "24px", weight: 700, text: "The Quick Brown Fox" },
  { name: "XL Heading", size: "20px", weight: 700, text: "The Quick Brown Fox" },
  { name: "LG Heading", size: "17px", weight: 700, text: "The Quick Brown Fox" },
  { name: "MD Body", size: "15px", weight: 400, text: "The quick brown fox jumps over the lazy dog" },
  { name: "Base Body", size: "14px", weight: 400, text: "The quick brown fox jumps over the lazy dog" },
  { name: "SM Caption", size: "13px", weight: 500, text: "The quick brown fox jumps over the lazy dog" },
  { name: "XS Label", size: "11px", weight: 600, text: "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG" },
];

// Spacing scale
const SPACING_SCALE = [
  { name: "0", value: 0 },
  { name: "1", value: 4, label: "4px" },
  { name: "2", value: 8, label: "8px" },
  { name: "3", value: 12, label: "12px" },
  { name: "4", value: 16, label: "16px" },
  { name: "5", value: 20, label: "20px" },
  { name: "6", value: 24, label: "24px" },
  { name: "8", value: 32, label: "32px" },
  { name: "10", value: 40, label: "40px" },
  { name: "12", value: 48, label: "48px" },
];

// Copy to clipboard utility
const CopyToken = ({ token }: { token: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--wl-text-secondary)",
        transition: "all 0.2s",
      }}
      title="Copy token"
    >
      {copied ? (
        <Check style={{ width: "16px", height: "16px", color: "var(--wl-success-500)" }} />
      ) : (
        <Copy style={{ width: "16px", height: "16px" }} />
      )}
    </button>
  );
};

// Color Palette Section
const ColorPaletteSection = () => {
  return (
    <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-6)" }}>
      <CardHeader style={{ paddingBottom: "var(--wl-space-3)", display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
        <Palette style={{ width: "20px", height: "20px", color: "var(--wl-text-secondary)" }} />
        <CardTitle>Color Palette</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: "grid", gap: "var(--wl-space-6)" }}>
          {Object.entries(COLOR_TOKENS).map(([categoryName, colors]) => (
            <div key={categoryName}>
              <h4 style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-secondary)", marginBottom: "var(--wl-space-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {categoryName}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--wl-space-4)" }}>
                {Object.entries(colors).map(([tokenName, hexValue]) => (
                  <div key={tokenName} style={{ display: "flex", gap: "var(--wl-space-3)", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "var(--wl-radius-md)",
                        backgroundColor: hexValue,
                        border: "1px solid var(--wl-border-default)",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-primary)", marginBottom: "2px" }}>
                        {tokenName}
                      </p>
                      <code style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "space-between" }}>
                        <span>{hexValue}</span>
                        <CopyToken token={hexValue} />
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Typography Section
const TypographySection = () => {
  return (
    <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-6)" }}>
      <CardHeader style={{ paddingBottom: "var(--wl-space-3)", display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
        <Type style={{ width: "20px", height: "20px", color: "var(--wl-text-secondary)" }} />
        <CardTitle>Typography</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: "grid", gap: "var(--wl-space-4)" }}>
          {TYPOGRAPHY_SAMPLES.map((sample, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-4)", paddingBottom: "var(--wl-space-4)", borderBottom: idx < TYPOGRAPHY_SAMPLES.length - 1 ? "1px solid var(--wl-border-subtle)" : "none" }}>
              <div style={{ minWidth: "80px" }}>
                <p style={{ margin: 0, fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {sample.name}
                </p>
                <code style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", fontFamily: "var(--wl-font-mono)" }}>
                  {sample.size} / {sample.weight}
                </code>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: sample.size as any, fontWeight: sample.weight as any, color: "var(--wl-text-primary)", fontFamily: "var(--wl-font-sans)" }}>
                  {sample.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Spacing Section
const SpacingSection = () => {
  return (
    <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-6)" }}>
      <CardHeader style={{ paddingBottom: "var(--wl-space-3)", display: "flex", alignItems: "center", gap: "var(--wl-space-3)" }}>
        <Layout style={{ width: "20px", height: "20px", color: "var(--wl-text-secondary)" }} />
        <CardTitle>Spacing Scale</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: "grid", gap: "var(--wl-space-4)" }}>
          {SPACING_SCALE.map((space) => (
            <div key={space.name} style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-4)" }}>
              <div style={{ minWidth: "60px" }}>
                <p style={{ margin: 0, fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                  --wl-space-{space.name}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                  {space.label || "0"}
                </p>
              </div>
              <div
                style={{
                  height: "2px",
                  backgroundColor: "var(--wl-primary-500)",
                  width: `${Math.max(space.value, 4)}px`,
                  borderRadius: "1px",
                }}
              />
              <div style={{ minWidth: "40px", textAlign: "right" }}>
                <code style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)" }}>
                  {space.value}px
                </code>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Components Showcase
const ComponentsShowcase = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<"success" | "warning" | "danger" | "info">("success");

  return (
    <div style={{ display: "grid", gap: "var(--wl-space-6)" }}>
      {/* Buttons */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--wl-space-4)" }}>
            <Button variant="primary" size="md">Primary Button</Button>
            <Button variant="secondary" size="md">Secondary Button</Button>
            <Button variant="ghost" size="md">Ghost Button</Button>
            <Button variant="danger" size="md">Danger Button</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="lg">Large</Button>
            <Button variant="primary" size="md" disabled>Disabled</Button>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--wl-space-3)" }}>
            <Badge variant="default">Default Badge</Badge>
            <Badge variant="success">Success Badge</Badge>
            <Badge variant="warning">Warning Badge</Badge>
            <Badge variant="danger">Danger Badge</Badge>
            <Badge variant="info">Info Badge</Badge>
            <Badge variant="primary">Primary Badge</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Inputs & Selects */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Form Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gap: "var(--wl-space-4)", maxWidth: "400px" }}>
            <div>
              <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 500, color: "var(--wl-text-primary)", display: "block", marginBottom: "var(--wl-space-2)" }}>
                Input Field
              </label>
              <Input placeholder="Enter text..." />
            </div>
            <div>
              <label style={{ fontSize: "var(--wl-text-sm)", fontWeight: 500, color: "var(--wl-text-primary)", display: "block", marginBottom: "var(--wl-space-2)" }}>
                Select Field
              </label>
              <Select
                options={[
                  { value: "opt1", label: "Option 1" },
                  { value: "opt2", label: "Option 2" },
                  { value: "opt3", label: "Option 3" },
                ]}
                value="opt1"
                onChange={(value) => console.log("Selected:", value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Stat Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--wl-space-4)" }}>
            <StatCard
              label="Total Orders"
              value="2,345"
              icon={<Filter style={{ width: "20px", height: "20px" }} />}
              trend={{ value: 12.5, direction: "up" as const }}
              color="#f5a623"
            />
            <StatCard
              label="Active Drivers"
              value="128"
              icon={<CheckCircle2 style={{ width: "20px", height: "20px" }} />}
              trend={{ value: 8.2, direction: "up" as const }}
              color="#10b981"
            />
            <StatCard
              label="Pending Shipments"
              value="43"
              icon={<AlertCircle style={{ width: "20px", height: "20px" }} />}
              trend={{ value: 5.1, direction: "down" as const }}
              color="#ef4444"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Tabs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            tabs={[
              { id: "tab1", label: "Tab One", count: 12 },
              { id: "tab2", label: "Tab Two", count: 8 },
              { id: "tab3", label: "Tab Three" },
            ]}
            activeTab="tab1"
            onChange={(tab) => console.log("Selected tab:", tab)}
            variant="pills"
            size="md"
          />
        </CardContent>
      </Card>

      {/* Modal Trigger */}
      <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
        <CardHeader style={{ paddingBottom: "var(--wl-space-3)" }}>
          <CardTitle>Modal</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          {modalOpen && (
            <Modal onClose={() => setModalOpen(false)}>
              <div style={{ padding: "var(--wl-space-6)" }}>
                <h2 style={{ fontSize: "var(--wl-text-xl)", fontWeight: 700, color: "var(--wl-text-primary)", margin: "0 0 var(--wl-space-3) 0" }}>
                  Modal Example
                </h2>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 var(--wl-space-4) 0" }}>
                  This is a sample modal dialog showing component usage in the design system.
                </p>
                <div style={{ display: "flex", gap: "var(--wl-space-3)", justifyContent: "flex-end" }}>
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => setModalOpen(false)}>
                    Confirm
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main Page Component
export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState("colors");

  return (
    <div style={{ backgroundColor: "var(--wl-bg-root)" }}>
      <Header
        title="Design System"
        subtitle="Comprehensive guide to colors, typography, spacing, and components"
      />

      <main style={{ padding: "var(--wl-space-6)", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Navigation Tabs */}
        <div style={{ marginBottom: "var(--wl-space-8)" }}>
          <Tabs
            tabs={[
              { id: "colors", label: "Colors", icon: <Palette style={{ width: "16px", height: "16px" }} /> },
              { id: "typography", label: "Typography", icon: <Type style={{ width: "16px", height: "16px" }} /> },
              { id: "spacing", label: "Spacing", icon: <Layout style={{ width: "16px", height: "16px" }} /> },
              { id: "components", label: "Components", icon: <Bell style={{ width: "16px", height: "16px" }} /> },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="pills"
            size="md"
          />
        </div>

        {/* Content Sections */}
        {activeTab === "colors" && <ColorPaletteSection />}
        {activeTab === "typography" && <TypographySection />}
        {activeTab === "spacing" && <SpacingSection />}
        {activeTab === "components" && <ComponentsShowcase />}
      </main>

      <style>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--wl-neutral-700) transparent;
        }
        *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background: var(--wl-neutral-700);
          border-radius: 3px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: var(--wl-neutral-600);
        }
      `}</style>
    </div>
  );
}
