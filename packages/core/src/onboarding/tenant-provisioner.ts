/**
 * TenantProvisioner — creates an Organization + TenantConfig from Bench
 * (or the Cloud control plane) via `POST /internal/bench/tenants`.
 *
 * Scope (Phase 1b):
 *   - Creates Organization (name, slug, plan)
 *   - Creates TenantConfig (subdomain, features, limits)
 *   - Captures owner contact info on Organization.settings so the onboarding
 *     flow can claim the tenant when the owner first signs in.
 *
 * Out of scope (Phase 1b): owner User and Shop creation — those happen in
 * the existing onboarding flow (`OnboardingService`, `WorkspaceProvisioner`)
 * because they require shop context that doesn't exist at tenant-create time.
 */
import { prisma } from "@witylogix/db";
import type { PlanTier } from "@witylogix/db";

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

export class TenantAlreadyExistsError extends Error {
  constructor(public readonly field: "slug" | "email") {
    super(`tenant ${field} already in use`);
    this.name = "TenantAlreadyExistsError";
  }
}

const PLAN_MAP: Record<NonNullable<CreateTenantInput["plan"]>, PlanTier> = {
  starter: "STARTER" as PlanTier,
  pro: "GROWTH" as PlanTier,
  enterprise: "ENTERPRISE" as PlanTier,
};

export class TenantProvisioner {
  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: input.slug },
    });
    if (existingOrg) {
      throw new TenantAlreadyExistsError("slug");
    }

    // Check if owner email is already attached to a different Organization.
    // A single email can own multiple orgs in theory, so we only warn on
    // exact email+slug collision — not email alone. The org-level uniqueness
    // is enforced by the slug check above, so email conflict is a no-op here.
    // (This mirrors Frappe Cloud's behavior: email can own many workspaces.)

    const plan = PLAN_MAP[input.plan ?? "starter"];

    const org = await prisma.organization.create({
      data: {
        name: input.slug,
        slug: input.slug,
        email: input.ownerEmail,
        planTier: plan,
        settings: {
          provisionedBy: "bench",
          provisionedAt: new Date().toISOString(),
          ownerName: input.ownerName,
          ownerEmail: input.ownerEmail,
        },
      },
    });

    const tenantConfig = await prisma.tenantConfig.create({
      data: {
        orgId: org.id,
        subdomain: input.slug,
        features: (input.features ?? {}) as object,
        limits: (input.limits ?? {}) as object,
      },
    });

    return {
      tenantId: tenantConfig.id,
      orgId: org.id,
      subdomain: tenantConfig.subdomain,
      ownerEmail: input.ownerEmail,
    };
  }
}

export const tenantProvisioner = new TenantProvisioner();
