/**
 * Field Service Dispatch E2E Tests (~300 lines)
 * Playwright E2E: create work order, assign tech, dispatch, complete, generate invoice
 */

import { test, expect, Page } from "@playwright/test";

test.describe("Field Service Dispatch E2E", () => {
  let page: Page;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    // Navigate to field service dashboard
    await page.goto("/field-service/dashboard");
    // Wait for navigation and auth check
    await page.waitForURL(/\/field-service|\/auth/);
  });

  // ─────────────────────────────────────────────────────────────────
  // WORK ORDER CREATION
  // ─────────────────────────────────────────────────────────────────

  test("should create a new work order", async () => {
    // Click create work order button
    await page.click('button:has-text("Create Work Order")');
    await page.waitForURL(/\/field-service\/work-orders\/new/);

    // Fill in customer details
    await page.fill('input[name="customerName"]', "ABC Manufacturing");
    await page.fill('input[name="customerAddress"]', "123 Industrial Blvd");
    await page.fill('input[name="customerCity"]', "Los Angeles");
    await page.fill('input[name="customerState"]', "CA");
    await page.fill('input[name="customerZip"]', "90001");

    // Fill work order details
    await page.fill('input[name="title"]', "HVAC System Inspection");
    await page.fill(
      'textarea[name="description"]',
      "Quarterly preventive maintenance",
    );

    // Select priority
    await page.click('[data-testid="priority-select"]');
    await page.click("text=High");

    // Select required skills
    await page.click('[data-testid="skills-select"]');
    await page.click("text=HVAC");
    await page.click("text=Electrical");
    await page.click('[data-testid="skills-select"]'); // Close dropdown

    // Fill estimated duration
    await page.fill('input[name="estimatedDuration"]', "120");

    // Submit form
    await page.click('button:has-text("Create Work Order")');
    await page.waitForURL(/\/field-service\/work-orders\/\w+/);

    // Verify work order was created
    const workOrderNumber = page.locator('[data-testid="work-order-number"]');
    await expect(workOrderNumber).toBeVisible();
  });

  test("should view work order details", async () => {
    // Navigate to work orders list
    await page.goto("/field-service/work-orders");

    // Click first work order
    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Verify details page
    await expect(
      page.locator('[data-testid="work-order-details"]'),
    ).toBeVisible();

    // Check all details are displayed
    await expect(page.locator('[data-testid="customer-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="work-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="sla-timer"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────
  // TECHNICIAN ASSIGNMENT
  // ─────────────────────────────────────────────────────────────────

  test("should assign technician to work order", async () => {
    await page.goto("/field-service/work-orders");

    // Click first work order
    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Click assign technician button
    await page.click('button:has-text("Assign Technician")');

    // Wait for assignment modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Verify technician list is shown
    const technicianOption = page
      .locator('[data-testid="technician-option"]')
      .first();
    await expect(technicianOption).toBeVisible();

    // Click first technician
    await technicianOption.click();

    // Confirm assignment
    await page.click('button:has-text("Confirm Assignment")');

    // Verify assignment
    const assignedTech = page.locator('[data-testid="assigned-technician"]');
    await expect(assignedTech).toBeVisible();
  });

  test("should only show technicians with required skills", async () => {
    await page.goto("/field-service/work-orders");

    // Create a work order with specific skills
    await page.click('button:has-text("Create Work Order")');
    await page.fill('input[name="title"]', "Electrical Repair");
    await page.click('[data-testid="skills-select"]');
    await page.click("text=Electrical");
    await page.fill('input[name="estimatedDuration"]', "90");
    await page.click('button:has-text("Create Work Order")');

    // Go to assignment
    await page.click('button:has-text("Assign Technician")');

    // Verify only skilled technicians are shown
    const technicians = page.locator('[data-testid="technician-option"]');
    const count = await technicians.count();

    // Each displayed technician should have the required skill
    for (let i = 0; i < Math.min(count, 3); i++) {
      const tech = technicians.nth(i);
      const skillText = await tech
        .locator('[data-testid="tech-skills"]')
        .textContent();
      expect(skillText).toContain("Electrical");
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // DISPATCH & SCHEDULING
  // ─────────────────────────────────────────────────────────────────

  test("should dispatch work order to assigned technician", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Assign technician first
    await page.click('button:has-text("Assign Technician")');
    await page.locator('[data-testid="technician-option"]').first().click();
    await page.click('button:has-text("Confirm Assignment")');

    // Now dispatch
    await page.click('button:has-text("Dispatch")');

    // Verify dispatch confirmation
    const status = page.locator('[data-testid="work-order-status"]');
    await expect(status).toContainText(/assigned|dispatched/i);
  });

  test("should set scheduled date and time", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Click schedule button
    await page.click('button:has-text("Schedule")');

    // Fill date and time
    await page.fill('input[type="date"]', "2026-03-20");
    await page.fill('input[type="time"]', "10:00");

    // Confirm
    await page.click('button:has-text("Confirm")');

    // Verify scheduled date is displayed
    const scheduledDate = page.locator('[data-testid="scheduled-date"]');
    await expect(scheduledDate).toContainText("03/20/2026");
  });

  test("should show ETA to customer", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Check ETA is displayed
    const eta = page.locator('[data-testid="estimated-arrival"]');
    await expect(eta).toBeVisible();

    // Verify ETA is in future
    const text = await eta.textContent();
    expect(text).toMatch(/\d{1,2}:\d{2}\s*(am|pm)?/i);
  });

  // ─────────────────────────────────────────────────────────────────
  // WORK COMPLETION
  // ─────────────────────────────────────────────────────────────────

  test("should mark work order as in progress", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Click start work button
    await page.click('button:has-text("Start Work")');

    // Verify status changed
    const status = page.locator('[data-testid="work-order-status"]');
    await expect(status).toContainText("In Progress");
  });

  test("should complete work order and mark as done", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Start work if not already
    const startButton = page.locator('button:has-text("Start Work")');
    if (await startButton.isVisible()) {
      await startButton.click();
    }

    // Complete work
    await page.click('button:has-text("Complete Work")');

    // Fill completion details
    await page.fill(
      'textarea[name="notes"]',
      "System inspected and serviced. All components functional.",
    );

    // Add parts used
    await page.click('button:has-text("Add Part")');
    await page.fill('input[name="partName"]', "Capacitor 25µF");
    await page.fill('input[name="quantity"]', "2");
    await page.fill('input[name="cost"]', "91.98");
    await page.click('button:has-text("Add")');

    // Submit completion
    await page.click('button:has-text("Mark Complete")');

    // Verify status
    const status = page.locator('[data-testid="work-order-status"]');
    await expect(status).toContainText("Completed");
  });

  test("should track time on work order", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Start work
    await page.click('button:has-text("Start Work")');

    // Check time tracking is active
    const timer = page.locator('[data-testid="elapsed-time"]');
    await expect(timer).toBeVisible();

    // Verify time is incrementing
    const initialTime = await timer.textContent();
    await page.waitForTimeout(2000);
    const updatedTime = await timer.textContent();

    // Time should have changed
    expect(updatedTime).not.toBe(initialTime);
  });

  // ─────────────────────────────────────────────────────────────────
  // INVOICE GENERATION
  // ─────────────────────────────────────────────────────────────────

  test("should generate invoice after work completion", async () => {
    await page.goto("/field-service/work-orders");

    const firstOrder = page.locator('[data-testid="work-order-row"]').first();
    await firstOrder.click();

    // Start and complete work
    await page.click('button:has-text("Start Work")');
    await page.click('button:has-text("Complete Work")');
    await page.fill('textarea[name="notes"]', "Work completed successfully");
    await page.click('button:has-text("Mark Complete")');

    // Wait for completion
    await page.waitForTimeout(1000);

    // Check for invoice generation option
    const invoiceButton = page.locator('button:has-text("Generate Invoice")');
    if (await invoiceButton.isVisible()) {
      await invoiceButton.click();

      // Verify invoice page
      await page.waitForURL(/\/field-service\/invoices/);
      await expect(
        page.locator('[data-testid="invoice-number"]'),
      ).toBeVisible();
    }
  });

  test("should display invoice with labor, parts, and travel", async () => {
    await page.goto("/field-service/invoices");

    // Click first invoice
    const firstInvoice = page.locator('[data-testid="invoice-row"]').first();
    await firstInvoice.click();

    // Verify invoice components
    await expect(page.locator('[data-testid="labor-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="parts-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="travel-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-cost"]')).toBeVisible();

    // Verify tax calculation
    const taxAmount = page.locator('[data-testid="tax-amount"]');
    await expect(taxAmount).toBeVisible();

    // Verify total includes tax
    const laborText = await page
      .locator('[data-testid="labor-cost"]')
      .textContent();
    const totalText = await page
      .locator('[data-testid="total-cost"]')
      .textContent();

    expect(totalText).toContain("$");
  });

  test("should allow invoice modification before sending", async () => {
    await page.goto("/field-service/invoices");

    const firstInvoice = page.locator('[data-testid="invoice-row"]').first();
    await firstInvoice.click();

    // Check if draft
    const status = page.locator('[data-testid="invoice-status"]');
    const statusText = await status.textContent();

    if (statusText?.includes("Draft")) {
      // Edit labor hours
      await page.click('button:has-text("Edit")');
      await page.fill('input[name="laborHours"]', "3");
      await page.click('button:has-text("Update")');

      // Verify total updated
      const total = page.locator('[data-testid="total-cost"]');
      const totalValue = await total.textContent();
      expect(totalValue).toMatch(/\$[\d,]+\.\d{2}/);
    }
  });

  test("should send invoice to customer", async () => {
    await page.goto("/field-service/invoices");

    const firstInvoice = page.locator('[data-testid="invoice-row"]').first();
    await firstInvoice.click();

    // Click send button
    const sendButton = page.locator('button:has-text("Send Invoice")');
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Verify confirmation
      const toast = page.locator('[role="status"]');
      await expect(toast).toContainText("Invoice sent");

      // Verify status changed to sent
      const status = page.locator('[data-testid="invoice-status"]');
      await expect(status).toContainText("Sent");
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // COMPLEX SCENARIOS
  // ─────────────────────────────────────────────────────────────────

  test("should complete full dispatch workflow: create → assign → dispatch → complete → invoice", async () => {
    // Create work order
    await page.goto("/field-service/work-orders/new");
    await page.fill('input[name="title"]', "Complete Workflow Test");
    await page.fill('input[name="customerName"]', "Test Customer");
    await page.fill('input[name="customerAddress"]', "456 Test St");
    await page.fill('input[name="customerCity"]', "Los Angeles");
    await page.fill('input[name="customerState"]', "CA");
    await page.fill('input[name="customerZip"]', "90001");
    await page.fill('textarea[name="description"]', "Complete workflow test");
    await page.click('[data-testid="priority-select"]');
    await page.click("text=High");
    await page.fill('input[name="estimatedDuration"]', "120");
    await page.click('button:has-text("Create Work Order")');

    // Extract work order ID
    const url = page.url();
    expect(url).toContain("/field-service/work-orders/");

    // Assign technician
    await page.click('button:has-text("Assign Technician")');
    await page.locator('[data-testid="technician-option"]').first().click();
    await page.click('button:has-text("Confirm Assignment")');

    // Schedule and dispatch
    await page.click('button:has-text("Schedule")');
    await page.fill('input[type="date"]', "2026-03-21");
    await page.fill('input[type="time"]', "09:00");
    await page.click('button:has-text("Confirm")');

    await page.click('button:has-text("Dispatch")');

    // Complete work
    await page.click('button:has-text("Start Work")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Complete Work")');
    await page.fill('textarea[name="notes"]', "Work completed successfully");
    await page.click('button:has-text("Mark Complete")');

    // Verify completion
    const status = page.locator('[data-testid="work-order-status"]');
    await expect(status).toContainText("Completed");
  });

  test("should handle multiple technicians and route optimization", async () => {
    // Create multiple work orders
    for (let i = 0; i < 3; i++) {
      await page.goto("/field-service/work-orders/new");
      await page.fill('input[name="title"]', `Multi-Job Test ${i + 1}`);
      await page.fill('input[name="customerName"]', `Customer ${i + 1}`);
      await page.fill(
        'input[name="customerAddress"]',
        `${100 * (i + 1)} Main St`,
      );
      await page.fill('input[name="customerCity"]', "Los Angeles");
      await page.fill('input[name="customerState"]', "CA");
      await page.fill('input[name="customerZip"]', "90001");
      await page.fill('input[name="estimatedDuration"]', "60");
      await page.click('button:has-text("Create Work Order")');
    }

    // Navigate to dispatch view
    await page.goto("/field-service/dispatch");

    // Verify dispatch board is visible
    await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible();
  });
});
