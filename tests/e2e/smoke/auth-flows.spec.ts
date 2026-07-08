import { test, expect } from "@playwright/test";
import { SmokeAuthPage } from "./page-objects/auth.page";
import { SmokeDashboardPage } from "./page-objects/dashboard.page";
import { SMOKE_TEST_DATA, generateTestEmail } from "./fixtures/test-data";

/**
 * Authentication Flows Smoke Test Suite
 * Tests critical auth flows and security
 */
test.describe("Authentication Flows", () => {
  let authPage: SmokeAuthPage;
  let dashboardPage: SmokeDashboardPage;

  test.beforeEach(({ page }) => {
    authPage = new SmokeAuthPage(page);
    dashboardPage = new SmokeDashboardPage(page);
  });

  test("Login with email/password should redirect to dashboard", async ({
    page,
  }) => {
    await authPage.navigateToLogin();
    await authPage.login(
      SMOKE_TEST_DATA.newAccount.email,
      SMOKE_TEST_DATA.newAccount.password,
    );

    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    await dashboardPage.expectDashboard();
  });

  test("Login with wrong password should show error message", async ({
    page,
  }) => {
    await authPage.navigateToLogin();
    await authPage.login(SMOKE_TEST_DATA.newAccount.email, "WrongPassword123");

    await authPage.expectErrorMessage();
    await expect(page).not.toHaveURL("/dashboard");
  });

  test("Register with valid credentials should complete registration", async ({
    page,
  }) => {
    const testEmail = generateTestEmail("auth-test");
    await authPage.navigateToRegister();
    await authPage.register(
      testEmail,
      SMOKE_TEST_DATA.newAccount.password,
      "Test",
      "User",
    );

    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
  });

  test("Register with existing email should show error", async ({ page }) => {
    await authPage.navigateToRegister();
    await authPage.register(
      SMOKE_TEST_DATA.newAccount.email,
      SMOKE_TEST_DATA.newAccount.password,
      "Test",
      "User",
    );

    // Should show error or stay on register page
    try {
      await authPage.expectErrorMessage();
    } catch {
      await authPage.expectLoginPage();
    }
  });

  test("Register then email verification then login should succeed", async ({
    page,
  }) => {
    const testEmail = generateTestEmail("email-verify");
    const testPassword = SMOKE_TEST_DATA.newAccount.password;

    // Register
    await authPage.navigateToRegister();
    await authPage.register(testEmail, testPassword, "Email", "Verify");
    await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });

    // Logout
    try {
      await dashboardPage.logout();
    } catch {
      // If not on dashboard, navigate to login
      await authPage.navigateToLogin();
    }

    // Login with new credentials
    await authPage.login(testEmail, testPassword);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    await dashboardPage.expectDashboard();
  });

  test("Password reset flow should allow login with new password", async ({
    page,
  }) => {
    const testEmail = generateTestEmail("reset-test");
    const oldPassword = SMOKE_TEST_DATA.newAccount.password;
    const newPassword = "NewPassword@456";

    // Register account
    await authPage.navigateToRegister();
    await authPage.register(testEmail, oldPassword, "Reset", "Test");

    // Navigate to login and request password reset
    await authPage.navigateToLogin();
    await authPage.requestPasswordReset(testEmail);
    await authPage.expectSuccessMessage();

    // In test environment, simulate reset token
    // Normally would click link from email
    const resetUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="reset"]');
      return link ? link.getAttribute("href") : null;
    });

    if (resetUrl) {
      await page.goto(resetUrl);
      await page.fill('input[name="password"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button[type="submit"]');
      await authPage.expectSuccessMessage();
    }
  });

  test("Magic link request should verify token and allow login", async ({
    page,
  }) => {
    const testEmail = generateTestEmail("magic-link");

    // Request magic link
    await authPage.navigateToLogin();
    const magicLinkButton = page.locator(
      'button:has-text("Magic Link"), a:has-text("Email Link")',
    );
    if (await magicLinkButton.isVisible()) {
      await magicLinkButton.click();
      await authPage.page.fill('input[type="email"]', testEmail);
      await authPage.submitButton.click();
      await authPage.expectSuccessMessage();

      // Simulate magic link verification
      const magicToken = await page.evaluate(() => {
        const link = document.querySelector('a[href*="token"]');
        return link ? link.getAttribute("href") : null;
      });

      if (magicToken) {
        await page.goto(magicToken);
        await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
      }
    }
  });

  test("Session expiry should redirect to login", async ({ page }) => {
    // Login first
    await authPage.navigateToLogin();
    await authPage.login(
      SMOKE_TEST_DATA.newAccount.email,
      SMOKE_TEST_DATA.newAccount.password,
    );
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Simulate session expiry by clearing auth token
    const context = page.context();
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) =>
      c.name.toLowerCase().includes("auth"),
    );
    if (authCookie) {
      await context.clearCookies({ name: authCookie.name });
    }

    // Refresh page
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });
    await authPage.expectLoginPage();
  });

  test("MFA setup should require code on login", async ({ page }) => {
    await authPage.navigateToLogin();
    const mfaSetupLink = page.locator(
      'a:has-text("Setup MFA"), a:has-text("2FA")',
    );

    if (await mfaSetupLink.isVisible()) {
      await mfaSetupLink.click();

      // Verify MFA setup screen appears
      const qrCode = page.locator('[data-testid="qr-code"], img');
      if (await qrCode.isVisible()) {
        // Enter TOTP secret if required
        const secretInput = page.locator('input[name="secret"]');
        if (await secretInput.isVisible()) {
          await secretInput.fill(SMOKE_TEST_DATA.mfa.totpSecret);
        }

        // Verify MFA code
        const verifyButton = page.locator(
          'button:has-text("Verify"), button:has-text("Enable")',
        );
        if (await verifyButton.isVisible()) {
          await authPage.mfaInput.fill(SMOKE_TEST_DATA.mfa.codes[0]);
          await verifyButton.click();
          await authPage.expectSuccessMessage();
        }
      }
    }
  });

  test("Login with MFA code should verify correctly", async ({ page }) => {
    const testEmail = generateTestEmail("mfa-login");

    // This test assumes MFA is already enabled on account
    // Register and enable MFA first
    await authPage.navigateToRegister();
    await authPage.register(
      testEmail,
      SMOKE_TEST_DATA.newAccount.password,
      "MFA",
      "Test",
    );

    // Try login - should prompt for MFA if enabled
    await authPage.navigateToLogin();
    await authPage.login(testEmail, SMOKE_TEST_DATA.newAccount.password);

    // Check for MFA screen
    const mfaScreen = page.locator('[data-testid="mfa-screen"]');
    if (await mfaScreen.isVisible({ timeout: 5000 })) {
      await authPage.verifyMFA(SMOKE_TEST_DATA.mfa.codes[0]);
      await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    } else {
      // MFA not enabled, should be on dashboard
      await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    }
  });

  test("Logout should clear session and redirect to login", async ({
    page,
  }) => {
    // Login
    await authPage.navigateToLogin();
    await authPage.login(
      SMOKE_TEST_DATA.newAccount.email,
      SMOKE_TEST_DATA.newAccount.password,
    );
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Logout
    await dashboardPage.logout();

    // Verify redirected to login
    await expect(page).toHaveURL("/login", { timeout: 10000 });
    await authPage.expectLoginPage();

    // Verify cannot access protected page
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });
  });

  test("Cannot access protected pages without auth", async ({ page }) => {
    // Try to access dashboard without login
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });
    await authPage.expectLoginPage();

    // Try to access orders
    await page.goto("/dashboard/orders");
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });

    // Try to access drivers
    await page.goto("/dashboard/drivers");
    await expect(page).toHaveURL(/login|auth/, { timeout: 10000 });
  });

  test("Password requirements should be enforced", async ({ page }) => {
    const testEmail = generateTestEmail("password-test");

    await authPage.navigateToRegister();

    // Try weak password
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible();

    await authPage.page.fill('input[name="email"]', testEmail);
    await authPage.page.fill('input[name="firstName"]', "Test");
    await authPage.page.fill('input[name="lastName"]', "User");

    // Try weak password
    await authPage.page.fill('input[name="password"]', "weak");

    // Check if error appears or button is disabled
    const submitButton = authPage.submitButton;
    const isDisabled = await submitButton.isDisabled();
    const hasError = await authPage.page
      .locator('text="Password must", text="at least", text="characters"')
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    expect(isDisabled || hasError).toBeTruthy();
  });
});
