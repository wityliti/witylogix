"use client";

import { useState, type ChangeEvent } from "react";
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
  FileUpload,
  Combobox,
  Timeline,
  StatusBadge,
  CommandPalette,
  DropdownMenu,
  StatCard,
} from "@/components/ui";
import { Copy, Check, AlertCircle, CheckCircle, Info } from "lucide-react";

/**
 * Component Gallery
 * Interactive showcase of all UI components with live previews and prop controls
 */

interface ComponentPreviewProps {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

interface CopyState {
  [key: string]: boolean;
}

function ComponentPreviewCard({ title, description, preview, code }: ComponentPreviewProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="border border-wl-border-subtle rounded-lg p-6 bg-wl-bg-surface flex items-center justify-center min-h-40">
          {preview}
        </div>

        {/* Code */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider">
              Code
            </label>
            <button
              onClick={handleCopyCode}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded",
                "bg-wl-bg-elevated border border-wl-border-default hover:border-wl-border-strong",
                "transition-colors",
                copiedCode && "bg-wl-success-500/20 border-wl-success-500"
              )}
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="bg-wl-bg-surface border border-wl-border-subtle rounded p-4 text-xs overflow-x-auto">
            <code className="text-wl-text-tertiary font-mono">{code}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComponentGalleryPage() {
  const [buttonSize, setButtonSize] = useState<"sm" | "md" | "lg">("md");
  const [buttonVariant, setButtonVariant] = useState<"primary" | "secondary" | "ghost" | "danger">("primary");
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [badgeVariant, setBadgeVariant] = useState<"default" | "success" | "warning" | "danger" | "info" | "primary">("primary");
  const [badgeWithDot, setBadgeWithDot] = useState(false);
  const [inputValue, setInputValue] = useState("Enter some text...");
  const [switchEnabled, setSwitchEnabled] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(65);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [toastVisible, setToastVisible] = useState(false);

  return (
    <div className="min-h-screen bg-wl-bg-root text-wl-text-primary">
      {/* Header */}
      <div className="border-b border-wl-border-subtle sticky top-0 z-40 bg-wl-bg-root/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Component Gallery</h1>
          <p className="text-wl-text-secondary">
            Interactive showcase of all design system components
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BUTTON COMPONENT */}
          <ComponentPreviewCard
            title="Button"
            description="Primary action button with variants and sizes"
            preview={
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Button
                  variant={buttonVariant}
                  size={buttonSize}
                  disabled={buttonDisabled}
                >
                  {buttonVariant.charAt(0).toUpperCase() + buttonVariant.slice(1)}
                </Button>
              </div>
            }
            code={`<Button variant="${buttonVariant}" size="${buttonSize}" disabled={${buttonDisabled}}>
  Click me
</Button>`}
          />

          {/* BUTTON CONTROLS */}
          <Card>
            <CardHeader>
              <CardTitle>Button Props</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2 block">
                  Variant
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["primary", "secondary", "ghost", "danger"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setButtonVariant(v as any)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        buttonVariant === v
                          ? "bg-wl-primary-500 text-wl-text-inverse"
                          : "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2 block">
                  Size
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["sm", "md", "lg"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setButtonSize(s as any)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        buttonSize === s
                          ? "bg-wl-primary-500 text-wl-text-inverse"
                          : "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={buttonDisabled}
                  onCheckedChange={(checked) => setButtonDisabled(checked === true)}
                  id="button-disabled"
                />
                <label htmlFor="button-disabled" className="text-sm text-wl-text-primary">
                  Disabled
                </label>
              </div>
            </CardContent>
          </Card>

          {/* BADGE COMPONENT */}
          <ComponentPreviewCard
            title="Badge"
            description="Small label or tag component"
            preview={
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Badge variant={badgeVariant} dot={badgeWithDot}>
                  {badgeVariant.toUpperCase()}
                </Badge>
              </div>
            }
            code={`<Badge variant="${badgeVariant}" dot={${badgeWithDot}}>
  Label
</Badge>`}
          />

          {/* BADGE CONTROLS */}
          <Card>
            <CardHeader>
              <CardTitle>Badge Props</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2 block">
                  Variant
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["default", "success", "warning", "danger", "info", "primary"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBadgeVariant(v as any)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        badgeVariant === v
                          ? "bg-wl-primary-500 text-wl-text-inverse"
                          : "bg-wl-bg-surface border border-wl-border-default hover:border-wl-border-strong"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={badgeWithDot}
                  onCheckedChange={(checked) => setBadgeWithDot(checked === true)}
                  id="badge-dot"
                />
                <label htmlFor="badge-dot" className="text-sm text-wl-text-primary">
                  Show Dot
                </label>
              </div>
            </CardContent>
          </Card>

          {/* CARD COMPONENT */}
          <ComponentPreviewCard
            title="Card"
            description="Container for grouped content"
            preview={
              <Card className="w-full max-w-xs">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card subtitle or description</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-wl-text-secondary">
                    This is the main content area of the card component.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" size="sm">
                    Action
                  </Button>
                </CardFooter>
              </Card>
            }
            code={`<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>`}
          />

          {/* INPUT COMPONENT */}
          <ComponentPreviewCard
            title="Input"
            description="Text input field"
            preview={
              <Input
                value={inputValue}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                placeholder="Type something..."
                className="w-full max-w-xs"
              />
            }
            code={`<Input
  placeholder="Enter text..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>`}
          />

          {/* SELECT COMPONENT */}
          <ComponentPreviewCard
            title="Select"
            description="Dropdown selection input"
            preview={
              <Select defaultValue="option1" onValueChange={() => {}}>
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </Select>
            }
            code={`<Select defaultValue="option1">
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
  <option value="option3">Option 3</option>
</Select>`}
          />

          {/* SWITCH COMPONENT */}
          <ComponentPreviewCard
            title="Switch"
            description="Toggle switch for on/off states"
            preview={
              <div className="flex items-center gap-3">
                <Switch
                  checked={switchEnabled}
                  onCheckedChange={(checked) => setSwitchEnabled(checked === true)}
                  id="switch-demo"
                />
                <label htmlFor="switch-demo" className="text-sm text-wl-text-secondary">
                  {switchEnabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            }
            code={`<Switch
  checked={enabled}
  onCheckedChange={(checked) => setEnabled(checked)}
  id="switch-demo"
/>`}
          />

          {/* CHECKBOX COMPONENT */}
          <ComponentPreviewCard
            title="Checkbox"
            description="Checkbox input for selections"
            preview={
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={checkboxChecked}
                  onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
                  id="checkbox-demo"
                />
                <label htmlFor="checkbox-demo" className="text-sm text-wl-text-secondary">
                  {checkboxChecked ? "Checked" : "Unchecked"}
                </label>
              </div>
            }
            code={`<Checkbox
  checked={checked}
  onCheckedChange={(checked) => setChecked(checked)}
  id="checkbox-demo"
/>`}
          />

          {/* ALERT COMPONENT */}
          <ComponentPreviewCard
            title="Alert"
            description="Alert message with variant styles"
            preview={
              <div className="w-full max-w-xs space-y-2">
                <Alert variant="success">Success alert message</Alert>
                <Alert variant="danger">Error alert message</Alert>
                <Alert variant="warning">Warning alert message</Alert>
              </div>
            }
            code={`<Alert variant="success">Success message</Alert>
<Alert variant="danger">Error message</Alert>
<Alert variant="warning">Warning message</Alert>`}
          />

          {/* PROGRESS COMPONENT */}
          <ComponentPreviewCard
            title="Progress"
            description="Progress bar indicator"
            preview={
              <div className="w-full max-w-xs space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs text-wl-text-secondary">Progress: {progressValue}%</label>
                  </div>
                  <Progress value={progressValue} />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressValue}
                  onChange={(e) => setProgressValue(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            }
            code={`<Progress value={65} />`}
          />

          {/* AVATAR COMPONENT */}
          <ComponentPreviewCard
            title="Avatar"
            description="User avatar component"
            preview={
              <div className="flex items-center justify-center gap-4">
                <Avatar name="John Doe" />
                <Avatar name="Jane Smith" />
              </div>
            }
            code={`<Avatar name="John Doe" />
<Avatar name="Jane Smith" />`}
          />

          {/* BREADCRUMB COMPONENT */}
          <ComponentPreviewCard
            title="Breadcrumb"
            description="Navigation breadcrumb trail"
            preview={
              <Breadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Components", href: "/components" },
                  { label: "Breadcrumb", href: "#" },
                ]}
              />
            }
            code={`<Breadcrumb
  items={[
    { label: "Home", href: "/" },
    { label: "Components", href: "/components" },
    { label: "Current", href: "#" },
  ]}
/>`}
          />

          {/* TABS COMPONENT */}
          <ComponentPreviewCard
            title="Tabs"
            description="Tab navigation component"
            preview={
              <Tabs defaultValue="tab1">
                <div className="flex gap-2 mb-4 border-b border-wl-border-subtle">
                  <button className="px-3 py-2 text-sm border-b-2 border-wl-primary-500 text-wl-primary-400 font-medium">
                    Tab 1
                  </button>
                  <button className="px-3 py-2 text-sm text-wl-text-secondary hover:text-wl-text-primary">
                    Tab 2
                  </button>
                </div>
                <div>Tab 1 content here</div>
              </Tabs>
            }
            code={`<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>`}
          />

          {/* TOOLTIP COMPONENT */}
          <ComponentPreviewCard
            title="Tooltip"
            description="Hover tooltip component"
            preview={
              <Tooltip text="This is a helpful tooltip">
                <Button variant="secondary">Hover me</Button>
              </Tooltip>
            }
            code={`<Tooltip text="Helpful text">
  <Button>Hover me</Button>
</Tooltip>`}
          />

          {/* SKELETON COMPONENT */}
          <ComponentPreviewCard
            title="Skeleton"
            description="Loading placeholder"
            preview={
              <div className="w-full max-w-xs space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            }
            code={`<Skeleton className="h-12 w-full" />
<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-2/3" />`}
          />

          {/* EMPTY STATE COMPONENT */}
          <ComponentPreviewCard
            title="EmptyState"
            description="Empty state message"
            preview={
              <EmptyState
                title="No items found"
                description="There are no items to display"
              />
            }
            code={`<EmptyState
  title="No items found"
  description="There are no items to display"
/>`}
          />

          {/* DATE PICKER COMPONENT */}
          <ComponentPreviewCard
            title="DatePicker"
            description="Date selection component"
            preview={
              <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
              />
            }
            code={`<DatePicker
  selected={selectedDate}
  onChange={(date) => setSelectedDate(date)}
/>`}
          />

          {/* PAGINATION COMPONENT */}
          <ComponentPreviewCard
            title="Pagination"
            description="Page navigation"
            preview={
              <Pagination
                currentPage={2}
                totalPages={5}
                onPageChange={() => {}}
              />
            }
            code={`<Pagination
  currentPage={2}
  totalPages={5}
  onPageChange={(page) => setPage(page)}
/>`}
          />

          {/* STAT CARD COMPONENT */}
          <ComponentPreviewCard
            title="StatCard"
            description="Statistics display card"
            preview={
              <StatCard
                label="Total Orders"
                value="1,234"
                change="+12%"
                trend="up"
              />
            }
            code={`<StatCard
  label="Total Orders"
  value="1,234"
  change="+12%"
  trend="up"
/>`}
          />

          {/* STATUS BADGE COMPONENT */}
          <ComponentPreviewCard
            title="StatusBadge"
            description="Status indicator badge"
            preview={
              <div className="flex gap-3 flex-wrap">
                <StatusBadge status="active" label="Active" />
                <StatusBadge status="inactive" label="Inactive" />
                <StatusBadge status="pending" label="Pending" />
              </div>
            }
            code={`<StatusBadge status="active" label="Active" />
<StatusBadge status="inactive" label="Inactive" />
<StatusBadge status="pending" label="Pending" />`}
          />

          {/* TIMELINE COMPONENT */}
          <ComponentPreviewCard
            title="Timeline"
            description="Timeline event display"
            preview={
              <Timeline
                items={[
                  { label: "Event 1", timestamp: "2024-03-01" },
                  { label: "Event 2", timestamp: "2024-03-02" },
                  { label: "Event 3", timestamp: "2024-03-03" },
                ]}
              />
            }
            code={`<Timeline
  items={[
    { label: "Event 1", timestamp: "2024-03-01" },
    { label: "Event 2", timestamp: "2024-03-02" },
    { label: "Event 3", timestamp: "2024-03-03" },
  ]}
/>`}
          />

          {/* ALERT WITH ICONS */}
          <ComponentPreviewCard
            title="Alert with Icons"
            description="Alert with status icons"
            preview={
              <div className="w-full max-w-xs space-y-3">
                <div className="flex gap-2 p-3 rounded-lg border border-wl-info-500/30 bg-wl-info-500/10">
                  <Info className="w-5 h-5 text-wl-info-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-wl-info-400">Info Message</p>
                    <p className="text-xs text-wl-text-tertiary">This is an informational alert</p>
                  </div>
                </div>
              </div>
            }
            code={`<div className="flex gap-2 p-3 rounded-lg border border-info-500/30 bg-info-500/10">
  <Info className="w-5 h-5 text-info-500" />
  <div>
    <p className="text-sm font-medium">Info Message</p>
  </div>
</div>`}
          />

          {/* BUTTON LOADING STATE */}
          <ComponentPreviewCard
            title="Button Loading"
            description="Button with loading state"
            preview={
              <div className="flex gap-3">
                <Button variant="primary">Normal</Button>
                <Button variant="primary" disabled>
                  Loading...
                </Button>
              </div>
            }
            code={`<Button variant="primary" disabled>
  Loading...
</Button>`}
          />

          {/* MODAL COMPONENT */}
          <ComponentPreviewCard
            title="Modal"
            description="Modal dialog component"
            preview={
              <Button
                variant="primary"
                onClick={() => setModalOpen(true)}
              >
                Open Modal
              </Button>
            }
            code={`<Modal
  title="Modal Title"
  description="Modal description"
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
>
  Modal content here
</Modal>`}
          />

          {/* FILE UPLOAD COMPONENT */}
          <ComponentPreviewCard
            title="FileUpload"
            description="File upload component"
            preview={
              <FileUpload
                onFilesSelected={() => {}}
                accept="image/*"
                maxSize={5}
              />
            }
            code={`<FileUpload
  onFilesSelected={(files) => console.log(files)}
  accept="image/*"
  maxSize={5}
/>`}
          />

          {/* COMBOBOX COMPONENT */}
          <ComponentPreviewCard
            title="Combobox"
            description="Searchable dropdown"
            preview={
              <Combobox
                options={[
                  { label: "Option 1", value: "1" },
                  { label: "Option 2", value: "2" },
                  { label: "Option 3", value: "3" },
                ]}
                onSelect={() => {}}
                placeholder="Search..."
              />
            }
            code={`<Combobox
  options={[
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" },
  ]}
  onSelect={(option) => console.log(option)}
  placeholder="Search..."
/>`}
          />

          {/* DROPDOWN MENU COMPONENT */}
          <ComponentPreviewCard
            title="DropdownMenu"
            description="Dropdown menu with actions"
            preview={
              <DropdownMenu
                trigger={<Button variant="secondary">Menu</Button>}
                items={[
                  { label: "Action 1", onClick: () => {} },
                  { label: "Action 2", onClick: () => {} },
                  { label: "Action 3", onClick: () => {} },
                ]}
              />
            }
            code={`<DropdownMenu
  trigger={<Button>Menu</Button>}
  items={[
    { label: "Action 1", onClick: () => {} },
    { label: "Action 2", onClick: () => {} },
  ]}
/>`}
          />

          {/* COMMAND PALETTE */}
          <ComponentPreviewCard
            title="CommandPalette"
            description="Command palette for actions"
            preview={
              <Button variant="secondary">
                Command Palette (Cmd+K)
              </Button>
            }
            code={`<CommandPalette
  commands={[
    { label: "Command 1", action: () => {} },
    { label: "Command 2", action: () => {} },
  ]}
/>`}
          />

          {/* TABLE COMPONENT */}
          <ComponentPreviewCard
            title="Table"
            description="Data table component"
            preview={
              <Table
                columns={[
                  { header: "Name", accessor: "name" },
                  { header: "Status", accessor: "status" },
                  { header: "Date", accessor: "date" },
                ]}
                data={[
                  { name: "Item 1", status: "Active", date: "2024-03-01" },
                  { name: "Item 2", status: "Inactive", date: "2024-03-02" },
                ]}
              />
            }
            code={`<Table
  columns={[
    { header: "Name", accessor: "name" },
    { header: "Status", accessor: "status" },
  ]}
  data={[
    { name: "Item 1", status: "Active" },
    { name: "Item 2", status: "Inactive" },
  ]}
/>`}
          />
        </div>
      </div>
    </div>
  );
}
