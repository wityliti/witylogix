import { Page, Locator, expect } from "@playwright/test";

/**
 * Auth Page Object Model for Smoke Tests
 * Handles login, registration, and auth flows
 */
export class SmokeAuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly pageTitle: Locator;
  readonly mfaInput: Locator;
  readonly mfaSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
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
    this.successMessage = page.locator(
      '[data-testid="success-message"], .success, [role="status"]',
    );
    this.registerLink = page.locator(
      'a:has-text("Register"), a:has-text("Sign up"), a:has-text("Create account")',
    );
    this.forgotPasswordLink = page.locator(
      'a:has-text("Forgot password"), a:has-text("forgot")',
    );
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    this.mfaInput = page.locator(
      'input[name="mfa"], input[name="code"], input[name="totp"]',
    );
    this.mfaSubmitButton = page.locator(
      'button:has-text("Verify"), button:has-text("Submit")',
    );
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin(): Promise<void> {
    await this.page.goto("/login", { waitUntil: "networkidle" });
    await expect(this.emailInput).toBeVisible({ timeout: 5000 });
  }

  /**
   * Navigate to register page
   */
  async navigateToRegister(): Promise<void> {
    await this.page.goto("/register", { waitUntil: "networkidle" });
    await expect(this.page.locator("form")).toBeVisible({ timeout: 5000 });
  }

  /**
   * Perform login
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Register new account
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.navigateToRegister();
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="firstName"]', firstName);
    await this.page.fill('input[name="lastName"]', lastName);
    await this.submitButton.click();
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.page.fill('input[type="email"]', email);
    await this.submitButton.click();
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(code: string): Promise<void> {
    await this.mfaInput.fill(code);
    await this.mfaSubmitButton.click();
  }

  /**
   * Expect login page
   */
  async expectLoginPage(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Expect error message
   */
  async expectErrorMessage(expectedText?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    if (expectedText) {
      await expect(this.errorMessage).toContainText(expectedText);
    }
  }

  /**
   * Expect success message
   */
  async expectSuccessMessage(expectedText?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 5000 });
    if (expectedText) {
      await expect(this.successMessage).toContainText(expectedText);
    }
  }

  /**
   * Expect MFA screen
   */
  async expectMFAScreen(): Promise<void> {
    await expect(this.mfaInput).toBeVisible({ timeout: 5000 });
    await expect(this.mfaSubmitButton).toBeVisible();
  }
}
