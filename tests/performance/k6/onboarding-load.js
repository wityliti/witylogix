/**
 * Onboarding Flow Load Testing - K6
 * Tests: 20 concurrent users completing full wizard
 * Scenarios: ~100 lines
 * - Thresholds: p95 < 800ms per step, total flow < 30s
 * - Data generation for unique emails/companies
 */

import { check, group, sleep } from "k6";
import http from "k6/http";
import { Trend, Counter, Rate } from "k6/metrics";
import {
  generateEmail,
  generateCompanyName,
  generateAddress,
} from "./helpers/data-generators.js";

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3000/api/v4";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "2m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    step_duration: ["p(95)<800", "p(99)<1500", "avg<500"],
    flow_duration: ["p(95)<30000", "p(99)<45000", "avg<20000"],
    http_req_failed: ["rate<0.02"],
    onboarding_completion_rate: ["rate>0.95"],
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const stepDuration = new Trend("step_duration");
const flowDuration = new Trend("flow_duration");
const onboardingCompletionRate = new Rate("onboarding_completion_rate");
const stepCompletionRate = new Rate("step_completion_rate");
const errorCounter = new Counter("onboarding_errors");

// ─── Test Scenarios ─────────────────────────────────────────────────────────

export default function () {
  const flowStartTime = Date.now();
  let stepsCompleted = 0;
  let flowSuccess = true;

  // Step 1: Create account
  group("Step 1: Account Creation", () => {
    const email = generateEmail("onboard");
    const password = `Password${Date.now()}!`;
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({
        email,
        password,
        name: `Onboard User ${Date.now()}`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    stepDuration.add(duration);

    const success = check(response, {
      "account creation status 201": (r) =>
        r.status === 201 || r.status === 200,
      "account has accessToken": (r) => JSON.parse(r.body).accessToken,
    });

    stepCompletionRate.add(success);
    if (success) stepsCompleted++;
    if (!success) {
      flowSuccess = false;
      errorCounter.add(1);
    }
  });

  sleep(0.5);

  // Step 2: Create shop/organization
  group("Step 2: Shop Creation", () => {
    const startTime = Date.now();
    const companyName = generateCompanyName();

    const response = http.post(
      `${BASE_URL}/shops`,
      JSON.stringify({
        name: companyName,
        email: generateEmail("shop"),
        phone: "+12025551234",
        domain: `${companyName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    stepDuration.add(duration);

    const success = check(response, {
      "shop creation status 201": (r) => r.status === 201 || r.status === 200,
      "shop has shopId": (r) => {
        const body = JSON.parse(r.body);
        return body.shopId || body.id;
      },
    });

    stepCompletionRate.add(success);
    if (success) stepsCompleted++;
    if (!success) {
      flowSuccess = false;
      errorCounter.add(1);
    }
  });

  sleep(0.5);

  // Step 3: Add business details
  group("Step 3: Business Details", () => {
    const startTime = Date.now();
    const address = generateAddress();

    const response = http.post(
      `${BASE_URL}/business-profile`,
      JSON.stringify({
        businessType: "delivery",
        operatingAddress: address,
        taxId: `TAX${Math.random().toString(36).substring(7).toUpperCase()}`,
        businessLicense: `LIC${Math.random().toString(36).substring(7).toUpperCase()}`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    stepDuration.add(duration);

    const success = check(response, {
      "profile creation status 200-201": (r) =>
        r.status === 200 || r.status === 201,
    });

    stepCompletionRate.add(success);
    if (success) stepsCompleted++;
    if (!success) {
      flowSuccess = false;
      errorCounter.add(1);
    }
  });

  sleep(0.5);

  // Step 4: Payment setup
  group("Step 4: Payment Setup", () => {
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/payment-methods`,
      JSON.stringify({
        type: "bank_account",
        accountHolderName: "Business Owner",
        accountNumber: "1234567890",
        routingNumber: "021000021",
        accountType: "checking",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    stepDuration.add(duration);

    const success = check(response, {
      "payment setup status 200-201": (r) =>
        r.status === 200 || r.status === 201,
    });

    stepCompletionRate.add(success);
    if (success) stepsCompleted++;
    if (!success) {
      flowSuccess = false;
      errorCounter.add(1);
    }
  });

  sleep(0.5);

  // Step 5: Invite team members
  group("Step 5: Team Invitation", () => {
    const startTime = Date.now();

    const response = http.post(
      `${BASE_URL}/team-invitations`,
      JSON.stringify({
        email: generateEmail("team"),
        role: "manager",
        permissions: ["orders:read", "orders:write", "drivers:read"],
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${__ENV.TEST_TOKEN || "test-token"}`,
        },
        timeout: "10s",
      },
    );

    const duration = Date.now() - startTime;
    stepDuration.add(duration);

    const success = check(response, {
      "invitation status 200-201": (r) => r.status === 200 || r.status === 201,
    });

    stepCompletionRate.add(success);
    if (success) stepsCompleted++;
    if (!success) {
      flowSuccess = false;
      errorCounter.add(1);
    }
  });

  const flowDurationMs = Date.now() - flowStartTime;
  flowDuration.add(flowDurationMs);
  onboardingCompletionRate.add(flowSuccess && stepsCompleted === 5);
}
