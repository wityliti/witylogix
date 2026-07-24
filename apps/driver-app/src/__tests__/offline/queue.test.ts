import { describe, it, expect } from "vitest";
import {
  AppendQueue,
  createEventId,
  SYNC_PRIORITY,
  type FailedDeliveryReason,
} from "../../offline/queue";

// ---------------------------------------------------------------------------
// TDD: Event-sourced append queue for WIT-94 offline mode
// ---------------------------------------------------------------------------
// Tests define the expected behaviour BEFORE implementation.
// Priority order: DELIVERY_STATUS(1) > POD_SUBMISSION(1) > FAILED_DELIVERY(1)
//               > PHOTO_EVIDENCE(2) > STOP_RESEQUENCED(3) > RTS_WORKFLOW(4)
// ---------------------------------------------------------------------------

function makeQueue() {
  return new AppendQueue();
}

function makeGPS() {
  return { lat: 28.6139, lng: 77.209, accuracy: 10 };
}

// ── 1. append ────────────────────────────────────────────────────────────────

describe("append", () => {
  it("adds an event and returns the eventId", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: makeGPS(),
    });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("assigns an immutable device_captured_at timestamp", () => {
    const q = makeQueue();
    const before = Date.now();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    const after = Date.now();
    const evt = q.get(id)!;
    expect(evt.timestamp).toBeGreaterThanOrEqual(before);
    expect(evt.timestamp).toBeLessThanOrEqual(after);
  });

  it("never overwrites an existing event — appends a new record instead", () => {
    const q = makeQueue();
    const id1 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    const id2 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "delivered" },
      driverGPS: null,
    });
    expect(id1).not.toBe(id2);
    expect(q.all().length).toBe(2);
    expect(q.get(id1)!.payload.status).toBe("in_transit");
    expect(q.get(id2)!.payload.status).toBe("delivered");
  });

  it("stores driverGPS alongside the event", () => {
    const q = makeQueue();
    const gps = makeGPS();
    const id = q.append({
      type: "POD_SIGNATURE",
      deliveryId: "d1",
      payload: { signatureBase64: "abc" },
      driverGPS: gps,
    });
    expect(q.get(id)!.driverGPS).toEqual(gps);
  });

  it("allows driverGPS to be null", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    expect(q.get(id)!.driverGPS).toBeNull();
  });
});

// ── 2. Event types ───────────────────────────────────────────────────────────

describe("event types", () => {
  it("accepts DELIVERY_STATUS", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    expect(q.get(id)!.type).toBe("DELIVERY_STATUS");
  });

  it("accepts POD_SIGNATURE", () => {
    const q = makeQueue();
    const id = q.append({
      type: "POD_SIGNATURE",
      deliveryId: "d1",
      payload: { signatureBase64: "xyz" },
      driverGPS: null,
    });
    expect(q.get(id)!.type).toBe("POD_SIGNATURE");
  });

  it("accepts FAILED_DELIVERY with a reason code", () => {
    const q = makeQueue();
    const reasons: FailedDeliveryReason[] = [
      "not_home",
      "wrong_address",
      "refused",
      "damaged",
      "access_denied",
      "business_closed",
    ];
    for (const reason of reasons) {
      const id = q.append({
        type: "FAILED_DELIVERY",
        deliveryId: "d1",
        payload: { reason },
        driverGPS: null,
      });
      expect(q.get(id)!.payload.reason).toBe(reason);
    }
  });

  it("accepts STOP_RESEQUENCED with new order", () => {
    const q = makeQueue();
    const id = q.append({
      type: "STOP_RESEQUENCED",
      deliveryId: "route1",
      payload: { stopOrder: ["d3", "d1", "d2"] },
      driverGPS: makeGPS(),
    });
    expect(q.get(id)!.type).toBe("STOP_RESEQUENCED");
    expect((q.get(id)!.payload.stopOrder as string[]).length).toBe(3);
  });

  it("accepts PHOTO_EVIDENCE with base64 data and enforces 1 MB size guard", () => {
    const q = makeQueue();
    const smallPhoto = "A".repeat(100);
    const id = q.append({
      type: "PHOTO_EVIDENCE",
      deliveryId: "d1",
      payload: { photoBase64: smallPhoto },
      driverGPS: null,
    });
    expect(q.get(id)!.type).toBe("PHOTO_EVIDENCE");

    // Exceeds 1 MB base64 limit → should throw
    const bigPhoto = "A".repeat(1_400_000);
    expect(() =>
      q.append({
        type: "PHOTO_EVIDENCE",
        deliveryId: "d1",
        payload: { photoBase64: bigPhoto },
        driverGPS: null,
      }),
    ).toThrow(/photo.*size/i);
  });

  it("accepts RTS_WORKFLOW", () => {
    const q = makeQueue();
    const id = q.append({
      type: "RTS_WORKFLOW",
      deliveryId: "d1",
      payload: { reason: "failed_all_attempts" },
      driverGPS: null,
    });
    expect(q.get(id)!.type).toBe("RTS_WORKFLOW");
  });
});

// ── 3. Priority ordering ─────────────────────────────────────────────────────

describe("sync priority", () => {
  it("DELIVERY_STATUS has priority 1 (highest)", () => {
    expect(SYNC_PRIORITY.DELIVERY_STATUS).toBe(1);
  });

  it("POD_SIGNATURE has priority 1", () => {
    expect(SYNC_PRIORITY.POD_SIGNATURE).toBe(1);
  });

  it("FAILED_DELIVERY has priority 1", () => {
    expect(SYNC_PRIORITY.FAILED_DELIVERY).toBe(1);
  });

  it("PHOTO_EVIDENCE has priority 2", () => {
    expect(SYNC_PRIORITY.PHOTO_EVIDENCE).toBe(2);
  });

  it("STOP_RESEQUENCED has priority 3", () => {
    expect(SYNC_PRIORITY.STOP_RESEQUENCED).toBe(3);
  });

  it("RTS_WORKFLOW has priority 4 (lowest)", () => {
    expect(SYNC_PRIORITY.RTS_WORKFLOW).toBe(4);
  });

  it("pendingByPriority returns events sorted by priority then timestamp", async () => {
    const q = makeQueue();

    // Append in reverse priority order with small timestamp gaps
    q.append({
      type: "RTS_WORKFLOW",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    await new Promise((r) => setTimeout(r, 2));
    q.append({
      type: "STOP_RESEQUENCED",
      deliveryId: "d1",
      payload: { stopOrder: [] },
      driverGPS: null,
    });
    await new Promise((r) => setTimeout(r, 2));
    q.append({
      type: "PHOTO_EVIDENCE",
      deliveryId: "d1",
      payload: { photoBase64: "x" },
      driverGPS: null,
    });
    await new Promise((r) => setTimeout(r, 2));
    q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });

    const ordered = q.pendingByPriority();
    expect(ordered[0].type).toBe("DELIVERY_STATUS");
    expect(ordered[1].type).toBe("PHOTO_EVIDENCE");
    expect(ordered[2].type).toBe("STOP_RESEQUENCED");
    expect(ordered[3].type).toBe("RTS_WORKFLOW");
  });

  it("within the same priority tier, earlier timestamps come first", async () => {
    const q = makeQueue();
    q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    await new Promise((r) => setTimeout(r, 2));
    q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d2",
      payload: { status: "delivered" },
      driverGPS: null,
    });

    const ordered = q.pendingByPriority();
    expect(ordered[0].deliveryId).toBe("d1");
    expect(ordered[1].deliveryId).toBe("d2");
  });
});

// ── 4. Idempotency ───────────────────────────────────────────────────────────

describe("idempotency", () => {
  it("each appended event gets a unique eventId", () => {
    const q = makeQueue();
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(
        q.append({
          type: "DELIVERY_STATUS",
          deliveryId: `d${i}`,
          payload: {},
          driverGPS: null,
        }),
      );
    }
    expect(ids.size).toBe(20);
  });

  it("createEventId generates non-colliding UUIDs", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createEventId()));
    expect(ids.size).toBe(1000);
  });

  it("markSynced removes the event from pending list", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    q.markSynced(id);
    expect(q.pendingByPriority().find((e) => e.eventId === id)).toBeUndefined();
    expect(q.get(id)!.status).toBe("synced");
  });
});

// ── 5. Conflict resolution ───────────────────────────────────────────────────

describe("conflict resolution", () => {
  it('markConflict sets status to "conflict" and stores a message', () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    q.markConflict(
      id,
      "Delivery #d1 was already marked delivered remotely. Your update was discarded.",
    );
    const evt = q.get(id)!;
    expect(evt.status).toBe("conflict");
    expect(evt.conflictMessage).toContain("discarded");
  });

  it("conflicted events are excluded from pendingByPriority", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: { status: "in_transit" },
      driverGPS: null,
    });
    q.markConflict(id, "stale update discarded");
    expect(q.pendingByPriority().length).toBe(0);
  });

  it("conflicts returns all conflict events for UI notification", () => {
    const q = makeQueue();
    const id1 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    const id2 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d2",
      payload: {},
      driverGPS: null,
    });
    q.markConflict(id1, "discarded 1");
    q.markConflict(id2, "discarded 2");
    expect(q.conflicts().length).toBe(2);
  });

  it("acknowledgeConflict removes the event from conflicts()", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    q.markConflict(id, "discarded");
    q.acknowledgeConflict(id);
    expect(q.conflicts().length).toBe(0);
  });
});

// ── 6. Error / retry ─────────────────────────────────────────────────────────

describe("error handling", () => {
  it("markError increments retryCount and keeps status pending if under max", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    q.markError(id, "timeout");
    expect(q.get(id)!.retryCount).toBe(1);
    expect(q.get(id)!.status).toBe("pending");
  });

  it('markError sets status to "error" after 5 retries', () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    for (let i = 0; i < 5; i++) q.markError(id, "timeout");
    expect(q.get(id)!.status).toBe("error");
    expect(q.pendingByPriority().find((e) => e.eventId === id)).toBeUndefined();
  });

  it("errored events are not included in pendingByPriority", () => {
    const q = makeQueue();
    const id = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    for (let i = 0; i < 5; i++) q.markError(id, "err");
    expect(q.pendingByPriority().length).toBe(0);
  });
});

// ── 7. Queue summary ─────────────────────────────────────────────────────────

describe("summary", () => {
  it("summary returns correct counts for each status", () => {
    const q = makeQueue();
    const id1 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d1",
      payload: {},
      driverGPS: null,
    });
    const id2 = q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d2",
      payload: {},
      driverGPS: null,
    });
    q.append({
      type: "DELIVERY_STATUS",
      deliveryId: "d3",
      payload: {},
      driverGPS: null,
    });
    q.markSynced(id1);
    q.markConflict(id2, "conflict");
    const s = q.summary();
    expect(s.pending).toBe(1);
    expect(s.synced).toBe(1);
    expect(s.conflict).toBe(1);
    expect(s.error).toBe(0);
    expect(s.total).toBe(3);
  });
});
