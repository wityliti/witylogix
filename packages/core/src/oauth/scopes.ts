/**
 * OAuth Scope Catalog
 *
 * Fine-grained scopes granted to third-party apps at install time
 * (see ADR-029). Each scope is namespaced `<resource>:<action>` and
 * maps to concrete route guards in apps/api.
 *
 * Scopes are additive: an app must be granted every scope it plans
 * to use. Wildcards are intentionally NOT supported — tenants should
 * see exactly what they are approving on the consent screen.
 */

export const OAUTH_SCOPES = {
  'shipments:read': 'Read shipments, their status, and activity flow stage',
  'orders:read': 'Read orders, line items, and current fulfillment state',
  'drivers:read': 'Read driver profiles and availability',
  'routes:read': 'Read planned and active delivery routes',
  'customers:read': 'Read customer contact and address information',
  'operations:read': 'Read activity flow configurations',

  'shipments:write': 'Create and update shipments',
  'orders:write': 'Create and update orders',
  'drivers:write': 'Create and update drivers',
  'routes:write': 'Create and update delivery routes',
  'operations:write': 'Create and update activity flow configurations',

  // State transitions — separate from :write to allow read-only apps
  // that can advance stages without editing entity fields.
  'shipments:transition': 'Advance shipments through activity flow stages',
  'orders:transition': 'Advance orders through activity flow stages',

  'webhooks:manage': 'Register, update, and remove webhook subscriptions',
} as const

export type OAuthScope = keyof typeof OAUTH_SCOPES

export const ALL_OAUTH_SCOPES = Object.keys(OAUTH_SCOPES) as OAuthScope[]

export function isValidScope (scope: string): scope is OAuthScope {
  return scope in OAUTH_SCOPES
}

/**
 * Return the scopes from `requested` that are not in `allowed`. Used
 * both by /oauth/authorize (to reject installs asking for scopes the
 * client wasn't approved for) and by /oauth/token (to make sure the
 * issued access token is a subset of the install's scopes).
 */
export function subtractScopes (requested: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed)
  return requested.filter((s) => !allowedSet.has(s))
}

/**
 * True iff every scope in `required` is present in `granted`.
 * Used by the API middleware for per-route scope enforcement.
 */
export function hasScopes (granted: string[], required: string[]): boolean {
  if (required.length === 0) return true
  const grantedSet = new Set(granted)
  return required.every((s) => grantedSet.has(s))
}
