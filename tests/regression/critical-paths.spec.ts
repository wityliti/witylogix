import { test, expect } from "@playwright/test";

/**
 * Critical Path Regression Tests
 * Tests complete end-to-end business workflows across core domains
 *
 * Covers:
 * - Order lifecycle: create → edit → assign → deliver → complete → archive
 * - Driver lifecycle: register → verify → activate → assign → complete → rate
 * - Delivery lifecycle: assign → pickup → transit → deliver → POD → confirm
 * - Payment flow: create invoice → send → pay → reconcile
 * - Integration lifecycle: install → configure → test → activate → usage → deactivate
 */

test.describe("Critical Paths - Business Workflows", () => {
  test.describe("@critical Order Lifecycle", () => {
    test("should complete full order lifecycle", async ({ page }) => {
      test.step("Setup: Login to admin account", async () => {
        await page.goto("/login");
        await page.fill(
          '[data-testid="email-input"]',
          process.env.ADMIN_EMAIL || "admin@test.com",
        );
        await page.fill(
          '[data-testid="password-input"]',
          process.env.ADMIN_PASSWORD || "TestPass123",
        );
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
      });

      let orderId: string;

      test.step("Create new order", async () => {
        await page.goto("/orders/new");
        await page.fill(
          '[data-testid="order-recipient-name"]',
          "John Delivery",
        );
        await page.fill('[data-testid="order-recipient-phone"]', "555-0100");
        await page.fill(
          '[data-testid="order-recipient-address"]',
          "123 Main St",
        );
        await page.fill(
          '[data-testid="order-items-description"]',
          "Test Package",
        );
        await page.fill('[data-testid="order-value"]', "99.99");
        await page.click('[data-testid="create-order-submit"]');

        const orderHeader = page.locator('[data-testid="order-id"]');
        const orderText = await orderHeader.textContent();
        orderId = orderText?.match(/ORD-(\d+)/)?.[1] || "unknown";

        await expect(page).toHaveURL(/\/orders\/\d+/, { timeout: 5000 });
        await expect(
          page.locator('[data-testid="order-status"]'),
        ).toContainText("Draft", { timeout: 5000 });
      });

      test.step("Edit order details", async () => {
        await page.click('[data-testid="edit-order-button"]');
        await page.fill('[data-testid="order-recipient-phone"]', "555-0101");
        await page.click('[data-testid="save-order-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Assign delivery driver", async () => {
        await page.click('[data-testid="assign-driver-button"]');
        await page.click('[data-testid="driver-select-dropdown"]');
        const firstDriver = page
          .locator('[data-testid="driver-option"]')
          .first();
        await firstDriver.click();
        await page.click('[data-testid="confirm-assignment-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.locator('[data-testid="order-status"]'),
        ).toContainText("Assigned", { timeout: 5000 });
      });

      test.step("Mark order as delivered", async () => {
        await page.click('[data-testid="mark-delivered-button"]');
        const podInput = page.locator('[data-testid="pod-signature-canvas"]');
        await expect(podInput).toBeVisible({ timeout: 5000 });
        await page.click('[data-testid="confirm-delivery-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.locator('[data-testid="order-status"]'),
        ).toContainText("Delivered", { timeout: 5000 });
      });

      test.step("Complete order", async () => {
        await page.click('[data-testid="complete-order-button"]');
        await page.click('[data-testid="confirm-completion-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.locator('[data-testid="order-status"]'),
        ).toContainText("Completed", { timeout: 5000 });
      });

      test.step("Archive order", async () => {
        await page.click('[data-testid="more-options-menu"]');
        await page.click('[data-testid="archive-order-option"]');
        await page.click('[data-testid="confirm-archive-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Cleanup", async () => {
        // Order is archived, no cleanup needed
      });
    });
  });

  test.describe("@critical Driver Lifecycle", () => {
    test("should complete full driver registration and activation", async ({
      page,
    }) => {
      const testEmail = `driver-${Date.now()}@test.com`;
      const testPhone = `555-${Math.floor(Math.random() * 9000) + 1000}`;

      test.step("Navigate to driver registration", async () => {
        await page.goto("/drivers/register");
        await expect(
          page.locator('[data-testid="registration-title"]'),
        ).toContainText("Register Driver", { timeout: 5000 });
      });

      test.step("Register driver account", async () => {
        await page.fill('[data-testid="driver-first-name"]', "Test");
        await page.fill('[data-testid="driver-last-name"]', "Driver");
        await page.fill('[data-testid="driver-email"]', testEmail);
        await page.fill('[data-testid="driver-phone"]', testPhone);
        await page.fill('[data-testid="driver-password"]', "DriverPass123");
        await page.click('[data-testid="agree-terms-checkbox"]');
        await page.click('[data-testid="register-driver-submit"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Verify email address", async () => {
        await expect(page).toHaveURL(/\/verify-email/, { timeout: 5000 });
        // In test environment, use test verification code
        await page.fill('[data-testid="verification-code"]', "123456");
        await page.click('[data-testid="verify-email-submit"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Activate driver account", async () => {
        await page.goto("/drivers/activate");
        await page.fill('[data-testid="license-number"]', "DL123456");
        await page.fill('[data-testid="license-state"]', "CA");
        await page.fill('[data-testid="license-expiry"]', "12/2025");
        await page.click('[data-testid="upload-license-button"]');
        await page.setInputFiles(
          '[data-testid="license-file-input"]',
          "tests/fixtures/license.pdf",
        );
        await page.click('[data-testid="submit-activation"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Assign delivery and complete", async () => {
        // Login as dispatcher to assign delivery
        await page.goto("/login");
        await page.fill(
          '[data-testid="email-input"]',
          process.env.ADMIN_EMAIL || "admin@test.com",
        );
        await page.fill(
          '[data-testid="password-input"]',
          process.env.ADMIN_PASSWORD || "TestPass123",
        );
        await page.click('[data-testid="login-button"]');

        // Navigate to driver assignment
        await page.goto("/deliveries/assign");
        await page.click('[data-testid="driver-select-dropdown"]');
        const driverOption = page.locator(
          `[data-testid="driver-option"]:has-text("Test Driver")`,
        );
        await driverOption.click();
        await page.click('[data-testid="confirm-assignment-button"]');

        // Complete delivery as driver
        await page.goto("/driver/deliveries");
        const deliveryCard = page
          .locator('[data-testid="delivery-card"]')
          .first();
        await deliveryCard.click();
        await page.click('[data-testid="start-delivery-button"]');
        await page.click('[data-testid="confirm-pickup-button"]');
        await page.click('[data-testid="mark-in-transit-button"]');
        await page.click('[data-testid="mark-delivered-button"]');
        await page.click('[data-testid="confirm-delivery-button"]');
      });

      test.step("Rate driver delivery", async () => {
        // Rate delivery as customer (if available)
        await page.goto("/orders");
        const orderCard = page.locator('[data-testid="order-card"]').first();
        await orderCard.click();
        await page.click('[data-testid="rate-delivery-button"]');
        await page.click('[data-testid="rating-5-stars"]');
        await page.fill(
          '[data-testid="rating-comment"]',
          "Great driver, on time!",
        );
        await page.click('[data-testid="submit-rating-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Cleanup", async () => {
        // Driver deactivation not needed for test cleanup
      });
    });
  });

  test.describe("@critical Delivery Lifecycle", () => {
    test("should complete full delivery workflow", async ({ page }) => {
      test.step("Setup: Login and navigate to delivery", async () => {
        await page.goto("/driver/login");
        await page.fill(
          '[data-testid="email-input"]',
          process.env.DRIVER_EMAIL || "driver@test.com",
        );
        await page.fill(
          '[data-testid="password-input"]',
          process.env.DRIVER_PASSWORD || "DriverPass123",
        );
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL("/driver/dashboard", { timeout: 10000 });
      });

      test.step("Assign delivery to self", async () => {
        await page.goto("/driver/available-deliveries");
        const firstDelivery = page
          .locator('[data-testid="delivery-card"]')
          .first();
        await firstDelivery.click();
        await page.click('[data-testid="accept-delivery-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Confirm pickup location", async () => {
        await page.goto("/driver/active-deliveries");
        const activeDelivery = page
          .locator('[data-testid="active-delivery-card"]')
          .first();
        await activeDelivery.click();
        await page.click('[data-testid="navigate-to-pickup-button"]');
        await page.click('[data-testid="confirm-at-location-button"]');
        await page.click('[data-testid="confirm-pickup-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Mark in transit", async () => {
        await page.click('[data-testid="mark-in-transit-button"]');
        await expect(
          page.locator('[data-testid="delivery-status"]'),
        ).toContainText("In Transit", { timeout: 5000 });
      });

      test.step("Navigate to delivery location", async () => {
        await page.click('[data-testid="navigate-to-delivery-button"]');
        await expect(page.locator('[data-testid="delivery-map"]')).toBeVisible({
          timeout: 5000,
        });
      });

      test.step("Confirm delivery and capture POD", async () => {
        await page.click('[data-testid="mark-delivered-button"]');
        await expect(
          page.locator('[data-testid="pod-signature-canvas"]'),
        ).toBeVisible({ timeout: 5000 });
        await page.click('[data-testid="confirm-delivery-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Confirm in system", async () => {
        // Wait for delivery status to update
        await page.waitForTimeout(2000);
        await expect(
          page.locator('[data-testid="delivery-status"]'),
        ).toContainText("Delivered", { timeout: 5000 });
      });

      test.step("Cleanup", async () => {
        // Delivery is completed, no cleanup needed
      });
    });
  });

  test.describe("@critical Payment Flow", () => {
    test("should complete payment and reconciliation", async ({ page }) => {
      test.step("Setup: Login to admin", async () => {
        await page.goto("/login");
        await page.fill(
          '[data-testid="email-input"]',
          process.env.ADMIN_EMAIL || "admin@test.com",
        );
        await page.fill(
          '[data-testid="password-input"]',
          process.env.ADMIN_PASSWORD || "TestPass123",
        );
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
      });

      let invoiceId: string;

      test.step("Create invoice", async () => {
        await page.goto("/billing/invoices");
        await page.click('[data-testid="create-invoice-button"]');
        await page.fill(
          '[data-testid="invoice-customer-select"]',
          "Test Customer",
        );
        await page.fill('[data-testid="invoice-amount"]', "1000.00");
        await page.fill(
          '[data-testid="invoice-description"]',
          "Delivery Services",
        );
        await page.fill('[data-testid="invoice-duedate"]', "2024-03-30");
        await page.click('[data-testid="create-invoice-submit"]');

        const invoiceHeader = page.locator('[data-testid="invoice-number"]');
        const invoiceText = await invoiceHeader.textContent();
        invoiceId = invoiceText?.match(/INV-(\d+)/)?.[1] || "unknown";

        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Send invoice to customer", async () => {
        await page.goto(`/billing/invoices/${invoiceId}`);
        await page.click('[data-testid="send-invoice-button"]');
        await page.fill(
          '[data-testid="invoice-email-recipient"]',
          "customer@test.com",
        );
        await page.click('[data-testid="send-invoice-submit"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Record payment", async () => {
        await page.click('[data-testid="record-payment-button"]');
        await page.fill('[data-testid="payment-amount"]', "1000.00");
        await page.click('[data-testid="payment-method-dropdown"]');
        await page.click('[data-testid="payment-method-bank-transfer"]');
        await page.fill('[data-testid="payment-reference"]', "BANK-TXN-12345");
        await page.click('[data-testid="record-payment-submit"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Reconcile payment", async () => {
        await page.goto("/billing/reconciliation");
        await page.click('[data-testid="reconcile-invoice-button"]');
        await page.click(`[data-testid="invoice-checkbox-${invoiceId}"]`);
        await page.click('[data-testid="confirm-reconciliation-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Verify invoice status", async () => {
        await page.goto(`/billing/invoices/${invoiceId}`);
        await expect(
          page.locator('[data-testid="invoice-status"]'),
        ).toContainText("Paid", { timeout: 5000 });
      });

      test.step("Cleanup", async () => {
        // Invoice is marked paid, no cleanup needed
      });
    });
  });

  test.describe("@critical Integration Lifecycle", () => {
    test("should complete full integration setup and activation", async ({
      page,
    }) => {
      test.step("Setup: Login to admin", async () => {
        await page.goto("/login");
        await page.fill(
          '[data-testid="email-input"]',
          process.env.ADMIN_EMAIL || "admin@test.com",
        );
        await page.fill(
          '[data-testid="password-input"]',
          process.env.ADMIN_PASSWORD || "TestPass123",
        );
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
      });

      test.step("Install integration", async () => {
        await page.goto("/integrations/marketplace");
        const integrationCard = page
          .locator('[data-testid="integration-card"]')
          .first();
        await integrationCard.click();
        await page.click('[data-testid="install-integration-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Configure integration", async () => {
        await page.goto("/integrations");
        const integrationRow = page
          .locator('[data-testid="integration-row"]')
          .first();
        await integrationRow.click();
        await page.click('[data-testid="configure-button"]');
        await page.fill('[data-testid="config-api-key"]', "test-api-key-12345");
        await page.fill(
          '[data-testid="config-api-secret"]',
          "test-api-secret-67890",
        );
        await page.click('[data-testid="save-config-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
      });

      test.step("Test connection", async () => {
        await page.click('[data-testid="test-connection-button"]');
        await expect(
          page.locator('[data-testid="connection-status"]'),
        ).toContainText("Connected", { timeout: 10000 });
      });

      test.step("Activate integration", async () => {
        await page.click('[data-testid="activate-integration-button"]');
        await page.click('[data-testid="confirm-activation-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.locator('[data-testid="integration-status"]'),
        ).toContainText("Active", { timeout: 5000 });
      });

      test.step("Verify usage and sync", async () => {
        await page.reload();
        await expect(
          page.locator('[data-testid="integration-status"]'),
        ).toContainText("Active", { timeout: 5000 });
        const usageStats = page.locator('[data-testid="usage-stats"]');
        await expect(usageStats).toBeVisible({ timeout: 5000 });
      });

      test.step("Deactivate integration", async () => {
        await page.click('[data-testid="more-options-menu"]');
        await page.click('[data-testid="deactivate-option"]');
        await page.click('[data-testid="confirm-deactivation-button"]');
        await expect(
          page.locator('[data-testid="success-message"]'),
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.locator('[data-testid="integration-status"]'),
        ).toContainText("Inactive", { timeout: 5000 });
      });

      test.step("Cleanup", async () => {
        // Integration is deactivated, cleanup complete
      });
    });
  });
});
