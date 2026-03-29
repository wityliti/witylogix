/**
 * COD (Cash-on-Delivery) Reconciliation Routes
 *
 * Routes:
 *   GET    /drivers/:driverId/ledger    — Per-driver cash ledger with running total
 *   GET    /drivers/:driverId/shift     — Current shift summary (expected vs. collected)
 *   POST   /drivers/:driverId/settle    — Driver confirms end-of-shift cash total
 *   GET    /manager                     — Manager view: all drivers' COD status for a date
 *   PATCH  /:collectionId/verify        — Manager verifies a COD collection
 *   PATCH  /:collectionId/reconcile     — Mark as reconciled with deposit info
 *   POST   /:collectionId/flag          — Flag a discrepancy with notes
 *   GET    /export                      — CSV export of COD reconciliation report
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

// ─── SCHEMAS ─────────────────────────────────────────────────────────

const driverLedgerQuery = z.object({
  date: z.string().optional(), // YYYY-MM-DD — filter to a specific day
  status: z.enum(['pending', 'collected', 'verified', 'reconciled', 'failed']).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const shiftQuery = z.object({
  date: z.string().optional(), // YYYY-MM-DD — defaults to today
});

const settleBody = z.object({
  declaredAmount: z.number().int().nonneg(), // cents
  notes: z.string().max(500).optional(),
});

const managerQuery = z.object({
  date: z.string().optional(), // YYYY-MM-DD — defaults to today
  driverId: z.string().uuid().optional(),
});

const verifyBody = z.object({
  notes: z.string().max(500).optional(),
});

const reconcileBody = z.object({
  depositId: z.string().min(1),
  depositDate: z.string(), // ISO date string
  notes: z.string().max(500).optional(),
});

const flagBody = z.object({
  reason: z.string().min(1).max(500),
  discrepancyAmount: z.number().int().optional(), // cents — amount the flag concerns
});

const exportQuery = z.object({
  fromDate: z.string(), // YYYY-MM-DD
  toDate: z.string(), // YYYY-MM-DD
  driverId: z.string().uuid().optional(),
  status: z.enum(['pending', 'collected', 'verified', 'reconciled', 'failed']).optional(),
});

// ─── HELPERS ─────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateRange(dateStr: string): { gte: Date; lt: Date } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new ValidationError(`Invalid date: ${dateStr}`);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return { gte: d, lt: next };
}

function centsToDisplay(cents: bigint | number): number {
  return Number(cents) / 100;
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── ROUTE PLUGIN ────────────────────────────────────────────────────

export default async function codRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── PER-DRIVER LEDGER ────────────────────────────────────────────

  /**
   * GET /cod/drivers/:driverId/ledger
   * Returns all COD collections for a driver with a running total.
   */
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/ledger',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { driverId } = request.params as { driverId: string };
      const query = driverLedgerQuery.parse(request.query);
      const { date, status, limit, offset } = query;

      // Verify driver exists and belongs to this shop
      const driver = await request.tenantDb.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, phone: true, shopId: true },
      });
      if (!driver || driver.shopId !== request.shopId) {
        throw new NotFoundError('Driver', driverId);
      }

      const where: any = { driverId, shopId: request.shopId };
      if (status) where.status = status;
      if (date) {
        const range = parseDateRange(date);
        where.collectedAt = { gte: range.gte, lt: range.lt };
      }

      const [collections, total] = await Promise.all([
        request.tenantDb.cODCollection.findMany({
          where,
          include: {
            shipment: { select: { shipmentNumber: true, trackingNumber: true } },
            order: { select: { externalOrderNumber: true, customerName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        request.tenantDb.cODCollection.count({ where }),
      ]);

      // Compute running totals for the returned page
      const totalCollected = await request.tenantDb.cODCollection.aggregate({
        where: { driverId, shopId: request.shopId, status: { in: ['collected', 'verified', 'reconciled'] } },
        _sum: { amount: true },
      });
      const totalPending = await request.tenantDb.cODCollection.aggregate({
        where: { driverId, shopId: request.shopId, status: 'pending' },
        _sum: { amount: true },
      });

      return reply.send({
        driver: { id: driver.id, name: driver.name, phone: driver.phone },
        ledger: collections.map((c) => ({
          id: c.id,
          status: c.status,
          amount: centsToDisplay(c.amount),
          currency: c.currency,
          collectedAt: c.collectedAt,
          verifiedAt: c.verifiedAt,
          reconciledAt: c.reconciledAt,
          depositId: c.depositId,
          driverNotes: c.driverNotes,
          shipment: c.shipment
            ? { number: c.shipment.shipmentNumber, tracking: c.shipment.trackingNumber }
            : null,
          order: c.order
            ? { number: c.order.externalOrderNumber, customer: c.order.customerName }
            : null,
          createdAt: c.createdAt,
        })),
        totals: {
          collected: centsToDisplay(totalCollected._sum.amount ?? 0n),
          pending: centsToDisplay(totalPending._sum.amount ?? 0n),
        },
        pagination: { total, limit, offset, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ── SHIFT SUMMARY ────────────────────────────────────────────────

  /**
   * GET /cod/drivers/:driverId/shift
   * Returns the shift summary: expected vs. collected, settlement status.
   */
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/shift',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { driverId } = request.params as { driverId: string };
      const { date } = shiftQuery.parse(request.query);
      const shiftDate = date ?? todayIso();

      const driver = await request.tenantDb.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, phone: true, shopId: true },
      });
      if (!driver || driver.shopId !== request.shopId) {
        throw new NotFoundError('Driver', driverId);
      }

      const dateRange = parseDateRange(shiftDate);

      // All shipments assigned to this driver for the date that have a COD amount
      const shipments = await request.tenantDb.shipment.findMany({
        where: {
          driverId,
          shopId: request.shopId,
          deliveryDate: { gte: dateRange.gte, lt: dateRange.lt },
          codAmount: { gt: 0 },
        },
        select: {
          id: true,
          shipmentNumber: true,
          codAmount: true,
          status: true,
          cODCollections: {
            select: { id: true, amount: true, status: true, collectedAt: true },
          },
        },
      });

      // Expected total = sum of codAmount on all shipments for the day
      let expectedCents = 0n;
      let collectedCents = 0n;
      let settledCents = 0n; // driver's declared amount from settlement

      const shipmentSummary = shipments.map((s) => {
        const expectedAmount = BigInt(Math.round(Number(s.codAmount) * 100));
        expectedCents += expectedAmount;

        const collections = s.cODCollections ?? [];
        const collectedForShipment = collections
          .filter((c) => ['collected', 'verified', 'reconciled'].includes(c.status))
          .reduce((acc, c) => acc + c.amount, 0n);
        collectedCents += collectedForShipment;

        return {
          shipmentId: s.id,
          shipmentNumber: s.shipmentNumber,
          shipmentStatus: s.status,
          expectedAmount: Number(expectedAmount) / 100,
          collectedAmount: Number(collectedForShipment) / 100,
          collections: collections.map((c) => ({
            id: c.id,
            status: c.status,
            amount: Number(c.amount) / 100,
            collectedAt: c.collectedAt,
          })),
        };
      });

      // Check for a settlement record in metadata
      const settlementRecord = await request.tenantDb.cODCollection.findFirst({
        where: {
          driverId,
          shopId: request.shopId,
          collectedAt: { gte: dateRange.gte, lt: dateRange.lt },
          status: { in: ['verified', 'reconciled'] },
          metadata: { path: ['isSettlement'], equals: true },
        },
        select: { id: true, amount: true, driverNotes: true, collectedAt: true, status: true },
      });

      const discrepancy = Number(collectedCents - expectedCents) / 100;

      return reply.send({
        driver: { id: driver.id, name: driver.name, phone: driver.phone },
        shiftDate,
        summary: {
          expectedAmount: Number(expectedCents) / 100,
          collectedAmount: Number(collectedCents) / 100,
          discrepancy,
          discrepancyPercent:
            expectedCents > 0n
              ? Math.round((Number(collectedCents - expectedCents) / Number(expectedCents)) * 10000) / 100
              : 0,
          isSettled: settlementRecord !== null,
          settlement: settlementRecord
            ? {
                id: settlementRecord.id,
                declaredAmount: Number(settlementRecord.amount) / 100,
                notes: settlementRecord.driverNotes,
                settledAt: settlementRecord.collectedAt,
                status: settlementRecord.status,
              }
            : null,
        },
        shipments: shipmentSummary,
      });
    },
  );

  // ── SHIFT SETTLEMENT ─────────────────────────────────────────────

  /**
   * POST /cod/drivers/:driverId/settle
   * Driver declares total cash collected at end of shift.
   * Creates a CODCollection with metadata.isSettlement = true.
   */
  fastify.post<{ Params: { driverId: string } }>(
    '/drivers/:driverId/settle',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { driverId } = request.params as { driverId: string };
      const body = settleBody.parse(request.body);

      const driver = await request.tenantDb.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, shopId: true },
      });
      if (!driver || driver.shopId !== request.shopId) {
        throw new NotFoundError('Driver', driverId);
      }

      // Check for existing settlement today
      const today = todayIso();
      const range = parseDateRange(today);
      const existing = await request.tenantDb.cODCollection.findFirst({
        where: {
          driverId,
          shopId: request.shopId,
          collectedAt: { gte: range.gte, lt: range.lt },
          metadata: { path: ['isSettlement'], equals: true },
        },
      });
      if (existing) {
        throw new ValidationError('Shift already settled for today. Contact a manager to revise.');
      }

      const settlement = await request.tenantDb.cODCollection.create({
        data: {
          shopId: request.shopId,
          driverId,
          amount: BigInt(body.declaredAmount),
          currency: 'USD',
          status: 'collected',
          collectedAt: new Date(),
          driverNotes: body.notes ?? null,
          metadata: { isSettlement: true, declaredBy: 'driver' },
        },
      });

      reply.status(201);
      return reply.send({
        id: settlement.id,
        declaredAmount: Number(settlement.amount) / 100,
        currency: settlement.currency,
        status: settlement.status,
        collectedAt: settlement.collectedAt,
        message: 'Shift settlement recorded. Awaiting manager verification.',
      });
    },
  );

  // ── MANAGER VIEW ─────────────────────────────────────────────────

  /**
   * GET /cod/manager
   * Manager view: expected vs. collected COD per driver for a given date.
   */
  fastify.get(
    '/manager',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { date, driverId } = managerQuery.parse(request.query);
      const reportDate = date ?? todayIso();
      const range = parseDateRange(reportDate);

      const driverWhere: any = { shopId: request.shopId, isActive: true };
      if (driverId) driverWhere.id = driverId;

      const drivers = await request.tenantDb.driver.findMany({
        where: driverWhere,
        select: { id: true, name: true, phone: true, vehicleType: true },
        orderBy: { name: 'asc' },
      });

      const driverIds = drivers.map((d: { id: string }) => d.id);

      // Expected: shipments with codAmount > 0 for these drivers on this date
      const shipments = await request.tenantDb.shipment.findMany({
        where: {
          shopId: request.shopId,
          driverId: { in: driverIds },
          deliveryDate: { gte: range.gte, lt: range.lt },
          codAmount: { gt: 0 },
        },
        select: {
          driverId: true,
          codAmount: true,
          status: true,
          cODCollections: {
            select: { amount: true, status: true },
          },
        },
      });

      // Collections not tied to a shipment (e.g. manual entries, settlements)
      const extraCollections = await request.tenantDb.cODCollection.findMany({
        where: {
          shopId: request.shopId,
          driverId: { in: driverIds },
          collectedAt: { gte: range.gte, lt: range.lt },
          shipmentId: null,
        },
        select: { driverId: true, amount: true, status: true },
      });

      // Aggregate per driver
      const driverMap: Record<string, { expected: bigint; collected: bigint; verified: bigint; reconciled: bigint; pendingCount: number; discrepancyCount: number }> = {};
      for (const d of drivers) {
        driverMap[d.id] = { expected: 0n, collected: 0n, verified: 0n, reconciled: 0n, pendingCount: 0, discrepancyCount: 0 };
      }

      for (const s of shipments) {
        if (!s.driverId || !(s.driverId in driverMap)) continue;
        const entry = driverMap[s.driverId];
        const expectedCents = BigInt(Math.round(Number(s.codAmount) * 100));
        entry.expected += expectedCents;

        for (const c of s.cODCollections ?? []) {
          if (c.status === 'collected') entry.collected += c.amount;
          else if (c.status === 'verified') entry.verified += c.amount;
          else if (c.status === 'reconciled') entry.reconciled += c.amount;
          else if (c.status === 'pending') entry.pendingCount += 1;
        }
      }

      for (const c of extraCollections) {
        if (!c.driverId || !(c.driverId in driverMap)) continue;
        const entry = driverMap[c.driverId];
        if (c.status === 'collected') entry.collected += c.amount;
        else if (c.status === 'verified') entry.verified += c.amount;
        else if (c.status === 'reconciled') entry.reconciled += c.amount;
      }

      const rows = drivers.map((d: { id: string; name: string; phone: string; vehicleType: string }) => {
        const e = driverMap[d.id];
        const totalCollected = e.collected + e.verified + e.reconciled;
        const discrepancy = Number(totalCollected - e.expected) / 100;
        return {
          driverId: d.id,
          driverName: d.name,
          driverPhone: d.phone,
          vehicleType: d.vehicleType,
          expectedAmount: Number(e.expected) / 100,
          collectedAmount: Number(totalCollected) / 100,
          verifiedAmount: Number(e.verified + e.reconciled) / 100,
          reconciledAmount: Number(e.reconciled) / 100,
          discrepancy,
          hasDiscrepancy: discrepancy !== 0,
          pendingCount: e.pendingCount,
        };
      });

      const totals = rows.reduce(
        (acc: { expected: number; collected: number; discrepancy: number }, r: typeof rows[0]) => ({
          expected: acc.expected + r.expectedAmount,
          collected: acc.collected + r.collectedAmount,
          discrepancy: acc.discrepancy + r.discrepancy,
        }),
        { expected: 0, collected: 0, discrepancy: 0 },
      );

      return reply.send({
        date: reportDate,
        drivers: rows,
        totals,
        driverCount: drivers.length,
        discrepancyCount: rows.filter((r: typeof rows[0]) => r.hasDiscrepancy).length,
      });
    },
  );

  // ── VERIFY COLLECTION ────────────────────────────────────────────

  /**
   * PATCH /cod/:collectionId/verify
   * Manager marks a COD collection as verified.
   */
  fastify.patch<{ Params: { collectionId: string } }>(
    '/:collectionId/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { collectionId } = request.params as { collectionId: string };
      const body = verifyBody.parse(request.body);

      const collection = await request.tenantDb.cODCollection.findUnique({
        where: { id: collectionId },
      });
      if (!collection || collection.shopId !== request.shopId) {
        throw new NotFoundError('CODCollection', collectionId);
      }
      if (!['pending', 'collected'].includes(collection.status)) {
        throw new ValidationError(`Cannot verify a collection with status: ${collection.status}`);
      }

      const updated = await request.tenantDb.cODCollection.update({
        where: { id: collectionId },
        data: {
          status: 'verified',
          verifiedAt: new Date(),
          metadata: {
            ...(collection.metadata as object),
            verifiedByNotes: body.notes ?? null,
          },
        },
      });

      return reply.send({
        id: updated.id,
        status: updated.status,
        verifiedAt: updated.verifiedAt,
        amount: Number(updated.amount) / 100,
      });
    },
  );

  // ── RECONCILE COLLECTION ─────────────────────────────────────────

  /**
   * PATCH /cod/:collectionId/reconcile
   * Link a COD collection to a bank deposit and mark reconciled.
   */
  fastify.patch<{ Params: { collectionId: string } }>(
    '/:collectionId/reconcile',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { collectionId } = request.params as { collectionId: string };
      const body = reconcileBody.parse(request.body);

      const collection = await request.tenantDb.cODCollection.findUnique({
        where: { id: collectionId },
      });
      if (!collection || collection.shopId !== request.shopId) {
        throw new NotFoundError('CODCollection', collectionId);
      }
      if (!['collected', 'verified'].includes(collection.status)) {
        throw new ValidationError(`Cannot reconcile a collection with status: ${collection.status}`);
      }

      const depositDate = new Date(body.depositDate);
      if (isNaN(depositDate.getTime())) {
        throw new ValidationError('Invalid depositDate');
      }

      const updated = await request.tenantDb.cODCollection.update({
        where: { id: collectionId },
        data: {
          status: 'reconciled',
          reconciledAt: new Date(),
          depositId: body.depositId,
          depositDate,
          metadata: {
            ...(collection.metadata as object),
            reconcileNotes: body.notes ?? null,
          },
        },
      });

      return reply.send({
        id: updated.id,
        status: updated.status,
        reconciledAt: updated.reconciledAt,
        depositId: updated.depositId,
        depositDate: updated.depositDate,
        amount: Number(updated.amount) / 100,
      });
    },
  );

  // ── FLAG DISCREPANCY ─────────────────────────────────────────────

  /**
   * POST /cod/:collectionId/flag
   * Flag a COD collection as having a discrepancy.
   */
  fastify.post<{ Params: { collectionId: string } }>(
    '/:collectionId/flag',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { collectionId } = request.params as { collectionId: string };
      const body = flagBody.parse(request.body);

      const collection = await request.tenantDb.cODCollection.findUnique({
        where: { id: collectionId },
      });
      if (!collection || collection.shopId !== request.shopId) {
        throw new NotFoundError('CODCollection', collectionId);
      }

      const updated = await request.tenantDb.cODCollection.update({
        where: { id: collectionId },
        data: {
          status: 'failed',
          metadata: {
            ...(collection.metadata as object),
            flaggedReason: body.reason,
            flaggedDiscrepancyAmount: body.discrepancyAmount ?? null,
            flaggedAt: new Date().toISOString(),
          },
        },
      });

      return reply.send({
        id: updated.id,
        status: updated.status,
        flaggedReason: body.reason,
        amount: Number(updated.amount) / 100,
      });
    },
  );

  // ── CSV EXPORT ───────────────────────────────────────────────────

  /**
   * GET /cod/export
   * Download COD reconciliation report as CSV.
   */
  fastify.get(
    '/export',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = exportQuery.parse(request.query);
      const { fromDate, toDate, driverId, status } = query;

      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setDate(to.getDate() + 1); // inclusive end

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new ValidationError('Invalid fromDate or toDate');
      }
      if (from > to) {
        throw new ValidationError('fromDate must be before toDate');
      }

      const where: any = {
        shopId: request.shopId,
        createdAt: { gte: from, lt: to },
      };
      if (driverId) where.driverId = driverId;
      if (status) where.status = status;

      const collections = await request.tenantDb.cODCollection.findMany({
        where,
        include: {
          driver: { select: { name: true, phone: true } },
          shipment: { select: { shipmentNumber: true, trackingNumber: true } },
          order: { select: { externalOrderNumber: true, customerName: true } },
        },
        orderBy: [{ driverId: 'asc' }, { createdAt: 'asc' }],
      });

      const header = [
        'Collection ID',
        'Date',
        'Driver Name',
        'Driver Phone',
        'Shipment Number',
        'Tracking Number',
        'Order Number',
        'Customer Name',
        'Amount',
        'Currency',
        'Status',
        'Collected At',
        'Verified At',
        'Reconciled At',
        'Deposit ID',
        'Deposit Date',
        'Driver Notes',
      ].join(',');

      const rows = collections.map((c) =>
        [
          escapeCsv(c.id),
          escapeCsv(c.createdAt.toISOString().slice(0, 10)),
          escapeCsv(c.driver?.name),
          escapeCsv(c.driver?.phone),
          escapeCsv(c.shipment?.shipmentNumber),
          escapeCsv(c.shipment?.trackingNumber),
          escapeCsv(c.order?.externalOrderNumber),
          escapeCsv(c.order?.customerName),
          escapeCsv(Number(c.amount) / 100),
          escapeCsv(c.currency),
          escapeCsv(c.status),
          escapeCsv(c.collectedAt?.toISOString() ?? ''),
          escapeCsv(c.verifiedAt?.toISOString() ?? ''),
          escapeCsv(c.reconciledAt?.toISOString() ?? ''),
          escapeCsv(c.depositId),
          escapeCsv(c.depositDate?.toISOString().slice(0, 10) ?? ''),
          escapeCsv(c.driverNotes),
        ].join(','),
      );

      const csv = [header, ...rows].join('\n');
      const filename = `cod-reconciliation-${fromDate}-to-${toDate}.csv`;

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(csv);
    },
  );
}
