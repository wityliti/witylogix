// Existing layout components
export { Header } from "./header";

// Page shell (shared header + KPI slot for section pages)
export { PageShell, type PageShellProps } from "./page-shell";
export {
  KpiRow,
  KpiCard,
  type KpiRowProps,
  type KpiCardProps,
  type KpiTone,
} from "./kpi-row";

// Responsive navigation
export { ResponsiveNav, type NavItem } from "./responsive-nav";

// Responsive sidebar
export { ResponsiveSidebar, SidebarToggle } from "./responsive-sidebar";

// Mobile header
export { MobileHeader, NotificationBell, ProfileButton } from "./mobile-header";

// Responsive table
export { ResponsiveTable, type TableColumn } from "./responsive-table";

// Responsive grid
export {
  ResponsiveGrid,
  GridItem,
  AutoGrid,
  MasonryGrid,
  useGridColumns,
} from "./responsive-grid";
