// @ts-nocheck
/**
 * Database Seed Script for Witylogix Platform
 *
 * Creates comprehensive demo data for development:
 * - 3 Organizations (Acme Logistics, Metro Delivery Co, FastShip Inc)
 * - 10 Users across organizations with different roles
 * - 5 Delivery Zones with PostGIS-style polygon data
 * - 20 Drivers assigned across organizations
 * - 50 Orders in various statuses
 * - 30 Shipments linked to orders
 * - Notification templates for key events
 * - Webhook configurations
 * - 3 Billing plans (Free, Pro, Enterprise)
 *
 * Uses upsert pattern for idempotency — safe to run multiple times.
 * All timestamps use `(prisma as any).modelName` pattern for access.
 */

import { PrismaClient } from "./generated/prisma";
import * as crypto from "crypto";

// Color output helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color: string, label: string, message: string) {
  console.log(`${color}${label}${colors.reset} ${message}`);
}

// Simple password hashing using Node.js crypto (scrypt-like alternative)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Generate demo data
const prisma = new PrismaClient();
const db = prisma;

async function main() {
  try {
    log(colors.cyan, "▶", "Starting database seed...\n");

    // ─────────────────────────────────────────────────────────
    // 1. Create Organizations
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Organizations...");

    const orgs = await Promise.all([
      db.organization.upsert({
        where: { slug: "acme-logistics" },
        update: {},
        create: {
          name: "Acme Logistics",
          slug: "acme-logistics",
          email: "billing@acme-logistics.com",
          planTier: "GROWTH",
          isActive: true,
          settings: {
            timezone: "America/New_York",
            notificationPrefs: { email: true, sms: true, push: true },
          },
        },
      }),
      db.organization.upsert({
        where: { slug: "metro-delivery" },
        update: {},
        create: {
          name: "Metro Delivery Co",
          slug: "metro-delivery",
          email: "billing@metro-delivery.com",
          planTier: "GROWTH",
          isActive: true,
          settings: {
            timezone: "America/Chicago",
            notificationPrefs: { email: true, sms: true, push: false },
          },
        },
      }),
      db.organization.upsert({
        where: { slug: "fastship-inc" },
        update: {},
        create: {
          name: "FastShip Inc",
          slug: "fastship-inc",
          email: "billing@fastship.com",
          planTier: "ENTERPRISE",
          isActive: true,
          settings: {
            timezone: "America/Los_Angeles",
            notificationPrefs: { email: true, sms: true, push: true },
          },
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${orgs.length} organizations`);

    // ─────────────────────────────────────────────────────────
    // 2. Create Shops (linked to organizations)
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Shops...");

    const shops = await Promise.all([
      db.shop.upsert({
        where: { shopifyDomain: "acme-logistics.myshopify.com" },
        update: {},
        create: {
          orgId: orgs[0].id,
          shopifyDomain: "acme-logistics.myshopify.com",
          shopifyAccessToken: "shpat_acme_demo_token_12345",
          shopifyShopId: "gid://shopify/Shop/1",
          name: "Acme Logistics Shop",
          email: "shop@acme-logistics.com",
          phone: "+1-212-555-0100",
          timezone: "America/New_York",
          currency: "USD",
          planTier: "GROWTH",
          isActive: true,
          settings: {
            defaultCarrier: "local",
            trackingEnabled: true,
          },
        },
      }),
      db.shop.upsert({
        where: { shopifyDomain: "metro-delivery.myshopify.com" },
        update: {},
        create: {
          orgId: orgs[1].id,
          shopifyDomain: "metro-delivery.myshopify.com",
          shopifyAccessToken: "shpat_metro_demo_token_12345",
          shopifyShopId: "gid://shopify/Shop/2",
          name: "Metro Delivery Shop",
          email: "shop@metro-delivery.com",
          phone: "+1-312-555-0200",
          timezone: "America/Chicago",
          currency: "USD",
          planTier: "GROWTH",
          isActive: true,
          settings: {
            defaultCarrier: "local",
            trackingEnabled: true,
          },
        },
      }),
      db.shop.upsert({
        where: { shopifyDomain: "fastship-inc.myshopify.com" },
        update: {},
        create: {
          orgId: orgs[2].id,
          shopifyDomain: "fastship-inc.myshopify.com",
          shopifyAccessToken: "shpat_fastship_demo_token_12345",
          shopifyShopId: "gid://shopify/Shop/3",
          name: "FastShip Inc Shop",
          email: "shop@fastship.com",
          phone: "+1-415-555-0300",
          timezone: "America/Los_Angeles",
          currency: "USD",
          planTier: "ENTERPRISE",
          isActive: true,
          settings: {
            defaultCarrier: "local",
            trackingEnabled: true,
          },
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${shops.length} shops`);

    // ─────────────────────────────────────────────────────────
    // 3. Create Users across organizations
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Users...");

    const userEmails = [
      {
        shop: 0,
        email: "admin@acme-logistics.com",
        name: "Alice Johnson",
        role: "ADMIN",
      },
      {
        shop: 0,
        email: "dispatcher@acme-logistics.com",
        name: "Bob Smith",
        role: "DISPATCHER",
      },
      {
        shop: 0,
        email: "viewer@acme-logistics.com",
        name: "Charlie Davis",
        role: "VIEWER",
      },
      {
        shop: 1,
        email: "admin@metro-delivery.com",
        name: "Diana Wilson",
        role: "ADMIN",
      },
      {
        shop: 1,
        email: "dispatcher@metro-delivery.com",
        name: "Eve Martinez",
        role: "DISPATCHER",
      },
      {
        shop: 1,
        email: "viewer@metro-delivery.com",
        name: "Frank Anderson",
        role: "VIEWER",
      },
      {
        shop: 2,
        email: "admin@fastship.com",
        name: "Grace Lee",
        role: "ADMIN",
      },
      {
        shop: 2,
        email: "dispatcher@fastship.com",
        name: "Henry Brown",
        role: "DISPATCHER",
      },
      {
        shop: 2,
        email: "viewer@fastship.com",
        name: "Ivy Taylor",
        role: "VIEWER",
      },
      {
        shop: 2,
        email: "super@fastship.com",
        name: "Jack Miller",
        role: "SUPER_ADMIN",
      },
    ];

    const users = await Promise.all(
      userEmails.map((u) =>
        db.user.upsert({
          where: { shopId_email: { shopId: shops[u.shop].id, email: u.email } },
          update: {},
          create: {
            shopId: shops[u.shop].id,
            email: u.email,
            name: u.name,
            role: u.role,
            password: hashPassword("demo123456"),
            isActive: true,
          },
        }),
      ),
    );

    log(colors.green, "✓", `Created ${users.length} users`);

    // ─────────────────────────────────────────────────────────
    // 4. Create Organization Members
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Organization Members...");

    // Link users to their organizations
    await Promise.all([
      db.orgMember.upsert({
        where: { orgId_userId: { orgId: orgs[0].id, userId: users[0].id } },
        update: {},
        create: {
          orgId: orgs[0].id,
          userId: users[0].id,
          role: "OWNER",
          shopIds: [],
        },
      }),
      db.orgMember.upsert({
        where: { orgId_userId: { orgId: orgs[0].id, userId: users[1].id } },
        update: {},
        create: {
          orgId: orgs[0].id,
          userId: users[1].id,
          role: "ADMIN",
          shopIds: [],
        },
      }),
      db.orgMember.upsert({
        where: { orgId_userId: { orgId: orgs[1].id, userId: users[3].id } },
        update: {},
        create: {
          orgId: orgs[1].id,
          userId: users[3].id,
          role: "OWNER",
          shopIds: [],
        },
      }),
      db.orgMember.upsert({
        where: { orgId_userId: { orgId: orgs[2].id, userId: users[6].id } },
        update: {},
        create: {
          orgId: orgs[2].id,
          userId: users[6].id,
          role: "OWNER",
          shopIds: [],
        },
      }),
    ]);

    log(colors.green, "✓", "Created organization members");

    // ─────────────────────────────────────────────────────────
    // 5. Create Locations (Warehouses/Stores)
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Locations...");

    const locations = await Promise.all([
      db.location.upsert({
        where: { id: "loc-acme-main" },
        update: {},
        create: {
          id: "loc-acme-main",
          orgId: orgs[0].id,
          name: "Acme Main Warehouse",
          type: "WAREHOUSE",
          addressLine1: "123 Logistics Way",
          city: "New York",
          province: "NY",
          postalCode: "10001",
          country: "US",
          coordinates: { lat: 40.7128, lng: -74.006 },
          phone: "+1-212-555-0100",
          email: "warehouse@acme-logistics.com",
          isDefault: true,
          isActive: true,
          operatingHours: {
            monday: { open: "06:00", close: "22:00" },
            tuesday: { open: "06:00", close: "22:00" },
            wednesday: { open: "06:00", close: "22:00" },
            thursday: { open: "06:00", close: "22:00" },
            friday: { open: "06:00", close: "22:00" },
            saturday: { open: "08:00", close: "20:00" },
            sunday: { open: "08:00", close: "18:00" },
          },
          prepTimeMinutes: 30,
          metadata: { capacity: "high", serviceLevel: "premium" },
        },
      }),
      db.location.upsert({
        where: { id: "loc-metro-hub" },
        update: {},
        create: {
          id: "loc-metro-hub",
          orgId: orgs[1].id,
          name: "Metro Central Hub",
          type: "HUB",
          addressLine1: "456 Distribution Ave",
          city: "Chicago",
          province: "IL",
          postalCode: "60601",
          country: "US",
          coordinates: { lat: 41.8781, lng: -87.6298 },
          phone: "+1-312-555-0200",
          email: "hub@metro-delivery.com",
          isDefault: true,
          isActive: true,
          operatingHours: {
            monday: { open: "05:00", close: "23:00" },
            tuesday: { open: "05:00", close: "23:00" },
            wednesday: { open: "05:00", close: "23:00" },
            thursday: { open: "05:00", close: "23:00" },
            friday: { open: "05:00", close: "23:00" },
            saturday: { open: "06:00", close: "22:00" },
            sunday: { open: "06:00", close: "20:00" },
          },
          prepTimeMinutes: 20,
          metadata: { capacity: "ultra-high", serviceLevel: "express" },
        },
      }),
      db.location.upsert({
        where: { id: "loc-fastship-depot" },
        update: {},
        create: {
          id: "loc-fastship-depot",
          orgId: orgs[2].id,
          name: "FastShip West Depot",
          type: "DEPOT",
          addressLine1: "789 Speed Boulevard",
          city: "San Francisco",
          province: "CA",
          postalCode: "94102",
          country: "US",
          coordinates: { lat: 37.7749, lng: -122.4194 },
          phone: "+1-415-555-0300",
          email: "depot@fastship.com",
          isDefault: true,
          isActive: true,
          operatingHours: {
            monday: { open: "06:00", close: "22:00" },
            tuesday: { open: "06:00", close: "22:00" },
            wednesday: { open: "06:00", close: "22:00" },
            thursday: { open: "06:00", close: "22:00" },
            friday: { open: "06:00", close: "22:00" },
            saturday: { open: "08:00", close: "20:00" },
            sunday: null,
          },
          prepTimeMinutes: 15,
          metadata: { capacity: "high", serviceLevel: "same-day" },
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${locations.length} locations`);

    // ─────────────────────────────────────────────────────────
    // 6. Create Delivery Zones with PostGIS-style polygons
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Delivery Zones...");

    const zones = await Promise.all([
      db.deliveryZone.upsert({
        where: { id: "zone-acme-manhattan" },
        update: {},
        create: {
          id: "zone-acme-manhattan",
          orgId: orgs[0].id,
          name: "Manhattan Zone",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-74.02, 40.7],
                [-73.93, 40.7],
                [-73.93, 40.78],
                [-74.02, 40.78],
                [-74.02, 40.7],
              ],
            ],
          },
          baseRate: 5.0,
          perKmRate: 1.5,
          minOrder: 20.0,
          freeAbove: 100.0,
          isActive: true,
          priority: 1,
          metadata: { coverage: "dense", avgDeliveryTime: 45 },
        },
      }),
      db.deliveryZone.upsert({
        where: { id: "zone-acme-brooklyn" },
        update: {},
        create: {
          id: "zone-acme-brooklyn",
          orgId: orgs[0].id,
          name: "Brooklyn Zone",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-73.95, 40.58],
                [-73.87, 40.58],
                [-73.87, 40.68],
                [-73.95, 40.68],
                [-73.95, 40.58],
              ],
            ],
          },
          baseRate: 4.0,
          perKmRate: 1.2,
          minOrder: 15.0,
          freeAbove: 80.0,
          isActive: true,
          priority: 2,
          metadata: { coverage: "moderate", avgDeliveryTime: 55 },
        },
      }),
      db.deliveryZone.upsert({
        where: { id: "zone-metro-downtown" },
        update: {},
        create: {
          id: "zone-metro-downtown",
          orgId: orgs[1].id,
          name: "Chicago Downtown",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-87.64, 41.87],
                [-87.62, 41.87],
                [-87.62, 41.89],
                [-87.64, 41.89],
                [-87.64, 41.87],
              ],
            ],
          },
          baseRate: 3.5,
          perKmRate: 1.0,
          minOrder: 10.0,
          freeAbove: 75.0,
          isActive: true,
          priority: 1,
          metadata: { coverage: "ultra-dense", avgDeliveryTime: 30 },
        },
      }),
      db.deliveryZone.upsert({
        where: { id: "zone-fastship-sf" },
        update: {},
        create: {
          id: "zone-fastship-sf",
          orgId: orgs[2].id,
          name: "San Francisco Bay",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-122.51, 37.7],
                [-122.36, 37.7],
                [-122.36, 37.84],
                [-122.51, 37.84],
                [-122.51, 37.7],
              ],
            ],
          },
          baseRate: 6.0,
          perKmRate: 2.0,
          minOrder: 25.0,
          freeAbove: 120.0,
          isActive: true,
          priority: 1,
          metadata: { coverage: "sparse", avgDeliveryTime: 60 },
        },
      }),
      db.deliveryZone.upsert({
        where: { id: "zone-fastship-peninsula" },
        update: {},
        create: {
          id: "zone-fastship-peninsula",
          orgId: orgs[2].id,
          name: "Silicon Valley",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-122.15, 37.25],
                [-122.0, 37.25],
                [-122.0, 37.5],
                [-122.15, 37.5],
                [-122.15, 37.25],
              ],
            ],
          },
          baseRate: 5.5,
          perKmRate: 1.8,
          minOrder: 22.0,
          freeAbove: 110.0,
          isActive: true,
          priority: 2,
          metadata: { coverage: "moderate", avgDeliveryTime: 70 },
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${zones.length} delivery zones`);

    // ─────────────────────────────────────────────────────────
    // 7. Create Time Slots for each shop
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Time Slots...");

    const timeSlots = await Promise.all([
      db.timeSlot.upsert({
        where: { id: "slot-acme-morning" },
        update: {},
        create: {
          id: "slot-acme-morning",
          shopId: shops[0].id,
          deliveryZoneId: zones[0].id,
          name: "Morning (6AM-12PM)",
          startTime: "06:00",
          endTime: "12:00",
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          maxCapacity: 40,
          cutoffMinutes: 180,
          surcharge: 0,
          isActive: true,
        },
      }),
      db.timeSlot.upsert({
        where: { id: "slot-acme-afternoon" },
        update: {},
        create: {
          id: "slot-acme-afternoon",
          shopId: shops[0].id,
          deliveryZoneId: zones[1].id,
          name: "Afternoon (12PM-6PM)",
          startTime: "12:00",
          endTime: "18:00",
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          maxCapacity: 50,
          cutoffMinutes: 120,
          surcharge: 0,
          isActive: true,
        },
      }),
      db.timeSlot.upsert({
        where: { id: "slot-metro-morning" },
        update: {},
        create: {
          id: "slot-metro-morning",
          shopId: shops[1].id,
          deliveryZoneId: zones[2].id,
          name: "Express Morning",
          startTime: "05:00",
          endTime: "11:00",
          daysOfWeek: [1, 2, 3, 4, 5],
          maxCapacity: 60,
          cutoffMinutes: 240,
          surcharge: 5.0,
          isActive: true,
        },
      }),
      db.timeSlot.upsert({
        where: { id: "slot-fastship-sameday" },
        update: {},
        create: {
          id: "slot-fastship-sameday",
          shopId: shops[2].id,
          deliveryZoneId: zones[3].id,
          name: "Same-Day Express",
          startTime: "08:00",
          endTime: "20:00",
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          maxCapacity: 35,
          cutoffMinutes: 60,
          surcharge: 15.0,
          isActive: true,
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${timeSlots.length} time slots`);

    // ─────────────────────────────────────────────────────────
    // 8. Create Drivers (20 total, distributed across orgs)
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Drivers...");

    const driverNames = [
      "John Smith",
      "Maria Garcia",
      "James Wilson",
      "Sarah Johnson",
      "Michael Brown",
      "Jessica Davis",
      "Robert Martinez",
      "Emily Taylor",
      "David Anderson",
      "Lisa White",
      "Christopher Lee",
      "Amanda Harris",
      "Daniel Clark",
      "Rachel Lewis",
      "Joseph Walker",
      "Jennifer Hall",
      "Matthew Young",
      "Lauren King",
      "Andrew Wright",
      "Michelle Scott",
    ];

    const vehicleTypes = ["CAR", "VAN", "TRUCK", "MOTORCYCLE", "BICYCLE"];

    const drivers = await Promise.all(
      driverNames.map((name, i) => {
        const orgIndex = i % 3;
        return db.driver.upsert({
          where: {
            orgId_phone: {
              orgId: orgs[orgIndex].id,
              phone: `+1-555-000${String(i).padStart(4, "0")}`,
            },
          },
          update: {},
          create: {
            orgId: orgs[orgIndex].id,
            name,
            email: `${name.toLowerCase().replace(/\s+/g, ".")}@drivers.local`,
            phone: `+1-555-000${String(i).padStart(4, "0")}`,
            vehicleType: vehicleTypes[i % vehicleTypes.length],
            vehiclePlate: `DRV${String(i + 1).padStart(5, "0")}`,
            maxCapacity: 20 + Math.floor(Math.random() * 20),
            maxWeight: Math.floor(500 + Math.random() * 1000) / 10,
            status: ["OFFLINE", "AVAILABLE", "ON_ROUTE"][
              Math.floor(Math.random() * 3)
            ],
            isActive: true,
            currentLocation: {
              lat: 40.7128 + (Math.random() - 0.5) * 0.5,
              lng: -74.006 + (Math.random() - 0.5) * 0.5,
            },
            password: hashPassword("driver123456"),
          },
        });
      }),
    );

    log(colors.green, "✓", `Created ${drivers.length} drivers`);

    // ─────────────────────────────────────────────────────────
    // 9. Create Orders (50 total, distributed across shops)
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Orders...");

    const orderStatuses = [
      "PENDING",
      "ACCEPTED",
      "ASSIGNED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ];
    const orderCustomers = [
      { name: "Acme Corp", email: "orders@acme.com", phone: "+1-212-555-1000" },
      {
        name: "Metro LLC",
        email: "orders@metro.com",
        phone: "+1-312-555-1000",
      },
      {
        name: "Tech Startup",
        email: "orders@tech.com",
        phone: "+1-415-555-1000",
      },
      {
        name: "Fashion House",
        email: "orders@fashion.com",
        phone: "+1-212-555-2000",
      },
      {
        name: "Food Court",
        email: "orders@food.com",
        phone: "+1-312-555-2000",
      },
    ];

    const orders = await Promise.all(
      Array.from({ length: 50 }, (_, i) => {
        const shopIndex = i % 3;
        const customer = orderCustomers[i % orderCustomers.length];
        const status =
          orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
        const driver =
          status !== "PENDING" && status !== "CANCELLED"
            ? drivers[Math.floor(Math.random() * drivers.length)]
            : null;

        return db.order.upsert({
          where: {
            shopId_externalOrderId_source: {
              shopId: shops[shopIndex].id,
              externalOrderId: `ext-order-${i + 1}`,
              source: "SHOPIFY",
            },
          },
          update: {},
          create: {
            shopId: shops[shopIndex].id,
            externalOrderId: `ext-order-${i + 1}`,
            externalOrderNumber: `#${1000 + i}`,
            source: "SHOPIFY",
            status,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            addressLine1: `${100 + i} Main Street`,
            city: ["New York", "Chicago", "San Francisco"][shopIndex],
            province: ["NY", "IL", "CA"][shopIndex],
            postalCode: `${10000 + i}`,
            country: "US",
            deliveryLocation: {
              lat:
                [40.7128, 41.8781, 37.7749][shopIndex] +
                (Math.random() - 0.5) * 0.2,
              lng:
                [-74.006, -87.6298, -122.4194][shopIndex] +
                (Math.random() - 0.5) * 0.2,
            },
            deliveryDate: new Date(Date.now() + (i % 7) * 24 * 60 * 60 * 1000),
            timeSlotId: timeSlots[shopIndex].id,
            driverId: driver?.id || null,
            totalPrice: 50 + Math.random() * 200,
            totalWeight: 1 + Math.random() * 20,
            itemCount: 1 + Math.floor(Math.random() * 5),
            lineItems: [
              {
                productId: `prod-${i}`,
                title: `Product ${i + 1}`,
                quantity: 1 + Math.floor(Math.random() * 3),
                price: 25 + Math.random() * 100,
              },
            ],
            trackingToken: `TRK${String(i + 1).padStart(8, "0")}`,
            tags: ["demo", status.toLowerCase()],
            notes: `Demo order for testing. Status: ${status}`,
            metadata: { source: "demo_seed", testData: true },
          },
        });
      }),
    );

    log(colors.green, "✓", `Created ${orders.length} orders`);

    // ─────────────────────────────────────────────────────────
    // 10. Create Shipments (30 linked to orders)
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Shipments...");

    const shipmentStatuses = [
      "PENDING",
      "PROCESSING",
      "PICKED_UP",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ];

    const shipments = await Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        const order = orders[i % orders.length];
        const status =
          shipmentStatuses[Math.floor(Math.random() * shipmentStatuses.length)];
        const driver =
          status !== "PENDING" && status !== "CANCELLED"
            ? drivers[Math.floor(Math.random() * drivers.length)]
            : null;

        return db.shipment.upsert({
          where: {
            shopId_shipmentNumber: {
              shopId: order.shopId,
              shipmentNumber: `SHP-${String(i + 1).padStart(5, "0")}`,
            },
          },
          update: {},
          create: {
            shopId: order.shopId,
            orderId: order.id,
            locationId: locations[i % locations.length].id,
            driverId: driver?.id || null,
            shipmentNumber: `SHP-${String(i + 1).padStart(5, "0")}`,
            trackingNumber: `TRACK${String(i + 1).padStart(8, "0")}`,
            status,
            deliveryMethod: ["LOCAL_DELIVERY", "SAME_DAY", "STANDARD_SHIPPING"][
              i % 3
            ],
            recipientName: order.customerName,
            recipientPhone: order.customerPhone,
            recipientEmail: order.customerEmail,
            addressLine1: order.addressLine1,
            city: order.city,
            province: order.province,
            postalCode: order.postalCode,
            country: order.country,
            deliveryLocation: order.deliveryLocation,
            deliveryDate: order.deliveryDate,
            timeSlotId: order.timeSlotId,
            weight: 0.5 + Math.random() * 10,
            dimensions: {
              length: 10 + Math.floor(Math.random() * 30),
              width: 10 + Math.floor(Math.random() * 30),
              height: 5 + Math.floor(Math.random() * 20),
              unit: "cm",
            },
            itemCount: 1 + Math.floor(Math.random() * 3),
            lineItems: [
              {
                sku: `SKU-${i}`,
                title: `Item ${i + 1}`,
                quantity: 1,
              },
            ],
            shippingCost: 5.0 + Math.random() * 20,
            codAmount: null,
            insuranceAmount: 2.5,
            carrier: ["DHL", "FedEx", "UPS", "Local"][i % 4],
            tags: ["demo", status.toLowerCase()],
            notes: `Demo shipment for order ${order.externalOrderNumber}`,
            metadata: { demo: true, testData: true },
          },
        });
      }),
    );

    log(colors.green, "✓", `Created ${shipments.length} shipments`);

    // ─────────────────────────────────────────────────────────
    // 11. Create Notification Templates
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Notification Templates...");

    const notificationTemplates = await Promise.all([
      db.notificationTemplate.upsert({
        where: {
          shopId_channel_eventType_language: {
            shopId: shops[0].id,
            channel: "EMAIL",
            eventType: "order.confirmed",
            language: "en",
          },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          channel: "EMAIL",
          eventType: "order.confirmed",
          name: "Order Confirmation",
          subject: "Your order {{order.number}} has been confirmed",
          body: "Thank you for your order. Your order #{{order.number}} has been confirmed and will be delivered soon.",
          variables: [
            {
              key: "order.number",
              description: "Order number",
              example: "#1001",
            },
            {
              key: "customer.name",
              description: "Customer name",
              example: "John Doe",
            },
          ],
          language: "en",
          version: 1,
          isActive: true,
          isDefault: true,
        },
      }),
      db.notificationTemplate.upsert({
        where: {
          shopId_channel_eventType_language: {
            shopId: shops[0].id,
            channel: "SMS",
            eventType: "delivery.assigned",
            language: "en",
          },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          channel: "SMS",
          eventType: "delivery.assigned",
          name: "Delivery Assigned",
          body: "Your order {{order.number}} has been assigned to driver {{driver.name}}. Track it here: {{tracking.url}}",
          variables: [
            {
              key: "order.number",
              description: "Order number",
              example: "#1001",
            },
            {
              key: "driver.name",
              description: "Driver name",
              example: "John Smith",
            },
            {
              key: "tracking.url",
              description: "Tracking URL",
              example: "https://track.example.com/123",
            },
          ],
          language: "en",
          version: 1,
          isActive: true,
          isDefault: true,
        },
      }),
      db.notificationTemplate.upsert({
        where: {
          shopId_channel_eventType_language: {
            shopId: shops[0].id,
            channel: "PUSH",
            eventType: "delivery.out_for_delivery",
            language: "en",
          },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          channel: "PUSH",
          eventType: "delivery.out_for_delivery",
          name: "Out for Delivery",
          subject: "On the way!",
          body: "Your order {{order.number}} is out for delivery. Driver {{driver.name}} will arrive soon.",
          variables: [
            {
              key: "order.number",
              description: "Order number",
              example: "#1001",
            },
            {
              key: "driver.name",
              description: "Driver name",
              example: "John Smith",
            },
          ],
          language: "en",
          version: 1,
          isActive: true,
          isDefault: true,
        },
      }),
      db.notificationTemplate.upsert({
        where: {
          shopId_channel_eventType_language: {
            shopId: shops[0].id,
            channel: "EMAIL",
            eventType: "delivery.delivered",
            language: "en",
          },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          channel: "EMAIL",
          eventType: "delivery.delivered",
          name: "Delivery Complete",
          subject: "Your order {{order.number}} has been delivered",
          body: "Great news! Your order {{order.number}} has been successfully delivered at {{delivery.time}}.",
          variables: [
            {
              key: "order.number",
              description: "Order number",
              example: "#1001",
            },
            {
              key: "delivery.time",
              description: "Delivery time",
              example: "2024-03-10 14:30",
            },
          ],
          language: "en",
          version: 1,
          isActive: true,
          isDefault: true,
        },
      }),
    ]);

    log(
      colors.green,
      "✓",
      `Created ${notificationTemplates.length} notification templates`,
    );

    // ─────────────────────────────────────────────────────────
    // 12. Create Webhook Subscriptions
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Webhook Subscriptions...");

    const webhooks = await Promise.all([
      db.webhookSubscription.upsert({
        where: {
          shopId_topic: { shopId: shops[0].id, topic: "orders/create" },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          topic: "orders/create",
          callbackUrl: "https://app.example.com/webhooks/orders/create",
          isActive: true,
        },
      }),
      db.webhookSubscription.upsert({
        where: {
          shopId_topic: { shopId: shops[0].id, topic: "orders/updated" },
        },
        update: {},
        create: {
          shopId: shops[0].id,
          topic: "orders/updated",
          callbackUrl: "https://app.example.com/webhooks/orders/updated",
          isActive: true,
        },
      }),
      db.webhookSubscription.upsert({
        where: {
          shopId_topic: { shopId: shops[1].id, topic: "orders/create" },
        },
        update: {},
        create: {
          shopId: shops[1].id,
          topic: "orders/create",
          callbackUrl: "https://app.example.com/webhooks/orders/create",
          isActive: true,
        },
      }),
      db.webhookSubscription.upsert({
        where: {
          shopId_topic: { shopId: shops[2].id, topic: "orders/create" },
        },
        update: {},
        create: {
          shopId: shops[2].id,
          topic: "orders/create",
          callbackUrl: "https://app.example.com/webhooks/orders/create",
          isActive: true,
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${webhooks.length} webhook subscriptions`);

    // ─────────────────────────────────────────────────────────
    // 13. Create Billing Plans
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Billing Plans...");

    const billingPlans = await Promise.all([
      db.billingPlan.upsert({
        where: { slug: "free" },
        update: {},
        create: {
          name: "Free",
          slug: "free",
          price: 0,
          interval: "monthly",
          features: {
            orders: true,
            shipments: true,
            basicReports: true,
            emailSupport: false,
            apiAccess: false,
          },
          limits: {
            orders: 100,
            shipments: 100,
            drivers: 5,
            storage_gb: 5,
          },
          trialDays: 14,
          isActive: true,
          sortOrder: 1,
        },
      }),
      db.billingPlan.upsert({
        where: { slug: "pro" },
        update: {},
        create: {
          name: "Pro",
          slug: "pro",
          price: 99.0,
          interval: "monthly",
          features: {
            orders: true,
            shipments: true,
            basicReports: true,
            advancedReports: true,
            emailSupport: true,
            apiAccess: true,
            customNotifications: true,
          },
          limits: {
            orders: 5000,
            shipments: 5000,
            drivers: 50,
            storage_gb: 100,
            apiCalls: 100000,
          },
          trialDays: 30,
          isActive: true,
          sortOrder: 2,
        },
      }),
      db.billingPlan.upsert({
        where: { slug: "enterprise" },
        update: {},
        create: {
          name: "Enterprise",
          slug: "enterprise",
          price: 499.0,
          interval: "monthly",
          features: {
            orders: true,
            shipments: true,
            basicReports: true,
            advancedReports: true,
            emailSupport: true,
            phoneSupport: true,
            apiAccess: true,
            customNotifications: true,
            dedicatedManager: true,
            sso: true,
          },
          limits: {
            orders: 999999,
            shipments: 999999,
            drivers: 999999,
            storage_gb: 1000,
            apiCalls: 10000000,
          },
          trialDays: 60,
          isActive: true,
          sortOrder: 3,
        },
      }),
    ]);

    log(colors.green, "✓", `Created ${billingPlans.length} billing plans`);

    // ─────────────────────────────────────────────────────────
    // 14. Create Billing Subscriptions for shops
    // ─────────────────────────────────────────────────────────
    log(colors.blue, "○", "Seeding Billing Subscriptions...");

    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscriptions = await Promise.all([
      db.billingSubscription.upsert({
        where: { shopId: shops[0].id },
        update: {},
        create: {
          shopId: shops[0].id,
          planId: billingPlans[1].id,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: oneMonthLater,
          trialEnd: null,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
      }),
      db.billingSubscription.upsert({
        where: { shopId: shops[1].id },
        update: {},
        create: {
          shopId: shops[1].id,
          planId: billingPlans[1].id,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: oneMonthLater,
          trialEnd: null,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
      }),
      db.billingSubscription.upsert({
        where: { shopId: shops[2].id },
        update: {},
        create: {
          shopId: shops[2].id,
          planId: billingPlans[2].id,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: oneMonthLater,
          trialEnd: null,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
      }),
    ]);

    log(
      colors.green,
      "✓",
      `Created ${subscriptions.length} billing subscriptions`,
    );

    // ─────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────
    log(colors.cyan, "▶", "\nSeed Complete! Summary:");
    console.log(
      `${colors.green}✓${colors.reset} Organizations: ${orgs.length}`,
    );
    console.log(`${colors.green}✓${colors.reset} Shops: ${shops.length}`);
    console.log(`${colors.green}✓${colors.reset} Users: ${users.length}`);
    console.log(
      `${colors.green}✓${colors.reset} Locations: ${locations.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Delivery Zones: ${zones.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Time Slots: ${timeSlots.length}`,
    );
    console.log(`${colors.green}✓${colors.reset} Drivers: ${drivers.length}`);
    console.log(`${colors.green}✓${colors.reset} Orders: ${orders.length}`);
    console.log(
      `${colors.green}✓${colors.reset} Shipments: ${shipments.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Notification Templates: ${notificationTemplates.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Webhook Subscriptions: ${webhooks.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Billing Plans: ${billingPlans.length}`,
    );
    console.log(
      `${colors.green}✓${colors.reset} Billing Subscriptions: ${subscriptions.length}`,
    );
    console.log(
      `\n${colors.cyan}✓ Database seeded successfully!${colors.reset}\n`,
    );
  } catch (error) {
    log(colors.yellow, "✗", `Seed failed: ${error}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
