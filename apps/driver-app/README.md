# Witylogix Driver Mobile App

A React Native (Expo) mobile application for delivery drivers to manage routes, track deliveries, and capture proof of delivery.

## Features

- **Authentication**: Phone number + password login with secure token storage
- **Route Management**: View assigned routes and individual stops
- **Live Delivery Tracking**: Real-time location tracking and delivery status updates
- **Proof of Delivery**: Capture photos and signatures
- **Delivery Status**: Update order status (Pending → Arrived → Delivered/Failed)
- **Driver Dashboard**: View today's stats, active deliveries, and performance metrics
- **Offline Support**: Basic offline functionality for route viewing
- **Background Location Tracking**: Continuous location updates while app is in background

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator/Device
- Physical device for testing (optional but recommended)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

3. Update `.env` with your API endpoint:

```
EXPO_PUBLIC_API_URL=http://your-api-url:3000
```

## Development

Start the development server:

```bash
npm start
```

Run on specific platform:

```bash
# iOS
npm run ios

# Android
npm run android
```

## TypeScript

Run type checking:

```bash
npm run typecheck
```

## Linting

Check code style:

```bash
npm run lint
```

## Project Structure

```
src/
├── navigation/        # Navigation stacks and configurations
├── screens/          # Screen components
├── services/         # API client, auth, location services
├── hooks/            # Custom hooks (useAuth)
└── components/       # Reusable UI components

App.tsx              # Root component with navigation setup
app.json             # Expo configuration
```

## API Endpoints

The app expects the following API structure:

### Authentication

- `POST /api/v4/auth/driver/login` - Login with phone and password
- `POST /api/v4/auth/driver/logout` - Logout

### Deliveries

- `GET /api/v4/drivers/me/active-delivery` - Get current active delivery
- `GET /api/v4/deliveries/{id}` - Get delivery details
- `PATCH /api/v4/deliveries/{id}` - Update delivery status/proof

### Routes

- `GET /api/v4/drivers/me/routes` - Get assigned routes
- `GET /api/v4/routes/{id}` - Get route details
- `PATCH /api/v4/routes/{id}` - Update route status

### Driver

- `GET /api/v4/drivers/me/profile` - Get driver profile
- `GET /api/v4/drivers/me/stats/today` - Get today's statistics
- `PATCH /api/v4/drivers/{id}/location` - Send location update

## Configuration

### Permissions

The app requires these permissions:

- **Camera**: Photo capture for proof of delivery
- **Image Picker**: Select images from gallery
- **Location**: Foreground and background location tracking
- **Secure Store**: Secure token storage

### Environment Variables

- `EXPO_PUBLIC_API_URL`: Backend API base URL

## Building

For production builds, use EAS Build:

```bash
eas build --platform ios
eas build --platform android
```

## Testing

Recommended test scenarios:

1. Login with valid credentials
2. View today's summary and stats
3. Check assigned routes
4. Start a delivery and update status
5. Capture proof of delivery photo
6. Add delivery notes
7. Complete delivery
8. Verify location tracking in background
9. Logout

## Troubleshooting

### Location permission denied

- Grant location permissions in device settings
- For iOS: Check Info.plist permissions
- For Android: Request runtime permissions

### API connection error

- Verify API URL in `.env`
- Check backend server is running
- Verify network connectivity

### Token storage issues

- Clear app data and retry login
- On iOS: Keychain access may require device unlock
- On Android: Verify secure storage setup

## Contributing

1. Follow TypeScript best practices
2. Use React Native StyleSheet for all styles
3. Maintain color scheme (primary blue #005bd3, success green #008060)
4. Test on both iOS and Android before submitting

## License

Copyright © 2026 Witylogix. All rights reserved.
