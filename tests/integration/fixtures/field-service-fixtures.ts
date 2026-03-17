/**
 * Field Service Fixtures - Factory Functions for Test Data
 *
 * Provides:
 * - createMockWorkOrder: Complete work order lifecycle
 * - createMockTechnician: Field technician with skills and certifications
 * - createMockSchedule: Technician availability and assignments
 * - createMockServiceZone: Geographic service territory
 * - createMockParts: Inventory items for work orders
 * - createMockInvoice: Service invoices with labor, parts, travel
 * - createMockDispatch: Dispatch assignments and routing
 * - Batch operations for realistic field service scenarios
 */

import { randomUUID } from 'crypto';
import type {
  JobCreateRequest,
  JobResponse,
} from '../../../packages/core/src/integrations/field-service/field-service-sdk-types.js';

// ─────────────────────────────────────────────────────────────────────────
// WORK ORDER FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockWorkOrder {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  status: 'created' | 'scheduled' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  title: string;
  description: string;
  location: MockJobLocation;
  requiredSkills: string[];
  estimatedDuration: number; // minutes
  actualDuration?: number;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  assignedTechnicianIds: string[];
  parts: MockPart[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockJobLocation {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface MockWorkOrderOptions {
  id?: string;
  customerId?: string;
  priority?: 'low' | 'medium' | 'high' | 'emergency';
  status?: MockWorkOrder['status'];
  requiredSkills?: string[];
  estimatedDuration?: number;
  daysFromNow?: number;
}

export function createMockWorkOrder(options: MockWorkOrderOptions = {}): MockWorkOrder {
  const id = options.id || 'wo_' + randomUUID().split('-')[0];
  const customerId = options.customerId || 'cust_' + randomUUID().split('-')[0];
  const priority = options.priority || 'medium';
  const requiredSkills = options.requiredSkills || ['HVAC', 'Electrical'];
  const estimatedDuration = options.estimatedDuration || 120;
  const daysFromNow = options.daysFromNow || 3;

  const scheduledStart = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  scheduledStart.setHours(9, 0, 0, 0); // 9 AM
  const scheduledEnd = new Date(scheduledStart.getTime() + estimatedDuration * 60 * 1000);

  const status = options.status || 'created';
  const actualStart = status === 'in_progress' || status === 'completed' ? new Date(scheduledStart) : undefined;
  const actualEnd = status === 'completed' ? new Date(actualStart!.getTime() + (options.estimatedDuration || 120) * 60 * 1000) : undefined;

  return {
    id,
    jobNumber: 'JOB' + Math.floor(Math.random() * 100000).toString().padStart(5, '0'),
    customerId,
    customerName: 'ABC Manufacturing LLC',
    status,
    priority,
    title: 'HVAC System Inspection and Maintenance',
    description: 'Quarterly preventive maintenance on rooftop HVAC units',
    location: {
      address: '123 Industrial Blvd',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'USA',
      latitude: 34.0195,
      longitude: -118.2437,
    },
    requiredSkills,
    estimatedDuration,
    actualDuration: status === 'completed' ? estimatedDuration + Math.floor(Math.random() * 30) : undefined,
    scheduledStart,
    scheduledEnd,
    actualStart,
    actualEnd,
    assignedTechnicianIds: status !== 'created' ? ['tech_0'] : [],
    parts: [
      {
        id: 'part_' + randomUUID().split('-')[0],
        name: 'Capacitor 25µF',
        quantity: 2,
        unitPrice: 45.99,
        totalPrice: 91.98,
      },
      {
        id: 'part_' + randomUUID().split('-')[0],
        name: 'Blower Motor Bearing',
        quantity: 1,
        unitPrice: 120.0,
        totalPrice: 120.0,
      },
    ],
    notes: 'Customer requested early morning start. Building access available from 7:00 AM.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createMockWorkOrders(count: number, overrides: Partial<MockWorkOrderOptions> = {}): MockWorkOrder[] {
  return Array.from({ length: count }, (_, i) =>
    createMockWorkOrder({
      id: `wo_${i}`,
      customerId: `cust_${i % 3}`,
      priority: ['low', 'medium', 'high', 'emergency'][i % 4] as any,
      daysFromNow: i,
      ...overrides,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TECHNICIAN FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockTechnician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'available' | 'unavailable' | 'on_job' | 'off_duty';
  skills: string[];
  certifications: MockCertification[];
  serviceZoneIds: string[];
  workingHours: {
    startTime: string; // HH:mm format
    endTime: string;
    daysOfWeek: number[]; // 0-6 (Sun-Sat)
  };
  currentLocation?: { latitude: number; longitude: number };
  rating: number; // 0-5
  totalJobs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCertification {
  name: string;
  issuer: string;
  expiryDate: Date;
  licenseNumber?: string;
}

interface MockTechnicianOptions {
  id?: string;
  firstName?: string;
  lastName?: string;
  skills?: string[];
  status?: MockTechnician['status'];
}

export function createMockTechnician(options: MockTechnicianOptions = {}): MockTechnician {
  const id = options.id || 'tech_' + randomUUID().split('-')[0];
  const firstName = options.firstName || 'John';
  const lastName = options.lastName || 'Smith';
  const skills = options.skills || ['HVAC', 'Electrical', 'Plumbing'];

  return {
    id,
    firstName,
    lastName,
    email: firstName + '.' + lastName + '@witylogix.com',
    phone: '555' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0'),
    status: options.status || 'available',
    skills,
    certifications: [
      {
        name: 'EPA Refrigerant Certification',
        issuer: 'EPA',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        licenseNumber: 'EPA' + randomUUID().substring(0, 8).toUpperCase(),
      },
      {
        name: 'HVAC Specialist License',
        issuer: 'California HVAC Board',
        expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
        licenseNumber: 'HVAC' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      },
    ],
    serviceZoneIds: ['zone_la', 'zone_oc'],
    workingHours: {
      startTime: '08:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    },
    currentLocation: {
      latitude: 34.0522,
      longitude: -118.2437,
    },
    rating: 4.7,
    totalJobs: 245,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createMockTechnicians(count: number, overrides: Partial<MockTechnicianOptions> = {}): MockTechnician[] {
  const firstNames = ['John', 'Maria', 'Robert', 'Sarah', 'Michael'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];

  return Array.from({ length: count }, (_, i) =>
    createMockTechnician({
      id: `tech_${i}`,
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      ...overrides,
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SERVICE ZONE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockServiceZone {
  id: string;
  name: string;
  description: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMiles: number;
  isActive: boolean;
  createdAt: Date;
}

export function createMockServiceZone(overrides: Partial<MockServiceZone> = {}): MockServiceZone {
  return {
    id: 'zone_' + randomUUID().split('-')[0],
    name: 'Los Angeles Metro',
    description: 'Greater Los Angeles metropolitan area',
    centerLatitude: 34.0522,
    centerLongitude: -118.2437,
    radiusMiles: 25,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PARTS FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockPart {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export function createMockPart(overrides: Partial<MockPart> = {}): MockPart {
  const unitPrice = overrides.unitPrice || 85.5;
  const quantity = overrides.quantity || 1;

  return {
    id: 'part_' + randomUUID().split('-')[0],
    name: 'HVAC Capacitor',
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// INVOICE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockInvoice {
  id: string;
  invoiceNumber: string;
  workOrderId: string;
  customerId: string;
  technicianId: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue';
  issuedDate: Date;
  dueDate: Date;
  laborCost: number;
  laborHours: number;
  partsCost: number;
  travelCost: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  notes?: string;
  paidDate?: Date;
  createdAt: Date;
}

interface MockInvoiceOptions {
  workOrderId?: string;
  laborHours?: number;
  taxRate?: number;
}

export function createMockInvoice(options: MockInvoiceOptions = {}): MockInvoice {
  const workOrderId = options.workOrderId || 'wo_0';
  const laborHours = options.laborHours || 2.5;
  const laborRate = 85; // per hour
  const laborCost = laborHours * laborRate;
  const partsCost = 215.98;
  const travelCost = 45.0;
  const subtotal = laborCost + partsCost + travelCost;
  const taxRate = options.taxRate || 0.1025; // 10.25% California sales tax
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  const issuedDate = new Date();
  const dueDate = new Date(issuedDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    id: 'inv_' + randomUUID().split('-')[0],
    invoiceNumber: 'INV' + Math.floor(Math.random() * 100000).toString().padStart(6, '0'),
    workOrderId,
    customerId: 'cust_0',
    technicianId: 'tech_0',
    status: 'sent',
    issuedDate,
    dueDate,
    laborCost,
    laborHours,
    partsCost,
    travelCost,
    subtotal,
    taxAmount,
    total,
    taxRate,
    notes: 'Payment due within 30 days. Thank you for your business!',
    createdAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// DISPATCH FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockDispatchAssignment {
  id: string;
  workOrderId: string;
  technicianId: string;
  sequenceNumber: number;
  assignedAt: Date;
  eta?: Date;
  actualArrival?: Date;
  actualDeparture?: Date;
  reason?: string;
  status: 'pending' | 'accepted' | 'arrived' | 'started' | 'completed' | 'failed';
}

export function createMockDispatchAssignment(
  workOrderId: string = 'wo_0',
  technicianId: string = 'tech_0'
): MockDispatchAssignment {
  const assignedAt = new Date();
  const eta = new Date(assignedAt.getTime() + 30 * 60 * 1000); // 30 min ETA

  return {
    id: 'disp_' + randomUUID().split('-')[0],
    workOrderId,
    technicianId,
    sequenceNumber: 1,
    assignedAt,
    eta,
    status: 'pending',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SCHEDULE FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export interface MockTechnicianSchedule {
  technicianId: string;
  date: Date;
  workOrders: string[]; // work order IDs
  availableHours: number;
  bookedHours: number;
}

export function createMockTechnicianSchedule(
  technicianId: string = 'tech_0',
  daysFromNow: number = 0
): MockTechnicianSchedule {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);

  return {
    technicianId,
    date,
    workOrders: ['wo_0', 'wo_1'],
    availableHours: 8,
    bookedHours: 5.5,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// BATCH FACTORIES FOR REALISTIC SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

export interface FieldServiceScenarioFixtures {
  workOrders: MockWorkOrder[];
  technicians: MockTechnician[];
  serviceZones: MockServiceZone[];
  dispatchAssignments: MockDispatchAssignment[];
  invoices: MockInvoice[];
}

export function createFieldServiceScenario(
  workOrderCount: number = 5,
  technicianCount: number = 3
): FieldServiceScenarioFixtures {
  const technicians = createMockTechnicians(technicianCount);
  const workOrders = createMockWorkOrders(workOrderCount);
  const dispatchAssignments: MockDispatchAssignment[] = [];
  const invoices: MockInvoice[] = [];

  const serviceZones = [
    createMockServiceZone({ id: 'zone_la', name: 'Los Angeles Metro' }),
    createMockServiceZone({ id: 'zone_oc', name: 'Orange County' }),
  ];

  // Assign work orders to technicians
  workOrders.forEach((wo, index) => {
    const techId = technicians[index % technicians.length].id;
    wo.assignedTechnicianIds = [techId];

    dispatchAssignments.push(
      createMockDispatchAssignment(wo.id, techId)
    );

    // Create invoice for completed work orders
    if (wo.status === 'completed') {
      invoices.push(
        createMockInvoice({
          workOrderId: wo.id,
        })
      );
    }
  });

  return {
    workOrders,
    technicians,
    serviceZones,
    dispatchAssignments,
    invoices,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER FACTORIES
// ─────────────────────────────────────────────────────────────────────────

export function calculateSLA(priority: string, createdAt: Date): Date {
  const slaMinutes = {
    emergency: 120, // 2 hours
    high: 240, // 4 hours
    medium: 1440, // 24 hours
    low: 4320, // 72 hours
  };

  const minutes = slaMinutes[priority as keyof typeof slaMinutes] || 1440;
  return new Date(createdAt.getTime() + minutes * 60 * 1000);
}

export function calculateTravelTime(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  // Simple haversine approximation for testing
  const lat1 = from.latitude;
  const lon1 = from.longitude;
  const lat2 = to.latitude;
  const lon2 = to.longitude;

  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const miles = R * c;

  // Assume average speed of 30 mph in metro areas
  const minutes = Math.ceil((miles / 30) * 60);
  return minutes;
}

export function isWithinServiceZone(
  location: { latitude: number; longitude: number },
  zone: MockServiceZone
): boolean {
  const lat1 = location.latitude;
  const lon1 = location.longitude;
  const lat2 = zone.centerLatitude;
  const lon2 = zone.centerLongitude;

  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const miles = R * c;

  return miles <= zone.radiusMiles;
}
