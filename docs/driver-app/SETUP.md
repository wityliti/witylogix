# Witylogix Driver App - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd /sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform/apps/driver-app
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your backend API URL:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000  # or your API server
```

### 3. Start Development Server

```bash
npm start
```

This will launch the Expo development server. You'll see options to:

- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

## File Structure Explanation

```
driver-app/
├── src/
│   ├── navigation/           # Navigation configuration
│   │   ├── AuthStack.tsx     # Login navigation
│   │   └── MainTabs.tsx      # Main app tabs (Home, Routes, Profile)
│   │
│   ├── screens/              # Screen components
│   │   ├── LoginScreen.tsx   # Phone + password login
│   │   ├── HomeScreen.tsx    # Daily dashboard
│   │   ├── RoutesScreen.tsx  # List of routes
│   │   ├── RouteDetailScreen.tsx  # Route with stops
│   │   ├── DeliveryScreen.tsx     # Active delivery details
│   │   └── ProfileScreen.tsx      # Driver profile
│   │
│   ├── services/             # API and device services
│   │   ├── api.ts            # HTTP client wrapper
│   │   ├── auth.ts           # Authentication logic
│   │   └── location.ts       # Background location tracking
│   │
│   └── hooks/                # React hooks
│       └── useAuth.ts        # Auth context provider
│
├── App.tsx                   # Root component with navigation
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── .eslintrc.json            # Linting rules
├── .gitignore                # Git ignore patterns
├── .env.example              # Environment template
├── README.md                 # User documentation
├── ARCHITECTURE.md           # Technical architecture
└── SETUP.md                  # This file
```

## Component Architecture

### Authentication Flow

1. **App.tsx** checks `isAuthenticated` from `useAuth()` hook
2. If not authenticated → shows **AuthStack** (LoginScreen)
3. User enters phone + password
4. **LoginScreen** calls `authService.login()`
5. Token stored in secure storage
6. Context updates → shows **MainTabs**

### Navigation Structure

```
Root (App.tsx)
├── AuthStack (unauthenticated users)
│   └── LoginScreen
│
└── MainTabs (authenticated users)
    ├── Home Stack
    │   ├── HomeScreen
    │   └── DeliveryScreen
    │
    ├── Routes Stack
    │   ├── RoutesScreen
    │   └── RouteDetailScreen
    │
    └── ProfileScreen
```

## API Integration

### Expected API Endpoints

The app expects your backend to provide:

**Authentication:**

- `POST /api/v4/auth/driver/login`
  - Request: `{ phone: string, password: string }`
  - Response: `{ token: string, user: {...} }`

**Today's Data:**

- `GET /api/v4/drivers/me/stats/today`
  - Returns: `{ ordersRemaining, completed, successRate }`
- `GET /api/v4/drivers/me/active-delivery`
  - Returns: `{ id, customerName, address, status, eta }`

**Routes:**

- `GET /api/v4/drivers/me/routes`
  - Returns: Array of routes with stops
- `GET /api/v4/routes/{routeId}`
  - Returns: Full route details with map coordinates

**Deliveries:**

- `GET /api/v4/deliveries/{deliveryId}`
  - Returns: Delivery details
- `PATCH /api/v4/deliveries/{deliveryId}`
  - Request: `{ status, notes, proofImage }`
  - Updates delivery status

**Profile:**

- `GET /api/v4/drivers/me/profile`
  - Returns: Driver info, vehicle, today's stats

**Location:**

- `PATCH /api/v4/drivers/{driverId}/location`
  - Request: `{ latitude, longitude, accuracy, timestamp }`

## Key Screens Walkthrough

### LoginScreen

```
┌─────────────────────────┐
│  Witylogix Driver       │
├─────────────────────────┤
│                         │
│  Phone: [____________]  │
│                         │
│  Password: [__________] │
│                         │
│    [Sign In Button]     │
│                         │
│  Need help?             │
│  contact@witylogix.com  │
└─────────────────────────┘
```

### HomeScreen (Today Tab)

```
┌─────────────────────────┐
│  Today's Summary        │
├─────────────────────────┤
│  5 Remaining  3 Done  80%│
│                         │
│  Active Delivery        │
│  John Smith             │
│  123 Main St, Apt 4B    │
│  [Start Delivery]       │
│                         │
│  [Break]  [End Shift]   │
│  [Refresh]              │
└─────────────────────────┘
```

### RoutesScreen (Routes Tab)

```
┌─────────────────────────┐
│  Your Routes            │
│  2 routes assigned      │
├─────────────────────────┤
│  Route A North          │
│  [Completed] 8 stops    │
│  [========  ] 100%      │
│                         │
│  Route B Downtown       │
│  [In Progress] 5 stops  │
│  [===        ] 60%      │
└─────────────────────────┘
```

### DeliveryScreen

```
┌─────────────────────────┐
│  John Smith             │
│  123 Main St, Apt 4B    │
│  [555-1234]             │
├─────────────────────────┤
│  [Map Placeholder]      │
│  Status: Arrived        │
├─────────────────────────┤
│  Proof of Delivery      │
│  [Take Photo]           │
│  [Signature Pad]        │
│                         │
│  Notes:                 │
│  [________________]     │
│  [Complete Delivery]    │
│  [Mark as Failed]       │
└─────────────────────────┘
```

## Common Development Tasks

### Add a New Screen

1. Create file in `src/screens/NewScreen.tsx`
2. Import in navigation stack (`src/navigation/`)
3. Add navigation params type
4. Add screen to navigator

Example:

```tsx
// src/screens/NewScreen.tsx
import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";

const NewScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Text>New Screen</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

export default NewScreen;
```

### Add a New API Call

1. Add method to `ApiClient` class in `src/services/api.ts`
2. Or use existing `api.get/post/patch/delete` directly
3. Call from service (like `src/services/auth.ts`)
4. Use in screen via try-catch

Example:

```tsx
// In a screen
const fetchData = async () => {
  try {
    const data = await api.get("/api/v4/endpoint");
    setData(data);
  } catch (error) {
    Alert.alert("Error", "Failed to load data");
  }
};
```

### Update Styling

The app uses React Native StyleSheet with these colors:

- Primary Blue: `#005bd3`
- Success Green: `#008060`
- Background: `#f5f5f5` (light gray)
- Text: `#202223` (dark)
- Secondary: `#666` (gray)

All styles are defined with `StyleSheet.create()`:

```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#005bd3",
    padding: 12,
  },
  text: {
    color: "#202223",
    fontSize: 16,
  },
});
```

## Testing Locally

### Test Login

1. Start dev server: `npm start`
2. Open on simulator/device
3. Enter test credentials:
   - Phone: +1-555-123-4567
   - Password: test123

### Test Location Tracking

1. Background location requires app installed via EAS or APK
2. Emulator/Simulator can simulate location in settings
3. Check API logs for location update requests

### Test Photo Capture

1. Camera permission auto-requested on first tap
2. Allow permission when prompted
3. Camera app opens, take photo
4. Photo displayed in proof of delivery section

## Troubleshooting

### "Cannot find module" errors

Run `npm install` again and restart dev server:

```bash
npm install
npm start
```

### TypeScript errors

Check with:

```bash
npm run typecheck
```

Fix type issues or ignore with `// @ts-ignore` (not recommended)

### API connection fails

Check:

1. Backend server is running
2. `.env` has correct API URL
3. Network connectivity on device
4. No CORS issues (should use same domain or proper headers)

### Location permission denied

1. iOS: Go to Settings → Witylogix → Location → Always
2. Android: Go to Settings → Apps → Witylogix → Permissions → Location → Allow

### Token storage issues

Clear app data and login again:

- iOS: Delete app and reinstall
- Android: Settings → Apps → Witylogix → Clear Data

## Production Deployment

### Before Deploying

1. ✅ Update version in `package.json` and `app.json`
2. ✅ Set production API URL in `.env`
3. ✅ Run type check: `npm run typecheck`
4. ✅ Run linting: `npm run lint`
5. ✅ Test all screens thoroughly
6. ✅ Test location tracking
7. ✅ Test offline scenarios
8. ✅ Update README with any changes

### Build for iOS

```bash
eas build --platform ios
# Follow prompts to sign with Apple developer account
```

### Build for Android

```bash
eas build --platform android
# Follow prompts for Android keystore
```

### Submit to Stores

```bash
eas submit --platform ios
eas submit --platform android
```

## Support

For issues or questions:

- Check the README.md
- Review ARCHITECTURE.md for design details
- Check API endpoints in this guide
- Test with network inspector
- Check browser console for errors

## Next Steps

1. Set up backend API with expected endpoints
2. Configure `.env` with API URL
3. Test login flow
4. Test each screen individually
5. Test location tracking
6. Deploy to TestFlight/Google Play
7. Gather feedback from test drivers
8. Iterate based on feedback
