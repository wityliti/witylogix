import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Witylogix dashboard auth fixture.
 *
 * Provides:
 *   - `loginViaAPI(page)`  — call the auth API, drop cookie + localStorage
 *   - `authedPage`          — page fixture that is already logged in and on /home
 *
 * API URL is read from `playwright.config.ts#metadata.apiURL` so local and
 * staging runs share the same code path. Credentials default to the seeded
 * demo admin but can be overridden with TEST_EMAIL / TEST_PASSWORD envs.
 */

export const DEMO_CREDS = {
  email: process.env.TEST_EMAIL ?? "admin@demo.witylogix.io",
  password: process.env.TEST_PASSWORD ?? "Admin123!",
  shopDomain: process.env.TEST_SHOP_DOMAIN ?? "demo.witylogix.io",
} as const;

type LoginResult = {
  token: string;
  user: Record<string, unknown>;
  shop: Record<string, unknown>;
};

function getApiURL(): string {
  // Playwright injects config.metadata into the test info via a separate channel;
  // fall back to env for safety.
  const fromEnv = process.env.API_URL;
  if (fromEnv) return fromEnv;
  if (process.env.TARGET === "staging") {
    return "https://witylogix-staging.up.railway.app";
  }
  return "http://localhost:8000";
}

function getCookieDomain(baseURL: string | undefined): string {
  if (!baseURL) return "localhost";
  try {
    return new URL(baseURL).hostname;
  } catch {
    return "localhost";
  }
}

/**
 * Call POST /api/v4/auth/login and return the token + user payload.
 * Uses an independent API request context so it works before any page loads.
 */
export async function loginAPI(
  request: APIRequestContext,
  apiURL = getApiURL(),
): Promise<LoginResult> {
  const response = await request.post(`${apiURL}/api/v4/auth/login`, {
    data: DEMO_CREDS,
  });
  if (!response.ok()) {
    const body = await response.text().catch(() => "<no body>");
    throw new Error(
      `Login failed: HTTP ${response.status()} from ${apiURL}/api/v4/auth/login — ${body.slice(0, 400)}`,
    );
  }
  const body = await response.json();
  const token = body.data?.accessToken ?? body.accessToken;
  const user = body.data?.user ?? body.user;
  const shop = body.data?.shop ?? body.shop;
  if (!token) throw new Error("Login response missing accessToken");
  return { token, user, shop };
}

/**
 * Drop the auth cookie + localStorage into a Page so it behaves as a logged-in
 * user when it next navigates to a protected route.
 */
export async function applyLoginToPage(
  page: Page,
  result: LoginResult,
  baseURL: string | undefined,
) {
  const domain = getCookieDomain(baseURL);
  await page.context().addCookies([
    {
      name: "auth-token",
      value: result.token,
      domain,
      path: "/",
      httpOnly: false,
      secure: domain !== "localhost",
      sameSite: "Lax",
    },
  ]);

  // Set localStorage via an initial document then navigate.
  await page.goto("/home", { waitUntil: "commit" });
  await page.evaluate((userData) => {
    try {
      window.localStorage.setItem("authUser", JSON.stringify(userData));
    } catch {
      // Some origins (data: URLs) block localStorage; swallow silently.
    }
  }, result.user);
}

/**
 * One-call helper used by beforeEach hooks.
 */
export async function loginViaAPI(page: Page, baseURL?: string) {
  const result = await loginAPI(page.request);
  await applyLoginToPage(page, result, baseURL);
  return result;
}

type Fixtures = {
  authedPage: Page;
};

/**
 * Extended `test` that provides an `authedPage` already logged in.
 *
 * Example:
 *   import { test, expect } from "../fixtures/auth";
 *   test("orders loads", async ({ authedPage }) => { ... });
 */
export const test = base.extend<Fixtures>({
  authedPage: async ({ page, baseURL }, use) => {
    await loginViaAPI(page, baseURL);
    await use(page);
  },
});

export { expect };
