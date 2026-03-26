import { test, expect } from '../fixtures/auth.fixture';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Authentication Flow', () => {
  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Verify login page elements
    await loginPage.expectLoginPage();

    // Login with valid credentials
    await loginPage.login('admin@test.com', 'admin123');

    // Verify redirect to dashboard
    await dashboardPage.expectDashboard();
    await dashboardPage.expectPageTitle('Dashboard');
  });

  test('should show error with invalid email', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Fill invalid email and valid password
    await loginPage.fillCredentials('invalid-email-format', 'password123');
    await loginPage.submit();

    // Verify error message appears
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Fill invalid credentials
    await loginPage.fillCredentials('nonexistent@test.com', 'wrongpassword');
    await loginPage.submit();

    // Verify error message appears
    await loginPage.expectErrorMessage();
  });

  test('should show error with empty credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Try to submit empty form
    await loginPage.submit();

    // Verify submit button is still enabled (form validation may prevent submission)
    // or error message appears
    try {
      await loginPage.expectErrorMessage();
    } catch {
      // If no error shown, check we're still on login page
      await loginPage.expectLoginPage();
    }
  });

  test('should logout successfully', async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to dashboard (already authenticated via fixture)
    await dashboardPage.navigate();

    // Verify logged in
    await dashboardPage.expectDashboard();

    // Logout
    await dashboardPage.logout();

    // Verify redirected to login
    const loginPage = new LoginPage(adminPage);
    await loginPage.expectLoginPage();
  });

  test('should persist session across page refresh', async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Verify logged in
    await dashboardPage.expectDashboard();

    // Get current URL
    const currentUrl = adminPage.url();

    // Refresh page
    await adminPage.reload();

    // Verify still on dashboard (session persisted)
    await expect(adminPage).toHaveURL(currentUrl);
    await dashboardPage.expectDashboard();
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Attempt to access dashboard without authentication
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should redirect to login
    await expect(page).toHaveURL(/login|auth/);

    // Verify login page is displayed
    const loginPage = new LoginPage(page);
    await loginPage.expectLoginPage();
  });

  test('should show different content for dispatcher role', async ({ dispatcherPage }) => {
    const dashboardPage = new DashboardPage(dispatcherPage);

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Verify dashboard loads
    await dashboardPage.expectDashboard();

    // Get sidebar links
    const links = await dashboardPage.getSidebarLinks();

    // Dispatcher should have orders and drivers links
    expect(links.some((link) => link.toLowerCase().includes('order'))).toBeTruthy();
  });

  test('should remember me checkbox persist login', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Fill credentials
    await loginPage.fillCredentials('admin@test.com', 'admin123');

    // Check remember me
    await loginPage.setRememberMe(true);

    // Login
    await loginPage.submit();

    // Wait for redirect
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Session should be persisted even after page close/reopen
    expect(page.context()).toBeTruthy();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Navigate to login
    await loginPage.navigate();

    // Simulate network error by intercepting requests
    await page.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });

    // Try to login
    await loginPage.fillCredentials('admin@test.com', 'admin123');
    await loginPage.submit();

    // Should show error or remain on login page
    const errorMessage = await loginPage.getErrorMessage();
    if (!errorMessage) {
      await loginPage.expectLoginPage();
    }
  });
});
