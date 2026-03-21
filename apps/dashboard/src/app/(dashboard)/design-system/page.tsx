"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
  Input,
  Select,
  Modal,
  Table,
  DatePicker,
  Switch,
  Checkbox,
  Alert,
  Progress,
  Avatar,
  Breadcrumb,
  Tabs,
  Tooltip,
  Skeleton,
  EmptyState,
  Pagination,
  Toast,
} from "@/components/ui";
import {
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Eye,
  Code,
} from "lucide-react";

interface ComponentExample {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

interface CodeBlockProps {
  code: string;
}

function CodeBlock({ code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-[#0a0a0f] rounded-md overflow-hidden border border-[#1e1e2e]">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-[#12121a] hover:bg-[#1a1a2e] border border-[#1e1e2e] rounded-md text-xs font-medium text-gray-300 transition-all duration-fast"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" /> Copy
          </>
        )}
      </button>

      <pre className="p-4 pr-24 overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface PreviewSectionProps {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

function PreviewSection({
  title,
  description,
  preview,
  code,
}: PreviewSectionProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">
          {title}
        </h4>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-md p-6 flex items-center justify-center min-h-24">
        {preview}
      </div>

      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
      >
        {showCode ? (
          <>
            <Eye className="w-3 h-3" /> Hide Code
          </>
        ) : (
          <>
            <Code className="w-3 h-3" /> Show Code
          </>
        )}
      </button>

      {showCode && <CodeBlock code={code} />}
    </div>
  );
}

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState("buttons");
  const [modalOpen, setModalOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [switchEnabled, setSwitchEnabled] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            Design System
          </h1>
          <p className="text-gray-300 max-w-2xl">
            Witylogix component library. All components use Tailwind CSS v3.4 with
            design tokens (--wl-*) for consistent styling across the platform.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#1e1e2e] sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8 overflow-x-auto">
            {[
              "buttons",
              "badges",
              "colors",
              "inputs",
              "selects",
              "cards",
              "modals",
              "tables",
              "typography",
              "forms",
              "a11y",
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "text-sm font-medium py-4 px-1 border-b-2 transition-all duration-fast whitespace-nowrap",
                  activeTab === tab
                    ? "text-blue-500 border-b-blue-500"
                    : "text-gray-300 border-b-transparent hover:text-white"
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Buttons */}
        {activeTab === "buttons" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Buttons
              </h2>
              <p className="text-gray-300 mb-8">
                Button component with 4 variants: primary, secondary, ghost, and danger.
                Supports small, medium, and large sizes.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PreviewSection
                  title="Primary Button"
                  description="Main action button with gradient background"
                  preview={<Button variant="primary">Primary Action</Button>}
                  code={`<Button variant="primary">Primary Action</Button>`}
                />

                <PreviewSection
                  title="Secondary Button"
                  description="Secondary action button with border"
                  preview={<Button variant="secondary">Secondary Action</Button>}
                  code={`<Button variant="secondary">Secondary Action</Button>`}
                />

                <PreviewSection
                  title="Ghost Button"
                  description="Subtle button with transparent background"
                  preview={<Button variant="ghost">Ghost Action</Button>}
                  code={`<Button variant="ghost">Ghost Action</Button>`}
                />

                <PreviewSection
                  title="Danger Button"
                  description="Destructive action button"
                  preview={<Button variant="danger">Delete</Button>}
                  code={`<Button variant="danger">Delete</Button>`}
                />

                <PreviewSection
                  title="Button Sizes"
                  description="Small, medium (default), and large sizes"
                  preview={
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="primary">
                        Small
                      </Button>
                      <Button size="md" variant="primary">
                        Medium
                      </Button>
                      <Button size="lg" variant="primary">
                        Large
                      </Button>
                    </div>
                  }
                  code={`<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`}
                />

                <PreviewSection
                  title="Disabled Button"
                  description="Buttons in disabled state"
                  preview={
                    <div className="flex items-center gap-3">
                      <Button disabled variant="primary">
                        Disabled Primary
                      </Button>
                      <Button disabled variant="secondary">
                        Disabled Secondary
                      </Button>
                    </div>
                  }
                  code={`<Button disabled variant="primary">Disabled</Button>`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Badges */}
        {activeTab === "badges" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Badges
              </h2>
              <p className="text-gray-300 mb-8">
                Badge component with 6 variants: default, success, warning, danger, info,
                and primary. Optional dot indicator.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PreviewSection
                  title="Default Badge"
                  description="Standard badge styling"
                  preview={<Badge>Default</Badge>}
                  code={`<Badge>Default</Badge>`}
                />

                <PreviewSection
                  title="Success Badge"
                  description="Used for positive states"
                  preview={<Badge variant="success">Active</Badge>}
                  code={`<Badge variant="success">Active</Badge>`}
                />

                <PreviewSection
                  title="Warning Badge"
                  description="Used for cautionary states"
                  preview={<Badge variant="warning">Pending</Badge>}
                  code={`<Badge variant="warning">Pending</Badge>`}
                />

                <PreviewSection
                  title="Danger Badge"
                  description="Used for error/critical states"
                  preview={<Badge variant="danger">Failed</Badge>}
                  code={`<Badge variant="danger">Failed</Badge>`}
                />

                <PreviewSection
                  title="Info Badge"
                  description="Used for informational content"
                  preview={<Badge variant="info">Update</Badge>}
                  code={`<Badge variant="info">Update</Badge>`}
                />

                <PreviewSection
                  title="Primary Badge"
                  description="Brand-colored badge"
                  preview={<Badge variant="primary">Premium</Badge>}
                  code={`<Badge variant="primary">Premium</Badge>`}
                />

                <PreviewSection
                  title="Badge with Dot"
                  description="Optional indicator dot"
                  preview={
                    <div className="flex gap-3">
                      <Badge dot variant="success">
                        Online
                      </Badge>
                      <Badge dot variant="danger">
                        Offline
                      </Badge>
                    </div>
                  }
                  code={`<Badge dot variant="success">Online</Badge>
<Badge dot variant="danger">Offline</Badge>`}
                />

                <PreviewSection
                  title="Badge Combinations"
                  description="Multiple badges together"
                  preview={
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">Delivered</Badge>
                      <Badge variant="primary">Expedited</Badge>
                      <Badge variant="info">Tracked</Badge>
                    </div>
                  }
                  code={`<Badge variant="success">Delivered</Badge>
<Badge variant="primary">Expedited</Badge>
<Badge variant="info">Tracked</Badge>`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Colors */}
        {activeTab === "colors" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Color Palette
              </h2>
              <p className="text-gray-300 mb-8">
                Design tokens for colors used throughout the platform. Dark theme with
                amber primary color for logistics warmth.
              </p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Primary Colors (Amber)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { name: "50", hex: "#fff9eb", token: "--blue-50" },
                      { name: "100", hex: "#ffefc4", token: "--blue-100" },
                      { name: "200", hex: "#ffe09d", token: "--blue-200" },
                      { name: "300", hex: "#ffd06a", token: "--blue-300" },
                      { name: "400", hex: "#ffc240", token: "--blue-400" },
                      { name: "500", hex: "#f5a623", token: "--blue-500" },
                      { name: "600", hex: "#d98b0a", token: "--blue-600" },
                      { name: "700", hex: "#b06f05", token: "--blue-700" },
                      { name: "800", hex: "#8d5704", token: "--blue-800" },
                      { name: "900", hex: "#6b4203", token: "--blue-900" },
                    ].map((color) => (
                      <div key={color.name}>
                        <div
                          className="w-full h-24 rounded-md mb-2 border border-[#1e1e2e]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <p className="text-xs font-mono text-gray-300">
                          {color.hex}
                        </p>
                        <p className="text-xs text-gray-400">
                          {color.token}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Semantic Colors
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div
                        className="w-full h-32 rounded-md mb-2 border border-[#1e1e2e]"
                        style={{ backgroundColor: "#34d399" }}
                      />
                      <p className="text-sm font-semibold text-white">
                        Success
                      </p>
                      <p className="text-xs font-mono text-gray-300">
                        #34d399
                      </p>
                      <p className="text-xs text-gray-400">
                        --emerald-500
                      </p>
                    </div>

                    <div>
                      <div
                        className="w-full h-32 rounded-md mb-2 border border-[#1e1e2e]"
                        style={{ backgroundColor: "#fbbf24" }}
                      />
                      <p className="text-sm font-semibold text-white">
                        Warning
                      </p>
                      <p className="text-xs font-mono text-gray-300">
                        #fbbf24
                      </p>
                      <p className="text-xs text-gray-400">
                        --amber-500
                      </p>
                    </div>

                    <div>
                      <div
                        className="w-full h-32 rounded-md mb-2 border border-[#1e1e2e]"
                        style={{ backgroundColor: "#f87171" }}
                      />
                      <p className="text-sm font-semibold text-white">
                        Danger
                      </p>
                      <p className="text-xs font-mono text-gray-300">
                        #f87171
                      </p>
                      <p className="text-xs text-gray-400">
                        --red-500
                      </p>
                    </div>

                    <div>
                      <div
                        className="w-full h-32 rounded-md mb-2 border border-[#1e1e2e]"
                        style={{ backgroundColor: "#60a5fa" }}
                      />
                      <p className="text-sm font-semibold text-white">
                        Info
                      </p>
                      <p className="text-xs font-mono text-gray-300">
                        #60a5fa
                      </p>
                      <p className="text-xs text-gray-400">
                        --blue-500
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Background Colors
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name: "Root", hex: "#0a0a0c", token: "--wl-bg-root" },
                      { name: "Surface", hex: "#111114", token: "--wl-bg-surface" },
                      { name: "Elevated", hex: "#19191e", token: "--wl-bg-elevated" },
                      { name: "Overlay", hex: "#1f1f26", token: "--wl-bg-overlay" },
                      { name: "Sidebar", hex: "#0c0c10", token: "--wl-bg-sidebar" },
                      { name: "Sunken", hex: "#07070a", token: "--wl-bg-sunken" },
                    ].map((color) => (
                      <div key={color.name}>
                        <div
                          className="w-full h-20 rounded-md mb-2 border border-[#1e1e2e]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <p className="text-sm font-semibold text-white">
                          {color.name}
                        </p>
                        <p className="text-xs font-mono text-gray-300">
                          {color.hex}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inputs */}
        {activeTab === "inputs" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Input Fields
              </h2>
              <p className="text-gray-300 mb-8">
                Text input component with support for labels, errors, hints, and icons.
                Available in small, medium, and large sizes.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
                <PreviewSection
                  title="Basic Input"
                  description="Default input with placeholder"
                  preview={
                    <Input placeholder="Enter text here..." className="w-full" />
                  }
                  code={`<Input placeholder="Enter text here..." />`}
                />

                <PreviewSection
                  title="Input with Label"
                  description="Input with associated label"
                  preview={
                    <Input
                      label="Email Address"
                      placeholder="user@example.com"
                      className="w-full"
                    />
                  }
                  code={`<Input label="Email Address" placeholder="user@example.com" />`}
                />

                <PreviewSection
                  title="Input with Error"
                  description="Shows validation error state"
                  preview={
                    <Input
                      label="Username"
                      error="Username already taken"
                      placeholder="username"
                      className="w-full"
                    />
                  }
                  code={`<Input label="Username" error="Username already taken" />`}
                />

                <PreviewSection
                  title="Input with Hint"
                  description="Helper text below input"
                  preview={
                    <Input
                      label="Password"
                      hint="Minimum 8 characters"
                      type="password"
                      className="w-full"
                    />
                  }
                  code={`<Input label="Password" hint="Minimum 8 characters" type="password" />`}
                />

                <PreviewSection
                  title="Disabled Input"
                  description="Input in disabled state"
                  preview={
                    <Input
                      label="Fixed Value"
                      value="Cannot edit"
                      disabled
                      className="w-full"
                    />
                  }
                  code={`<Input label="Fixed Value" value="Cannot edit" disabled />`}
                />

                <PreviewSection
                  title="Input Sizes"
                  description="Small, medium (default), and large"
                  preview={
                    <div className="w-full space-y-3">
                      <Input size="sm" placeholder="Small" />
                      <Input size="md" placeholder="Medium" />
                      <Input size="lg" placeholder="Large" />
                    </div>
                  }
                  code={`<Input size="sm" placeholder="Small" />
<Input size="md" placeholder="Medium" />
<Input size="lg" placeholder="Large" />`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Selects */}
        {activeTab === "selects" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Select Dropdown
              </h2>
              <p className="text-gray-300 mb-8">
                Dropdown select component with label, error states, and size variants.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
                <PreviewSection
                  title="Basic Select"
                  description="Standard select dropdown"
                  preview={
                    <Select
                      placeholder="Choose an option"
                      options={[
                        { value: "opt1", label: "Option 1" },
                        { value: "opt2", label: "Option 2" },
                        { value: "opt3", label: "Option 3" },
                      ]}
                      className="w-full"
                    />
                  }
                  code={`<Select
  placeholder="Choose an option"
  options={[
    { value: "opt1", label: "Option 1" },
    { value: "opt2", label: "Option 2" },
  ]}
/>`}
                />

                <PreviewSection
                  title="Select with Label"
                  description="Select with associated label"
                  preview={
                    <Select
                      label="Status"
                      placeholder="Select status"
                      options={[
                        { value: "active", label: "Active" },
                        { value: "pending", label: "Pending" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      className="w-full"
                    />
                  }
                  code={`<Select label="Status" placeholder="Select status" options={...} />`}
                />

                <PreviewSection
                  title="Select with Error"
                  description="Error state indication"
                  preview={
                    <Select
                      label="Region"
                      error="Please select a region"
                      placeholder="Select region"
                      options={[
                        { value: "north", label: "North" },
                        { value: "south", label: "South" },
                      ]}
                      className="w-full"
                    />
                  }
                  code={`<Select label="Region" error="Please select a region" options={...} />`}
                />

                <PreviewSection
                  title="Disabled Select"
                  description="Select in disabled state"
                  preview={
                    <Select
                      label="Type"
                      disabled
                      placeholder="Select type"
                      options={[
                        { value: "a", label: "Type A" },
                        { value: "b", label: "Type B" },
                      ]}
                      className="w-full"
                    />
                  }
                  code={`<Select label="Type" disabled options={...} />`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
        {activeTab === "cards" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Cards
              </h2>
              <p className="text-gray-300 mb-8">
                Card component with optional header, content, and footer sections.
                Supports hover and glow effects.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PreviewSection
                  title="Basic Card"
                  description="Standard card styling"
                  preview={
                    <Card className="w-full">
                      <CardContent>
                        <p>This is a basic card with content.</p>
                      </CardContent>
                    </Card>
                  }
                  code={`<Card>
  <CardContent>
    <p>This is a basic card with content.</p>
  </CardContent>
</Card>`}
                />

                <PreviewSection
                  title="Card with Header"
                  description="Card with title and description"
                  preview={
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle>Card Title</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>
                          This card has a header with title and description.
                        </CardDescription>
                      </CardContent>
                    </Card>
                  }
                  code={`<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <CardDescription>Content here</CardDescription>
  </CardContent>
</Card>`}
                />

                <PreviewSection
                  title="Card with Footer"
                  description="Card with action buttons"
                  preview={
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle>Confirm Action</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>Are you sure you want to proceed?</p>
                      </CardContent>
                      <CardFooter>
                        <Button variant="secondary" size="sm">
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm">
                          Confirm
                        </Button>
                      </CardFooter>
                    </Card>
                  }
                  code={`<Card>
  <CardHeader>
    <CardTitle>Confirm Action</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Confirm</Button>
  </CardFooter>
</Card>`}
                />

                <PreviewSection
                  title="Hoverable Card"
                  description="Card with hover effect"
                  preview={
                    <Card hover className="w-full">
                      <CardContent>
                        <p>Hover over this card to see the effect.</p>
                      </CardContent>
                    </Card>
                  }
                  code={`<Card hover>
  <CardContent>
    <p>Hover over this card</p>
  </CardContent>
</Card>`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {activeTab === "modals" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Modals & Dialogs
              </h2>
              <p className="text-gray-300 mb-8">
                Modal dialog component with configurable sizes. Press Escape to close or
                click the backdrop.
              </p>

              <div className="space-y-4">
                <div>
                  <Button
                    onClick={() => setModalOpen(true)}
                    variant="primary"
                  >
                    Open Modal
                  </Button>
                </div>

                <Modal
                  isOpen={modalOpen}
                  onClose={() => setModalOpen(false)}
                  title="Modal Dialog"
                  size="md"
                  footer={
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setModalOpen(false)}
                      >
                        Confirm
                      </Button>
                    </div>
                  }
                >
                  <p className="text-gray-300 mb-4">
                    This is a modal dialog. You can add any content here, including forms,
                    messages, or confirmations.
                  </p>
                  <Input
                    label="Example Input"
                    placeholder="Enter something"
                  />
                </Modal>

                <Card>
                  <CardHeader>
                    <CardTitle>Modal Sizes</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300 space-y-2">
                    <p>Available sizes: sm, md, lg, full</p>
                    <p>
                      Use the size prop to control modal dimensions.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Tables */}
        {activeTab === "tables" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Tables
              </h2>
              <p className="text-gray-300 mb-8">
                Responsive table component for displaying structured data.
              </p>

              <Card className="w-full overflow-hidden">
                <Table>
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="text-left px-4 py-3 font-semibold text-white">
                        ID
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-white">
                        Name
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-white">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-white">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        id: "001",
                        name: "John Doe",
                        status: "Active",
                        date: "2024-01-15",
                      },
                      {
                        id: "002",
                        name: "Jane Smith",
                        status: "Pending",
                        date: "2024-01-14",
                      },
                      {
                        id: "003",
                        name: "Bob Johnson",
                        status: "Inactive",
                        date: "2024-01-13",
                      },
                    ].map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-[#1e1e2e] hover:bg-[#12121a] transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-300">
                          {row.id}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {row.name}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              row.status === "Active"
                                ? "success"
                                : row.status === "Pending"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {row.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* Typography */}
        {activeTab === "typography" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Typography
              </h2>
              <p className="text-gray-300 mb-8">
                Font family: DM Sans (sans), JetBrains Mono (mono). Text sizes from xs
                (11px) to 3xl (30px).
              </p>

              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Font Sizes
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Extra Small (11px)
                      </p>
                      <p className="text-xs">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Small (13px)
                      </p>
                      <p className="text-sm">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Base (14px)
                      </p>
                      <p className="text-base">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Large (17px)
                      </p>
                      <p className="text-lg">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Extra Large (20px)
                      </p>
                      <p className="text-xl">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        2XL (24px)
                      </p>
                      <p className="text-2xl">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        3XL (30px)
                      </p>
                      <p className="text-3xl">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Font Weights
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Regular (400)
                      </p>
                      <p className="font-normal">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Medium (500)
                      </p>
                      <p className="font-medium">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Semibold (600)
                      </p>
                      <p className="font-semibold">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Bold (700)
                      </p>
                      <p className="font-bold">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Monospace Font
                  </h3>
                  <p className="font-mono text-sm">
                    jetbrains mono: const foo = "bar";
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forms */}
        {activeTab === "forms" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Form Components
              </h2>
              <p className="text-gray-300 mb-8">
                Collections of form-related components: switches, checkboxes, and their
                combinations.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
                <PreviewSection
                  title="Switch Toggle"
                  description="Boolean toggle switch"
                  preview={
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={switchEnabled}
                        onChange={(e) => setSwitchEnabled(e.target.checked)}
                      />
                      <span className="text-sm text-gray-300">
                        {switchEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  }
                  code={`<Switch checked={enabled} onChange={handleChange} />`}
                />

                <PreviewSection
                  title="Checkbox"
                  description="Checkbox input element"
                  preview={
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={checkboxChecked}
                        onChange={(e) => setCheckboxChecked(e.target.checked)}
                      />
                      <span className="text-sm text-gray-300">
                        I agree to the terms
                      </span>
                    </div>
                  }
                  code={`<Checkbox checked={checked} onChange={handleChange} />`}
                />

                <PreviewSection
                  title="Form Layout"
                  description="Typical form with multiple inputs"
                  preview={
                    <div className="w-full max-w-sm space-y-4">
                      <Input
                        label="Full Name"
                        placeholder="John Doe"
                      />
                      <Input
                        label="Email"
                        type="email"
                        placeholder="john@example.com"
                      />
                      <Select
                        label="Country"
                        placeholder="Select country"
                        options={[
                          { value: "us", label: "United States" },
                          { value: "ca", label: "Canada" },
                        ]}
                      />
                      <Button variant="primary" className="w-full">
                        Submit
                      </Button>
                    </div>
                  }
                  code={`<form>
  <Input label="Full Name" placeholder="John Doe" />
  <Input label="Email" type="email" />
  <Select label="Country" options={...} />
  <Button>Submit</Button>
</form>`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Accessibility */}
        {activeTab === "a11y" && (
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Accessibility Features
              </h2>
              <p className="text-gray-300 mb-8">
                All components follow WCAG 2.1 accessibility guidelines with proper ARIA
                attributes, semantic HTML, and keyboard navigation support.
              </p>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Keyboard Navigation</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300 space-y-2">
                    <p>
                      Tab: Move focus to the next interactive element
                    </p>
                    <p>
                      Shift+Tab: Move focus to the previous interactive element
                    </p>
                    <p>
                      Enter/Space: Activate buttons, checkboxes, and toggles
                    </p>
                    <p>
                      Escape: Close modals and dropdowns
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>ARIA Attributes</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300 space-y-2">
                    <p>
                      aria-label: Provides accessible names for unlabeled elements
                    </p>
                    <p>
                      aria-hidden: Hides decorative elements from screen readers
                    </p>
                    <p>
                      aria-expanded: Indicates expanded/collapsed state
                    </p>
                    <p>
                      aria-disabled: Communicates disabled state
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Focus Management</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300 space-y-2">
                    <p>
                      All interactive elements have visible focus indicators
                    </p>
                    <p>
                      Focus outlines use --blue-500 color
                    </p>
                    <p>
                      Tab order follows logical visual structure
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Color Contrast</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-300 space-y-2">
                    <p>
                      All text meets WCAG AA contrast ratio requirements (4.5:1)
                    </p>
                    <p>
                      Colors are not used as sole means of conveying information
                    </p>
                    <p>
                      Icons are accompanied by text labels where necessary
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
