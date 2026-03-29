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
import { NotFoundError, ValidationError } from '../../lib/errors.js';

// ─── VALIDATION SCHEMAS ──────────────────────────────────────────

const registerVehicleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  vin: z.string().length(17),
  licensePlate: z.string().min(1).max(20),
  engineType: z.enum(['GASOLINE', 'DIESEL', 'EV', 'HYBRID']),
  capacity: z.number().positive(),
  primaryProvider: z.enum(['SAMSARA', 'GEOTAB', 'VERIZON', 'MOTIVE']),
  driverId: z.string().optional(),
});

const updateVehicleSchema = z.object({
  driverId: z.string().optional(),
  primaryProvider: z.enum(['SAMSARA', 'GEOTAB', 'VERIZON', 'MOTIVE']).optional(),
  capacity: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  nextMaintenanceDate: z.string().datetime().optional(),
});

const vehicleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['ACTIVE', 'IDLE', 'OFFLINE', 'MAINTENANCE']).optional(),
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

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function fleetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── GET FLEET OVERVIEW ─────────────────────────────────────

  fastify.get('/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // INTEGRATION: Instantiate FleetService with provider adapters
      // const fleetService = await createFleetService(request.shopId, adapters);
      // const overview = await fleetService.getFleetOverview();

      const mockOverview = {
        fleetId: request.shopId,
        totalVehicles: 28,
        activeVehicles: 20,
        idleVehicles: 5,
        offlineVehicles: 2,
        maintenanceVehicles: 1,
        healthScore: {
          overallScore: 82,
          fuelEfficiency: 78,
          driverSafety: 85,
          maintenanceStatus: 81,
          utilizationRate: 71,
          trend: 'IMPROVING',
          lastUpdated: new Date(),
        },
        topAlerts: [
          {
            id: 'alert-1',
            vehicleId: 'veh-1',
            title: 'FAULT_CODE_DETECTED',
            description: 'Engine malfunction indicator active',
            severity: 'CRITICAL',
            category: 'MAINTENANCE',
            timestamp: new Date(),
            resolved: false,
          },
        ],
        recentEvents: [],
        averageFuelEconomy: 7.8,
        totalIdleHours: 240,
        criticalAlertCount: 1,
      };

      return { data: mockOverview };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch fleet overview: ${errorMessage}`);
    }
  });

  // ── LIST VEHICLES ──────────────────────────────────────────

  const listFleetVehicles = async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.parse(request.query);
      const { page, limit, status, search, provider, isActive } = query;

      // INTEGRATION: Fetch from FleetService
      // const fleetService = await createFleetService(request.shopId, adapters);
      // const result = await fleetService.getFleetVehicles({
      //   page,
      //   limit,
      //   status: status as any,
      //   search,
      //   provider,
      //   isActive: isActive === 'true',
      // });

      const mockVehicles = [
        {
          id: 'veh-1',
          fleetId: request.shopId,
          make: 'Volvo',
          model: 'FH16',
          year: 2023,
          vin: 'YV1TS56D982F8032',
          licensePlate: 'AB001',
          engineType: 'DIESEL',
          status: 'ACTIVE',
          odometer: 5000,
          engineHours: 200,
          fuelLevel: 75,
          capacity: 25000,
          isActive: true,
          lastSyncAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'veh-2',
          fleetId: request.shopId,
          make: 'Scania',
          model: 'G490',
          year: 2022,
          vin: 'XSC1234567890ABCD',
          licensePlate: 'AB002',
          engineType: 'DIESEL',
          status: 'IDLE',
          odometer: 12000,
          engineHours: 450,
          fuelLevel: 45,
          capacity: 25000,
          isActive: true,
          lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      return {
        data: mockVehicles,
        meta: {
          page,
          limit,
          total: mockVehicles.length,
          totalPages: 1,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors);
      }
      throw error;
    }
  };

  fastify.get('/', listFleetVehicles);
  fastify.get('/vehicles', listFleetVehicles);

  // ── GET FLEET HEALTH SCORE (before /:id so "health" is not captured as id) ──

  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const mockHealthScore = {
        overallScore: 82,
        fuelEfficiency: 78,
        driverSafety: 85,
        maintenanceStatus: 81,
        utilizationRate: 71,
        trend: 'IMPROVING',
        lastUpdated: new Date(),
      };

      return { data: mockHealthScore };
    } catch (error) {
      throw error;
    }
  });

  // ── REGISTER VEHICLE ───────────────────────────────────────

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole('SUPER_ADMIN', 'ADMIN')(request, reply);

    try {
      const body = registerVehicleSchema.parse(request.body);

      // INTEGRATION: Register via FleetService
      // const fleetService = await createFleetService(request.shopId, adapters);
      // const vehicle = await fleetService.registerVehicle(body);

      const mockVehicle = {
        id: `veh-${Date.now()}`,
        fleetId: request.shopId,
        ...body,
        status: 'OFFLINE',
        odometer: 0,
        engineHours: 0,
        fuelLevel: 0,
        battery: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      reply.status(201);
      return { data: mockVehicle };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors);
      }
      throw error;
    }
  });

  // ── UPDATE VEHICLE ────────────────────────────────────────

  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const body = updateVehicleSchema.parse(request.body);

      // INTEGRATION: Update via FleetService
      // const fleetService = await createFleetService(request.shopId, adapters);
      // const vehicle = await fleetService.updateVehicle(id, body);

      const mockVehicle = {
        id,
        fleetId: request.shopId,
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB001',
        engineType: 'DIESEL',
        status: 'ACTIVE',
        ...body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { data: mockVehicle };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors);
      }
      throw error;
    }
  });

  // ── GET VEHICLE DIAGNOSTICS ───────────────────────────────

  fastify.get('/:id/diagnostics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      // INTEGRATION: Fetch from FleetService
      // const fleetService = await createFleetService(request.shopId, adapters);
      // const diagnostics = await fleetService.getVehicleDiagnostics(id);

      const mockDiagnostics = {
        vehicleId: id,
        faultCodes: [
          {
            code: 'P0101',
            description: 'Mass Air Flow Sensor Range/Performance',
            system: 'ENGINE',
            severity: 'WARNING',
          },
        ],
        severity: 'WARNING',
        description: 'Engine diagnostic issues detected',
        affectedSystems: ['ENGINE'],
        recommendedAction: 'Check air intake and MAF sensor',
        firstSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      };

      return { data: mockDiagnostics };
    } catch (error) {
      throw error;
    }
  });

  // ── GET DRIVER BEHAVIOR ────────────────────────────────────

  fastify.get(
    '/:id/behavior',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const query = dateRangeSchema.parse(request.query);

      try {
        // INTEGRATION: Fetch from FleetService
        // const fleetService = await createFleetService(request.shopId, adapters);
        // const behaviors = await fleetService.getDriverBehavior(id, {
        //   start: new Date(query.startDate),
        //   end: new Date(query.endDate),
        // });

        const mockBehaviors = [
          {
            id: 'beh-1',
            vehicleId: id,
            driverId: 'driver-101',
            eventType: 'SPEEDING',
            severity: 2,
            location: { latitude: 37.7749, longitude: -122.4194 },
            speed: 85,
            description: 'Speed 85 km/h in 50 km/h zone',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            createdAt: new Date(),
          },
          {
            id: 'beh-2',
            vehicleId: id,
            driverId: 'driver-101',
            eventType: 'HARSH_BRAKE',
            severity: 3,
            location: { latitude: 37.7749, longitude: -122.4194 },
            speed: 60,
            description: 'Harsh braking detected',
            durationMs: 850,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            createdAt: new Date(),
          },
        ];

        return { data: mockBehaviors };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(error.errors);
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

      try {
        // INTEGRATION: Fetch from FleetService
        // const fleetService = await createFleetService(request.shopId, adapters);
        // const alerts = await fleetService.getVehicleMaintenanceAlerts(id);

        const mockAlerts = [
          {
            id: 'maint-1',
            vehicleId: id,
            alertType: 'OIL_CHANGE',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            severity: 'WARNING',
            estimatedCost: 150,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'maint-2',
            vehicleId: id,
            alertType: 'TIRE_INSPECTION',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            severity: 'INFO',
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        return { data: mockAlerts };
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

        // INTEGRATION: Update event in database
        // const fleetService = await createFleetService(request.shopId, adapters);
        // const event = await acknowledgeFleetEvent(body.eventId, request.user.id);

        return {
          data: {
            eventId: body.eventId,
            acknowledged: true,
            acknowledgedAt: new Date(),
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(error.errors);
        }
        throw error;
      }
    },
  );

  // ── GET FLEET-WIDE MAINTENANCE EVENTS ──────────────────────

  fastify.get('/maintenance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const mockMaintenance = [
        { id: 'mnt-1', vehicleId: 'veh-1', vehiclePlate: 'AB001', vehicleName: 'Volvo FH16 (AB001)', type: 'oil-change', scheduledDate: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'overdue', estimatedCost: 250, actualCost: null, vendor: 'Fleet Auto Service', notes: 'Overdue by 5 days' },
        { id: 'mnt-2', vehicleId: 'veh-2', vehiclePlate: 'AB002', vehicleName: 'Scania G490 (AB002)', type: 'tire-rotation', scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'scheduled', estimatedCost: 180, actualCost: null, vendor: 'Tire Pro', notes: '' },
        { id: 'mnt-3', vehicleId: 'veh-1', vehiclePlate: 'AB001', vehicleName: 'Volvo FH16 (AB001)', type: 'inspection', scheduledDate: new Date(Date.now() - 30 * 86400000).toISOString(), status: 'completed', estimatedCost: 120, actualCost: 115, vendor: 'City Inspection', notes: 'Passed annual inspection' },
        { id: 'mnt-4', vehicleId: 'veh-2', vehiclePlate: 'AB002', vehicleName: 'Scania G490 (AB002)', type: 'oil-change', scheduledDate: new Date(Date.now() + 14 * 86400000).toISOString(), status: 'scheduled', estimatedCost: 250, actualCost: null, vendor: 'Fleet Auto Service', notes: '' },
        { id: 'mnt-5', vehicleId: 'veh-1', vehiclePlate: 'AB001', vehicleName: 'Volvo FH16 (AB001)', type: 'repair', scheduledDate: new Date(Date.now() - 1 * 86400000).toISOString(), status: 'in-progress', estimatedCost: 800, actualCost: null, vendor: 'Fleet Auto Service', notes: 'Brake pad replacement' },
      ];

      const paginated = mockMaintenance.slice((page - 1) * limit, page * limit);
      return {
        data: paginated,
        meta: { page, limit, total: mockMaintenance.length, totalPages: Math.ceil(mockMaintenance.length / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors);
      throw error;
    }
  });

  // ── GET FUEL TRANSACTIONS ────────────────────────────────────

  fastify.get('/fuel-transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const stations = ['Shell', 'Chevron', 'BP', 'ExxonMobil'];
      const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
        id: `fuel-${i + 1}`,
        vehicleId: i % 2 === 0 ? 'veh-1' : 'veh-2',
        vehiclePlate: i % 2 === 0 ? 'AB001' : 'AB002',
        driverId: `drv-${(i % 4) + 1}`,
        driverName: ['Carlos Martinez', 'Sofia Lindberg', 'Ahmed Khalil', 'Jessica Chen'][i % 4],
        date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
        station: stations[i % stations.length],
        gallons: parseFloat((40 + Math.sin(i) * 15).toFixed(1)),
        amount: parseFloat((150 + i * 12).toFixed(2)),
        price: parseFloat((3.45 + Math.sin(i) * 0.3).toFixed(3)),
        mpg: parseFloat((12 + Math.sin(i) * 3).toFixed(1)),
        flagged: i % 9 === 0,
      }));

      const paginated = mockTransactions.slice((page - 1) * limit, page * limit);
      return {
        data: paginated,
        meta: { page, limit, total: mockTransactions.length, totalPages: Math.ceil(mockTransactions.length / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors);
      throw error;
    }
  });

  // ── GET FUEL (dashboard alias; same mock data shape as fuel page) ──

  fastify.get('/fuel', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const stations = ['Shell', 'Chevron', 'BP', 'ExxonMobil'];
      const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
        id: `fuel-${i + 1}`,
        vehicleId: i % 2 === 0 ? 'veh-1' : 'veh-2',
        date: new Date(Date.now() - i * 2 * 86400000).toISOString(),
        station: stations[i % stations.length],
        gallons: parseFloat((40 + Math.sin(i) * 15).toFixed(1)),
        amount: parseFloat((150 + i * 12).toFixed(2)),
        price: parseFloat((3.45 + Math.sin(i) * 0.3).toFixed(3)),
        mpg: parseFloat((12 + Math.sin(i) * 3).toFixed(1)),
        flagged: i % 9 === 0,
      }));

      return {
        data: mockTransactions,
        meta: {
          page: 1,
          limit: mockTransactions.length,
          total: mockTransactions.length,
          totalPages: 1,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors);
      throw error;
    }
  });

  // ── GET FUEL CARDS ───────────────────────────────────────────

  fastify.get('/fuel-cards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const mockCards = [
        { id: 'card-1', cardNumber: '****-****-****-1234', provider: 'FleetCard', status: 'active', dailyLimit: 500, monthlyLimit: 5000, assignedVehicles: ['veh-1'], expiryDate: '2026-12-31' },
        { id: 'card-2', cardNumber: '****-****-****-5678', provider: 'WEX', status: 'active', dailyLimit: 300, monthlyLimit: 3000, assignedVehicles: ['veh-2'], expiryDate: '2027-06-30' },
        { id: 'card-3', cardNumber: '****-****-****-9012', provider: 'FleetCard', status: 'blocked', dailyLimit: 400, monthlyLimit: 4000, assignedVehicles: [], expiryDate: '2026-09-30' },
      ];

      const paginated = mockCards.slice((page - 1) * limit, page * limit);
      return {
        data: paginated,
        meta: { page, limit, total: mockCards.length, totalPages: Math.ceil(mockCards.length / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors);
      throw error;
    }
  });

  // ── GET FLEET ACTIVITY FEED ──────────────────────────────────

  fastify.get('/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = vehicleListQuerySchema.pick({ page: true, limit: true }).parse(request.query);
      const { page, limit } = query;

      const mockActivity = [
        { id: 'act-1', type: 'maintenance', vehicleId: 'veh-1', title: 'Oil change completed', description: 'Routine oil change for AB001', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), icon: '🔧' },
        { id: 'act-2', type: 'fuel', vehicleId: 'veh-2', title: 'Fuel refill', description: 'AB002 refueled at Shell station', timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), icon: '⛽' },
        { id: 'act-3', type: 'assignment', vehicleId: 'veh-1', title: 'Driver assigned', description: 'Carlos Martinez assigned to AB001', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), icon: '👤' },
        { id: 'act-4', type: 'alert', vehicleId: 'veh-2', title: 'Low fuel alert', description: 'AB002 fuel level below 15%', timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), icon: '⚠️' },
      ];

      const paginated = mockActivity.slice((page - 1) * limit, page * limit);
      return {
        data: paginated,
        meta: { page, limit, total: mockActivity.length, totalPages: Math.ceil(mockActivity.length / limit) },
      };
    } catch (error) {
      if (error instanceof z.ZodError) throw new ValidationError(error.errors);
      throw error;
    }
  });

  // ── GET SINGLE VEHICLE (after static single-segment routes) ──

  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const mockVehicle = {
        id,
        fleetId: request.shopId,
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB001',
        engineType: 'DIESEL',
        primaryProvider: 'SAMSARA',
        status: 'ACTIVE',
        odometer: 5000,
        engineHours: 200,
        fuelLevel: 75,
        battery: 95,
        capacity: 25000,
        driverId: 'driver-101',
        isActive: true,
        lastPosition: {
          latitude: 37.7749,
          longitude: -122.4194,
          heading: 180,
          speed: 65,
          accuracy: 5,
          timestamp: new Date(),
        },
        lastSyncAt: new Date(),
        nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { data: mockVehicle };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw error;
    }
  });
}

export default fp(fleetRoutes);
