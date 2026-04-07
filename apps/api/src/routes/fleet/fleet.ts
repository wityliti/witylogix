/**
 * Fleet Management API Routes
 *
 * Endpoints:
 *   GET    /fleet/overview           - Fleet health and overview metrics
 *   GET    /fleet/vehicles            - List vehicles with filters
 *   GET    /fleet/vehicles/:id        - Get single vehicle details
 *   GET    /fleet/vehicles/:id/diagnostics - Vehicle diagnostics
 *   GET    /fleet/vehicles/:id/behavior    - Driver behavior events
 *   GET    /fleet/health              - Fleet health score
 *   POST   /fleet/vehicles            - Register new vehicle
 *   PATCH  /fleet/vehicles/:id        - Update vehicle
 *   GET    /fleet/vehicles/:id/maintenance - Maintenance alerts
 *   POST   /fleet/vehicles/:id/acknowledge - Acknowledge alerts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { prisma } from '@witylogix/db';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

// ─── VALIDATION SCHEMAS ──────────────────────────────────────────

const registerVehicleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  vin: z.string().length(17).optional(),
  licensePlate: z.string().min(1).max(20).optional(),
  engineType: z.enum(['GASOLINE', 'DIESEL', 'EV', 'HYBRID']).optional(),
  capacity: z.number().positive().optional(),
  primaryProvider: z.enum(['SAMSARA', 'GEOTAB', 'VERIZON', 'MOTIVE']),
  driverId: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  externalVehicleId: z.string().min(1),
});

const updateVehicleSchema = z.object({
  driverId: z.string().optional(),
  primaryProvider: z.enum(['SAMSARA', 'GEOTAB', 'VERIZON', 'MOTIVE']).optional(),
  capacity: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  nextMaintenanceDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']).optional(),
  tags: z.array(z.string()).optional(),
});

const vehicleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['ACTIVE', 'IDLE', 'OFFLINE', 'MAINTENANCE', 'INACTIVE']).optional(),
  search: z.string().optional(),
  provider: z.enum(['SAMSARA', 'GEOTAB', 'VERIZON', 'MOTIVE']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const acknowledgeEventSchema = z.object({
  eventId: z.string(),
});

// ─── HELPERS ────────────────────────────────────────────────────

/**
 * Compute a fleet health score from vehicle data.
 * Uses last_diagnostic_data and last_position staleness from FleetVehicle records.
 */
async function computeFleetHealthScore(tenantId: string) {
  const vehicles = await (prisma as any).fleetVehicle.findMany({
    where: { tenantId, status: { not: 'DELETED' } },
    select: {
      id: true,
      status: true,
      lastPosition: true,
      lastDiagnosticAt: true,
      lastDiagnosticData: true,
    },
  });

  if (vehicles.length === 0) {
    return {
      overallScore: 100,
      fuelEfficiency: 100,
      driverSafety: 100,
      maintenanceStatus: 100,
      utilizationRate: 0,
      trend: 'STABLE',
      lastUpdated: new Date(),
    };
  }

  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  let activeCount = 0;
  let vehiclesWithFaults = 0;
  let recentlySeenCount = 0;

  for (const v of vehicles) {
    if (v.status === 'ACTIVE') activeCount++;

    const diag = v.lastDiagnosticData as any;
    if (diag?.faultCodes && Array.isArray(diag.faultCodes) && diag.faultCodes.length > 0) {
      vehiclesWithFaults++;
    }

    if (v.lastPosition) {
      const pos = v.lastPosition as any;
      if (pos?.timestamp && now - new Date(pos.timestamp).getTime() < ONE_HOUR_MS) {
        recentlySeenCount++;
      }
    }
  }

  const total = vehicles.length;
  const connectivityPct = Math.round((recentlySeenCount / total) * 100);
  const faultRate = Math.round((vehiclesWithFaults / total) * 100);
  const utilizationRate = Math.round((activeCount / total) * 100);
  const overallScore = Math.max(0, Math.round(connectivityPct - faultRate * 0.5));

  return {
    overallScore,
    fuelEfficiency: Math.max(0, 100 - faultRate),
    driverSafety: 100,
    maintenanceStatus: Math.max(0, 100 - faultRate * 2),
    utilizationRate,
    trend: overallScore >= 80 ? 'IMPROVING' : overallScore >= 60 ? 'STABLE' : 'DECLINING',
    lastUpdated: new Date(),
  };
}

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function fleetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── GET FLEET OVERVIEW ─────────────────────────────────────

  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;

      const [vehicles, healthScore] = await Promise.all([
        (prisma as any).fleetVehicle.findMany({
          where: { tenantId, status: { not: 'DELETED' } },
          select: { id: true, status: true, lastDiagnosticData: true },
        }),
        computeFleetHealthScore(tenantId),
      ]);

      const statusCounts = { ACTIVE: 0, IDLE: 0, OFFLINE: 0, INACTIVE: 0 };
      let criticalAlertCount = 0;

      for (const v of vehicles) {
        const s = (v.status as string).toUpperCase();
        if (s in statusCounts) (statusCounts as any)[s]++;

        const diag = v.lastDiagnosticData as any;
        if (diag?.faultCodes && Array.isArray(diag.faultCodes)) {
          const critical = diag.faultCodes.filter((f: any) => f.severity === 'CRITICAL' || f.severity === 'ERROR');
          criticalAlertCount += critical.length;
        }
      }

      return {
        data: {
          fleetId: tenantId,
          totalVehicles: vehicles.length,
          activeVehicles: statusCounts.ACTIVE,
          idleVehicles: statusCounts.IDLE,
          offlineVehicles: statusCounts.OFFLINE + statusCounts.INACTIVE,
          maintenanceVehicles: 0,
          healthScore,
          topAlerts: [],
          recentEvents: [],
          averageFuelEconomy: null,
          totalIdleHours: null,
          criticalAlertCount,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch fleet overview: ${errorMessage}`);
    }
  });

  // ── LIST VEHICLES ──────────────────────────────────────────

  const listFleetVehicles = async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;
      const query = vehicleListQuerySchema.parse(request.query);
      const { page, limit, status, search, provider } = query;

      const where: Record<string, any> = {
        tenantId,
        status: status ? status : { not: 'DELETED' },
      };

      if (provider) {
        where.telematicsProvider = provider.toLowerCase();
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { make: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { licensePlate: { contains: search, mode: 'insensitive' } },
          { vin: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [vehicles, total] = await Promise.all([
        (prisma as any).fleetVehicle.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        (prisma as any).fleetVehicle.count({ where }),
      ]);

      return {
        data: vehicles,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      }
      throw error;
    }
  };

  fastify.get('/', listFleetVehicles);
  fastify.get('/vehicles', listFleetVehicles);

  // ── GET FLEET HEALTH SCORE (before /:id so "health" is not captured as id) ──

  fastify.get('/health', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;
      const healthScore = await computeFleetHealthScore(tenantId);
      return { data: healthScore };
    } catch (error) {
      throw error;
    }
  });

  // ── REGISTER VEHICLE ───────────────────────────────────────

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole('SUPER_ADMIN', 'ADMIN')(request, reply);

    try {
      const tenantId = (request as any).tenantId as string;
      const body = registerVehicleSchema.parse(request.body);

      // Verify telematics connection exists
      const connection = await (prisma as any).telematicsConnection.findUnique({
        where: {
          tenantId_provider: {
            tenantId,
            provider: body.primaryProvider.toLowerCase(),
          },
        },
        select: { id: true, status: true },
      });

      if (!connection) {
        return reply.status(400).send({
          error: `No telematics connection configured for provider ${body.primaryProvider}. Set up the integration first.`,
        });
      }

      const vehicle = await (prisma as any).fleetVehicle.create({
        data: {
          tenantId,
          telematicsProvider: body.primaryProvider.toLowerCase(),
          externalVehicleId: body.externalVehicleId,
          name: body.name || `${body.make} ${body.model}`,
          vin: body.vin,
          licensePlate: body.licensePlate,
          make: body.make,
          model: body.model,
          year: body.year,
          status: 'ACTIVE',
          metadata: {},
        },
      });

      reply.status(201);
      return { data: vehicle };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      }
      throw error;
    }
  });

  // ── UPDATE VEHICLE ────────────────────────────────────────

  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    try {
      const body = updateVehicleSchema.parse(request.body);

      const existing = await (prisma as any).fleetVehicle.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundError(`Vehicle ${id} not found`);
      }

      const updateData: Record<string, any> = {};
      if (body.status) updateData.status = body.status;
      if (body.tags) updateData.tags = body.tags;
      if (body.primaryProvider) updateData.telematicsProvider = body.primaryProvider.toLowerCase();

      const vehicle = await (prisma as any).fleetVehicle.update({
        where: { id },
        data: updateData,
      });

      return { data: vehicle };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      }
      throw error;
    }
  });

  // ── GET VEHICLE DIAGNOSTICS ───────────────────────────────

  fastify.get('/:id/diagnostics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    try {
      const vehicle = await (prisma as any).fleetVehicle.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          lastDiagnosticAt: true,
          lastDiagnosticData: true,
        },
      });

      if (!vehicle) {
        throw new NotFoundError(`Vehicle ${id} not found`);
      }

      // Also fetch recent diagnostic telemetry logs
      const logs = await (prisma as any).vehicleTelemetryLog.findMany({
        where: { vehicleId: id, tenantId, type: 'diagnostic' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, type: true, data: true, createdAt: true },
      });

      return {
        data: {
          vehicleId: id,
          lastDiagnosticAt: vehicle.lastDiagnosticAt,
          diagnosticData: vehicle.lastDiagnosticData,
          recentLogs: logs,
        },
      };
    } catch (error) {
      throw error;
    }
  });

  // ── GET DRIVER BEHAVIOR ────────────────────────────────────

  fastify.get(
    '/:id/behavior',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).tenantId as string;

      try {
        const vehicle = await (prisma as any).fleetVehicle.findFirst({
          where: { id, tenantId },
          select: { id: true },
        });

        if (!vehicle) {
          throw new NotFoundError(`Vehicle ${id} not found`);
        }

        // Parse optional date range
        let dateFilter: Record<string, any> = {};
        try {
          const query = dateRangeSchema.parse(request.query);
          dateFilter = {
            timestamp: {
              gte: new Date(query.startDate),
              lte: new Date(query.endDate),
            },
          };
        } catch {
          // No date range provided
        }

        const behaviors = await (prisma as any).driverBehaviorEvent.findMany({
          where: { vehicleId: id, tenantId, ...dateFilter },
          orderBy: { timestamp: 'desc' },
          take: 50,
        });

        return { data: behaviors };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
        }
        throw error;
      }
    },
  );

  // ── GET VEHICLE MAINTENANCE ALERTS ────────────────────────

  fastify.get(
    '/:id/maintenance',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).tenantId as string;

      try {
        const vehicle = await (prisma as any).fleetVehicle.findFirst({
          where: { id, tenantId },
          select: { id: true, lastDiagnosticData: true },
        });

        if (!vehicle) {
          throw new NotFoundError(`Vehicle ${id} not found`);
        }

        // Extract maintenance alerts from diagnostic data
        const diag = vehicle.lastDiagnosticData as any;
        const alerts = [];

        if (diag?.faultCodes && Array.isArray(diag.faultCodes)) {
          for (const fc of diag.faultCodes) {
            alerts.push({
              id: `fault-${fc.code || Math.random()}`,
              vehicleId: id,
              alertType: 'FAULT_CODE',
              code: fc.code,
              description: fc.description || fc.code,
              severity: fc.severity || 'WARNING',
              isCompleted: false,
              createdAt: vehicle.lastDiagnosticData ? new Date() : new Date(),
            });
          }
        }

        return { data: alerts };
      } catch (error) {
        throw error;
      }
    },
  );

  // ── ACKNOWLEDGE EVENT ──────────────────────────────────────

  fastify.post(
    '/:id/acknowledge',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      try {
        const body = acknowledgeEventSchema.parse(request.body);

        // TODO(WIT-86): No FleetEvent model exists yet — acknowledgements are not persisted.
        // Acknowledged state is lost on restart. A follow-up ticket should add a
        // `FleetEvent` model and write the acknowledged flag + actor here.
        return {
          data: {
            vehicleId: id,
            eventId: body.eventId,
            acknowledged: true,
            acknowledgedAt: new Date(),
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
        }
        throw error;
      }
    },
  );

  // ── GET FLEET-WIDE MAINTENANCE EVENTS ──────────────────────

  fastify.get('/maintenance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      // Fetch all vehicles with diagnostic data, then expand fault codes into
      // individual maintenance items and paginate the resulting item list.
      // Previously the query paginated by vehicle which gave incorrect item counts
      // when multiple fault codes existed per vehicle.
      const allVehicles = await (prisma as any).fleetVehicle.findMany({
        where: { tenantId, status: { not: 'DELETED' } },
        select: { id: true, name: true, licensePlate: true, make: true, model: true, lastDiagnosticData: true, lastDiagnosticAt: true },
        orderBy: { lastDiagnosticAt: 'desc' },
      });

      const allItems = allVehicles.flatMap((v: any) => {
        const diag = v.lastDiagnosticData as any;
        if (!diag?.faultCodes || !Array.isArray(diag.faultCodes)) return [];
        return diag.faultCodes.map((fc: any) => ({
          id: `fault-${v.id}-${fc.code}`,
          vehicleId: v.id,
          vehiclePlate: v.licensePlate,
          vehicleName: `${v.make || ''} ${v.model || ''} (${v.licensePlate || v.name})`.trim(),
          type: 'fault-code',
          code: fc.code,
          description: fc.description || fc.code,
          severity: fc.severity || 'WARNING',
          status: 'open',
          detectedAt: v.lastDiagnosticAt,
        }));
      });

      const total = allItems.length;
      const maintenanceItems = allItems.slice((page - 1) * limit, page * limit);

      return {
        data: maintenanceItems,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      throw error;
    }
  });

  // ── GET FUEL TRANSACTIONS ────────────────────────────────────

  fastify.get('/fuel-transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const logs = await (prisma as any).vehicleTelemetryLog.findMany({
        where: { tenantId, type: 'fuel' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, vehicleId: true, data: true, createdAt: true },
      });

      const total = await (prisma as any).vehicleTelemetryLog.count({
        where: { tenantId, type: 'fuel' },
      });

      const transactions = logs.map((log: any) => ({
        id: log.id,
        vehicleId: log.vehicleId,
        date: log.createdAt,
        ...(log.data as object),
      }));

      return {
        data: transactions,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      throw error;
    }
  });

  // ── GET FUEL (dashboard alias) ──────────────────────────────

  fastify.get('/fuel', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;

      const logs = await (prisma as any).vehicleTelemetryLog.findMany({
        where: { tenantId, type: 'fuel' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, vehicleId: true, data: true, createdAt: true },
      });

      const transactions = logs.map((log: any) => ({
        id: log.id,
        vehicleId: log.vehicleId,
        date: log.createdAt,
        ...(log.data as object),
      }));

      return {
        data: transactions,
        meta: {
          page: 1,
          limit: transactions.length,
          total: transactions.length,
          totalPages: 1,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      throw error;
    }
  });

  // ── GET FUEL CARDS ───────────────────────────────────────────

  fastify.get('/fuel-cards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      // Fuel card data is not yet in the schema — return empty with pagination
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      throw error;
    }
  });

  // ── GET FLEET ACTIVITY FEED ──────────────────────────────────

  fastify.get('/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantId as string;
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const logs = await (prisma as any).vehicleTelemetryLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, vehicleId: true, type: true, data: true, createdAt: true },
      });

      const total = await (prisma as any).vehicleTelemetryLog.count({ where: { tenantId } });

      const activity = logs.map((log: any) => ({
        id: log.id,
        type: log.type,
        vehicleId: log.vehicleId,
        timestamp: log.createdAt,
        data: log.data,
      }));

      return {
        data: activity,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors[0]?.message ?? 'Validation failed', error.errors);
      throw error;
    }
  });

  // ── GET SINGLE VEHICLE (after static single-segment routes) ──

  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tenantId = (request as any).tenantId as string;

    try {
      const vehicle = await (prisma as any).fleetVehicle.findFirst({
        where: { id, tenantId },
      });

      if (!vehicle) {
        throw new NotFoundError(`Vehicle ${id} not found`);
      }

      return { data: vehicle };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw error;
    }
  });
}

export default fleetRoutes;
