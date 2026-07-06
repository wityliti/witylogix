# Sprint 4.6 Quick Start Guide

## Getting Started

### 1. Install Dependencies

```bash
cd apps/customer-portal
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3004`

### 3. Test Routes

#### Live Tracking Page (Main Feature)

- **URL:** `http://localhost:3004/track/ORD-2024-001`
- **Feature:** Real-time delivery tracking with live map
- **Device:** Test on both desktop and mobile
- **Action:** Watch the map, ETA timer, and status timeline

#### Delivery History

- **URL:** `http://localhost:3004/deliveries`
- **Feature:** Past deliveries with filtering
- **Test:** Try date range and status filters
- **Links:** Click any delivery card to see order details

#### Enhanced Rating Page

- **URL:** `http://localhost:3004/orders/ORD-2024-001/rate`
- **Feature:** Multi-step rating flow
- **Test:** Complete all 4 steps (rating → categories → feedback → success)
- **Validation:** Try submitting without selecting all ratings

---

## Feature Testing Guide

### 1. Live Tracking Page

#### Desktop Layout (> 1024px)

```
Browser Width: 1280px or larger

Expected Layout:
┌─────────────────────────────────────┬──────────────────┐
│                                     │                  │
│           FULL-WIDTH MAP            │     SIDEBAR      │
│                                     │  - ETA Timer     │
│  - Driver Marker (Amber with arrow) │  - Driver Card   │
│  - Destination Marker (Green pulse) │  - Order Items   │
│  - Route Polyline                   │  - Timeline      │
│  - Zoom Controls                    │  - Address       │
│  - Share Button (top-right)         │                  │
│                                     │                  │
└─────────────────────────────────────┴──────────────────┘
```

**Test Checklist:**

- [ ] Map renders with grid pattern background
- [ ] Driver marker appears as amber circle
- [ ] Driver marker has arrow pointing northeast (bearing 45°)
- [ ] Destination marker is green with pulse animation
- [ ] Route shows as blue polyline
- [ ] "Live" badge in top-left shows green
- [ ] ETA shows "12 min" countdown
- [ ] Progress bar shows ~60% complete
- [ ] Driver name is "John Martinez"
- [ ] Star rating shows 4.8 stars
- [ ] Vehicle shows "Blue Van - ABC-1234"
- [ ] Timeline shows all 6 steps
- [ ] "Out for Delivery" step is highlighted blue
- [ ] Share button copies link to clipboard
- [ ] Zoom buttons work (+ makes map bigger)
- [ ] Can drag/pan the map
- [ ] Recenter button appears after panning

#### Mobile Layout (< 768px)

```
Browser Width: 375px (iPhone size)

Expected Layout:
┌─────────────────────────────────────┐
│  [Details]  [Share]                 │
│                                     │
│       FULL-SCREEN MAP               │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│┌────────────────────────────────────┐│
││  BOTTOM SHEET (Peek: 120px)        ││
││  ═══════════════════════════════   ││
││  Delivery Details                  ││
└│────────────────────────────────────┘│
 └─────────────────────────────────────┘
```

**Test Checklist:**

- [ ] Map takes full screen (no sidebar visible)
- [ ] "Details" button appears in top-left
- [ ] "Share" button appears in top-right
- [ ] Bottom sheet visible at bottom with handle bar
- [ ] Click "Details" opens bottom sheet
- [ ] Sheet snaps to peek (120px showing title)
- [ ] Drag up: sheet snaps to half height
- [ ] Drag up more: sheet snaps to full height
- [ ] Drag down from full: sheet snaps back
- [ ] Swipe down: sheet dismisses
- [ ] Can scroll content inside sheet
- [ ] Touch-friendly button sizes (min 44px)

### 2. ETA Countdown Component

**Visual Check:**

```
┌─────────────────────┐
│  12 min             │
│  Arriving in 12m 5s │
│  [▮▮▮▮░░░░░░] 60%   │
│  📍 On time         │
│  Updated just now   │
└─────────────────────┘
```

**Test Checklist:**

- [ ] Large "12" number visible
- [ ] Countdown updates every 1 second
- [ ] Progress bar fills from left to right
- [ ] Percentage shows 0-100
- [ ] Status shows "On time" in gray
- [ ] "Updated" timestamp displays
- [ ] Timestamp updates (e.g., "1m ago")
- [ ] Color changes to orange/yellow when delayed
- [ ] Color changes to green when arriving soon

### 3. Delivery Status Timeline

**Visual Check (First 4 Steps Visible):**

```
┌─────────────────────────────────────┐
│ ◉ Ordered              ✓ 2:15 PM    │
│ │                                   │
│ ◉ Confirmed            ✓ 2:20 PM    │
│ │ ► Driver Assigned: John M.       │
│ │                                   │
│ ◉ Dispatched           ✓ 2:40 PM    │
│ │ ► Est. Arrival: 2:52 PM          │
│ │                                   │
│ ◉ Out for Delivery     ○ 2:45 PM    │
│ │ (Current - blue highlight)       │
│ │                                   │
│ ○ Nearby               (pending)    │
│ │                                   │
│ ○ Delivered            (pending)    │
└─────────────────────────────────────┘
```

**Test Checklist:**

- [ ] All 6 steps visible in vertical line
- [ ] Circle indicators show correct states
- [ ] Green circle = completed steps
- [ ] Blue circle (bigger) = current step
- [ ] Gray circles = pending steps
- [ ] Connector line between steps
- [ ] Line is green below current, gray below pending
- [ ] Timestamps show for completed steps
- [ ] "Current" badge on current step
- [ ] Click on "Confirmed" to expand details
- [ ] Details show "Driver Assigned: John Martinez"
- [ ] Click again to collapse
- [ ] Smooth expand/collapse animation

### 4. Driver Info Card

**Visual Check:**

```
┌──────────────────────────┐
│  [Driver Photo Area]     │
│  ● (green dot = online)  │
├──────────────────────────┤
│ John Martinez    [5⭐]    │
│ 4.8              4.8     │
│                          │
│ ┌────────────────────┐   │
│ │ VEHICLE            │   │
│ │ Blue Van           │   │
│ │ Plate: ABC-1234    │   │
│ └────────────────────┘   │
│                          │
│ [Call] [Text]            │
└──────────────────────────┘
```

**Test Checklist:**

- [ ] Driver photo displays (or emoji fallback)
- [ ] Connection status dot shows green
- [ ] Driver name "John Martinez" visible
- [ ] 5 star icons filled (yellow)
- [ ] Rating shows "4.8"
- [ ] Vehicle section shows clearly
- [ ] "Blue Van" text present
- [ ] Plate number "ABC-1234" visible
- [ ] Call button clickable
- [ ] Text button clickable
- [ ] Buttons are disabled state (grayed) if offline
- [ ] Offline message appears if not connected

### 5. Bottom Sheet (Mobile)

**Test Steps:**

1. Open mobile layout
2. Click "Details" button
3. Sheet appears at bottom with handle bar
4. Drag handle bar upward → sheet snaps to 50% height
5. Drag further up → sheet snaps to 90% height
6. Content inside is scrollable
7. Drag downward from any position → snaps to closest point
8. From peek (120px) → drag down → dismiss and close
9. Click X button in header → close immediately
10. Click backdrop (gray area) → close

**Expected Snap Points:**

- Peek: 120px (shows title only)
- Half: 280px (shows main content)
- Full: 500px (max height)

### 6. Delivery History Page

**Visual Check:**

```
Delivery History

Search: [All Time ▼] [All Status ▼]

┌──────────────────────────────────────────┐
│ Mar 11, 2024          #1001              │
│ ✓ Delivered                              │
│ 2x Vegetables Bundle, 1x Milk, 1x Bread │
│ ★★★★★ 5.0            Total: $34.47      │
│ 📍 123 Main St, New York, NY 10001       │
└──────────────────────────────────────────┘

[Load More]
```

**Test Checklist:**

- [ ] Page title "Delivery History" visible
- [ ] Shows count: "4 deliveries found"
- [ ] Filter button with dropdown works
- [ ] Date range options: All/7d/30d/90d
- [ ] Status filter: All/Delivered/Cancelled
- [ ] Each card shows:
  - [ ] Date
  - [ ] Order number (#1001)
  - [ ] Status badge (green = delivered)
  - [ ] Item preview (2 items shown)
  - [ ] "+1 more" if more items
  - [ ] Star rating (5 filled stars)
  - [ ] Total price ($34.47)
  - [ ] Address with map pin icon
- [ ] Click card → navigates to order details
- [ ] Hover card → background changes
- [ ] Load More button at bottom

### 7. Enhanced Rating Page

**Step 1: Initial Ratings**

```
Progress: [████░░░░]

How was your driver?
Rating 1-5 stars: ☆☆☆☆☆
"Excellent" text appears when selected

How was your delivery experience?
Rating 1-5 stars: ☆☆☆☆☆
"Excellent" text appears when selected

[Continue] (disabled until both rated)
```

**Test Checklist (Step 1):**

- [ ] Progress bar shows 25% (1 of 4 steps)
- [ ] First question clearly visible
- [ ] Star icons clickable
- [ ] Hovering shows which rating would be selected
- [ ] Click star → filled with yellow
- [ ] Rating text updates below stars
- [ ] Second question visible
- [ ] Can rate both independently
- [ ] Continue button disabled (gray) initially
- [ ] Becomes enabled (blue) after both rated
- [ ] Click Continue → moves to Step 2

**Step 2: Category Ratings**

```
Progress: [████████░░░░]

Your Ratings:
Driver: ★★★★★
Experience: ★★★★★

Rate the Driver (Professional & Courteous)
☆☆☆☆☆

Rate Timeliness (Was delivery on time?)
☆☆☆☆☆

Rate Item Condition (Items in good condition?)
☆☆☆☆☆

[Back] [Continue]
```

**Test Checklist (Step 2):**

- [ ] Progress bar shows 50% (2 of 4 steps)
- [ ] Shows summary of previous ratings
- [ ] Three new rating questions visible
- [ ] Each has its own star rating
- [ ] Back button returns to Step 1
- [ ] Previous ratings preserved
- [ ] All three must be rated to continue
- [ ] Continue button disabled until all 3 rated

**Step 3: Feedback**

```
Progress: [████████████░░░░]

Your Ratings: (all 5 shown)
Driver: ★★★★★
Experience: ★★★★★
Professionalism: ★★★★★
Timeliness: ★★★★★
Condition: ★★★★★

Additional Feedback (Optional)
[Large text area - 200px height]
"Tell us about your experience..."

Would you order again?
[✓ Yes] [✗ No]

Add Photos (Optional)
[Upload area]

[Back] [Submit Rating]
```

**Test Checklist (Step 3):**

- [ ] Progress bar shows 75% (3 of 4 steps)
- [ ] All 5 previous ratings shown (readonly)
- [ ] Feedback textarea is large and scrollable
- [ ] Placeholder text visible
- [ ] Type text → shows in textarea
- [ ] "Would order again" shows both buttons
- [ ] Click Yes → button turns green
- [ ] Click No → button turns red
- [ ] Default is Yes
- [ ] Add Photo button clickable (or grayed at limit)
- [ ] Can remove photos (X button)
- [ ] Back button returns to Step 2
- [ ] Submit button enabled immediately

**Step 4: Success**

```
Progress: [████████████████] 100%

[✓ Circle icon]
Thank You!

Your feedback has been submitted successfully.
We appreciate your time and will use your
insights to improve our service.

Your Ratings & Feedback:
All ratings shown with checkmark
Order Again: ✓ Yes

[Back to Orders] [Go to Dashboard]
```

**Test Checklist (Step 4):**

- [ ] Progress bar shows 100%
- [ ] Green checkmark icon visible
- [ ] "Thank You!" message prominent
- [ ] Explanatory text shown
- [ ] All ratings displayed in summary box
- [ ] "Would order again" shows final choice
- [ ] Feedback text quoted if provided
- [ ] Two navigation buttons present
- [ ] Back to Orders link works
- [ ] Go to Dashboard link works

---

## Browser DevTools Testing

### Mobile Simulation

1. Open Chrome DevTools (F12)
2. Click device toolbar icon
3. Select "iPhone 12" or similar
4. Test responsive behavior
5. Check touch interactions

### Performance

1. Open DevTools → Performance tab
2. Record page load
3. Check for smooth animations
4. Verify no jank/stuttering
5. Monitor FPS (should be 60)

### Network

1. Open DevTools → Network tab
2. Should see minimal requests (mock data)
3. Check image sizes
4. Verify CSS/JS bundle sizes

### Accessibility

1. Open DevTools → Accessibility tab
2. Check contrast ratios (WCAG AA standard)
3. Verify proper heading hierarchy
4. Test keyboard navigation (Tab key)

---

## Common Issues & Solutions

### Map Doesn't Show

**Problem:** Black/empty rectangle where map should be
**Solution:**

- Check canvas is not hidden by CSS
- Verify browser supports Canvas API
- Try different browser

### Bottom Sheet Won't Snap

**Problem:** Sheet stuck between positions
**Solution:**

- Clear browser cache
- Reload page
- Try different touch points
- Check browser console for errors

### Buttons Don't Work

**Problem:** Click events not firing
**Solution:**

- Check in DevTools → disabled state
- Verify form validation passed
- Try refreshing page
- Check browser supports required features

### Wrong Colors

**Problem:** Colors don't match design
**Solution:**

- Verify CSS variables are defined
- Check dark theme is enabled
- Inspect element in DevTools
- Clear Tailwind cache: `rm -rf .next`

---

## File Locations for Quick Reference

### Main Feature Files

```
📁 apps/customer-portal/src/
├── 📄 app/track/[id]/page.tsx      ← MAIN TRACKING PAGE
├── 📄 app/deliveries/page.tsx      ← HISTORY PAGE
├── 📄 app/orders/[id]/rate/page.tsx ← RATING PAGE
│
├── 📁 components/
│   ├── 📄 live-map.tsx              ← MAP COMPONENT
│   ├── 📄 eta-countdown.tsx         ← ETA TIMER
│   ├── 📄 delivery-status-timeline.tsx ← TIMELINE
│   ├── 📄 driver-info-card.tsx      ← DRIVER CARD
│   └── 📄 bottom-sheet.tsx          ← MOBILE SHEET
│
├── 📁 hooks/
│   └── 📄 use-delivery-tracking.ts  ← WEBSOCKET HOOK
│
└── 📁 types/
    └── 📄 index.ts                  ← TYPE DEFINITIONS
```

### Documentation

```
📁 apps/customer-portal/
├── 📄 SPRINT_4_6_README.md          ← FEATURE DOCS
├── 📄 SPRINT_4_6_CHECKLIST.md       ← IMPLEMENTATION CHECK
└── 📄 SPRINT_4_6_QUICK_START.md     ← THIS FILE
```

---

## Next Steps After Testing

1. ✅ **Test all features locally** (using this guide)
2. **Set up real backend API** (replace mock data)
3. **Configure WebSocket server** (for real location updates)
4. **Add image upload** (connect to storage service)
5. **Integrate real maps** (replace canvas with Leaflet)
6. **Set up CI/CD** (testing & deployment)
7. **Deploy to staging** (for QA testing)
8. **Production deployment** (with monitoring)

---

## Support & Questions

- Check component props in TypeScript files
- Review mock data structures
- Check Tailwind CSS variables in tailwind.config.ts
- Refer to SPRINT_4_6_README.md for architecture
- Check SPRINT_4_6_CHECKLIST.md for implementation details

---

**Happy Testing! 🚀**

Sprint 4.6 is complete and ready for validation.
