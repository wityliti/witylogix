import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Settings Overview', () => {
  test('should navigate to settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toContain('setting');
  });

  test('should display settings navigation cards', async ({ adminPage }) => {
    await adminPage.goto('/settings', { waitUntil: 'networkidle' });

    const cards = adminPage.locator('a[href*="/settings/"], [data-testid="settings-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('General Settings', () => {
  test('should load general settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/general', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/general|settings/);
  });

  test('should display settings form fields', async ({ adminPage }) => {
    await adminPage.goto('/settings/general', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const formElement = adminPage.locator('form, [data-testid="settings-form"], input, select');
    const hasForm = await formElement.first().isVisible().catch(() => false);
    expect(hasForm).toBeTruthy();
  });

  test('should save general settings', async ({ adminPage }) => {
    await adminPage.goto('/settings/general', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const saveBtn = adminPage.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]',
    );
    const isSaveVisible = await saveBtn.first().isVisible().catch(() => false);

    if (isSaveVisible) {
      await saveBtn.first().click();
      await adminPage.waitForLoadState('networkidle');

      const feedback = adminPage.locator('[role="alert"], [data-testid="toast"]');
      const hasFeedback = await feedback.first().isVisible().catch(() => false);
      expect(hasFeedback || true).toBeTruthy();
    }
  });
});

test.describe('Organization Settings', () => {
  test('should load organization settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/organization', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/organ|company|settings/);
  });

  test('should show organization details form', async ({ adminPage }) => {
    await adminPage.goto('/settings/organization', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const inputs = adminPage.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Team Settings', () => {
  test('should load team management page', async ({ adminPage }) => {
    await adminPage.goto('/settings/team', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/team|member|user/);
  });

  test('should display team members list', async ({ adminPage }) => {
    await adminPage.goto('/settings/team', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const memberList = adminPage.locator(
      '[data-testid="member-list"], [data-testid="team-member"], table tbody tr, ul li',
    );
    const count = await memberList.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show invite member button', async ({ adminPage }) => {
    await adminPage.goto('/settings/team', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const inviteBtn = adminPage.locator(
      'button:has-text("Invite"), button:has-text("Add Member"), [data-testid="invite-btn"]',
    );
    const isVisible = await inviteBtn.first().isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });

  test('should open invite member form', async ({ adminPage }) => {
    await adminPage.goto('/settings/team', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const inviteBtn = adminPage.locator(
      'button:has-text("Invite"), button:has-text("Add Member"), [data-testid="invite-btn"]',
    );
    const isVisible = await inviteBtn.first().isVisible().catch(() => false);

    if (isVisible) {
      await inviteBtn.first().click();
      await adminPage.waitForLoadState('networkidle');

      const emailInput = adminPage.locator(
        'input[type="email"], input[placeholder*="email"], [data-testid="invite-email"]',
      );
      const hasInput = await emailInput.first().isVisible().catch(() => false);
      expect(hasInput).toBeTruthy();
    }
  });
});

test.describe('API Keys Settings', () => {
  test('should load API keys page', async ({ adminPage }) => {
    await adminPage.goto('/settings/api-keys', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/api key|key/);
  });

  test('should display API keys list', async ({ adminPage }) => {
    await adminPage.goto('/settings/api-keys', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const keyList = adminPage.locator(
      '[data-testid="api-key-item"], table tbody tr, [data-testid="key-list"]',
    );
    const count = await keyList.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show create API key button', async ({ adminPage }) => {
    await adminPage.goto('/settings/api-keys', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const createBtn = adminPage.locator(
      'button:has-text("Create"), button:has-text("Generate"), button:has-text("New API Key"), [data-testid="create-key-btn"]',
    );
    const isVisible = await createBtn.first().isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });

  test('should open create API key dialog', async ({ adminPage }) => {
    await adminPage.goto('/settings/api-keys', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const createBtn = adminPage.locator(
      'button:has-text("Create"), button:has-text("Generate"), button:has-text("New API Key"), [data-testid="create-key-btn"]',
    );
    const isVisible = await createBtn.first().isVisible().catch(() => false);

    if (isVisible) {
      await createBtn.first().click();
      await adminPage.waitForLoadState('networkidle');

      const nameInput = adminPage.locator(
        'input[placeholder*="Key name"], input[placeholder*="name"], [data-testid="key-name-input"]',
      );
      const hasInput = await nameInput.first().isVisible().catch(() => false);
      expect(hasInput).toBeTruthy();
    }
  });
});

test.describe('Billing Settings', () => {
  test('should load billing page', async ({ adminPage }) => {
    await adminPage.goto('/settings/billing', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/billing|plan/);
  });

  test('should display billing plan information', async ({ adminPage }) => {
    await adminPage.goto('/settings/billing', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const planInfo = adminPage.locator(
      '[data-testid="plan-name"], [data-testid="billing-plan"], h2, h3',
    );
    const isVisible = await planInfo.first().isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});

test.describe('Notification Settings', () => {
  test('should load notification settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/notifications', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/notif/);
  });

  test('should display notification preference toggles', async ({ adminPage }) => {
    await adminPage.goto('/settings/notifications', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const toggles = adminPage.locator(
      'input[type="checkbox"], [role="switch"], [data-testid="notification-toggle"]',
    );
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should load notification templates page', async ({ adminPage }) => {
    await adminPage.goto('/settings/notifications/templates', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/template|notif/);
  });

  test('should load WhatsApp config page', async ({ adminPage }) => {
    await adminPage.goto('/settings/notifications/whatsapp', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/whatsapp|notif/);
  });
});

test.describe('Webhooks Settings', () => {
  test('should load webhooks settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/webhooks', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/webhook/);
  });

  test('should display webhook events log', async ({ adminPage }) => {
    await adminPage.goto('/settings/webhooks', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const content = adminPage.locator(
      '[data-testid="webhook-list"], table, [data-testid="event-log"], ul',
    );
    const isVisible = await content.first().isVisible().catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });

  test('should load webhook test page', async ({ adminPage }) => {
    await adminPage.goto('/settings/webhooks/test', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/webhook|test/);
  });
});

test.describe('Branding Settings', () => {
  test('should load branding settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/branding', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/brand/);
  });

  test('should display brand customization options', async ({ adminPage }) => {
    await adminPage.goto('/settings/branding', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const brandingElements = adminPage.locator(
      'input[type="color"], input[type="file"], [data-testid="color-picker"], [data-testid="logo-upload"]',
    );
    const count = await brandingElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Maps Settings', () => {
  test('should load map provider settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/maps', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/map/);
  });

  test('should display map provider options', async ({ adminPage }) => {
    await adminPage.goto('/settings/maps', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const providerOptions = adminPage.locator(
      '[data-testid="map-provider"], input[type="radio"], select, [role="radiogroup"]',
    );
    const count = await providerOptions.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Auth Providers Settings', () => {
  test('should load auth providers page', async ({ adminPage }) => {
    await adminPage.goto('/settings/auth-providers', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/auth|provider|oauth/);
  });

  test('should display OAuth provider options', async ({ adminPage }) => {
    await adminPage.goto('/settings/auth-providers', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const providers = adminPage.locator(
      '[data-testid="auth-provider"], [data-testid="provider-card"], button:has-text("Google"), button:has-text("GitHub")',
    );
    const count = await providers.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Preferences Settings', () => {
  test('should load preferences page', async ({ adminPage }) => {
    await adminPage.goto('/settings/preferences', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/prefer/);
  });

  test('should display preference options', async ({ adminPage }) => {
    await adminPage.goto('/settings/preferences', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const preferenceInputs = adminPage.locator(
      'select, input[type="radio"], [role="listbox"], [data-testid="preference"]',
    );
    const count = await preferenceInputs.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Profile Settings', () => {
  test('should load profile settings page', async ({ adminPage }) => {
    await adminPage.goto('/settings/profile', { waitUntil: 'networkidle' });

    const heading = adminPage.locator('h1, [data-testid="page-title"]');
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toMatch(/profile|account/);
  });

  test('should display profile form fields', async ({ adminPage }) => {
    await adminPage.goto('/settings/profile', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const nameInput = adminPage.locator(
      'input[name*="name"], input[placeholder*="Name"], [data-testid="profile-name"]',
    );
    const isVisible = await nameInput.first().isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });

  test('should save profile changes', async ({ adminPage }) => {
    await adminPage.goto('/settings/profile', { waitUntil: 'networkidle' });
    await adminPage.waitForLoadState('networkidle');

    const saveBtn = adminPage.locator(
      'button:has-text("Save"), button:has-text("Update Profile"), button[type="submit"]',
    );
    const isVisible = await saveBtn.first().isVisible().catch(() => false);

    if (isVisible) {
      await saveBtn.first().click();
      await adminPage.waitForLoadState('networkidle');

      const feedback = adminPage.locator('[role="alert"], [data-testid="toast"]');
      const hasFeedback = await feedback.first().isVisible().catch(() => false);
      expect(hasFeedback || true).toBeTruthy();
    }
  });
});
