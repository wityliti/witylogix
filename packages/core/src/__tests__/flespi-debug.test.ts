import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlespiClient } from "../integrations/telematics/flespi-client.js";
import type { TelematicsConfig } from "../integrations/telematics/types.js";

describe("FlespiClient minimal", () => {
  let client: FlespiClient;

  beforeEach(() => {
    const config: TelematicsConfig = {
      provider: "samsara",
      credentials: { apiToken: "test-token" },
      timeout: 30000,
      rateLimit: 10,
      retries: 3,
    };
    client = new FlespiClient(config);
  });

  it("should throw error on auth failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            errors: [{ title: "UNAUTHORIZED", detail: "Invalid token" }],
          }),
      } as Response),
    );

    await expect(client.authenticate()).rejects.toThrow("authentication failed");
  });
});
