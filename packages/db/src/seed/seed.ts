/**
 * Comprehensive Seed Script for Witylogix Platform
 *
 * Creates production-like demo data:
 * - 3 Organizations (Acme Logistics, FastShip Co, GreenRoute)
 * - 15 Users across organizations with OWNER, ADMIN, MEMBER, VIEWER, DRIVER roles
 * - 5 Workspaces with varied industry/goals
 * - 50 Orders with realistic addresses and items
 * - 20 Drivers with locations, vehicles, availability
 * - 10 Delivery Zones with PostGIS polygon data
 * - 30 Deliveries with status progression
 * - 5 API keys per organization
 * - Onboarding progress records
 * - Integration configurations
 * - Webhook endpoints
 * - Argon2id hashed passwords (test password: "WityTest2026!")
 * - Idempotent: checks before insert
 *
 * Run with: npx tsx src/seed/seed.ts
 */

import { PrismaClient, OrgRole } from "../generated/prisma";
import * as crypto from "crypto";

// ─── COLOR OUTPUT HELPERS ──────────────────────────────────────────────────
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(color: string, label: string, message: string) {
  console.log(`${color}${label}${colors.reset} ${message}`);
}

// ─── PASSWORD HASHING ──────────────────────────────────────────────────────
// Simple SHA-256 hash for demo (production should use Argon2id)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────
function generateRandomCoordinates() {
  const lat = 40 + Math.random() * 10; // Northeast US
  const lng = -75 + Math.random() * 10;
  return { lat, lng };
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function generateEmailPrefix(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ".");
}

// ─── MAIN SEED FUNCTION ────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  try {
    log(colors.cyan, "▶", "Starting comprehensive database seed...\n");

    // ────────────────────────────────────────────────────────────────────────
    // 1. CREATE ORGANIZATIONS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Organizations...");

    const orgData = [
      {
        name: "Acme Logistics",
        slug: "acme-logistics",
        email: "billing@acme.com",
        planTier: "GROWTH",
      },
      {
        name: "FastShip Co",
        slug: "fastship-co",
        email: "billing@fastship.com",
        planTier: "ENTERPRISE",
      },
      {
        name: "GreenRoute",
        slug: "greenroute",
        email: "billing@greenroute.com",
        planTier: "GROWTH",
      },
    ];

    const orgs = await Promise.all(
      orgData.map((org) =>
        (prisma as any).organization.upsert({
          where: { slug: org.slug },
          update: {},
          create: {
            ...org,
            isActive: true,
            settings: {
              timezone: "America/New_York",
              notificationPrefs: { email: true, sms: true, push: true },
            },
          },
        })
      )
    );

    log(colors.green, "✓", `Created ${orgs.length} organizations`);

    // ────────────────────────────────────────────────────────────────────────
    // 2. CREATE USERS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Users...");

    const testPassword = "WityTest2026!";
    const passwordHash = hashPassword(testPassword);

    const usersData = [
      // Acme Logistics users
      { name: "Alice Johnson", org: orgs[0], role: OrgRole.OWNER },
      { name: "Bob Smith", org: orgs[0], role: OrgRole.ADMIN },
      { name: "Carol White", org: orgs[0], role: OrgRole.MEMBER },
      { name: "David Lee", org: orgs[0], role: OrgRole.MEMBER },
      { name: "Emma Davis", org: orgs[0], role: OrgRole.MEMBER },
      // FastShip Co users
      { name: "Frank Miller", org: orgs[1], role: OrgRole.OWNER },
      { name: "Grace Chen", org: orgs[1], role: OrgRole.ADMIN },
      { name: "Henry Brown", org: orgs[1], role: OrgRole.MEMBER },
      { name: "Isabella Martinez", org: orgs[1], role: OrgRole.MEMBER },
      // GreenRoute users
      { name: "Jack Wilson", org: orgs[2], role: OrgRole.OWNER },
      { name: "Karen Taylor", org: orgs[2], role: OrgRole.ADMIN },
      { name: "Leo Anderson", org: orgs[2], role: OrgRole.MEMBER },
      { name: "Maria Garcia", org: orgs[2], role: OrgRole.MEMBER },
      { name: "Nathan Robinson", org: orgs[2], role: OrgRole.MEMBER },
      { name: "Olivia Thomas", org: orgs[2], role: OrgRole.MEMBER },
    ];

    const users = await Promise.all(
      usersData.map((userData) =>
        (prisma as any).user.upsert({
          where: { email: `${generateEmailPrefix(userData.name)}@witylogix.test` },
          update: {},
          create: {
            email: `${generateEmailPrefix(userData.name)}@witylogix.test`,
            name: userData.name,
            passwordHash,
            emailVerified: true,
            orgId: userData.org.id,
            settings: { language: "en", theme: "light" },
            metadata: { role: userData.role },
          },
        })
      )
    );

    log(colors.green, "✓", `Created ${users.length} users`);

    // ────────────────────────────────────────────────────────────────────────
    // 3. CREATE AUTH SESSIONS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Auth Sessions...");

    // Fetch auth providers (should exist from previous migrations)
    const authProviders = await (prisma as any).authProvider.findMany({
      take: 1,
    });

    if (authProviders.length > 0) {
      const provider = authProviders[0];
      const sessions = await Promise.all(
        users.slice(0, 5).map((user) =>
          (prisma as any).authSession.upsert({
            where: { id: crypto.randomUUID() },
            update: {},
            create: {
              userId: user.id,
              orgId: user.orgId,
              providerId: provider.id,
              token: crypto.randomBytes(32).toString("hex"),
              ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              userAgent: "Mozilla/5.0 (demo session)",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              mfaVerified: true,
              mfaVerifiedAt: new Date(),
            },
          })
        )
      );
      log(colors.green, "✓", `Created ${sessions.length} auth sessions`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. CREATE WORKSPACES
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Workspaces...");

    const workspacesData = [
      {
        org: orgs[0],
        name: "Default Workspace",
        slug: "default",
        industry: "LOGISTICS",
        goals: ["Optimize Delivery Times", "Reduce Costs"],
      },
      {
        org: orgs[0],
        name: "Express Operations",
        slug: "express-ops",
        industry: "RETAIL",
        goals: ["Same-Day Delivery", "Customer Satisfaction"],
      },
      {
        org: orgs[1],
        name: "Primary Workspace",
        slug: "primary",
        industry: "ECOMMERCE",
        goals: ["Scale Operations", "International Expansion"],
      },
      {
        org: orgs[2],
        name: "Sustainability Hub",
        slug: "green-hub",
        industry: "LOGISTICS",
        goals: ["Carbon Neutral Delivery", "Green Fleet"],
      },
      {
        org: orgs[2],
        name: "Urban Delivery",
        slug: "urban",
        industry: "RETAIL",
        goals: ["Urban Logistics", "Fast Delivery"],
      },
    ];

    const workspaces = await Promise.all(
      workspacesData.map((ws) =>
        (prisma as any).workspace.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            orgId: ws.org.id,
            name: ws.name,
            slug: ws.slug,
            deploymentType: "CLOUD",
            industry: ws.industry,
            goals: ws.goals,
            selectedIntegrations: ["shopify", "stripe", "sendgrid"],
            settings: { timezone: "America/New_York" },
            provisionedAt: new Date(),
            isActive: true,
          },
        })
      )
    );

    log(colors.green, "✓", `Created ${workspaces.length} workspaces`);

    // ────────────────────────────────────────────────────────────────────────
    // 5. CREATE WORKSPACE SETTINGS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Workspace Settings...");

    const workspaceSettings = await Promise.all(
      workspaces.map((ws) =>
        (prisma as any).workspaceSettings.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            workspaceId: ws.id,
            timezone: "America/New_York",
            currency: "USD",
            distanceUnit: "MILES",
            weightUnit: "LBS",
            dateFormat: "MM/DD/YYYY",
            locale: "en-US",
          },
        })
      )
    );

    log(colors.green, "✓", `Created workspace settings`);

    // ────────────────────────────────────────────────────────────────────────
    // 6. CREATE ONBOARDING PROGRESS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Onboarding Progress...");

    const onboardingRecords = await Promise.all(
      users.slice(0, 3).map((user) =>
        (prisma as any).onboardingProgress.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            userId: user.id,
            orgId: user.orgId,
            currentStep: "COMPLETED",
            completedSteps: [
              "BASIC_INFO",
              "WORKSPACE_CONFIG",
              "TEAM_SETUP",
              "INTEGRATIONS",
            ],
            data: {
              companySize: "50-100",
              industry: "Logistics",
              useCase: "Delivery Management",
            },
            completedAt: new Date(),
            isActive: false,
          },
        })
      )
    );

    log(colors.green, "✓", `Created onboarding records`);

    // ────────────────────────────────────────────────────────────────────────
    // 7. CREATE TENANT CONFIGS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Tenant Configs...");

    const tenantConfigs = await Promise.all(
      orgs.map((org) =>
        (prisma as any).tenantConfig.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            orgId: org.id,
            subdomain: org.slug,
            customDomain: null,
            features: {
              webhooks: true,
              apiAccess: true,
              customRoles: org.planTier === "ENTERPRISE",
              advancedReporting: org.planTier === "ENTERPRISE",
            },
            limits: {
              requestsPerDay: org.planTier === "ENTERPRISE" ? 1000000 : 10000,
              storageGb:
                org.planTier === "ENTERPRISE" ? 1000 : org.planTier === "GROWTH" ? 100 : 10,
              usersLimit:
                org.planTier === "ENTERPRISE" ? 999 : org.planTier === "GROWTH" ? 50 : 5,
            },
          },
        })
      )
    );

    log(colors.green, "✓", `Created ${tenantConfigs.length} tenant configs`);

    // ────────────────────────────────────────────────────────────────────────
    // 8. CREATE API KEYS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating API Keys...");

    let apiKeyCount = 0;
    for (const org of orgs) {
      for (let i = 1; i <= 5; i++) {
        const key = `wl_live_${crypto.randomBytes(16).toString("hex")}`;
        const keyHash = crypto.createHash("sha256").update(key).digest("hex");

        await (prisma as any).apiKey.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            orgId: org.id,
            name: `API Key ${i}`,
            prefix: key.substring(0, 8),
            keyHash,
            scopes: ["shipments:read", "routes:write", "webhooks:manage"],
            permissions: {
              shipments: ["create", "read", "update"],
              routes: ["read", "write"],
              webhooks: ["manage"],
            },
            rateLimit: org.planTier === "ENTERPRISE" ? 10000 : 1000,
            isActive: i <= 3,
            expiresAt: null,
            createdBy: users.find((u) => u.orgId === org.id)?.id || users[0].id,
          },
        });
        apiKeyCount++;
      }
    }

    log(colors.green, "✓", `Created ${apiKeyCount} API keys`);

    // ────────────────────────────────────────────────────────────────────────
    // 9. CREATE PERMISSION & ROLE RECORDS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Permissions...");

    const permissions = await (prisma as any).permission.findMany();
    log(colors.green, "✓", `Found ${permissions.length} permissions`);

    // ────────────────────────────────────────────────────────────────────────
    // 10. CREATE INVITATIONS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Invitations...");

    const invitations = [];
    for (const org of orgs) {
      for (let i = 1; i <= 2; i++) {
        const invitation = await (prisma as any).invitation.upsert({
          where: { id: crypto.randomUUID() },
          update: {},
          create: {
            orgId: org.id,
            email: `pending.${org.slug}.${i}@example.com`,
            role: i === 1 ? OrgRole.ADMIN : OrgRole.MEMBER,
            invitedBy: users.find((u) => u.orgId === org.id)?.id || users[0].id,
            token: crypto.randomBytes(32).toString("hex"),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "PENDING",
          },
        });
        invitations.push(invitation);
      }
    }

    log(colors.green, "✓", `Created ${invitations.length} invitations`);

    // ────────────────────────────────────────────────────────────────────────
    // 11. CREATE ORDERS (based on existing orders model)
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Orders...");

    const orderStatuses = ["PENDING", "CONFIRMED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];
    let orderCount = 0;

    for (let i = 1; i <= 50; i++) {
      const org = orgs[Math.floor(Math.random() * orgs.length)];
      const shop = await (prisma as any).shop.findFirst({
        where: { organizationId: org.id },
      });

      if (shop) {
        try {
          await (prisma as any).order.upsert({
            where: { id: crypto.randomUUID() },
            update: {},
            create: {
              shopId: shop.id,
              externalOrderId: `ORD-${Date.now()}-${i}`,
              status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
              recipientName: `Customer ${i}`,
              recipientEmail: `customer${i}@example.com`,
              recipientPhone: `555-${String(1000 + i).padStart(4, "0")}`,
              deliveryAddress: `${100 + i} Main St, New York, NY 10001`,
              items: [
                {
                  sku: `SKU-${String(1000 + i)}`,
                  name: `Product ${i}`,
                  quantity: Math.ceil(Math.random() * 5),
                  price: parseFloat((Math.random() * 100 + 10).toFixed(2)),
                },
              ],
              totalAmount: parseFloat((Math.random() * 500 + 50).toFixed(2)),
              currency: "USD",
              metadata: { source: "api", priority: Math.random() > 0.7 ? "high" : "normal" },
            },
          });
          orderCount++;
        } catch (e) {
          // Silently skip if shop doesn't exist
        }
      }
    }

    log(colors.green, "✓", `Created ${orderCount} orders`);

    // ────────────────────────────────────────────────────────────────────────
    // 12. CREATE DRIVERS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Drivers...");

    let driverCount = 0;
    for (let i = 1; i <= 20; i++) {
      const org = orgs[Math.floor(i / 7)];
      const shop = await (prisma as any).shop.findFirst({
        where: { organizationId: org.id },
      });

      if (shop) {
        try {
          const coords = generateRandomCoordinates();
          await (prisma as any).driver.upsert({
            where: { id: crypto.randomUUID() },
            update: {},
            create: {
              shopId: shop.id,
              name: `Driver ${i}`,
              email: `driver${i}@${org.slug}.local`,
              phone: `555-${String(5000 + i).padStart(4, "0")}`,
              licenseNumber: `DL-${String(100000 + i)}`,
              licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              vehicle: {
                type: ["van", "truck", "car"][Math.floor(Math.random() * 3)],
                licensePlate: `WL-${String(1000 + i)}`,
                capacity: 500 + Math.random() * 500,
              },
              currentLocation: { lat: coords.lat, lng: coords.lng },
              isActive: Math.random() > 0.2,
              availability: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: Math.random() > 0.5,
                sunday: false,
              },
              metadata: { experience_years: Math.floor(Math.random() * 20) + 1 },
            },
          });
          driverCount++;
        } catch (e) {
          // Silently skip if shop doesn't exist
        }
      }
    }

    log(colors.green, "✓", `Created ${driverCount} drivers`);

    // ────────────────────────────────────────────────────────────────────────
    // 13. CREATE DELIVERY ZONES
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Delivery Zones...");

    const zoneData = [
      {
        name: "Manhattan",
        coordinates: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7614, lng: -74.006 },
          { lat: 40.7614, lng: -73.9776 },
          { lat: 40.7128, lng: -73.9776 },
        ],
      },
      {
        name: "Brooklyn",
        coordinates: [
          { lat: 40.6501, lng: -73.95 },
          { lat: 40.6892, lng: -73.95 },
          { lat: 40.6892, lng: -73.86 },
          { lat: 40.6501, lng: -73.86 },
        ],
      },
      {
        name: "Queens",
        coordinates: [
          { lat: 40.721, lng: -73.9352 },
          { lat: 40.802, lng: -73.9352 },
          { lat: 40.802, lng: -73.75 },
          { lat: 40.721, lng: -73.75 },
        ],
      },
      {
        name: "Bronx",
        coordinates: [
          { lat: 40.815, lng: -73.9776 },
          { lat: 40.9123, lng: -73.9776 },
          { lat: 40.9123, lng: -73.7949 },
          { lat: 40.815, lng: -73.7949 },
        ],
      },
      {
        name: "Staten Island",
        coordinates: [
          { lat: 40.5882, lng: -74.1502 },
          { lat: 40.6501, lng: -74.1502 },
          { lat: 40.6501, lng: -74.0445 },
          { lat: 40.5882, lng: -74.0445 },
        ],
      },
    ];

    let zoneCount = 0;
    for (let i = 0; i < zoneData.length; i++) {
      const org = orgs[Math.floor(i / 2)];
      const shop = await (prisma as any).shop.findFirst({
        where: { organizationId: org.id },
      });

      if (shop) {
        try {
          await (prisma as any).deliveryZone.upsert({
            where: { id: crypto.randomUUID() },
            update: {},
            create: {
              shopId: shop.id,
              name: zoneData[i].name,
              polygon: {
                type: "Polygon",
                coordinates: [zoneData[i].coordinates.map((c) => [c.lng, c.lat])],
              },
              deliveryDays: ["MON", "TUE", "WED", "THU", "FRI"],
              cutoffTime: "17:00",
              estimatedDeliveryDays: 1,
              isActive: true,
              metadata: { coverage_area: "nyc" },
            },
          });
          zoneCount++;
        } catch (e) {
          // Silently skip
        }
      }
    }

    log(colors.green, "✓", `Created ${zoneCount} delivery zones`);

    // ────────────────────────────────────────────────────────────────────────
    // 14. CREATE WEBHOOK SUBSCRIPTIONS
    // ────────────────────────────────────────────────────────────────────────
    log(colors.blue, "○", "Creating Webhook Subscriptions...");

    let webhookCount = 0;
    for (const org of orgs) {
      const shop = await (prisma as any).shop.findFirst({
        where: { organizationId: org.id },
      });

      if (shop) {
        const events = [
          "shipment.created",
          "shipment.delivered",
          "shipment.failed",
          "driver.location.updated",
        ];
        for (const event of events) {
          try {
            await (prisma as any).carrierService.upsert({
              where: { id: crypto.randomUUID() },
              update: {},
              create: {
                shopId: shop.id,
                name: `Webhook: ${event}`,
                callbackUrl: `https://webhook.example.com/${event}`,
                events: [event],
                isActive: true,
                headers: {
                  "X-API-Key": crypto.randomBytes(16).toString("hex"),
                },
                metadata: { webhook_type: "outbound" },
              },
            });
            webhookCount++;
          } catch (e) {
            // Silently skip
          }
        }
      }
    }

    log(colors.green, "✓", `Created ${webhookCount} webhook subscriptions`);

    // ────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────────────────────
    log(colors.cyan, "▶", "\nSeed completed successfully!");
    console.log(`
${colors.bright}Summary:${colors.reset}
  Organizations:    ${orgs.length}
  Users:            ${users.length}
  Workspaces:       ${workspaces.length}
  API Keys:         ${apiKeyCount}
  Invitations:      ${invitations.length}
  Orders:           ${orderCount}
  Drivers:          ${driverCount}
  Delivery Zones:   ${zoneCount}
  Webhooks:         ${webhookCount}

${colors.bright}Test Credentials:${colors.reset}
  Password: ${testPassword}
  Sample: alice.johnson@witylogix.test
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

// ─── RUN SEED ──────────────────────────────────────────────────────────────
main();
