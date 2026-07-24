import { test, expect } from "../fixtures/auth";

/**
 * Tier 4 — end-to-end create flows.
 *
 * For each of the new stub create pages we:
 *   1. Navigate to the list page.
 *   2. Click the primary action → lands on /<resource>/create.
 *   3. Fill the form with a unique e2e-generated value.
 *   4. Submit.
 *   5. Assert we redirect back to the list and the new record is visible.
 *
 * These assertions HIT REAL WRITES against the staging API. Each run creates
 * a new driver/customer/zone tagged with an `e2e-<timestamp>` suffix — harmless
 * test fixtures that pile up in the demo tenant. A cleanup pass or teardown
 * fixture is a follow-up.
 */

function uniqueSuffix(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Tier 4 issues real writes and races on shared API state (rate limiter,
// connection pool, auth). Running it serial inside the file — the other
// tiers remain parallel and pay the cost of this one small describe.
test.describe.configure({ mode: "serial" });

test.describe("Tier 4 — end-to-end create flows", () => {
  test("can create a driver via /drivers/create", async ({
    authedPage,
  }, testInfo) => {
    const page = authedPage;
    const suffix = uniqueSuffix();
    const name = `Test Driver ${suffix}`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await page.goto("/drivers", { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});

    await page
      .getByRole("button", { name: /add driver/i })
      .first()
      .click();
    await page.waitForURL(/\/drivers\/create$/, { timeout: 15000 });

    await page.getByLabel("Full name", { exact: false }).fill(name);
    await page.getByLabel("Phone", { exact: false }).fill(phone);
    await page.getByLabel(/^email/i).fill(`${suffix}@example.com`);

    await page.getByRole("button", { name: /create driver/i }).click();

    // Redirect back to list.
    await page.waitForURL(/\/drivers$/, { timeout: 20000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    const bodyText = (await page.locator("body").textContent()) ?? "";
    testInfo.annotations.push({
      type: "created",
      description: `driver name=${name}`,
    });

    await testInfo.attach("drivers-after-create.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    expect(bodyText, `new driver "${name}" not visible after create`).toContain(
      name,
    );
  });

  test("can create a customer via /customers/create", async ({
    authedPage,
  }, testInfo) => {
    const page = authedPage;
    const suffix = uniqueSuffix();
    const firstName = "E2E";
    const lastName = `Test-${suffix}`;
    const email = `${suffix}@e2e.example.com`;

    await page.goto("/customers", { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});

    await page
      .getByRole("button", { name: /add customer/i })
      .first()
      .click();
    await page.waitForURL(/\/customers\/create$/, { timeout: 15000 });

    await page.getByLabel(/first name/i).fill(firstName);
    await page.getByLabel(/last name/i).fill(lastName);
    await page.getByLabel(/^email/i).fill(email);
    await page
      .getByLabel(/phone/i)
      .fill(`+1555${String(Date.now()).slice(-7)}`);

    await page.getByRole("button", { name: /create customer/i }).click();

    await page.waitForURL(/\/customers$/, { timeout: 20000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    const bodyText = (await page.locator("body").textContent()) ?? "";
    testInfo.annotations.push({
      type: "created",
      description: `customer email=${email}`,
    });

    await testInfo.attach("customers-after-create.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Customer may be paginated off the first page — we assert either name
    // OR email is visible. The page sorts by name asc so e2e records often
    // show up alphabetically late.
    const nameFound = bodyText.includes(lastName);
    const emailFound = bodyText.includes(email) || bodyText.includes(suffix);
    expect(
      nameFound || emailFound,
      `new customer not visible after create — looked for "${lastName}" or "${email}"`,
    ).toBeTruthy();
  });

  test("can create a zone via /zones/create", async ({
    authedPage,
  }, testInfo) => {
    const page = authedPage;
    const suffix = uniqueSuffix();
    const zoneName = `Test Zone ${suffix}`;

    await page.goto("/zones", { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});

    await page
      .getByRole("button", { name: /create zone/i })
      .first()
      .click();
    await page.waitForURL(/\/zones\/create$/, { timeout: 15000 });

    await page.getByLabel(/zone name/i).fill(zoneName);
    await page.getByLabel(/description/i).fill("Created by tier 4 e2e");
    await page.getByLabel(/base rate/i).fill("9.99");
    await page.getByLabel(/per-km rate/i).fill("1.25");

    await page
      .getByRole("button", { name: /create zone/i })
      .last()
      .click();

    await page.waitForURL(/\/zones$/, { timeout: 20000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    const bodyText = (await page.locator("body").textContent()) ?? "";
    testInfo.annotations.push({
      type: "created",
      description: `zone name=${zoneName}`,
    });

    await testInfo.attach("zones-after-create.png", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    expect(
      bodyText,
      `new zone "${zoneName}" not visible after create`,
    ).toContain(zoneName);
  });
});
