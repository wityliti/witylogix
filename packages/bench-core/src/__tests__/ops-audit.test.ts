import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitAudit, AUDIT_LOG_FILENAME } from "../ops/audit.js";
import type { Context } from "../types.js";

let tmp: string;

function makeCtx(json = false): Context {
  return {
    cwd: tmp,
    config: { metadata: { name: "demo" } } as Context["config"],
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    dryRun: false,
    json,
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-audit-"));
  delete process.env.BENCH_INITIATOR;
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("emitAudit", () => {
  it("appends one JSONL line per event", () => {
    emitAudit(makeCtx(), "bench.test.a", { foo: 1 });
    emitAudit(makeCtx(), "bench.test.b", { foo: 2 });
    const lines = readFileSync(join(tmp, AUDIT_LOG_FILENAME), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).event).toBe("bench.test.a");
    expect(JSON.parse(lines[1]).data).toEqual({ foo: 2 });
  });

  it("sets actor=bench, initiator=cli by default", () => {
    emitAudit(makeCtx(), "x");
    const line = readFileSync(join(tmp, AUDIT_LOG_FILENAME), "utf8").trim();
    const parsed = JSON.parse(line);
    expect(parsed.actor).toBe("bench");
    expect(parsed.initiator).toBe("cli");
  });

  it("honors BENCH_INITIATOR env for Cloud control plane integration", () => {
    process.env.BENCH_INITIATOR = "cloud";
    emitAudit(makeCtx(), "x");
    const parsed = JSON.parse(
      readFileSync(join(tmp, AUDIT_LOG_FILENAME), "utf8").trim(),
    );
    expect(parsed.initiator).toBe("cloud");
  });

  it("stamps installation from ctx.config.metadata.name", () => {
    emitAudit(makeCtx(), "x");
    const parsed = JSON.parse(
      readFileSync(join(tmp, AUDIT_LOG_FILENAME), "utf8").trim(),
    );
    expect(parsed.installation).toBe("demo");
  });

  it("returns the event payload so callers can compose further logic", () => {
    const p = emitAudit(makeCtx(), "e", { k: "v" });
    expect(p.event).toBe("e");
    expect(p.data).toEqual({ k: "v" });
    expect(p.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("defaults data to empty object when omitted", () => {
    emitAudit(makeCtx(), "empty");
    const parsed = JSON.parse(
      readFileSync(join(tmp, AUDIT_LOG_FILENAME), "utf8").trim(),
    );
    expect(parsed.data).toEqual({});
  });

  it("streams event on stderr when ctx.json=true", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );
    try {
      emitAudit(makeCtx(true), "bench.test.json", { x: 1 });
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(
        (writeSpy.mock.calls[0][0] as string).trim(),
      );
      expect(payload.audit.event).toBe("bench.test.json");
      expect(payload.audit.data).toEqual({ x: 1 });
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("does not throw if stderr write fails in json mode", () => {
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => {
        throw new Error("stderr closed");
      });
    const warnSpy = vi.fn();
    const ctx = makeCtx(true);
    ctx.logger.warn = warnSpy;
    try {
      expect(() => emitAudit(ctx, "e")).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("stderr closed"),
      );
    } finally {
      writeSpy.mockRestore();
    }
  });
});
