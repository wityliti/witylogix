import { Page, Locator, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model
 * Encapsulates dashboard interactions and navigation
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly sidebarLinks: Locator;
  readonly mainContent: Locator;
  readonly statsCards: Locator;
  readonly pageTitle: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly loadingSpinner: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], nav, aside');
    this.sidebarLinks = page.locator('[data-testid="sidebar"] a, nav a, aside a');
    this.mainContent = page.locator('main, [data-testid="main-content"]');
    this.statsCards = page.locator('[data-testid="stats-card"], .card, [data-testid="metric"]');
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-menu"]');
    this.logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-btn"]');
    this.loadingSpinner = page.locator('[data-testid="loading"], .spinner, [role="progressbar"]');
    this.searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
  }

  /**
   * Navigate to dashboard
   */
  async navigate(): Promise<void> {
    await this.page.goto('/dashboard', { waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    // Wait for sidebar to be visible
    await expect(this.sidebar).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for data to load (hide loading spinner)
   */
  async waitForDataLoad(): Promise<void> {
    try {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // Spinner might not exist, which is fine
    }
    await this.page.waitForLoadState('networkidle', { timeout: 5000 });
  }

  /**
   * Navigate to a section via sidebar
   */
  async navigateToSection(sectionName: string): Promise<void> {
    const link = this.page.locator(
      `[data-testid="sidebar"] a:has-text("${sectionName}"), nav a:has-text("${sectionName}")`,
    );
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();
    await this.waitForDataLoad();
  }

  /**
   * Navigate to Orders section
   */
  async navigateToOrders(): Promise<void> {
    await this.navigateToSection('Orders');
  }

  /**
   * Navigate to Drivers section
   */
  async navigateToDrivers(): Promise<void> {
    await this.navigateToSection('Drivers');
  }

  /**
   * Navigate to Webhooks section
   */
  async navigateToWebhooks(): Promise<void> {
    await this.navigateToSection('Webhooks');
  }

  /**
   * Navigate to Tracking section
   */
  async navigateToTracking(): Promise<void> {
    await this.navigateToSection('Tracking');
  }

  /**
   * Get all sidebar links
   */
  async getSidebarLinks(): Promise<string[]> {
    await expect(this.sidebarLinks).toBeTruthy();
    const texts = await this.sidebarLinks.allTextContents();
    return texts.filter((t) => t.trim().length > 0);
  }

  /**
   * Get all stats cards
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

  /**
   * Search for orders/shipments
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForDataLoad();
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
    // Wait for menu to appear
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
    // Wait for redirect to login
    await this.page.waitForURL('/login', { timeout: 10000 });
  }

  /**
   * Verify dashboard is displayed
   */
  async expectDashboard(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
    await expect(this.mainContent).toBeVisible();
  }

  /**
   * Verify page title matches
   */
  async expectPageTitle(expectedTitle: string): Promise<void> {
    await expect(this.pageTitle).toContainText(expectedTitle);
  }

  /**
   * Verify stats cards are loaded
   */
  async expectStatsCardsLoaded(minCount: number = 1): Promise<void> {
    const count = await this.statsCards.count();
    if (count < minCount) {
      throw new Error(`Expected at least ${minCount} stats cards, found ${count}`);
    }
  }
}
