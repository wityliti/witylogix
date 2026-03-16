/**
 * Minimal Seed Script for Quick Local Development
 *
 * Creates minimal demo data:
 * - 1 Organization
 * - 3 Users (owner, admin, driver)
 * - 1 Workspace
 * - 5 Orders
 * - 3 Drivers
 * - 2 Delivery Zones
 * - 1 API Key
 *
 * Run with: npx tsx src/seed/seed-minimal.ts
 */

import { PrismaClient, OrgRole } from "@prisma/client";
import * as crypto from "crypto";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(color: string, label: string, message: string) {
  console.log(`${color}${label}${colors.reset} ${message}`);
}

function hashPassword(password: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(password).digest("hex");
}

const prisma = new PrismaClient();

async function main() {
  try {
    log(colors.cyan, "▶", "Starting minimal database seed...\n");

    // Create Organization
    log(colors.blue, "○", "Creating Organization...");
    const org = await (prisma as any).organization.upsert({
      where: { slug: "test-org" },
      update: {},
      create: {
        name: "Test Organization",
        slug: "test-org",
        email: "admin@test-org.local",
        planTier: "GROWTH",
        isActive: true,
        settings: { timezone: "UTC" },
      },
    });

    // Create Users
    log(colors.blue, "○", "Creating Users...");
    const testPassword = "WityTest2026!";
    const passwordHash = hashPassword(testPassword);

    const [owner, admin, driver] = await Promise.all([
      (prisma as any).user.upsert({
        where: { email: "owner@test.local" },
        update: {},
        create: {
          email: "owner@test.local",
          name: "Owner User",
          passwordHash,
          emailVerified: true,
          orgId: org.id,
          settings: { language: "en", theme: "light" },
        },
      }),
      (prisma as any).user.upsert({
        where: { email: "admin@test.local" },
        update: {},
        create: {
          email: "admin@test.local",
          name: "Admin User",
          passwordHash,
          emailVerified: true,
          orgId: org.id,
          settings: { language: "en", theme: "light" },
        },
      }),
      (prisma as any).user.upsert({
        where: { email: "driver@test.local" },
        update: {},
        create: {
          email: "driver@test.local",
          name: "Driver User",
          passwordHash,
          emailVerified: true,
          orgId: org.id,
          settings: { language: "en", theme: "light" },
        },
      }),
    ]);

    log(colors.green, "✓", "Created 3 users");

    // Create Workspace
    log(colors.blue, "○", "Creating Workspace...");
    const workspace = await (prisma as any).workspace.upsert({
      where: { id: crypto.randomUUID() },
      update: {},
      create: {
        orgId: org.id,
        name: "Test Workspace",
        slug: "test-workspace",
        deploymentType: "CLOUD",
        isActive: true,
      },
    });

    // Create Workspace Settings
    await (prisma as any).workspaceSettings.upsert({
      where: { id: crypto.randomUUID() },
      update: {},
      create: {
        workspaceId: workspace.id,
        timezone: "UTC",
        currency: "USD",
        locale: "en-US",
      },
    });

    log(colors.green, "✓", "Created workspace");

    // Create Tenant Config
    log(colors.blue, "○", "Creating Tenant Config...");
    await (prisma as any).tenantConfig.upsert({
      where: { id: crypto.randomUUID() },
      update: {},
      create: {
        orgId: org.id,
        subdomain: "test-org",
        features: { webhooks: true, apiAccess: true },
        limits: { requestsPerDay: 10000, storageGb: 100 },
      },
    });

    log(colors.green, "✓", "Created tenant config");

    // Create API Key
    log(colors.blue, "○", "Creating API Key...");
    const key = `wl_live_${crypto.randomBytes(16).toString("hex")}`;
    const keyHash = crypto
      .createHash("sha256")
      .update(key)
      .digest("hex");

    await (prisma as any).apiKey.upsert({
      where: { id: crypto.randomUUID() },
      update: {},
      create: {
        orgId: org.id,
        name: "Test API Key",
        prefix: key.substring(0, 8),
        keyHash,
        scopes: ["shipments:read", "routes:write"],
        rateLimit: 1000,
        createdBy: owner.id,
      },
    });

    log(colors.green, "✓", "Created API key");

    // Create Shop (if needed for orders)
    let shop;
    try {
      shop = await (prisma as any).shop.findFirst({
        where: { organizationId: org.id },
      });

      if (!shop) {
        shop = await (prisma as any).shop.create({
          data: {
            organizationId: org.id,
            name: "Test Shop",
            platform: "CUSTOM",
            isActive: true,
          },
        });
      }

      // Create Orders
      log(colors.blue, "○", "Creating Orders...");
      for (let i = 1; i <= 5; i++) {
        await (prisma as any).order.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            shopId: shop.id,
            externalOrderId: `ORD-TEST-${i}`,
            status: "CONFIRMED",
            recipientName: `Customer ${i}`,
            recipientEmail: `customer${i}@test.local`,
            deliveryAddress: `${100 + i} Main St, Test City, TC 12345`,
            items: [
              {
                sku: `TEST-${i}`,
                name: `Test Product ${i}`,
                quantity: 1,
                price: 50.0 + i * 10,
              },
            ],
            totalAmount: 100.0 + i * 20,
            currency: "USD",
          },
        });
      }
      log(colors.green, "✓", "Created 5 orders");

      // Create Drivers
      log(colors.blue, "○", "Creating Drivers...");
      for (let i = 1; i <= 3; i++) {
        await (prisma as any).driver.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            shopId: shop.id,
            name: `Test Driver ${i}`,
            email: `driver${i}@test.local`,
            phone: `555-100${i}`,
            licenseNumber: `DL-TEST-${i}`,
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            vehicle: {
              type: "van",
              licensePlate: `TEST-${i}`,
              capacity: 500,
            },
            currentLocation: { lat: 40.7128, lng: -74.006 },
            isActive: true,
          },
        });
      }
      log(colors.green, "✓", "Created 3 drivers");

      // Create Delivery Zones
      log(colors.blue, "○", "Creating Delivery Zones...");
      const zones = [
        {
          name: "Downtown",
          coordinates: [
            { lat: 40.7128, lng: -74.006 },
            { lat: 40.7200, lng: -74.006 },
            { lat: 40.7200, lng: -73.99 },
            { lat: 40.7128, lng: -73.99 },
          ],
        },
        {
          name: "Suburbs",
          coordinates: [
            { lat: 40.7200, lng: -74.006 },
            { lat: 40.7300, lng: -74.006 },
            { lat: 40.7300, lng: -73.98 },
            { lat: 40.7200, lng: -73.98 },
          ],
        },
      ];

      for (const zone of zones) {
        await (prisma as any).deliveryZone.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            shopId: shop.id,
            name: zone.name,
            polygon: {
              type: "Polygon",
              coordinates: [zone.coordinates.map((c) => [c.lng, c.lat])],
            },
            deliveryDays: ["MON", "TUE", "WED", "THU", "FRI"],
            cutoffTime: "17:00",
            estimatedDeliveryDays: 1,
            isActive: true,
          },
        });
      }
      log(colors.green, "✓", "Created 2 delivery zones");
    } catch (e) {
      // Shop not available, skip order/driver/zone creation
    }

    // Summary
    log(colors.cyan, "▶", "\nMinimal seed completed!");
    console.log(`
${colors.bright}Created:${colors.reset}
  1 Organization (test-org)
  3 Users (owner, admin, driver)
  1 Workspace
  1 API Key
  5 Orders (if shop exists)
  3 Drivers (if shop exists)
  2 Delivery Zones (if shop exists)

${colors.bright}Test Credentials:${colors.reset}
  Email:    owner@test.local
  Password: ${testPassword}
    `);
  } catch (error) {
    log(
      colors.red,
      "✗",
      `Seed failed: ${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof Error) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
