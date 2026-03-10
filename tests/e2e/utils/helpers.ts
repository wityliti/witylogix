import { Page, expect } from '@playwright/test';

/**
 * Utility helper functions for E2E tests
 */

/**
 * Generate a unique tracking ID for testing
 */
export function generateTrackingId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRK-${timestamp}-${random}`;
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@test.com`;
}

/**
 * Wait for element to be in viewport
 */
export async function waitForElementInViewport(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<void> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await expect(element).toBeInViewport({ timeout });
}

/**
 * Click with retry on failure
 */
export async function clickWithRetry(page: Page, selector: string, maxRetries: number = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const element = page.locator(selector);
      await element.click({ force: true });
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Fill input with clear and paste
 */
export async function fillInputField(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector);
  await input.click();
  await input.fill('');
  await input.type(value);
}

/**
 * Get table data as array of objects
 */
export async function getTableData(
  page: Page,
  tableSelector: string,
  headerSelector: string,
  rowSelector: string,
): Promise<Record<string, string>[]> {
  // Get headers
  const headers = await page.locator(headerSelector).allTextContents();

  // Get rows
  const rows: Record<string, string>[] = [];
  const rowLocators = page.locator(rowSelector);
  const rowCount = await rowLocators.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rowLocators.nth(i);
    const cells = await row.locator('td').allTextContents();

    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header.trim()] = cells[index]?.trim() || '';
    });

    rows.push(rowData);
  }

  return rows;
}

/**
 * Handle modal confirmation
 */
export async function confirmModal(page: Page, confirmText: string = 'Confirm', timeout: number = 5000): Promise<void> {
  const confirmButton = page.locator(`button:has-text("${confirmText}")`);
  await expect(confirmButton).toBeVisible({ timeout });
  await confirmButton.click();
}

/**
 * Handle error messages
 */
export async function getErrorMessage(page: Page, timeout: number = 5000): Promise<string | null> {
  try {
    const errorElement = page.locator('[data-testid="error-message"], [role="alert"], .error');
    await expect(errorElement).toBeVisible({ timeout });
    return await errorElement.textContent();
  } catch {
    return null;
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: `tests/e2e/screenshots/${filename}` });
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Check if element is disabled
 */
export async function isElementDisabled(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  return await element.isDisabled();
}

/**
 * Get all text from element
 */
export async function getElementText(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector);
  const text = await element.textContent();
  return text?.trim() || '';
}

/**
 * Check if text exists on page
 */
export async function textExists(page: Page, text: string): Promise<boolean> {
  try {
    const element = page.locator(`text=${text}`);
    return await element.count().then((count) => count > 0);
  } catch {
    return false;
  }
}

/**
 * Wait for text to appear
 */
export async function waitForText(page: Page, text: string, timeout: number = 5000): Promise<void> {
  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout });
}

/**
 * Get all elements matching selector
 */
export async function getElements(page: Page, selector: string): Promise<number> {
  return await page.locator(selector).count();
}

/**
 * Format date for testing
 */
export function formatTestDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate random phone number
 */
export function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${lineNumber}`;
}

/**
 * Generate random address
 */
export function generateAddress(): string {
  const streets = ['Main', 'Oak', 'Elm', 'Pine', 'Maple', 'Cedar'];
  const types = ['St', 'Ave', 'Rd', 'Blvd', 'Lane', 'Drive'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];

  const streetNum = Math.floor(Math.random() * 999) + 1;
  const street = streets[Math.floor(Math.random() * streets.length)];
  const type = types[Math.floor(Math.random() * types.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const zip = Math.floor(Math.random() * 90000) + 10000;

  return `${streetNum} ${street} ${type}, ${city}, ${state} ${zip}`;
}
