import { Page, Locator, expect } from '@playwright/test';

export interface DriverData {
  name: string;
  email: string;
  phone: string;
  vehicle?: string;
  licensePlate?: string;
}

/**
 * Drivers Page Object Model
 * Encapsulates driver management interactions
 */
export class DriversPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly driverRows: Locator;
  readonly driverTable: Locator;
  readonly searchInput: Locator;
  readonly availabilityFilter: Locator;
  readonly statusBadges: Locator;
  readonly loadingSpinner: Locator;
  readonly assignDriverButton: Locator;
  readonly modal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.driverRows = page.locator('tbody tr, [data-testid="driver-row"], [role="row"]');
    this.driverTable = page.locator('table, [data-testid="drivers-table"], [role="grid"]');
    this.searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="Driver"]');
    this.availabilityFilter = page.locator('select, [data-testid="availability-filter"]');
    this.statusBadges = page.locator('[data-testid="status-badge"], .status-badge, [role="status"]');
    this.loadingSpinner = page.locator('[data-testid="loading"], .spinner');
    this.assignDriverButton = page.locator('button:has-text("Assign"), [data-testid="assign-btn"]');
    this.modal = page.locator('[role="dialog"], .modal');
  }

  /**
   * Navigate to drivers page
   */
  async navigateToList(): Promise<void> {
    await this.page.goto('/dashboard/drivers', { waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    try {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // Spinner might not exist
    }
  }

  /**
   * Get driver row by name
   */
  async getDriverByName(name: string): Promise<Locator> {
    return this.driverRows.filter({ hasText: name }).first();
  }

  /**
   * Click driver row to open details
   */
  async openDriverDetails(name: string): Promise<void> {
    const driverRow = await this.getDriverByName(name);
    await driverRow.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get driver status
   */
  async getDriverStatus(name: string): Promise<string> {
    const driverRow = await this.getDriverByName(name);
    const statusElement = driverRow.locator('[data-testid="status"], .status, [role="status"]');
    const status = await statusElement.textContent();
    return status?.trim() || '';
  }

  /**
   * Update driver status
   */
  async updateDriverStatus(name: string, newStatus: string): Promise<void> {
    await this.openDriverDetails(name);

    // Find and click status button/dropdown
    await this.page.click('button:has-text("Change Status"), [data-testid="status-dropdown"]');

    // Select new status
    await this.page.click(`[data-value="${newStatus}"], button:has-text("${newStatus}")`);

    await this.waitForPageLoad();
  }

  /**
   * Assign driver to shipment
   */
  async assignDriver(driverName: string, orderId?: string): Promise<void> {
    const driverRow = await this.getDriverByName(driverName);

    // Find assign button in the row
    const assignBtn = driverRow.locator('button:has-text("Assign")');
    await assignBtn.click();

    // If modal appears, fill in order ID if needed
    try {
      await this.modal.waitFor({ state: 'visible', timeout: 5000 });

      if (orderId) {
        const orderInput = this.modal.locator('input[placeholder*="Order"], input[name*="order"]');
        await orderInput.fill(orderId);
      }

      const confirmBtn = this.modal.locator('button:has-text("Confirm"), button[type="submit"]');
      await confirmBtn.click();
    } catch {
      // No modal, assignment complete
    }

    await this.waitForPageLoad();
  }

  /**
   * Filter drivers by availability
   */
  async filterByAvailability(availability: string): Promise<void> {
    await this.availabilityFilter.selectOption(availability);
    await this.waitForPageLoad();
  }

  /**
   * Search for driver
   */
  async searchDriver(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
  }

  /**
   * Get all drivers
   */
  async getAllDrivers(): Promise<{ name: string; status: string }[]> {
    const drivers: { name: string; status: string }[] = [];
    const count = await this.driverRows.count();

    for (let i = 0; i < count; i++) {
      const row = this.driverRows.nth(i);
      const name = await row.locator('td, [data-testid="driver-name"]').first().textContent();
      const status = await row.locator('[data-testid="status"], .status').textContent();

      if (name) {
        drivers.push({
          name: name.trim(),
          status: status?.trim() || '',
        });
      }
    }

    return drivers;
  }

  /**
   * Get driver count
   */
  async getDriverCount(): Promise<number> {
    return await this.driverRows.count();
  }

  /**
   * Verify drivers page is displayed
   */
  async expectDriversPage(): Promise<void> {
    await expect(this.pageTitle).toContainText('Drivers');
    await expect(this.driverTable).toBeVisible();
  }

  /**
   * Verify driver exists
   */
  async expectDriverExists(name: string): Promise<void> {
    const driverRow = await this.getDriverByName(name);
    await expect(driverRow).toBeVisible();
  }

  /**
   * Verify driver status
   */
  async expectDriverStatus(name: string, expectedStatus: string): Promise<void> {
    const status = await this.getDriverStatus(name);
    if (!status.includes(expectedStatus)) {
      throw new Error(`Expected driver status to contain "${expectedStatus}", got "${status}"`);
    }
  }
}
