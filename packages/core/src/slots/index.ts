/**
 * @witylogix/core/slots — Slot Engine & Capacity Management package
 * Complete export of all slot management modules and types
 */

// Types
export * from "./types.js";

// Core modules
import { SlotEngine } from "./slot-engine.js";
import { CapacityManager } from "./capacity-manager.js";
import { ZoneRateCalculator } from "./zone-rate-calculator.js";
import { DeadlineEngine } from "./deadline-engine.js";
import { BlackoutManager } from "./blackout-manager.js";

export { SlotEngine, CapacityManager, ZoneRateCalculator, DeadlineEngine, BlackoutManager };

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
