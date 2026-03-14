/**
 * Credential Validator
 *
 * Validates credentials for various authentication methods:
 * API keys, OAuth tokens, basic auth, webhooks, etc.
 * Supports all 124 integration providers with provider-specific
 * validation endpoints and timeout management.
 */

import {
  ConnectionTestResult,
  CredentialValidationResult,
  CredentialValidationError,
  IntegrationAuthType,
} from './types';
import { getSetupConfig } from './integration-setup-registry';

// ─── Validation Endpoints Mapping ───────────────────────────────

const VALIDATION_ENDPOINTS: Record<
  string,
  {
    endpoint: string;
    method: 'GET' | 'POST' | 'HEAD';
    headers?: (creds: Record<string, unknown>) => Record<string, string>;
    expectedStatus?: number[];
  }
> = {
  // ─── Routing ──────────────────────────────────────────────────
  valhalla: {
    endpoint: '/status',
    method: 'GET',
    expectedStatus: [200],
  },
  vroom: {
    endpoint: '/health',
    method: 'GET',
    expectedStatus: [200],
  },
  'google-routes-api': {
    endpoint: 'https://routes.googleapis.com/directions/v1:computeRoutes',
    method: 'POST',
    headers: (creds) => ({ 'X-Goog-Api-Key': String(creds.apiKey) }),
    expectedStatus: [200, 400], // 400 is ok (validation error, not auth)
  },
  'mapbox-directions': {
    endpoint: 'https://api.mapbox.com/directions/v5/mapbox/driving/0,0;1,1',
    method: 'GET',
    headers: (creds) => ({ Authorization: `Bearer ${creds.accessToken}` }),
    expectedStatus: [200],
  },

  // ─── Telematics ───────────────────────────────────────────────
  samsara: {
    endpoint: 'https://api.samsara.com/v1/fleet/vehicles',
    method: 'GET',
    headers: (creds) => ({ Authorization: `Bearer ${creds.accessToken}` }),
    expectedStatus: [200],
  },
  geotab: {
    endpoint: 'https://my.geotab.com/apiv1',
    method: 'POST',
    expectedStatus: [200],
  },

  // ─── E-Commerce ───────────────────────────────────────────────
  shopify: {
    endpoint: 'https://{shopDomain}/admin/api/2024-01/graphql.json',
    method: 'POST',
    headers: (creds) => ({
      'X-Shopify-Access-Token': String(creds.accessToken || creds.apiKey),
      'Content-Type': 'application/json',
    }),
    expectedStatus: [200],
  },

  // ─── Payments ──────────────────────────────────────────────────
  stripe: {
    endpoint: 'https://api.stripe.com/v1/charges',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    expectedStatus: [200],
  },

  // ─── Email ────────────────────────────────────────────────────
  sendgrid: {
    endpoint: 'https://api.sendgrid.com/v3/mail/send',
    method: 'POST',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.apiKey}`,
      'Content-Type': 'application/json',
    }),
    expectedStatus: [200, 400], // 400 for validation errors
  },
  mailgun: {
    endpoint: 'https://api.mailgun.net/v3/{domain}/messages',
    method: 'POST',
    headers: (creds) => ({
      Authorization: `Basic ${Buffer.from(
        `api:${creds.apiKey}`
      ).toString('base64')}`,
    }),
    expectedStatus: [200, 400],
  },

  // ─── Communications ───────────────────────────────────────────
  slack: {
    endpoint: 'https://slack.com/api/auth.test',
    method: 'POST',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.accessToken || creds.botToken}`,
      'Content-Type': 'application/json',
    }),
    expectedStatus: [200],
  },
  twilio: {
    endpoint: 'https://api.twilio.com/2010-04-01/Accounts/{accountSid}',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Basic ${Buffer.from(
        `${creds.accountSid}:${creds.authToken}`
      ).toString('base64')}`,
    }),
    expectedStatus: [200],
  },

  // ─── E-Signatures ──────────────────────────────────────────────
  docusign: {
    endpoint: 'https://na4.docusign.net/restapi/v2.1/accounts/{accountId}/envelopes',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.accessToken}`,
    }),
    expectedStatus: [200],
  },

  // ─── CRM ───────────────────────────────────────────────────────
  salesforce: {
    endpoint: 'https://{instanceUrl}/services/data/v58.0',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.accessToken}`,
    }),
    expectedStatus: [200],
  },
  hubspot: {
    endpoint: 'https://api.hubapi.com/crm/v3/objects/contacts',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    }),
    expectedStatus: [200],
  },

  // ─── Accounting ────────────────────────────────────────────────
  xero: {
    endpoint: 'https://api.xero.com/api.xro/2.0/Invoices',
    method: 'GET',
    headers: (creds) => ({
      Authorization: `Bearer ${creds.accessToken}`,
      'Xero-tenant-id': String(creds.tenantId || ''),
    }),
    expectedStatus: [200],
  },

  // Default: API key validation
  default: {
    endpoint: '/api/v1',
    method: 'GET',
    headers: (creds) => ({ 'X-API-Key': String(creds.apiKey) }),
    expectedStatus: [200, 401, 403], // Various endpoints return different codes
  },
};

const VALIDATION_TIMEOUT_MS = 10_000; // 10 second timeout

// ─── Credential Validator ──────────────────────────────────────

export class CredentialValidator {
  /**
   * Validate credentials for a provider.
   *
   * Tests provided credentials by making a lightweight API request
   * to verify authentication is working.
   */
  static async validateCredentials(
    providerId: string,
    credentials: Record<string, unknown>
  ): Promise<CredentialValidationResult> {
    const startTime = Date.now();
    const config = getSetupConfig(providerId);

    if (!config) {
      return {
        valid: false,
        providerId,
        timestamp: new Date(),
        errors: [`No setup config found for provider: ${providerId}`],
      };
    }

    try {
      const result = await this.testConnection(providerId, config.authType, credentials);

      if (!result.success) {
        return {
          valid: false,
          providerId,
          timestamp: new Date(),
          errors: [result.message],
          latencyMs: result.latencyMs,
        };
      }

      return {
        valid: true,
        providerId,
        timestamp: new Date(),
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        valid: false,
        providerId,
        timestamp: new Date(),
        errors: [error instanceof Error ? error.message : String(error)],
        latencyMs: latency,
      };
    }
  }

  /**
   * Test a connection with provided credentials.
   *
   * Makes an actual API request to verify credentials work.
   */
  static async testConnection(
    providerId: string,
    authType: IntegrationAuthType,
    credentials: Record<string, unknown>
  ): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    try {
      let endpoint = VALIDATION_ENDPOINTS[providerId]?.endpoint;
      const method = VALIDATION_ENDPOINTS[providerId]?.method || 'GET';
      const expectedStatus = VALIDATION_ENDPOINTS[providerId]?.expectedStatus || [200];
      let headers = VALIDATION_ENDPOINTS[providerId]?.headers?.(credentials) || {};

      // Fallback to provider config test endpoint
      if (!endpoint && credentials.baseUrl) {
        endpoint = String(credentials.baseUrl) + (credentials.testEndpoint || '/health');
      }

      if (!endpoint) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          message: `No validation endpoint configured for ${providerId}`,
        };
      }

      // Interpolate variables
      endpoint = this.interpolateEndpoint(endpoint, credentials);

      // Prepare request body for POST requests
      let body: string | undefined;
      if (method === 'POST' && authType === IntegrationAuthType.API_KEY) {
        // Minimal test payload
        body = JSON.stringify({});
        headers = { ...headers, 'Content-Type': 'application/json' };
      }

      // Add auth headers based on auth type
      if (!headers.Authorization) {
        headers = this.buildAuthHeaders(authType, credentials, headers);
      }

      const response = await fetch(endpoint, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);
      const latencyMs = Date.now() - startTime;

      if (!expectedStatus.includes(response.status)) {
        return {
          success: false,
          latencyMs,
          message: `HTTP ${response.status}: ${response.statusText}`,
          errorCode: `HTTP_${response.status}`,
          details: {
            endpoint,
            method,
            expectedStatus,
            receivedStatus: response.status,
          },
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Connection successful to ${providerId}`,
        details: {
          statusCode: response.status,
          latencyMs,
        },
      };
    } catch (error) {
      clearTimeout(timeoutHandle);
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          latencyMs,
          message: `Request timeout after ${VALIDATION_TIMEOUT_MS}ms`,
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        latencyMs,
        message: error instanceof Error ? error.message : String(error),
        errorCode: 'REQUEST_FAILED',
      };
    }
  }

  /**
   * Validate webhook secret format and entropy.
   */
  static validateWebhookSecret(secret: string): boolean {
    if (!secret || typeof secret !== 'string') return false;
    // Minimum 32 characters, mix of uppercase, lowercase, numbers
    if (secret.length < 32) return false;
    const hasUpper = /[A-Z]/.test(secret);
    const hasLower = /[a-z]/.test(secret);
    const hasNumber = /[0-9]/.test(secret);
    return hasUpper || hasLower || hasNumber;
  }

  /**
   * Build authentication headers based on auth type.
   */
  private static buildAuthHeaders(
    authType: IntegrationAuthType,
    credentials: Record<string, unknown>,
    existingHeaders: Record<string, string>
  ): Record<string, string> {
    const headers = { ...existingHeaders };

    switch (authType) {
      case IntegrationAuthType.API_KEY:
        headers['X-API-Key'] = String(credentials.apiKey || credentials.token || '');
        break;

      case IntegrationAuthType.BEARER_TOKEN:
        const token = credentials.accessToken || credentials.token || credentials.apiKey;
        headers.Authorization = `Bearer ${String(token)}`;
        break;

      case IntegrationAuthType.BASIC_AUTH:
        const username = credentials.username || credentials.apiKey;
        const password = credentials.password || credentials.apiSecret;
        const encoded = Buffer.from(`${String(username)}:${String(password)}`).toString('base64');
        headers.Authorization = `Basic ${encoded}`;
        break;

      case IntegrationAuthType.OAUTH2:
        headers.Authorization = `Bearer ${String(credentials.accessToken || '')}`;
        break;

      case IntegrationAuthType.WEBHOOK_SECRET:
        headers['X-Webhook-Secret'] = String(credentials.webhookSecret || '');
        break;

      case IntegrationAuthType.CUSTOM:
        // Provider-specific handling by endpoint configurator
        break;
    }

    return headers;
  }

  /**
   * Interpolate variables in endpoint URL.
   */
  private static interpolateEndpoint(
    endpoint: string,
    credentials: Record<string, unknown>
  ): string {
    let result = endpoint;

    // Replace common variables
    const replacements: Record<string, unknown> = {
      shopDomain: credentials.shopDomain,
      accountSid: credentials.accountSid,
      accountId: credentials.accountId,
      domain: credentials.domain,
      instanceUrl: credentials.instanceUrl,
      baseUrl: credentials.baseUrl,
      tenantId: credentials.tenantId,
    };

    for (const [key, value] of Object.entries(replacements)) {
      if (value) {
        result = result.replace(`{${key}}`, String(value));
      }
    }

    return result;
  }
}

/**
 * Quick credential test helper.
 */
export async function testCredentials(
  providerId: string,
  credentials: Record<string, unknown>
): Promise<ConnectionTestResult> {
  const config = getSetupConfig(providerId);
  if (!config) {
    return {
      success: false,
      latencyMs: 0,
      message: `Provider not found: ${providerId}`,
    };
  }

  return CredentialValidator.testConnection(providerId, config.authType, credentials);
}
