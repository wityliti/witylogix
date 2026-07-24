import { describe, it, expect } from "vitest";
import {
  listRegisteredProviders,
  registerProvider,
  resolveProvider,
  ProviderNotImplementedError,
} from "../provider.js";
import type { Provider } from "../provider.js";

const makeStub = (id: string): Provider =>
  ({
    id,
    preflight: async () => ({ ok: true, checks: [] }),
    provision: async () => ({ ok: true, operationsApplied: 0 }),
    deploy: async () => ({ ok: true, version: "0.0.0", rolledBack: false }),
    start: async () => {},
    stop: async () => {},
    restart: async () => {},
    async *logs() {
      // empty
    },
    status: async () => ({ services: [] }),
    backup: async () => ({
      ok: true,
      archive: "",
      sizeBytes: 0,
      createdAt: "",
    }),
    restore: async () => ({ ok: true, tenantsRestored: 0 }),
    rotateSecret: async () => {},
    destroy: async () => {},
  }) as unknown as Provider;

describe("provider registry", () => {
  it("registers and resolves providers by id", async () => {
    registerProvider("test-provider-1", async () =>
      makeStub("test-provider-1"),
    );
    const p = await resolveProvider("test-provider-1");
    expect(p.id).toBe("test-provider-1");
  });

  it("lists registered providers", () => {
    registerProvider("test-provider-2", async () =>
      makeStub("test-provider-2"),
    );
    const providers = listRegisteredProviders();
    expect(providers).toContain("test-provider-2");
  });

  it("throws when resolving an unknown provider", async () => {
    await expect(resolveProvider("nope")).rejects.toThrow(/not registered/);
  });
});

describe("ProviderNotImplementedError", () => {
  it("includes provider id and operation in the message", () => {
    const err = new ProviderNotImplementedError("docker-compose", "backup");
    expect(err.message).toContain("docker-compose");
    expect(err.message).toContain("backup");
  });
});
