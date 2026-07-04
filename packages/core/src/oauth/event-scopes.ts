/**
 * Event → OAuth scope mapping.
 *
 * When a webhook endpoint is owned by an app installation (ADR-029),
 * events are only delivered if the installation has been granted the
 * scope that covers the event's data. This is a defense-in-depth check
 * on top of what the app subscribes to at registration time.
 *
 * Mapping uses the event type prefix (e.g. "shipment.", "order.") so
 * we only have to list new scopes once per resource family.
 */

import type { OAuthScope } from "./scopes";

const EVENT_SCOPE_BY_PREFIX: Record<string, OAuthScope> = {
  shipment: "shipments:read",
  order: "orders:read",
  driver: "drivers:read",
  route: "routes:read",
  customer: "customers:read",
};

/**
 * Return the OAuth scope required to deliver `eventType` to an
 * installation-owned webhook endpoint, or `null` when the event has
 * no scope requirement (e.g. system notifications).
 */
export function eventRequiresScope(eventType: string): OAuthScope | null {
  const prefix = eventType.split(".")[0];
  return EVENT_SCOPE_BY_PREFIX[prefix] ?? null;
}
