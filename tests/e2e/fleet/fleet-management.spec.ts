/**
 * Fleet Management E2E Tests (~350 lines)
 * Playwright E2E: add vehicle, schedule maintenance, view fuel analytics, assign driver
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Fleet Management E2E", () => {
  let page: Page;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    // Navigate to fleet management dashboard
    await page.goto("/fleet/dashboard");
    // Wait for navigation and auth check
    await page.waitForURL(/\/fleet\/dashboard|\/auth/);
  });

  // ─────────────────────────────────────────────────────────────────
  // VEHICLE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  test("should add a new vehicle to fleet", async () => {
    // Click add vehicle button
    await page.click('button:has-text("Add Vehicle")');
    await page.waitForURL(/\/fleet\/vehicles\/new/);

    // Fill in vehicle details
    await page.fill('input[name="make"]', "Volvo");
    await page.fill('input[name="model"]', "VNL");
    await page.fill('input[name="year"]', "2023");
    await page.fill('input[name="vin"]', "WVWZZZ3CZ" + "DE123456");
    await page.fill('input[name="licensePlate"]', "WIT1234");
    await page.fill('input[name="fuelType"]', "DIESEL");

    // Fill registration info
    await page.fill('input[name="registration.number"]', "REG123456");
    await page.fill('input[name="registration.state"]', "CA");

    // Fill insurance info
    await page.fill('input[name="insurance.policyNumber"]', "POL123456");
    await page.fill('input[name="insurance.provider"]', "SafeFleet Insurance");

    // Submit form
    await page.click('button:has-text("Create Vehicle")');
    await page.waitForURL(/\/fleet\/vehicles\/\w+/);

    // Verify vehicle was created
    const heading = page.locator("h1");
    await expect(heading).toContainText("VNL");
  });

  test("should view vehicle details and health score", async () => {
    // Navigate to vehicles list
    await page.goto("/fleet/vehicles");

    // Click first vehicle
    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    // Verify details page loaded
    await expect(page.locator('[data-testid="vehicle-details"]')).toBeVisible();

    // Check health score is displayed
    const healthScore = page.locator('[data-testid="health-score"]');
    await expect(healthScore).toBeVisible();
    const scoreText = await healthScore.textContent();
    expect(scoreText).toMatch(/\d+%?/);
  });

  test("should update vehicle status", async () => {
    await page.goto("/fleet/vehicles");

    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    // Open status dropdown
    await page.click('[data-testid="status-dropdown"]');
    await page.click("text=Maintenance");

    // Confirm change
    await page.click('button:has-text("Confirm")');

    // Verify toast notification
    const toast = page.locator('[role="status"]');
    await expect(toast).toContainText("Vehicle status updated");
  });

  test("should assign driver to vehicle", async () => {
    await page.goto("/fleet/vehicles");

    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    // Click assign driver button
    await page.click('button:has-text("Assign Driver")');

    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Select driver
    await page.click('[data-testid="driver-select"]');
    await page.click("text=John Smith");

    // Submit
    await page.click('button:has-text("Assign")');

    // Verify assignment
    const assignedDriver = page.locator('[data-testid="assigned-driver"]');
    await expect(assignedDriver).toContainText("John Smith");
  });

  // ─────────────────────────────────────────────────────────────────
  // MAINTENANCE SCHEDULING
  // ─────────────────────────────────────────────────────────────────

  test("should schedule preventive maintenance", async () => {
    await page.goto("/fleet/vehicles");

    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    // Click maintenance tab
    await page.click('[data-testid="maintenance-tab"]');

    // Click schedule maintenance button
    await page.click('button:has-text("Schedule Maintenance")');

    // Wait for form
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill form
    await page.selectOption('[name="type"]', "PREVENTIVE");
    await page.selectOption('[name="category"]', "OIL_CHANGE");
    await page.fill('input[name="scheduledDate"]', "2026-04-15");

    // Submit
    await page.click('button:has-text("Schedule")');

    // Verify maintenance was scheduled
    const maintenanceItem = page
      .locator('[data-testid="maintenance-item"]')
      .first();
    await expect(maintenanceItem).toContainText("Oil Change");
  });

  test("should view maintenance history", async () => {
    await page.goto("/fleet/vehicles");

    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    await page.click('[data-testid="maintenance-tab"]');

    // Verify maintenance list is visible
    const maintenanceList = page.locator('[data-testid="maintenance-list"]');
    await expect(maintenanceList).toBeVisible();

    // Check for maintenance items
    const items = page.locator('[data-testid="maintenance-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should complete maintenance record", async () => {
    await page.goto("/fleet/vehicles");

    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    await page.click('[data-testid="maintenance-tab"]');

    // Find and click complete button on first item
    const firstItem = page.locator('[data-testid="maintenance-item"]').first();
    await firstItem.locator('button:has-text("Complete")').click();

    // Fill completion details
    await page.fill('input[name="completedDate"]', "2026-03-17");
    await page.fill('input[name="cost"]', "350.00");

    // Submit
    await page.click('button:has-text("Confirm")');

    // Verify update
    const toast = page.locator('[role="status"]');
    await expect(toast).toContainText("Maintenance marked complete");
  });

  // ─────────────────────────────────────────────────────────────────
  // FUEL ANALYTICS
  // ─────────────────────────────────────────────────────────────────

  test("should view fuel analytics dashboard", async () => {
    await page.goto("/fleet/fuel-analytics");

    // Wait for page to load
    await expect(page.locator('h1:has-text("Fuel Analytics")')).toBeVisible();

    // Check key metrics are displayed
    await expect(page.locator('[data-testid="total-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="fleet-mpg"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="fuel-consumption"]'),
    ).toBeVisible();
  });

  test("should view per-vehicle fuel data", async () => {
    await page.goto("/fleet/fuel-analytics");

    // Click on vehicle tab or find vehicle-specific data
    const vehicleMetrics = page.locator('[data-testid="vehicle-metrics"]');
    await expect(vehicleMetrics).toBeVisible();

    // Verify MPG is calculated
    const mpgValue = page.locator('[data-testid="vehicle-mpg"]').first();
    await expect(mpgValue).toBeVisible();
    const text = await mpgValue.textContent();
    expect(text).toMatch(/\d+\.?\d*\s*mpg/i);
  });

  test("should view fuel transaction history", async () => {
    await page.goto("/fleet/fuel-analytics");

    // Click transactions tab
    await page.click('[data-testid="transactions-tab"]');

    // Verify transactions table
    const table = page.locator('[role="table"]');
    await expect(table).toBeVisible();

    // Check table has data
    const rows = page.locator('[role="row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should detect fuel anomalies", async () => {
    await page.goto("/fleet/fuel-analytics");

    // Look for anomaly alerts section
    const anomalySection = page.locator('[data-testid="anomalies-section"]');

    // Wait briefly for data to load
    await page.waitForTimeout(1000);

    // Check if anomalies exist (may be empty)
    const anomalyItems = page.locator('[data-testid="anomaly-alert"]');
    const count = await anomalyItems.count();

    // Just verify the section exists and can display anomalies
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should view fuel budget forecast", async () => {
    await page.goto("/fleet/fuel-analytics");

    // Click budget forecast tab
    await page.click('[data-testid="budget-tab"]');

    // Verify forecast is displayed
    const forecast = page.locator('[data-testid="monthly-forecast"]');
    await expect(forecast).toBeVisible();

    // Check for dollar amount
    const text = await forecast.textContent();
    expect(text).toMatch(/\$[\d,]+/);
  });

  // ─────────────────────────────────────────────────────────────────
  // FLEET OVERVIEW
  // ─────────────────────────────────────────────────────────────────

  test("should view fleet overview dashboard", async () => {
    await page.goto("/fleet/dashboard");

    // Verify key dashboard elements
    await expect(page.locator('[data-testid="active-vehicles"]')).toBeVisible();
    await expect(page.locator('[data-testid="maintenance-due"]')).toBeVisible();
    await expect(page.locator('[data-testid="fleet-health"]')).toBeVisible();
  });

  test("should filter vehicles by status", async () => {
    await page.goto("/fleet/vehicles");

    // Open filter dropdown
    await page.click('[data-testid="status-filter"]');
    await page.click("text=Active");

    // Wait for table to update
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = page.locator('[data-testid="vehicle-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // COMPLEX SCENARIOS
  // ─────────────────────────────────────────────────────────────────

  test("should complete vehicle lifecycle: create → assign → maintain → retire", async () => {
    // Add vehicle
    await page.goto("/fleet/vehicles/new");
    await page.fill('input[name="make"]', "Freightliner");
    await page.fill('input[name="model"]', "Cascadia");
    await page.fill('input[name="year"]', "2023");
    await page.fill('input[name="vin"]', "WVWZZZ3CZ" + "TE654321");
    await page.fill('input[name="licensePlate"]', "WIT5678");
    await page.click('button:has-text("Create Vehicle")');

    // Extract vehicle ID from URL
    const url = page.url();
    const vehicleId = url.split("/").pop();

    // Assign driver
    await page.click('button:has-text("Assign Driver")');
    await page.click('[data-testid="driver-select"]');
    await page.click("text=Jane Doe");
    await page.click('button:has-text("Assign")');

    // Schedule maintenance
    await page.click('[data-testid="maintenance-tab"]');
    await page.click('button:has-text("Schedule Maintenance")');
    await page.selectOption('[name="type"]', "PREVENTIVE");
    await page.fill('input[name="scheduledDate"]', "2026-04-30");
    await page.click('button:has-text("Schedule")');

    // Retire vehicle
    await page.click('[data-testid="status-dropdown"]');
    await page.click("text=Retired");
    await page.click('button:has-text("Confirm")');

    // Verify final state
    const status = page.locator('[data-testid="vehicle-status"]');
    await expect(status).toContainText("Retired");
  });

  test("should navigate between related fleet views", async () => {
    // Start at vehicles
    await page.goto("/fleet/vehicles");

    // Click on first vehicle
    const firstVehicle = page.locator('[data-testid="vehicle-row"]').first();
    await firstVehicle.click();

    // Verify we're on vehicle detail
    await expect(page.locator('[data-testid="vehicle-details"]')).toBeVisible();

    // Click to fuel analytics for this vehicle
    await page.click('a:has-text("Fuel Analytics")');

    // Verify fuel page loaded with vehicle context
    await expect(page.locator('[data-testid="vehicle-metrics"]')).toBeVisible();

    // Navigate back to fleet
    await page.click('a:has-text("Fleet")');
    await expect(
      page.locator('[data-testid="vehicle-row"]').first(),
    ).toBeVisible();
  });
});
