// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@witylogix/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tenantConfig: { create: vi.fn() },
  },
}));

import {
  TenantProvisioner,
  TenantAlreadyExistsError,
} from "../tenant-provisioner.js";
import { prisma } from "@witylogix/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TenantProvisioner.createTenant", () => {
  it("creates Organization + TenantConfig and returns ids", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    (prisma.organization.create as any).mockResolvedValue({
      id: "org-1",
      slug: "acme",
    });
    (prisma.tenantConfig.create as any).mockResolvedValue({
      id: "tc-1",
      subdomain: "acme",
    });

    const r = await new TenantProvisioner().createTenant({
      slug: "acme",
      ownerEmail: "ops@acme.co",
      ownerName: "Ada Lovelace",
    });

    expect(r).toEqual({
      tenantId: "tc-1",
      orgId: "org-1",
      subdomain: "acme",
      ownerEmail: "ops@acme.co",
    });
  });

  it("stores owner info in Organization.settings", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    (prisma.organization.create as any).mockResolvedValue({ id: "org-1" });
    (prisma.tenantConfig.create as any).mockResolvedValue({
      id: "tc-1",
      subdomain: "s",
    });

    await new TenantProvisioner().createTenant({
      slug: "s",
      ownerEmail: "a@x.co",
      ownerName: "A",
    });

    const createCall = (prisma.organization.create as any).mock.calls[0][0];
    expect(createCall.data.settings).toMatchObject({
      provisionedBy: "bench",
      ownerName: "A",
      ownerEmail: "a@x.co",
    });
    expect(createCall.data.settings.provisionedAt).toBeTruthy();
  });

  it("throws TenantAlreadyExistsError when slug is taken", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: "x" });
    await expect(
      new TenantProvisioner().createTenant({
        slug: "acme",
        ownerEmail: "a@acme.co",
        ownerName: "A",
      }),
    ).rejects.toBeInstanceOf(TenantAlreadyExistsError);
  });

  it("maps plan 'starter' to PlanTier.STARTER", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    (prisma.organization.create as any).mockResolvedValue({ id: "o" });
    (prisma.tenantConfig.create as any).mockResolvedValue({ id: "t", subdomain: "x" });

    await new TenantProvisioner().createTenant({
      slug: "x",
      ownerEmail: "a@b.co",
      ownerName: "A",
      plan: "starter",
    });

    const createCall = (prisma.organization.create as any).mock.calls[0][0];
    expect(createCall.data.planTier).toBe("STARTER");
  });

  it("maps plan 'pro' to PlanTier.GROWTH", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    (prisma.organization.create as any).mockResolvedValue({ id: "o" });
    (prisma.tenantConfig.create as any).mockResolvedValue({ id: "t", subdomain: "x" });

    await new TenantProvisioner().createTenant({
      slug: "x",
      ownerEmail: "a@b.co",
      ownerName: "A",
      plan: "pro",
    });

    expect((prisma.organization.create as any).mock.calls[0][0].data.planTier).toBe(
      "GROWTH",
    );
  });

  it("defaults plan to STARTER when unspecified", async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    (prisma.organization.create as any).mockResolvedValue({ id: "o" });
    (prisma.tenantConfig.create as any).mockResolvedValue({ id: "t", subdomain: "x" });

    await new TenantProvisioner().createTenant({
      slug: "x",
      ownerEmail: "a@b.co",
      ownerName: "A",
    });

    expect((prisma.organization.create as any).mock.calls[0][0].data.planTier).toBe(
      "STARTER",
    );
  });
});
