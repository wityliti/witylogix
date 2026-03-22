/* ═══════════════════════════════════════════════════════════
   UI COMPONENTS BARREL EXPORT
   Central export point for all UI components
   ═══════════════════════════════════════════════════════════ */

// Button
export { Button } from "./button";

// Card (also exports MetricCard, StatCard)
export {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
  MetricCard,
  StatCard,
} from "./card";

// Badge
export { Badge } from "./badge";

// Input
export { Input, Textarea } from "./input";

// Select
export { Select } from "./select";

// Table
export { Table } from "./table";

// Tabs
export { Tabs } from "./tabs";

// Toast
export { ToastProvider, useToast } from "./toast";

// Modal
export { Modal } from "./modal";

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./dropdown-menu";

// Empty State
export { EmptyState } from "./empty-state";

// Skeleton Loaders
export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonRow,
  SkeletonCard,
  SkeletonTable,
} from "./skeleton";

// Loading Skeleton
export {
  Skeleton as LoadingSkeleton,
  TableSkeleton,
  CardSkeleton,
} from "./loading-skeleton";

// Error State
export { ErrorState } from "./error-state";

// Tooltip
export {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "./tooltip";

// Date Picker
export { DatePicker } from "./date-picker";

// Pagination
export { Pagination } from "./pagination";

// Breadcrumb
export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "./breadcrumb";

// Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";

// Switch
export { Switch } from "./switch";

// Checkbox
export { Checkbox } from "./checkbox";

// Alert
export { Alert } from "./alert";

// Progress
export { Progress } from "./progress";

// File Upload
export { FileUpload } from "./file-upload";

// Combobox
export { Combobox } from "./combobox";

// Timeline
export { Timeline } from "./timeline";

// Status Badge
export { StatusBadge } from "./status-badge";

// Command Palette
export { CommandPalette } from "./command-palette";

// Status Timeline
export {
  StatusTimeline,
  type TimelineOrientation,
  type TimelineStepStatus,
  type TimelineStep,
  type StatusTimelineProps,
} from "./status-timeline";

// Color Legend
export {
  ColorLegend,
  type RouteColor,
  type ColorLegendProps,
} from "./color-legend";

// Error Boundary
export { ErrorBoundary } from "./error-boundary";

// Loading Spinner
export { LoadingSpinner } from "./loading-spinner";

// Enhanced Empty State
export { EmptyState as EmptyStateEnhanced, type EmptyStateVariant } from "./empty-state-enhanced";

// Enhanced Skeleton Loaders
export {
  Skeleton as SkeletonEnhanced,
  SkeletonText as SkeletonTextEnhanced,
  SkeletonCard as SkeletonCardEnhanced,
  SkeletonTable as SkeletonTableEnhanced,
  SkeletonAvatar,
  SkeletonChart,
  SkeletonRow as SkeletonRowEnhanced,
} from "./skeleton-enhanced";

// Enhanced Toast
export { ToastProvider as ToastProviderEnhanced, useToast as useToastEnhanced } from "./toast-enhanced";

// Data Table
export {
  DataTable,
  type DataTableProps,
  type ColumnDef,
  type SortDirection,
} from "./data-table";

// Virtual List
export { VirtualList, type VirtualListProps } from "./virtual-list";

// Data Table Toolbar
export {
  DataTableToolbar,
  type DataTableToolbarProps,
  type ViewMode,
} from "./data-table-toolbar";

// Data Table Export Utilities
export {
  generateCSV,
  generateJSON,
  exportAsCSV,
  exportAsJSON,
  copyToClipboard,
  exportSelectedRows,
  buildColumnHeaderMap,
} from "./data-table-export";

// Animated Counter
export { AnimatedCounter } from "./animated-counter";
