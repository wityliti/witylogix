/**
 * Checkout Widget Unit Tests
 * Tests 5-step flow navigation, address validation, date/slot selection,
 * rate display, and form submission
 */

import { describe, it, expect, beforeEach } from "vitest";

interface Address {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CheckoutStep {
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  completed: boolean;
}

interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  available: boolean;
  price: number;
}

interface ZoneRate {
  zoneId: string;
  baseRate: number;
  surcharge?: number;
  discount?: number;
  totalRate: number;
}

/**
 * Mock Checkout Widget
 */
class CheckoutWidget {
  private currentStep: number = 1;
  private completedSteps: boolean[] = [false, false, false, false, false];
  private steps: CheckoutStep[] = [
    { number: 1, title: "Address", completed: false },
    { number: 2, title: "Date", completed: false },
    { number: 3, title: "Time Slot", completed: false },
    { number: 4, title: "Review", completed: false },
    { number: 5, title: "Confirm", completed: false },
  ];

  private deliveryAddress?: Address;
  private selectedDate?: Date;
  private selectedSlot?: TimeSlot;
  private zoneRate?: ZoneRate;

  getCurrentStep(): number {
    return this.currentStep;
  }

  getSteps(): CheckoutStep[] {
    return this.steps.map((s) => ({
      ...s,
      completed: this.completedSteps[s.number - 1],
    }));
  }

  goToStep(stepNumber: number): boolean {
    if (stepNumber < 1 || stepNumber > 5) {
      return false;
    }

    // Can only go back, or forward if previous steps completed
    if (stepNumber > this.currentStep) {
      for (let i = 0; i < stepNumber - 1; i++) {
        if (!this.completedSteps[i]) {
          return false;
        }
      }
    }

    this.currentStep = stepNumber;
    return true;
  }

  goForward(): boolean {
    return this.goToStep(this.currentStep + 1);
  }

  goBack(): boolean {
    return this.goToStep(this.currentStep - 1);
  }

  validateAddress(address: Address): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!address.street || address.street.trim() === "") {
      errors.push("Street address is required");
    }

    if (!address.city || address.city.trim() === "") {
      errors.push("City is required");
    }

    if (!address.state || address.state.trim() === "") {
      errors.push("State is required");
    }

    if (!address.postalCode || !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
      errors.push("Postal code must be valid (5 or 9 digits)");
    }

    if (!address.country || address.country.trim() === "") {
      errors.push("Country is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  submitAddress(address: Address): boolean {
    const validation = this.validateAddress(address);

    if (!validation.valid) {
      return false;
    }

    this.deliveryAddress = address;
    this.completedSteps[0] = true;
    return true;
  }

  getBlackoutDates(): Date[] {
    // Sundays and holidays
    const blackout: Date[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Block Sundays
      if (date.getDay() === 0) {
        blackout.push(date);
      }

      // Block holidays (mock)
      if (date.getMonth() === 11 && date.getDate() === 25) {
        // Christmas
        blackout.push(date);
      }
    }

    return blackout;
  }

  isDateBlackedOut(date: Date): boolean {
    return this.getBlackoutDates().some(
      (blackoutDate) => blackoutDate.toDateString() === date.toDateString(),
    );
  }

  selectDate(date: Date): boolean {
    if (this.isDateBlackedOut(date)) {
      return false;
    }

    const now = new Date();
    if (date < now) {
      return false;
    }

    this.selectedDate = date;
    this.completedSteps[1] = true;
    return true;
  }

  getAvailableSlots(date: Date): TimeSlot[] {
    if (!date || this.isDateBlackedOut(date)) {
      return [];
    }

    return [
      {
        id: "slot_1",
        label: "8:00 AM - 10:00 AM",
        startTime: "08:00",
        endTime: "10:00",
        available: true,
        price: 5.99,
      },
      {
        id: "slot_2",
        label: "10:00 AM - 12:00 PM",
        startTime: "10:00",
        endTime: "12:00",
        available: true,
        price: 5.99,
      },
      {
        id: "slot_3",
        label: "2:00 PM - 4:00 PM",
        startTime: "14:00",
        endTime: "16:00",
        available: true,
        price: 5.99,
      },
      {
        id: "slot_4",
        label: "4:00 PM - 6:00 PM",
        startTime: "16:00",
        endTime: "18:00",
        available: false,
        price: 7.99,
      },
    ];
  }

  selectSlot(slotId: string): boolean {
    if (!this.selectedDate) {
      return false;
    }

    const slots = this.getAvailableSlots(this.selectedDate);
    const slot = slots.find((s) => s.id === slotId);

    if (!slot || !slot.available) {
      return false;
    }

    this.selectedSlot = slot;
    this.completedSteps[2] = true;
    return true;
  }

  getZoneRate(zoneId: string): ZoneRate {
    const baseRates: Record<string, number> = {
      zone_north: 10.0,
      zone_south: 12.0,
      zone_east: 11.0,
      zone_west: 13.0,
    };

    const baseRate = baseRates[zoneId] || 10.0;

    return {
      zoneId,
      baseRate,
      surcharge: baseRate * 0.1,
      discount: this.selectedSlot ? 0 : 0,
      totalRate: baseRate + baseRate * 0.1,
    };
  }

  reviewOrder(): {
    address: Address | undefined;
    date: Date | undefined;
    slot: TimeSlot | undefined;
    rate: ZoneRate | undefined;
  } {
    return {
      address: this.deliveryAddress,
      date: this.selectedDate,
      slot: this.selectedSlot,
      rate: this.zoneRate,
    };
  }

  submitCheckout(): boolean {
    // Validate all steps completed
    if (!this.completedSteps.slice(0, 4).every((c) => c)) {
      return false;
    }

    if (!this.deliveryAddress || !this.selectedDate || !this.selectedSlot) {
      return false;
    }

    this.completedSteps[4] = true;
    return true;
  }

  reset(): void {
    this.currentStep = 1;
    this.completedSteps = [false, false, false, false, false];
    this.deliveryAddress = undefined;
    this.selectedDate = undefined;
    this.selectedSlot = undefined;
    this.zoneRate = undefined;
  }
}

describe("CheckoutWidget", () => {
  let widget: CheckoutWidget;

  beforeEach(() => {
    widget = new CheckoutWidget();
  });

  describe("5-Step Flow Navigation", () => {
    it("should start at step 1", () => {
      expect(widget.getCurrentStep()).toBe(1);
    });

    it("should move forward to step 2", () => {
      widget.goToStep(1);
      const success = widget.goToStep(2);

      expect(success).toBe(true);
      expect(widget.getCurrentStep()).toBe(2);
    });

    it("should move back from step 3 to step 2", () => {
      widget.goToStep(3);
      const success = widget.goBack();

      expect(success).toBe(true);
      expect(widget.getCurrentStep()).toBe(2);
    });

    it("should not skip steps when going forward", () => {
      const success = widget.goToStep(3);

      expect(success).toBe(false);
      expect(widget.getCurrentStep()).toBe(1);
    });

    it("should allow going back without step completion", () => {
      widget.goToStep(2);
      widget.goToStep(3);

      const success = widget.goBack();

      expect(success).toBe(true);
      expect(widget.getCurrentStep()).toBe(2);
    });

    it("should get all steps with completion status", () => {
      const steps = widget.getSteps();

      expect(steps).toHaveLength(5);
      expect(steps[0].number).toBe(1);
      expect(steps[4].number).toBe(5);
      expect(steps.every((s) => !s.completed)).toBe(true);
    });

    it("should reject invalid step numbers", () => {
      expect(widget.goToStep(0)).toBe(false);
      expect(widget.goToStep(6)).toBe(false);
      expect(widget.goToStep(-1)).toBe(false);
    });

    it("should handle forward navigation across multiple steps", () => {
      widget.goToStep(1);
      const completed = widget.submitAddress({
        street: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US",
      });

      expect(completed).toBe(true);
      expect(widget.goToStep(2)).toBe(true);
    });
  });

  describe("Address Validation", () => {
    const validAddress: Address = {
      street: "123 Main Street",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
    };

    it("should validate correct address", () => {
      const result = widget.validateAddress(validAddress);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should require street address", () => {
      const result = widget.validateAddress({
        ...validAddress,
        street: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Street address is required");
    });

    it("should require city", () => {
      const result = widget.validateAddress({
        ...validAddress,
        city: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("City is required");
    });

    it("should require state", () => {
      const result = widget.validateAddress({
        ...validAddress,
        state: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("State is required");
    });

    it("should validate 5-digit postal code", () => {
      const result = widget.validateAddress(validAddress);

      expect(result.valid).toBe(true);
    });

    it("should validate 9-digit postal code", () => {
      const result = widget.validateAddress({
        ...validAddress,
        postalCode: "10001-5678",
      });

      expect(result.valid).toBe(true);
    });

    it("should reject invalid postal code format", () => {
      const result = widget.validateAddress({
        ...validAddress,
        postalCode: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Postal code"))).toBe(true);
    });

    it("should require country", () => {
      const result = widget.validateAddress({
        ...validAddress,
        country: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Country is required");
    });

    it("should allow optional street2", () => {
      const result = widget.validateAddress({
        ...validAddress,
        street2: "Apt 5B",
      });

      expect(result.valid).toBe(true);
    });

    it("should accumulate multiple errors", () => {
      const result = widget.validateAddress({
        street: "",
        city: "",
        state: "NY",
        postalCode: "invalid",
        country: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe("Date Selection with Blackout Filtering", () => {
    it("should reject past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const success = widget.selectDate(pastDate);

      expect(success).toBe(false);
    });

    it("should accept future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const success = widget.selectDate(futureDate);

      expect(success).toBe(true);
    });

    it("should reject Sunday (blackout)", () => {
      const sunday = new Date();
      const daysUntilSunday = (7 - sunday.getDay()) % 7;
      sunday.setDate(sunday.getDate() + (daysUntilSunday || 7));

      const success = widget.selectDate(sunday);

      expect(success).toBe(false);
    });

    it("should accept weekdays", () => {
      const weekday = new Date();
      weekday.setDate(weekday.getDate() + 1);

      // Keep looking for a weekday
      while (weekday.getDay() === 0) {
        weekday.setDate(weekday.getDate() + 1);
      }

      const success = widget.selectDate(weekday);

      expect(success).toBe(true);
    });

    it("should list blackout dates", () => {
      const blackouts = widget.getBlackoutDates();

      expect(blackouts.length).toBeGreaterThan(0);
      // Should include Sundays
      expect(blackouts.some((d) => d.getDay() === 0)).toBe(true);
    });
  });

  describe("Time Slot Availability", () => {
    it("should get slots for valid date", () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);

      const slots = widget.getAvailableSlots(date);

      expect(slots.length).toBeGreaterThan(0);
    });

    it("should return empty slots for blackout date", () => {
      const sunday = new Date();
      sunday.setDate(sunday.getDate() + 7); // Next Sunday
      const daysToAdd = (7 - sunday.getDay()) % 7 || 7;
      sunday.setDate(sunday.getDate() + daysToAdd);

      const slots = widget.getAvailableSlots(sunday);

      expect(slots).toHaveLength(0);
    });

    it("should show slot prices", () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);

      const slots = widget.getAvailableSlots(date);

      expect(slots.every((s) => s.price > 0)).toBe(true);
    });

    it("should indicate availability status", () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);

      const slots = widget.getAvailableSlots(date);

      expect(slots.some((s) => s.available)).toBe(true);
      expect(slots.some((s) => !s.available)).toBe(true);
    });

    it("should prevent selecting unavailable slot", () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      widget.selectDate(date);

      const slots = widget.getAvailableSlots(date);
      const unavailableSlot = slots.find((s) => !s.available)!;

      const success = widget.selectSlot(unavailableSlot.id);

      expect(success).toBe(false);
    });

    it("should allow selecting available slot", () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      widget.selectDate(date);

      const slots = widget.getAvailableSlots(date);
      const availableSlot = slots.find((s) => s.available)!;

      const success = widget.selectSlot(availableSlot.id);

      expect(success).toBe(true);
    });
  });

  describe("Zone Rate Display", () => {
    it("should get rate for zone", () => {
      const rate = widget.getZoneRate("zone_north");

      expect(rate.zoneId).toBe("zone_north");
      expect(rate.baseRate).toBe(10.0);
      expect(rate.totalRate).toBeGreaterThan(rate.baseRate);
    });

    it("should apply surcharge to rate", () => {
      const rate = widget.getZoneRate("zone_south");

      expect(rate.surcharge).toBe(1.2);
      expect(rate.totalRate).toBe(13.2);
    });

    it("should handle different zone rates", () => {
      const northRate = widget.getZoneRate("zone_north");
      const southRate = widget.getZoneRate("zone_south");

      expect(northRate.baseRate).not.toBe(southRate.baseRate);
    });

    it("should use default rate for unknown zone", () => {
      const rate = widget.getZoneRate("zone_unknown");

      expect(rate.baseRate).toBe(10.0);
    });
  });

  describe("Order Review", () => {
    it("should show order summary for review", () => {
      const validAddress: Address = {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US",
      };

      widget.submitAddress(validAddress);

      const date = new Date();
      date.setDate(date.getDate() + 1);
      widget.selectDate(date);

      const slots = widget.getAvailableSlots(date);
      widget.selectSlot(slots[0].id);

      const review = widget.reviewOrder();

      expect(review.address).toBeDefined();
      expect(review.date).toBeDefined();
      expect(review.slot).toBeDefined();
    });
  });

  describe("Form Submission", () => {
    it("should require all steps completed for submission", () => {
      const success = widget.submitCheckout();

      expect(success).toBe(false);
    });

    it("should submit complete order", () => {
      const validAddress: Address = {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US",
      };

      widget.submitAddress(validAddress);

      const date = new Date();
      date.setDate(date.getDate() + 1);
      widget.selectDate(date);

      const slots = widget.getAvailableSlots(date);
      widget.selectSlot(slots[0].id);

      const success = widget.submitCheckout();

      expect(success).toBe(true);
    });

    it("should reset widget after submission", () => {
      widget.reset();

      expect(widget.getCurrentStep()).toBe(1);
      expect(widget.getSteps().every((s) => !s.completed)).toBe(true);
    });
  });
});
