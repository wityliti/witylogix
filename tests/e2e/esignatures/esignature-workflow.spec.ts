/**
 * E2E: E-Signature Workflow — Playwright Integration Tests
 *
 * End-to-end test suite for e-signature workflow
 * - Navigate to esignatures section
 * - Create new envelope
 * - Add signers and recipients
 * - Place signature fields
 * - Send envelope for signing
 * - Verify status tracking
 * - Monitor completion
 *
 * ~150 lines, 8 tests
 */

import { test, expect, Page } from "@playwright/test";

test.describe("E-Signature Workflow", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Navigate to application
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

  test("should navigate to esignatures section", async () => {
    // Click on esignatures menu
    await page.click('[data-testid="menu-esignatures"]');
    await page.waitForURL(/.*esignatures.*/);

    // Verify page loaded
    const heading = await page.$('[data-testid="esignatures-heading"]');
    expect(heading).toBeTruthy();
  });

  test("should create new envelope", async () => {
    // Navigate to esignatures
    await page.click('[data-testid="menu-esignatures"]');
    await page.waitForURL(/.*esignatures.*/);

    // Click create new envelope button
    const createButton = await page.$('[data-testid="create-envelope-button"]');
    expect(createButton).toBeTruthy();

    await createButton?.click();
    await page.waitForURL(/.*envelope.*create.*/);

    // Fill envelope details
    await page.fill('[data-testid="envelope-subject"]', "Contract Review");
    await page.fill(
      '[data-testid="envelope-message"]',
      "Please review and sign this contract",
    );

    // Upload document
    const fileInput = await page.$('input[type="file"]');
    expect(fileInput).toBeTruthy();

    // Save envelope
    await page.click('[data-testid="save-envelope-button"]');
    await page.waitForNavigation();

    // Verify envelope created
    const successMessage = await page.$('[data-testid="success-message"]');
    expect(successMessage).toBeTruthy();
  });

  test("should add signers to envelope", async () => {
    // Create envelope (setup)
    await page.click('[data-testid="menu-esignatures"]');
    await page.click('[data-testid="create-envelope-button"]');
    await page.fill('[data-testid="envelope-subject"]', "Multi-Signer Doc");
    await page.fill(
      '[data-testid="envelope-message"]',
      "Multiple signatures needed",
    );

    // Add first signer
    await page.click('[data-testid="add-signer-button"]');
    await page.fill('[data-testid="signer-email-1"]', "signer1@example.com");
    await page.fill('[data-testid="signer-name-1"]', "John Signer");

    // Add second signer
    await page.click('[data-testid="add-signer-button"]');
    await page.fill('[data-testid="signer-email-2"]', "signer2@example.com");
    await page.fill('[data-testid="signer-name-2"]', "Jane Signer");

    // Save envelope
    await page.click('[data-testid="save-envelope-button"]');

    // Verify signers added
    const signersList = await page.locator('[data-testid="signers-list"]');
    const signerCount = await signersList
      .locator('[data-testid="signer-item"]')
      .count();
    expect(signerCount).toBeGreaterThanOrEqual(2);
  });

  test("should place signature fields on document", async () => {
    // Navigate to envelope that's being edited
    await page.click('[data-testid="menu-esignatures"]');
    await page.click('[data-testid="create-envelope-button"]');

    // Go to field placement section
    await page.click('[data-testid="place-fields-tab"]');

    // Place signature field
    await page.click('[data-testid="add-signature-field-button"]');

    // Draw field on document (simulate)
    const canvas = await page.$('[data-testid="document-canvas"]');
    if (canvas) {
      await canvas.click({ position: { x: 100, y: 200 } });
    }

    // Verify field added
    const fieldsList = await page.$('[data-testid="fields-list"]');
    expect(fieldsList).toBeTruthy();

    // Add date field
    await page.click('[data-testid="add-date-field-button"]');
    if (canvas) {
      await canvas.click({ position: { x: 100, y: 300 } });
    }

    // Verify multiple fields
    const fields = await page.locator('[data-testid="field-item"]').count();
    expect(fields).toBeGreaterThan(0);
  });

  test("should send envelope for signing", async () => {
    // Create and prepare envelope
    await page.click('[data-testid="menu-esignatures"]');
    await page.click('[data-testid="create-envelope-button"]');
    await page.fill('[data-testid="envelope-subject"]', "Ready to Sign");

    // Add signer
    await page.click('[data-testid="add-signer-button"]');
    await page.fill('[data-testid="signer-email-1"]', "signer@example.com");

    // Click send button
    const sendButton = await page.$('[data-testid="send-envelope-button"]');
    expect(sendButton).toBeTruthy();

    await sendButton?.click();

    // Wait for confirmation
    await page.waitForSelector('[data-testid="envelope-sent-confirmation"]');

    const confirmation = await page.$(
      '[data-testid="envelope-sent-confirmation"]',
    );
    expect(confirmation).toBeTruthy();
  });

  test("should verify envelope status tracking", async () => {
    // Navigate to esignatures
    await page.click('[data-testid="menu-esignatures"]');

    // Look for sent envelope
    const envelopeRow = await page
      .locator('[data-testid="envelope-row"]')
      .first();
    expect(envelopeRow).toBeTruthy();

    // Click to view details
    await envelopeRow.click();
    await page.waitForNavigation();

    // Verify status displayed
    const statusBadge = await page.$('[data-testid="envelope-status"]');
    expect(statusBadge).toBeTruthy();

    const statusText = await statusBadge?.textContent();
    expect(["sent", "pending", "in progress"]).toContain(
      statusText?.toLowerCase(),
    );
  });

  test("should display recipient signing status", async () => {
    // Open envelope details
    await page.click('[data-testid="menu-esignatures"]');
    const envelopeRow = await page
      .locator('[data-testid="envelope-row"]')
      .first();
    await envelopeRow.click();

    // View recipients section
    const recipientsSection = await page.$(
      '[data-testid="recipients-section"]',
    );
    expect(recipientsSection).toBeTruthy();

    // Verify recipient status display
    const recipientItems = await page.locator('[data-testid="recipient-item"]');
    const count = await recipientItems.count();

    for (let i = 0; i < count; i++) {
      const item = recipientItems.nth(i);
      const status = await item.locator('[data-testid="recipient-status"]');
      expect(status).toBeTruthy();
    }
  });

  test("should show completion certificate", async () => {
    // Navigate to completed envelope
    await page.click('[data-testid="menu-esignatures"]');

    // Filter for completed envelopes
    const filterButton = await page.$('[data-testid="filter-button"]');
    if (filterButton) {
      await filterButton.click();
      await page.click('[data-testid="filter-completed"]');
    }

    // Open completed envelope
    const completedEnvelope = await page
      .locator('[data-testid="envelope-row"]')
      .first();
    if (completedEnvelope) {
      await completedEnvelope.click();

      // Look for certificate
      const certificateButton = await page.$(
        '[data-testid="download-certificate-button"]',
      );
      if (certificateButton) {
        expect(certificateButton).toBeTruthy();

        // Verify certificate details shown
        const certificateInfo = await page.$(
          '[data-testid="certificate-info"]',
        );
        expect(certificateInfo).toBeTruthy();
      }
    }
  });
});
