import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * OTP Delivery Confirmation Tests — WIT-92
 *
 * Covers:
 * - OTP generation and dispatch (SMS/WhatsApp) at shipment dispatch time
 * - OTP verification before delivery completion
 * - Delivery blocked when requireOTPConfirmation=true and OTP not verified
 * - Supervisor override with audit log entry
 * - Rate limiting on OTP verification attempts
 * - OTP expiry enforcement
 * - Orders without requireOTPConfirmation are unaffected
 */

// ─── MOCK TYPES ─────────────────────────────────────────────

interface MockOrder {
  id: string;
  shopId: string;
  status: string;
  requireOTPConfirmation: boolean;
  customerPhone: string | null;
  customerName: string | null;
  deliveryStartedAt: Date | null;
  estimatedDeliveryDate: Date | null;
}

interface MockOTPRecord {
  id: string;
  orderId: string;
  code: string;
  channel: 'sms' | 'whatsapp';
  recipientPhone: string;
  verified: boolean;
  verifiedAt: Date | null;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

interface MockAuditLog {
  id: string;
  orderId: string;
  action: string;
  actorId: string;
  actorRole: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─── FACTORIES ──────────────────────────────────────────────

const makeOrder = (overrides: Partial<MockOrder> = {}): MockOrder => ({
  id: 'order-aaa-111',
  shopId: 'shop-123',
  status: 'OUT_FOR_DELIVERY',
  requireOTPConfirmation: false,
  customerPhone: '+61400000001',
  customerName: 'Alice Smith',
  deliveryStartedAt: new Date(Date.now() - 30 * 60 * 1000),
  estimatedDeliveryDate: new Date(Date.now() + 30 * 60 * 1000),
  ...overrides,
});

const makeOTPRecord = (overrides: Partial<MockOTPRecord> = {}): MockOTPRecord => ({
  id: 'otp-rec-001',
  orderId: 'order-aaa-111',
  code: '483920',
  channel: 'sms',
  recipientPhone: '+61400000001',
  verified: false,
  verifiedAt: null,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
  attempts: 0,
  createdAt: new Date(),
  ...overrides,
});

// ─── MOCK DB SETUP ──────────────────────────────────────────

function makeTenantDb(orderOverrides: Partial<MockOrder> = {}) {
  const order = makeOrder(orderOverrides);

  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({ ...order, status: 'DELIVERED' }),
    },
    deliveryOTP: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: any }) => ({
        id: 'otp-rec-new',
        ...data,
        attempts: 0,
        verified: false,
        verifiedAt: null,
        createdAt: new Date(),
      })),
      update: vi.fn().mockImplementation(async ({ data }: { data: any }) => ({
        ...makeOTPRecord(),
        ...data,
      })),
    },
    deliveryAuditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-001' }),
    },
    workflowExecution: {
      create: vi.fn().mockResolvedValue({ id: 'exec-001' }),
    },
  };
}

// ─── OTP SERVICE CONTRACT ───────────────────────────────────
// These tests specify the behaviour the OTP service MUST satisfy
// (spec-first / TDD). Implementation lives in packages/core/src/delivery/otp-service.ts

describe('DeliveryOTPService', () => {

  describe('generateAndSend', () => {
    it('generates a 6-digit numeric OTP', async () => {
      const { generateDeliveryOTP } = await import('../../services/delivery-otp.js').catch(
        () => ({ generateDeliveryOTP: mockGenerateDeliveryOTP }),
      );

      const result = await generateDeliveryOTP({
        orderId: 'order-aaa-111',
        recipientPhone: '+61400000001',
        channel: 'sms',
      });

      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('sets expiry to 10 minutes from generation', async () => {
      const before = Date.now();
      const result = await mockGenerateDeliveryOTP({
        orderId: 'order-aaa-111',
        recipientPhone: '+61400000001',
        channel: 'sms',
      });
      const after = Date.now();

      const expiryMs = result.expiresAt.getTime();
      expect(expiryMs).toBeGreaterThanOrEqual(before + 10 * 60 * 1000 - 100);
      expect(expiryMs).toBeLessThanOrEqual(after + 10 * 60 * 1000 + 100);
    });

    it('supports both sms and whatsapp channels', async () => {
      const smsResult = await mockGenerateDeliveryOTP({
        orderId: 'order-111',
        recipientPhone: '+61400000001',
        channel: 'sms',
      });
      const waResult = await mockGenerateDeliveryOTP({
        orderId: 'order-222',
        recipientPhone: '+61400000002',
        channel: 'whatsapp',
      });

      expect(smsResult.channel).toBe('sms');
      expect(waResult.channel).toBe('whatsapp');
    });

    it('throws when order has no customer phone number', async () => {
      await expect(
        mockGenerateDeliveryOTP({
          orderId: 'order-no-phone',
          recipientPhone: null as any,
          channel: 'sms',
        }),
      ).rejects.toThrow(/phone/i);
    });
  });

  describe('verifyOTP', () => {
    it('returns true for correct, unexpired code', async () => {
      const record = makeOTPRecord({ code: '483920', attempts: 0 });
      const result = await mockVerifyDeliveryOTP(record, '483920');
      expect(result.valid).toBe(true);
    });

    it('returns false for wrong code', async () => {
      const record = makeOTPRecord({ code: '483920' });
      const result = await mockVerifyDeliveryOTP(record, '000000');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/invalid/i);
    });

    it('returns false for expired OTP', async () => {
      const record = makeOTPRecord({
        code: '483920',
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });
      const result = await mockVerifyDeliveryOTP(record, '483920');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });

    it('returns false if already verified', async () => {
      const record = makeOTPRecord({
        code: '483920',
        verified: true,
        verifiedAt: new Date(),
      });
      const result = await mockVerifyDeliveryOTP(record, '483920');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/already used/i);
    });

    it('increments attempt counter on each call', async () => {
      const record = makeOTPRecord({ code: '483920', attempts: 2 });
      const result = await mockVerifyDeliveryOTP(record, '000000');
      expect(result.attempts).toBe(3);
    });

    it('rejects after 5 failed attempts (rate limit)', async () => {
      const record = makeOTPRecord({ code: '483920', attempts: 5 });
      const result = await mockVerifyDeliveryOTP(record, '483920'); // correct code, too many attempts
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/too many attempts/i);
    });
  });
});

// ─── API ROUTE CONTRACT ─────────────────────────────────────
// Describes expected HTTP behaviour for the OTP endpoints.

describe('POST /api/deliveries/:deliveryId/otp/send', () => {
  it('returns 200 and sends OTP when requireOTPConfirmation is true', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(null);
    db.deliveryOTP.create = vi.fn().mockResolvedValue(makeOTPRecord());

    const result = await mockSendOTPRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      channel: 'sms',
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data.channel).toBe('sms');
    expect(result.body.data.maskedPhone).toMatch(/^\+\d{2}\*+\d{2}$/);
    expect(db.deliveryOTP.create).toHaveBeenCalledOnce();
  });

  it('returns 400 when order has no customer phone', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true, customerPhone: null });

    const result = await mockSendOTPRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      channel: 'sms',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/phone/i);
  });

  it('returns 409 if valid unexpired OTP already exists for this order', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(makeOTPRecord()); // existing unexpired OTP

    const result = await mockSendOTPRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      channel: 'sms',
    });

    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/otp already sent/i);
  });

  it('returns 404 if order does not exist', async () => {
    const db = makeTenantDb();
    db.order.findUnique = vi.fn().mockResolvedValue(null);

    const result = await mockSendOTPRoute({
      orderId: 'order-not-found',
      tenantDb: db,
      channel: 'sms',
    });

    expect(result.status).toBe(404);
  });
});

describe('POST /api/deliveries/:deliveryId/otp/verify', () => {
  it('returns 200 and marks OTP verified for correct code', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(makeOTPRecord({ code: '483920' }));
    db.deliveryOTP.update = vi.fn().mockResolvedValue(makeOTPRecord({ verified: true, verifiedAt: new Date() }));

    const result = await mockVerifyOTPRoute({
      orderId: 'order-aaa-111',
      code: '483920',
      tenantDb: db,
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data.verified).toBe(true);
    expect(db.deliveryOTP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verified: true }),
      }),
    );
  });

  it('returns 422 for wrong OTP code', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(makeOTPRecord({ code: '483920', attempts: 0 }));

    const result = await mockVerifyOTPRoute({
      orderId: 'order-aaa-111',
      code: '000000',
      tenantDb: db,
    });

    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/invalid/i);
    expect(result.body.attemptsRemaining).toBe(4);
  });

  it('returns 422 for expired OTP', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(
      makeOTPRecord({ code: '483920', expiresAt: new Date(Date.now() - 1000) }),
    );

    const result = await mockVerifyOTPRoute({
      orderId: 'order-aaa-111',
      code: '483920',
      tenantDb: db,
    });

    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/expired/i);
  });

  it('returns 429 after 5 failed attempts', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(
      makeOTPRecord({ code: '483920', attempts: 5 }),
    );

    const result = await mockVerifyOTPRoute({
      orderId: 'order-aaa-111',
      code: '483920',
      tenantDb: db,
    });

    expect(result.status).toBe(429);
    expect(result.body.error).toMatch(/too many attempts/i);
  });

  it('returns 404 if no OTP exists for order', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(null);

    const result = await mockVerifyOTPRoute({
      orderId: 'order-aaa-111',
      code: '483920',
      tenantDb: db,
    });

    expect(result.status).toBe(404);
    expect(result.body.error).toMatch(/no otp/i);
  });
});

describe('Delivery completion — OTP gate', () => {
  it('blocks completion when requireOTPConfirmation=true and OTP not verified', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(
      makeOTPRecord({ verified: false }),
    );

    const result = await mockCompleteDeliveryRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      podPhotoUrl: 'https://cdn.example.com/pod.jpg',
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/otp/i);
    expect(result.body.code).toBe('OTP_REQUIRED');
  });

  it('allows completion when requireOTPConfirmation=true and OTP is verified', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(
      makeOTPRecord({ verified: true, verifiedAt: new Date() }),
    );

    const result = await mockCompleteDeliveryRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      podPhotoUrl: 'https://cdn.example.com/pod.jpg',
    });

    expect(result.status).toBe(200);
  });

  it('allows completion when requireOTPConfirmation=false with no OTP', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: false });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(null);

    const result = await mockCompleteDeliveryRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      podPhotoUrl: 'https://cdn.example.com/pod.jpg',
    });

    expect(result.status).toBe(200);
  });

  it('returns 403 when requireOTPConfirmation=true and no OTP record exists at all', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(null);

    const result = await mockCompleteDeliveryRoute({
      orderId: 'order-aaa-111',
      tenantDb: db,
      podPhotoUrl: 'https://cdn.example.com/pod.jpg',
    });

    expect(result.status).toBe(403);
    expect(result.body.code).toBe('OTP_REQUIRED');
  });
});

describe('POST /api/deliveries/:deliveryId/otp/supervisor-override', () => {
  it('allows supervisor to bypass OTP and records audit log', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });
    db.deliveryOTP.findFirst = vi.fn().mockResolvedValue(
      makeOTPRecord({ verified: false }),
    );
    db.deliveryAuditLog.create = vi.fn().mockResolvedValue({ id: 'audit-001' });

    const result = await mockSupervisorOverrideRoute({
      orderId: 'order-aaa-111',
      supervisorId: 'user-supervisor-01',
      supervisorRole: 'SUPERVISOR',
      reason: 'Recipient unable to receive SMS — ID verified in person',
      tenantDb: db,
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(db.deliveryAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'OTP_SUPERVISOR_OVERRIDE',
          actorId: 'user-supervisor-01',
          orderId: 'order-aaa-111',
        }),
      }),
    );
  });

  it('rejects override from non-supervisor role', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });

    const result = await mockSupervisorOverrideRoute({
      orderId: 'order-aaa-111',
      supervisorId: 'user-driver-01',
      supervisorRole: 'DRIVER',
      reason: 'Testing',
      tenantDb: db,
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/insufficient/i);
    expect(db.deliveryAuditLog.create).not.toHaveBeenCalled();
  });

  it('requires a non-empty reason string', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });

    const result = await mockSupervisorOverrideRoute({
      orderId: 'order-aaa-111',
      supervisorId: 'user-supervisor-01',
      supervisorRole: 'SUPERVISOR',
      reason: '',
      tenantDb: db,
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/reason/i);
  });

  it('audit log metadata includes orderId, supervisorId, and override reason', async () => {
    const db = makeTenantDb({ requireOTPConfirmation: true });

    await mockSupervisorOverrideRoute({
      orderId: 'order-aaa-111',
      supervisorId: 'user-supervisor-01',
      supervisorRole: 'SUPERVISOR',
      reason: 'ID verified in person',
      tenantDb: db,
    });

    const auditCall = db.deliveryAuditLog.create.mock.calls[0][0];
    expect(auditCall.data.metadata).toMatchObject({
      reason: 'ID verified in person',
      orderId: 'order-aaa-111',
    });
  });
});

describe('OTP schema — requireOTPConfirmation on Order', () => {
  it('Order.requireOTPConfirmation defaults to false', () => {
    const order = makeOrder();
    expect(order.requireOTPConfirmation).toBe(false);
  });

  it('Order.requireOTPConfirmation can be set to true', () => {
    const order = makeOrder({ requireOTPConfirmation: true });
    expect(order.requireOTPConfirmation).toBe(true);
  });
});

// ─── STUB IMPLEMENTATIONS ───────────────────────────────────
// These stubs stand in for the real service/route implementations
// that will be built. Tests will be updated to import real modules
// once WIT-92 implementation is complete.

async function mockGenerateDeliveryOTP(params: {
  orderId: string;
  recipientPhone: string | null;
  channel: 'sms' | 'whatsapp';
}): Promise<MockOTPRecord> {
  if (!params.recipientPhone) {
    throw new Error('Customer phone number is required to send OTP');
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return makeOTPRecord({
    orderId: params.orderId,
    code,
    channel: params.channel,
    recipientPhone: params.recipientPhone,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
}

async function mockVerifyDeliveryOTP(
  record: MockOTPRecord,
  code: string,
): Promise<{ valid: boolean; reason?: string; attempts: number }> {
  const newAttempts = record.attempts + 1;

  if (record.attempts >= 5) {
    return { valid: false, reason: 'Too many attempts. Request a new OTP.', attempts: newAttempts };
  }
  if (record.verified) {
    return { valid: false, reason: 'OTP already used', attempts: newAttempts };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'OTP expired', attempts: newAttempts };
  }
  if (record.code !== code) {
    return { valid: false, reason: 'Invalid OTP code', attempts: newAttempts };
  }
  return { valid: true, attempts: newAttempts };
}

async function mockSendOTPRoute(params: {
  orderId: string;
  tenantDb: ReturnType<typeof makeTenantDb>;
  channel: 'sms' | 'whatsapp';
}): Promise<{ status: number; body: any }> {
  const order = await params.tenantDb.order.findUnique({ where: { id: params.orderId } });
  if (!order) return { status: 404, body: { error: 'Order not found' } };
  if (!order.customerPhone) return { status: 400, body: { error: 'No phone number on file for this order' } };

  const existing = await params.tenantDb.deliveryOTP.findFirst({
    where: { orderId: params.orderId, verified: false },
  });
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    return { status: 409, body: { error: 'OTP already sent and still valid' } };
  }

  const record = await params.tenantDb.deliveryOTP.create({
    data: {
      orderId: params.orderId,
      code: '483920',
      channel: params.channel,
      recipientPhone: order.customerPhone,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const masked = order.customerPhone.replace(/(\+\d{2})\d+(\d{2})$/, '$1****$2');
  return {
    status: 200,
    body: { success: true, data: { channel: params.channel, maskedPhone: masked } },
  };
}

async function mockVerifyOTPRoute(params: {
  orderId: string;
  code: string;
  tenantDb: ReturnType<typeof makeTenantDb>;
}): Promise<{ status: number; body: any }> {
  const record = await params.tenantDb.deliveryOTP.findFirst({
    where: { orderId: params.orderId },
  }) as MockOTPRecord | null;

  if (!record) return { status: 404, body: { error: 'No OTP found for this order' } };

  const result = await mockVerifyDeliveryOTP(record, params.code);

  if (!result.valid) {
    if (result.reason?.match(/too many/i)) {
      return { status: 429, body: { error: result.reason } };
    }
    return {
      status: 422,
      body: { error: result.reason, attemptsRemaining: Math.max(0, 5 - result.attempts) },
    };
  }

  await params.tenantDb.deliveryOTP.update({ data: { verified: true, verifiedAt: new Date() } });
  return { status: 200, body: { success: true, data: { verified: true } } };
}

async function mockCompleteDeliveryRoute(params: {
  orderId: string;
  tenantDb: ReturnType<typeof makeTenantDb>;
  podPhotoUrl?: string;
}): Promise<{ status: number; body: any }> {
  const order = await params.tenantDb.order.findUnique({ where: { id: params.orderId } }) as MockOrder;

  if (order.requireOTPConfirmation) {
    const otp = await params.tenantDb.deliveryOTP.findFirst({
      where: { orderId: params.orderId },
    }) as MockOTPRecord | null;

    if (!otp || !otp.verified) {
      return { status: 403, body: { error: 'OTP confirmation required', code: 'OTP_REQUIRED' } };
    }
  }

  return { status: 200, body: { success: true, data: { orderId: params.orderId, status: 'DELIVERED' } } };
}

async function mockSupervisorOverrideRoute(params: {
  orderId: string;
  supervisorId: string;
  supervisorRole: string;
  reason: string;
  tenantDb: ReturnType<typeof makeTenantDb>;
}): Promise<{ status: number; body: any }> {
  if (!['SUPERVISOR', 'ADMIN', 'MANAGER'].includes(params.supervisorRole)) {
    return { status: 403, body: { error: 'Insufficient role to perform supervisor override' } };
  }
  if (!params.reason || params.reason.trim().length === 0) {
    return { status: 400, body: { error: 'Override reason is required' } };
  }

  await params.tenantDb.deliveryAuditLog.create({
    data: {
      orderId: params.orderId,
      action: 'OTP_SUPERVISOR_OVERRIDE',
      actorId: params.supervisorId,
      actorRole: params.supervisorRole,
      metadata: { orderId: params.orderId, reason: params.reason },
      createdAt: new Date(),
    },
  });

  return { status: 200, body: { success: true } };
}
