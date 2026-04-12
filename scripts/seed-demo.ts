/**
 * Demo seed — creates demo.witylogix.io shop + admin user for local/staging dashboard login.
 *
 * Run from repo root: pnpm exec tsx scripts/seed-demo.ts
 *
 * Demo credentials (change in production):
 *   Email:    admin@demo.witylogix.io
 *   Password: Admin123!
 */

import { prisma } from "@witylogix/db";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

const SHOP_DOMAIN = "demo.witylogix.io";
const ADMIN_EMAIL = "admin@demo.witylogix.io";
const ADMIN_PASSWORD = "Admin123!";

async function main() {
  console.log("Seeding demo shop and admin user...\n");

  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: SHOP_DOMAIN },
    update: { isActive: true },
    create: {
      shopifyDomain: SHOP_DOMAIN,
      name: "Witylogix Demo",
      shopifyAccessToken: "demo_token",
      shopifyShopId: "demo-witylogix-shop",
      isActive: true,
      currency: "USD",
      timezone: "America/New_York",
      planTier: "GROWTH",
    },
  });
  console.log(`Shop: ${shop.shopifyDomain} (${shop.id})`);

  const password = await hashPassword(ADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { shopId_email: { shopId: shop.id, email: ADMIN_EMAIL } },
    update: { password, isActive: true, role: "SUPER_ADMIN" },
    create: {
      shopId: shop.id,
      email: ADMIN_EMAIL,
      name: "Demo Admin",
      role: "SUPER_ADMIN",
      password,
      isActive: true,
    },
  });
  console.log(`User: ${user.email} (${user.role})\n`);

  console.log(`Dashboard login:
  Email:    ${ADMIN_EMAIL}
  Password: ${ADMIN_PASSWORD}
  Domain:   ${SHOP_DOMAIN}`);
}

main()
  .catch((e: Error) => {
    console.error("Seed failed:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
