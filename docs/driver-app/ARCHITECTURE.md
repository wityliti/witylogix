# Witylogix Driver App Architecture

## Overview

The Witylogix Driver mobile app is built with React Native using Expo, providing a robust platform for delivery drivers to manage their routes and deliveries efficiently.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   React Native App (Expo)               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Navigation Layer (React Navigation)        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │ │
│  │  │  AuthStack   │  │  MainTabs    │  │ Screens  │ │ │
│  │  │  (Login)     │  │ (H,R,P tabs) │  │          │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
│                          │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Screens Layer                          │ │
│  │                                                     │ │
│  │  LoginScreen    HomeScreen     RoutesScreen       │ │
│  │  RouteDetailScreen    DeliveryScreen              │ │
│  │  ProfileScreen                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
│                          │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │          State Management (React Context)         │ │
│  │                                                     │ │
│  │  AuthContext/useAuth Hook                         │ │
│  │  - Authentication state                           │ │
│  │  - User data                                      │ │
│  │  - Login/Logout operations                        │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
│                          │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Services Layer                        │ │
│  │                                                     │ │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────┐   │ │
│  │  │   API   │  │   Auth   │  │    Location    │   │ │
│  │  │ Client  │  │ Service  │  │    Service     │   │ │
│  │  └─────────┘  └──────────┘  └────────────────┘   │ │
│  └────────────────────────────────────────────────────┘ │
│                          ▲                                │
└──────────────────────────┼────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼─────┐  ┌──────▼──────┐  ┌────▼──────┐
    │   HTTP API  │  │   Socket.io  │  │ Device APIs│
    │ (REST)      │  │ (Real-time)  │  │ (Camera,  │
    │             │  │              │  │  Location)│
    └─────────────┘  └──────────────┘  └───────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   Backend    │
                    │   Server     │
                    └──────────────┘
```

## Technology Stack

### Frontend

- **React Native 0.76**: Cross-platform mobile framework
- **Expo 52**: Development platform and build service
- **React Navigation 7**: Navigation and routing
- **TypeScript 5.7**: Type safety
- **React Context API**: State management

### External Services

- **expo-camera**: Photo capture
- **expo-image-picker**: Image selection
- **expo-location**: Location tracking (foreground & background)
- **expo-secure-store**: Secure token storage
- **react-native-maps**: Map integration
- **socket.io-client**: Real-time communication

## Module Breakdown

### 1. Navigation Layer (`src/navigation/`)

#### AuthStack.tsx

- Stack navigator for unauthenticated users
- Contains: LoginScreen

#### MainTabs.tsx

- Bottom tab navigator for authenticated users
- Tabs: Today (Home), Routes, Profile
- Nested stack navigators for navigation within tabs

### 2. Screens Layer (`src/screens/`)

#### LoginScreen.tsx

- Phone + password input form
- Calls auth service to login
- Stores JWT token securely
- Navigates to MainTabs on success

#### HomeScreen.tsx

- Dashboard showing today's summary
- Stats: orders remaining, completed, success rate
- Active delivery card with quick action
- Start delivery button
- Pull to refresh

#### RoutesScreen.tsx

- List of assigned routes for today
- Shows: route name, stop count, progress
- Tap to navigate to route details
- Refresh data on focus

#### RouteDetailScreen.tsx

- Map view with route stops
- List of stops with status and sequence
- Navigation button for each stop
- Start/Complete route actions

#### DeliveryScreen.tsx

- Customer info and address
- Map view to destination
- Status action buttons (Arrived, Delivered, Failed)
- Photo capture for proof of delivery
- Signature pad placeholder
- Notes text input
- Complete delivery button

#### ProfileScreen.tsx

- Driver profile information
- Vehicle details
- Today's statistics
- Settings (notifications toggle)
- Logout button

### 3. Services Layer (`src/services/`)

#### api.ts (ApiClient)

- Centralized HTTP client using native fetch
- Automatic JWT token injection from SecureStore
- Methods: get, post, patch, delete
- Configurable base URL via environment variables
- Error handling

#### auth.ts (AuthService)

- login(phone, password): Calls API, stores token
- logout(): Clears token and user data
- getToken(): Retrieves stored JWT
- getUser(): Retrieves stored user data
- isAuthenticated(): Checks auth status
- Uses expo-secure-store for secure storage

#### location.ts (LocationService)

- startTracking(driverId): Initiates foreground + background tracking
- stopTracking(): Stops all location tracking
- Sends location updates via HTTP API
- Sends location updates via Socket.io in real-time
- Handles permissions automatically

### 4. Hooks (`src/hooks/`)

#### useAuth.ts

- AuthContext provider wrapping entire app
- Provides: isAuthenticated, user, isLoading, login, logout
- Checks auth on app startup
- Available via useAuth() hook in any component

## Data Flow

### Authentication Flow

```
LoginScreen
  ↓ (phone, password)
authService.login()
  ↓
api.post('/api/v4/auth/driver/login')
  ↓ (receives token + user)
SecureStore.setItemAsync(token)
  ↓
AuthContext updates
  ↓
useAuth() hook notifies consumers
  ↓
RootNavigator switches to MainTabs
```

### Delivery Status Update Flow

```
DeliveryScreen
  ↓ (user taps "Complete Delivery")
handleStatusUpdate('delivered')
  ↓ (photo, notes)
api.patch('/api/v4/deliveries/{id}')
  ↓ (multipart form data)
Backend updates order status
  ↓
Socket.io broadcasts update
  ↓
locationService notifies listeners (if connected)
  ↓
UI refreshes with new data
```

### Location Tracking Flow

```
HomeScreen/DeliveryScreen
  ↓ (component mounted)
locationService.startTracking(driverId)
  ↓
expo-location.watchPositionAsync()
  ↓ (every 5s or 10m)
handleLocationUpdate()
  ↓
api.patch('/api/v4/drivers/{id}/location')
socket.emit('driver:location-update')
  ↓ (parallel)
Backend stores location / Broadcasts to admin
  ↓
Background tracking continues even when app minimized
```

## State Management Strategy

### Authentication State

- Stored in React Context (AuthContext)
- Persisted via expo-secure-store (JWT token)
- Restored on app launch (useEffect in AuthProvider)
- Provides: isAuthenticated, user, login(), logout()

### Component State

- Local useState for form inputs, UI state
- No Redux/Redux-like patterns needed for this app
- API responses fetched on screen focus (useFocusEffect)

### Async Operations

- API calls via fetch wrapped in try-catch
- Loading states managed locally in components
- Errors displayed via Alert.alert()

## Security Considerations

1. **Token Storage**: JWT stored in SecureStore (encrypted on device)
2. **HTTPS**: All API calls should use HTTPS in production
3. **Permissions**: Location, Camera, etc. are requested at runtime
4. **Secure Code**: No credentials hardcoded; use .env
5. **Input Validation**: All user inputs validated before API calls

## Error Handling

- API errors: Caught and displayed via Alert
- Network errors: User notified to check connection
- Permission errors: User guided to settings
- Auth errors: User redirected to login

## Performance Optimizations

1. **Code Splitting**: Each screen is lazy-loaded
2. **Image Compression**: Photos compressed before upload
3. **Location Throttling**: Updates sent every 5 seconds max
4. **FlatList**: Used for route and stop lists
5. **memoization**: Could be added for expensive computations

## Testing Recommendations

1. **Unit Tests**: Services (API, Auth, Location)
2. **Integration Tests**: Navigation flows
3. **E2E Tests**: Full user journeys (login → delivery → logout)
4. **Device Testing**: Test on both iOS and Android
5. **Network Testing**: Test offline and slow connection scenarios

## Future Enhancements

1. **Offline Support**: Cache routes/deliveries locally
2. **Map Integration**: Native maps for route visualization
3. **Signature Capture**: Digital signature pad
4. **Push Notifications**: Real-time delivery assignment
5. **Analytics**: Track app usage and performance
6. **Biometric Auth**: Fingerprint/Face ID support
7. **Dark Mode**: Theme support
8. **Internationalization**: Multi-language support
9. **Advanced Routing**: Optimize route sequence
10. **Customer Feedback**: In-app ratings and comments

## Deployment

### Development

```bash
npm install
expo start
```

### Testing

```bash
npm run typecheck
npm run lint
expo start --ios / --android
```

### Production

```bash
eas build --platform ios
eas build --platform android
eas submit
```

## Environment Configuration

### .env Variables

```
EXPO_PUBLIC_API_URL=http://your-api.com
EXPO_PUBLIC_SOCKET_URL=http://your-api.com
```

### app.json (Expo Config)

- App name: "Witylogix Driver"
- Package name: com.witylogix.driver
- Plugins configured for permissions
