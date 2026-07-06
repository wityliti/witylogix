/**
 * navigation.ts
 *
 * Single source of truth for dashboard navigation.
 * Every navigable route in apps/dashboard/src/app/(dashboard) appears here.
 * Groups are collapsible; nesting is two levels deep (group → item → children).
 * Admin group is role-gated to "admin" role.
 */

export type UserRole = "admin" | "manager" | "driver" | "viewer";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  /** SVG path data for the icon (single <path d="..."> approach) */
  icon: string;
  children?: NavChild[];
  /** If set, only users with this role (or higher) can see this item */
  requiredRole?: UserRole;
  badge?: number;
}

export interface NavGroup {
  label: string;
  icon?: string;
  items: NavItem[];
  /** If set, entire group is role-gated */
  requiredRole?: UserRole;
  /** Whether group starts collapsed */
  defaultCollapsed?: boolean;
}

// ─── Icon path constants ──────────────────────────────────────────────────────

const ICONS = {
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  map: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  analytics: "M18 20V10 M12 20V4 M6 20v-6",
  orders:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2",
  shipments: "M3 12l9-5 9 5v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z",
  delivery:
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z M12 11.5A2.5 2.5 0 019.5 9 2.5 2.5 0 0112 6.5 2.5 2.5 0 0114.5 9a2.5 2.5 0 01-2.5 2.5z",
  tracking:
    "M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z M12 13a3 3 0 100-6 3 3 0 000 6z",
  timeSlots: "M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2",
  returns:
    "M1 4v6h6 M23 20v-6h-6 M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15",
  dispatch:
    "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  routes: "M3 3h18v18H3z M3 9h18 M9 3v18",
  operations: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  drivers:
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  fleet:
    "M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  eld: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
  locations:
    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z M12 13a2 2 0 100-4 2 2 0 000 4z",
  zones: "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
  customers:
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 108 0 4 4 0 00-8 0 M23 21v-2a4 4 0 00-3-3.87",
  crm: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 16.18a19.79 19.79 0 01-3.07-8.63A2 2 0 011.92 5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 12.9a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 20l-.08-3.08z",
  collaboration:
    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0",
  support: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  campaigns:
    "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M21 8H3a2 2 0 00-2 2v10a2 2 0 002 2h18a2 2 0 002-2V10a2 2 0 00-2-2z",
  products: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  inventory:
    "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  supplyChain:
    "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
  stores: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  shipping: "M21 10l-3-3H3v12h18l-3-12 M3 10h18 M8 10v3 M16 10v3",
  shippingProfiles:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  partners:
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-4-4h-2 M16 3.13a4 4 0 010 7.75 M9 7a4 4 0 100 8 4 4 0 000-8",
  freight:
    "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  billing:
    "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  invoices:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 5a2 2 0 012-2h2a2 2 0 012 2 M9 14l2 2 4-4",
  finance:
    "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  payments:
    "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  pos: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  aiHub:
    "M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0110 4a2 2 0 012-2z",
  demand:
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  events:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  savedViews: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  integrations: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  apps: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  healthcare: "M22 12h-4l-3 3-4-9-3 6H2",
  fieldService:
    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  esignatures:
    "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  widgets:
    "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  settings:
    "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 15a3 3 0 100-6 3 3 0 000 6z",
  profile:
    "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  notifications:
    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  mobile:
    "M12 18h.01 M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  admin:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  platform: "M5 12h14 M12 5l7 7-7 7",
  onboarding:
    "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  collections:
    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
} as const;

// ─── Navigation config ─────────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  // ── Overview ──────────────────────────────────────────────────────────────
  {
    label: "Overview",
    items: [
      { label: "Home", href: "/home", icon: ICONS.home },
      { label: "Live Map", href: "/map", icon: ICONS.map },
      {
        label: "Activity",
        href: "/activity",
        icon: ICONS.activity,
        children: [{ label: "Realtime", href: "/activity/realtime" }],
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: ICONS.analytics,
        children: [
          { label: "Dashboards", href: "/analytics/dashboards" },
          { label: "Reports", href: "/analytics/reports" },
          { label: "ETA Accuracy", href: "/analytics/eta-accuracy" },
          { label: "Route Performance", href: "/analytics/route-performance" },
        ],
      },
    ],
  },

  // ── Orders & Deliveries ────────────────────────────────────────────────────
  {
    label: "Orders & Deliveries",
    items: [
      {
        label: "Orders",
        href: "/orders",
        icon: ICONS.orders,
        children: [
          { label: "Board", href: "/orders/board" },
          { label: "Create", href: "/orders/create" },
          { label: "Import", href: "/orders/import" },
          { label: "Bulk", href: "/orders/bulk" },
          { label: "Conflicts", href: "/orders/conflicts" },
          { label: "Local", href: "/orders/local" },
        ],
      },
      { label: "Shipments", href: "/shipments", icon: ICONS.shipments },
      {
        label: "Deliveries",
        href: "/delivery",
        icon: ICONS.delivery,
        children: [{ label: "Standard", href: "/delivery/standard" }],
      },
      {
        label: "Tracking",
        href: "/tracking",
        icon: ICONS.tracking,
        children: [
          { label: "Live", href: "/tracking/live" },
          { label: "Config", href: "/tracking-config" },
        ],
      },
      { label: "Time Slots", href: "/time-slots", icon: ICONS.timeSlots },
      { label: "Returns", href: "/returns", icon: ICONS.returns },
    ],
  },

  // ── Dispatch & Routing ─────────────────────────────────────────────────────
  {
    label: "Dispatch & Routing",
    items: [
      {
        label: "Dispatch",
        href: "/dispatch",
        icon: ICONS.dispatch,
        children: [{ label: "Couriers", href: "/dispatch/couriers" }],
      },
      {
        label: "Routes",
        href: "/routes",
        icon: ICONS.routes,
        children: [
          { label: "Plan", href: "/routes/plan" },
          { label: "Create", href: "/routes/create" },
        ],
      },
      {
        label: "Operations Flows",
        href: "/operations/flows",
        icon: ICONS.operations,
        children: [{ label: "New Flow", href: "/operations/flows/new" }],
      },
    ],
  },

  // ── Fleet & Drivers ────────────────────────────────────────────────────────
  {
    label: "Fleet & Drivers",
    items: [
      {
        label: "Drivers",
        href: "/drivers",
        icon: ICONS.drivers,
        children: [
          { label: "Create", href: "/drivers/create" },
          { label: "Performance", href: "/drivers/performance" },
        ],
      },
      {
        label: "Fleet",
        href: "/fleet",
        icon: ICONS.fleet,
        children: [
          { label: "Vehicles", href: "/fleet/vehicles" },
          { label: "Fuel", href: "/fleet/fuel" },
          { label: "Maintenance", href: "/fleet/maintenance" },
        ],
      },
      {
        label: "ELD",
        href: "/eld",
        icon: ICONS.eld,
        children: [
          { label: "HOS", href: "/eld/hos" },
          { label: "DVIR", href: "/eld/dvir" },
        ],
      },
      { label: "Locations", href: "/locations", icon: ICONS.locations },
      {
        label: "Zones",
        href: "/zones",
        icon: ICONS.zones,
        children: [{ label: "New Zone", href: "/zones/new" }],
      },
    ],
  },

  // ── Customers & Engagement ─────────────────────────────────────────────────
  {
    label: "Customers & Engagement",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: ICONS.customers,
        children: [{ label: "Create", href: "/customers/create" }],
      },
      {
        label: "CRM",
        href: "/crm",
        icon: ICONS.crm,
        children: [{ label: "Connect", href: "/crm/connect" }],
      },
      {
        label: "Collaboration",
        href: "/collaboration",
        icon: ICONS.collaboration,
      },
      { label: "Support", href: "/support", icon: ICONS.support },
      { label: "Campaigns", href: "/campaigns", icon: ICONS.campaigns },
      { label: "Calendar", href: "/calendar", icon: ICONS.calendar },
    ],
  },

  // ── Catalog & Inventory ────────────────────────────────────────────────────
  {
    label: "Catalog & Inventory",
    items: [
      {
        label: "Products",
        href: "/products",
        icon: ICONS.products,
        children: [{ label: "Sync", href: "/products/sync" }],
      },
      { label: "Inventory", href: "/inventory", icon: ICONS.inventory },
      {
        label: "Supply Chain",
        href: "/supply-chain",
        icon: ICONS.supplyChain,
        children: [
          { label: "Inventory", href: "/supply-chain/inventory" },
          { label: "Orders", href: "/supply-chain/orders" },
        ],
      },
      { label: "Stores", href: "/stores", icon: ICONS.stores },
      { label: "Collections", href: "/collections", icon: ICONS.collections },
    ],
  },

  // ── Shipping & Carriers ────────────────────────────────────────────────────
  {
    label: "Shipping & Carriers",
    items: [
      {
        label: "Shipping Labels",
        href: "/shipping/labels",
        icon: ICONS.shipping,
        children: [{ label: "New Label", href: "/shipping/labels/new" }],
      },
      {
        label: "Shipping Tracking",
        href: "/shipping/tracking",
        icon: ICONS.tracking,
      },
      {
        label: "Shipping Profiles",
        href: "/shipping-profiles",
        icon: ICONS.shippingProfiles,
      },
      {
        label: "Carrier Partners",
        href: "/partners",
        icon: ICONS.partners,
        children: [
          { label: "Compare", href: "/partners/compare" },
          { label: "Onboard", href: "/partners/onboard" },
        ],
      },
      {
        label: "Freight",
        href: "/freight",
        icon: ICONS.freight,
        children: [
          { label: "Loads", href: "/freight/loads" },
          { label: "Rates", href: "/freight/rates" },
          { label: "Compliance", href: "/freight/compliance" },
        ],
      },
    ],
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  {
    label: "Finance",
    items: [
      { label: "Billing", href: "/billing", icon: ICONS.billing },
      {
        label: "Invoices",
        href: "/invoices",
        icon: ICONS.invoices,
        children: [{ label: "Create", href: "/invoices/create" }],
      },
      {
        label: "Finance",
        href: "/finance",
        icon: ICONS.finance,
        children: [
          { label: "COD", href: "/finance/cod" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: "Reconciliation", href: "/finance/reconciliation" },
        ],
      },
      { label: "Payments", href: "/payments", icon: ICONS.payments },
      {
        label: "POS",
        href: "/pos",
        icon: ICONS.pos,
        children: [{ label: "Transactions", href: "/pos/transactions" }],
      },
    ],
  },

  // ── Analytics & AI ─────────────────────────────────────────────────────────
  {
    label: "Analytics & AI",
    items: [
      {
        label: "AI Hub",
        href: "/ai",
        icon: ICONS.aiHub,
        children: [
          { label: "Copilot", href: "/ai/copilot" },
          { label: "Driver Insights", href: "/ai/driver-insights" },
          { label: "Route Efficiency", href: "/ai/route-efficiency" },
          { label: "Slots", href: "/ai/slots" },
        ],
      },
      {
        label: "Demand",
        href: "/demand",
        icon: ICONS.demand,
        children: [
          { label: "Anomalies", href: "/demand/anomalies" },
          { label: "Capacity", href: "/demand/capacity" },
          { label: "Models", href: "/demand/models" },
          { label: "Scheduler", href: "/demand/scheduler" },
        ],
      },
      { label: "Events", href: "/events", icon: ICONS.events },
      { label: "Saved Views", href: "/saved-views", icon: ICONS.savedViews },
    ],
  },

  // ── Integrations ───────────────────────────────────────────────────────────
  {
    label: "Integrations",
    items: [
      {
        label: "Marketplace",
        href: "/integrations",
        icon: ICONS.integrations,
        children: [
          { label: "Overview", href: "/integrations/overview" },
          { label: "Catalog", href: "/integrations/catalog" },
          { label: "Marketplace", href: "/integrations/marketplace" },
          { label: "Connected", href: "/integrations/connected" },
          { label: "Providers", href: "/integrations/providers" },
          { label: "Credentials", href: "/integrations/credentials" },
          { label: "Webhooks", href: "/integrations/webhooks" },
          { label: "Migration", href: "/integrations/migration" },
          { label: "Chaos", href: "/integrations/chaos" },
          { label: "Docs", href: "/integrations/docs" },
          { label: "Analytics", href: "/integrations/analytics" },
          // Category pages
          { label: "E-commerce", href: "/integrations/ecommerce" },
          { label: "Payments", href: "/integrations/payments" },
          { label: "CRM", href: "/integrations/crm" },
          { label: "ERP", href: "/integrations/erp" },
          { label: "Messaging", href: "/integrations/messaging" },
          { label: "Email", href: "/integrations/email" },
          { label: "POS", href: "/integrations/pos" },
          { label: "Telematics", href: "/integrations/telematics" },
          { label: "ELD", href: "/integrations/eld" },
          { label: "Fuel", href: "/integrations/fuel" },
          { label: "Freight", href: "/integrations/freight" },
          { label: "Shipping", href: "/integrations/shipping" },
          { label: "Routing", href: "/integrations/routing" },
          { label: "Last Mile", href: "/integrations/lastmile" },
          { label: "Supply Chain", href: "/integrations/supply-chain" },
          { label: "Health", href: "/integrations/health" },
          { label: "E-Signatures", href: "/integrations/esignatures" },
          { label: "Collaboration", href: "/integrations/collaboration" },
        ],
      },
      { label: "Installed Apps", href: "/apps/installed", icon: ICONS.apps },
    ],
  },

  // ── Specialized ────────────────────────────────────────────────────────────
  {
    label: "Specialized",
    items: [
      {
        label: "Healthcare",
        href: "/healthcare",
        icon: ICONS.healthcare,
        children: [
          { label: "Patients", href: "/healthcare/patients" },
          { label: "Records", href: "/healthcare/records" },
        ],
      },
      {
        label: "Field Service",
        href: "/field-service",
        icon: ICONS.fieldService,
        children: [
          { label: "Jobs", href: "/field-service/jobs" },
          { label: "Dispatch", href: "/field-service/dispatch" },
        ],
      },
      {
        label: "E-Signatures",
        href: "/esignatures",
        icon: ICONS.esignatures,
        children: [
          { label: "Envelopes", href: "/esignatures/envelopes" },
          { label: "Templates", href: "/esignatures/templates" },
        ],
      },
      {
        label: "Widgets",
        href: "/widgets",
        icon: ICONS.widgets,
        children: [{ label: "Widget Config", href: "/widget-config" }],
      },
    ],
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  {
    label: "Settings",
    defaultCollapsed: true,
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: ICONS.settings,
        children: [
          { label: "General", href: "/settings/general" },
          { label: "Organization", href: "/settings/organization" },
          { label: "Team", href: "/settings/team" },
          { label: "Branding", href: "/settings/branding" },
          { label: "Carriers", href: "/settings/carriers" },
          { label: "Payments", href: "/settings/payments" },
          { label: "Accounting", href: "/settings/accounting" },
          { label: "Auth Providers", href: "/settings/auth-providers" },
          { label: "API Keys", href: "/settings/api-keys" },
          { label: "Webhooks", href: "/settings/webhooks" },
          { label: "Webhooks Test", href: "/settings/webhooks/test" },
          { label: "Maps", href: "/settings/maps" },
          { label: "Notifications", href: "/settings/notifications" },
          {
            label: "Notifications Config",
            href: "/settings/notifications-config",
          },
          { label: "Templates", href: "/settings/notifications/templates" },
          { label: "WhatsApp", href: "/settings/notifications/whatsapp" },
          { label: "Billing", href: "/settings/billing" },
          { label: "Preferences", href: "/settings/preferences" },
          { label: "Profile", href: "/settings/profile" },
        ],
      },
      { label: "Profile", href: "/profile", icon: ICONS.profile },
      {
        label: "Notifications",
        href: "/notifications",
        icon: ICONS.notifications,
        children: [
          { label: "Log", href: "/notifications/log" },
          { label: "Delivery Log", href: "/notifications/delivery-log" },
          { label: "Preferences", href: "/notifications/preferences" },
        ],
      },
      { label: "Mobile Config", href: "/mobile-config", icon: ICONS.mobile },
    ],
  },

  // ── Admin (role-gated) ─────────────────────────────────────────────────────
  {
    label: "Admin",
    requiredRole: "admin",
    defaultCollapsed: true,
    items: [
      {
        label: "Admin",
        href: "/admin",
        icon: ICONS.admin,
        children: [
          { label: "Users", href: "/admin/users" },
          { label: "Customers", href: "/admin/customers" },
          { label: "Audit", href: "/admin/audit" },
          { label: "System", href: "/admin/system" },
          { label: "Queues", href: "/admin/queues" },
          { label: "Workflows", href: "/admin/workflows" },
          { label: "Integrations", href: "/admin/integrations" },
          { label: "API Docs", href: "/admin/api-docs" },
          { label: "Activity", href: "/admin/activity" },
          { label: "Test Dashboard", href: "/admin/test-dashboard" },
        ],
      },
      { label: "Platform", href: "/platform", icon: ICONS.platform },
      { label: "Onboarding", href: "/onboarding", icon: ICONS.onboarding },
    ],
  },
];

/**
 * Utility: check if a role meets the required minimum.
 * Role hierarchy: viewer < driver < manager < admin
 */
const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  driver: 1,
  manager: 2,
  admin: 3,
};

export function hasRequiredRole(
  userRole: UserRole | undefined,
  requiredRole: UserRole | undefined,
): boolean {
  if (!requiredRole) return true;
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

/**
 * Returns all hrefs referenced in the nav config (for coverage verification).
 */
export function getAllNavHrefs(): string[] {
  const hrefs: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      hrefs.push(item.href);
      if (item.children) {
        for (const child of item.children) {
          hrefs.push(child.href);
        }
      }
    }
  }
  return hrefs;
}
