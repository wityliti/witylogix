/**
 * E2E Test Helpers
 *
 * Utility functions for E2E tests:
 * - Status polling with timeout
 * - Notification assertions
 * - Invoice generation verification
 * - Authenticated API clients
 * - WebSocket connection helpers
 *
 * ~200 lines
 */

import type { FastifyInstance } from "fastify";

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────────

export type UserRole =
  | "admin"
  | "merchant"
  | "customer"
  | "driver"
  | "support";

export interface AuthenticatedClient {
  userId: string;
  email: string;
  role: UserRole;
  token: string;
}

export interface StatusCheckResult {
  orderId: string;
  currentStatus: string;
  expectedStatus: string;
  matched: boolean;
  attempts: number;
  elapsedMs: number;
}

export interface NotificationAssertion {
  notificationType: string;
  recipient: string;
  recipientType: "email" | "sms" | "push";
  sent: boolean;
  sentAt?: Date;
}

export interface InvoiceAssertion {
  invoiceId: string;
  orderId: string;
  amount: number;
  generated: boolean;
  generatedAt?: Date;
}

// ─── STATUS POLLING ─────────────────────────────────────────────────────────

/**
 * Poll order status until it reaches expected state or timeout
 * @param getStatus - Async function that retrieves current status
 * @param expectedStatus - Status to wait for
 * @param timeoutMs - Maximum time to wait (default: 30s)
 * @param pollIntervalMs - Time between polls (default: 500ms)
 * @returns Result with status check details
 */
export async function waitForStatus<T extends { status: string }>(
  orderId: string,
  getStatus: () => Promise<T | null>,
  expectedStatus: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500,
): Promise<StatusCheckResult> {
  const startTime: number = Date.now();
  let attempts: number = 0;
  let currentStatus: string | null = null;

  while (Date.now() - startTime < timeoutMs) {
    const data: T | null = await getStatus();
    attempts++;

    if (data) {
      currentStatus = data.status;
      if (currentStatus === expectedStatus) {
        return {
          orderId,
          currentStatus,
          expectedStatus,
          matched: true,
          attempts,
          elapsedMs: Date.now() - startTime,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    orderId,
    currentStatus: currentStatus || "unknown",
    expectedStatus,
    matched: false,
    attempts,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Wait for webhook delivery with timeout
 */
export async function waitForWebhookDelivery(
  webhookId: string,
  getWebhookStatus: () => Promise<{ status: string; deliveredAt?: Date } | null>,
  timeoutMs: number = 10000,
): Promise<boolean> {
  const startTime: number = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status: { status: string; deliveredAt?: Date } | null =
      await getWebhookStatus();

    if (status && status.status === "delivered" && status.deliveredAt) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

// ─── NOTIFICATION ASSERTIONS ────────────────────────────────────────────────

/**
 * Assert that a notification was sent
 */
export async function assertNotificationSent(
  notificationType: string,
  recipient: string,
  recipientType: "email" | "sms" | "push",
  getNotifications: () => Promise<
    Array<{
      type: string;
      recipient: string;
      recipientType: string;
      sentAt: Date;
    }>
  >,
  timeoutMs: number = 10000,
): Promise<NotificationAssertion> {
  const startTime: number = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const notifications: Array<{
      type: string;
      recipient: string;
      recipientType: string;
      sentAt: Date;
    }> = await getNotifications();

    const found: {
      type: string;
      recipient: string;
      recipientType: string;
      sentAt: Date;
    } | undefined = notifications.find(
      (n) =>
        n.type === notificationType &&
        n.recipient === recipient &&
        n.recipientType === recipientType,
    );

    if (found) {
      return {
        notificationType,
        recipient,
        recipientType,
        sent: true,
        sentAt: found.sentAt,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return {
    notificationType,
    recipient,
    recipientType,
    sent: false,
  };
}

/**
 * Assert that multiple notifications were sent
 */
export async function assertNotificationsSent(
  notifications: Array<{ type: string; recipient: string; recipientType: string }>,
  getNotifications: () => Promise<
    Array<{
      type: string;
      recipient: string;
      recipientType: string;
      sentAt: Date;
    }>
  >,
  timeoutMs: number = 15000,
): Promise<NotificationAssertion[]> {
  const results: NotificationAssertion[] = [];

  for (const notification of notifications) {
    const result: NotificationAssertion = await assertNotificationSent(
      notification.type,
      notification.recipient,
      notification.recipientType as "email" | "sms" | "push",
      getNotifications,
      timeoutMs,
    );
    results.push(result);
  }

  return results;
}

// ─── INVOICE ASSERTIONS ─────────────────────────────────────────────────────

/**
 * Assert that an invoice was generated for an order
 */
export async function assertInvoiceGenerated(
  orderId: string,
  getInvoice: () => Promise<
    {
      id: string;
      invoiceNumber: string;
      amount: number;
      generatedAt: Date;
    } | null
  >,
  timeoutMs: number = 15000,
): Promise<InvoiceAssertion> {
  const startTime: number = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const invoice: {
      id: string;
      invoiceNumber: string;
      amount: number;
      generatedAt: Date;
    } | null = await getInvoice();

    if (invoice) {
      return {
        invoiceId: invoice.id,
        orderId,
        amount: invoice.amount,
        generated: true,
        generatedAt: invoice.generatedAt,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    invoiceId: "unknown",
    orderId,
    amount: 0,
    generated: false,
  };
}

// ─── AUTHENTICATED API CLIENTS ──────────────────────────────────────────────

/**
 * Create authenticated API client for a given role
 */
export function createAuthenticatedClient(
  baseUrl: string,
  role: UserRole = "merchant",
): AuthenticatedClient {
  const userId: string = `user_${Math.random().toString(36).substring(7)}`;
  const email: string = `${role}_${userId}@example.com`;
  const token: string = `Bearer token_${Math.random().toString(36).substring(7)}`;

  return {
    userId,
    email,
    role,
    token,
  };
}

/**
 * Create headers for authenticated API request
 */
export function createAuthHeaders(
  client: AuthenticatedClient,
  additionalHeaders?: Record<string, string>,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: client.token,
    "X-User-ID": client.userId,
    "X-User-Role": client.role,
    ...additionalHeaders,
  };
}

// ─── API REQUEST HELPERS ────────────────────────────────────────────────────

/**
 * Make authenticated GET request
 */
export async function apiGet<T>(
  baseUrl: string,
  path: string,
  client: AuthenticatedClient,
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const response: Response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: createAuthHeaders(client, additionalHeaders),
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Make authenticated POST request
 */
export async function apiPost<T>(
  baseUrl: string,
  path: string,
  client: AuthenticatedClient,
  body: unknown,
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const response: Response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: createAuthHeaders(client, additionalHeaders),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Make authenticated PUT request
 */
export async function apiPut<T>(
  baseUrl: string,
  path: string,
  client: AuthenticatedClient,
  body: unknown,
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const response: Response = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: createAuthHeaders(client, additionalHeaders),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`PUT ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Make authenticated PATCH request
 */
export async function apiPatch<T>(
  baseUrl: string,
  path: string,
  client: AuthenticatedClient,
  body: unknown,
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const response: Response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: createAuthHeaders(client, additionalHeaders),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`PATCH ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Make authenticated DELETE request
 */
export async function apiDelete<T>(
  baseUrl: string,
  path: string,
  client: AuthenticatedClient,
  additionalHeaders?: Record<string, string>,
): Promise<T> {
  const response: Response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: createAuthHeaders(client, additionalHeaders),
  });

  if (!response.ok) {
    throw new Error(`DELETE ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

// ─── WEBSOCKET HELPERS ──────────────────────────────────────────────────────

/**
 * Connect to WebSocket and wait for specific event
 */
export async function connectWebSocketAndWaitForEvent<T>(
  wsUrl: string,
  eventType: string,
  timeoutMs: number = 10000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout: NodeJS.Timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket event "${eventType}" not received within ${timeoutMs}ms`));
    }, timeoutMs);

    const ws: WebSocket = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      // Connection established
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const data: Record<string, unknown> = JSON.parse(event.data as string);
        if (data.type === eventType) {
          clearTimeout(timeout);
          ws.close();
          resolve(data as T);
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    });

    ws.addEventListener("error", (error: Event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error}`));
    });
  });
}

// ─── ASSERTION HELPERS ──────────────────────────────────────────────────────

/**
 * Assert that an array of items all pass a predicate
 */
export function assertAllMatch<T>(
  items: T[],
  predicate: (item: T) => boolean,
  message: string,
): void {
  const failing: T[] = items.filter((item) => !predicate(item));
  if (failing.length > 0) {
    throw new Error(`${message} - Failed for ${failing.length}/${items.length} items`);
  }
}

/**
 * Assert that at least one item passes a predicate
 */
export function assertAnyMatch<T>(
  items: T[],
  predicate: (item: T) => boolean,
  message: string,
): void {
  const matching: T[] = items.filter((item) => predicate(item));
  if (matching.length === 0) {
    throw new Error(`${message} - No items matched predicate`);
  }
}
