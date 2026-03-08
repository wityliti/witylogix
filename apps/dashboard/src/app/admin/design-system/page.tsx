"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
      className={cn("bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-wl-text-secondary transition-all")}
      title="Copy token"
    >
      {copied ? (
        <Check className={cn("w-4 h-4 text-wl-success-500")} />
      ) : (
        <Copy className={cn("w-4 h-4")} />
      )}
    </button>
  );
};

// Color Palette Section
const ColorPaletteSection = () => {
  return (
    <Card className={cn("bg-wl-bg-surface border-wl-border-subtle mb-6")}>
      <CardHeader className={cn("pb-3 flex items-center gap-3")}>
        <Palette className={cn("w-5 h-5 text-wl-text-secondary")} />
        <CardTitle>Color Palette</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-6")}>
          {Object.entries(COLOR_TOKENS).map(([categoryName, colors]) => (
            <div key={categoryName}>
              <h4 className={cn("text-sm font-semibold text-wl-text-secondary mb-3 uppercase tracking-widest")}>
                {categoryName}
              </h4>
              <div className={cn("grid gap-4 auto-fill")} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {Object.entries(colors).map(([tokenName, hexValue]) => (
                  <div key={tokenName} className={cn("flex gap-3 items-start")}>
                    <div
                      className={cn("w-15 h-15 rounded-md border border-wl-border-default flex-shrink-0")}
                      style={{ backgroundColor: hexValue }}
                    />
                    <div className={cn("flex-1 min-w-0")}>
                      <p className={cn("m-0 text-xs font-semibold text-wl-text-primary mb-0.5")}>
                        {tokenName}
                      </p>
                      <code className={cn("text-xs text-wl-text-secondary font-mono flex items-center gap-1 justify-between")}>
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
    <Card className={cn("bg-wl-bg-surface border-wl-border-subtle mb-6")}>
      <CardHeader className={cn("pb-3 flex items-center gap-3")}>
        <Type className={cn("w-5 h-5 text-wl-text-secondary")} />
        <CardTitle>Typography</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-4")}>
          {TYPOGRAPHY_SAMPLES.map((sample, idx) => (
            <div key={idx} className={cn("flex items-center gap-4 pb-4", { "border-b border-wl-border-subtle": idx < TYPOGRAPHY_SAMPLES.length - 1 })}>
              <div className={cn("min-w-20")}>
                <p className={cn("m-0 text-xs font-semibold text-wl-text-secondary uppercase tracking-widest")}>
                  {sample.name}
                </p>
                <code className={cn("text-xs text-wl-text-tertiary font-mono")}>
                  {sample.size} / {sample.weight}
                </code>
              </div>
              <div className={cn("flex-1")}>
                <div style={{ fontSize: sample.size as any, fontWeight: sample.weight as any }} className={cn("text-wl-text-primary font-sans")}>
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
    <Card className={cn("bg-wl-bg-surface border-wl-border-subtle mb-6")}>
      <CardHeader className={cn("pb-3 flex items-center gap-3")}>
        <Layout className={cn("w-5 h-5 text-wl-text-secondary")} />
        <CardTitle>Spacing Scale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-4")}>
          {SPACING_SCALE.map((space) => (
            <div key={space.name} className={cn("flex items-center gap-4")}>
              <div className={cn("min-w-16")}>
                <p className={cn("m-0 text-xs font-semibold text-wl-text-secondary")}>
                  --wl-space-{space.name}
                </p>
                <p className={cn("m-0 mt-0.5 text-xs text-wl-text-tertiary")}>
                  {space.label || "0"}
                </p>
              </div>
              <div
                className={cn("h-0.5 bg-wl-primary-500 rounded")}
                style={{
                  width: `${Math.max(space.value, 4)}px`,
                }}
              />
              <div className={cn("min-w-10 text-right")}>
                <code className={cn("text-xs text-wl-text-secondary font-mono")}>
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
    <div className={cn("grid gap-6")}>
      {/* Buttons */}
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("grid gap-4 auto-fit")} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
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
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("flex flex-wrap gap-3")}>
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
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
          <CardTitle>Form Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("grid gap-4 max-w-md")}>
            <div>
              <label className={cn("text-sm font-medium text-wl-text-primary block mb-2")}>
                Input Field
              </label>
              <Input placeholder="Enter text..." />
            </div>
            <div>
              <label className={cn("text-sm font-medium text-wl-text-primary block mb-2")}>
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
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
          <CardTitle>Stat Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("grid gap-4 auto-fit")} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
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
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
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
      <Card className={cn("bg-wl-bg-surface border-wl-border-subtle")}>
        <CardHeader className={cn("pb-3")}>
          <CardTitle>Modal</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          {modalOpen && (
            <Modal onClose={() => setModalOpen(false)}>
              <div className={cn("p-6")}>
                <h2 className={cn("text-xl font-bold text-wl-text-primary m-0 mb-3")}>
                  Modal Example
                </h2>
                <p className={cn("text-wl-text-secondary m-0 mb-4")}>
                  This is a sample modal dialog showing component usage in the design system.
                </p>
                <div className={cn("flex gap-3 justify-end")}>
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
    <div className={cn("bg-wl-bg-root")}>
      <Header
        title="Design System"
        subtitle="Comprehensive guide to colors, typography, spacing, and components"
      />

      <main className={cn("p-6 max-w-6xl mx-auto")}>
        {/* Navigation Tabs */}
        <div className={cn("mb-8")}>
          <Tabs
            tabs={[
              { id: "colors", label: "Colors", icon: <Palette className={cn("w-4 h-4")} /> },
              { id: "typography", label: "Typography", icon: <Type className={cn("w-4 h-4")} /> },
              { id: "spacing", label: "Spacing", icon: <Layout className={cn("w-4 h-4")} /> },
              { id: "components", label: "Components", icon: <Bell className={cn("w-4 h-4")} /> },
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
