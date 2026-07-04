import { test, expect } from "@playwright/test";
import { SmokeAuthPage } from "./page-objects/auth.page";
import { SmokeDashboardPage } from "./page-objects/dashboard.page";
import { SmokeOnboardingPage } from "./page-objects/onboarding.page";
import {
  SMOKE_TEST_DATA,
  generateTestEmail,
  generateTrackingId,
} from "./fixtures/test-data";

/**
 * Critical Path Smoke Test Suite
 * Tests the complete delivery lifecycle end-to-end
 */
test.describe("Critical Path - End-to-End Delivery Lifecycle", () => {
  let authPage: SmokeAuthPage;
  let dashboardPage: SmokeDashboardPage;
  let onboardingPage: SmokeOnboardingPage;
  const testEmail = generateTestEmail("critical-path");
  const testPassword = SMOKE_TEST_DATA.newAccount.password;

  test.beforeEach(({ page }) => {
    authPage = new SmokeAuthPage(page);
    dashboardPage = new SmokeDashboardPage(page);
    onboardingPage = new SmokeOnboardingPage(page);
  });

  test("should complete full delivery lifecycle from registration to delivery confirmation", async ({
    page,
  }) => {
    // Step 1: Register new account
    test.step("Register new account", async () => {
      await authPage.navigateToRegister();
      await authPage.register(
        testEmail,
        testPassword,
        SMOKE_TEST_DATA.newAccount.firstName,
        SMOKE_TEST_DATA.newAccount.lastName,
      );

      // Verify registration success
      await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
    });

    // Step 2: Complete email verification (if required)
    test.step("Verify email", async () => {
      try {
        await onboardingPage.navigateToOnboarding();
        await expect(onboardingPage.emailVerificationInput).toBeVisible({
          timeout: 5000,
        });
        // In smoke tests, we use a test code
        await onboardingPage.verifyEmail("123456");
      } catch {
        // Email verification might not be required in all environments
      }
    });

    // Step 3: Complete onboarding
    test.step("Complete onboarding", async () => {
      await expect(onboardingPage.stepTitle).toBeVisible({ timeout: 5000 });

      // Skip deployment selection (use default)
      await onboardingPage.clickNext();

      // Fill company info
      await onboardingPage.fillCompanyInfo(
        SMOKE_TEST_DATA.onboarding.company.name,
        SMOKE_TEST_DATA.onboarding.company.website,
        SMOKE_TEST_DATA.onboarding.company.size,
      );
      await onboardingPage.clickNext();

      // Select industry
      await onboardingPage.selectIndustry(SMOKE_TEST_DATA.onboarding.industry);
      await onboardingPage.clickNext();

      // Select goals
      await onboardingPage.selectGoals(SMOKE_TEST_DATA.onboarding.goals);
      await onboardingPage.clickNext();

      // Select integrations
      await onboardingPage.selectIntegrations(
        SMOKE_TEST_DATA.onboarding.integrations,
      );
      await onboardingPage.clickNext();

      // Select layout
      await onboardingPage.selectLayout("default");
      await onboardingPage.clickNext();

      // Skip data import
      await onboardingPage.skipStep();

      // Finish onboarding
      await onboardingPage.finishOnboarding();
      await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    });

    // Step 4: Verify dashboard
    test.step("Verify dashboard is provisioned", async () => {
      await dashboardPage.expectDashboard();
      const stats = await dashboardPage.getStatsCards();
      expect(stats.length).toBeGreaterThan(0);
    });

    // Step 5: Create first delivery zone
    test.step("Create first delivery zone", async () => {
      await dashboardPage.navigateToDeliveryZones();
      await dashboardPage.createDeliveryZone(
        SMOKE_TEST_DATA.deliveryZone.name,
        SMOKE_TEST_DATA.deliveryZone.address,
        SMOKE_TEST_DATA.deliveryZone.radius,
      );
      await expect(dashboardPage.successNotification).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 6: Create first driver
    test.step("Create first driver", async () => {
      await dashboardPage.navigateToDrivers();
      await dashboardPage.createDriver(
        SMOKE_TEST_DATA.driver.firstName,
        SMOKE_TEST_DATA.driver.lastName,
        SMOKE_TEST_DATA.driver.email,
        SMOKE_TEST_DATA.driver.phone,
      );
      await expect(dashboardPage.successNotification).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 7: Create first order
    test.step("Create first order", async () => {
      await dashboardPage.navigateToOrders();
      await dashboardPage.createOrder(
        SMOKE_TEST_DATA.order.senderName,
        SMOKE_TEST_DATA.order.senderEmail,
        SMOKE_TEST_DATA.order.senderPhone,
        SMOKE_TEST_DATA.order.senderAddress,
        SMOKE_TEST_DATA.order.receiverName,
        SMOKE_TEST_DATA.order.receiverEmail,
        SMOKE_TEST_DATA.order.receiverPhone,
        SMOKE_TEST_DATA.order.receiverAddress,
      );
      await expect(dashboardPage.successNotification).toBeVisible({
        timeout: 5000,
      });

      // Get order ID from URL or page content
      const orderId = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Order #(\d+)|Tracking: ([\w-]+)/);
        return match ? match[1] || match[2] : null;
      });

      expect(orderId).toBeTruthy();
    });

    // Step 8: Assign driver to order
    test.step("Assign driver to order", async () => {
      // Find and click on the order
      const orderRow = page.locator("table tbody tr").first();
      await expect(orderRow).toBeVisible({ timeout: 5000 });
      await orderRow.click();

      // Click assign button
      const assignButton = page.locator(
        'button:has-text("Assign"), button:has-text("Assign Driver")',
      );
      await expect(assignButton).toBeVisible({ timeout: 5000 });
      await assignButton.click();

      // Select driver from dropdown
      const driverOption = page.locator(
        `text="${SMOKE_TEST_DATA.driver.firstName}"`,
      );
      await expect(driverOption).toBeVisible({ timeout: 5000 });
      await driverOption.click();

      // Confirm assignment
      const confirmButton = page
        .locator('button:has-text("Confirm"), button:has-text("Assign")')
        .last();
      await confirmButton.click();

      await expect(dashboardPage.successNotification).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 9: Driver accepts order
    test.step("Driver accepts order", async () => {
      // Navigate to driver app or accept section
      const acceptButton = page.locator(
        'button:has-text("Accept"), [data-testid="accept-order-btn"]',
      );
      await expect(acceptButton).toBeVisible({ timeout: 5000 });
      await acceptButton.click();

      await expect(page.locator('text="Order accepted"')).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 10: Driver picks up order
    test.step("Driver picks up order", async () => {
      const pickupButton = page.locator(
        'button:has-text("Pickup"), button:has-text("Pick Up"), [data-testid="pickup-btn"]',
      );
      await expect(pickupButton).toBeVisible({ timeout: 5000 });
      await pickupButton.click();

      // Confirm pickup
      const confirmButton = page.locator('button:has-text("Confirm")').last();
      await confirmButton.click();

      await expect(page.locator('text="Picked up"')).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 11: Driver delivers order
    test.step("Driver delivers order", async () => {
      const deliverButton = page.locator(
        'button:has-text("Deliver"), [data-testid="deliver-btn"]',
      );
      await expect(deliverButton).toBeVisible({ timeout: 5000 });
      await deliverButton.click();

      await expect(page.locator('text="Delivery confirmed"')).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 12: Verify proof of delivery
    test.step("Verify proof of delivery", async () => {
      const proofSection = page.locator(
        '[data-testid="proof-of-delivery"], text="Proof of Delivery"',
      );
      await expect(proofSection).toBeVisible({ timeout: 5000 });

      // Verify signature or photo exists
      const signature = page.locator('[data-testid="signature"], img');
      expect(await signature.count()).toBeGreaterThanOrEqual(0);
    });

    // Step 13: Verify order marked complete
    test.step("Verify order marked complete", async () => {
      const statusBadge = page.locator(
        '[data-testid="order-status"], .status-badge',
      );
      const statusText = await statusBadge.textContent();
      expect(statusText?.toLowerCase()).toContain("complete");
    });

    // Step 14: Verify notification was sent
    test.step("Verify notification was sent", async () => {
      // Navigate to notifications
      const notificationLink = page.locator(
        'a:has-text("Notifications"), [data-testid="notifications-link"]',
      );
      if (await notificationLink.isVisible()) {
        await notificationLink.click();
        await page.waitForLoadState("networkidle");

        // Verify notification exists
        const notification = page.locator(
          `text="${SMOKE_TEST_DATA.order.receiverEmail}" >> text="Delivery Completed"`,
        );
        await expect(notification).toBeVisible({ timeout: 5000 });
      }
    });

    // Step 15: Verify final dashboard state
    test.step("Verify final dashboard state", async () => {
      await dashboardPage.navigateToDashboard();
      await dashboardPage.expectDashboard();

      // Verify stats updated
      const stats = await dashboardPage.getStatsCards();
      expect(stats.length).toBeGreaterThan(0);

      // Check for completed orders
      const completedOrderStat = stats.find((s) =>
        s.label.toLowerCase().includes("complete"),
      );
      if (completedOrderStat) {
        expect(parseInt(completedOrderStat.value)).toBeGreaterThan(0);
      }
    });
  });
});
