import { Page, Locator, expect } from '@playwright/test';

/**
 * Customer Portal Page Object Model
 * Encapsulates customer portal interactions including orders, tracking, and preferences
 */
export class CustomerPortalPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly loginError: Locator;
  readonly portalHeader: Locator;
  readonly navMenu: Locator;
  readonly ordersLink: Locator;
  readonly trackingLink: Locator;
  readonly preferencesLink: Locator;
  readonly accountLink: Locator;
  readonly logoutButton: Locator;
  readonly orderList: Locator;
  readonly orderItems: Locator;
  readonly orderDetailContainer: Locator;
  readonly deliveryTimeline: Locator;
  readonly timelineEvents: Locator;
  readonly podImage: Locator;
  readonly trackingMap: Locator;
  readonly driverPosition: Locator;
  readonly rescheduleButton: Locator;
  readonly rateDeliveryButton: Locator;
  readonly ratingStars: Locator;
  readonly feedbackTextarea: Locator;
  readonly submitRatingButton: Locator;
  readonly preferencesForm: Locator;
  readonly safePlaceToggle: Locator;
  readonly safeInstructions: Locator;
  readonly accessCodeInput: Locator;
  readonly savePreferencesButton: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyState: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
    this.loginError = page.locator('[data-testid="login-error"], [role="alert"]');
    this.portalHeader = page.locator('[data-testid="portal-header"], [data-testid="customer-header"]');
    this.navMenu = page.locator('[data-testid="nav-menu"], nav');
    this.ordersLink = page.locator('[data-testid="nav-orders"], a:has-text("Orders")');
    this.trackingLink = page.locator('[data-testid="nav-tracking"], a:has-text("Tracking")');
    this.preferencesLink = page.locator('[data-testid="nav-preferences"], a:has-text("Preferences")');
    this.accountLink = page.locator('[data-testid="nav-account"], a:has-text("Account")');
    this.logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    this.orderList = page.locator('[data-testid="order-list"], [data-testid="orders-container"]');
    this.orderItems = page.locator('[data-testid="order-item"], [data-testid="order-card"]');
    this.orderDetailContainer = page.locator('[data-testid="order-detail"], [data-testid="order-details"]');
    this.deliveryTimeline = page.locator('[data-testid="delivery-timeline"], [data-testid="timeline"]');
    this.timelineEvents = page.locator('[data-testid="timeline-event"], [data-testid="event"]');
    this.podImage = page.locator('[data-testid="pod-image"], [data-testid="proof-of-delivery"]');
    this.trackingMap = page.locator('[data-testid="tracking-map"], [data-testid="map"]');
    this.driverPosition = page.locator('[data-testid="driver-marker"], [data-testid="driver-location"]');
    this.rescheduleButton = page.locator('[data-testid="reschedule-btn"], button:has-text("Reschedule")');
    this.rateDeliveryButton = page.locator('[data-testid="rate-delivery-btn"], button:has-text("Rate")');
    this.ratingStars = page.locator('[data-testid="rating-star"], [aria-label*="star" i]');
    this.feedbackTextarea = page.locator('[data-testid="feedback"], textarea');
    this.submitRatingButton = page.locator('[data-testid="submit-rating"], button:has-text("Submit")');
    this.preferencesForm = page.locator('[data-testid="preferences-form"], [data-testid="prefs"]');
    this.safePlaceToggle = page.locator('[data-testid="safe-place-toggle"], input[type="checkbox"]');
    this.safeInstructions = page.locator('[data-testid="safe-instructions"], textarea');
    this.accessCodeInput = page.locator('[data-testid="access-code"], input[placeholder*="code" i]');
    this.savePreferencesButton = page.locator('[data-testid="save-prefs"], button:has-text("Save")');
    this.loadingIndicator = page.locator('[data-testid="loading"], [role="progressbar"]');
    this.emptyState = page.locator('[data-testid="empty-state"], [data-testid="no-data"]');
    this.successMessage = page.locator('[data-testid="success"], [data-testid="success-message"]');
    this.errorMessage = page.locator('[data-testid="error"], [data-testid="error-message"]');
  }

  /**
   * Navigate to customer portal login
   */
  async navigateToPortal(): Promise<void> {
    await this.page.goto('/portal', { waitUntil: 'networkidle' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login to customer portal
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL('/portal/orders', { timeout: 10000 });
  }

  /**
   * Navigate to orders page
   */
  async navigateToOrders(): Promise<void> {
    await this.ordersLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to tracking page
   */
  async navigateToTrack(): Promise<void> {
    await this.trackingLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to preferences page
   */
  async navigateToPreferences(): Promise<void> {
    await this.preferencesLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get list of orders
   */
  async getOrderList(): Promise<
    Array<{
      id: string;
      date: string;
      status: string;
      address: string;
      total: string;
    }>
  > {
    await expect(this.orderList).toBeVisible();
    const orders: Array<{
      id: string;
      date: string;
      status: string;
      address: string;
      total: string;
    }> = [];

    const count = await this.orderItems.count();
    for (let i = 0; i < count; i++) {
      const item = this.orderItems.nth(i);
      const id = await item.getAttribute('data-order-id');
      const date = await item.locator('[data-testid="order-date"]').textContent();
      const status = await item.locator('[data-testid="order-status"]').textContent();
      const address = await item.locator('[data-testid="order-address"]').textContent();
      const total = await item.locator('[data-testid="order-total"]').textContent();

      if (id) {
        orders.push({
          id,
          date: date?.trim() || '',
          status: status?.trim() || '',
          address: address?.trim() || '',
          total: total?.trim() || '',
        });
      }
    }

    return orders;
  }

  /**
   * Get order detail
   */
  async getOrderDetail(orderId: string): Promise<{
    id: string;
    status: string;
    address: string;
    phone: string;
    email: string;
    items: Array<{ name: string; quantity: number; price: string }>;
    total: string;
    estimatedDelivery: string;
  }> {
    const orderItem = this.page.locator(`[data-testid="order-item"][data-order-id="${orderId}"]`);
    await orderItem.click();
    await expect(this.orderDetailContainer).toBeVisible();

    const id = await this.orderDetailContainer.locator('[data-testid="order-id"]').textContent();
    const status = await this.orderDetailContainer.locator('[data-testid="order-status"]').textContent();
    const address = await this.orderDetailContainer.locator('[data-testid="delivery-address"]').textContent();
    const phone = await this.orderDetailContainer.locator('[data-testid="delivery-phone"]').textContent();
    const email = await this.orderDetailContainer.locator('[data-testid="delivery-email"]').textContent();
    const total = await this.orderDetailContainer.locator('[data-testid="order-total"]').textContent();
    const estimatedDelivery = await this.orderDetailContainer.locator('[data-testid="estimated-delivery"]').textContent();

    // Get items
    const items: Array<{ name: string; quantity: number; price: string }> = [];
    const itemElements = this.orderDetailContainer.locator('[data-testid="order-item-line"]');
    const itemCount = await itemElements.count();

    for (let i = 0; i < itemCount; i++) {
      const itemLine = itemElements.nth(i);
      const name = await itemLine.locator('[data-testid="item-name"]').textContent();
      const quantity = await itemLine.locator('[data-testid="item-quantity"]').textContent();
      const price = await itemLine.locator('[data-testid="item-price"]').textContent();

      if (name) {
        items.push({
          name: name.trim(),
          quantity: parseInt(quantity?.trim() || '0', 10),
          price: price?.trim() || '',
        });
      }
    }

    return {
      id: id?.trim() || '',
      status: status?.trim() || '',
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      items,
      total: total?.trim() || '',
      estimatedDelivery: estimatedDelivery?.trim() || '',
    };
  }

  /**
   * Get delivery timeline events
   */
  async getDeliveryTimeline(orderId: string): Promise<
    Array<{
      timestamp: string;
      status: string;
      description: string;
      icon: string;
    }>
  > {
    // First get order detail
    await this.getOrderDetail(orderId);

    await expect(this.deliveryTimeline).toBeVisible();
    const events: Array<{
      timestamp: string;
      status: string;
      description: string;
      icon: string;
    }> = [];

    const count = await this.timelineEvents.count();
    for (let i = 0; i < count; i++) {
      const event = this.timelineEvents.nth(i);
      const timestamp = await event.locator('[data-testid="event-time"]').textContent();
      const status = await event.locator('[data-testid="event-status"]').textContent();
      const description = await event.locator('[data-testid="event-description"]').textContent();
      const icon = await event.locator('[data-testid="event-icon"]').getAttribute('data-icon');

      if (timestamp && status) {
        events.push({
          timestamp: timestamp.trim(),
          status: status.trim(),
          description: description?.trim() || '',
          icon: icon || '',
        });
      }
    }

    return events;
  }

  /**
   * Click reschedule button for an order
   */
  async clickReschedule(orderId: string): Promise<void> {
    await this.getOrderDetail(orderId);
    await expect(this.rescheduleButton).toBeVisible();
    await this.rescheduleButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select new delivery date for rescheduling
   */
  async selectNewDate(date: Date | string): Promise<void> {
    let targetDate: Date;
    if (typeof date === 'string') {
      targetDate = new Date(date);
    } else {
      targetDate = date;
    }

    const dayString = String(targetDate.getDate()).padStart(2, '0');
    const dateButton = this.page.locator(
      `[data-testid="reschedule-date"][data-date="${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${dayString}"]`
    );

    await expect(dateButton).toBeVisible();
    await dateButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Confirm rescheduling
   */
  async confirmReschedule(): Promise<void> {
    const confirmButton = this.page.locator('[data-testid="confirm-reschedule"], button:has-text("Confirm")');
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Update delivery preferences
   */
  async updatePreferences(prefs: { safePlace?: boolean; safeInstructions?: string; accessCode?: string }): Promise<void> {
    await this.navigateToPreferences();
    await expect(this.preferencesForm).toBeVisible();

    if (prefs.safePlace !== undefined) {
      const isChecked = await this.safePlaceToggle.isChecked();
      if (isChecked !== prefs.safePlace) {
        await this.safePlaceToggle.click();
      }
    }

    if (prefs.safeInstructions) {
      await this.safeInstructions.fill(prefs.safeInstructions);
    }

    if (prefs.accessCode) {
      await this.accessCodeInput.fill(prefs.accessCode);
    }

    await this.savePreferencesButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Rate a delivery
   */
  async rateDelivery(orderId: string, stars: number, feedback: string): Promise<void> {
    await this.getOrderDetail(orderId);
    await expect(this.rateDeliveryButton).toBeVisible();
    await this.rateDeliveryButton.click();
    await this.page.waitForLoadState('networkidle');

    // Select star rating
    const starButtons = this.page.locator('[data-testid="rating-star"]');
    const starButton = starButtons.nth(stars - 1);
    await starButton.click();

    // Enter feedback
    if (feedback) {
      await this.feedbackTextarea.fill(feedback);
    }

    // Submit rating
    await this.submitRatingButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get tracking map with driver position
   */
  async getTrackingInfo(orderId: string): Promise<{
    driverName: string;
    driverPhone: string;
    vehiclePlate: string;
    estimatedArrival: string;
    currentLocation: string;
  }> {
    // Navigate to tracking for this order
    const orderItem = this.page.locator(`[data-testid="order-item"][data-order-id="${orderId}"]`);
    const trackLink = orderItem.locator('[data-testid="track-link"]');
    await trackLink.click();
    await this.page.waitForLoadState('networkidle');

    await expect(this.trackingMap).toBeVisible();

    const driverName = await this.page.locator('[data-testid="driver-name"]').textContent();
    const driverPhone = await this.page.locator('[data-testid="driver-phone"]').textContent();
    const vehiclePlate = await this.page.locator('[data-testid="vehicle-plate"]').textContent();
    const estimatedArrival = await this.page.locator('[data-testid="estimated-arrival"]').textContent();
    const currentLocation = await this.page.locator('[data-testid="current-location"]').textContent();

    return {
      driverName: driverName?.trim() || '',
      driverPhone: driverPhone?.trim() || '',
      vehiclePlate: vehiclePlate?.trim() || '',
      estimatedArrival: estimatedArrival?.trim() || '',
      currentLocation: currentLocation?.trim() || '',
    };
  }

  /**
   * Get POD image for delivered order
   */
  async getPODImage(orderId: string): Promise<string> {
    await this.getOrderDetail(orderId);
    const podImg = this.page.locator('[data-testid="pod-image"]');
    if (await podImg.isVisible()) {
      const src = await podImg.getAttribute('src');
      return src || '';
    }
    return '';
  }

  /**
   * Logout from portal
   */
  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.page.waitForURL('/portal', { timeout: 10000 });
  }

  /**
   * Get success message
   */
  async getSuccessMessage(): Promise<string> {
    try {
      await expect(this.successMessage).toBeVisible();
      const text = await this.successMessage.textContent();
      return text?.trim() || '';
    } catch {
      return '';
    }
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      await expect(this.errorMessage).toBeVisible();
      const text = await this.errorMessage.textContent();
      return text?.trim() || '';
    } catch {
      return '';
    }
  }

  /**
   * Verify portal is logged in
   */
  async expectPortalLoggedIn(): Promise<void> {
    await expect(this.portalHeader).toBeVisible();
    await expect(this.navMenu).toBeVisible();
  }

  /**
   * Verify orders page loaded
   */
  async expectOrdersPage(): Promise<void> {
    await expect(this.orderList).toBeVisible();
  }

  /**
   * Verify order detail displayed
   */
  async expectOrderDetailVisible(): Promise<void> {
    await expect(this.orderDetailContainer).toBeVisible();
    await expect(this.deliveryTimeline).toBeVisible();
  }
}
