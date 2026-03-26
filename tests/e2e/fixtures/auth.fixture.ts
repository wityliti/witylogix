import { test as base, expect } from '@playwright/test';
import * as path from 'path';

export type AuthUser = {
  email: string;
  password: string;
  role: 'admin' | 'dispatcher' | 'driver';
  name: string;
};

export const testUsers: Record<string, AuthUser> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    role: 'admin',
    name: 'Admin User',
  },
  dispatcher: {
    email: process.env.TEST_DISPATCHER_EMAIL || 'dispatcher@test.com',
    password: process.env.TEST_DISPATCHER_PASSWORD || 'dispatcher123',
    role: 'dispatcher',
    name: 'Dispatcher User',
  },
  driver: {
    email: process.env.TEST_DRIVER_EMAIL || 'driver@test.com',
    password: process.env.TEST_DRIVER_PASSWORD || 'driver123',
    role: 'driver',
    name: 'Driver User',
  },
};

type AuthFixtures = {
  authenticatedPage: any;
  adminPage: any;
  dispatcherPage: any;
  driverPage: any;
};

/**
 * Login helper function
 */
async function login(page: any, user: AuthUser): Promise<void> {
  const loginUrl = new URL('/login', page.context().baseURL || 'http://localhost:3002').toString();
  await page.goto(loginUrl, { waitUntil: 'networkidle' });

  // Fill credentials
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Verify logged in
  await expect(page.locator('[data-testid="user-menu"], [data-testid="sidebar"]')).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Authenticated page fixture - uses stored auth state
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    // Use pre-authenticated context if available
    const authFile = path.join(__dirname, '../auth.json');
    try {
      // Context should already have auth state from playwright.config
      await page.goto('/dashboard');
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('body')).toBeTruthy();
    } catch (error) {
      // Fallback to login
      console.warn('Auth state not available, logging in manually');
      await login(page, testUsers.admin);
    }
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await login(page, testUsers.admin);
    await use(page);
  },

  dispatcherPage: async ({ page }, use) => {
    await login(page, testUsers.dispatcher);
    await use(page);
  },

  driverPage: async ({ page }, use) => {
    await login(page, testUsers.driver);
    await use(page);
  },
});

export { expect };
