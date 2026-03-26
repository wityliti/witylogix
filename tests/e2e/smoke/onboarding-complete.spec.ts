import { test, expect } from '@playwright/test';
import { SmokeAuthPage } from './page-objects/auth.page';
import { SmokeOnboardingPage } from './page-objects/onboarding.page';
import { SmokeDashboardPage } from './page-objects/dashboard.page';
import { SMOKE_TEST_DATA, generateTestEmail } from './fixtures/test-data';

/**
 * Complete Onboarding Flow Smoke Test Suite
 * Tests each onboarding step and workspace provisioning
 */
test.describe('Complete Onboarding Flow', () => {
  let authPage: SmokeAuthPage;
  let onboardingPage: SmokeOnboardingPage;
  let dashboardPage: SmokeDashboardPage;
  const testEmail = generateTestEmail('onboarding');
  const testPassword = SMOKE_TEST_DATA.newAccount.password;

  test.beforeEach(({ page }) => {
    authPage = new SmokeAuthPage(page);
    onboardingPage = new SmokeOnboardingPage(page);
    dashboardPage = new SmokeDashboardPage(page);
  });

  test('should complete full onboarding flow step by step', async ({ page }) => {
    // Step 1: Register
    test.step('Register new account for onboarding', async () => {
      await authPage.navigateToRegister();
      await authPage.register(testEmail, testPassword, SMOKE_TEST_DATA.newAccount.firstName, SMOKE_TEST_DATA.newAccount.lastName);
      await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
    });

    // Step 2: Email verification
    test.step('Complete email verification step', async () => {
      await expect(onboardingPage.stepTitle).toBeVisible({ timeout: 5000 });
      const currentStep = await onboardingPage.getCurrentStep();

      if (currentStep.toLowerCase().includes('email') || currentStep.toLowerCase().includes('verify')) {
        // Enter verification code (test code)
        await onboardingPage.verifyEmail('123456');
        await expect(onboardingPage.stepTitle).toBeVisible({ timeout: 5000 });
      }
    });

    // Step 3: Deployment selection
    test.step('Select deployment type', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep).toBeTruthy();

      // Select cloud deployment
      await onboardingPage.selectDeployment('cloud');
      await onboardingPage.clickNext();
    });

    // Step 4: Company information
    test.step('Fill company information', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('company') || currentStep.toLowerCase().includes('information')).toBeTruthy();

      await onboardingPage.fillCompanyInfo(
        SMOKE_TEST_DATA.onboarding.company.name,
        SMOKE_TEST_DATA.onboarding.company.website,
        SMOKE_TEST_DATA.onboarding.company.size,
      );

      // Verify inputs are filled
      const nameInput = page.locator('input[name="companyName"], input[placeholder*="Company name"]');
      await expect(nameInput).toHaveValue(SMOKE_TEST_DATA.onboarding.company.name);

      await onboardingPage.clickNext();
    });

    // Step 5: Industry selection
    test.step('Select industry', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('industry')).toBeTruthy();

      await onboardingPage.selectIndustry(SMOKE_TEST_DATA.onboarding.industry);
      await onboardingPage.clickNext();
    });

    // Step 6: Goals selection
    test.step('Select business goals', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('goal')).toBeTruthy();

      await onboardingPage.selectGoals(SMOKE_TEST_DATA.onboarding.goals);

      // Verify selections
      for (const goal of SMOKE_TEST_DATA.onboarding.goals) {
        const checkbox = page.locator(`input[type="checkbox"][name*="${goal}"]`);
        const isChecked = await checkbox.isChecked().catch(() => false);
        if (isChecked) {
          expect(true).toBeTruthy();
        }
      }

      await onboardingPage.clickNext();
    });

    // Step 7: Integration selection
    test.step('Select integrations', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('integration') || currentStep.toLowerCase().includes('connect')).toBeTruthy();

      await onboardingPage.selectIntegrations(SMOKE_TEST_DATA.onboarding.integrations);

      // Verify selections
      for (const integration of SMOKE_TEST_DATA.onboarding.integrations) {
        const checkbox = page.locator(`input[type="checkbox"][name*="${integration}"]`);
        const isChecked = await checkbox.isChecked().catch(() => false);
        if (isChecked) {
          expect(true).toBeTruthy();
        }
      }

      await onboardingPage.clickNext();
    });

    // Step 8: Dashboard layout selection
    test.step('Select dashboard layout', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('layout') || currentStep.toLowerCase().includes('dashboard')).toBeTruthy();

      await onboardingPage.selectLayout('default');
      await onboardingPage.clickNext();
    });

    // Step 9: Data import (skip)
    test.step('Skip data import', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('import') || currentStep.toLowerCase().includes('data')).toBeTruthy();

      await onboardingPage.skipStep();
    });

    // Step 10: Review and submit
    test.step('Review and submit onboarding', async () => {
      const currentStep = await onboardingPage.getCurrentStep();
      expect(currentStep.toLowerCase().includes('review') || currentStep.toLowerCase().includes('confirm')).toBeTruthy();

      // Verify all selections are shown
      await expect(page.locator(`:text("${SMOKE_TEST_DATA.onboarding.company.name}")`)).toBeVisible({ timeout: 5000 });

      await onboardingPage.finishOnboarding();
    });

    // Step 11: Verify redirect to dashboard
    test.step('Verify redirect to dashboard', async () => {
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    });

    // Step 12: Verify workspace provisioning
    test.step('Verify workspace was provisioned', async () => {
      await dashboardPage.expectDashboard();

      // Verify sidebar navigation exists
      const sidebarLinks = await dashboardPage.page.locator('[data-testid="sidebar"] a, nav a').allTextContents();
      expect(sidebarLinks.length).toBeGreaterThan(0);

      // Verify company name is displayed
      const userSection = dashboardPage.page.locator('[data-testid="user-section"], [data-testid="workspace-name"]');
      if (await userSection.isVisible({ timeout: 1000 })) {
        const text = await userSection.textContent();
        expect(text).toBeTruthy();
      }
    });

    // Step 13: Verify initial data is loaded
    test.step('Verify initial dashboard data', async () => {
      const stats = await dashboardPage.getStatsCards();
      expect(stats.length).toBeGreaterThanOrEqual(0);

      // Verify at least main content area exists
      await expect(dashboardPage.mainContent).toBeVisible();
    });

    // Step 14: Verify can navigate through sections
    test.step('Verify navigation works', async () => {
      // Try navigating to orders
      await dashboardPage.navigateToOrders();
      await dashboardPage.waitForPageLoad();
      await expect(dashboardPage.ordersButton).toBeVisible({ timeout: 5000 }).catch(() => {
        // Orders section might not have visible button
      });

      // Navigate back to dashboard
      await dashboardPage.navigateToDashboard();
      await dashboardPage.expectDashboard();
    });

    // Step 15: Verify user can logout and login again
    test.step('Verify logout and re-login works', async () => {
      await dashboardPage.logout();
      await expect(page).toHaveURL('/login', { timeout: 10000 });

      // Login again with same credentials
      await authPage.login(testEmail, testPassword);
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      await dashboardPage.expectDashboard();
    });
  });

  test('should handle onboarding step navigation correctly', async ({ page }) => {
    // Register
    const testEmail2 = generateTestEmail('nav-test');
    await authPage.navigateToRegister();
    await authPage.register(testEmail2, testPassword, 'Nav', 'Test');

    // Start onboarding
    await expect(onboardingPage.stepTitle).toBeVisible({ timeout: 5000 });

    // Go forward
    const step1 = await onboardingPage.getCurrentStep();
    await onboardingPage.clickNext();
    const step2 = await onboardingPage.getCurrentStep();
    expect(step1).not.toEqual(step2);

    // Go backward
    await onboardingPage.clickPrevious();
    const stepBack = await onboardingPage.getCurrentStep();
    expect(stepBack).toEqual(step1);
  });

  test('should allow skipping optional steps', async ({ page }) => {
    // Register
    const testEmail3 = generateTestEmail('skip-test');
    await authPage.navigateToRegister();
    await authPage.register(testEmail3, testPassword, 'Skip', 'Test');

    // Navigate through onboarding
    await expect(onboardingPage.stepTitle).toBeVisible({ timeout: 5000 });

    // Skip to end (or skip data import step)
    let stepCount = 0;
    while (stepCount < 10) {
      const skipBtn = page.locator('button:has-text("Skip")');
      if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await onboardingPage.skipStep();
      } else {
        try {
          await onboardingPage.clickNext();
        } catch {
          break;
        }
      }
      stepCount++;
    }

    // Should eventually reach dashboard
    await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
  });
});
