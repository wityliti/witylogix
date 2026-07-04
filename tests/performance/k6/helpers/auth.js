/**
 * Authentication Helpers for K6 Load Testing
 *
 * Provides utilities for:
 * - User login and token acquisition
 * - Token refresh operations
 * - Authenticated requests
 * - Test user generation
 * - JWT verification
 *
 * Usage:
 *   import { login, authenticatedRequest } from './helpers/auth.js';
 *   const tokens = login('user@example.com', 'password');
 *   const response = authenticatedRequest('GET', '/api/v4/orders', {}, tokens.accessToken);
 */

import http from "k6/http";
import { check } from "k6";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000";
const API_VERSION = "v4";
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * @typedef {Object} TokenResponse
 * @property {string} accessToken - JWT access token
 * @property {string} refreshToken - Refresh token for token renewal
 * @property {number} expiresIn - Token expiration time in seconds
 * @property {string} tokenType - Token type (e.g., "Bearer")
 */

/**
 * @typedef {Object} AuthContext
 * @property {string} shopId - Shop ID from token
 * @property {string} orgId - Organization ID (optional)
 * @property {string} userId - User ID
 * @property {string} role - User role
 */

/**
 * @typedef {Object} TestUser
 * @property {string} email - Unique test email
 * @property {string} password - Test password
 * @property {string} name - User name
 * @property {string} phone - Phone number
 */

// ─── Authentication Functions ───────────────────────────────────────────────

/**
 * Perform user login and retrieve tokens
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {TokenResponse|null} Token response or null on failure
 */
export function login(email, password) {
  const payload = {
    email,
    password,
  };

  const response = http.post(
    `${API_BASE}/auth/login`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  if (response.status !== 200) {
    console.error(`Login failed for ${email}: ${response.status}`);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return {
      accessToken: body.accessToken || body.token,
      refreshToken: body.refreshToken,
      expiresIn: body.expiresIn || 3600,
      tokenType: body.tokenType || "Bearer",
    };
  } catch (e) {
    console.error("Failed to parse login response:", e);
    return null;
  }
}

/**
 * Register a new test user
 * @param {string} email - Email address
 * @param {string} password - Password (min 8 characters)
 * @param {string} name - Full name
 * @param {string} shopDomain - Shop domain (optional)
 * @returns {Object|null} Registration response or null on failure
 */
export function register(email, password, name, shopDomain = null) {
  const payload = {
    email,
    password,
    name,
  };

  if (shopDomain) {
    payload.shopDomain = shopDomain;
  }

  const response = http.post(
    `${API_BASE}/auth/register`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  check(response, {
    "Register status is 201": (r) => r.status === 201,
  });

  if (response.status !== 201) {
    return null;
  }

  try {
    return JSON.parse(response.body);
  } catch (e) {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {TokenResponse|null} New token response or null on failure
 */
export function refreshToken(refreshToken) {
  const payload = {
    refreshToken,
  };

  const response = http.post(
    `${API_BASE}/auth/refresh`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  if (response.status !== 200) {
    console.error(`Token refresh failed: ${response.status}`);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return {
      accessToken: body.accessToken || body.token,
      refreshToken: body.refreshToken,
      expiresIn: body.expiresIn || 3600,
      tokenType: body.tokenType || "Bearer",
    };
  } catch (e) {
    return null;
  }
}

/**
 * Request password reset
 * @param {string} email - User email
 * @returns {boolean} True if reset request accepted
 */
export function requestPasswordReset(email) {
  const payload = { email };

  const response = http.post(
    `${API_BASE}/auth/request-password-reset`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  return check(response, {
    "Password reset request accepted": (r) =>
      r.status === 200 || r.status === 202,
  });
}

/**
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {boolean} True if token is valid
 */
export function verifyResetToken(token) {
  const response = http.get(
    `${API_BASE}/auth/verify-reset-token?token=${token}`,
    {
      headers: {
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  return response.status === 200;
}

/**
 * Reset password with token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {boolean} True if reset successful
 */
export function resetPassword(token, newPassword) {
  const payload = {
    token,
    newPassword,
  };

  const response = http.post(
    `${API_BASE}/auth/reset-password`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: "10s",
    },
  );

  return response.status === 200;
}

// ─── Authenticated Request Helpers ──────────────────────────────────────────

/**
 * Make an authenticated request with access token
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param {string} path - API path (without base URL)
 * @param {Object} body - Request body (optional)
 * @param {string} accessToken - JWT access token
 * @param {Object} additionalHeaders - Additional headers (optional)
 * @returns {Response} HTTP response
 */
export function authenticatedRequest(
  method,
  path,
  body = null,
  accessToken,
  additionalHeaders = {},
) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...additionalHeaders,
  };

  const options = {
    headers,
    timeout: "30s",
  };

  let response;
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    response = http[method.toLowerCase()](url, JSON.stringify(body), options);
  } else {
    response = http[method.toLowerCase()](url, options);
  }

  return response;
}

/**
 * Make a batch of authenticated requests
 * @param {Array} requests - Array of request objects
 * @param {string} accessToken - JWT access token
 * @returns {Array} Array of responses
 */
export function batchAuthenticatedRequests(requests, accessToken) {
  const formattedRequests = requests.map((req) => ({
    method: req.method || "GET",
    url: `${API_BASE}${req.path}`,
    body: req.body ? JSON.stringify(req.body) : null,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...req.headers,
    },
  }));

  return http.batch(formattedRequests);
}

// ─── Test User Generation ───────────────────────────────────────────────────

/**
 * Generate unique test user data
 * @param {string} suffix - Optional suffix for uniqueness
 * @returns {TestUser} Generated user object
 */
export function generateTestUser(suffix = null) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const finalSuffix = suffix || randomId;

  return {
    email: `test.user.${timestamp}.${finalSuffix}@performance.test`,
    password: `TestPassword123!${randomId}`,
    name: `Test User ${finalSuffix}`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  };
}

/**
 * Generate multiple test users
 * @param {number} count - Number of users to generate
 * @returns {Array<TestUser>} Array of generated users
 */
export function generateTestUsers(count = 5) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(generateTestUser(`batch_${i}`));
  }
  return users;
}

// ─── Token Validation ───────────────────────────────────────────────────────

/**
 * Parse JWT token (without verification - for load testing only)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
export function parseJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const decoded = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

/**
 * Check if JWT token is valid (not expired)
 * @param {string} token - JWT token
 * @returns {boolean} True if token is valid
 */
export function isTokenValid(token) {
  const payload = parseJWT(token);
  if (!payload || !payload.exp) {
    return false;
  }

  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  return expirationTime > Date.now();
}

/**
 * Extract auth context from JWT token
 * @param {string} token - JWT token
 * @returns {AuthContext|null} Auth context or null
 */
export function extractAuthContext(token) {
  const payload = parseJWT(token);
  if (!payload) {
    return null;
  }

  return {
    shopId: payload.shopId,
    orgId: payload.orgId,
    userId: payload.sub || payload.userId,
    role: payload.role,
  };
}
