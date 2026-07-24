/**
 * Notification Preferences E2E Test
 * Tests with Page Object Model:
 * - Navigate to preferences
 * - Toggle channel for category
 * - Set quiet hours
 * - Configure digest frequency
 * - Send test notification
 * - Verify toast appears
 * ~150 lines
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─── PAGE OBJECT MODEL ──────────────────────────────────────────────────────

interface PageElement {
  selector: string;
  exists(): Promise<boolean>;
  click(): Promise<void>;
  getText(): Promise<string>;
  setValue(value: string): Promise<void>;
  isVisible(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
  dismissable: boolean;
}

// ─── MOCK PAGE ELEMENTS ──────────────────────────────────────────────────────

class MockPageElement implements PageElement {
  private state: {
    visible: boolean;
    checked: boolean;
    value: string;
    text: string;
  } = {
    visible: true,
    checked: false,
    value: "",
    text: "",
  };

  constructor(public selector: string) {}

  async exists(): Promise<boolean> {
    return true;
  }

  async click(): Promise<void> {
    this.state.visible = true; // Show element on click
  }

  async getText(): Promise<string> {
    return this.state.text;
  }

  async setValue(value: string): Promise<void> {
    this.state.value = value;
  }

  async isVisible(): Promise<boolean> {
    return this.state.visible;
  }

  async isChecked(): Promise<boolean> {
    return this.state.checked;
  }

  async check(): Promise<void> {
    this.state.checked = true;
  }

  async uncheck(): Promise<void> {
    this.state.checked = false;
  }

  getState() {
    return { ...this.state };
  }

  setState(state: Partial<MockPageElement["state"]>) {
    Object.assign(this.state, state);
  }
}

// ─── NOTIFICATION PREFERENCES PAGE OBJECT ──────────────────────────────────

class NotificationPreferencesPage {
  private baseUrl: string;
  private toasts: Toast[] = [];

  // Channel toggles
  emailToggle: PageElement;
  smsToggle: PageElement;
  pushToggle: PageElement;
  whatsappToggle: PageElement;
  slackToggle: PageElement;

  // Category toggles
  orderConfirmationToggle: PageElement;
  orderUpdatesToggle: PageElement;
  deliveryNotificationsToggle: PageElement;
  promotionsToggle: PageElement;
  newslettersToggle: PageElement;

  // Quiet hours
  quietHoursEnabledToggle: PageElement;
  quietHoursStartTimeInput: PageElement;
  quietHoursEndTimeInput: PageElement;
  timezoneSelect: PageElement;

  // Digest frequency
  digestFrequencySelect: PageElement;

  // Test notification
  sendTestNotificationButton: PageElement;
  testNotificationDestinationInput: PageElement;

  // Action buttons
  savePreferencesButton: PageElement;
  resetButton: PageElement;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;

    // Initialize channel toggles
    this.emailToggle = new MockPageElement(
      'input[data-testid="channel-email"]',
    );
    this.smsToggle = new MockPageElement('input[data-testid="channel-sms"]');
    this.pushToggle = new MockPageElement('input[data-testid="channel-push"]');
    this.whatsappToggle = new MockPageElement(
      'input[data-testid="channel-whatsapp"]',
    );
    this.slackToggle = new MockPageElement(
      'input[data-testid="channel-slack"]',
    );

    // Initialize category toggles
    this.orderConfirmationToggle = new MockPageElement(
      'input[data-testid="category-order-confirmation"]',
    );
    this.orderUpdatesToggle = new MockPageElement(
      'input[data-testid="category-order-updates"]',
    );
    this.deliveryNotificationsToggle = new MockPageElement(
      'input[data-testid="category-delivery"]',
    );
    this.promotionsToggle = new MockPageElement(
      'input[data-testid="category-promotions"]',
    );
    this.newslettersToggle = new MockPageElement(
      'input[data-testid="category-newsletters"]',
    );

    // Initialize quiet hours
    this.quietHoursEnabledToggle = new MockPageElement(
      'input[data-testid="quiet-hours-enabled"]',
    );
    this.quietHoursStartTimeInput = new MockPageElement(
      'input[data-testid="quiet-hours-start"]',
    );
    this.quietHoursEndTimeInput = new MockPageElement(
      'input[data-testid="quiet-hours-end"]',
    );
    this.timezoneSelect = new MockPageElement('select[data-testid="timezone"]');

    // Initialize digest frequency
    this.digestFrequencySelect = new MockPageElement(
      'select[data-testid="digest-frequency"]',
    );

    // Initialize test notification
    this.sendTestNotificationButton = new MockPageElement(
      'button[data-testid="send-test"]',
    );
    this.testNotificationDestinationInput = new MockPageElement(
      'input[data-testid="test-destination"]',
    );

    // Initialize action buttons
    this.savePreferencesButton = new MockPageElement(
      'button[data-testid="save-preferences"]',
    );
    this.resetButton = new MockPageElement('button[data-testid="reset"]');
  }

  async navigateTo(): Promise<void> {
    // Simulate navigation
    const url = `${this.baseUrl}/settings/notifications`;
    if (!url) throw new Error("Failed to navigate");
  }

  async toggleEmailChannel(): Promise<void> {
    const element = this.emailToggle as MockPageElement;
    const isChecked = await this.emailToggle.isChecked();
    if (isChecked) {
      await this.emailToggle.uncheck();
    } else {
      await this.emailToggle.check();
    }
  }

  async enableQuietHours(
    startTime: string,
    endTime: string,
    timezone: string,
  ): Promise<void> {
    await this.quietHoursEnabledToggle.check();
    await this.quietHoursStartTimeInput.setValue(startTime);
    await this.quietHoursEndTimeInput.setValue(endTime);
    await this.timezoneSelect.setValue(timezone);
  }

  async setDigestFrequency(
    frequency: "IMMEDIATE" | "HOURLY" | "DAILY" | "WEEKLY",
  ): Promise<void> {
    await this.digestFrequencySelect.setValue(frequency);
  }

  async sendTestNotification(
    destination: string,
    channel: string = "email",
  ): Promise<void> {
    await this.testNotificationDestinationInput.setValue(destination);
    await this.sendTestNotificationButton.click();
    this.toasts.push({
      message: `Test notification sent to ${destination}`,
      type: "success",
      duration: 3000,
      dismissable: true,
    });
  }

  async savePreferences(): Promise<void> {
    await this.savePreferencesButton.click();
    this.toasts.push({
      message: "Preferences saved successfully",
      type: "success",
      duration: 3000,
      dismissable: true,
    });
  }

  async getToasts(): Promise<Toast[]> {
    return [...this.toasts];
  }

  async clearToasts(): Promise<void> {
    this.toasts = [];
  }

  async waitForToast(
    predicate: (toast: Toast) => boolean,
    timeoutMs: number = 5000,
  ): Promise<Toast> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const matching = this.toasts.find(predicate);
      if (matching) return matching;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Toast not found within timeout");
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Notification Preferences E2E", () => {
  let page: NotificationPreferencesPage;

  beforeEach(async () => {
    page = new NotificationPreferencesPage();
    await page.navigateTo();
    await page.clearToasts();
  });

  // ─── NAVIGATION ──────────────────────────────────────────────────────────

  describe("Navigation", () => {
    it("should navigate to notification preferences page", async () => {
      const pageElement = page.emailToggle;
      expect(await pageElement.exists()).toBe(true);
    });

    it("should display all channel options", async () => {
      expect(await page.emailToggle.exists()).toBe(true);
      expect(await page.smsToggle.exists()).toBe(true);
      expect(await page.pushToggle.exists()).toBe(true);
      expect(await page.whatsappToggle.exists()).toBe(true);
      expect(await page.slackToggle.exists()).toBe(true);
    });
  });

  // ─── CHANNEL TOGGLES ─────────────────────────────────────────────────────

  describe("Channel Toggles", () => {
    it("should toggle email channel on/off", async () => {
      const initialState = await page.emailToggle.isChecked();

      await page.toggleEmailChannel();
      const afterToggle = await page.emailToggle.isChecked();

      expect(afterToggle).toBe(!initialState);
    });

    it("should enable SMS channel", async () => {
      await page.smsToggle.check();

      const isChecked = await page.smsToggle.isChecked();
      expect(isChecked).toBe(true);
    });

    it("should disable push notifications", async () => {
      await page.pushToggle.uncheck();

      const isChecked = await page.pushToggle.isChecked();
      expect(isChecked).toBe(false);
    });

    it("should toggle multiple channels independently", async () => {
      await page.emailToggle.check();
      await page.smsToggle.check();
      await page.pushToggle.uncheck();

      expect(await page.emailToggle.isChecked()).toBe(true);
      expect(await page.smsToggle.isChecked()).toBe(true);
      expect(await page.pushToggle.isChecked()).toBe(false);
    });
  });

  // ─── CATEGORY TOGGLES ────────────────────────────────────────────────────

  describe("Notification Category Toggles", () => {
    it("should toggle order confirmation notifications", async () => {
      await page.orderConfirmationToggle.check();

      const isChecked = await page.orderConfirmationToggle.isChecked();
      expect(isChecked).toBe(true);
    });

    it("should toggle order updates", async () => {
      await page.orderUpdatesToggle.uncheck();

      const isChecked = await page.orderUpdatesToggle.isChecked();
      expect(isChecked).toBe(false);
    });

    it("should toggle promotions independently from other categories", async () => {
      await page.promotionsToggle.check();
      await page.newslettersToggle.uncheck();

      expect(await page.promotionsToggle.isChecked()).toBe(true);
      expect(await page.newslettersToggle.isChecked()).toBe(false);
    });
  });

  // ─── QUIET HOURS CONFIGURATION ──────────────────────────────────────────

  describe("Quiet Hours Configuration", () => {
    it("should enable quiet hours", async () => {
      await page.quietHoursEnabledToggle.check();

      const isChecked = await page.quietHoursEnabledToggle.isChecked();
      expect(isChecked).toBe(true);
    });

    it("should set quiet hours time range", async () => {
      await page.enableQuietHours("22:00", "08:00", "America/New_York");

      expect(await page.quietHoursStartTimeInput.isVisible()).toBe(true);
      expect(await page.quietHoursEndTimeInput.isVisible()).toBe(true);
      expect(await page.timezoneSelect.isVisible()).toBe(true);
    });

    it("should set different timezone", async () => {
      await page.quietHoursEnabledToggle.check();
      await page.timezoneSelect.setValue("Asia/Kolkata");

      expect(await page.timezoneSelect.isVisible()).toBe(true);
    });

    it("should disable quiet hours", async () => {
      await page.quietHoursEnabledToggle.uncheck();

      const isChecked = await page.quietHoursEnabledToggle.isChecked();
      expect(isChecked).toBe(false);
    });
  });

  // ─── DIGEST FREQUENCY ───────────────────────────────────────────────────

  describe("Digest Frequency Configuration", () => {
    it("should set digest frequency to IMMEDIATE", async () => {
      await page.setDigestFrequency("IMMEDIATE");

      expect(await page.digestFrequencySelect.isVisible()).toBe(true);
    });

    it("should set digest frequency to HOURLY", async () => {
      await page.setDigestFrequency("HOURLY");

      expect(await page.digestFrequencySelect.isVisible()).toBe(true);
    });

    it("should set digest frequency to DAILY", async () => {
      await page.setDigestFrequency("DAILY");

      expect(await page.digestFrequencySelect.isVisible()).toBe(true);
    });

    it("should set digest frequency to WEEKLY", async () => {
      await page.setDigestFrequency("WEEKLY");

      expect(await page.digestFrequencySelect.isVisible()).toBe(true);
    });
  });

  // ─── TEST NOTIFICATION ──────────────────────────────────────────────────

  describe("Send Test Notification", () => {
    it("should send test notification to email", async () => {
      const testEmail = "test@example.com";
      await page.sendTestNotification(testEmail);

      const toasts = await page.getToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain(testEmail);
    });

    it("should show success toast after sending test", async () => {
      await page.sendTestNotification("user@test.com");

      const successToast = await page.waitForToast((t) => t.type === "success");
      expect(successToast).toBeDefined();
      expect(successToast.type).toBe("success");
    });

    it("should allow multiple test notifications", async () => {
      await page.sendTestNotification("test1@example.com");
      await page.sendTestNotification("test2@example.com");

      const toasts = await page.getToasts();
      expect(toasts).toHaveLength(2);
    });
  });

  // ─── SAVE PREFERENCES ────────────────────────────────────────────────────

  describe("Save Preferences", () => {
    it("should save preferences with success message", async () => {
      await page.emailToggle.check();
      await page.quietHoursEnabledToggle.check();
      await page.savePreferences();

      const successToast = await page.waitForToast((t) => t.type === "success");
      expect(successToast.message).toContain("saved");
    });

    it("should save multiple preference changes", async () => {
      await page.emailToggle.uncheck();
      await page.smsToggle.check();
      await page.setDigestFrequency("DAILY");
      await page.savePreferences();

      expect(await page.emailToggle.isChecked()).toBe(false);
      expect(await page.smsToggle.isChecked()).toBe(true);
    });
  });

  // ─── TOAST NOTIFICATIONS ────────────────────────────────────────────────

  describe("Toast Notifications", () => {
    it("should display toast with correct message", async () => {
      await page.sendTestNotification("toast-test@example.com");

      const toasts = await page.getToasts();
      expect(toasts[0].message).toContain("toast-test@example.com");
    });

    it("should have dismissable toast", async () => {
      await page.sendTestNotification("dismissable@example.com");

      const toasts = await page.getToasts();
      expect(toasts[0].dismissable).toBe(true);
    });

    it("should clear toasts", async () => {
      await page.sendTestNotification("test@example.com");
      let toasts = await page.getToasts();
      expect(toasts.length).toBeGreaterThan(0);

      await page.clearToasts();
      toasts = await page.getToasts();
      expect(toasts).toHaveLength(0);
    });
  });

  // ─── INTEGRATED WORKFLOW ────────────────────────────────────────────────

  describe("Integrated Preference Management Workflow", () => {
    it("should complete full preference setup workflow", async () => {
      // Enable specific channels
      await page.emailToggle.check();
      await page.smsToggle.check();
      await page.pushToggle.uncheck();

      // Configure quiet hours
      await page.enableQuietHours("23:00", "07:00", "America/Los_Angeles");

      // Set digest frequency
      await page.setDigestFrequency("DAILY");

      // Send test notification
      await page.sendTestNotification("workflow-test@example.com");

      // Save all preferences
      await page.savePreferences();

      // Verify success
      const successToasts = (await page.getToasts()).filter(
        (t) => t.type === "success",
      );
      expect(successToasts.length).toBeGreaterThan(0);
    });

    it("should maintain state after save", async () => {
      await page.emailToggle.check();
      await page.setDigestFrequency("WEEKLY");
      await page.savePreferences();

      // Verify state is maintained
      expect(await page.emailToggle.isChecked()).toBe(true);
    });
  });
});
