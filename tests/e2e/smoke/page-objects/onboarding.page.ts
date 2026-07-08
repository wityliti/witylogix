import { Page, Locator, expect } from "@playwright/test";

/**
 * Onboarding Page Object Model for Smoke Tests
 * Handles complete onboarding flow
 */
export class SmokeOnboardingPage {
  readonly page: Page;
  readonly stepTitle: Locator;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly skipButton: Locator;
  readonly finishButton: Locator;
  readonly progressBar: Locator;
  readonly emailVerificationInput: Locator;
  readonly verifyEmailButton: Locator;
  readonly deploymentOptions: Locator;
  readonly companyNameInput: Locator;
  readonly companyWebsiteInput: Locator;
  readonly companySizeSelect: Locator;
  readonly industrySelect: Locator;
  readonly goalsCheckboxes: Locator;
  readonly integrationCheckboxes: Locator;
  readonly layoutOptions: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stepTitle = page.locator('h1, [data-testid="step-title"]');
    this.nextButton = page.locator(
      'button:has-text("Next"), [data-testid="next-btn"]',
    );
    this.prevButton = page.locator(
      'button:has-text("Previous"), [data-testid="prev-btn"]',
    );
    this.skipButton = page.locator(
      'button:has-text("Skip"), [data-testid="skip-btn"]',
    );
    this.finishButton = page.locator(
      'button:has-text("Finish"), button:has-text("Complete")',
    );
    this.progressBar = page.locator('[data-testid="progress-bar"], .progress');
    this.emailVerificationInput = page.locator(
      'input[name="verificationCode"], input[placeholder*="code"]',
    );
    this.verifyEmailButton = page.locator(
      'button:has-text("Verify"), button:has-text("Confirm")',
    );
    this.deploymentOptions = page.locator(
      '[data-testid="deployment-option"], .radio-option, [role="radio"]',
    );
    this.companyNameInput = page.locator(
      'input[name="companyName"], input[placeholder*="Company name"]',
    );
    this.companyWebsiteInput = page.locator(
      'input[name="website"], input[type="url"]',
    );
    this.companySizeSelect = page.locator(
      'select[name="size"], [data-testid="size-select"]',
    );
    this.industrySelect = page.locator(
      'select[name="industry"], [data-testid="industry-select"]',
    );
    this.goalsCheckboxes = page.locator(
      'input[name*="goal"], [data-testid="goal-checkbox"]',
    );
    this.integrationCheckboxes = page.locator(
      'input[name*="integration"], [data-testid="integration-checkbox"]',
    );
    this.layoutOptions = page.locator(
      '[data-testid="layout-option"], .layout-choice, [role="radio"]',
    );
    this.submitButton = page.locator('button[type="submit"]');
  }

  /**
   * Navigate to onboarding
   */
  async navigateToOnboarding(): Promise<void> {
    await this.page.goto("/onboarding", { waitUntil: "networkidle" });
    await expect(this.stepTitle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify email step
   */
  async verifyEmail(code: string): Promise<void> {
    await this.emailVerificationInput.fill(code);
    await this.verifyEmailButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Select deployment type
   */
  async selectDeployment(type: "cloud" | "self-hosted"): Promise<void> {
    const option = this.page.locator(
      `[data-testid="deployment-${type}"], button:has-text("${type}")`,
    );
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
  }

  /**
   * Fill company information
   */
  async fillCompanyInfo(
    name: string,
    website: string,
    size: string,
  ): Promise<void> {
    await this.companyNameInput.fill(name);
    await this.companyWebsiteInput.fill(website);
    await this.companySizeSelect.selectOption(size);
  }

  /**
   * Select industry
   */
  async selectIndustry(industry: string): Promise<void> {
    await this.industrySelect.selectOption(industry);
  }

  /**
   * Select goals
   */
  async selectGoals(goalNames: string[]): Promise<void> {
    for (const goalName of goalNames) {
      const checkbox = this.page.locator(
        `[data-testid="goal-${goalName}"], label:has-text("${goalName}") input`,
      );
      await expect(checkbox).toBeVisible({ timeout: 5000 });
      await checkbox.check();
    }
  }

  /**
   * Select integrations
   */
  async selectIntegrations(integrationNames: string[]): Promise<void> {
    for (const integrationName of integrationNames) {
      const checkbox = this.page.locator(
        `[data-testid="integration-${integrationName}"], label:has-text("${integrationName}") input`,
      );
      await expect(checkbox).toBeVisible({ timeout: 5000 });
      await checkbox.check();
    }
  }

  /**
   * Select dashboard layout
   */
  async selectLayout(layoutName: string): Promise<void> {
    const option = this.page.locator(
      `[data-testid="layout-${layoutName}"], button:has-text("${layoutName}")`,
    );
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
  }

  /**
   * Click next button
   */
  async clickNext(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForLoadState("networkidle");
    await expect(this.stepTitle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Click previous button
   */
  async clickPrevious(): Promise<void> {
    await this.prevButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Skip current step
   */
  async skipStep(): Promise<void> {
    await this.skipButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Finish onboarding
   */
  async finishOnboarding(): Promise<void> {
    await this.finishButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get current step
   */
  async getCurrentStep(): Promise<string> {
    const text = await this.stepTitle.textContent();
    return text || "";
  }

  /**
   * Expect onboarding page
   */
  async expectOnboardingPage(): Promise<void> {
    await expect(this.stepTitle).toBeVisible();
    await expect(this.nextButton).toBeVisible();
  }
}
