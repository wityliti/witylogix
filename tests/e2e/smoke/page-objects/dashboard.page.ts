import { Page, Locator, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model for Smoke Tests
 * Handles dashboard navigation and delivery operations
 */
export class SmokeDashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly mainContent: Locator;
  readonly pageTitle: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly deliveryZoneButton: Locator;
  readonly driversButton: Locator;
  readonly ordersButton: Locator;
  readonly createButton: Locator;
  readonly statsCards: Locator;
  readonly loadingSpinner: Locator;
  readonly successNotification: Locator;
  readonly errorNotification: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], nav, aside');
    this.mainContent = page.locator('main, [data-testid="main-content"]');
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-menu"]');
    this.logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    this.deliveryZoneButton = page.locator('button:has-text("Add Zone"), button:has-text("New Zone"), [data-testid="add-zone-btn"]');
    this.driversButton = page.locator('button:has-text("Add Driver"), button:has-text("New Driver"), [data-testid="add-driver-btn"]');
    this.ordersButton = page.locator('button:has-text("Create Order"), button:has-text("New Order"), [data-testid="create-order-btn"]');
    this.createButton = page.locator('button:has-text("Create"), button:has-text("Add"), [data-testid*="create"]');
    this.statsCards = page.locator('[data-testid="stats-card"], .card, [data-testid="metric"]');
    this.loadingSpinner = page.locator('[data-testid="loading"], .spinner, [role="progressbar"]');
    this.successNotification = page.locator('[data-testid="success-notification"], .toast-success, [role="status"]');
    this.errorNotification = page.locator('[data-testid="error-notification"], .toast-error, [role="alert"]');
  }

  /**
   * Navigate to dashboard
   */
  async navigateToDashboard(): Promise<void> {
    await this.page.goto('/dashboard', { waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    await expect(this.sidebar).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for success notification
   */
  async waitForSuccessNotification(): Promise<void> {
    await expect(this.successNotification).toBeVisible({ timeout: 5000 });
  }

  /**
   * Navigate to delivery zones
   */
  async navigateToDeliveryZones(): Promise<void> {
    const link = this.page.locator('[data-testid="sidebar"] a:has-text("Zones"), nav a:has-text("Zones")');
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to drivers
   */
  async navigateToDrivers(): Promise<void> {
    const link = this.page.locator('[data-testid="sidebar"] a:has-text("Drivers"), nav a:has-text("Drivers")');
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.waitForPageLoad();
  }

  /**
   * Navigate to orders
   */
  async navigateToOrders(): Promise<void> {
    const link = this.page.locator('[data-testid="sidebar"] a:has-text("Orders"), nav a:has-text("Orders")');
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.waitForPageLoad();
  }

  /**
   * Create delivery zone
   */
  async createDeliveryZone(name: string, address: string, radius: number): Promise<void> {
    await this.deliveryZoneButton.click();
    await this.page.fill('input[name="name"], input[placeholder*="Zone name"]', name);
    await this.page.fill('input[name="address"], input[placeholder*="Address"]', address);
    await this.page.fill('input[name="radius"], input[type="number"]', radius.toString());
    await this.createButton.click();
    await this.waitForSuccessNotification();
  }

  /**
   * Create driver
   */
  async createDriver(firstName: string, lastName: string, email: string, phone: string): Promise<void> {
    await this.driversButton.click();
    await this.page.fill('input[name="firstName"], input[placeholder*="First name"]', firstName);
    await this.page.fill('input[name="lastName"], input[placeholder*="Last name"]', lastName);
    await this.page.fill('input[name="email"], input[type="email"]', email);
    await this.page.fill('input[name="phone"], input[type="tel"]', phone);
    await this.createButton.click();
    await this.waitForSuccessNotification();
  }

  /**
   * Create order
   */
  async createOrder(
    senderName: string,
    senderEmail: string,
    senderPhone: string,
    senderAddress: string,
    receiverName: string,
    receiverEmail: string,
    receiverPhone: string,
    receiverAddress: string,
  ): Promise<void> {
    await this.ordersButton.click();
    await this.page.fill('input[placeholder*="Sender Name"]', senderName);
    await this.page.fill('input[placeholder*="Sender Email"]', senderEmail);
    await this.page.fill('input[placeholder*="Sender Phone"]', senderPhone);
    await this.page.fill('textarea[placeholder*="Sender Address"]', senderAddress);
    await this.page.fill('input[placeholder*="Receiver Name"]', receiverName);
    await this.page.fill('input[placeholder*="Receiver Email"]', receiverEmail);
    await this.page.fill('input[placeholder*="Receiver Phone"]', receiverPhone);
    await this.page.fill('textarea[placeholder*="Receiver Address"]', receiverAddress);
    await this.createButton.click();
    await this.waitForSuccessNotification();
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
    await this.page.locator('[data-testid="user-menu-dropdown"], .dropdown-menu').waitFor({
      state: 'visible',
      timeout: 5000,
    });
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutButton.click();
    await this.page.waitForURL('/login', { timeout: 10000 });
  }

  /**
   * Expect dashboard
   */
  async expectDashboard(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
    await expect(this.mainContent).toBeVisible();
  }

  /**
   * Get stats cards
   */
  async getStatsCards(): Promise<{ label: string; value: string }[]> {
    const cards: { label: string; value: string }[] = [];
    const count = await this.statsCards.count();
    for (let i = 0; i < count; i++) {
      const card = this.statsCards.nth(i);
      const label = await card.locator('[data-testid="stat-label"], .label').textContent();
      const value = await card.locator('[data-testid="stat-value"], .value').textContent();
      if (label && value) {
        cards.push({
          label: label.trim(),
          value: value.trim(),
        });
      }
    }
    return cards;
  }
}
