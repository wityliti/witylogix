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
    "--bg-root': '#0a0a0f'
    "--bg-base': '#0a0a0f'
    "--bg-surface': '#12121a'
    "--bg-elevated': '#1a1a2e'
    "--bg-overlay': '#1a1a2e'
    "#000": "#07070a",
    "#000": "#0c0c10",
  },
  "Neutral Colors": {
    "#000": "#f8f8fa",
    "#000": "#ececf1",
    "#000": "#d5d5dd",
    "#000": "#b0b0bf",
    "#000": "#8585a0",
    "#000": "#62627e",
    "#000": "#4a4a62",
    "#000": "#35354a",
    "#000": "#232336",
    "#000": "#17172a",
  },
  "Primary Colors (Amber)": {
    "--blue-50": "#fff9eb",
    "#000": "#ffefc4",
    "#000": "#ffe09d",
    "#000": "#ffd06a",
    "--blue-500": "#ffc240",
    "--blue-600": "#f5a623",
    "--blue-700": "#d98b0a",
    "#000": "#b06f05",
    "#000": "#8d5704",
    "#000": "#6b4203",
  },
  "Status Colors": {
    "--emerald-600": "#10b981",
    "--amber-600": "#f59e0b",
    "--red-600": "#ef4444",
    "--blue-600": "#3b82f6",
  },
  "Text Colors": {
    "--text-primary': '#ffffff'
    "--text-secondary': '#9ca3af'
    "#000": "#5e5e78",
    "#000": "#0a0a0c",
  },
  "Border Colors": {
    "--border-subtle': '#1e1e2e'
    "#000": "rgba(255, 255, 255, 0.10)",
    "#000": "rgba(255, 255, 255, 0.16)",
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
      className="bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-gray-400 transition-all hover:text-white"
      title="Copy token"
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-600" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
};

// Color Palette Section
const ColorPaletteSection = () => {
  return (
    <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3 flex items-center gap-3">
        <Palette className="w-5 h-5 text-gray-400" />
        <CardTitle>Color Palette</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {Object.entries(COLOR_TOKENS).map(([categoryName, colors]) => (
            <div key={categoryName}>
              <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">
                {categoryName}
              </h4>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {Object.entries(colors).map(([tokenName, hexValue]) => (
                  <div key={tokenName} className="flex gap-3 items-start">
                    <div
                      className="w-15 h-15 rounded-md border border-[#1e1e2e]-default flex-shrink-0"
                      style={{ backgroundColor: hexValue }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-xs font-semibold text-white mb-0.5">
                        {tokenName}
                      </p>
                      <code className="text-xs text-gray-400 font-mono flex items-center gap-1 justify-between">
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
    <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3 flex items-center gap-3">
        <Type className="w-5 h-5 text-gray-400" />
        <CardTitle>Typography</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {TYPOGRAPHY_SAMPLES.map((sample, idx) => (
            <div key={idx} className={cn("flex items-center gap-4 pb-4", { "border-b border-[#1e1e2e]": idx < TYPOGRAPHY_SAMPLES.length - 1 })}>
              <div className="min-w-20">
                <p className="m-0 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  {sample.name}
                </p>
                <code className="text-xs text-gray-400 font-mono">
                  {sample.size} / {sample.weight}
                </code>
              </div>
              <div className="flex-1">
                <div style={{ fontSize: sample.size as any, fontWeight: sample.weight as any }} className="text-white">
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
    <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3 flex items-center gap-3">
        <Layout className="w-5 h-5 text-gray-400" />
        <CardTitle>Spacing Scale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {SPACING_SCALE.map((space) => (
            <div key={space.name} className="flex items-center gap-4">
              <div className="min-w-16">
                <p className="m-0 text-xs font-semibold text-gray-400">
                  --wl-space-{space.name}
                </p>
                <p className="m-0 mt-0.5 text-xs text-gray-400">
                  {space.label || "0"}
                </p>
              </div>
              <div
                className="h-0.5 bg-blue-600 rounded"
                style={{
                  width: `${Math.max(space.value, 4)}px`,
                }}
              />
              <div className="min-w-10 text-right">
                <code className="text-xs text-gray-400 font-mono">
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
    <div className="grid gap-6">
      {/* Buttons */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
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
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
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
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <CardTitle>Form Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="text-sm font-medium text-white block mb-2">
                Input Field
              </label>
              <Input placeholder="Enter text..." />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-2">
                Select Field
              </label>
              <Select
                options={[
                  { value: "opt1", label: "Option 1" },
                  { value: "opt2", label: "Option 2" },
                  { value: "opt3", label: "Option 3" },
                ]}
                value="opt1"
                onChange={() => {}}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <CardTitle>Stat Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <StatCard
              label="Total Orders"
              value="2,345"
              icon={<Filter className="w-5 h-5" />}
              change={{ value: 12.5, label: "vs last month" }}
              accentColor="#f5a623"
            />
            <StatCard
              label="Active Drivers"
              value="128"
              icon={<CheckCircle2 className="w-5 h-5" />}
              change={{ value: 8.2, label: "vs last month" }}
              accentColor="#10b981"
            />
            <StatCard
              label="Pending Shipments"
              value="43"
              icon={<AlertCircle className="w-5 h-5" />}
              change={{ value: -5.1, label: "vs last month" }}
              accentColor="#ef4444"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
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
            onChange={() => {}}
            variant="pills"
            size="md"
          />
        </CardContent>
      </Card>

      {/* Modal Trigger */}
      <Card className="bg-[#12121a] border-[#1e1e2e]">
        <CardHeader className="pb-3">
          <CardTitle>Modal</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          {modalOpen && (
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
              <div className="p-6">
                <h2 className="text-xl font-bold text-white m-0 mb-3">
                  Modal Example
                </h2>
                <p className="text-gray-400 m-0 mb-4">
                  This is a sample modal dialog showing component usage in the design system.
                </p>
                <div className="flex gap-3 justify-end">
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
    <div className="bg-[#0a0a0f]-root">
      <Header
        title="Design System"
        subtitle="Comprehensive guide to colors, typography, spacing, and components"
      />

      <main className="p-6 max-w-6xl mx-auto">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <Tabs
            tabs={[
              { id: "colors", label: "Colors", icon: <Palette className="w-4 h-4" /> },
              { id: "typography", label: "Typography", icon: <Type className="w-4 h-4" /> },
              { id: "spacing", label: "Spacing", icon: <Layout className="w-4 h-4" /> },
              { id: "components", label: "Components", icon: <Bell className="w-4 h-4" /> },
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
