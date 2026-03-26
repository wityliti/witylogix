/**
 * Holiday Calendar and Special Events
 *
 * Manages public holidays and special events for demand prediction.
 * Provides demand multipliers based on holiday/event impact.
 */

/**
 * Holiday definition
 */
export interface Holiday {
  name: string;
  date: Date;
  country: string;
  demandMultiplier: number; // Expected demand factor
  affectsNextDay: boolean;
}

/**
 * Special event definition
 */
export interface SpecialEvent {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  demandMultiplier: number;
  affectedZones?: string[]; // undefined = all zones
}

/**
 * Holiday calendar manager
 */
export class HolidayCalendar {
  private holidays: Map<string, Holiday[]> = new Map();
  private customEvents: Map<string, SpecialEvent> = new Map();

  constructor() {
    this.initializePublicHolidays();
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date, country: string = 'US'): boolean {
    const key = this.dateToKey(date);
    const countryHolidays = this.holidays.get(country) || [];

    return countryHolidays.some(h => this.dateToKey(h.date) === key);
  }

  /**
   * Get holiday info if date is a holiday
   */
  getHoliday(date: Date, country: string = 'US'): Holiday | null {
    const key = this.dateToKey(date);
    const countryHolidays = this.holidays.get(country) || [];

    const holiday = countryHolidays.find(h => this.dateToKey(h.date) === key);
    return holiday || null;
  }

  /**
   * Get demand multiplier for a holiday
   */
  getHolidayImpact(holiday: Holiday): number {
    return holiday.demandMultiplier;
  }

  /**
   * Register custom event
   */
  registerEvent(event: SpecialEvent): void {
    this.customEvents.set(event.id, event);
  }

  /**
   * Get custom event for a date
   */
  getEvent(date: Date, zoneId?: string): SpecialEvent | null {
    const dateTime = date.getTime();

    for (const event of this.customEvents.values()) {
      if (
        dateTime >= event.startDate.getTime() &&
        dateTime <= event.endDate.getTime()
      ) {
        // Check zone applicability
        if (event.affectedZones && !event.affectedZones.includes(zoneId || '')) {
          continue;
        }
        return event;
      }
    }

    return null;
  }

  /**
   * Get all events in a date range
   */
  getEventsInRange(
    startDate: Date,
    endDate: Date,
    zoneId?: string
  ): SpecialEvent[] {
    const result: SpecialEvent[] = [];
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    for (const event of this.customEvents.values()) {
      if (event.endDate.getTime() >= startTime && event.startDate.getTime() <= endTime) {
        if (event.affectedZones && !event.affectedZones.includes(zoneId || '')) {
          continue;
        }
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Get days until next holiday
   */
  daysUntilNextHoliday(date: Date, country: string = 'US'): number {
    const countryHolidays = this.holidays.get(country) || [];

    let minDays = Infinity;

    for (const holiday of countryHolidays) {
      const daysDiff = Math.ceil(
        (holiday.date.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff >= 0 && daysDiff < minDays) {
        minDays = daysDiff;
      }
    }

    return minDays === Infinity ? -1 : minDays;
  }

  /**
   * Get days since last holiday
   */
  daysSinceLastHoliday(date: Date, country: string = 'US'): number {
    const countryHolidays = this.holidays.get(country) || [];

    let maxDays = -1;

    for (const holiday of countryHolidays) {
      const daysDiff = Math.floor(
        (date.getTime() - holiday.date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff >= 0 && daysDiff > maxDays) {
        maxDays = daysDiff;
      }
    }

    return maxDays;
  }

  /**
   * Compute total demand multiplier for a date
   */
  computeDemandMultiplier(
    date: Date,
    country: string = 'US',
    zoneId?: string
  ): number {
    let multiplier = 1.0;

    // Check holiday
    const holiday = this.getHoliday(date, country);
    if (holiday) {
      multiplier *= holiday.demandMultiplier;
    }

    // Check day after holiday (often high demand)
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousHoliday = this.getHoliday(previousDay, country);
    if (previousHoliday && previousHoliday.affectsNextDay) {
      multiplier *= 0.7; // Reduced demand after holidays
    }

    // Check special events
    const event = this.getEvent(date, zoneId);
    if (event) {
      multiplier *= event.demandMultiplier;
    }

    return multiplier;
  }

  /**
   * Get all holidays for a country and year
   */
  getHolidaysForYear(country: string, year: number): Holiday[] {
    const countryHolidays = this.holidays.get(country) || [];
    return countryHolidays.filter(h => h.date.getFullYear() === year);
  }

  /**
   * Initialize built-in public holidays
   */
  private initializePublicHolidays(): void {
    // US Holidays
    const usHolidays: Holiday[] = [
      { name: "New Year's Day", date: new Date(2026, 0, 1), country: 'US', demandMultiplier: 0.5, affectsNextDay: true },
      { name: 'MLK Jr. Day', date: new Date(2026, 0, 19), country: 'US', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Presidents Day', date: new Date(2026, 1, 16), country: 'US', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Good Friday', date: new Date(2026, 3, 3), country: 'US', demandMultiplier: 1.1, affectsNextDay: true },
      { name: 'Easter Sunday', date: new Date(2026, 3, 5), country: 'US', demandMultiplier: 0.6, affectsNextDay: true },
      { name: 'Memorial Day', date: new Date(2026, 4, 25), country: 'US', demandMultiplier: 0.7, affectsNextDay: true },
      { name: 'Independence Day', date: new Date(2026, 6, 4), country: 'US', demandMultiplier: 0.6, affectsNextDay: true },
      { name: 'Labor Day', date: new Date(2026, 8, 7), country: 'US', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Columbus Day', date: new Date(2026, 9, 12), country: 'US', demandMultiplier: 0.9, affectsNextDay: false },
      { name: 'Halloween', date: new Date(2026, 9, 31), country: 'US', demandMultiplier: 1.2, affectsNextDay: false },
      { name: 'Veterans Day', date: new Date(2026, 10, 11), country: 'US', demandMultiplier: 0.9, affectsNextDay: false },
      { name: 'Thanksgiving', date: new Date(2026, 10, 26), country: 'US', demandMultiplier: 1.3, affectsNextDay: true },
      { name: 'Black Friday', date: new Date(2026, 10, 27), country: 'US', demandMultiplier: 1.8, affectsNextDay: true },
      { name: 'Cyber Monday', date: new Date(2026, 10, 30), country: 'US', demandMultiplier: 1.5, affectsNextDay: false },
      { name: 'Christmas Eve', date: new Date(2026, 11, 24), country: 'US', demandMultiplier: 1.4, affectsNextDay: false },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), country: 'US', demandMultiplier: 0.4, affectsNextDay: true },
      { name: "New Year's Eve", date: new Date(2026, 11, 31), country: 'US', demandMultiplier: 0.7, affectsNextDay: false },
    ];

    // UK Holidays
    const ukHolidays: Holiday[] = [
      { name: "New Year's Day", date: new Date(2026, 0, 1), country: 'UK', demandMultiplier: 0.5, affectsNextDay: true },
      { name: 'Good Friday', date: new Date(2026, 3, 3), country: 'UK', demandMultiplier: 1.1, affectsNextDay: true },
      { name: 'Easter Monday', date: new Date(2026, 3, 6), country: 'UK', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Early May Bank Holiday', date: new Date(2026, 4, 4), country: 'UK', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Spring Bank Holiday', date: new Date(2026, 4, 25), country: 'UK', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Summer Bank Holiday', date: new Date(2026, 7, 31), country: 'UK', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), country: 'UK', demandMultiplier: 0.4, affectsNextDay: true },
      { name: 'Boxing Day', date: new Date(2026, 11, 26), country: 'UK', demandMultiplier: 0.5, affectsNextDay: false },
    ];

    // Canada Holidays
    const caHolidays: Holiday[] = [
      { name: "New Year's Day", date: new Date(2026, 0, 1), country: 'CA', demandMultiplier: 0.5, affectsNextDay: true },
      { name: 'Family Day', date: new Date(2026, 1, 16), country: 'CA', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Good Friday', date: new Date(2026, 3, 3), country: 'CA', demandMultiplier: 1.1, affectsNextDay: true },
      { name: 'Victoria Day', date: new Date(2026, 4, 18), country: 'CA', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Canada Day', date: new Date(2026, 6, 1), country: 'CA', demandMultiplier: 0.6, affectsNextDay: true },
      { name: 'Labour Day', date: new Date(2026, 8, 7), country: 'CA', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'National Day for Truth and Reconciliation', date: new Date(2026, 8, 30), country: 'CA', demandMultiplier: 1.0, affectsNextDay: false },
      { name: 'Thanksgiving', date: new Date(2026, 9, 12), country: 'CA', demandMultiplier: 1.2, affectsNextDay: true },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), country: 'CA', demandMultiplier: 0.4, affectsNextDay: true },
      { name: 'Boxing Day', date: new Date(2026, 11, 26), country: 'CA', demandMultiplier: 0.7, affectsNextDay: false },
    ];

    // Australia Holidays
    const auHolidays: Holiday[] = [
      { name: "New Year's Day", date: new Date(2026, 0, 1), country: 'AU', demandMultiplier: 0.5, affectsNextDay: true },
      { name: 'Australia Day', date: new Date(2026, 0, 26), country: 'AU', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Good Friday', date: new Date(2026, 3, 3), country: 'AU', demandMultiplier: 1.1, affectsNextDay: true },
      { name: 'Easter Monday', date: new Date(2026, 3, 6), country: 'AU', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Anzac Day', date: new Date(2026, 3, 25), country: 'AU', demandMultiplier: 0.9, affectsNextDay: false },
      { name: 'Queen\'s Birthday', date: new Date(2026, 5, 8), country: 'AU', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), country: 'AU', demandMultiplier: 0.4, affectsNextDay: true },
      { name: 'Boxing Day', date: new Date(2026, 11, 26), country: 'AU', demandMultiplier: 0.5, affectsNextDay: false },
    ];

    // India Holidays
    const inHolidays: Holiday[] = [
      { name: "Republic Day", date: new Date(2026, 0, 26), country: 'IN', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Holi', date: new Date(2026, 2, 15), country: 'IN', demandMultiplier: 1.2, affectsNextDay: true },
      { name: 'Good Friday', date: new Date(2026, 3, 3), country: 'IN', demandMultiplier: 1.0, affectsNextDay: false },
      { name: 'Diwali', date: new Date(2026, 10, 30), country: 'IN', demandMultiplier: 1.5, affectsNextDay: true },
      { name: 'Independence Day', date: new Date(2026, 7, 15), country: 'IN', demandMultiplier: 0.9, affectsNextDay: false },
      { name: 'Gandhi Jayanti', date: new Date(2026, 9, 2), country: 'IN', demandMultiplier: 0.8, affectsNextDay: false },
      { name: 'Christmas Day', date: new Date(2026, 11, 25), country: 'IN', demandMultiplier: 1.0, affectsNextDay: false },
    ];

    this.holidays.set('US', usHolidays);
    this.holidays.set('UK', ukHolidays);
    this.holidays.set('CA', caHolidays);
    this.holidays.set('AU', auHolidays);
    this.holidays.set('IN', inHolidays);
  }

  /**
   * Convert date to string key (YYYY-MM-DD)
   */
  private dateToKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
