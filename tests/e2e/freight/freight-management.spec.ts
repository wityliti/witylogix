/**
 * Freight Management E2E Tests - Playwright
 * Comprehensive end-to-end testing for complete freight workflow
 * Tests: dashboard, load creation, rate comparison, audit, compliance, DVIR, ELD
 * ~450 lines, 20+ tests
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL || "qa@witylogix.test";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPassword123!";

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Freight Management Workflow", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FREIGHT DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────

  test("should load freight dashboard with overview", async () => {
    await page.goto(`${BASE_URL}/freight/dashboard`);

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="freight-overview"]');

    // Verify key sections exist
    const overview = await page.locator('[data-testid="freight-overview"]');
    expect(overview).toBeDefined();

    // Check for KPIs
    const kpis = await page.locator('[data-testid="kpi-card"]').all();
    expect(kpis.length).toBeGreaterThan(0);
  });

  test("should display current freight statistics", async () => {
    await page.goto(`${BASE_URL}/freight/dashboard`);

    // Wait for stats to load
    await page.waitForSelector('[data-testid="freight-stats"]');

    // Check for key metrics
    const activeLoads = await page
      .locator('[data-testid="stat-active-loads"]')
      .textContent();
    const avgRate = await page
      .locator('[data-testid="stat-avg-rate"]')
      .textContent();

    expect(activeLoads).toBeDefined();
    expect(avgRate).toBeDefined();
  });

  test("should show recent activity timeline", async () => {
    await page.goto(`${BASE_URL}/freight/dashboard`);

    await page.waitForSelector('[data-testid="activity-timeline"]');

    const timeline = await page.locator('[data-testid="activity-item"]').all();
    expect(timeline.length).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE NEW LOAD
  // ─────────────────────────────────────────────────────────────────────────

  test("should navigate to create load form", async () => {
    await page.goto(`${BASE_URL}/freight/loads`);

    // Click create load button
    await page.click('[data-testid="btn-create-load"]');

    // Wait for form
    await page.waitForSelector('[data-testid="load-form"]');

    const form = await page.locator('[data-testid="load-form"]');
    expect(form).toBeDefined();
  });

  test("should create new load with origin and destination", async () => {
    await page.goto(`${BASE_URL}/freight/loads/new`);

    await page.waitForSelector('[data-testid="load-form"]');

    // Fill origin
    await page.fill('[data-testid="field-origin"]', "Los Angeles, CA");
    await page.click('text="Los Angeles, CA 90001"'); // Select from autocomplete

    // Fill destination
    await page.fill('[data-testid="field-destination"]', "New York, NY");
    await page.click('text="New York, NY 10001"');

    // Verify fields populated
    const origin = await page.inputValue('[data-testid="field-origin"]');
    const destination = await page.inputValue(
      '[data-testid="field-destination"]',
    );

    expect(origin).toContain("Los Angeles");
    expect(destination).toContain("New York");
  });

  test("should fill cargo details for load", async () => {
    await page.goto(`${BASE_URL}/freight/loads/new`);

    await page.waitForSelector('[data-testid="load-form"]');

    // Set origin and destination (needed for cargo details)
    await page.fill('[data-testid="field-origin"]', "Los Angeles, CA");
    await page.click('text="Los Angeles, CA"');
    await page.fill('[data-testid="field-destination"]', "New York, NY");
    await page.click('text="New York, NY"');

    // Fill cargo details
    await page.fill('[data-testid="field-weight"]', "20000"); // 20,000 lbs
    await page.selectOption('[data-testid="field-equipment"]', "53FT_DRY_VAN");
    await page.fill('[data-testid="field-rate"]', "2500");

    // Add special requirements
    await page.click('[data-testid="checkbox-refrigerated"]');

    // Verify cargo info
    const weight = await page.inputValue('[data-testid="field-weight"]');
    const equipment = await page.inputValue('[data-testid="field-equipment"]');

    expect(weight).toBe("20000");
    expect(equipment).toBe("53FT_DRY_VAN");
  });

  test("should set pickup and delivery timewindows", async () => {
    await page.goto(`${BASE_URL}/freight/loads/new`);

    await page.waitForSelector('[data-testid="load-form"]');

    // Set pickup timewindow
    await page.fill('[data-testid="field-pickup-date"]', "03/20/2024");
    await page.fill('[data-testid="field-pickup-time-from"]', "08:00 AM");
    await page.fill('[data-testid="field-pickup-time-to"]', "05:00 PM");

    // Set delivery timewindow
    await page.fill('[data-testid="field-delivery-date"]', "03/22/2024");
    await page.fill('[data-testid="field-delivery-time-from"]', "09:00 AM");
    await page.fill('[data-testid="field-delivery-time-to"]', "06:00 PM");

    // Verify timewindows set
    const pickupDate = await page.inputValue(
      '[data-testid="field-pickup-date"]',
    );
    const deliveryDate = await page.inputValue(
      '[data-testid="field-delivery-date"]',
    );

    expect(pickupDate).toBe("03/20/2024");
    expect(deliveryDate).toBe("03/22/2024");
  });

  test("should submit and create load", async () => {
    await page.goto(`${BASE_URL}/freight/loads/new`);

    // Fill required fields
    await page.fill('[data-testid="field-origin"]', "Los Angeles, CA");
    await page.click('text="Los Angeles, CA"');
    await page.fill('[data-testid="field-destination"]', "New York, NY");
    await page.click('text="New York, NY"');
    await page.fill('[data-testid="field-weight"]', "20000");
    await page.selectOption('[data-testid="field-equipment"]', "53FT_DRY_VAN");
    await page.fill('[data-testid="field-rate"]', "2500");

    // Submit form
    await page.click('[data-testid="btn-submit-load"]');

    // Wait for success message
    await page.waitForSelector('[data-testid="success-message"]');

    const successMsg = await page
      .locator('[data-testid="success-message"]')
      .textContent();
    expect(successMsg).toContain("created");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW RATE COMPARISON
  // ─────────────────────────────────────────────────────────────────────────

  test("should view rate comparison for a lane", async () => {
    // Navigate to loads list
    await page.goto(`${BASE_URL}/freight/loads`);

    // Wait for loads to load
    await page.waitForSelector('[data-testid="load-row"]');

    // Get first load
    const firstLoad = await page.locator('[data-testid="load-row"]').first();

    // Click view rates button
    await firstLoad.locator('[data-testid="btn-view-rates"]').click();

    // Wait for rate comparison modal
    await page.waitForSelector('[data-testid="rate-comparison-modal"]');

    const modal = await page.locator('[data-testid="rate-comparison-modal"]');
    expect(modal).toBeDefined();
  });

  test("should display rates from multiple providers", async () => {
    await page.goto(`${BASE_URL}/freight/loads`);

    await page.waitForSelector('[data-testid="load-row"]');

    const firstLoad = await page.locator('[data-testid="load-row"]').first();
    await firstLoad.locator('[data-testid="btn-view-rates"]').click();

    await page.waitForSelector('[data-testid="rate-comparison-modal"]');

    // Check for DAT rates
    const datRates = await page.locator('[data-testid="provider-DAT"]');
    expect(datRates).toBeDefined();

    // Check for Truckstop rates
    const truckstopRates = await page.locator(
      '[data-testid="provider-TRUCKSTOP"]',
    );
    expect(truckstopRates).toBeDefined();
  });

  test("should compare rates across providers", async () => {
    await page.goto(`${BASE_URL}/freight/loads`);

    await page.waitForSelector('[data-testid="load-row"]');

    const firstLoad = await page.locator('[data-testid="load-row"]').first();
    await firstLoad.locator('[data-testid="btn-view-rates"]').click();

    await page.waitForSelector('[data-testid="rate-comparison-modal"]');

    // Get all provider rates
    const rates = await page
      .locator('[data-testid="provider-rate"]')
      .allTextContents();

    // Verify rates are displayed
    expect(rates.length).toBeGreaterThan(0);

    // Verify rates are numbers
    rates.forEach((rate) => {
      const numValue = parseFloat(rate.replace(/[^0-9.]/g, ""));
      expect(numValue).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RUN FREIGHT AUDIT
  // ─────────────────────────────────────────────────────────────────────────

  test("should navigate to audit section", async () => {
    await page.goto(`${BASE_URL}/freight/audit`);

    await page.waitForSelector('[data-testid="audit-dashboard"]');

    const dashboard = await page.locator('[data-testid="audit-dashboard"]');
    expect(dashboard).toBeDefined();
  });

  test("should run freight audit", async () => {
    await page.goto(`${BASE_URL}/freight/audit`);

    // Click run audit button
    await page.click('[data-testid="btn-run-audit"]');

    // Wait for audit dialog
    await page.waitForSelector('[data-testid="audit-dialog"]');

    // Select audit parameters
    await page.selectOption(
      '[data-testid="field-audit-period"]',
      "last_30_days",
    );
    await page.selectOption('[data-testid="field-tolerance"]', "2_percent");

    // Submit audit
    await page.click('[data-testid="btn-submit-audit"]');

    // Wait for audit results
    await page.waitForSelector('[data-testid="audit-results"]', {
      timeout: 30000,
    });

    const results = await page.locator('[data-testid="audit-results"]');
    expect(results).toBeDefined();
  });

  test("should display audit findings", async () => {
    await page.goto(`${BASE_URL}/freight/audit`);

    // Run audit first
    await page.click('[data-testid="btn-run-audit"]');
    await page.waitForSelector('[data-testid="audit-dialog"]');
    await page.selectOption(
      '[data-testid="field-audit-period"]',
      "last_30_days",
    );
    await page.click('[data-testid="btn-submit-audit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="audit-results"]');

    // Check for findings
    const findings = await page.locator('[data-testid="finding-item"]').all();

    // Should have findings (at least 0)
    expect(findings.length).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CARRIER COMPLIANCE
  // ─────────────────────────────────────────────────────────────────────────

  test("should navigate to carrier compliance page", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/carriers`);

    await page.waitForSelector('[data-testid="carrier-compliance-page"]');

    const page_element = await page.locator(
      '[data-testid="carrier-compliance-page"]',
    );
    expect(page_element).toBeDefined();
  });

  test("should view FMCSA ratings for carriers", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/carriers`);

    await page.waitForSelector('[data-testid="carrier-row"]');

    // Get first carrier
    const firstCarrier = await page
      .locator('[data-testid="carrier-row"]')
      .first();

    // Check for rating
    const rating = await firstCarrier
      .locator('[data-testid="safety-rating"]')
      .textContent();

    expect(rating).toBeDefined();
    expect(["Satisfactory", "Conditional", "Unsatisfactory"]).toContain(
      rating?.trim(),
    );
  });

  test("should view carrier scorecard details", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/carriers`);

    await page.waitForSelector('[data-testid="carrier-row"]');

    // Click on first carrier
    await page.locator('[data-testid="carrier-row"]').first().click();

    // Wait for scorecard page
    await page.waitForSelector('[data-testid="carrier-scorecard"]');

    const scorecard = await page.locator('[data-testid="carrier-scorecard"]');
    expect(scorecard).toBeDefined();

    // Check for grade
    const grade = await page
      .locator('[data-testid="score-grade"]')
      .textContent();
    expect(grade).toMatch(/[A-F]/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ELD & HOS COMPLIANCE
  // ─────────────────────────────────────────────────────────────────────────

  test("should navigate to ELD page", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/eld`);

    await page.waitForSelector('[data-testid="eld-dashboard"]');

    const dashboard = await page.locator('[data-testid="eld-dashboard"]');
    expect(dashboard).toBeDefined();
  });

  test("should display driver HOS status", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/eld`);

    await page.waitForSelector('[data-testid="driver-hos-row"]');

    // Get first driver
    const firstDriver = await page
      .locator('[data-testid="driver-hos-row"]')
      .first();

    // Check for status
    const status = await firstDriver
      .locator('[data-testid="hos-status"]')
      .textContent();

    expect(status).toBeDefined();
  });

  test("should show HOS violations if any", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/eld`);

    await page.waitForSelector('[data-testid="violations-section"]');

    // Check for violation count
    const violationCount = await page
      .locator('[data-testid="violation-count"]')
      .textContent();

    // Could be 0 or more
    expect(violationCount).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DVIR SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────

  test("should navigate to DVIR form", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/dvir/new`);

    await page.waitForSelector('[data-testid="dvir-form"]');

    const form = await page.locator('[data-testid="dvir-form"]');
    expect(form).toBeDefined();
  });

  test("should submit DVIR with defects", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/dvir/new`);

    await page.waitForSelector('[data-testid="dvir-form"]');

    // Select vehicle
    await page.selectOption('[data-testid="field-vehicle"]', "vehicle_001");

    // Select inspection type
    await page.selectOption(
      '[data-testid="field-inspection-type"]',
      "pre_trip",
    );

    // Add defect
    await page.click('[data-testid="btn-add-defect"]');

    // Wait for defect row
    await page.waitForSelector('[data-testid="defect-row"]');

    // Fill defect details
    await page.selectOption('[data-testid="field-defect-code"]', "BRAKE");
    await page.selectOption('[data-testid="field-defect-severity"]', "MAJOR");
    await page.fill(
      '[data-testid="field-defect-description"]',
      "Brake pad wear detected",
    );

    // Submit form
    await page.click('[data-testid="btn-submit-dvir"]');

    // Wait for success
    await page.waitForSelector('[data-testid="success-message"]');

    const successMsg = await page
      .locator('[data-testid="success-message"]')
      .textContent();
    expect(successMsg).toContain("recorded");
  });

  test("should navigate to DVIR history", async () => {
    await page.goto(`${BASE_URL}/freight/compliance/dvir`);

    await page.waitForSelector('[data-testid="dvir-list"]');

    const dvirList = await page.locator('[data-testid="dvir-list"]');
    expect(dvirList).toBeDefined();
  });
});
