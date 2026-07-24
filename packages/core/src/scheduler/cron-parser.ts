/**
 * Cron expression parser - parse standard 5-field cron expressions.
 *
 * Supports:
 * - Wildcard: * (any value)
 * - Ranges: 1-5 (inclusive)
 * - Lists: 1,3,5 (specific values)
 * - Step notation: every nth value (e.g. every 5 minutes, 1-10 every 2)
 *
 * Format: minute hour dayOfMonth month dayOfWeek
 * Example: "0 9 * * 1-5" = 9:00 AM on weekdays
 *
 * Field ranges:
 * - minute: 0-59
 * - hour: 0-23
 * - dayOfMonth: 1-31
 * - month: 1-12
 * - dayOfWeek: 0-6 (0=Sunday)
 */

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  if (field === "*") {
    for (let i = min; i <= max; i++) {
      values.add(i);
    }
    return values;
  }

  for (const part of field.split(",")) {
    const trimmed = part.trim();

    if (trimmed.includes("/")) {
      const [range, stepStr] = trimmed.split("/");
      const step = parseInt(stepStr, 10);

      if (range === "*") {
        for (let i = min; i <= max; i += step) {
          values.add(i);
        }
      } else if (range.includes("-")) {
        const [startStr, endStr] = range.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let i = start; i <= end; i += step) {
          if (i >= min && i <= max) {
            values.add(i);
          }
        }
      } else {
        const val = parseInt(range, 10);
        if (val >= min && val <= max) {
          values.add(val);
        }
      }
    } else if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) {
          values.add(i);
        }
      }
    } else {
      const val = parseInt(trimmed, 10);
      if (val >= min && val <= max) {
        values.add(val);
      }
    }
  }

  return values;
}

export function parseCronExpression(expression: string) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length}. Format: minute hour day month weekday`,
    );
  }

  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6),
  };
}

export function matches(expression: string, date: Date = new Date()): boolean {
  try {
    const parsed = parseCronExpression(expression);

    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    return (
      parsed.minutes.has(minute) &&
      parsed.hours.has(hour) &&
      parsed.daysOfMonth.has(day) &&
      parsed.months.has(month) &&
      parsed.daysOfWeek.has(dayOfWeek)
    );
  } catch {
    return false;
  }
}

export function getNextRun(
  expression: string,
  fromDate: Date = new Date(),
): Date {
  try {
    const parsed = parseCronExpression(expression);

    let current = new Date(fromDate);
    current.setSeconds(0);
    current.setMilliseconds(0);
    current.setMinutes(current.getMinutes() + 1);

    const maxDate = new Date(fromDate);
    maxDate.setFullYear(maxDate.getFullYear() + 4);

    while (current < maxDate) {
      const minute = current.getMinutes();
      const hour = current.getHours();
      const day = current.getDate();
      const month = current.getMonth() + 1;
      const dayOfWeek = current.getDay();

      if (
        parsed.minutes.has(minute) &&
        parsed.hours.has(hour) &&
        parsed.months.has(month) &&
        (parsed.daysOfMonth.has(day) || parsed.daysOfWeek.has(dayOfWeek))
      ) {
        return current;
      }

      current.setMinutes(current.getMinutes() + 1);
    }

    throw new Error(
      `No next run found within 4 years for expression: ${expression}`,
    );
  } catch (error) {
    throw new Error(
      `Failed to calculate next run for cron expression "${expression}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getMatchingTimesOnDate(expression: string, date: Date): Date[] {
  try {
    const parsed = parseCronExpression(expression);

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    const matchingTimes: Date[] = [];

    const dayMatches =
      parsed.daysOfMonth.has(day) ||
      (parsed.daysOfMonth.has(1) && day === 1) ||
      parsed.daysOfWeek.has(dayOfWeek);

    if (!dayMatches || !parsed.months.has(month)) {
      return matchingTimes;
    }

    for (const hour of parsed.hours) {
      for (const minute of parsed.minutes) {
        const time = new Date(date);
        time.setHours(hour);
        time.setMinutes(minute);
        time.setSeconds(0);
        time.setMilliseconds(0);
        matchingTimes.push(time);
      }
    }

    return matchingTimes.sort((a, b) => a.getTime() - b.getTime());
  } catch {
    return [];
  }
}
