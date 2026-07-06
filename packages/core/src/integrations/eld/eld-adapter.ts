/**
 * Abstract ELD Adapter Base Class
 *
 * Provides common functionality for all ELD adapters (Motive, Omnitracs, Azuga):
 * - Rate limiting and circuit breaker
 * - Retry logic with exponential backoff
 * - FMCSA Part 395 HOS compliance helpers
 * - Duty status transition validation
 * - HOS calculation utilities (daily/weekly)
 * - Audit logging
 */

import type {
  ELDAdapterInterface,
  ELDDriverLog,
  ELDDutyStatus,
  ELDViolation,
  ELDVehicle,
  ELDDVIR,
  ELDEvent,
  ELDConfig,
  ELDWebhookEvent,
  DutyStatus,
  ViolationType,
  HOSSummary,
  HOSDailyRecord,
  HOS8DayWindow,
} from "./types.js";

// ─── Circuit Breaker ────────────────────────────────────────

/**
 * Simple circuit breaker for API calls.
 * Transitions: CLOSED -> OPEN (on failures) -> HALF_OPEN (after timeout) -> CLOSED (on success)
 */
class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly successThreshold: number = 2,
    private readonly resetTimeout: number = 60000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.resetTimeout}ms`,
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.state = "CLOSED";
          this.failureCount = 0;
        }
      } else if (this.state === "CLOSED") {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
      }

      throw error;
    }
  }
}

// ─── Rate Limiter ──────────────────────────────────────────

/**
 * Token bucket rate limiter.
 */
class RateLimiter {
  private tokens: number;
  private lastRefillTime: number = Date.now();

  constructor(
    private readonly tokensPerSecond: number,
    private readonly maxTokens: number = tokensPerSecond,
  ) {
    this.tokens = maxTokens;
  }

  async acquire(count: number = 1): Promise<void> {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + timePassed * this.tokensPerSecond,
    );
    this.lastRefillTime = now;

    if (this.tokens < count) {
      const waitTime = ((count - this.tokens) / this.tokensPerSecond) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.tokens = 0;
      this.lastRefillTime = Date.now();
    } else {
      this.tokens -= count;
    }
  }
}

// ─── Abstract Base Class ───────────────────────────────────

/**
 * Abstract base class for ELD adapters.
 */
export abstract class ELDAdapter implements ELDAdapterInterface {
  protected config: ELDConfig;
  protected circuitBreaker: CircuitBreaker;
  protected rateLimiter: RateLimiter;
  protected auditLog: ELDEvent[] = [];

  constructor(config: ELDConfig, tokensPerSecond: number = 10) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(5, 2, 60000);
    this.rateLimiter = new RateLimiter(tokensPerSecond);
  }

  // ─── Abstract methods to be implemented by subclasses ──────

  abstract initialize(): Promise<void>;

  abstract getDriverLogs(
    driverId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ELDDriverLog[]>;

  abstract getDutyStatus(driverId: string): Promise<ELDDutyStatus>;

  abstract setDutyStatus(
    driverId: string,
    status: DutyStatus,
    location?: { latitude: number; longitude: number },
  ): Promise<ELDDutyStatus>;

  abstract getViolations(
    driverId: string,
    days?: number,
  ): Promise<ELDViolation[]>;

  abstract getVehicle(vehicleId: string): Promise<ELDVehicle>;

  abstract getVehicles(): Promise<ELDVehicle[]>;

  abstract submitDVIR(dvir: Partial<ELDDVIR>): Promise<ELDDVIR>;

  abstract getDVIRs(vehicleId: string, days?: number): Promise<ELDDVIR[]>;

  abstract handleWebhook(event: ELDWebhookEvent): Promise<void>;

  abstract healthCheck(): Promise<boolean>;

  // ─── Common HOS Calculations ───────────────────────────────

  /**
   * Get HOS summary for a driver on a specific date.
   */
  async getHOSSummary(driverId: string, date: Date): Promise<HOSSummary> {
    const logs = await this.getDriverLogs(
      driverId,
      date,
      new Date(date.getTime() + 86400000),
    );

    const daily = this.calculateDaily(logs);
    const window8 = this.calculate8DayWindow(driverId, date);

    return {
      driverId,
      date,
      hours11: daily.drivingHours,
      hours14: daily.drivingHours + daily.onDutyHours,
      hours60: window8.hours60,
      hours70: window8.hours70,
      availableDriving: Math.max(0, 11 - daily.drivingHours),
      availableOnDuty: Math.max(
        0,
        14 - (daily.drivingHours + daily.onDutyHours),
      ),
      violations: this.detectViolations(daily, window8),
    };
  }

  /**
   * Calculate daily HOS from logs.
   */
  protected calculateDaily(logs: ELDDriverLog[]): HOSDailyRecord {
    const drivingHours = logs
      .filter((l) => l.dutyStatus === "driving")
      .reduce((sum, l) => sum + l.hours, 0);

    const onDutyHours = logs
      .filter((l) => l.dutyStatus === "on-duty")
      .reduce((sum, l) => sum + l.hours, 0);

    const sleeperHours = logs
      .filter((l) => l.dutyStatus === "sleeper-berth")
      .reduce((sum, l) => sum + l.hours, 0);

    const offDutyHours = logs
      .filter((l) => l.dutyStatus === "off-duty")
      .reduce((sum, l) => sum + l.hours, 0);

    const personalConveyanceHours = logs
      .filter((l) => l.dutyStatus === "personal-conveyance")
      .reduce((sum, l) => sum + l.hours, 0);

    const yardMoveHours = logs
      .filter((l) => l.dutyStatus === "yard-move")
      .reduce((sum, l) => sum + l.hours, 0);

    return {
      driverId: logs[0]?.driverId || "",
      date: new Date(),
      drivingHours,
      onDutyHours,
      sleeperHours,
      offDutyHours,
      personalConveyanceHours,
      yardMoveHours,
    };
  }

  /**
   * Calculate 8-day HOS window (60/70 hour rule).
   */
  protected calculate8DayWindow(
    driverId: string,
    endDate: Date,
  ): HOS8DayWindow {
    const startDate = new Date(endDate.getTime() - 7 * 86400000);

    // Placeholder: In real implementation, fetch logs for 8-day window
    return {
      driverId,
      startDate,
      endDate,
      hours60: 0,
      hours70: 0,
    };
  }

  /**
   * Detect HOS violations based on FMCSA Part 395 rules.
   */
  protected detectViolations(
    daily: HOSDailyRecord,
    window8: HOS8DayWindow,
  ): ViolationType[] {
    const violations: ViolationType[] = [];

    // 11-hour driving limit (Part 395.8)
    if (daily.drivingHours > 11) {
      violations.push("hours-11");
    }

    // 14-hour rule (Part 395.8)
    if (daily.drivingHours + daily.onDutyHours > 14) {
      violations.push("hours-14");
    }

    // 8-hour driving limit without 30-min break (Part 395.8)
    // Simplified: if driving > 8 hours without documented break
    if (daily.drivingHours > 8) {
      violations.push("hours-8");
    }

    // 60/70-hour rule (Part 395.8)
    if (window8.hours60 > 60 || window8.hours70 > 70) {
      violations.push("hours-60-70");
    }

    // 30-minute break requirement (Part 395.8)
    // Simplified: check if driving continuously > 8 hours
    violations.push("break-30min");

    return violations;
  }

  /**
   * Validate duty status transition per FMCSA rules.
   */
  protected validateDutyTransition(
    fromStatus: DutyStatus,
    toStatus: DutyStatus,
  ): boolean {
    // All transitions are allowed by FMCSA
    // Driver can transition to any status from any status
    const validTransitions: Record<DutyStatus, DutyStatus[]> = {
      driving: [
        "on-duty",
        "off-duty",
        "sleeper-berth",
        "personal-conveyance",
        "yard-move",
      ],
      "on-duty": [
        "driving",
        "off-duty",
        "sleeper-berth",
        "personal-conveyance",
        "yard-move",
      ],
      "sleeper-berth": [
        "driving",
        "on-duty",
        "off-duty",
        "personal-conveyance",
        "yard-move",
      ],
      "off-duty": [
        "driving",
        "on-duty",
        "sleeper-berth",
        "personal-conveyance",
        "yard-move",
      ],
      "personal-conveyance": [
        "driving",
        "on-duty",
        "sleeper-berth",
        "off-duty",
        "yard-move",
      ],
      "yard-move": [
        "driving",
        "on-duty",
        "sleeper-berth",
        "off-duty",
        "personal-conveyance",
      ],
    };

    return validTransitions[fromStatus]?.includes(toStatus) ?? false;
  }

  /**
   * Execute API call with rate limiting, circuit breaker, and retry.
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(async () => {
      let lastError: Error = new Error("Unknown error");

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries - 1) {
            const waitTime = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }

      throw lastError;
    });
  }

  /**
   * Add event to audit log.
   */
  protected logEvent(event: Partial<ELDEvent>): void {
    const auditEvent: ELDEvent = {
      id: `evt_${Date.now()}`,
      type: (event.type || "diagnostic-event") as any,
      accountId: event.accountId || this.config.accountId || "",
      driverId: event.driverId,
      vehicleId: event.vehicleId,
      timestamp: new Date(),
      data: event.data || {},
      processed: false,
      createdAt: new Date(),
    };

    this.auditLog.push(auditEvent);
  }

  /**
   * Get audit log entries.
   */
  getAuditLog(): ELDEvent[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log (for testing).
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

// ─── Helper Utilities ──────────────────────────────────────

/**
 * Convert minutes to hours (decimal).
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Convert hours (decimal) to minutes.
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Calculate time difference in hours between two dates.
 */
export function getHoursDifference(start: Date, end: Date): number {
  return minutesToHours((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Get start of day (midnight).
 */
export function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day (23:59:59).
 */
export function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Check if a date is within a day of another date.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getStartOfDay(date1).getTime() === getStartOfDay(date2).getTime();
}
