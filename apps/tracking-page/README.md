# Witylogix Tracking Page

A real-time delivery tracking page for the Witylogix platform. Customers access this via a unique tracking link to monitor their order's delivery status and driver location in real-time.

## Features

- **Real-time Driver Location Tracking**: Displays driver location on an interactive Leaflet map that updates in real-time via Socket.io
- **Live Delivery Status Timeline**: Vertical timeline showing order status progression with timestamps
- **ETA Countdown**: Displays estimated arrival time in human-readable format (e.g., "2h 30m")
- **Driver Information**: Shows driver name, phone number (masked), vehicle type, and license plate
- **Order Summary**: Displays order ID, current status, pickup/delivery addresses, and order date
- **Responsive Design**: Mobile-first design that adapts to all screen sizes
- **Real-time Updates**: Socket.io connection ensures all information updates instantly

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Maps**: Leaflet 1.9
- **Real-time Communication**: Socket.io Client 4.8
- **Styling**: Inline CSS (CSS-in-JS)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_API_URL=http://localhost:3000
```

### Building for Production

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Project Structure

```
tracking-page/
├── src/
│   ├── components/
│   │   ├── TrackingMap.tsx          # Leaflet map component
│   │   ├── StatusTimeline.tsx       # Delivery status timeline
│   │   ├── DriverCard.tsx           # Driver information card
│   │   └── OrderSummary.tsx         # Order details card
│   ├── lib/
│   │   ├── socket.ts                # Socket.io connection manager
│   │   ├── api.ts                   # API client functions
│   │   └── utils.ts                 # Utility functions
│   ├── types.ts                     # TypeScript type definitions
│   ├── App.tsx                      # Main application component
│   └── main.tsx                     # React entry point
├── index.html                       # HTML entry point
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript configuration
└── package.json
```

## Real-time Updates

The app connects to the API server's `/tracking` Socket.io namespace and joins a room based on the order ID. It listens for three types of events:

1. **location:update**: Driver location changes
2. **status:update**: Order status changes
3. **eta:update**: Estimated arrival time changes

## API Requirements

The API server should provide:

### GET /api/tracking/:orderId

Returns initial tracking data with the following structure:

```json
{
  "order": {
    "id": "string",
    "status": "PENDING|ACCEPTED|ASSIGNED|PICKED_UP|OUT_FOR_DELIVERY|ARRIVED|DELIVERED",
    "pickupLocation": {
      "latitude": number,
      "longitude": number,
      "address": "string"
    },
    "deliveryLocation": {
      "latitude": number,
      "longitude": number,
      "address": "string"
    },
    "eta": number,
    "createdAt": number,
    "completedAt": number
  },
  "driver": {
    "id": "string",
    "name": "string",
    "phone": "string",
    "vehicle": {
      "type": "string",
      "licensePlate": "string"
    }
  },
  "currentLocation": {
    "latitude": number,
    "longitude": number,
    "timestamp": number
  },
  "route": [
    {
      "latitude": number,
      "longitude": number,
      "timestamp": number
    }
  ],
  "statusHistory": [
    {
      "status": "string",
      "timestamp": number
    }
  ]
}
```

### Socket.io Events

The server should emit events to clients in the `/tracking` namespace:

**location:update**

```json
{
  "orderId": "string",
  "latitude": number,
  "longitude": number,
  "timestamp": number
}
```

**status:update**

```json
{
  "orderId": "string",
  "status": "string",
  "timestamp": number
}
```

**eta:update**

```json
{
  "orderId": "string",
  "eta": number
}
```

## Design

The app features a clean, mobile-first design using the Witylogix brand colors:

- **Primary Blue**: `#005bd3` (buttons, active states, primary markers)
- **Success Green**: `#008060` (completed statuses, pickup markers)
- **Background**: `#f6f6f7` (page background)

### Layout

- **Mobile** (< 768px): Full-width map (60vh) on top, info section scrolls below
- **Desktop** (>= 768px): Two-column layout with 60% map on left, 40% info sidebar on right

## License

Proprietary - Witylogix
