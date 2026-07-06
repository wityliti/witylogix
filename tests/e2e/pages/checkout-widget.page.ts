import { Page, Locator, expect } from "@playwright/test";

/**
 * Checkout Widget Page Object Model
 * Encapsulates checkout flow interactions including address, date, time, and payment
 */
export class CheckoutWidgetPage {
  readonly page: Page;
  readonly checkoutWidget: Locator;
  readonly addressInput: Locator;
  readonly addressSuggestions: Locator;
  readonly zipcodeInput: Locator;
  readonly zipcodeError: Locator;
  readonly zoneIndicator: Locator;
  readonly deliveryMethodSelect: Locator;
  readonly deliveryMethodOptions: Locator;
  readonly dateSelector: Locator;
  readonly datePicker: Locator;
  readonly calendarDays: Locator;
  readonly blackoutDates: Locator;
  readonly timeSlotContainer: Locator;
  readonly timeSlots: Locator;
  readonly capacityIndicator: Locator;
  readonly deliveryRateDisplay: Locator;
  readonly orderSummary: Locator;
  readonly subtotalPrice: Locator;
  readonly deliveryFee: Locator;
  readonly totalPrice: Locator;
  readonly completeCheckoutButton: Locator;
  readonly backButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly loadingIndicator: Locator;
  readonly cutoffWarning: Locator;

  constructor(page: Page) {
    this.page = page;
    this.checkoutWidget = page.locator(
      '[data-testid="checkout-widget"], [data-testid="checkout-container"]',
    );
    this.addressInput = page.locator(
      '[data-testid="address-input"], input[placeholder*="address" i]',
    );
    this.addressSuggestions = page.locator(
      '[data-testid="address-suggestions"], [role="listbox"]',
    );
    this.zipcodeInput = page.locator(
      '[data-testid="zipcode-input"], input[placeholder*="zip" i]',
    );
    this.zipcodeError = page.locator(
      '[data-testid="zipcode-error"], [data-testid="zone-error"]',
    );
    this.zoneIndicator = page.locator(
      '[data-testid="zone-indicator"], [data-testid="delivery-zone"]',
    );
    this.deliveryMethodSelect = page.locator(
      '[data-testid="delivery-method"], select, [role="combobox"]',
    );
    this.deliveryMethodOptions = page.locator(
      '[data-testid="delivery-option"], [role="option"]',
    );
    this.dateSelector = page.locator(
      '[data-testid="date-selector"], [data-testid="delivery-date"]',
    );
    this.datePicker = page.locator(
      '[data-testid="date-picker"], [role="dialog"]',
    );
    this.calendarDays = page.locator(
      '[data-testid="calendar-day"], [data-testid="calendar-date"]',
    );
    this.blackoutDates = page.locator(
      '[data-testid="blackout-date"], [disabled][data-date]',
    );
    this.timeSlotContainer = page.locator(
      '[data-testid="time-slots"], [data-testid="slot-container"]',
    );
    this.timeSlots = page.locator(
      '[data-testid="time-slot"], [data-testid="slot"]',
    );
    this.capacityIndicator = page.locator(
      '[data-testid="capacity-indicator"], [data-testid="slot-capacity"]',
    );
    this.deliveryRateDisplay = page.locator(
      '[data-testid="delivery-rate"], [data-testid="rate-amount"]',
    );
    this.orderSummary = page.locator(
      '[data-testid="order-summary"], [data-testid="summary"]',
    );
    this.subtotalPrice = page.locator(
      '[data-testid="subtotal"], [data-testid="subtotal-price"]',
    );
    this.deliveryFee = page.locator(
      '[data-testid="delivery-fee"], [data-testid="delivery-charge"]',
    );
    this.totalPrice = page.locator(
      '[data-testid="total-price"], [data-testid="order-total"]',
    );
    this.completeCheckoutButton = page.locator(
      '[data-testid="complete-checkout"], button:has-text("Complete")',
      page.locator('button:has-text("Checkout")'),
    );
    this.backButton = page.locator(
      '[data-testid="back-btn"], button:has-text("Back")',
    );
    this.errorMessage = page.locator(
      '[data-testid="error-message"], [role="alert"]',
    );
    this.successMessage = page.locator(
      '[data-testid="success-message"], [data-testid="confirmation"]',
    );
    this.loadingIndicator = page.locator(
      '[data-testid="loading"], [role="progressbar"]',
    );
    this.cutoffWarning = page.locator(
      '[data-testid="cutoff-warning"], [data-testid="deadline-warning"]',
    );
  }

  /**
   * Wait for checkout widget to load
   */
  async waitForWidgetLoad(): Promise<void> {
    await expect(this.checkoutWidget).toBeVisible({ timeout: 10000 });
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Enter delivery address
   */
  async enterAddress(address: string): Promise<void> {
    await this.addressInput.fill(address);
    await this.page.waitForLoadState("networkidle");

    // Wait for suggestions to appear
    try {
      await expect(this.addressSuggestions).toBeVisible({ timeout: 3000 });
      // Click first suggestion
      const firstSuggestion = this.page
        .locator('[data-testid="address-suggestions"] [role="option"]')
        .first();
      await firstSuggestion.click();
      await this.page.waitForLoadState("networkidle");
    } catch {
      // If no suggestions, continue with what was typed
    }
  }

  /**
   * Validate zipcode
   */
  async validateZipcode(zip: string): Promise<boolean> {
    await this.zipcodeInput.fill(zip);
    await this.page.waitForLoadState("networkidle");

    // Check if error message appears
    const errorVisible = await this.zipcodeError.isVisible().catch(() => false);
    return !errorVisible;
  }

  /**
   * Select delivery method
   */
  async selectDeliveryMethod(
    method: "standard" | "express" | "sameday",
  ): Promise<void> {
    const methodLabel = {
      standard: "Standard",
      express: "Express",
      sameday: "Same Day",
    };

    await this.deliveryMethodSelect.click();
    const option = this.page.locator(
      `[data-testid="delivery-option"]:has-text("${methodLabel[method]}")`,
    );
    await expect(option).toBeVisible();
    await option.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Select delivery date
   */
  async selectDate(date: Date | string): Promise<void> {
    // Parse date string if needed
    let targetDate: Date;
    if (typeof date === "string") {
      targetDate = new Date(date);
    } else {
      targetDate = date;
    }

    // Open date picker
    await this.dateSelector.click();
    await expect(this.datePicker).toBeVisible();

    // Click the date
    const dayString = String(targetDate.getDate()).padStart(2, "0");
    const dateButton = this.page.locator(
      `[data-testid="calendar-date"][data-date="${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${dayString}"]`,
    );

    await expect(dateButton).toBeVisible();
    await dateButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get available time slots
   */
  async getAvailableSlots(): Promise<
    Array<{
      id: string;
      time: string;
      capacity: number;
      maxCapacity: number;
      available: boolean;
    }>
  > {
    await expect(this.timeSlotContainer).toBeVisible();
    const slots: Array<{
      id: string;
      time: string;
      capacity: number;
      maxCapacity: number;
      available: boolean;
    }> = [];

    const count = await this.timeSlots.count();
    for (let i = 0; i < count; i++) {
      const slot = this.timeSlots.nth(i);
      const id = await slot.getAttribute("data-id");
      const time = await slot.textContent();
      const capacity = await slot.getAttribute("data-capacity");
      const maxCapacity = await slot.getAttribute("data-max-capacity");
      const disabled = await slot.isDisabled();

      if (id && time) {
        slots.push({
          id,
          time: time.trim(),
          capacity: parseInt(capacity || "0", 10),
          maxCapacity: parseInt(maxCapacity || "10", 10),
          available: !disabled,
        });
      }
    }

    return slots;
  }

  /**
   * Select a time slot
   */
  async selectTimeSlot(time: string): Promise<void> {
    const slot = this.page.locator(
      `[data-testid="time-slot"]:has-text("${time}")`,
    );
    await expect(slot).toBeVisible();
    await slot.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get capacity indicator for a specific slot
   */
  async getCapacityIndicator(
    slotId: string,
  ): Promise<{ current: number; max: number; percentage: number }> {
    const indicator = this.page.locator(
      `[data-testid="capacity-indicator"][data-slot-id="${slotId}"]`,
    );
    await expect(indicator).toBeVisible();

    const current = await indicator.getAttribute("data-capacity");
    const max = await indicator.getAttribute("data-max-capacity");
    const percentage = await indicator.getAttribute("data-percentage");

    return {
      current: parseInt(current || "0", 10),
      max: parseInt(max || "10", 10),
      percentage: parseInt(percentage || "0", 10),
    };
  }

  /**
   * Get delivery rate
   */
  async getDeliveryRate(): Promise<number> {
    await expect(this.deliveryRateDisplay).toBeVisible();
    const rateText = await this.deliveryRateDisplay.textContent();
    const rateMatch = rateText?.match(/[\d.]+/);
    return parseFloat(rateMatch?.[0] || "0");
  }

  /**
   * Get order summary
   */
  async getOrderSummary(): Promise<{
    subtotal: number;
    deliveryFee: number;
    total: number;
    address: string;
    date: string;
    time: string;
  }> {
    await expect(this.orderSummary).toBeVisible();

    const subtotal = await this.getPrice(this.subtotalPrice);
    const deliveryFee = await this.getPrice(this.deliveryFee);
    const total = await this.getPrice(this.totalPrice);
    const address = await this.page
      .locator('[data-testid="summary-address"]')
      .textContent();
    const date = await this.page
      .locator('[data-testid="summary-date"]')
      .textContent();
    const time = await this.page
      .locator('[data-testid="summary-time"]')
      .textContent();

    return {
      subtotal,
      deliveryFee,
      total,
      address: address?.trim() || "",
      date: date?.trim() || "",
      time: time?.trim() || "",
    };
  }

  /**
   * Helper to extract price from text
   */
  private async getPrice(locator: Locator): Promise<number> {
    const text = await locator.textContent();
    const match = text?.match(/[\d.]+/);
    return parseFloat(match?.[0] || "0");
  }

  /**
   * Complete checkout flow
   */
  async completeCheckout(): Promise<void> {
    await expect(this.completeCheckoutButton).toBeVisible();
    await this.completeCheckoutButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get available dates (not blackout)
   */
  async getAvailableDates(): Promise<string[]> {
    await this.dateSelector.click();
    await expect(this.datePicker).toBeVisible();

    const dates: string[] = [];
    const dayCount = await this.calendarDays.count();

    for (let i = 0; i < dayCount; i++) {
      const day = this.calendarDays.nth(i);
      const isDisabled = await day.isDisabled();
      const date = await day.getAttribute("data-date");

      if (!isDisabled && date) {
        dates.push(date);
      }
    }

    return dates;
  }

  /**
   * Check if order deadline warning is displayed
   */
  async hasCutoffWarning(): Promise<boolean> {
    return await this.cutoffWarning.isVisible().catch(() => false);
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      await expect(this.errorMessage).toBeVisible();
      const text = await this.errorMessage.textContent();
      return text?.trim() || "";
    } catch {
      return "";
    }
  }

  /**
   * Check if address is outside delivery zone
   */
  async isOutsideDeliveryZone(): Promise<boolean> {
    const errorVisible = await this.zipcodeError.isVisible().catch(() => false);
    const errorText = await this.getErrorMessage();
    return (
      errorVisible ||
      errorText.includes("outside") ||
      errorText.includes("zone")
    );
  }

  /**
   * Go back to previous step
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Verify checkout widget is displayed
   */
  async expectCheckoutWidget(): Promise<void> {
    await expect(this.checkoutWidget).toBeVisible();
  }

  /**
   * Verify address step
   */
  async expectAddressStep(): Promise<void> {
    await expect(this.addressInput).toBeVisible();
    await expect(this.zipcodeInput).toBeVisible();
  }

  /**
   * Verify date selection step
   */
  async expectDateStep(): Promise<void> {
    await expect(this.dateSelector).toBeVisible();
  }

  /**
   * Verify time selection step
   */
  async expectTimeStep(): Promise<void> {
    await expect(this.timeSlotContainer).toBeVisible();
    const count = await this.timeSlots.count();
    if (count === 0) {
      throw new Error("No time slots available");
    }
  }

  /**
   * Verify order summary is complete
   */
  async expectOrderSummary(): Promise<void> {
    await expect(this.orderSummary).toBeVisible();
    await expect(this.subtotalPrice).toBeVisible();
    await expect(this.totalPrice).toBeVisible();
  }
}
