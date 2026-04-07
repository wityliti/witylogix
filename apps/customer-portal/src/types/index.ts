/**
 * Customer Portal Types
 * Domain-specific types for the customer self-service portal
 */

export type OrderStatus = 'pending' | 'confirmed' | 'out-for-delivery' | 'delivered' | 'cancelled';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'whatsapp';

export type SafePlaceInstruction = 'front-door' | 'back-door' | 'garage' | 'neighbor';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  scheduledDeliveryDate: Date;
  actualDeliveryDate?: Date;
  items: OrderItem[];
  deliveryAddress: Address;
  totalPrice: number;
  estimatedDelivery?: string;
  deliveryProgress?: number;
  rating?: OrderRating;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryTimestep {
  step: 'ordered' | 'confirmed' | 'out-for-delivery' | 'delivered';
  status: 'pending' | 'completed';
  timestamp?: Date;
  details?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  photo?: string;
  vehicle: {
    type: string;
    plate: string;
    color: string;
  };
  rating: number;
}

export interface LiveTracking {
  orderId: string;
  driverId: string;
  driver: Driver;
  currentLocation: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  remainingStops: number;
  eta: Date;
  route?: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export interface OrderRating {
  driverRating: number;
  experienceRating: number;
  feedback?: string;
  photos?: string[];
  createdAt: Date;
}

export interface CustomerPreferences {
  safePlace?: {
    instruction: SafePlaceInstruction;
    customNote?: string;
  };
  accessCodes?: {
    gateCode?: string;
    buildingEntry?: string;
  };
  preferredDeliveryTimes?: {
    dayOfWeek: number; // 0-6
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  }[];
  notificationPreferences: Partial<Record<NotificationChannel, boolean>>;
  defaultAddress: Address;
}

export interface RescheduleRequest {
  orderId: string;
  currentDeliveryDate: Date;
  newDeliveryDate: Date;
  timeSlot: string;
  reason?: string;
}

// Sprint 4.6 Real-time Tracking Types
export type DeliveryStep = 'ordered' | 'confirmed' | 'dispatched' | 'out-for-delivery' | 'nearby' | 'delivered';

export interface DeliveryStepDetail {
  step: DeliveryStep;
  status: 'pending' | 'completed' | 'current';
  timestamp?: Date;
  details?: string;
  expandedInfo?: {
    driverAssigned?: string;
    estimatedTime?: Date;
    proofOfDelivery?: {
      photo?: string;
      signature?: string;
    };
  };
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  bearing?: number; // degrees (0-360)
  speed?: number; // km/h
  timestamp: Date;
}

export interface DeliveryTracking {
  orderId: string;
  driverId: string;
  driver: Driver;
  driverPosition: DriverLocation;
  deliveryStatus: DeliveryStep;
  eta: Date;
  route?: DriverLocation[]; // completed route points
  remainingRoute?: DriverLocation[]; // remaining route points
  destinationLatitude: number;
  destinationLongitude: number;
  isConnected: boolean;
  error?: string;
  lastUpdated: Date;
}

export interface RatingCategory {
  driver: number;
  timeliness: number;
  condition: number;
}

export interface EnhancedOrderRating extends OrderRating {
  categories?: RatingCategory;
  wouldOrderAgain?: boolean;
}
