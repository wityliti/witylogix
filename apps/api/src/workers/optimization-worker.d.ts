/**
 * Route Optimization Worker — dispatches to the routing provider.
 *
 * Phase 1: Uses Distance Matrix + nearest-neighbor heuristic
 * Phase 2: Will dispatch to OR-Tools VRP solver microservice
 *
 * Multi-provider support:
 *   When ROUTING_BYOK=true, the worker reads the tenant's chosen provider
 *   and credentials from shop.settings.routing. If the tenant hasn't
 *   configured anything, falls back to the deployer's default provider
 *   and metering kicks in automatically.
 *
 * Flow:
 *   1. Fetch order locations from PostGIS
 *   2. Resolve routing provider (tenant choice → deployer fallback + metering)
 *   3. Build distance matrix via routing provider
 *   4. Apply optimization (heuristic now, OR-Tools later)
 *   5. Update route with optimized stop sequence and ETAs
 */
import { Worker } from "bullmq";
export declare function startOptimizationWorker(): Worker;
//# sourceMappingURL=optimization-worker.d.ts.map
