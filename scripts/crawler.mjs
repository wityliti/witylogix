import { chromium } from "@playwright/test";

const BASE = "http://localhost:3003";
const API = "http://localhost:8000";

const PAGES = [
  "/home", "/activity",
  "/orders", "/orders/board", "/orders/create", "/orders/bulk", "/orders/import",
  "/shipments", "/delivery",
  "/drivers", "/drivers/performance", "/locations", "/zones",
  "/integrations", "/integrations/providers", "/integrations/webhooks",
  "/integrations/credentials", "/integrations/chaos", "/integrations/docs",
  "/integrations/migration", "/integrations/catalog", "/integrations/connected",
  "/settings", "/settings/profile", "/settings/organization", "/settings/general",
  "/settings/api-keys", "/settings/auth-providers", "/settings/billing",
  "/settings/branding", "/settings/maps", "/settings/preferences",
  "/settings/team", "/settings/webhooks", "/settings/notifications",
  "/settings/payments",
  "/routes", "/routes/plan", "/routes/create",
  "/analytics", "/analytics/reports", "/analytics/dashboards",
  "/customers", "/dispatch", "/fleet", "/fleet/vehicles", "/fleet/maintenance", "/fleet/fuel",
  "/freight", "/freight/loads", "/freight/rates",
  "/returns", "/billing", "/collections", "/campaigns",
  "/products", "/pos", "/time-slots", "/tracking", "/tracking/live",
  "/notifications", "/support", "/admin", "/saved-views",
  "/map", "/inventory", "/invoices", "/payments", "/shipping-profiles",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Actually log in through the UI to get proper cookies set
  const loginPage = await context.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 15000 });

  // Fill and submit login form
  await loginPage.fill('input[type="email"], input#email', 'admin@demo.witylogix.io');
  await loginPage.fill('input[type="password"], input#password', 'Admin123!');
  await loginPage.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await loginPage.waitForURL('**/home**', { timeout: 15000 }).catch(() => {
    // May redirect to / instead
  });
  await loginPage.waitForTimeout(2000);

  console.log("Logged in. Current URL:", loginPage.url());

  // Verify we have cookies
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === 'auth-token');
  console.log("Auth cookie:", authCookie ? `set (${authCookie.value.substring(0,20)}...)` : "MISSING");

  if (!authCookie) {
    console.error("LOGIN FAILED - no auth cookie set");
    await browser.close();
    return;
  }

  await loginPage.close();

  const results = [];

  for (const path of PAGES) {
    const page = await context.newPage();
    const failedReqs = [];

    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().includes("_next") && !r.url().includes("favicon"))
        failedReqs.push(`${r.status()} ${r.url().substring(0, 120)}`);
    });

    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 15000 });
      if (page.url().includes("/login")) { results.push({ path, status: "REDIR", details: "→ login" }); await page.close(); continue; }
      await page.waitForTimeout(1000);

      const info = await page.evaluate(() => {
        const body = document.body.innerText || "";
        const hasError = body.includes("Failed to") || body.includes("Something went wrong");
        const errorSnippet = hasError ? body.match(/(Failed to[^\n]{0,80}|Something went wrong[^\n]{0,40})/)?.[0] || "error" : "";
        const mainEl = document.querySelector("main") || document.querySelector('[role="main"]');
        const mainText = mainEl ? mainEl.innerText.trim() : "";
        return { bodyLen: body.length, mainLen: mainText.length, hasError, errorSnippet };
      });

      if (info.hasError) {
        results.push({ path, status: "ERROR", details: info.errorSnippet.substring(0, 150) });
      } else if (info.mainLen < 15 && info.bodyLen < 200) {
        results.push({ path, status: "EMPTY", details: `mainLen=${info.mainLen} bodyLen=${info.bodyLen}` });
      } else if (failedReqs.length > 0) {
        results.push({ path, status: "API_ERR", details: failedReqs.slice(0, 2).join("; ").substring(0, 150) });
      } else {
        results.push({ path, status: "OK", details: "" });
      }
    } catch (e) {
      results.push({ path, status: "CRASH", details: e.message.substring(0, 120) });
    }
    await page.close();
    process.stdout.write(".");
  }

  await browser.close();

  const broken = results.filter(r => r.status !== "OK");
  const ok = results.filter(r => r.status === "OK");

  console.log(`\n\n===== PAGE AUDIT: ${results.length} pages =====`);
  console.log(`OK: ${ok.length}  |  BROKEN: ${broken.length}\n`);

  if (broken.length > 0) {
    console.log("--- BROKEN ---");
    for (const r of broken) console.log(`[${r.status}] ${r.path} — ${r.details}`);
  }
  console.log("\n--- OK ---");
  for (const r of ok) console.log(`  ${r.path}`);

  const fs = await import("fs");
  fs.writeFileSync("/tmp/wl-page-audit.json", JSON.stringify({ broken, ok: ok.map(r => r.path) }, null, 2));
  console.log("\nJSON: /tmp/wl-page-audit.json");
}

main().catch(e => { console.error(e); process.exit(1); });
