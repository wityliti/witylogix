import { Page, Locator, expect } from "@playwright/test";

/**
 * Login Page Object Model
 * Encapsulates all login-related interactions
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;
  readonly pageTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Locators for login form elements
    this.emailInput = page
      .locator('input[type="email"], input[name="email"]')
      .first();
    this.passwordInput = page
      .locator('input[type="password"], input[name="password"]')
      .first();
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator(
      '[data-testid="error-message"], .error, [role="alert"]',
    );
    this.rememberMeCheckbox = page.locator('input[type="checkbox"]');
    this.forgotPasswordLink = page.locator(
      'a:has-text("Forgot password"), a:has-text("forgot")',
    );
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
  }

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.page.goto("/login", { waitUntil: "networkidle" });
    await expect(this.pageTitle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Fill email and password fields
   */
  async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * Fill email field only
   */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password field only
   */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Submit login form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Complete login flow
   */
  async login(email: string, password: string): Promise<void> {
    await this.navigate();
    await this.fillCredentials(email, password);
    await this.submit();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: "visible", timeout: 5000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Verify error message is displayed
   */
  async expectErrorMessage(expectedText?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    if (expectedText) {
      await expect(this.errorMessage).toContainText(expectedText);
    }
  }

  /**
   * Check remember me option
   */
  async setRememberMe(checked: boolean): Promise<void> {
    const isChecked = await this.rememberMeCheckbox.isChecked();
    if (isChecked !== checked) {
      await this.rememberMeCheckbox.click();
    }
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  /**
   * Verify login page is displayed
   */
  async expectLoginPage(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Verify form is empty
   */
  async expectFormEmpty(): Promise<void> {
    await expect(this.emailInput).toHaveValue("");
    await expect(this.passwordInput).toHaveValue("");
  }

  /**
   * Get submit button state
   */
  async isSubmitButtonEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  /**
   * Verify submit button is disabled
   */
  async expectSubmitButtonDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }

  /**
   * Verify submit button is enabled
   */
  async expectSubmitButtonEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }
}
