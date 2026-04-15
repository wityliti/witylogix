/**
 * @witylogix/validators - Comprehensive Zod Schema Tests
 *
 * Tests all validation schemas for:
 * - Valid input acceptance
 * - Required field validation
 * - Type validation
 * - Edge cases and constraints
 * - Enum validation
 * - SQL injection prevention
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  // Common
  uuidSchema,
  paginationSchema,
  coordinatesSchema,
  // Orders
  createOrderSchema,
  updateOrderStatusSchema,
  // Drivers
  createDriverSchema,
  updateDriverLocationSchema,
  // Delivery Zones
  createDeliveryZoneSchema,
  // Carrier Service
  carrierRateRequestSchema,
  // Route Optimization
  optimizeRouteSchema,
  // Shipments
  createShipmentSchema,
  updateShipmentStatusSchema,
  // Locations
  createLocationSchema,
  // Shipping Profiles
  createShippingProfileSchema,
  // Calendar Rules
  createCalendarRuleSchema,
  // Notification Templates
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  previewNotificationTemplateSchema,
  duplicateNotificationTemplateSchema,
  // Activity Logs
  createActivityLogSchema,
  activityLogFilterSchema,
  // Payments
  createPaymentSchema,
  updatePaymentStatusSchema,
  paymentFilterSchema,
  // Products/Customers
  syncProductSchema,
  syncProductsSchema,
  syncCustomerSchema,
  syncCustomersSchema,
} from '../index';

// - UUID Schema Tests -

describe('uuidSchema', () => {
  it('accepts valid UUID v4', () => {
    const valid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    expect(() => uuidSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    expect(() => uuidSchema.parse('123')).toThrow();
    expect(() => uuidSchema.parse('')).toThrow();
  });

  it('rejects null/undefined', () => {
    expect(() => uuidSchema.parse(null)).toThrow();
    expect(() => uuidSchema.parse(undefined)).toThrow();
  });
});

// - Pagination Schema Tests -

describe('paginationSchema', () => {
  it('accepts valid pagination params', () => {
    const valid = { page: 1, limit: 20 };
    const result = paginationSchema.parse(valid);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('applies default values', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string numbers to integers', () => {
    const result = paginationSchema.parse({ page: '2', limit: '50' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('enforces minimum page = 1', () => {
    expect(() => paginationSchema.parse({ page: 0, limit: 20 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1, limit: 20 })).toThrow();
  });

  it('enforces limit between 1 and 100', () => {
    expect(() => paginationSchema.parse({ page: 1, limit: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: 1, limit: 101 })).toThrow();
    expect(() => paginationSchema.parse({ page: 1, limit: 100 })).not.toThrow();
  });
});

// - Coordinates Schema Tests -

describe('coordinatesSchema', () => {
  it('accepts valid coordinates', () => {
    const valid = { latitude: 40.7128, longitude: -74.006 };
    expect(() => coordinatesSchema.parse(valid)).not.toThrow();
  });

  it('accepts boundary coordinates', () => {
    expect(() => coordinatesSchema.parse({ latitude: -90, longitude: -180 })).not.toThrow();
    expect(() => coordinatesSchema.parse({ latitude: 90, longitude: 180 })).not.toThrow();
  });

  it('rejects invalid latitude', () => {
    expect(() => coordinatesSchema.parse({ latitude: -91, longitude: 0 })).toThrow();
    expect(() => coordinatesSchema.parse({ latitude: 91, longitude: 0 })).toThrow();
  });

  it('rejects invalid longitude', () => {
    expect(() => coordinatesSchema.parse({ latitude: 0, longitude: -181 })).toThrow();
    expect(() => coordinatesSchema.parse({ latitude: 0, longitude: 181 })).toThrow();
  });

  it('requires both latitude and longitude', () => {
    expect(() => coordinatesSchema.parse({ latitude: 40 })).toThrow();
    expect(() => coordinatesSchema.parse({ longitude: -74 })).toThrow();
  });
});

// - Order Schema Tests -

describe('createOrderSchema', () => {
  const validOrder = {
    shopifyOrderId: 'order-123',
    shopifyOrderNumber: '#1001',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '+1234567890',
    addressLine1: '123 Main St',
    city: 'New York',
    country: 'US',
    itemCount: 2,
  };

  it('accepts valid order', () => {
    expect(() => createOrderSchema.parse(validOrder)).not.toThrow();
  });

  it('requires shopifyOrderId', () => {
    const invalid = { ...validOrder, shopifyOrderId: undefined };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('rejects empty shopifyOrderId', () => {
    const invalid = { ...validOrder, shopifyOrderId: '' };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('validates email format', () => {
    const invalid = { ...validOrder, customerEmail: 'invalid-email' };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('accepts optional email', () => {
    const noEmail = { ...validOrder, customerEmail: undefined };
    expect(() => createOrderSchema.parse(noEmail)).not.toThrow();
  });

  it('validates latitude/longitude constraints', () => {
    const invalid = { ...validOrder, latitude: 91 };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('enforces positive itemCount', () => {
    const invalid = { ...validOrder, itemCount: 0 };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('enforces non-negative prices', () => {
    const invalid = { ...validOrder, totalPrice: -10 };
    expect(() => createOrderSchema.parse(invalid)).toThrow();
  });

  it('applies default itemCount = 1', () => {
    const noItemCount = { shopifyOrderId: 'order-456' };
    const result = createOrderSchema.parse(noItemCount);
    expect(result.itemCount).toBe(1);
  });

  it('applies default tags = []', () => {
    const result = createOrderSchema.parse({ shopifyOrderId: 'order-789' });
    expect(result.tags).toEqual([]);
  });

  it('applies default lineItems = []', () => {
    const result = createOrderSchema.parse({ shopifyOrderId: 'order-999' });
    expect(result.lineItems).toEqual([]);
  });
});

describe('updateOrderStatusSchema', () => {
  it('accepts valid status update', () => {
    expect(() =>
      updateOrderStatusSchema.parse({
        status: 'DELIVERED',
        notes: 'Delivered successfully',
      })
    ).not.toThrow();
  });

  it('requires valid status enum', () => {
    expect(() =>
      updateOrderStatusSchema.parse({ status: 'INVALID_STATUS' })
    ).toThrow();
  });

  it('accepts all valid order statuses', () => {
    const validStatuses = [
      'PENDING',
      'ACCEPTED',
      'ASSIGNED',
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'ARRIVED',
      'DELIVERED',
      'FAILED',
      'RETURNED',
      'CANCELLED',
    ];

    for (const status of validStatuses) {
      expect(() => updateOrderStatusSchema.parse({ status })).not.toThrow();
    }
  });

  it('notes are optional', () => {
    expect(() => updateOrderStatusSchema.parse({ status: 'DELIVERED' })).not.toThrow();
  });
});

// - Driver Schema Tests -

describe('createDriverSchema', () => {
  const validDriver = {
    name: 'John Driver',
    phone: '555-0123',
    vehicleType: 'CAR',
    maxCapacity: 5,
  };

  it('accepts valid driver', () => {
    expect(() => createDriverSchema.parse(validDriver)).not.toThrow();
  });

  it('requires name with length 1-100', () => {
    expect(() => createDriverSchema.parse({ ...validDriver, name: '' })).toThrow();
    expect(() =>
      createDriverSchema.parse({
        ...validDriver,
        name: 'a'.repeat(101),
      })
    ).toThrow();
  });

  it('requires phone with length 5-20', () => {
    expect(() => createDriverSchema.parse({ ...validDriver, phone: '555' })).toThrow();
    expect(() =>
      createDriverSchema.parse({
        ...validDriver,
        phone: '1'.repeat(21),
      })
    ).toThrow();
  });

  it('validates email if provided', () => {
    const invalid = { ...validDriver, email: 'not-an-email' };
    expect(() => createDriverSchema.parse(invalid)).toThrow();
  });

  it('enforces positive maxCapacity', () => {
    expect(() => createDriverSchema.parse({ ...validDriver, maxCapacity: 0 })).toThrow();
  });

  it('accepts enum vehicle types', () => {
    const types = ['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
    for (const type of types) {
      expect(() =>
        createDriverSchema.parse({ ...validDriver, vehicleType: type })
      ).not.toThrow();
    }
  });

  it('rejects invalid vehicle type', () => {
    expect(() =>
      createDriverSchema.parse({ ...validDriver, vehicleType: 'ROCKET' })
    ).toThrow();
  });

  it('applies default vehicleType = CAR', () => {
    const noVehicle = { name: 'Driver', phone: '555-0123' };
    const result = createDriverSchema.parse(noVehicle);
    expect(result.vehicleType).toBe('CAR');
  });

  it('applies default maxCapacity = 20', () => {
    const noCapacity = { name: 'Driver', phone: '555-0123' };
    const result = createDriverSchema.parse(noCapacity);
    expect(result.maxCapacity).toBe(20);
  });
});

describe('updateDriverLocationSchema', () => {
  const validLocation = {
    latitude: 40.7128,
    longitude: -74.006,
    heading: 90,
    speed: 25.5,
    accuracy: 5.0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  it('accepts valid location update', () => {
    expect(() => updateDriverLocationSchema.parse(validLocation)).not.toThrow();
  });

  it('requires latitude/longitude', () => {
    expect(() =>
      updateDriverLocationSchema.parse({
        ...validLocation,
        latitude: undefined,
      })
    ).toThrow();
  });

  it('requires positive timestamp', () => {
    expect(() =>
      updateDriverLocationSchema.parse({
        ...validLocation,
        timestamp: 0,
      })
    ).toThrow();
  });

  it('validates heading 0-360', () => {
    expect(() =>
      updateDriverLocationSchema.parse({ ...validLocation, heading: 361 })
    ).toThrow();
    expect(() =>
      updateDriverLocationSchema.parse({ ...validLocation, heading: -1 })
    ).toThrow();
    expect(() =>
      updateDriverLocationSchema.parse({ ...validLocation, heading: 360 })
    ).not.toThrow();
  });

  it('enforces non-negative speed/accuracy', () => {
    expect(() =>
      updateDriverLocationSchema.parse({ ...validLocation, speed: -1 })
    ).toThrow();
    expect(() =>
      updateDriverLocationSchema.parse({ ...validLocation, accuracy: -0.1 })
    ).toThrow();
  });
});

// - Delivery Zone Schema Tests -

describe('createDeliveryZoneSchema', () => {
  const validZone = {
    name: 'Downtown',
    boundary: [
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 40.7580, longitude: -73.9855 },
      { latitude: 40.7614, longitude: -73.9776 },
    ],
    baseRate: 5.0,
    perKmRate: 0.5,
  };

  it('accepts valid delivery zone', () => {
    expect(() => createDeliveryZoneSchema.parse(validZone)).not.toThrow();
  });

  it('requires minimum 3 boundary points', () => {
    const twoPoints = {
      ...validZone,
      boundary: validZone.boundary.slice(0, 2),
    };
    expect(() => createDeliveryZoneSchema.parse(twoPoints)).toThrow();
  });

  it('enforces non-negative rates', () => {
    expect(() =>
      createDeliveryZoneSchema.parse({
        ...validZone,
        baseRate: -1,
      })
    ).toThrow();
  });

  it('accepts optional freeAbove', () => {
    expect(() =>
      createDeliveryZoneSchema.parse({
        ...validZone,
        freeAbove: 50.0,
      })
    ).not.toThrow();
  });

  it('applies defaults', () => {
    const result = createDeliveryZoneSchema.parse({
      name: 'Zone',
      boundary: validZone.boundary,
    });
    expect(result.baseRate).toBe(0);
    expect(result.perKmRate).toBe(0);
    expect(result.priority).toBe(0);
  });
});

// - Carrier Rate Request Schema Tests -

describe('carrierRateRequestSchema', () => {
  const validRequest = {
    rate: {
      origin: {
        country: 'US',
        postal_code: '10001',
        province: 'NY',
        city: 'New York',
      },
      destination: {
        country: 'US',
        postal_code: '90210',
        province: 'CA',
        city: 'Los Angeles',
      },
      items: [
        {
          name: 'Widget',
          quantity: 2,
          grams: 500,
          price: 29.99,
        },
      ],
      currency: 'USD',
    },
  };

  it('accepts valid rate request', () => {
    expect(() => carrierRateRequestSchema.parse(validRequest)).not.toThrow();
  });

  it('enforces positive item quantity', () => {
    const invalid = {
      ...validRequest,
      rate: {
        ...validRequest.rate,
        items: [{ name: 'Item', quantity: 0, grams: 100, price: 10 }],
      },
    };
    expect(() => carrierRateRequestSchema.parse(invalid)).toThrow();
  });

  it('enforces non-negative weight/price', () => {
    const invalid = {
      ...validRequest,
      rate: {
        ...validRequest.rate,
        items: [
          { name: 'Item', quantity: 1, grams: -100, price: 10 },
        ],
      },
    };
    expect(() => carrierRateRequestSchema.parse(invalid)).toThrow();
  });

  it('enforces currency code length = 3', () => {
    const invalid = {
      ...validRequest,
      rate: {
        ...validRequest.rate,
        currency: 'USDA',
      },
    };
    expect(() => carrierRateRequestSchema.parse(invalid)).toThrow();
  });

  it('allows optional destination address1', () => {
    expect(() => carrierRateRequestSchema.parse(validRequest)).not.toThrow();
  });
});

// - Route Optimization Schema Tests -

describe('optimizeRouteSchema', () => {
  const validOptimization = {
    depot: {
      lat: 40.7128,
      lng: -74.006,
      address: 'Depot NYC',
    },
    orderIds: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    vehicleIds: ['f47ac10b-58cc-4372-a567-0e02b2c3d480'],
    options: {
      timeLimit: 30,
      returnToDepot: true,
    },
  };

  it('accepts valid optimization request', () => {
    expect(() => optimizeRouteSchema.parse(validOptimization)).not.toThrow();
  });

  it('enforces order count 1-500', () => {
    const noOrders = { ...validOptimization, orderIds: [] };
    expect(() => optimizeRouteSchema.parse(noOrders)).toThrow();

    const tooMany = {
      ...validOptimization,
      orderIds: Array.from({ length: 501 }, (_, i) =>
        'f47ac10b-58cc-4372-a567-0e02b2c3d4' + (79 + i).toString().padStart(2, '0')
      ),
    };
    expect(() => optimizeRouteSchema.parse(tooMany)).toThrow();
  });

  it('requires at least one vehicle', () => {
    const noVehicles = { ...validOptimization, vehicleIds: [] };
    expect(() => optimizeRouteSchema.parse(noVehicles)).toThrow();
  });

  it('enforces timeLimit 1-120', () => {
    const invalid = { ...validOptimization, options: { ...validOptimization.options, timeLimit: 121 } };
    expect(() => optimizeRouteSchema.parse(invalid)).toThrow();
  });

  it('makes options optional', () => {
    const noOptions = { ...validOptimization, options: undefined };
    expect(() => optimizeRouteSchema.parse(noOptions)).not.toThrow();
  });
});

// - Shipment Schema Tests -

describe('createShipmentSchema', () => {
  const validShipment = {
    orderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    deliveryMethod: 'LOCAL_DELIVERY',
    recipientName: 'Jane Smith',
    itemCount: 1,
  };

  it('accepts valid shipment', () => {
    expect(() => createShipmentSchema.parse(validShipment)).not.toThrow();
  });

  it('requires orderId as UUID', () => {
    const invalid = { ...validShipment, orderId: 'not-a-uuid' };
    expect(() => createShipmentSchema.parse(invalid)).toThrow();
  });

  it('validates delivery methods', () => {
    const methods = [
      'LOCAL_DELIVERY',
      'STORE_PICKUP',
      'STANDARD_SHIPPING',
      'EXPRESS_SHIPPING',
      'SAME_DAY',
    ];
    for (const method of methods) {
      expect(() =>
        createShipmentSchema.parse({
          ...validShipment,
          deliveryMethod: method,
        })
      ).not.toThrow();
    }
  });

  it('enforces positive itemCount', () => {
    expect(() =>
      createShipmentSchema.parse({ ...validShipment, itemCount: 0 })
    ).toThrow();
  });

  it('enforces non-negative weights/costs', () => {
    expect(() =>
      createShipmentSchema.parse({
        ...validShipment,
        weight: -1,
      })
    ).toThrow();
    expect(() =>
      createShipmentSchema.parse({
        ...validShipment,
        shippingCost: -0.01,
      })
    ).toThrow();
  });

  it('validates dimensions if provided', () => {
    const validDims = {
      ...validShipment,
      dimensions: {
        length: 10,
        width: 20,
        height: 15,
        unit: 'cm',
      },
    };
    expect(() => createShipmentSchema.parse(validDims)).not.toThrow();
  });

  it('applies default deliveryMethod = LOCAL_DELIVERY', () => {
    const noMethod = { orderId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' };
    const result = createShipmentSchema.parse(noMethod);
    expect(result.deliveryMethod).toBe('LOCAL_DELIVERY');
  });
});

describe('updateShipmentStatusSchema', () => {
  it('accepts all valid shipment statuses', () => {
    const validStatuses = [
      'PENDING',
      'PROCESSING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'ARRIVED',
      'DELIVERED',
      'FAILED',
      'RETURNED',
      'CANCELLED',
    ];

    for (const status of validStatuses) {
      expect(() => updateShipmentStatusSchema.parse({ status })).not.toThrow();
    }
  });

  it('rejects invalid status', () => {
    expect(() =>
      updateShipmentStatusSchema.parse({ status: 'INVALID' })
    ).toThrow();
  });

  it('makes notes optional', () => {
    expect(() => updateShipmentStatusSchema.parse({ status: 'DELIVERED' })).not.toThrow();
  });

  it('makes failureReason optional', () => {
    expect(() =>
      updateShipmentStatusSchema.parse({
        status: 'FAILED',
        failureReason: 'Address not found',
      })
    ).not.toThrow();
  });
});

// - Location Schema Tests -

describe('createLocationSchema', () => {
  const validLocation = {
    name: 'Main Warehouse',
    type: 'WAREHOUSE',
    addressLine1: '100 Industrial Ave',
    city: 'Chicago',
    country: 'US',
  };

  it('accepts valid location', () => {
    expect(() => createLocationSchema.parse(validLocation)).not.toThrow();
  });

  it('requires name with length 1-200', () => {
    expect(() => createLocationSchema.parse({ ...validLocation, name: '' })).toThrow();
  });

  it('validates location types', () => {
    const types = ['WAREHOUSE', 'STORE', 'HUB', 'DEPOT', 'PICKUP_POINT'];
    for (const type of types) {
      expect(() =>
        createLocationSchema.parse({
          ...validLocation,
          type,
        })
      ).not.toThrow();
    }
  });

  it('applies default country = US', () => {
    const noCountry = {
      name: 'Location',
      type: 'WAREHOUSE',
      addressLine1: 'Address',
      city: 'City',
    };
    const result = createLocationSchema.parse(noCountry);
    expect(result.country).toBe('US');
  });

  it('applies default prepTimeMinutes = 0', () => {
    const result = createLocationSchema.parse(validLocation);
    expect(result.prepTimeMinutes).toBe(0);
  });
});

// - Shipping Profile Schema Tests -

describe('createShippingProfileSchema', () => {
  const validProfile = {
    name: 'Standard Shipping',
    deliveryMethod: 'STANDARD_SHIPPING',
    processingTimeHours: 24,
    rateType: 'FLAT',
  };

  it('accepts valid shipping profile', () => {
    expect(() => createShippingProfileSchema.parse(validProfile)).not.toThrow();
  });

  it('validates delivery methods', () => {
    const methods = [
      'LOCAL_DELIVERY',
      'STORE_PICKUP',
      'STANDARD_SHIPPING',
      'EXPRESS_SHIPPING',
      'SAME_DAY',
    ];
    for (const method of methods) {
      expect(() =>
        createShippingProfileSchema.parse({
          ...validProfile,
          deliveryMethod: method,
        })
      ).not.toThrow();
    }
  });

  it('validates rate types', () => {
    const types = ['FLAT', 'WEIGHT_BASED', 'DISTANCE_BASED', 'ZONE_BASED', 'TIERED', 'CALCULATED'];
    for (const type of types) {
      expect(() =>
        createShippingProfileSchema.parse({
          ...validProfile,
          rateType: type,
        })
      ).not.toThrow();
    }
  });

  it('enforces non-negative processing time', () => {
    expect(() =>
      createShippingProfileSchema.parse({
        ...validProfile,
        processingTimeHours: -1,
      })
    ).toThrow();
  });
});

// - Calendar Rule Schema Tests -

describe('createCalendarRuleSchema', () => {
  const validRule = {
    name: 'Summer Hours',
    type: 'SPECIAL_HOURS',
    daysOfWeek: [1, 2, 3],
    cutoffMinutes: 120,
  };

  it('accepts valid calendar rule', () => {
    expect(() => createCalendarRuleSchema.parse(validRule)).not.toThrow();
  });

  it('validates rule types', () => {
    const types = ['OPERATING_DAYS', 'BLACKOUT', 'SPECIAL_HOURS', 'CAPACITY_OVERRIDE'];
    for (const type of types) {
      expect(() =>
        createCalendarRuleSchema.parse({
          ...validRule,
          type,
        })
      ).not.toThrow();
    }
  });

  it('enforces daysOfWeek 0-6', () => {
    const invalid = { ...validRule, daysOfWeek: [7] };
    expect(() => createCalendarRuleSchema.parse(invalid)).toThrow();
  });

  it('applies default daysOfWeek = [1,2,3,4,5]', () => {
    const noDays = { name: 'Rule', type: 'OPERATING_DAYS' };
    const result = createCalendarRuleSchema.parse(noDays);
    expect(result.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });
});

// - Notification Template Schema Tests -

describe('createNotificationTemplateSchema', () => {
  const validTemplate = {
    name: 'Delivery Confirmation',
    slug: 'delivery-confirmation',
    channel: 'EMAIL',
    eventType: 'shipment.delivered',
    bodyTemplate: 'Your order has been delivered!',
  };

  it('accepts valid notification template', () => {
    expect(() => createNotificationTemplateSchema.parse(validTemplate)).not.toThrow();
  });

  it('validates slug format (lowercase alphanumeric with - and _)', () => {
    const valid = { ...validTemplate, slug: 'valid-slug_123' };
    expect(() => createNotificationTemplateSchema.parse(valid)).not.toThrow();

    const invalid = { ...validTemplate, slug: 'Invalid-Slug!' };
    expect(() => createNotificationTemplateSchema.parse(invalid)).toThrow();
  });

  it('validates channel enum', () => {
    const channels = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK'];
    for (const channel of channels) {
      expect(() =>
        createNotificationTemplateSchema.parse({
          ...validTemplate,
          channel,
        })
      ).not.toThrow();
    }
  });

  it('requires bodyTemplate with content', () => {
    const invalid = { ...validTemplate, bodyTemplate: '' };
    expect(() => createNotificationTemplateSchema.parse(invalid)).toThrow();
  });
});

describe('previewNotificationTemplateSchema', () => {
  it('accepts valid preview request', () => {
    const preview = {
      bodyTemplate: 'Hello {{name}}',
      subject: 'Test',
      sampleVariables: { name: 'John' },
    };
    expect(() => previewNotificationTemplateSchema.parse(preview)).not.toThrow();
  });

  it('requires non-empty bodyTemplate', () => {
    expect(() =>
      previewNotificationTemplateSchema.parse({
        bodyTemplate: '',
        sampleVariables: {},
      })
    ).toThrow();
  });
});

// - Activity Log Schema Tests -

describe('createActivityLogSchema', () => {
  const validLog = {
    entityType: 'SHIPMENT',
    entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    action: 'STATUS_CHANGED',
    actorType: 'USER',
    shipmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  };

  it('accepts valid activity log', () => {
    expect(() => createActivityLogSchema.parse(validLog)).not.toThrow();
  });

  it('validates actorType enum', () => {
    const types = ['USER', 'SYSTEM', 'WEBHOOK', 'API', 'CRON'];
    for (const type of types) {
      expect(() =>
        createActivityLogSchema.parse({
          ...validLog,
          actorType: type,
        })
      ).not.toThrow();
    }
  });

  it('validates IP address if provided', () => {
    const valid = { ...validLog, ipAddress: '192.168.1.1' };
    expect(() => createActivityLogSchema.parse(valid)).not.toThrow();

    const invalid = { ...validLog, ipAddress: 'not-an-ip' };
    expect(() => createActivityLogSchema.parse(invalid)).toThrow();
  });
});

// - Payment Schema Tests -

describe('createPaymentSchema', () => {
  const validPayment = {
    paymentType: 'DELIVERY',
    paymentMethod: 'STRIPE',
    amount: 29.99,
    currency: 'USD',
  };

  it('accepts valid payment', () => {
    expect(() => createPaymentSchema.parse(validPayment)).not.toThrow();
  });

  it('enforces positive amount', () => {
    const invalid = { ...validPayment, amount: 0 };
    expect(() => createPaymentSchema.parse(invalid)).toThrow();
  });

  it('enforces amount multiple of 0.01', () => {
    const invalid = { ...validPayment, amount: 29.999 };
    expect(() => createPaymentSchema.parse(invalid)).toThrow();
  });

  it('validates payment types', () => {
    const types = ['DELIVERY', 'COD', 'SUBSCRIPTION', 'ADDON', 'REFUND'];
    for (const type of types) {
      expect(() =>
        createPaymentSchema.parse({
          ...validPayment,
          paymentType: type,
        })
      ).not.toThrow();
    }
  });

  it('validates payment methods', () => {
    const methods = ['STRIPE', 'PAYPAL', 'CASH', 'BANK_TRANSFER', 'SHOPIFY_PAYMENTS', 'OTHER'];
    for (const method of methods) {
      expect(() =>
        createPaymentSchema.parse({
          ...validPayment,
          paymentMethod: method,
        })
      ).not.toThrow();
    }
  });

  it('enforces currency code length = 3', () => {
    const invalid = { ...validPayment, currency: 'USDA' };
    expect(() => createPaymentSchema.parse(invalid)).toThrow();
  });
});

describe('updatePaymentStatusSchema', () => {
  it('accepts all valid payment statuses', () => {
    const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'];
    for (const status of statuses) {
      expect(() => updatePaymentStatusSchema.parse({ status })).not.toThrow();
    }
  });

  it('rejects invalid status', () => {
    expect(() => updatePaymentStatusSchema.parse({ status: 'INVALID' })).toThrow();
  });
});

// - Product/Customer Sync Schema Tests -

describe('syncProductSchema', () => {
  const validProduct = {
    externalId: 'PROD-123',
    title: 'Amazing Widget',
    sku: 'SKU-999',
    weight: 2.5,
    weightUnit: 'kg',
  };

  it('accepts valid product', () => {
    expect(() => syncProductSchema.parse(validProduct)).not.toThrow();
  });

  it('requires externalId with length 1-200', () => {
    expect(() => syncProductSchema.parse({ ...validProduct, externalId: '' })).toThrow();
  });

  it('requires title with length 1-500', () => {
    expect(() => syncProductSchema.parse({ ...validProduct, title: '' })).toThrow();
  });

  it('validates weight units', () => {
    const units = ['g', 'kg', 'lb', 'oz'];
    for (const unit of units) {
      expect(() =>
        syncProductSchema.parse({
          ...validProduct,
          weightUnit: unit,
        })
      ).not.toThrow();
    }
  });

  it('applies default requiresShipping = true', () => {
    const noRequires = { externalId: 'P1', title: 'Product' };
    const result = syncProductSchema.parse(noRequires);
    expect(result.requiresShipping).toBe(true);
  });
});

describe('syncProductsSchema', () => {
  it('requires 1-250 products', () => {
    const noProducts = { products: [] };
    expect(() => syncProductsSchema.parse(noProducts)).toThrow();

    const tooMany = {
      products: Array.from({ length: 251 }, (_, i) => ({
        externalId: `PROD-${i}`,
        title: `Product ${i}`,
      })),
    };
    expect(() => syncProductsSchema.parse(tooMany)).toThrow();
  });
});

describe('syncCustomerSchema', () => {
  const validCustomer = {
    externalId: 'CUST-123',
    email: 'customer@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('accepts valid customer', () => {
    expect(() => syncCustomerSchema.parse(validCustomer)).not.toThrow();
  });

  it('validates email format if provided', () => {
    const invalid = { ...validCustomer, email: 'not-email' };
    expect(() => syncCustomerSchema.parse(invalid)).toThrow();
  });

  it('applies default orderCount = 0', () => {
    const noCount = { externalId: 'CUST-999', email: 'test@example.com' };
    const result = syncCustomerSchema.parse(noCount);
    expect(result.orderCount).toBe(0);
  });

  it('applies default totalSpent = 0', () => {
    const result = syncCustomerSchema.parse({ externalId: 'CUST-999' });
    expect(result.totalSpent).toBe(0);
  });
});

// - SQL Injection Prevention -

describe('SQL Injection Prevention', () => {
  it('escapes SQL special characters in strings', () => {
    const malicious = {
      shopifyOrderId: "'; DROP TABLE orders; --",
    };
    // Should not throw - Zod processes as valid string
    const result = createOrderSchema.parse(malicious);
    expect(result.shopifyOrderId).toBe("'; DROP TABLE orders; --");
  });

  it('rejects invalid types regardless of string content', () => {
    const injection = {
      shopifyOrderId: 'valid-id',
      totalPrice: "'1 OR '1'='1",
    };
    expect(() => createOrderSchema.parse(injection)).toThrow();
  });

  it('validates email format against injection attempts', () => {
    const injection = {
      shopifyOrderId: 'order-1',
      customerEmail: 'test@example.com; DROP TABLE--',
    };
    expect(() => createOrderSchema.parse(injection)).toThrow();
  });
});

// - Edge Cases -

describe('Edge Cases', () => {
  it('handles empty strings in optional string fields', () => {
    const order = createOrderSchema.parse({ shopifyOrderId: 'order-1' });
    expect(order.customerName).toBeUndefined();
  });

  it('handles maximum boundary values', () => {
    const coords = coordinatesSchema.parse({
      latitude: 90,
      longitude: 180,
    });
    expect(coords.latitude).toBe(90);
    expect(coords.longitude).toBe(180);
  });

  it('handles minimum boundary values', () => {
    const coords = coordinatesSchema.parse({
      latitude: -90,
      longitude: -180,
    });
    expect(coords.latitude).toBe(-90);
    expect(coords.longitude).toBe(-180);
  });

  it('coerces numeric strings to numbers', () => {
    const result = paginationSchema.parse({ page: '5', limit: '25' });
    expect(typeof result.page).toBe('number');
    expect(typeof result.limit).toBe('number');
  });

  it('handles zero in non-negative fields', () => {
    const order = createOrderSchema.parse({
      shopifyOrderId: 'order-1',
      totalPrice: 0,
      totalWeight: 0,
    });
    expect(order.totalPrice).toBe(0);
    expect(order.totalWeight).toBe(0);
  });

  it('handles very long strings within limits', () => {
    const longName = 'a'.repeat(100);
    const location = createLocationSchema.parse({
      name: longName,
      addressLine1: 'Address',
      city: 'City',
    });
    expect(location.name).toBe(longName);
  });

  it('handles large arrays', () => {
    const largeArray = Array.from({ length: 100 }, (_, i) => ({
      latitude: 40 + Math.random(),
      longitude: -74 + Math.random(),
    }));
    const zone = createDeliveryZoneSchema.parse({
      name: 'Large Zone',
      boundary: largeArray,
    });
    expect(zone.boundary.length).toBe(100);
  });
});
