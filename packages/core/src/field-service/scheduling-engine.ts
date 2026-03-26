/**
 * Scheduling Engine — Multi-constraint job scheduling algorithm.
 *
 * This module provides sophisticated scheduling capabilities for field service work orders:
 * - Constraint solver: skill matching, zone assignment, availability, travel time, SLA compliance
 * - Time slot finder: identify available slots per technician
 * - Batch scheduler: optimize multiple jobs across team
 * - Recurring scheduler: generate instances from templates
 * - Conflict detector: identify scheduling issues
 * - Reschedule engine: find alternatives when changes occur
 *
 * Core algorithm: Constraint propagation with greedy optimization.
 * Time complexity: O(n*m) where n=jobs, m=technicians.
 */

import type {
  WorkOrder,
  Technician,
  JobSchedule,
  TimeSlot,
  ConstraintViolation,
  SchedulingResult,
  Address,
  Coordinates,
  SLARule,
  RecurringPlan,
  RecurrenceFrequency,
} from "./field-service-types.js";

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────

/**
 * Calculate haversine distance between two coordinates (km).
 * Used for travel time estimation.
 */
function haversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371; // Earth radius (km)
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate travel time based on distance.
 * Applies 1.3x factor for real-world delays (traffic, road conditions).
 */
function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmH = 50; // Assume 50 km/h average with traffic
  const travelMinutes = (distanceKm / avgSpeedKmH) * 60;
  return Math.ceil(travelMinutes * 1.3); // 1.3x factor
}

/**
 * Parse working hours string (HH:MM) to minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a date falls within working hours.
 */
function isWithinWorkingHours(date: Date, tech: Technician): boolean {
  const dayOfWeek = date.getUTCDay();
  if (!tech.workingHours.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  const timeMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const startMinutes = timeToMinutes(tech.workingHours.startTime);
  const endMinutes = timeToMinutes(tech.workingHours.endTime);
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Check if technician's service zones include job address.
 */
function isInServiceZone(jobAddress: Address, tech: Technician): boolean {
  if (tech.serviceZones.length === 0) {
    return true; // No zone restriction
  }
  return tech.serviceZones.some((zone) => {
    const distance = haversineDistance(zone.coordinates[0], jobAddress.coordinates);
    return distance <= (zone.radius || 50); // Default 50km radius
  });
}

/**
 * Check if technician has all required skills.
 */
function hasRequiredSkills(jobSkills: string[], techSkills: string[]): boolean {
  return jobSkills.every((skill) => techSkills.includes(skill));
}

// ─── CONSTRAINT SOLVER ──────────────────────────────────────────

/**
 * Multi-constraint scheduling solver.
 * Validates scheduling feasibility against all constraints.
 */
export class ConstraintSolver {
  /**
   * Check if a job can be scheduled for a technician at a given time.
   */
  static canSchedule(
    job: WorkOrder,
    tech: Technician,
    startTime: Date,
    schedule: JobSchedule,
    slaRule: SLARule
  ): {
    feasible: boolean;
    violations: ConstraintViolation[];
  } {
    const violations: ConstraintViolation[] = [];

    // 1. Skill matching
    if (!hasRequiredSkills(job.requiredSkills, tech.skills)) {
      violations.push({
        type: "SKILL_MISMATCH",
        message: `Technician ${tech.id} lacks required skills: ${job.requiredSkills.join(", ")}`,
        severity: "ERROR",
        jobId: job.id,
        technicianId: tech.id,
      });
    }

    // 2. Zone assignment
    if (!isInServiceZone(job.address, tech)) {
      violations.push({
        type: "ZONE_VIOLATION",
        message: `Job address outside technician ${tech.id}'s service zones`,
        severity: "ERROR",
        jobId: job.id,
        technicianId: tech.id,
      });
    }

    // 3. Availability - double-booking check
    const endTime = new Date(startTime.getTime() + job.estimatedDuration * 60 * 1000);
    const isBooked = schedule.slots.some(
      (slot) =>
        !(endTime <= slot.startTime || startTime >= slot.endTime)
    );
    if (isBooked) {
      violations.push({
        type: "DOUBLE_BOOKING",
        message: `Time slot conflicts with existing booking`,
        severity: "ERROR",
        jobId: job.id,
        technicianId: tech.id,
      });
    }

    // 4. Working hours check
    if (!isWithinWorkingHours(startTime, tech) || !isWithinWorkingHours(endTime, tech)) {
      violations.push({
        type: "WORKING_HOURS_VIOLATION",
        message: `Job outside technician ${tech.id}'s working hours`,
        severity: "ERROR",
        jobId: job.id,
        technicianId: tech.id,
      });
    }

    // 5. SLA compliance
    const slaWindow = slaRule.windows.find((w) => w.priority === job.priority);
    if (slaWindow) {
      const slaDeadline = new Date(job.createdAt.getTime() + slaWindow.completionTimeMinutes * 60 * 1000);
      if (endTime > slaDeadline) {
        violations.push({
          type: "SLA_VIOLATION",
          message: `Scheduled completion exceeds SLA window by ${Math.ceil((endTime.getTime() - slaDeadline.getTime()) / 60000)} minutes`,
          severity: "WARNING",
          jobId: job.id,
          technicianId: tech.id,
        });
      }
    }

    return {
      feasible: violations.filter((v) => v.severity === "ERROR").length === 0,
      violations,
    };
  }

  /**
   * Validate entire schedule for constraint violations.
   */
  static validateSchedule(
    jobs: WorkOrder[],
    techs: Technician[],
    schedules: Map<string, JobSchedule>,
    slaRules: Map<string, SLARule>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const job of jobs) {
      if (!job.technicianId) continue;
      const tech = techs.find((t) => t.id === job.technicianId);
      if (!tech) {
        violations.push({
          type: "INVALID_TECHNICIAN",
          message: `Job ${job.id} assigned to non-existent technician`,
          severity: "ERROR",
          jobId: job.id,
        });
        continue;
      }

      const schedule = schedules.get(job.technicianId);
      const slaRule = slaRules.get(job.slaRuleId);

      if (schedule && slaRule && job.scheduledStart) {
        const result = this.canSchedule(job, tech, job.scheduledStart, schedule, slaRule);
        violations.push(...result.violations);
      }
    }

    return violations;
  }
}

// ─── TIME SLOT FINDER ───────────────────────────────────────────

/**
 * Finds available time slots for scheduling work orders.
 */
export class TimeSlotFinder {
  /**
   * Find all available slots for a technician on a given date.
   */
  static findAvailableSlots(
    schedule: JobSchedule,
    technicianId: string,
    minDurationMinutes: number,
    maxSlotsToReturn: number = 10
  ): TimeSlot[] {
    const available: TimeSlot[] = [];
    const workDayStart = new Date(`${schedule.date}T08:00:00Z`);
    const workDayEnd = new Date(`${schedule.date}T17:00:00Z`);

    let current = new Date(workDayStart);
    let slotCount = 0;

    while (current < workDayEnd && slotCount < maxSlotsToReturn) {
      // Check if slot is available (not booked)
      const slotEnd = new Date(current.getTime() + minDurationMinutes * 60 * 1000);
      const isAvailable = !schedule.slots.some(
        (slot) =>
          slot.type === "WORK" &&
          !(slotEnd <= slot.startTime || current >= slot.endTime)
      );

      if (isAvailable && slotEnd <= workDayEnd) {
        available.push({
          startTime: new Date(current),
          endTime: slotEnd,
          durationMinutes: minDurationMinutes,
          available: true,
          type: "WORK",
        });
        slotCount++;
      }

      current = new Date(current.getTime() + 15 * 60 * 1000); // 15-minute intervals
    }

    return available;
  }

  /**
   * Find next available slot across all technicians.
   * Returns earliest available slot.
   */
  static findNextAvailableSlot(
    schedules: Map<string, JobSchedule>,
    minDurationMinutes: number
  ): {
    technicianId: string;
    slot: TimeSlot;
  } | null {
    let earliestSlot: {
      technicianId: string;
      slot: TimeSlot;
    } | null = null;

    for (const [techId, schedule] of schedules) {
      const slots = this.findAvailableSlots(schedule, techId, minDurationMinutes, 1);
      if (slots.length > 0) {
        if (!earliestSlot || slots[0].startTime < earliestSlot.slot.startTime) {
          earliestSlot = {
            technicianId: techId,
            slot: slots[0],
          };
        }
      }
    }

    return earliestSlot;
  }
}

// ─── BATCH SCHEDULER ────────────────────────────────────────────

/**
 * Schedules multiple jobs optimally across technician team.
 */
export class BatchScheduler {
  /**
   * Schedule multiple work orders.
   * Greedy algorithm: sort by priority, assign each to best-fit technician.
   */
  static schedule(
    jobs: WorkOrder[],
    techs: Technician[],
    schedules: Map<string, JobSchedule>,
    slaRules: Map<string, SLARule>
  ): SchedulingResult {
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const violations: ConstraintViolation[] = [];

    // Sort by priority (emergency first)
    const priorityOrder = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sortedJobs = [...jobs].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const job of sortedJobs) {
      const bestMatch = this.findBestTechnicianForJob(job, techs, schedules, slaRules);

      if (bestMatch) {
        // Schedule the job
        job.technicianId = bestMatch.technicianId;
        job.scheduledStart = bestMatch.timeSlot.startTime;
        job.scheduledEnd = bestMatch.timeSlot.endTime;
        job.status = "SCHEDULED";
        successCount++;
      } else {
        failedCount++;
        violations.push({
          type: "NO_AVAILABLE_TECHNICIAN",
          message: `Could not find technician to schedule job ${job.id}`,
          severity: "ERROR",
          jobId: job.id,
        });
      }
    }

    return {
      successCount,
      failedCount,
      violations,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Find best technician for a job based on scoring.
   */
  private static findBestTechnicianForJob(
    job: WorkOrder,
    techs: Technician[],
    schedules: Map<string, JobSchedule>,
    slaRules: Map<string, SLARule>
  ): {
    technicianId: string;
    timeSlot: TimeSlot;
  } | null {
    let bestScore = -1;
    let bestMatch: { technicianId: string; timeSlot: TimeSlot } | null = null;
    const slaRule = slaRules.get(job.slaRuleId);

    for (const tech of techs) {
      // Basic constraint checks
      if (!hasRequiredSkills(job.requiredSkills, tech.skills)) continue;
      if (!isInServiceZone(job.address, tech)) continue;

      const schedule = schedules.get(tech.id);
      if (!schedule) continue;

      // Find available slot
      const slots = TimeSlotFinder.findAvailableSlots(schedule, tech.id, job.estimatedDuration, 3);
      if (slots.length === 0) continue;

      // Use first available slot
      const slot = slots[0];
      let score = 100; // Base score

      // Deduct for distance (prefer closer techs)
      const distance = haversineDistance(tech.currentLocation, job.address.coordinates);
      score -= Math.min(distance * 0.5, 20);

      // Deduct for workload (prefer less busy)
      const utilization = schedule.utilization;
      score -= utilization * 0.3;

      // Bonus for SLA compliance if nearby
      if (slaRule && distance < 20) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { technicianId: tech.id, timeSlot: slot };
      }
    }

    return bestMatch;
  }
}

// ─── RECURRING SCHEDULER ────────────────────────────────────────

/**
 * Generates work order instances from recurring templates.
 */
export class RecurringScheduler {
  /**
   * Generate work order instances from a recurring plan.
   */
  static generateInstances(plan: RecurringPlan, fromDate: Date, toDate: Date): WorkOrder[] {
    const instances: WorkOrder[] = [];
    let current = new Date(fromDate);

    while (current <= toDate) {
      if (plan.endDate && current > plan.endDate) {
        break;
      }

      if (this.isScheduledDate(current, plan)) {
        const instance: WorkOrder = {
          id: `wo_${plan.id}_${current.getTime()}`,
          customerId: plan.customerId,
          type: plan.type,
          priority: "MEDIUM",
          status: "CREATED",
          description: plan.description,
          requiredSkills: plan.requiredSkills,
          estimatedDuration: plan.estimatedDuration,
          address: plan.address,
          parts: [],
          notes: [`Generated from recurring plan ${plan.id}`],
          signatures: [],
          photos: [],
          slaRuleId: plan.slaRuleId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        instances.push(instance);
      }

      current = new Date(current.getTime() + 24 * 60 * 60 * 1000); // Next day
    }

    return instances;
  }

  /**
   * Check if a date matches the recurring pattern.
   */
  private static isScheduledDate(date: Date, plan: RecurringPlan): boolean {
    const dayOfMonth = date.getUTCDate();
    const dayOfWeek = date.getUTCDay();

    switch (plan.frequency) {
      case "WEEKLY":
        return plan.dayOfWeek !== undefined && dayOfWeek === plan.dayOfWeek;
      case "BIWEEKLY":
        // Simplified: every other week
        const weekNumber = Math.floor(date.getUTCDate() / 7);
        return plan.dayOfWeek !== undefined && dayOfWeek === plan.dayOfWeek && weekNumber % 2 === 0;
      case "MONTHLY":
        return plan.dayOfMonth !== undefined && dayOfMonth === plan.dayOfMonth;
      case "QUARTERLY":
        // Simplified: every 3 months
        const month = date.getUTCMonth();
        return plan.dayOfMonth !== undefined && dayOfMonth === plan.dayOfMonth && month % 3 === 0;
      default:
        return false;
    }
  }
}

// ─── CONFLICT DETECTOR ──────────────────────────────────────────

/**
 * Detects scheduling conflicts and issues.
 */
export class ConflictDetector {
  /**
   * Detect all conflicts in current scheduling.
   */
  static detectConflicts(
    jobs: WorkOrder[],
    techs: Technician[],
    schedules: Map<string, JobSchedule>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Check for overlapping jobs per technician
    for (const [techId, schedule] of schedules) {
      const techJobs = jobs.filter((j) => j.technicianId === techId && j.scheduledStart && j.scheduledEnd);
      for (let i = 0; i < techJobs.length; i++) {
        for (let j = i + 1; j < techJobs.length; j++) {
          const job1 = techJobs[i];
          const job2 = techJobs[j];
          if (
            job1.scheduledStart &&
            job1.scheduledEnd &&
            job2.scheduledStart &&
            job2.scheduledEnd &&
            !(job1.scheduledEnd <= job2.scheduledStart || job1.scheduledStart >= job2.scheduledEnd)
          ) {
            violations.push({
              type: "OVERLAPPING_JOBS",
              message: `Jobs ${job1.id} and ${job2.id} overlap for technician ${techId}`,
              severity: "ERROR",
              jobId: job1.id,
              technicianId: techId,
            });
          }
        }
      }
    }

    // Check for impossible travel times
    for (const [techId, schedule] of schedules) {
      const techJobs = jobs
        .filter((j) => j.technicianId === techId && j.scheduledStart && j.scheduledEnd)
        .sort((a, b) => (a.scheduledStart?.getTime() || 0) - (b.scheduledStart?.getTime() || 0));

      for (let i = 0; i < techJobs.length - 1; i++) {
        const job1 = techJobs[i];
        const job2 = techJobs[i + 1];
        if (job1.scheduledEnd && job2.scheduledStart) {
          const availableTime = (job2.scheduledStart.getTime() - job1.scheduledEnd.getTime()) / 60000;
          const requiredTime = estimateTravelTime(
            haversineDistance(job1.address.coordinates, job2.address.coordinates)
          );

          if (availableTime < requiredTime) {
            violations.push({
              type: "IMPOSSIBLE_TRAVEL",
              message: `Not enough travel time between jobs ${job1.id} and ${job2.id} (need ${requiredTime}min, have ${availableTime}min)`,
              severity: "WARNING",
              jobId: job1.id,
              technicianId: techId,
              suggestion: `Add ${Math.ceil(requiredTime - availableTime)} minutes travel buffer`,
            });
          }
        }
      }
    }

    return violations;
  }
}

// ─── RESCHEDULE ENGINE ──────────────────────────────────────────

/**
 * Finds alternative slots when changes occur.
 */
export class RescheduleEngine {
  /**
   * Find alternative schedule after job cancellation or delay.
   */
  static findAlternatives(
    cancelledJobId: string,
    jobs: WorkOrder[],
    techs: Technician[],
    schedules: Map<string, JobSchedule>,
    slaRules: Map<string, SLARule>
  ): {
    jobId: string;
    alternatives: Array<{
      technicianId: string;
      startTime: Date;
      endTime: Date;
      score: number;
    }>;
  } | null {
    const job = jobs.find((j) => j.id === cancelledJobId);
    if (!job) return null;

    const alternatives: Array<{
      technicianId: string;
      startTime: Date;
      endTime: Date;
      score: number;
    }> = [];

    for (const tech of techs) {
      const schedule = schedules.get(tech.id);
      if (!schedule) continue;

      const slots = TimeSlotFinder.findAvailableSlots(schedule, tech.id, job.estimatedDuration, 5);
      for (const slot of slots) {
        const canSchedule = ConstraintSolver.canSchedule(job, tech, slot.startTime, schedule, slaRules.get(job.slaRuleId)!);
        if (canSchedule.feasible) {
          alternatives.push({
            technicianId: tech.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            score: 100 - Math.min(haversineDistance(tech.currentLocation, job.address.coordinates), 50),
          });
        }
      }
    }

    // Sort by score (best first)
    alternatives.sort((a, b) => b.score - a.score);

    return {
      jobId: cancelledJobId,
      alternatives: alternatives.slice(0, 5),
    };
  }
}
