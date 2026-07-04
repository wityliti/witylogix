# Witylogix v4 — UI Development Plan

**Version:** 1.0
**Date:** 2026-03-06
**Status:** Draft
**Scope:** Shopify Embedded App, Driver Mobile App, Customer Tracking Page, Checkout Extension

---

## 1. Current State Analysis (v3 Screenshots)

### 1.1 Shopify Admin Dashboard (ScrollEngine v3)

The existing v3 dashboard is a Next.js standalone app (not Shopify-embedded) with a left sidebar navigation. Key observations from the screenshots:

**Navigation structure (v3 sidebar):**

- Dashboard: Home, Analytics
- Orders: All Orders
- Delivery: Local Delivery, Store Pickup, Standard Shipping
- Products: Shipping & Calendar
- Store: Locations, Rules & Rates
- Drivers: Overview, Vehicles
- Users: Users, Cash Collection
- Config: Widgets, Tracking, Notifications, Delivery Apps, Workflow, Labels & Receipt
- Billing: Plans, Settings

**Labels & Receipts page:** Template-based system with thermal label (4x6), return label (4x6), packing label (Zebra 4-inch), and standard shipping label. Each template has "View" and "Use template" actions. This is a feature that differentiates v3 — print integration for warehouse fulfillment.

**Create Template page:** Configuration + Code Editor tabs. General section with template type dropdown (Packing Slip, Shipping Label, etc.), name field, description. Print Configuration section with print size (A4, Thermal), print type (Thermal), orientation, DPI, dimensions, font family, font size, line height. This is a power-user feature — the code editor tab allows HTML/CSS template customization.

### 1.2 Driver Mobile App (v3 — React Native)

The v3 driver app has a clean, functional design with blue (#4285F4) as the primary accent color. Key screens analyzed:

**Onboarding:** Full-screen illustration (delivery person), "Local Delivery" headline, "Start" CTA button with arrow.

**Login:** Clean form — "Login" header, "Let's know you better" subtext, email + password fields, "Forgot Password?" link, full-width "Login" CTA at bottom.

**Organization Select:** "Select Organisation" header with cards showing store name, role badge (Admin), location with pin icon, city/state. Blue selection border on active card. "Switch" CTA at bottom. This confirms v3 already has multi-org switching in the mobile app — v4's org model extends this pattern.

**Routes List:** Date header (e.g., "24th November 2022 / Thursday"), "3 Routes Scheduled" count, route cards showing: route name, stops count + item count, estimated time, status badge (LIVE = amber, SCHEDULED = teal). Bottom tab bar: Routes, Account.

**Route Detail — Stops tab:** Route title + date header, Stops/Inventory segmented toggle, numbered stop cards with: order ID, item count, address with navigation arrow CTA, status badge (NEW), customer name + phone with call button.

**Route Detail — Inventory tab:** Same toggle, checklist view per order: order ID with checkbox, line items with product name, variant, quantity. "Mark As PickedUp" CTA at bottom.

**Stop Detail (Map View):** Google Maps embed showing delivery pin, address below map, "Navigate" button, customer name + phone, "Mark as delivered" primary CTA, "Other Options" secondary.

**Delivery Confirmation Dialog:** "Mark Order As Delivered" modal with "Delivered" and "Cancel" buttons.

**Proof of Delivery:** "Verification" header with order ID, "Amount Due" (for COD), 3 photo upload slots, "Upload Proof" button, "Upload Signature" button, "Done" CTA.

**Signature Capture:** Full-screen canvas for drawing signature, "Cancel / Reset / Confirm" actions.

**Success Screen:** Large green checkmark, "Shipment QWHSLKH Delivered Successfully", "Go TO Next Shipment" CTA.

**Feedback — Agent Rating:** 5-star rating with label ("Outstanding"), Notes text field, "Submit Feedback" purple CTA. Two versions: Agent Rating (driver rates experience) and Customer Rating (driver rates customer). Purple (#6C63FF) accent in this flow — different from the blue in the main app.

**Profile tab:** Simple list — View Profile, Logout. Bottom nav: Home, Routes, Profile.

**Profile Detail:** Read-only fields: Full Name, Email, Address, City, State, PinCode, Country, Phone. Purple labels.

### 1.3 Customer Tracking Page

The v3 marketing screenshot shows a laptop + phone composite: desktop dashboard with map + order table alongside a mobile tracking view with Google Maps, route line, driver marker, and delivery details. The tracking page is a standalone React app (not Shopify-embedded).

### 1.4 Shopify Orders Integration

Screenshot shows the Shopify Admin orders page with v3 app data: orders table with multiple store locations (Asenari warehouse, Bangalore Warehouse, Chennai, Dhackool Warehouse, Mumbai), fulfillment status, delivery method column showing "Regular Delivery." This confirms the app integrates with Shopify's native orders view.

---

## 2. v4 UI Architecture

### 2.1 App-by-App Technology Stack

| App                | Framework           | Component Library              | Routing            | State                 | Bundle Target  |
| ------------------ | ------------------- | ------------------------------ | ------------------ | --------------------- | -------------- |
| Shopify Admin      | React Router v7     | Polaris Web Components (`s-*`) | File-based (RR v7) | React context + SWR   | N/A (embedded) |
| Driver App         | React Native (Expo) | Custom + React Navigation      | Stack + Tab nav    | Zustand + React Query | N/A (native)   |
| Tracking Page      | Vite + React        | Tailwind CSS + Headless UI     | Single-page        | React context         | < 200KB gzip   |
| Checkout Extension | Preact              | Shopify UI Extensions API      | N/A                | Local state           | < 64KB total   |

### 2.2 Design System Decisions

**Shopify Admin App:** Must use Polaris Web Components exclusively — this is a "Built for Shopify" (BFS) certification requirement. No custom CSS, no Tailwind, no third-party component libraries. Polaris handles themes, accessibility, and responsive behavior automatically within the Shopify Admin iframe.

**Driver App:** Custom component library built on React Native Paper or a minimal base. Follow the v3 blue accent pattern (#4285F4 primary, #6C63FF secondary for feedback flows). Must support dark mode (Android 10+, iOS 13+).

**Tracking Page:** Lightweight, fast-loading. Tailwind CSS for utility styling. Must load and render the map in under 2 seconds on 3G connections. No heavy UI framework.

**Checkout Extension:** Preact with Shopify's UI Extensions API components (BlockStack, InlineStack, Text, Select, etc.). No custom styling allowed — Shopify controls the visual appearance for checkout consistency.

---

## 3. Shopify Embedded Admin App

### 3.1 Information Architecture

Based on the v3 sidebar, SYSTEM-DESIGN.md endpoint map, and the v4 data model, the v4 navigation structure consolidates 20+ v3 sections into a streamlined IA:

```
Shopify Admin Sidebar (App Navigation)
├── Dashboard (Home)            → KPI cards, recent activity, alerts
├── Orders                      → List, detail, create, bulk actions
├── Drivers                     → List, detail, create, availability map
├── Routes                      → List, builder, optimization
├── Zones                       → Map editor (PostGIS polygon draw/edit)
├── Time Slots                  → Slot management, capacity, calendar view
├── Tracking                    → Tracking page configuration, link generator
├── Notifications               → Templates, send history, channel config
├── Organization ★ NEW          → Multi-shop management (only if org exists)
│   ├── Shops                   → Linked shops list
│   ├── Members                 → Org user management
│   └── Cross-shop Analytics    → Aggregated stats
├── Users                       → Shop user CRUD, role assignment
├── Settings                    → Shop config, Shopify keys, branding
│   ├── General                 → Name, timezone, currency
│   ├── Delivery                → Default rules, cutoff times
│   ├── Carrier Service         → Rate config, Shopify carrier registration
│   ├── Labels & Receipts       → Template builder (carry over from v3)
│   └── Integrations            → Notification channels, webhooks
└── Plans & Billing             → Plan tier, usage, upgrade
```

**Key changes from v3:**

- "Shipments" eliminated (merged into Orders)
- "Local Delivery / Store Pickup / Standard Shipping" unified under Orders with delivery method filters
- "Drivers & Vehicles" merged — vehicle is a driver attribute
- "Locations" moved under Settings (store locations are a Shopify concept)
- Organization section is NEW and only appears when the shop belongs to an org
- "Widgets" and "Theme Configuration" removed (replaced by Shopify App Extensions)

### 3.2 Page-by-Page Specification

#### Dashboard (Home)

**Layout:** Full-width page with KPI summary cards at top, activity timeline below.

**KPI Cards (responsive 4-column grid):**

- Orders Today (count + delta vs yesterday)
- Active Deliveries (in-progress count)
- Drivers Online (available count / total)
- Delivery Success Rate (% completed vs attempted, last 7 days)

**Quick Actions:** "Create Order" button, "Build Route" button, "View Unassigned" badge.

**Activity Timeline:** Real-time feed of recent events (order created, driver assigned, delivery completed, failed delivery). Each event shows timestamp, actor, and action. Socket.io powered.

**Data Source:** `GET /api/v4/shops/me/stats` + Socket.io `/admin` namespace.

#### Orders List

**Layout:** Full-width ResourceList (Polaris `s-resource-list`) with filters and bulk actions.

**Filters (persistent URL params):**

- Status: Multi-select (PENDING, CONFIRMED, ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED)
- Driver: Select dropdown
- Date range: Date picker
- Zone: Select dropdown
- Search: Order number, customer name, address

**Table columns:** Order #, Customer, Address, Status (badge), Driver, Zone, Scheduled Date, Created.

**Bulk actions:** Assign to driver, Assign to route, Print labels, Cancel.

**Row click:** Navigate to order detail.

**Data Source:** `GET /api/v4/orders` with query params for pagination, filters.

#### Order Detail

**Layout:** Two-column layout. Left: order info + timeline. Right: map + delivery details.

**Left column:**

- Order header: Order # (from Shopify), status badge, created date
- Customer card: Name, email, phone, delivery address (editable)
- Line items table: Product, variant, quantity, price (from Shopify data)
- Notes section: Internal notes (editable), customer notes (from Shopify)

**Right column:**

- Map: Leaflet map showing delivery pin + driver location (if assigned and active)
- Delivery details card: Assigned driver (with reassign action), zone match, time slot, route assignment
- Status timeline: Vertical timeline of all status changes with timestamps and actors
- Proof of delivery section (when delivered): Photos gallery, signature image, recipient name, GPS coords

**Actions:** Update status, Assign driver, Add to route, Print label, Cancel order.

**Data Source:** `GET /api/v4/orders/:id`, `GET /api/v4/orders/:id/timeline`.

#### Drivers List

**Layout:** Split view — list on left, map on right (toggleable).

**Map view:** Leaflet map with driver markers color-coded by status (green = available, blue = on delivery, grey = offline). Click marker to see driver card.

**List view:** Card grid showing: driver name, avatar, status badge, phone, vehicle type, current route (if any), orders count today.

**Data Source:** `GET /api/v4/drivers`, `GET /api/v4/drivers/nearby` for map.

#### Driver Detail

**Layout:** Profile header + tabbed content.

**Tabs:**

- Overview: Stats (deliveries today, this week, this month), current route, current location on map
- Orders: Order history for this driver with status filters
- Performance: Delivery success rate, average delivery time, customer ratings
- Settings: Edit driver info, vehicle details, activate/deactivate

**Data Source:** `GET /api/v4/drivers/:id`.

#### Route Builder

**Layout:** Full-width map with side panel.

**Map:** Leaflet with draggable stop markers. Shows optimized route polyline when optimization completes.

**Side panel:**

- Route metadata: Name, date, assigned driver
- Stops list: Draggable reorder, with order #, address, status
- Add stops: Search unassigned orders, add to route
- Actions: Optimize route (dispatches to BullMQ), Save draft, Assign driver, Start route

**Optimization flow:** User clicks "Optimize" → loading spinner → BullMQ processes → WebSocket pushes result → map updates with optimized polyline and reordered stops.

**Data Source:** `POST /api/v4/routes`, `POST /api/v4/routes/:id/optimize`, Socket.io for optimization results.

#### Zone Editor

**Layout:** Full-width Leaflet map with side panel.

**Map interactions:**

- Draw polygon: Click to add vertices, double-click to close
- Edit polygon: Drag vertices to reshape
- Delete polygon: Select zone, confirm delete

**Side panel:**

- Zone list: Name, color, rate summary
- Zone form (on selection): Name, color, base rate, per-km rate, min order value, free delivery threshold, active/inactive toggle, time slot associations

**Data Source:** `GET /api/v4/zones`, `POST /api/v4/zones`, `PATCH /api/v4/zones/:id`.

#### Time Slots

**Layout:** Calendar-style weekly view with slot blocks.

**Weekly grid:** Days of week as columns, time blocks as rows. Each slot shows: time range, capacity (used/total), active status.

**Create/edit slot modal:** Day of week (multi-select), start time, end time, capacity, surcharge amount, cutoff minutes before slot start.

**Data Source:** `GET /api/v4/time-slots`, `GET /api/v4/time-slots/available`.

#### Organization Management (NEW)

Only visible when `shop.orgId` is set.

**Shops tab:** List of linked shops with: name, Shopify domain, order count, driver count. Actions: Link new shop, Unlink shop.

**Members tab:** User list with: name, email, org role (OWNER/ADMIN/MEMBER), shop access (list of permitted shops). Actions: Invite member, change role, update shop access, remove member.

**Analytics tab:** Cross-shop KPI comparison cards and per-shop breakdown tables.

**Data Source:** `/api/v4/orgs/me/*` endpoints.

#### Users

**Layout:** Simple table with invite modal.

**Table columns:** Name, Email, Role (badge), Status (Active/Inactive), Last Login, Actions.

**Invite modal:** Name, email, temporary password, role dropdown (respects role hierarchy — can't create users above your level).

**Edit inline:** Click role badge to change (with hierarchy enforcement). Toggle active status.

**Data Source:** `GET /api/v4/users`, `POST /api/v4/users`, `PATCH /api/v4/users/:id`.

#### Settings

**Tabbed layout** with sections: General, Delivery, Carrier Service, Labels & Receipts, Integrations.

Each tab maps to `GET/PATCH /api/v4/shops/me` with settings JSONB fields.

**Labels & Receipts** carries over the v3 template system: template type selection, print configuration (size, DPI, orientation), description, and a code editor for HTML/CSS template customization. This is a differentiating feature.

---

## 4. Driver Mobile App (React Native / Expo)

### 4.1 Screen Map

```
App Entry
├── Onboarding (first launch only)
│   └── 3-slide carousel → Login
├── Login
│   ├── Phone + Password form
│   └── Forgot Password flow
├── Organization Select (if driver has multi-org access)
│   └── Store cards → Select → Main app
└── Main App (Tab Navigator)
    ├── Home (Tab 1)
    │   ├── Today's summary: deliveries completed, pending, earnings
    │   ├── Active route card (if route in progress)
    │   ├── Upcoming routes list
    │   └── Pull-to-refresh
    ├── Routes (Tab 2)
    │   ├── Routes list (grouped by date)
    │   │   └── Route card: name, stop count, ETA, status badge
    │   └── Route Detail (Stack push)
    │       ├── Stops tab: Numbered stop list, navigation CTAs
    │       ├── Inventory tab: Checklist per order
    │       ├── Map tab: Full-screen map with route polyline
    │       └── Stop Detail (Stack push)
    │           ├── Map with delivery pin
    │           ├── Customer info + call/navigate buttons
    │           ├── Mark as Delivered → Confirmation dialog
    │           ├── Proof of Delivery flow
    │           │   ├── Photo capture (camera + gallery)
    │           │   ├── Signature canvas
    │           │   └── Recipient name input
    │           └── Mark as Failed → Reason select + notes
    └── Profile (Tab 3)
        ├── View profile (read-only details)
        ├── Availability toggle (online/offline)
        ├── Notification preferences
        └── Logout
```

### 4.2 Key Technical Requirements

**Background GPS:** Expo TaskManager + expo-location for background location updates. 10m distance filter, adaptive accuracy (high when on route, low when idle). Uploads via `POST /api/v4/drivers/:id/location` + Redis GEO dual-write.

**Offline support:** Cache active route data locally (AsyncStorage). Queue status updates and POD submissions when offline. Sync when connectivity returns.

**Push notifications:** Firebase Cloud Messaging (FCM) via expo-notifications. Events: new route assigned, order added to route, route optimized.

**Navigation integration:** Deep link to Google Maps / Apple Maps / Waze for turn-by-turn directions from "Navigate" buttons.

### 4.3 v3 → v4 Improvements

Based on v3 screenshot analysis:

- **Add Home tab:** v3 only has Routes + Account. v4 adds a Home tab with today's summary and active route card — reduces taps to start working.
- **Add Map tab in Route Detail:** v3 shows map only at the individual stop level. v4 adds a full-route map view showing all stops and the optimized polyline.
- **Consolidate feedback:** v3 has separate Agent Rating and Customer Rating screens (purple theme). v4 replaces these with a simple delivery notes field on the POD screen — feedback collection moves to customer-facing channels (email/SMS surveys).
- **Fix Profile:** v3 profile is read-only with no actions. v4 adds availability toggle, notification preferences, and password change.
- **Consistent color scheme:** v3 mixes blue (#4285F4) and purple (#6C63FF) across screens. v4 uses a single primary color consistently.
- **Better error states:** v3 has minimal error handling UX. v4 adds retry banners, offline indicators, and error recovery flows.

---

## 5. Customer Tracking Page

### 5.1 Page Structure

Single-page app at `/d/{trackingToken}`. No authentication required.

**Above the fold:**

- Full-width Leaflet map showing: driver marker (with heading arrow), delivery destination pin, route polyline (remaining segment), ETA countdown
- Map auto-centers to show both driver and destination

**Below the fold:**

- Status timeline: Horizontal progress bar with step icons (Confirmed → Picked Up → Out for Delivery → Delivered)
- Delivery details card: Estimated arrival time, driver name + vehicle type (no PII), order summary (item count, delivery address)
- Merchant branding: Logo, company name, support contact (from shop settings)

**Real-time updates:** Socket.io connection to `/tracking` namespace, room `delivery:{trackingToken}`. Receives `delivery:update` events with driver location, ETA, and status changes.

### 5.2 Performance Budget

| Metric                   | Target       | Strategy                                            |
| ------------------------ | ------------ | --------------------------------------------------- |
| First Contentful Paint   | < 1.5s       | SSR shell with loading skeleton                     |
| Largest Contentful Paint | < 2.5s       | Lazy-load map tiles, preconnect to tile server      |
| Total bundle size        | < 200KB gzip | Leaflet (40KB) + Socket.io client (20KB) + app code |
| Time to Interactive      | < 3s on 3G   | Code-split map from status display                  |

---

## 6. Checkout Extension (Preact)

### 6.1 Extension Points

**Delivery Date/Time Picker (checkout block):**

- Rendered in the shipping method section of checkout
- Fetches available time slots from `GET /api/v4/time-slots/available`
- Displays date picker (next 7 days) and time slot dropdown
- Shows slot capacity ("3 slots remaining") and surcharge amount
- Writes selected slot to checkout metafield for order processing

**Delivery Instructions (checkout block):**

- Text field for special delivery instructions
- Character limit: 200
- Writes to checkout note attribute

### 6.2 Bundle Constraints

Shopify enforces a hard 64KB limit on checkout extensions (API 2025-10+). The extension must use Shopify's UI Extensions API components only — no custom CSS, no external libraries except Preact.

---

## 7. Development Phases

### Phase 1 — Core Screens (Weeks 1-4)

**Shopify App:**

- [ ] App scaffold (React Router v7 + Polaris WC + App Bridge)
- [ ] Auth flow (Shopify OAuth token exchange)
- [ ] Dashboard home with KPI cards
- [ ] Orders list with filters, pagination, search
- [ ] Order detail with status timeline
- [ ] Drivers list (table view)
- [ ] Driver detail page
- [ ] Basic settings page (general + delivery)

**Driver App:**

- [ ] App scaffold (Expo + React Navigation)
- [ ] Login screen (phone + password)
- [ ] Routes list
- [ ] Route detail (Stops + Inventory tabs)
- [ ] Stop detail with Google Maps
- [ ] Mark as delivered flow
- [ ] Background GPS integration

**Tracking Page:**

- [ ] Vite scaffold
- [ ] Map with driver marker + destination pin
- [ ] Status timeline
- [ ] Socket.io real-time updates
- [ ] Merchant branding

### Phase 2 — Advanced Features (Weeks 5-8)

**Shopify App:**

- [ ] Route builder with map and drag-reorder
- [ ] Zone editor with polygon draw/edit on Leaflet
- [ ] Time slot management (calendar view)
- [ ] User management with role hierarchy
- [ ] Notification template editor
- [ ] Organization management screens (multi-shop)

**Driver App:**

- [ ] Home tab with today's summary
- [ ] Proof of delivery (photo + signature capture)
- [ ] Offline mode with local queue
- [ ] Push notification handling
- [ ] Organization selector

**Checkout Extension:**

- [ ] Delivery date/time picker
- [ ] Delivery instructions field
- [ ] Metafield writes

### Phase 3 — Polish & Certification (Weeks 9-12)

**Shopify App:**

- [ ] Labels & Receipts template system
- [ ] Carrier service configuration UI
- [ ] Analytics / reporting views
- [ ] Onboarding flow for new installs
- [ ] BFS certification requirements (web vitals, accessibility, error handling)

**Driver App:**

- [ ] Dark mode support
- [ ] Performance optimization (list virtualization, image caching)
- [ ] Accessibility audit
- [ ] App Store / Play Store submission

**Tracking Page:**

- [ ] Performance optimization (lighthouse 90+ target)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Multi-language support (i18next)

---

## 8. File Structure

```
apps/
├── shopify-app/
│   ├── app/
│   │   ├── root.tsx                    # App shell, Polaris provider
│   │   ├── routes/
│   │   │   ├── _index.tsx              # Dashboard
│   │   │   ├── orders._index.tsx       # Orders list
│   │   │   ├── orders.$id.tsx          # Order detail
│   │   │   ├── drivers._index.tsx      # Drivers list
│   │   │   ├── drivers.$id.tsx         # Driver detail
│   │   │   ├── routes._index.tsx       # Routes list
│   │   │   ├── routes.new.tsx          # Route builder
│   │   │   ├── routes.$id.tsx          # Route detail
│   │   │   ├── zones._index.tsx        # Zone editor
│   │   │   ├── time-slots._index.tsx   # Time slot management
│   │   │   ├── users._index.tsx        # User management
│   │   │   ├── org._index.tsx          # Organization overview
│   │   │   ├── org.shops.tsx           # Org shops
│   │   │   ├── org.members.tsx         # Org members
│   │   │   ├── settings._index.tsx     # Settings tabs
│   │   │   ├── notifications.tsx       # Notification config
│   │   │   └── auth.$.tsx              # Auth callback
│   │   ├── components/
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderStatusBadge.tsx
│   │   │   ├── DriversMap.tsx
│   │   │   ├── RouteBuilder.tsx
│   │   │   ├── ZoneEditor.tsx
│   │   │   ├── TimeSlotCalendar.tsx
│   │   │   ├── StatusTimeline.tsx
│   │   │   └── KPICard.tsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts               # SWR wrapper for authenticated API calls
│   │   │   ├── useSocket.ts            # Socket.io connection manager
│   │   │   └── useAuth.ts              # Session token management
│   │   └── lib/
│   │       ├── api.server.ts           # Server-side API client
│   │       └── shopify.server.ts       # Shopify auth helpers
│   ├── package.json
│   └── vite.config.ts
│
├── driver-app/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── (app)/
│   │   │   ├── (tabs)/
│   │   │   │   ├── home.tsx
│   │   │   │   ├── routes/
│   │   │   │   │   ├── index.tsx       # Routes list
│   │   │   │   │   └── [id].tsx        # Route detail
│   │   │   │   └── profile.tsx
│   │   │   ├── stop/[id].tsx           # Stop detail
│   │   │   ├── pod/[orderId].tsx       # Proof of delivery
│   │   │   └── org-select.tsx          # Organization picker
│   │   └── _layout.tsx
│   ├── components/
│   │   ├── RouteCard.tsx
│   │   ├── StopCard.tsx
│   │   ├── DeliveryMap.tsx
│   │   ├── SignatureCanvas.tsx
│   │   ├── PhotoCapture.tsx
│   │   └── StatusBadge.tsx
│   ├── hooks/
│   │   ├── useLocation.ts             # Background GPS
│   │   ├── useOfflineQueue.ts         # Offline action queue
│   │   └── useSocket.ts
│   ├── services/
│   │   ├── api.ts                     # API client with token refresh
│   │   └── storage.ts                 # AsyncStorage wrappers
│   └── package.json
│
├── tracking-page/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TrackingMap.tsx
│   │   │   ├── StatusProgress.tsx
│   │   │   ├── DeliveryDetails.tsx
│   │   │   └── MerchantBranding.tsx
│   │   ├── hooks/
│   │   │   └── useTracking.ts         # Socket.io + tracking state
│   │   └── lib/
│   │       └── api.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
extensions/
├── checkout-ui/
│   ├── src/
│   │   ├── DeliveryDatePicker.tsx
│   │   └── DeliveryInstructions.tsx
│   └── shopify.extension.toml
└── pos-ui/
    └── (Phase 3)
```

---

## 9. API Integration Patterns

### 9.1 Shopify App (Server-Side)

React Router v7 loaders and actions handle API calls server-side. The Shopify session token is exchanged for a JWT on first request, then cached.

```typescript
// app/routes/orders._index.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await authenticate.admin(request);
  const response = await api.get("/api/v4/orders", {
    headers: { Authorization: `Bearer ${token}` },
    params: new URL(request.url).searchParams,
  });
  return json(response.data);
}
```

### 9.2 Driver App (Client-Side)

React Query with automatic token refresh. Offline mutations queued in AsyncStorage.

### 9.3 Tracking Page (Client-Side)

Single API call on load (`GET /api/v4/tracking/:token`), then Socket.io for real-time updates. No auth required.

---

## 10. Shopify BFS Certification Checklist (UI-Relevant)

| Requirement                  | Target               | Implementation                                           |
| ---------------------------- | -------------------- | -------------------------------------------------------- |
| Admin LCP (p75)              | ≤ 2.5s               | Polaris skeleton screens, route-based code splitting     |
| Admin CLS (p75)              | ≤ 0.1                | Fixed-dimension cards, no layout shifts from async data  |
| Admin INP (p75)              | ≤ 200ms              | Optimistic UI updates, debounced filters                 |
| Checkout extension bundle    | < 64KB               | Preact, tree-shaking, no external deps                   |
| Storefront Lighthouse impact | < 10 pts             | Tracking page loads independently, no storefront JS      |
| Error handling               | Polaris Banner       | Error boundaries with user-friendly messages             |
| Loading states               | Polaris SkeletonPage | Every async route has a skeleton fallback                |
| Empty states                 | Polaris EmptyState   | Every list has an empty state with CTA                   |
| Accessibility                | WCAG 2.1 AA          | Polaris handles most; custom components need aria-labels |
