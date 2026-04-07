/**
 * Fleet Service Unit Tests
 *
 * Comprehensive test suite for fleet management operations:
 * - Vehicle registration and lifecycle
 * - Fleet overview and health metrics
 * - Vehicle status and diagnostics
 * - Driver behavior tracking
 * - Maintenance alerts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FleetService } from '../fleet-service.js';
import type {
  RegisterVehicleRequest,
  UpdateVehicleRequest,
  ITelematicsAdapter,
  VehicleRegistration,
  Vehicle,
  VehiclePosition,
} from '../fleet-types.js';

// ─── MOCKS ──────────────────────────────────────────────────────

const mockPrisma = {
  vehicle: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  vehicleDiagnostic: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  driverBehaviorEvent: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  fuelConsumption: {
    create: vi.fn(),
  },
  maintenanceAlert: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  fleetEvent: {
    findMany: vi.fn(),
  },
  fleetHealthMetric: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

const mockAdapter: ITelematicsAdapter = {
  providerName: 'SAMSARA',
  apiVersion: 'v1',
  registerVehicle: vi.fn(),
  deregisterVehicle: vi.fn(),
  getVehiclePosition: vi.fn(),
  getVehicleStatus: vi.fn(),
  getVehicleFuel: vi.fn(),
  getVehicleDiagnostics: vi.fn(),
  getFleetVehicles: vi.fn(),
  subscribeToEvents: vi.fn(),
  unsubscribeFromEvents: vi.fn(),
  getDriverBehavior: vi.fn(),
  getLastSyncTime: vi.fn(),
  setLastSyncTime: vi.fn(),
};

// ─── SETUP ──────────────────────────────────────────────────────

describe('FleetService', () => {
  let fleetService: FleetService;
  const fleetId = 'fleet-123';
  const adapters = new Map([['SAMSARA', mockAdapter]]);

  beforeEach(() => {
    vi.clearAllMocks();
    fleetService = new FleetService(fleetId, mockPrisma, adapters);
  });

  // ─── VEHICLE REGISTRATION TESTS ─────────────────────────────

  describe('Vehicle Registration', () => {
    it('should register a new vehicle successfully', async () => {
      const request: RegisterVehicleRequest = {
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB123CD',
        engineType: 'DIESEL',
        capacity: 25000,
        primaryProvider: 'SAMSARA',
      };

      mockAdapter.registerVehicle.mockResolvedValue({
        vehicleId: 'veh-456',
        providerVehicleId: 'samsara-789',
      });

      mockPrisma.vehicle.create.mockResolvedValue({
        id: 'veh-456',
        fleetId,
        make: request.make,
        model: request.model,
        year: request.year,
        vin: request.vin,
        licensePlate: request.licensePlate,
        engineType: request.engineType,
        capacity: request.capacity,
        primaryProvider: 'SAMSARA',
        providerVehicleId: 'samsara-789',
        status: 'OFFLINE',
        odometer: 0,
        engineHours: 0,
        fuelLevel: 0,
        battery: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vehicle = await fleetService.registerVehicle(request);

      expect(vehicle).toBeDefined();
      expect(vehicle.id).toBe('veh-456');
      expect(vehicle.vin).toBe(request.vin);
      expect(vehicle.primaryProvider).toBe('SAMSARA');
      expect(mockAdapter.registerVehicle).toHaveBeenCalledWith(
        expect.objectContaining(request),
      );
    });

    it('should throw error when adapter not available', async () => {
      const request: RegisterVehicleRequest = {
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB123CD',
        engineType: 'DIESEL',
        capacity: 25000,
        primaryProvider: 'GEOTAB',
      };

      await expect(fleetService.registerVehicle(request)).rejects.toThrow(
        'Telematics adapter not available',
      );
    });

    it('should assign driver to vehicle during registration', async () => {
      const request: RegisterVehicleRequest = {
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB123CD',
        engineType: 'DIESEL',
        capacity: 25000,
        primaryProvider: 'SAMSARA',
        driverId: 'driver-101',
      };

      mockAdapter.registerVehicle.mockResolvedValue({
        vehicleId: 'veh-456',
        providerVehicleId: 'samsara-789',
      });

      mockPrisma.vehicle.create.mockResolvedValue({
        id: 'veh-456',
        fleetId,
        driverId: 'driver-101',
        ...request,
        providerVehicleId: 'samsara-789',
        status: 'OFFLINE',
        odometer: 0,
        engineHours: 0,
        fuelLevel: 0,
        battery: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vehicle = await fleetService.registerVehicle(request);

      expect(vehicle.driverId).toBe('driver-101');
      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ driverId: 'driver-101' }) }),
      );
    });
  });

  // ─── VEHICLE RETRIEVAL TESTS ────────────────────────────────

  describe('Vehicle Retrieval', () => {
    it('should get a specific vehicle by ID', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        fleetId,
        make: 'Volvo',
        model: 'FH16',
        year: 2023,
        vin: 'YV1TS56D982F8032',
        licensePlate: 'AB123CD',
        engineType: 'DIESEL',
        capacity: 25000,
        primaryProvider: 'SAMSARA',
        status: 'ACTIVE',
        odometer: 5000,
        engineHours: 200,
        fuelLevel: 75,
        battery: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vehicle = await fleetService.getVehicle(vehicleId);

      expect(vehicle).toBeDefined();
      expect(vehicle?.id).toBe(vehicleId);
      expect(vehicle?.make).toBe('Volvo');
    });

    it('should return null when vehicle not found', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(null);

      const vehicle = await fleetService.getVehicle('nonexistent');

      expect(vehicle).toBeNull();
    });

    it('should list fleet vehicles with pagination', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'veh-1',
          fleetId,
          make: 'Volvo',
          model: 'FH16',
          status: 'ACTIVE',
          licenseplate: 'AB001',
          createdAt: new Date(),
        },
        {
          id: 'veh-2',
          fleetId,
          make: 'Scania',
          model: 'G490',
          status: 'IDLE',
          licensePlate: 'AB002',
          createdAt: new Date(),
        },
      ]);

      mockPrisma.vehicle.count.mockResolvedValue(2);

      const result = await fleetService.getFleetVehicles({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter vehicles by status', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'veh-1',
          status: 'ACTIVE',
          fleetId,
          make: 'Volvo',
          model: 'FH16',
          createdAt: new Date(),
        },
      ]);

      mockPrisma.vehicle.count.mockResolvedValue(1);

      const result = await fleetService.getFleetVehicles({ status: 'ACTIVE', page: 1, limit: 10 });

      expect(result.data[0].status).toBe('ACTIVE');
      expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should search vehicles by make, model, or license plate', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([]);
      mockPrisma.vehicle.count.mockResolvedValue(0);

      await fleetService.getFleetVehicles({ search: 'Volvo', page: 1, limit: 10 });

      expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  // ─── VEHICLE UPDATE TESTS ───────────────────────────────────

  describe('Vehicle Update', () => {
    it('should update vehicle information', async () => {
      const vehicleId = 'veh-456';
      const updateRequest: UpdateVehicleRequest = {
        driverId: 'driver-202',
        capacity: 30000,
      };

      mockPrisma.vehicle.update.mockResolvedValue({
        id: vehicleId,
        fleetId,
        driverId: 'driver-202',
        capacity: 30000,
        make: 'Volvo',
        model: 'FH16',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const vehicle = await fleetService.updateVehicle(vehicleId, updateRequest);

      expect(vehicle.driverId).toBe('driver-202');
      expect(vehicle.capacity).toBe(30000);
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: vehicleId },
          data: expect.objectContaining({ driverId: 'driver-202', capacity: 30000 }),
        }),
      );
    });

    it('should deactivate vehicle', async () => {
      const vehicleId = 'veh-456';

      mockPrisma.vehicle.findUnique.mockResolvedValue({ id: vehicleId, primaryProvider: 'SAMSARA' });
      mockPrisma.vehicle.update.mockResolvedValue({ id: vehicleId, isActive: false });

      await fleetService.deregisterVehicle(vehicleId);

      expect(mockAdapter.deregisterVehicle).toHaveBeenCalledWith(vehicleId);
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });
  });

  // ─── FLEET OVERVIEW TESTS ───────────────────────────────────

  describe('Fleet Overview', () => {
    it('should get fleet overview with health metrics', async () => {
      mockPrisma.vehicle.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: { id: 20 } },
        { status: 'IDLE', _count: { id: 5 } },
        { status: 'OFFLINE', _count: { id: 3 } },
      ]);

      mockPrisma.fleetEvent.findMany.mockResolvedValue([]);
      mockPrisma.fleetHealthMetric.findFirst.mockResolvedValue(null);

      const overview = await fleetService.getFleetOverview();

      expect(overview.fleetId).toBe(fleetId);
      expect(overview.totalVehicles).toBe(28);
      expect(overview.activeVehicles).toBe(20);
      expect(overview.healthScore).toBeDefined();
      expect(overview.healthScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(overview.healthScore.overallScore).toBeLessThanOrEqual(100);
    });

    it('should include critical alerts in overview', async () => {
      mockPrisma.vehicle.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { id: 10 } }]);

      const criticalAlert = {
        id: 'alert-1',
        fleetId,
        vehicleId: 'veh-1',
        eventType: 'FAULT_CODE_DETECTED',
        severity: 'CRITICAL',
        acknowledged: false,
        timestamp: new Date(),
        data: JSON.stringify({ description: 'Engine malfunction' }),
      };

      mockPrisma.fleetEvent.findMany.mockResolvedValue([criticalAlert]);
      mockPrisma.fleetHealthMetric.findFirst.mockResolvedValue(null);

      const overview = await fleetService.getFleetOverview();

      expect(overview.topAlerts).toHaveLength(1);
      expect(overview.topAlerts[0].severity).toBe('CRITICAL');
    });
  });

  // ─── VEHICLE STATUS TESTS ───────────────────────────────────

  describe('Vehicle Status', () => {
    it('should get vehicle status from provider', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        primaryProvider: 'SAMSARA',
      });

      const mockStatus = {
        vehicleId,
        status: 'ACTIVE' as const,
        engineRunning: true,
        battery: 95,
        odometer: 5000,
        hours: 200,
        faultCodes: [],
        lastPosition: {
          vehicleId,
          latitude: 37.7749,
          longitude: -122.4194,
          heading: 180,
          speed: 60,
          accuracy: 5,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      mockAdapter.getVehicleStatus.mockResolvedValue(mockStatus);
      mockPrisma.vehicle.update.mockResolvedValue({ id: vehicleId });

      const status = await fleetService.getVehicleStatus(vehicleId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('ACTIVE');
      expect(status?.engineRunning).toBe(true);
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: vehicleId },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should return null when vehicle not found', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(null);

      const status = await fleetService.getVehicleStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  // ─── DIAGNOSTICS TESTS ──────────────────────────────────────

  describe('Vehicle Diagnostics', () => {
    it('should get and store vehicle diagnostics', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        primaryProvider: 'SAMSARA',
      });

      const mockDiagnostics = {
        vehicleId,
        faultCodes: [
          { code: 'P0101', description: 'Mass Air Flow Sensor', system: 'ENGINE', severity: 'WARNING' as const },
        ],
        severity: 'WARNING' as const,
        description: 'Engine diagnostic issue',
        affectedSystems: ['ENGINE'],
        recommendedAction: 'Check air intake',
        firstSeenAt: new Date(),
      };

      mockAdapter.getVehicleDiagnostics.mockResolvedValue(mockDiagnostics);
      mockPrisma.vehicleDiagnostic.findMany.mockResolvedValue([]);

      const diagnostics = await fleetService.getVehicleDiagnostics(vehicleId);

      expect(diagnostics).toBeDefined();
      expect(diagnostics?.faultCodes).toHaveLength(1);
      expect(mockPrisma.vehicleDiagnostic.createMany).toHaveBeenCalled();
    });
  });

  // ─── FUEL TESTS ─────────────────────────────────────────────

  describe('Vehicle Fuel', () => {
    it('should get and record fuel information', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        primaryProvider: 'SAMSARA',
      });

      const mockFuel = {
        vehicleId,
        fuelLevel: 75,
        fuelVolume: 300,
        fuelType: 'DIESEL' as const,
        fuelEconomy: 7.5,
        range: 2000,
        timestamp: new Date(),
      };

      mockAdapter.getVehicleFuel.mockResolvedValue(mockFuel);
      mockPrisma.fuelConsumption.create.mockResolvedValue({});
      mockPrisma.vehicle.update.mockResolvedValue({});

      const fuel = await fleetService.getVehicleFuel(vehicleId);

      expect(fuel?.fuelLevel).toBe(75);
      expect(mockPrisma.fuelConsumption.create).toHaveBeenCalled();
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fuelLevel: 75 },
        }),
      );
    });
  });

  // ─── DRIVER BEHAVIOR TESTS ──────────────────────────────────

  describe('Driver Behavior', () => {
    it('should get and store driver behavior events', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        primaryProvider: 'SAMSARA',
      });

      const dateRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const mockBehaviors = [
        {
          id: 'beh-1',
          vehicleId,
          eventType: 'SPEEDING' as const,
          severity: 3,
          location: { latitude: 37.7749, longitude: -122.4194 },
          speed: 85,
          description: 'Speed 85 km/h in 50 zone',
          timestamp: new Date(),
          createdAt: new Date(),
        },
      ];

      mockAdapter.getDriverBehavior.mockResolvedValue(mockBehaviors);
      mockPrisma.driverBehaviorEvent.createMany.mockResolvedValue({ count: 1 });

      const behaviors = await fleetService.getDriverBehavior(vehicleId, dateRange);

      expect(behaviors).toHaveLength(1);
      expect(behaviors[0].eventType).toBe('SPEEDING');
      expect(mockPrisma.driverBehaviorEvent.createMany).toHaveBeenCalled();
    });

    it('should calculate driver risk score', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.driverBehaviorEvent.findMany.mockResolvedValue([
        { eventType: 'SPEEDING', severity: 2 },
        { eventType: 'HARSH_BRAKE', severity: 3 },
        { eventType: 'SPEEDING', severity: 2 },
      ]);

      const riskScore = await fleetService.getDriverRiskScore(vehicleId);

      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it('should return 0 risk score when no events', async () => {
      mockPrisma.driverBehaviorEvent.findMany.mockResolvedValue([]);

      const riskScore = await fleetService.getDriverRiskScore('veh-456');

      expect(riskScore).toBe(0);
    });
  });

  // ─── FLEET HEALTH TESTS ─────────────────────────────────────

  describe('Fleet Health', () => {
    it('should calculate fleet health score', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'veh-1',
          status: 'ACTIVE',
          behaviors: [],
          diagnostics: [],
          maintenanceAlerts: [],
          fuelHistory: [{ fuelEconomy: 8 }],
        },
        {
          id: 'veh-2',
          status: 'IDLE',
          behaviors: [],
          diagnostics: [],
          maintenanceAlerts: [],
          fuelHistory: [{ fuelEconomy: 7 }],
        },
      ]);

      mockPrisma.fleetHealthMetric.create.mockResolvedValue({});

      const healthScore = await fleetService.calculateFleetHealth();

      expect(healthScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(healthScore.overallScore).toBeLessThanOrEqual(100);
      expect(healthScore.fuelEfficiency).toBeGreaterThanOrEqual(0);
      expect(healthScore.driverSafety).toBeGreaterThanOrEqual(0);
      expect(healthScore.maintenanceStatus).toBeGreaterThanOrEqual(0);
    });

    it('should have perfect health when no vehicles', async () => {
      mockPrisma.vehicle.findMany.mockResolvedValue([]);

      const healthScore = await fleetService.calculateFleetHealth();

      expect(healthScore.overallScore).toBe(100);
    });
  });

  // ─── MAINTENANCE TESTS ──────────────────────────────────────

  describe('Maintenance Alerts', () => {
    it('should get vehicle maintenance alerts', async () => {
      const vehicleId = 'veh-456';
      mockPrisma.maintenanceAlert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          vehicleId,
          alertType: 'OIL_CHANGE',
          dueDate: new Date(),
          severity: 'WARNING',
        },
      ]);

      const alerts = await fleetService.getVehicleMaintenanceAlerts(vehicleId);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('OIL_CHANGE');
    });

    it('should create maintenance alert', async () => {
      const vehicleId = 'veh-456';
      const dueDate = new Date();

      mockPrisma.maintenanceAlert.create.mockResolvedValue({
        id: 'alert-1',
        vehicleId,
        alertType: 'TIRE_ROTATION',
        dueDate,
      });

      const alert = await fleetService.createMaintenanceAlert(vehicleId, 'TIRE_ROTATION', dueDate);

      expect(alert.alertType).toBe('TIRE_ROTATION');
      expect(mockPrisma.maintenanceAlert.create).toHaveBeenCalled();
    });

    it('should complete maintenance alert', async () => {
      const alertId = 'alert-1';
      mockPrisma.maintenanceAlert.update.mockResolvedValue({
        id: alertId,
        isCompleted: true,
        completedAt: new Date(),
      });

      const alert = await fleetService.completeMaintenanceAlert(alertId);

      expect(alert.isCompleted).toBe(true);
      expect(mockPrisma.maintenanceAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isCompleted: true }),
        }),
      );
    });
  });
});
