/**
 * Authentication Load Testing - K6
 * Tests: login flow, token refresh, register, password reset
 * Scenarios: ~120 lines
 * - Ramp-up: 0→50 VUs over 30s, sustain 2min, ramp-down 30s
 * - Thresholds: p95 < 500ms login, p99 < 1s, error rate < 1%
 * - Checks: status 200, valid JWT, refresh token present
 * - Custom metrics: login_duration, token_refresh_duration
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Trend, Rate, Counter } from "k6/metrics";
import {
  login,
  register,
  refreshToken,
  requestPasswordReset,
} from "./helpers/auth.js";
import { generateTestUser } from "./helpers/data-generators.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000/api/v4";
const TEST_USER_EMAIL = __ENV.TEST_EMAIL || "test@localhost";
const TEST_USER_PASSWORD = __ENV.TEST_PASSWORD || "TestPassword123!";

export const options = {
  stages: [
    // Ramp up to 50 VUs over 30s
    { duration: "30s", target: 50 },
    // Sustain for 2 minutes
    { duration: "2m", target: 50 },
    // Ramp down to 0 VUs over 30s
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    login_duration: ["p(95)<500", "p(99)<1000", "avg<300"],
    token_refresh_duration: ["p(95)<300", "p(99)<600", "avg<200"],
    register_duration: ["p(95)<800", "p(99)<1500", "avg<500"],
    password_reset_duration: ["p(95)<600", "p(99)<1200", "avg<400"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
    login_success_rate: ["rate>0.99"],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const loginDuration = new Trend("login_duration");
const tokenRefreshDuration = new Trend("token_refresh_duration");
const registerDuration = new Trend("register_duration");
const passwordResetDuration = new Trend("password_reset_duration");
const loginSuccessRate = new Rate("login_success_rate");
const tokenRefreshSuccessRate = new Rate("token_refresh_success_rate");
const registerSuccessRate = new Rate("register_success_rate");
const passwordResetSuccessRate = new Rate("password_reset_success_rate");
const errorCounter = new Counter("auth_errors");

// ─── Test Scenarios ─────────────────────────────────────────────────────────

export default function () {
  // Scenario 1: User Login Flow
  group("Login Flow", () => {
    const startTime = Date.now();
    const response = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    loginDuration.add(duration);

    const success = check(response, {
      "login status is 200": (r) => r.status === 200,
      "login response has accessToken": (r) => JSON.parse(r.body).accessToken,
      "login response has refreshToken": (r) => JSON.parse(r.body).refreshToken,
      "login response has expiresIn": (r) => JSON.parse(r.body).expiresIn,
    });

    loginSuccessRate.add(success);
    if (!success) errorCounter.add(1);

    if (success) {
      const tokenData = JSON.parse(response.body);
      // Scenario 2: Token Refresh
      group("Token Refresh", () => {
        const refreshStartTime = Date.now();
        const refreshResponse = http.post(
          `${BASE_URL}/auth/refresh`,
          JSON.stringify({
            refreshToken: tokenData.refreshToken,
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: "10s",
          },
        );

        const refreshDuration = Date.now() - refreshStartTime;
        tokenRefreshDuration.add(refreshDuration);

        const refreshSuccess = check(refreshResponse, {
          "refresh status is 200": (r) => r.status === 200,
          "refresh response has accessToken": (r) =>
            JSON.parse(r.body).accessToken,
          "refresh response has refreshToken": (r) =>
            JSON.parse(r.body).refreshToken,
        });

        tokenRefreshSuccessRate.add(refreshSuccess);
        if (!refreshSuccess) errorCounter.add(1);
      });
    }
  });

  // Scenario 3: User Registration
  group("User Registration", () => {
    const testUser = generateTestUser();
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    registerDuration.add(duration);

    const success = check(response, {
      "register status is 201 or 200": (r) =>
        r.status === 201 || r.status === 200,
      "register response has accessToken": (r) => {
        const body = JSON.parse(r.body);
        return body.accessToken || body.token;
      },
      "register response has userId": (r) => JSON.parse(r.body).userId,
    });

    registerSuccessRate.add(success);
    if (!success) errorCounter.add(1);
  });

  // Scenario 4: Password Reset Request
  group("Password Reset", () => {
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/auth/request-password-reset`,
      JSON.stringify({
        email: TEST_USER_EMAIL,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    passwordResetDuration.add(duration);

    const success = check(response, {
      "password reset status is 200 or 202": (r) =>
        r.status === 200 || r.status === 202,
    });

    passwordResetSuccessRate.add(success);
    if (!success) errorCounter.add(1);
  });

  sleep(1);
}
