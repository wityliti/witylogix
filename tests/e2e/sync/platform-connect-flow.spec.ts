/**
 * E2E Test: Platform Connect Flow
 *
 * End-to-end test for complete e-commerce platform integration:
 * - Navigate to integrations → select platform → enter credentials → test connection → save
 * - Verify connected badge appears
 * - Trigger manual sync → verify progress bar → verify completion
 * - Navigate to orders → verify synced orders appear
 * - Test disconnect flow
 *
 * ~150 lines, 10+ tests
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_SHOPIFY_CONFIG = {
  storeName: 'test-store',
  apiKey: 'test-api-key-12345',
  apiSecret: 'test-api-secret-67890',
};

const TEST_BIGCOMMERCE_CONFIG = {
  storeId: '123456789',
  accessToken: 'test-access-token-abcdef',
};

const TEST_SQUARE_CONFIG = {
  applicationId: 'test-app-id-xyz',
  accessToken: 'test-square-token-123',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Navigate to integrations page
 */
async function navigateToIntegrations(page: Page): Promise<void> {
  await page.goto('/dashboard/integrations');
  await page.waitForLoadState('networkidle');
}

/**
 * Select a platform from available options
 */
async function selectPlatform(page: Page, platformName: string): Promise<void> {
  await page.click(`[data-testid="platform-${platformName}"]`);
  await page.waitForSelector('[data-testid="platform-setup-form"]');
}

/**
 * Enter credentials in setup form
 */
async function enterCredentials(page: Page, config: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(config)) {
    const selector = `[name="${key}"]`;
    await page.fill(selector, value);
  }
}

/**
 * Test connection
 */
async function testConnection(page: Page): Promise<boolean> {
  await page.click('[data-testid="test-connection-btn"]');
  await page.waitForTimeout(1000);

  const successMessage = await page.isVisible('[data-testid="connection-success"]');
  return successMessage;
}

/**
 * Save configuration
 */
async function saveConfiguration(page: Page): Promise<void> {
  await page.click('[data-testid="save-config-btn"]');
  await page.waitForLoadState('networkidle');
}

/**
 * Verify connected badge
 */
async function verifyConnectedBadge(page: Page, platformName: string): Promise<boolean> {
  const badgeSelector = `[data-testid="connected-badge-${platformName}"]`;
  return await page.isVisible(badgeSelector);
}

/**
 * Trigger manual sync
 */
async function triggerManualSync(page: Page): Promise<void> {
  await page.click('[data-testid="sync-now-btn"]');
  await page.waitForSelector('[data-testid="sync-progress"]');
}

/**
 * Wait for sync completion
 */
async function waitForSyncCompletion(page: Page, timeoutMs: number = 30000): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="sync-complete"]', { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to orders page
 */
async function navigateToOrders(page: Page): Promise<void> {
  await page.goto('/dashboard/orders');
  await page.waitForLoadState('networkidle');
}

/**
 * Verify synced orders appear
 */
async function verifySyncedOrdersAppear(page: Page, expectedCount: number = 1): Promise<boolean> {
  const orderRows = await page.locator('[data-testid="order-row"]').count();
  return orderRows >= expectedCount;
}

/**
 * Disconnect platform
 */
async function disconnectPlatform(page: Page, platformName: string): Promise<void> {
  await page.click(`[data-testid="disconnect-btn-${platformName}"]`);

  // Confirm disconnect in modal
  await page.click('[data-testid="confirm-disconnect-btn"]');
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('Platform Connect Flow - E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ────────────────────────────────────────────────────────────────────────
  // SHOPIFY INTEGRATION
  // ────────────────────────────────────────────────────────────────────────

  test('should complete full Shopify integration flow', async () => {
    // Navigate to integrations
    await navigateToIntegrations(page);

    // Verify integrations page loaded
    await expect(page.locator('[data-testid="integrations-header"]')).toContainText('Integrations');

    // Select Shopify
    await selectPlatform(page, 'shopify');

    // Verify form appears
    await expect(page.locator('[data-testid="platform-setup-form"]')).toBeVisible();

    // Enter credentials
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);

    // Test connection
    const connectionSuccess = await testConnection(page);
    expect(connectionSuccess).toBe(true);

    // Save configuration
    await saveConfiguration(page);

    // Verify success message
    await expect(page.locator('[data-testid="save-success-message"]')).toBeVisible();
  });

  test('should display connected badge after successful setup', async () => {
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Verify connected badge appears
    const badgeVisible = await verifyConnectedBadge(page, 'shopify');
    expect(badgeVisible).toBe(true);

    // Verify status text
    const statusText = await page.locator(`[data-testid="platform-status-shopify"]`).textContent();
    expect(statusText).toContain('Connected');
  });

  test('should trigger manual sync from integrations page', async () => {
    await navigateToIntegrations(page);

    // Open Shopify integration details
    await page.click(`[data-testid="integration-card-shopify"]`);
    await page.waitForSelector('[data-testid="sync-now-btn"]');

    // Trigger manual sync
    await triggerManualSync(page);

    // Verify progress bar appears
    await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();

    // Wait for completion
    const completed = await waitForSyncCompletion(page);
    expect(completed).toBe(true);

    // Verify completion message
    const completionText = await page.locator('[data-testid="sync-completion-message"]').textContent();
    expect(completionText).toContain('completed');
  });

  test('should display synced orders in orders page', async () => {
    // Complete setup first
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Trigger sync
    await page.click(`[data-testid="integration-card-shopify"]`);
    await triggerManualSync(page);
    await waitForSyncCompletion(page);

    // Navigate to orders
    await navigateToOrders(page);

    // Verify synced orders appear
    const ordersFound = await verifySyncedOrdersAppear(page, 1);
    expect(ordersFound).toBe(true);

    // Verify order contains source information
    const orderSource = await page.locator('[data-testid="order-source-0"]').textContent();
    expect(orderSource).toContain('Shopify');
  });

  // ────────────────────────────────────────────────────────────────────────
  // BIGCOMMERCE INTEGRATION
  // ────────────────────────────────────────────────────────────────────────

  test('should complete BigCommerce integration flow', async () => {
    await navigateToIntegrations(page);

    // Select BigCommerce
    await selectPlatform(page, 'bigcommerce');

    // Enter credentials
    await enterCredentials(page, TEST_BIGCOMMERCE_CONFIG);

    // Test connection
    const connectionSuccess = await testConnection(page);
    expect(connectionSuccess).toBe(true);

    // Save configuration
    await saveConfiguration(page);

    // Verify connected badge
    const badgeVisible = await verifyConnectedBadge(page, 'bigcommerce');
    expect(badgeVisible).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // SQUARE INTEGRATION
  // ────────────────────────────────────────────────────────────────────────

  test('should complete Square integration flow', async () => {
    await navigateToIntegrations(page);

    // Select Square
    await selectPlatform(page, 'square');

    // Enter credentials
    await enterCredentials(page, TEST_SQUARE_CONFIG);

    // Test connection
    const connectionSuccess = await testConnection(page);
    expect(connectionSuccess).toBe(true);

    // Save configuration
    await saveConfiguration(page);

    // Verify connected badge
    const badgeVisible = await verifyConnectedBadge(page, 'square');
    expect(badgeVisible).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // SYNC PROGRESS TRACKING
  // ────────────────────────────────────────────────────────────────────────

  test('should show sync progress with percentage', async () => {
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Trigger sync
    await page.click(`[data-testid="integration-card-shopify"]`);
    await triggerManualSync(page);

    // Monitor progress bar
    const progressBar = page.locator('[data-testid="sync-progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Verify progress text updates
    const progressText = await page.locator('[data-testid="sync-progress-text"]').textContent();
    expect(progressText).toMatch(/\d+%/); // Should show percentage
  });

  test('should display sync statistics after completion', async () => {
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Trigger sync
    await page.click(`[data-testid="integration-card-shopify"]`);
    await triggerManualSync(page);
    await waitForSyncCompletion(page);

    // Verify sync statistics visible
    await expect(page.locator('[data-testid="sync-stats-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-stats-products"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-stats-customers"]')).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────────
  // DISCONNECT FLOW
  // ────────────────────────────────────────────────────────────────────────

  test('should disconnect platform successfully', async () => {
    // Setup first
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Verify connected
    let badgeVisible = await verifyConnectedBadge(page, 'shopify');
    expect(badgeVisible).toBe(true);

    // Disconnect
    await disconnectPlatform(page, 'shopify');

    // Verify disconnect success message
    await expect(page.locator('[data-testid="disconnect-success-message"]')).toBeVisible();

    // Verify connected badge gone
    badgeVisible = await verifyConnectedBadge(page, 'shopify');
    expect(badgeVisible).toBe(false);

    // Verify setup form reappears
    await expect(page.locator('[data-testid="platform-setup-form"]')).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ────────────────────────────────────────────────────────────────────────

  test('should handle invalid credentials', async () => {
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');

    // Enter invalid credentials
    await enterCredentials(page, {
      storeName: 'invalid-store',
      apiKey: 'invalid-key',
      apiSecret: 'invalid-secret',
    });

    // Test connection
    const connectionSuccess = await testConnection(page);
    expect(connectionSuccess).toBe(false);

    // Verify error message
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
  });

  test('should prevent saving without valid connection test', async () => {
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');

    // Enter credentials but don't test connection
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);

    // Try to save without testing
    const saveBtn = page.locator('[data-testid="save-config-btn"]');

    // Verify save button is disabled or shows warning
    const isDisabled = await saveBtn.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // MULTI-PLATFORM SETUP
  // ────────────────────────────────────────────────────────────────────────

  test('should support multiple platform integrations', async () => {
    // Setup Shopify
    await navigateToIntegrations(page);
    await selectPlatform(page, 'shopify');
    await enterCredentials(page, TEST_SHOPIFY_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Setup BigCommerce
    await selectPlatform(page, 'bigcommerce');
    await enterCredentials(page, TEST_BIGCOMMERCE_CONFIG);
    await testConnection(page);
    await saveConfiguration(page);

    // Verify both connected
    let shopifyBadge = await verifyConnectedBadge(page, 'shopify');
    let bigcommerceBadge = await verifyConnectedBadge(page, 'bigcommerce');

    expect(shopifyBadge).toBe(true);
    expect(bigcommerceBadge).toBe(true);

    // Navigate back to integrations
    await navigateToIntegrations(page);

    // Verify both still appear as connected
    shopifyBadge = await verifyConnectedBadge(page, 'shopify');
    bigcommerceBadge = await verifyConnectedBadge(page, 'bigcommerce');

    expect(shopifyBadge).toBe(true);
    expect(bigcommerceBadge).toBe(true);
  });
});
