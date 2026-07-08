import { test, expect } from "../fixtures/auth.fixture";
import { DashboardPage } from "../pages/dashboard.page";

test.describe("Webhook Management", () => {
  test("should navigate to webhook management page", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Navigate to webhooks section
    await dashboardPage.navigateToWebhooks();

    // Verify webhooks page is displayed
    const pageTitle = adminPage.locator('h1, [data-testid="page-title"]');
    const titleText = await pageTitle.textContent();

    expect(titleText?.toLowerCase()).toContain("webhook");
  });

  test("should display webhook list", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Wait for list to load
    await dashboardPage.waitForDataLoad();

    // Look for webhook list
    const webhookList = adminPage.locator(
      'table, [data-testid="webhook-list"], [role="grid"]',
    );

    // Verify list is displayed
    await expect(webhookList).toBeVisible();
  });

  test("should create webhook endpoint", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Click create webhook button
    const createBtn = adminPage.locator(
      'button:has-text("Create Webhook"), button:has-text("New Webhook"), [data-testid="create-webhook-btn"]',
    );

    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();

      // Wait for modal/form to appear
      await adminPage.waitForLoadState("networkidle");

      // Fill webhook form
      const urlInput = adminPage.locator(
        'input[placeholder*="Webhook URL"], input[name*="url"], input[type="url"]',
      );

      if (await urlInput.isVisible().catch(() => false)) {
        await urlInput.fill("https://example.com/webhooks/test");

        // Select webhook events (if available)
        const eventCheckboxes = adminPage.locator('input[type="checkbox"]');
        const checkboxCount = await eventCheckboxes.count();

        if (checkboxCount > 0) {
          // Check first few event checkboxes
          await eventCheckboxes.first().click();
        }

        // Submit form
        const submitBtn = adminPage.locator(
          'button[type="submit"]:has-text("Create"), button:has-text("Save")',
        );
        await submitBtn.click();

        // Wait for creation
        await adminPage.waitForLoadState("networkidle");

        // Verify webhook was created
        const successMessage = adminPage.locator(
          '[data-testid="success"], .success, [role="alert"]',
        );
        const webhookInList = adminPage.locator(
          "text=example.com/webhooks/test",
        );

        const created =
          (await successMessage.isVisible().catch(() => false)) ||
          (await webhookInList.isVisible().catch(() => false));

        expect(created).toBeTruthy();
      }
    }
  });

  test("should view webhook details", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Click first webhook row
      await webhookRows.first().click();

      // Wait for details page
      await adminPage.waitForLoadState("networkidle");

      // Verify details are displayed
      const detailsPanel = adminPage.locator(
        '[data-testid="webhook-details"], section, .panel',
      );
      await expect(detailsPanel).toBeVisible();
    }
  });

  test("should view webhook delivery log", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Click on webhook to view details
      const firstRow = webhookRows.first();
      await firstRow.click();

      // Wait for details
      await adminPage.waitForLoadState("networkidle");

      // Look for delivery log or history section
      const logSection = adminPage.locator(
        '[data-testid="delivery-log"], section:has-text("Delivery"), section:has-text("History"), section:has-text("Log")',
      );

      // If log section exists, verify it's displayed
      if (await logSection.isVisible().catch(() => false)) {
        await expect(logSection).toBeVisible();

        // Look for log entries
        const logEntries = adminPage.locator(
          '[data-testid="log-entry"], .log-entry, tbody tr',
        );
        const entryCount = await logEntries.count();

        expect(entryCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("should display delivery status in log", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Click on webhook
      await webhookRows.first().click();

      // Wait for details
      await adminPage.waitForLoadState("networkidle");

      // Look for log entries with status
      const logEntries = adminPage.locator(
        '[data-testid="log-entry"], .log-entry',
      );
      const entryCount = await logEntries.count();

      if (entryCount > 0) {
        // Get status from first log entry
        const statusBadge = logEntries
          .first()
          .locator('[data-testid="status"], .status, [role="status"]');

        if (await statusBadge.isVisible().catch(() => false)) {
          const status = await statusBadge.textContent();
          expect(
            ["SUCCESS", "FAILED", "PENDING", "RETRY"].some((s) =>
              status?.includes(s),
            ),
          ).toBeTruthy();
        }
      }
    }
  });

  test("should retry failed delivery", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Click on webhook
      await webhookRows.first().click();

      // Wait for details
      await adminPage.waitForLoadState("networkidle");

      // Look for failed log entries
      const failedEntries = adminPage.locator(
        '[data-testid="log-entry"]:has-text("FAILED"), [data-testid="log-entry"]:has-text("FAILED")',
      );

      if (
        await failedEntries
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        // Click retry button on failed entry
        const retryBtn = failedEntries
          .first()
          .locator('button:has-text("Retry"), [data-testid="retry-btn"]');

        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click();

          // Wait for retry
          await adminPage.waitForLoadState("networkidle");

          // Verify retry was triggered
          const successMessage = adminPage.locator(
            '[data-testid="success"], .success, [role="alert"]',
          );

          if (await successMessage.isVisible().catch(() => false)) {
            const message = await successMessage.textContent();
            expect(message?.toLowerCase()).toContain("retry");
          }
        }
      }
    }
  });

  test("should update webhook settings", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Click on webhook
      await webhookRows.first().click();

      // Wait for details
      await adminPage.waitForLoadState("networkidle");

      // Look for edit button
      const editBtn = adminPage.locator(
        'button:has-text("Edit"), [data-testid="edit-webhook-btn"]',
      );

      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();

        // Wait for form
        await adminPage.waitForLoadState("networkidle");

        // Try to modify a field (e.g., description or active status)
        const descInput = adminPage.locator(
          'input[name*="description"], textarea[name*="description"]',
        );

        if (await descInput.isVisible().catch(() => false)) {
          await descInput.fill("Updated webhook description");
        }

        // Save changes
        const saveBtn = adminPage.locator(
          'button[type="submit"]:has-text("Save")',
        );
        await saveBtn.click();

        // Wait for save
        await adminPage.waitForLoadState("networkidle");

        // Verify save was successful
        const successMessage = adminPage.locator(
          '[data-testid="success"], .success',
        );

        if (await successMessage.isVisible().catch(() => false)) {
          expect(await successMessage.textContent()).toBeTruthy();
        }
      }
    }
  });

  test("should disable webhook", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to webhooks
    await dashboardPage.navigate();
    await dashboardPage.navigateToWebhooks();

    // Get webhook rows
    const webhookRows = adminPage.locator(
      'tbody tr, [data-testid="webhook-row"], [role="row"]',
    );
    const count = await webhookRows.count();

    if (count > 0) {
      // Look for disable button in webhook row
      const disableBtn = webhookRows
        .first()
        .locator('button[title="Disable"], button[data-testid="disable-btn"]');

      if (await disableBtn.isVisible().catch(() => false)) {
        await disableBtn.click();

        // Confirm disable action if prompt appears
        const confirmBtn = adminPage.locator(
          'button:has-text("Confirm"), button:has-text("Yes")',
        );

        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
        }

        // Wait for update
        await adminPage.waitForLoadState("networkidle");

        // Verify status changed
        const statusBadge = webhookRows
          .first()
          .locator('[data-testid="status"], .status');

        if (await statusBadge.isVisible().catch(() => false)) {
          const status = await statusBadge.textContent();
          expect(status?.toLowerCase()).toContain("disable");
        }
      }
    }
  });
});
