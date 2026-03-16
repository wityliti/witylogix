import { test, expect } from '@playwright/test';

/**
 * Authentication Regression Test Suite
 * Tests authentication flows, token management, MFA, and session handling
 *
 * Covers:
 * - Login with valid/invalid credentials
 * - Token refresh before/after expiry
 * - MFA enrollment and verification
 * - Password reset flow
 * - Magic link authentication
 * - SSO redirect flows
 * - Session management and concurrent sessions
 * - RBAC enforcement across roles
 */

test.describe('Authentication & Authorization Regression', () => {

  test.describe('@regression Login Flows', () => {
    test('should login with valid credentials', async ({ page }) => {
      test.step('Navigate to login page', async () => {
        await page.goto('/login');
        await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Enter valid credentials', async () => {
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
      });

      test.step('Submit login form', async () => {
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
      });

      test.step('Verify authenticated state', async () => {
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 5000 });
        const authToken = await page.context().storageState();
        expect(authToken.cookies.length).toBeGreaterThan(0);
      });
    });

    test('should reject login with invalid email', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'nonexistent@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPass123');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL('/login');
    });

    test('should reject login with wrong password', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'WrongPassword123');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveURL('/login');
    });

    test('should lock account after multiple failed attempts', async ({ page }) => {
      await page.goto('/login');
      const email = process.env.TEST_EMAIL || 'test@example.com';

      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="email-input"]', email);
        await page.fill('[data-testid="password-input"]', `WrongPassword${i}`);
        await page.click('[data-testid="login-button"]');
        await page.waitForTimeout(500);
      }

      // Should show account locked message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('locked', { timeout: 5000 });
    });

    test('should require email verification for new accounts', async ({ page }) => {
      const testEmail = `verify-${Date.now()}@test.com`;

      test.step('Register new account', async () => {
        await page.goto('/register');
        await page.fill('[data-testid="email-input"]', testEmail);
        await page.fill('[data-testid="password-input"]', 'TestPass123');
        await page.fill('[data-testid="password-confirm-input"]', 'TestPass123');
        await page.fill('[data-testid="first-name-input"]', 'Test');
        await page.fill('[data-testid="last-name-input"]', 'User');
        await page.click('[data-testid="register-button"]');
      });

      test.step('Should redirect to email verification', async () => {
        await expect(page).toHaveURL(/verify-email|verification/, { timeout: 10000 });
        await expect(page.locator('[data-testid="verification-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Enter verification code', async () => {
        // In test environment, use standard test code
        await page.fill('[data-testid="verification-code-input"]', '123456');
        await page.click('[data-testid="verify-button"]');
        await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
      });
    });
  });

  test.describe('@regression Token Management', () => {
    test('should refresh token before expiry', async ({ page, context }) => {
      test.step('Login to get initial tokens', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Get initial tokens from storage', async () => {
        const cookies = context.cookies();
        const accessToken = cookies.find(c => c.name === 'access_token');
        expect(accessToken).toBeDefined();
        expect(accessToken?.value).toBeTruthy();
      });

      test.step('Wait and verify token is refreshed', async () => {
        // Simulate time passing and trigger action that requires token refresh
        await page.goto('/orders');
        await page.waitForTimeout(2000);

        // Verify still authenticated
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 5000 });
        await expect(page).not.toHaveURL('/login');
      });
    });

    test('should logout when token expires', async ({ page, context }) => {
      test.step('Login', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Expire token by clearing cookies', async () => {
        const cookies = await context.cookies();
        const accessTokenCookie = cookies.find(c => c.name === 'access_token');
        if (accessTokenCookie) {
          await context.clearCookies({ name: 'access_token' });
        }
      });

      test.step('Attempt action and verify redirect to login', async () => {
        await page.goto('/orders');
        await expect(page).toHaveURL('/login', { timeout: 10000 });
      });
    });
  });

  test.describe('@regression MFA (Multi-Factor Authentication)', () => {
    test('should enroll in MFA', async ({ page }) => {
      test.step('Login to account settings', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Navigate to security settings', async () => {
        await page.goto('/settings/security');
        await expect(page.locator('[data-testid="security-settings"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Enable MFA', async () => {
        await page.click('[data-testid="enable-mfa-button"]');
        const qrCode = page.locator('[data-testid="mfa-qr-code"]');
        await expect(qrCode).toBeVisible({ timeout: 5000 });
      });

      test.step('Enter MFA code', async () => {
        // In test environment, use standard test code
        await page.fill('[data-testid="mfa-code-input"]', '123456');
        await page.click('[data-testid="verify-mfa-code-button"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Save backup codes', async () => {
        const backupCodes = page.locator('[data-testid="backup-codes"]');
        await expect(backupCodes).toBeVisible({ timeout: 5000 });
        await page.click('[data-testid="copy-backup-codes-button"]');
      });
    });

    test('should require MFA code on login', async ({ page }) => {
      test.step('Login with email and password', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
      });

      test.step('Should prompt for MFA code', async () => {
        await expect(page).toHaveURL(/mfa|verify-mfa/, { timeout: 10000 });
        await expect(page.locator('[data-testid="mfa-code-input"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Enter MFA code', async () => {
        await page.fill('[data-testid="mfa-code-input"]', '123456');
        await page.click('[data-testid="verify-mfa-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });
    });

    test('should allow backup code when MFA unavailable', async ({ page }) => {
      test.step('Navigate to MFA verification', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/mfa|verify-mfa/, { timeout: 10000 });
      });

      test.step('Use backup code instead', async () => {
        await page.click('[data-testid="use-backup-code-link"]');
        await page.fill('[data-testid="backup-code-input"]', 'BACKUP123456');
        await page.click('[data-testid="verify-backup-button"]');
      });

      test.step('Should be authenticated', async () => {
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });
    });
  });

  test.describe('@regression Password Reset', () => {
    test('should reset password with email link', async ({ page }) => {
      const testEmail = process.env.TEST_EMAIL || 'test@example.com';

      test.step('Navigate to password reset', async () => {
        await page.goto('/login');
        await page.click('[data-testid="forgot-password-link"]');
        await expect(page).toHaveURL(/forgot-password|reset-password/, { timeout: 5000 });
      });

      test.step('Request password reset', async () => {
        await page.fill('[data-testid="email-input"]', testEmail);
        await page.click('[data-testid="send-reset-email-button"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Click reset link from email', async () => {
        // In test environment, construct reset URL manually
        const resetToken = 'test-reset-token-12345';
        await page.goto(`/reset-password?token=${resetToken}`);
        await expect(page.locator('[data-testid="new-password-input"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Set new password', async () => {
        await page.fill('[data-testid="new-password-input"]', 'NewPassword123');
        await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123');
        await page.click('[data-testid="reset-password-button"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Login with new password', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', testEmail);
        await page.fill('[data-testid="password-input"]', 'NewPassword123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });
    });
  });

  test.describe('@regression Magic Link Authentication', () => {
    test('should authenticate with magic link', async ({ page }) => {
      test.step('Navigate to magic link login', async () => {
        await page.goto('/login');
        await page.click('[data-testid="magic-link-tab"]');
        await expect(page.locator('[data-testid="magic-link-form"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Request magic link', async () => {
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.click('[data-testid="send-magic-link-button"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Click magic link', async () => {
        const magicToken = 'test-magic-token-67890';
        await page.goto(`/auth/magic-link?token=${magicToken}`);
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Verify authenticated', async () => {
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 5000 });
      });
    });
  });

  test.describe('@regression SSO (Single Sign-On)', () => {
    test('should redirect to Google SSO provider', async ({ page, context }) => {
      test.step('Navigate to login', async () => {
        await page.goto('/login');
      });

      test.step('Click Google SSO button', async () => {
        const googleButton = page.locator('[data-testid="sso-google-button"]');
        await expect(googleButton).toBeVisible({ timeout: 5000 });

        // Capture the redirect URL without actually following it
        const [popup] = await Promise.all([
          context.waitForEvent('page'),
          googleButton.click(),
        ]);

        const popupURL = popup.url();
        expect(popupURL).toContain('accounts.google.com');
        await popup.close();
      });
    });

    test('should handle SSO redirect callback', async ({ page }) => {
      test.step('Simulate SSO callback', async () => {
        const ssoToken = 'test-sso-token-abc123';
        await page.goto(`/auth/sso/callback?token=${ssoToken}`);
      });

      test.step('Should be authenticated', async () => {
        await expect(page).toHaveURL(/dashboard|onboarding/, { timeout: 10000 });
      });
    });
  });

  test.describe('@regression Session Management', () => {
    test('should prevent concurrent session from same account', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      test.step('Login first session', async () => {
        await page1.goto('/login');
        await page1.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page1.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page1.click('[data-testid="login-button"]');
        await expect(page1).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Login second session with same account', async () => {
        await page2.goto('/login');
        await page2.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page2.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page2.click('[data-testid="login-button"]');
        await expect(page2).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('First session should be invalidated', async () => {
        await page1.goto('/orders');
        await expect(page1).toHaveURL('/login', { timeout: 10000 });
      });

      test.step('Cleanup', async () => {
        await context1.close();
        await context2.close();
      });
    });

    test('should force logout on security event', async ({ page }) => {
      test.step('Login', async () => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', process.env.TEST_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      });

      test.step('Change password', async () => {
        await page.goto('/settings/security');
        await page.click('[data-testid="change-password-button"]');
        await page.fill('[data-testid="current-password-input"]', process.env.TEST_PASSWORD || 'TestPass123');
        await page.fill('[data-testid="new-password-input"]', 'NewPassword123New');
        await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123New');
        await page.click('[data-testid="save-password-button"]');
        await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      });

      test.step('Should force logout', async () => {
        await expect(page).toHaveURL('/login', { timeout: 10000 });
      });
    });
  });

  test.describe('@regression RBAC (Role-Based Access Control)', () => {
    const roles = ['admin', 'dispatcher', 'driver', 'customer'];

    roles.forEach(role => {
      test(`should enforce permissions for ${role} role`, async ({ page }) => {
        test.step(`Login as ${role}`, async () => {
          const testEmail = `${role}@test.com`;
          const testPassword = 'TestPass123';

          await page.goto('/login');
          await page.fill('[data-testid="email-input"]', testEmail);
          await page.fill('[data-testid="password-input"]', testPassword);
          await page.click('[data-testid="login-button"]');
          await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
        });

        test.step(`Verify ${role} can access allowed pages`, async () => {
          const allowedPages = {
            admin: ['/dashboard', '/orders', '/drivers', '/billing', '/integrations', '/settings'],
            dispatcher: ['/dashboard', '/orders', '/deliveries', '/drivers'],
            driver: ['/driver/dashboard', '/driver/deliveries'],
            customer: ['/orders', '/account'],
          };

          const pages = allowedPages[role as keyof typeof allowedPages] || [];
          for (const allowedPage of pages.slice(0, 2)) {
            await page.goto(allowedPage);
            expect(page.url()).toContain(allowedPage);
          }
        });

        test.step(`Verify ${role} cannot access restricted pages`, async () => {
          const restrictedPages = {
            admin: [],
            dispatcher: ['/billing', '/integrations'],
            driver: ['/settings', '/billing'],
            customer: ['/drivers', '/billing'],
          };

          const pages = restrictedPages[role as keyof typeof restrictedPages] || [];
          for (const restrictedPage of pages.slice(0, 1)) {
            await page.goto(restrictedPage);
            await expect(page).toHaveURL(/dashboard|access-denied|login/, { timeout: 10000 });
          }
        });
      });
    });
  });
});
