/**
 * Page Crawler — visits every dashboard page and reports status
 * Run: npx playwright test scripts/page-crawler.ts --reporter=list
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3003";
const API = "http://localhost:8000";

// All routes from sidebar + key sub-pages
const PAGES = [
  // Overview
  "/home",
  "/activity",
  // Orders & Deliveries
  "/orders",
  "/orders/board",
  "/orders/create",
  "/orders/bulk",
  "/orders/import",
  "/shipments",
  "/deliveries",
  "/delivery",
  // Fleet
  "/drivers",
  "/drivers/performance",
  "/locations",
  "/zones",
  // Integrations
  "/integrations",
  "/integrations/providers",
  "/integrations/webhooks",
  "/integrations/credentials",
  "/integrations/chaos",
  "/integrations/docs",
  "/integrations/migration",
  "/integrations/catalog",
  "/integrations/connected",
  // Settings
  "/settings",
  "/settings/profile",
  "/settings/organization",
  "/settings/general",
  "/settings/api-keys",
  "/settings/auth-providers",
  "/settings/billing",
  "/settings/branding",
  "/settings/maps",
  "/settings/preferences",
  "/settings/team",
  "/settings/webhooks",
  "/settings/notifications",
  "/settings/payments",
  // Routes
  "/routes",
  "/routes/plan",
  "/routes/create",
  // Analytics
  "/analytics",
  "/analytics/reports",
  "/analytics/dashboards",
  // Other sidebar
  "/customers",
  "/dispatch",
  "/fleet",
  "/fleet/vehicles",
  "/fleet/maintenance",
  "/fleet/fuel",
  "/freight",
  "/freight/loads",
  "/freight/rates",
  "/returns",
  "/billing",
  "/collections",
  "/campaigns",
  "/products",
  "/pos",
  "/time-slots",
  "/tracking",
  "/tracking/live",
  "/notifications",
  "/support",
  "/admin",
  "/saved-views",
  "/map",
  "/inventory",
  "/invoices",
  "/payments",
  "/shipping-profiles",
];

interface PageResult {
  path: string;
  status: "ok" | "empty" | "error" | "api_error" | "crash";
  details: string;
}

async function main() {
  // 1. Get auth token
  const loginResp = await fetch(`${API}/api/v4/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@demo.witylogix.io",
      password: "Admin123!",
      shopDomain: "demo.witylogix.io",
    }),
  });
  const loginData = await loginResp.json();
  const token = loginData.data.accessToken;

  // 2. Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Set auth cookie
  await context.addCookies([
    {
      name: "auth-token",
      value: token,
      domain: "localhost",
      path: "/",
    },
  ]);

  // Also set localStorage via a page
  const setupPage = await context.newPage();
  await setupPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await setupPage.evaluate((userData) => {
    localStorage.setItem("authUser", JSON.stringify(userData));
  }, loginData.data.user);
  await setupPage.close();

  const results: PageResult[] = [];

  for (const path of PAGES) {
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text().substring(0, 200));
      }
    });

    page.on("response", (resp) => {
      if (resp.status() >= 400 && !resp.url().includes("_next")) {
        failedRequests.push(`${resp.status()} ${resp.url().substring(0, 100)}`);
      }
    });

    try {
      const resp = await page.goto(`${BASE}${path}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });

      // Check if redirected to login
      if (page.url().includes("/login")) {
        results.push({ path, status: "error", details: "Redirected to login" });
        await page.close();
        continue;
      }

      // Wait a bit for client rendering
      await page.waitForTimeout(1500);

      // Check for error states in the page
      const errorElements = await page.$$eval(
        '[class*="error"], [class*="Error"], [class*="danger"]',
        (els) =>
          els
            .map((el) => el.textContent?.trim())
            .filter((t) => t && (t.includes("Failed") || t.includes("Error") || t.includes("failed")))
            .slice(0, 3)
      );

      // Check if main content area is empty
      const mainContent = await page.evaluate(() => {
        const main = document.querySelector("main") || document.querySelector('[class*="content"]');
        if (!main) return "no-main";
        const text = main.textContent?.trim() || "";
        return text.length < 20 ? "empty" : "has-content";
      });

      // Check for visible text content
      const bodyText = await page.evaluate(() => {
        return document.body.innerText.substring(0, 500);
      });

      const hasContent = bodyText.length > 100;
      const hasError =
        errorElements.length > 0 ||
        bodyText.includes("Failed to") ||
        bodyText.includes("Something went wrong") ||
        bodyText.includes("Error loading");

      if (hasError) {
        const errorDetail = errorElements.join("; ") || "Error text in page";
        results.push({ path, status: "error", details: errorDetail.substring(0, 200) });
      } else if (!hasContent || mainContent === "empty") {
        results.push({ path, status: "empty", details: `content=${mainContent}, bodyLen=${bodyText.length}` });
      } else if (failedRequests.length > 0) {
        results.push({ path, status: "api_error", details: failedRequests.slice(0, 2).join("; ") });
      } else {
        results.push({ path, status: "ok", details: "" });
      }
    } catch (err: any) {
      results.push({ path, status: "crash", details: err.message.substring(0, 200) });
    }

    await page.close();
  }

  await browser.close();

  // Print report
  console.log("\n========== PAGE AUDIT REPORT ==========\n");

  const ok = results.filter((r) => r.status === "ok");
  const broken = results.filter((r) => r.status !== "ok");

  console.log(`TOTAL: ${results.length} pages`);
  console.log(`  OK: ${ok.length}`);
  console.log(`  BROKEN: ${broken.length}\n`);

  if (broken.length > 0) {
    console.log("--- BROKEN PAGES ---\n");
    for (const r of broken) {
      console.log(`[${r.status.toUpperCase()}] ${r.path}`);
      console.log(`  ${r.details}\n`);
    }
  }

  console.log("--- OK PAGES ---\n");
  for (const r of ok) {
    console.log(`  [OK] ${r.path}`);
  }

  // Write JSON report
  const fs = await import("fs");
  fs.writeFileSync(
    "/tmp/wl-page-audit.json",
    JSON.stringify({ total: results.length, ok: ok.length, broken: broken.length, results: broken }, null, 2)
  );
  console.log("\nFull report: /tmp/wl-page-audit.json");
}

main().catch(console.error);
