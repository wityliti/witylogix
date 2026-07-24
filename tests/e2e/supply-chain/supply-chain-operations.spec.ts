/**
 * E2E: Supply Chain Operations — Playwright Integration Tests
 *
 * End-to-end test suite for supply chain workflows
 * - Navigate to supply chain module
 * - Check inventory levels
 * - Create and process orders
 * - Manage fulfillment waves
 * - Verify shipment tracking
 *
 * ~150 lines, 8 tests
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Supply Chain Operations", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/");

    // Login if required
    const loginButton = await page.$('[data-testid="login-button"]');
    if (loginButton) {
      await loginButton.click();
      await page.fill('[data-testid="email-input"]', "admin@test.com");
      await page.fill('[data-testid="password-input"]', "admin123");
      await page.click('[data-testid="submit-button"]');
      await page.waitForNavigation();
    }
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("should navigate to supply chain module", async () => {
    // Click supply chain menu
    await page.click('[data-testid="menu-supply-chain"]');
    await page.waitForURL(/.*supply-chain.*/);

    // Verify dashboard loaded
    const dashboard = await page.$('[data-testid="supply-chain-dashboard"]');
    expect(dashboard).toBeTruthy();

    const heading = await page.$('[data-testid="dashboard-heading"]');
    const text = await heading?.textContent();
    expect(text).toContain("Supply Chain");
  });

  test("should view inventory levels", async () => {
    // Navigate to inventory section
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="inventory-tab"]');
    await page.waitForURL(/.*inventory.*/);

    // Verify inventory table loaded
    const inventoryTable = await page.$('[data-testid="inventory-table"]');
    expect(inventoryTable).toBeTruthy();

    // Check SKU columns
    const skuColumn = await page.$('[data-testid="column-sku"]');
    expect(skuColumn).toBeTruthy();

    // Check quantity column
    const qtyColumn = await page.$('[data-testid="column-quantity"]');
    expect(qtyColumn).toBeTruthy();

    // Verify rows populated
    const rows = await page.locator('[data-testid="inventory-row"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("should search and filter inventory", async () => {
    // Navigate to inventory
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="inventory-tab"]');

    // Search for SKU
    const searchInput = await page.$('[data-testid="inventory-search"]');
    expect(searchInput).toBeTruthy();

    await searchInput?.fill("SKU001");
    await page.keyboard.press("Enter");

    // Verify results filtered
    const rows = await page.locator('[data-testid="inventory-row"]');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      const firstRow = rows.first();
      const skuText = await firstRow
        .locator('[data-testid="sku-cell"]')
        .textContent();
      expect(skuText).toContain("SKU001");
    }
  });

  test("should create purchase order", async () => {
    // Navigate to orders
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="orders-tab"]');

    // Click create PO
    const createButton = await page.$('[data-testid="create-po-button"]');
    expect(createButton).toBeTruthy();

    await createButton?.click();
    await page.waitForURL(/.*order.*create.*/);

    // Fill order details
    await page.fill('[data-testid="supplier-select"]', "Supplier A");
    await page.fill('[data-testid="sku-input"]', "SKU001");
    await page.fill('[data-testid="quantity-input"]', "100");

    // Add line item
    await page.click('[data-testid="add-line-button"]');

    // Save order
    await page.click('[data-testid="save-order-button"]');

    // Verify created
    const successMessage = await page.$('[data-testid="success-message"]');
    expect(successMessage).toBeTruthy();
  });

  test("should process fulfillment wave", async () => {
    // Navigate to fulfillment
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="fulfillment-tab"]');

    // Click create wave
    const createWaveButton = await page.$('[data-testid="create-wave-button"]');
    expect(createWaveButton).toBeTruthy();

    await createWaveButton?.click();
    await page.waitForURL(/.*wave.*create.*/);

    // Select warehouse
    await page.fill('[data-testid="warehouse-select"]', "WH_NYC");

    // Add orders to wave
    const orderCheckboxes = await page.locator(
      '[data-testid="order-checkbox"]',
    );
    const checkboxCount = await orderCheckboxes.count();

    if (checkboxCount > 0) {
      await orderCheckboxes.first().click();
    }

    // Create wave
    await page.click('[data-testid="create-wave-submit"]');

    // Verify wave created
    await page.waitForNavigation();
    const waveDetail = await page.$('[data-testid="wave-detail"]');
    expect(waveDetail).toBeTruthy();
  });

  test("should view fulfillment status", async () => {
    // Navigate to fulfillment
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="fulfillment-tab"]');

    // Find wave
    const waveRow = await page.locator('[data-testid="wave-row"]').first();
    expect(waveRow).toBeTruthy();

    // Click wave to view details
    await waveRow.click();
    await page.waitForNavigation();

    // Verify status display
    const status = await page.$('[data-testid="wave-status"]');
    expect(status).toBeTruthy();

    // Check orders in wave
    const ordersList = await page.$('[data-testid="orders-in-wave"]');
    expect(ordersList).toBeTruthy();

    const orders = await page.locator('[data-testid="order-item"]');
    const orderCount = await orders.count();
    expect(orderCount).toBeGreaterThan(0);
  });

  test("should track shipments", async () => {
    // Navigate to shipments
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="shipments-tab"]');

    // Verify shipments table loaded
    const shipmentsTable = await page.$('[data-testid="shipments-table"]');
    expect(shipmentsTable).toBeTruthy();

    // Find shipped order
    const shipmentRow = await page
      .locator('[data-testid="shipment-row"]')
      .first();
    if (shipmentRow) {
      // Click to view tracking
      await shipmentRow.click();
      await page.waitForNavigation();

      // Verify tracking details
      const trackingInfo = await page.$('[data-testid="tracking-info"]');
      expect(trackingInfo).toBeTruthy();

      // Check status
      const status = await page.$('[data-testid="shipment-status"]');
      expect(status).toBeTruthy();

      // Verify carrier
      const carrier = await page.$('[data-testid="carrier-info"]');
      expect(carrier).toBeTruthy();
    }
  });

  test("should view demand forecast", async () => {
    // Navigate to demand planning
    await page.click('[data-testid="menu-supply-chain"]');
    await page.click('[data-testid="demand-planning-tab"]');

    // Verify forecast dashboard loaded
    const forecastDash = await page.$('[data-testid="forecast-dashboard"]');
    expect(forecastDash).toBeTruthy();

    // Check forecast chart
    const chart = await page.$('[data-testid="forecast-chart"]');
    expect(chart).toBeTruthy();

    // View forecast details
    const forecastItems = await page.locator('[data-testid="forecast-item"]');
    const itemCount = await forecastItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Click first forecast
    if (itemCount > 0) {
      await forecastItems.first().click();

      // Verify forecast details shown
      const details = await page.$('[data-testid="forecast-details"]');
      expect(details).toBeTruthy();

      // Check reorder point
      const reorderPoint = await page.$('[data-testid="reorder-point"]');
      expect(reorderPoint).toBeTruthy();

      // Check safety stock
      const safetyStock = await page.$('[data-testid="safety-stock"]');
      expect(safetyStock).toBeTruthy();
    }
  });
});
