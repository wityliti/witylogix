import { Page, Locator, expect } from "@playwright/test";

export interface OrderData {
  trackingId?: string;
  status?: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  receiverName: string;
  receiverEmail: string;
  receiverPhone: string;
  senderAddress: string;
  receiverAddress: string;
  weight?: string;
  description?: string;
}

/**
 * Orders Page Object Model
 * Encapsulates order management interactions
 */
export class OrdersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly createOrderButton: Locator;
  readonly ordersTable: Locator;
  readonly orderRows: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;
  readonly modal: Locator;
  readonly modalClose: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.createOrderButton = page.locator(
      'button:has-text("Create Order"), button:has-text("New Order"), [data-testid="create-order-btn"]',
    );
    this.ordersTable = page.locator(
      'table, [data-testid="orders-table"], [role="grid"]',
    );
    this.orderRows = page.locator(
      'tbody tr, [data-testid="order-row"], [role="row"]',
    );
    this.searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="Tracking"]',
    );
    this.statusFilter = page.locator('select, [data-testid="status-filter"]');
    this.loadingSpinner = page.locator(
      '[data-testid="loading"], .spinner, [role="progressbar"]',
    );
    this.emptyState = page.locator('[data-testid="empty-state"], .empty-state');
    this.modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
    this.modalClose = page.locator(
      'button[aria-label="Close"], button:has-text("Cancel"), [data-testid="close-modal"]',
    );
    this.deleteConfirmButton = page.locator(
      'button:has-text("Delete"), button:has-text("Confirm")',
    );
  }

  /**
   * Navigate to orders page
   */
  async navigateToList(): Promise<void> {
    await this.page.goto("/dashboard/orders", { waitUntil: "networkidle" });
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle", { timeout: 10000 });
    try {
      await this.loadingSpinner.waitFor({ state: "hidden", timeout: 5000 });
    } catch {
      // Spinner might not exist
    }
  }

  /**
   * Click create order button
   */
  async clickCreateOrder(): Promise<void> {
    await this.createOrderButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Fill order form with data
   */
  async fillOrderForm(data: OrderData): Promise<void> {
    // Fill sender information
    await this.page.fill(
      'input[placeholder*="Sender Name"], input[name*="senderName"]',
      data.senderName,
    );
    await this.page.fill(
      'input[placeholder*="Sender Email"], input[name*="senderEmail"]',
      data.senderEmail,
    );
    await this.page.fill(
      'input[placeholder*="Sender Phone"], input[name*="senderPhone"]',
      data.senderPhone,
    );
    await this.page.fill(
      'input[placeholder*="Sender Address"], input[name*="senderAddress"], textarea[name*="senderAddress"]',
      data.senderAddress,
    );

    // Fill receiver information
    await this.page.fill(
      'input[placeholder*="Receiver Name"], input[name*="receiverName"]',
      data.receiverName,
    );
    await this.page.fill(
      'input[placeholder*="Receiver Email"], input[name*="receiverEmail"]',
      data.receiverEmail,
    );
    await this.page.fill(
      'input[placeholder*="Receiver Phone"], input[name*="receiverPhone"]',
      data.receiverPhone,
    );
    await this.page.fill(
      'input[placeholder*="Receiver Address"], input[name*="receiverAddress"], textarea[name*="receiverAddress"]',
      data.receiverAddress,
    );

    // Optional fields
    if (data.weight) {
      await this.page.fill(
        'input[placeholder*="Weight"], input[name*="weight"]',
        data.weight,
      );
    }
    if (data.description) {
      await this.page.fill(
        'textarea[name*="description"], input[placeholder*="Description"]',
        data.description,
      );
    }
  }

  /**
   * Submit order form
   */
  async submitOrderForm(): Promise<void> {
    await this.page.click(
      'button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")',
    );
    await this.waitForPageLoad();
  }

  /**
   * Create order with data
   */
  async createOrder(data: OrderData): Promise<void> {
    await this.clickCreateOrder();
    await this.fillOrderForm(data);
    await this.submitOrderForm();
  }

  /**
   * Get order by tracking ID
   */
  async getOrderByTrackingId(trackingId: string): Promise<Locator> {
    return this.orderRows.filter({ hasText: trackingId }).first();
  }

  /**
   * Click on order row to open details
   */
  async openOrderDetails(trackingId: string): Promise<void> {
    const orderRow = await this.getOrderByTrackingId(trackingId);
    await orderRow.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Edit order details
   */
  async editOrder(
    trackingId: string,
    updates: Partial<OrderData>,
  ): Promise<void> {
    await this.openOrderDetails(trackingId);

    // Find and click edit button
    await this.page.click('button:has-text("Edit"), [data-testid="edit-btn"]');
    await this.page.waitForLoadState("networkidle");

    // Fill updated fields
    if (updates.senderName) {
      await this.page.fill('input[name*="senderName"]', updates.senderName);
    }
    if (updates.receiverName) {
      await this.page.fill('input[name*="receiverName"]', updates.receiverName);
    }
    if (updates.description) {
      await this.page.fill(
        'textarea[name*="description"]',
        updates.description,
      );
    }

    // Save changes
    await this.page.click('button[type="submit"]:has-text("Save")');
    await this.waitForPageLoad();
  }

  /**
   * Delete order
   */
  async deleteOrder(trackingId: string): Promise<void> {
    await this.openOrderDetails(trackingId);

    // Find and click delete button
    await this.page.click(
      'button:has-text("Delete"), [data-testid="delete-btn"]',
    );

    // Confirm deletion
    await this.deleteConfirmButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Filter orders by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.waitForPageLoad();
  }

  /**
   * Search orders by tracking ID
   */
  async searchByTrackingId(trackingId: string): Promise<void> {
    await this.searchInput.fill(trackingId);
    await this.page.keyboard.press("Enter");
    await this.waitForPageLoad();
  }

  /**
   * Get order row by index
   */
  async getOrderRow(index: number): Promise<Locator> {
    return this.orderRows.nth(index);
  }

  /**
   * Get total order count
   */
  async getOrderCount(): Promise<number> {
    return await this.orderRows.count();
  }

  /**
   * Get order details from row
   */
  async getOrderDetails(
    index: number,
  ): Promise<{ trackingId: string; status: string; sender: string }> {
    const row = await this.getOrderRow(index);
    const trackingId = await row
      .locator('td, [data-testid="tracking-id"]')
      .first()
      .textContent();
    const status = await row
      .locator('td, [data-testid="status"]')
      .nth(1)
      .textContent();
    const sender = await row
      .locator('td, [data-testid="sender"]')
      .textContent();

    return {
      trackingId: trackingId?.trim() || "",
      status: status?.trim() || "",
      sender: sender?.trim() || "",
    };
  }

  /**
   * Verify orders page is displayed
   */
  async expectOrdersPage(): Promise<void> {
    await expect(this.pageTitle).toContainText("Orders");
    await expect(this.createOrderButton).toBeVisible();
  }

  /**
   * Verify order exists in list
   */
  async expectOrderExists(trackingId: string): Promise<void> {
    const orderRow = await this.getOrderByTrackingId(trackingId);
    await expect(orderRow).toBeVisible();
  }

  /**
   * Verify order does not exist
   */
  async expectOrderNotExists(trackingId: string): Promise<void> {
    const orderRow = await this.getOrderByTrackingId(trackingId);
    await expect(orderRow).not.toBeVisible();
  }
}
