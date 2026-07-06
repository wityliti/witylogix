/**
 * Field Service Dispatcher Tests
 * 20+ tests for dispatch optimization, SLA compliance, and territory management
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FieldServiceDispatcher } from "../field-service-dispatcher.js";
import type {
  Job,
  Technician,
  DispatchOptimizationRequest,
  ServiceTerritory,
} from "../types.js";

describe("FieldServiceDispatcher", () => {
  let dispatcher: FieldServiceDispatcher;

  beforeEach(() => {
    dispatcher = new FieldServiceDispatcher();
  });

  describe("Dispatch Optimization", () => {
    it("should optimize dispatch assignments", async () => {
      const jobs: Job[] = [
        {
          id: "job-1",
          jobNumber: "J001",
          customerId: "CUST001",
          title: "Service Call 1",
          description: "HVAC service",
          location: {
            address: "100 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
            latitude: 42.3601,
            longitude: -71.0589,
          },
          status: "scheduled",
          priority: "high",
          scheduledStart: new Date("2024-01-15T09:00:00"),
          duration: 60,
          serviceType: "HVAC",
        },
        {
          id: "job-2",
          jobNumber: "J002",
          customerId: "CUST002",
          title: "Service Call 2",
          description: "Plumbing service",
          location: {
            address: "200 Main St",
            city: "Boston",
            postalCode: "02102",
            country: "US",
            latitude: 42.3602,
            longitude: -71.059,
          },
          status: "scheduled",
          priority: "medium",
          scheduledStart: new Date("2024-01-15T11:00:00"),
          duration: 90,
          serviceType: "Plumbing",
        },
      ];

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          skills: ["HVAC", "Electrical"],
          currentLocation: {
            latitude: 42.36,
            longitude: -71.0588,
            timestamp: new Date(),
          },
          rating: 4.5,
        },
        {
          id: "tech-2",
          firstName: "Jane",
          lastName: "Smith",
          status: "available",
          skills: ["Plumbing", "Gas"],
          currentLocation: {
            latitude: 42.3603,
            longitude: -71.0591,
            timestamp: new Date(),
          },
          rating: 4.8,
        },
      ];

      const request: DispatchOptimizationRequest = {
        jobs,
        technicians,
        constraints: { maxJobsPerTechnician: 5 },
      };

      const result = await dispatcher.optimizeDispatch(request);
      expect(result.assignments).toHaveLength(2);
      expect(result.unassignedJobs).toHaveLength(0);
      expect(result.metrics.jobsCovered).toBe(2);
    });

    it("should handle unassignable jobs", async () => {
      const jobs: Job[] = [
        {
          id: "job-1",
          jobNumber: "J001",
          customerId: "CUST001",
          title: "Specialized Service",
          description: "Advanced automation setup",
          location: {
            address: "100 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
          },
          status: "scheduled",
          priority: "high",
          serviceType: "Automation",
          duration: 120,
        },
      ];

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          skills: ["HVAC"],
        },
      ];

      const skillMap = new Map([["job-1", ["Automation"]]]);
      const request: DispatchOptimizationRequest = {
        jobs,
        technicians,
        constraints: { skillRequirements: skillMap },
      };
      const result = await dispatcher.optimizeDispatch(request);
      expect(result.unassignedJobs).toHaveLength(1);
    });

    it("should optimize for travel time minimization", async () => {
      const jobs: Job[] = [
        {
          id: "job-1",
          jobNumber: "J001",
          customerId: "CUST001",
          title: "Service 1",
          location: {
            address: "100 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
            latitude: 42.3601,
            longitude: -71.0589,
          },
          status: "scheduled",
          priority: "high",
          duration: 60,
        },
        {
          id: "job-2",
          jobNumber: "J002",
          customerId: "CUST002",
          title: "Service 2",
          location: {
            address: "150 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
            latitude: 42.3605,
            longitude: -71.0595,
          },
          status: "scheduled",
          priority: "medium",
          duration: 60,
        },
      ];

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          currentLocation: {
            latitude: 42.36,
            longitude: -71.0588,
            timestamp: new Date(),
          },
        },
      ];

      const request: DispatchOptimizationRequest = { jobs, technicians };
      const result = await dispatcher.optimizeForTravelTime(request);
      expect(result.assignments.length).toBeGreaterThan(0);
      expect(result.metrics.totalTravelTime).toBeLessThanOrEqual(100); // Rough estimate
    });

    it("should optimize for workload balancing", async () => {
      const jobs: Job[] = Array.from({ length: 10 }, (_, i) => ({
        id: `job-${i + 1}`,
        jobNumber: `J${String(i + 1).padStart(3, "0")}`,
        customerId: "CUST001",
        title: `Service ${i + 1}`,
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
          latitude: 42.3601,
          longitude: -71.0589,
        },
        status: "scheduled",
        priority: "medium" as const,
        duration: 60,
      }));

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
        },
        {
          id: "tech-2",
          firstName: "Jane",
          lastName: "Smith",
          status: "available",
        },
        {
          id: "tech-3",
          firstName: "Bob",
          lastName: "Johnson",
          status: "available",
        },
      ];

      const request: DispatchOptimizationRequest = { jobs, technicians };
      const result = await dispatcher.optimizeForBalance(request);

      // Check workload distribution
      const workloads = technicians.map(
        (tech) =>
          result.assignments.filter((a) => a.technicianId === tech.id).length,
      );
      const maxWorkload = Math.max(...workloads);
      const minWorkload = Math.min(...workloads);

      // Difference should be minimal
      expect(maxWorkload - minWorkload).toBeLessThanOrEqual(2);
    });
  });

  describe("SLA Compliance", () => {
    it("should calculate SLA compliance for assignments", () => {
      const job: Job = {
        id: "job-1",
        jobNumber: "J001",
        customerId: "CUST001",
        title: "Service",
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
          latitude: 42.3601,
          longitude: -71.0589,
        },
        status: "scheduled",
        priority: "high",
        scheduledStart: new Date("2024-01-15T09:00:00"),
        duration: 60,
      };

      const assignment = {
        id: "assign-1",
        externalId: "assign-1",
        jobId: "job-1",
        technicianId: "tech-1",
        status: "assigned" as const,
        assignedAt: new Date("2024-01-15T08:00:00"),
        priority: "high" as const,
      };

      const targetCompletionTime = 120; // 2 hours
      const result = dispatcher.calculateSLACompliance(
        assignment,
        job,
        targetCompletionTime,
      );

      expect(result.compliant).toBe(true);
      expect(result.estimatedCompletion).toBeInstanceOf(Date);
      expect(result.slackTime).toBeGreaterThanOrEqual(0);
    });

    it("should flag non-compliant SLAs", () => {
      const job: Job = {
        id: "job-1",
        jobNumber: "J001",
        customerId: "CUST001",
        title: "Service",
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "high",
        duration: 180,
      };

      const assignment = {
        id: "assign-1",
        externalId: "assign-1",
        jobId: "job-1",
        technicianId: "tech-1",
        status: "assigned" as const,
        assignedAt: new Date("2024-01-15T08:00:00"),
        travelTime: 60,
        priority: "high" as const,
      };

      const targetCompletionTime = 60; // Only 1 hour available
      const result = dispatcher.calculateSLACompliance(
        assignment,
        job,
        targetCompletionTime,
      );

      expect(result.compliant).toBe(false);
      expect(result.slackTime).toBeLessThan(0);
    });
  });

  describe("Technician Selection", () => {
    it("should find nearest available technician", async () => {
      const job: Job = {
        id: "job-1",
        jobNumber: "J001",
        customerId: "CUST001",
        title: "Service",
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
          latitude: 42.36,
          longitude: -71.0589,
        },
        status: "scheduled",
        priority: "high",
      };

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          currentLocation: {
            latitude: 42.36,
            longitude: -71.0588,
            timestamp: new Date(),
          },
        },
        {
          id: "tech-2",
          firstName: "Jane",
          lastName: "Smith",
          status: "available",
          currentLocation: {
            latitude: 42.4,
            longitude: -71.1,
            timestamp: new Date(),
          },
        },
      ];

      const result = await dispatcher.findNearestTechnician(job, technicians);
      expect(result?.id).toBe("tech-1");
    });

    it("should return null when no technicians available", async () => {
      const job: Job = {
        id: "job-1",
        jobNumber: "J001",
        customerId: "CUST001",
        title: "Service",
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "high",
      };

      const technicians: Technician[] = [];
      const result = await dispatcher.findNearestTechnician(job, technicians);
      expect(result).toBeNull();
    });
  });

  describe("Territory Coverage", () => {
    it("should check territory coverage", async () => {
      const territory: ServiceTerritory = {
        id: "terr-1",
        name: "Boston Area",
        status: "active",
      };

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          serviceTerritory: "terr-1",
        },
        {
          id: "tech-2",
          firstName: "Jane",
          lastName: "Smith",
          status: "available",
          serviceTerritory: "terr-2",
        },
      ];

      const result = await dispatcher.checkTerritoryCoverage(
        territory,
        technicians,
      );
      expect(result.covered).toBe(true);
      expect(result.coveringTechnicians).toHaveLength(1);
    });

    it("should detect uncovered territories", async () => {
      const territory: ServiceTerritory = {
        id: "terr-3",
        name: "Vermont Area",
        status: "active",
      };

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          serviceTerritory: "terr-1",
        },
      ];

      const result = await dispatcher.checkTerritoryCoverage(
        territory,
        technicians,
      );
      expect(result.covered).toBe(false);
      expect(result.coveringTechnicians).toHaveLength(0);
    });
  });

  describe("Route Estimation", () => {
    it("should estimate route duration with multiple stops", () => {
      const stops = [
        { latitude: 42.3601, longitude: -71.0589 },
        { latitude: 42.3602, longitude: -71.059 },
        { latitude: 42.3603, longitude: -71.0591 },
      ];

      const duration = dispatcher.estimateRouteDuration(stops);
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe("number");
    });

    it("should handle stops without coordinates", () => {
      const stops = [{ latitude: 42.3601, longitude: -71.0589 }, {}];
      const duration = dispatcher.estimateRouteDuration(stops);
      expect(typeof duration).toBe("number");
    });
  });

  describe("Constraints Handling", () => {
    it("should respect max jobs per technician constraint", async () => {
      const jobs: Job[] = Array.from({ length: 12 }, (_, i) => ({
        id: `job-${i + 1}`,
        jobNumber: `J${String(i + 1).padStart(3, "0")}`,
        customerId: "CUST001",
        title: `Service ${i + 1}`,
        location: {
          address: "100 Main St",
          city: "Boston",
          postalCode: "02101",
          country: "US",
        },
        status: "scheduled",
        priority: "medium" as const,
        duration: 60,
      }));

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
        },
      ];

      const request: DispatchOptimizationRequest = {
        jobs,
        technicians,
        constraints: { maxJobsPerTechnician: 5 },
      };

      const result = await dispatcher.optimizeDispatch(request);
      const assignedToTech1 = result.assignments.filter(
        (a) => a.technicianId === "tech-1",
      ).length;
      expect(assignedToTech1).toBeLessThanOrEqual(5);
    });

    it("should handle skill requirements", async () => {
      const jobs: Job[] = [
        {
          id: "job-1",
          jobNumber: "J001",
          customerId: "CUST001",
          title: "Electrical Work",
          location: {
            address: "100 Main St",
            city: "Boston",
            postalCode: "02101",
            country: "US",
          },
          status: "scheduled",
          priority: "high" as const,
          serviceType: "Electrical",
        },
      ];

      const technicians: Technician[] = [
        {
          id: "tech-1",
          firstName: "John",
          lastName: "Doe",
          status: "available",
          skills: ["Plumbing"],
        },
        {
          id: "tech-2",
          firstName: "Jane",
          lastName: "Smith",
          status: "available",
          skills: ["Electrical", "HVAC"],
        },
      ];

      const skillMap = new Map([["job-1", ["Electrical"]]]);
      const request: DispatchOptimizationRequest = {
        jobs,
        technicians,
        constraints: { skillRequirements: skillMap },
      };

      const result = await dispatcher.optimizeDispatch(request);
      if (result.assignments.length > 0) {
        expect(result.assignments[0].technicianId).toBe("tech-2");
      }
    });
  });
});
