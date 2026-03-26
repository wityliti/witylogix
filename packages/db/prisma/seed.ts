/**
 * Database seed script for Witylogix
 * Creates realistic test data matching the actual Prisma schema.
 *
 * Run: node --import tsx packages/db/prisma/seed.ts
 */
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/index.js");
  const prisma = new PrismaClient();

  console.log("🌱 Seeding Witylogix database...\n");

  // ── 1. Organization ─────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "witylogix-demo" },
    update: {},
    create: {
      name: "Witylogix Demo Corp",
      slug: "witylogix-demo",
      email: "billing@demo.witylogix.io",
      planTier: "ENTERPRISE",
      isActive: true,
    },
  });
  console.log("✅ Organization:", org.name);

  // ── 2. Shop ─────────────────────────────────────────────
  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: "demo.witylogix.io" },
    update: {},
    create: {
      name: "Demo Logistics Hub",
      shopifyDomain: "demo.witylogix.io",
      shopifyAccessToken: "demo_access_token_placeholder",
      shopifyShopId: "demo-shop-001",
      orgId: org.id,
      planTier: "ENTERPRISE",
      isActive: true,
      timezone: "America/New_York",
      currency: "USD",
      email: "ops@demo.witylogix.io",
    },
  });
  console.log("✅ Shop:", shop.name);

  // ── 3. Users ────────────────────────────────────────────
  const adminPwd = await hashPassword("Admin123!");
  const managerPwd = await hashPassword("Manager123!");
  const dispatchPwd = await hashPassword("Dispatch123!");

  const admin = await prisma.user.upsert({
    where: { shopId_email: { shopId: shop.id, email: "admin@demo.witylogix.io" } },
    update: { password: adminPwd },
    create: {
      shopId: shop.id,
      email: "admin@demo.witylogix.io",
      name: "Alex Rodriguez",
      role: "ADMIN",
      password: adminPwd,
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { shopId_email: { shopId: shop.id, email: "manager@demo.witylogix.io" } },
    update: { password: managerPwd },
    create: {
      shopId: shop.id,
      email: "manager@demo.witylogix.io",
      name: "Sarah Chen",
      role: "ADMIN",
      password: managerPwd,
      isActive: true,
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { shopId_email: { shopId: shop.id, email: "dispatch@demo.witylogix.io" } },
    update: { password: dispatchPwd },
    create: {
      shopId: shop.id,
      email: "dispatch@demo.witylogix.io",
      name: "Mike Johnson",
      role: "DISPATCHER",
      password: dispatchPwd,
      isActive: true,
    },
  });
  console.log("✅ Users:", [admin, manager, dispatcher].map(u => u.email).join(", "));

  // ── 4. Org Members ──────────────────────────────────────
  for (const user of [admin, manager, dispatcher]) {
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      update: {},
      create: {
        orgId: org.id,
        userId: user.id,
        role: user.id === admin.id ? "OWNER" : "MEMBER",
        isActive: true,
      },
    });
  }
  console.log("✅ Org memberships created");

  // ── 5. Locations ────────────────────────────────────────
  const warehouse = await prisma.location.create({
    data: {
      shop: { connect: { id: shop.id } },
      organization: { connect: { id: org.id } },
      name: "Main Warehouse",
      type: "WAREHOUSE",
      addressLine1: "100 Logistics Pkwy",
      city: "Newark",
      province: "NJ",
      postalCode: "07102",
      country: "US",
      coordinates: { lat: 40.7357, lng: -74.1724 },
      isActive: true,
    },
  });

  const depot = await prisma.location.create({
    data: {
      shop: { connect: { id: shop.id } },
      organization: { connect: { id: org.id } },
      name: "Brooklyn Depot",
      type: "DEPOT",
      addressLine1: "250 Atlantic Ave",
      city: "Brooklyn",
      province: "NY",
      postalCode: "11201",
      country: "US",
      coordinates: { lat: 40.6860, lng: -73.9770 },
      isActive: true,
    },
  });
  console.log("✅ Locations:", warehouse.name, ",", depot.name);

  // ── 6. Drivers ──────────────────────────────────────────
  const driverData = [
    { name: "James Wilson", phone: "+15550201", vehicleType: "VAN" as const, plate: "NJ-DLV-101" },
    { name: "Maria Garcia", phone: "+15550202", vehicleType: "VAN" as const, plate: "NJ-DLV-102" },
    { name: "David Kim", phone: "+15550203", vehicleType: "TRUCK" as const, plate: "NJ-DLV-103" },
    { name: "Lisa Thompson", phone: "+15550204", vehicleType: "MOTORCYCLE" as const, plate: "NJ-BKE-201" },
    { name: "Robert Brown", phone: "+15550205", vehicleType: "VAN" as const, plate: "NJ-DLV-104" },
  ];

  const driverPwd = await hashPassword("Driver123!");
  const drivers = [];
  for (const d of driverData) {
    const driver = await prisma.driver.upsert({
      where: { orgId_phone: { orgId: org.id, phone: d.phone } },
      update: {},
      create: {
        organization: { connect: { id: org.id } },
        shop: { connect: { id: shop.id } },
        name: d.name,
        phone: d.phone,
        email: `${d.name.split(" ")[0].toLowerCase()}@drivers.demo.witylogix.io`,
        password: driverPwd,
        vehicleType: d.vehicleType,
        vehiclePlate: d.plate,
        status: "AVAILABLE",
        isActive: true,
        currentLocation: { lat: 40.7128 + (Math.random() - 0.5) * 0.1, lng: -74.006 + (Math.random() - 0.5) * 0.1 },
      },
    });
    drivers.push(driver);
  }
  console.log("✅ Drivers:", drivers.length, "created");

  // ── 7. Customers ────────────────────────────────────────
  const customerData = [
    { name: "John Smith", email: "john@acmecorp.com", phone: "+15551001", company: "Acme Corp" },
    { name: "Emily Davis", email: "emily@techstart.io", phone: "+15551002", company: "TechStart" },
    { name: "Chris Lee", email: "chris@greenfoods.com", phone: "+15551003", company: "Green Foods" },
    { name: "Amanda White", email: "amanda@luxehome.com", phone: "+15551004", company: "Luxe Home" },
    { name: "Kevin Patel", email: "kevin@quickship.co", phone: "+15551005", company: "QuickShip" },
    { name: "Rachel Green", email: "rachel@urbanstyle.com", phone: "+15551006", company: "Urban Style" },
    { name: "Tom Harris", email: "tom@megastore.com", phone: "+15551007", company: "MegaStore" },
    { name: "Nina Sharma", email: "nina@freshbox.io", phone: "+15551008", company: "FreshBox" },
  ];

  const customers = [];
  for (const c of customerData) {
    const customer = await prisma.customer.upsert({
      where: { shopId_externalCustomerId_source: { shopId: shop.id, externalCustomerId: `ext-${c.email}`, source: "MANUAL" } },
      update: {},
      create: {
        shopId: shop.id,
        externalCustomerId: `ext-${c.email}`,
        source: "MANUAL",
        email: c.email,
        phone: c.phone,
        firstName: c.name.split(" ")[0],
        lastName: c.name.split(" ")[1],
        ordersCount: Math.floor(Math.random() * 20) + 1,
        totalSpent: parseFloat((100 + Math.random() * 5000).toFixed(2)),
        addresses: JSON.stringify([{
          line1: `${100 + Math.floor(Math.random() * 900)} ${["Broadway", "5th Ave", "Park Ave"][Math.floor(Math.random() * 3)]}`,
          city: "New York",
          province: "NY",
          postalCode: "10001",
          country: "US",
          latitude: 40.7128 + (Math.random() - 0.5) * 0.08,
          longitude: -74.006 + (Math.random() - 0.5) * 0.08,
        }]),
      },
    });
    customers.push(customer);
  }
  console.log("✅ Customers:", customers.length, "created");

  // ── 8. Orders ───────────────────────────────────────────
  const statuses = ["PENDING", "ACCEPTED", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERED"] as const;
  const now = new Date();
  const orders = [];

  for (let i = 0; i < 25; i++) {
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];
    const daysAgo = Math.floor(Math.random() * 14);
    const createdAt = new Date(now.getTime() - daysAgo * 86400000);
    const extId = `ext-order-${String(1001 + i)}`;
    const extNum = `WTL-${String(1001 + i).padStart(5, "0")}`;

    const order = await prisma.order.upsert({
      where: { shopId_externalOrderId_source: { shopId: shop.id, externalOrderId: extId, source: "MANUAL" } },
      update: {},
      create: {
        shopId: shop.id,
        externalOrderId: extId,
        externalOrderNumber: extNum,
        source: "MANUAL",
        status,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        addressLine1: `${100 + i * 10} Broadway`,
        city: "New York",
        province: "NY",
        postalCode: "10001",
        country: "US",
        totalPrice: parseFloat((50 + Math.random() * 450).toFixed(2)),
        createdAt,
      },
    });
    orders.push(order);
  }
  console.log("✅ Orders:", orders.length, "created");

  // ── 9. Routes ───────────────────────────────────────────
  const routeStatuses = ["IN_PROGRESS", "COMPLETED", "DRAFT"] as const;
  for (let r = 0; r < 3; r++) {
    const driver = drivers[r];
    const routeOrders = orders.slice(r * 5, r * 5 + 5);
    const route = await prisma.route.create({
      data: {
        shop: { connect: { id: shop.id } },
        driver: { connect: { id: driver.id } },
        name: `Route ${r + 1} — ${driver.name}`,
        status: routeStatuses[r],
        date: new Date(),
        startAddress: "100 Logistics Pkwy, Newark, NJ",
        totalDistance: 25.5 + r * 10,
        totalDuration: 120 + r * 30,
        stops: {
          create: routeOrders.map((order, idx) => ({
            orderId: order.id,
            driverId: driver.id,
            sequence: idx + 1,
            status: r === 1 ? "COMPLETED" : idx < 2 ? "COMPLETED" : "PENDING",
            estimatedArrival: new Date(now.getTime() + idx * 1800000),
          })),
        },
      },
    });
    console.log(`✅ Route: ${route.name} (${routeOrders.length} stops)`);
  }

  // ── 10. Delivery Zones ──────────────────────────────────
  const zones = [
    { name: "Manhattan Core", baseRate: 8.99 },
    { name: "Brooklyn/Queens", baseRate: 12.99 },
    { name: "New Jersey Metro", baseRate: 15.99 },
  ];
  for (const z of zones) {
    await prisma.deliveryZone.create({
      data: {
        shop: { connect: { id: shop.id } },
        organization: { connect: { id: org.id } },
        name: z.name,
        baseRate: z.baseRate,
        perKmRate: 1.50,
        isActive: true,
      },
    });
  }
  console.log("✅ Delivery zones:", zones.length, "created");

  // ── 11. Activity Logs ───────────────────────────────────
  const actions = ["created", "status_changed", "assigned", "delivered", "updated"];
  const entityTypes = ["order", "order", "driver", "shipment", "route"];
  for (let i = 0; i < 20; i++) {
    await prisma.activityLog.create({
      data: {
        shopId: shop.id,
        entityType: entityTypes[i % entityTypes.length],
        entityId: orders[i % orders.length].id,
        action: actions[i % actions.length],
        actorType: "user",
        actorId: [admin.id, manager.id, dispatcher.id][i % 3],
        changes: { note: `Activity log entry #${i + 1}` },
        ipAddress: `192.168.1.${100 + i}`,
        timestamp: new Date(now.getTime() - i * 3600000),
      },
    });
  }
  console.log("✅ Activity logs: 20 created");

  // ── Done ────────────────────────────────────────────────
  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Login credentials:");
  console.log("   Shop domain: demo.witylogix.io");
  console.log("   Admin:    admin@demo.witylogix.io / Admin123!");
  console.log("   Manager:  manager@demo.witylogix.io / Manager123!");
  console.log("   Dispatch: dispatch@demo.witylogix.io / Dispatch123!");
  console.log("\n📊 Data summary:");
  console.log("   Organization: 1, Shop: 1, Users: 3");
  console.log("   Drivers: 5, Customers: 8, Orders: 25");
  console.log("   Routes: 3, Zones: 3, Activity logs: 20");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
