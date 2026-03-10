/**
 * @witylogix/core/slots — Slot Engine & Capacity Management package
 * Complete export of all slot management modules and types
 */

// Types
export * from "./types.js";

// Core modules
export { SlotEngine } from "./slot-engine.js";
export { CapacityManager } from "./capacity-manager.js";
export { ZoneRateCalculator } from "./zone-rate-calculator.js";
export { DeadlineEngine } from "./deadline-engine.js";
export { BlackoutManager } from "./blackout-manager.js";

// Factory function for initialization
export function initializeSlotEngines(db: any) {
  return {
    slotEngine: new SlotEngine(db),
    capacityManager: new CapacityManager(db),
    zoneRateCalculator: new ZoneRateCalculator(db),
    deadlineEngine: new DeadlineEngine(db),
    blackoutManager: new BlackoutManager(db),
  };
}
