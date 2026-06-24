/**
 * ops/tenants — thin HTTP client over `/internal/bench/tenants`.
 *
 * Used by the CLI (`bench new-tenant`) and the Cloud control plane
 * (`apps/bench-web`) alike. No business logic here — the API endpoint
 * delegates to `TenantProvisioner` in `@witylogix/core/onboarding`.
 */
import type { Context } from "../types.js";
import { benchApi } from "../http-client.js";

export interface CreateTenantInput {
  slug: string;
  ownerEmail: string;
  ownerName: string;
  plan?: "starter" | "pro" | "enterprise";
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
}

export interface CreateTenantResult {
  tenantId: string;
  orgId: string;
  subdomain: string;
  ownerEmail: string;
}

export async function createTenant(
  ctx: Context,
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  return benchApi<CreateTenantResult>(
    ctx,
    "POST",
    "/internal/bench/tenants",
    input,
  );
}
