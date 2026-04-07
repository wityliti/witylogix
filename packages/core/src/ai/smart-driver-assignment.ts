/**
 * Smart Driver Assignment Engine
 *
 * Intelligently assigns drivers to deliveries with:
 * - Score drivers for a delivery: proximity (40%), capacity (25%), shift hours remaining (20%), rating (15%)
 * - Proximity: haversine distance from driver's current position to pickup
 * - Capacity: remaining weight/volume vs order requirements
 * - Shift hours: prefer drivers with more time remaining
 * - Rating: prefer higher-rated drivers for premium orders
 * - Multi-order batching: group nearby orders for same driver
 * - Constraints: don't exceed max deliveries per shift, respect driver zones
 * - Returns: ranked list of eligible drivers with scores and reasons
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Order {
  id: string;
  pickupLocation: Coordinate;
  deliveryLocation: Coordinate;
  weight?: number;
  volume?: number;
  estimatedDuration: number; // minutes
  priority?: number; // 1-5, higher = more important
  isPremium?: boolean; // high-value orders prefer higher-rated drivers
  requiredZone?: string; // optional zone restriction
}

export interface Driver {
  id: string;
  currentLocation: Coordinate;
  shiftStartTime: Date;
  shiftEndTime: Date;
  capacity: {
    weight: number; // kg max
    volume: number; // m³ max
  };
  usedCapacity: {
    weight: number; // kg currently used
    volume: number; // m³ currently used
  };
  completedDeliveries: number;
  maxDeliveriesPerShift: number;
  rating?: number; // 0-5
  serviceZones?: string[]; // optional zone restrictions
  workingHoursRemaining: number; // minutes
}

export interface DriverScore {
  driverId: string;
  overallScore: number; // 0-100
  proximityScore: number; // 0-100 (40% weight)
  capacityScore: number; // 0-100 (25% weight)
  shiftHourScore: number; // 0-100 (20% weight)
  ratingScore: number; // 0-100 (15% weight)
  reasons: string[];
  isEligible: boolean;
  violatedConstraints: string[];
}

export interface AssignmentResult {
  driverId: string;
  orderIds: string[];
  score: number;
  estimatedPickupTime: Date;
  estimatedDeliveryTime: Date;
  routeDistance: number;
}

export interface BatchAssignmentResult {
  assignments: AssignmentResult[];
  unassignedOrders: Order[];
  totalScore: number;
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────

/**
 * Calculate haversine distance between two coordinates in kilometers
 */
function calculateDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371;
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
 * Estimate travel time in minutes
 */
function estimateTravelTime(distanceKm: number): number {
  const baseSpeedKmH = 50;
  return (distanceKm / baseSpeedKmH) * 60; // minutes
}

// ─── SMART DRIVER ASSIGNMENT ENGINE ────────────────────────────────────────

export class SmartDriverAssignment {
  private drivers: Driver[] = [];
  private orders: Order[] = [];

  /**
   * Add drivers for assignment consideration
   */
  public addDrivers(drivers: Driver[]): void {
    this.drivers = [...this.drivers, ...drivers];
  }

  /**
   * Add orders for assignment
   */
  public addOrders(orders: Order[]): void {
    this.orders = [...this.orders, ...orders];
  }

  /**
   * Calculate proximity score (40% weight)
   */
  private calculateProximityScore(
    driver: Driver,
    order: Order
  ): { score: number; distance: number } {
    const distance = calculateDistance(driver.currentLocation, order.pickupLocation);

    // Score: 100 at 0km, declining to 0 at 50km
    const score = Math.max(0, 100 - (distance / 50) * 100);

    return {
      score: Math.round(score),
      distance,
    };
  }

  /**
   * Calculate capacity score (25% weight)
   */
  private calculateCapacityScore(
    driver: Driver,
    order: Order
  ): { score: number; canFit: boolean } {
    const remainingWeight = driver.capacity.weight - driver.usedCapacity.weight;
    const remainingVolume = driver.capacity.volume - driver.usedCapacity.volume;

    const orderWeight = order.weight || 0;
    const orderVolume = order.volume || 0;

    const canFit = remainingWeight >= orderWeight && remainingVolume >= orderVolume;

    if (!canFit) {
      return { score: 0, canFit: false };
    }

    // Score based on how much space is available after assignment
    const weightUtilization =
      (driver.usedCapacity.weight + orderWeight) / driver.capacity.weight;
    const volumeUtilization =
      (driver.usedCapacity.volume + orderVolume) / driver.capacity.volume;

    const avgUtilization = (weightUtilization + volumeUtilization) / 2;

    // Prefer drivers with more remaining capacity
    // Score is inversely proportional to utilization after the new order
    const score = Math.max(0, (1 - avgUtilization) * 100);

    return {
      score: Math.round(Math.min(100, score)),
      canFit: true,
    };
  }

  /**
   * Calculate shift hours score (20% weight)
   */
  private calculateShiftHourScore(driver: Driver): {
    score: number;
    hoursRemaining: number;
  } {
    const hoursRemaining = driver.workingHoursRemaining;

    // Score based on hours available (100 at 8+ hours, declining)
    const score = Math.max(0, (hoursRemaining / 480) * 100); // 480 minutes = 8 hours

    return {
      score: Math.round(Math.min(100, score)),
      hoursRemaining,
    };
  }

  /**
   * Calculate rating score (15% weight)
   */
  private calculateRatingScore(driver: Driver, order: Order): number {
    if (!driver.rating) {
      return 50; // neutral score if no rating
    }

    // Premium orders get extra boost for higher-rated drivers
    const baseScore = (driver.rating / 5) * 100;

    if (order.isPremium) {
      return Math.min(100, baseScore * 1.1);
    }

    return Math.round(baseScore);
  }

  /**
   * Check zone constraints
   */
  private checkZoneConstraint(driver: Driver, order: Order): boolean {
    if (!order.requiredZone) {
      return true; // no zone requirement
    }

    if (!driver.serviceZones || driver.serviceZones.length === 0) {
      return true; // driver can service any zone
    }

    return driver.serviceZones.includes(order.requiredZone);
  }

  /**
   * Score a driver for a specific order
   */
  public scoreDriver(driver: Driver, order: Order): DriverScore {
    const reasons: string[] = [];
    const violatedConstraints: string[] = [];
    let isEligible = true;

    // Check constraints
    if (driver.completedDeliveries >= driver.maxDeliveriesPerShift) {
      violatedConstraints.push(
        `Max deliveries per shift (${driver.maxDeliveriesPerShift}) reached`
      );
      isEligible = false;
    }

    if (driver.workingHoursRemaining < order.estimatedDuration) {
      violatedConstraints.push("Insufficient shift time remaining");
      isEligible = false;
    }

    if (!this.checkZoneConstraint(driver, order)) {
      violatedConstraints.push(`Order zone ${order.requiredZone} not in driver zones`);
      isEligible = false;
    }

    // Calculate component scores
    const { score: proximityScore, distance } = this.calculateProximityScore(
      driver,
      order
    );
    reasons.push(`${proximityScore}% proximity (${distance.toFixed(1)} km away)`);

    const { score: capacityScore, canFit } = this.calculateCapacityScore(
      driver,
      order
    );

    if (canFit) {
      reasons.push(`${capacityScore}% capacity fit`);
    } else {
      reasons.push("Insufficient capacity");
      violatedConstraints.push("Insufficient capacity for order weight/volume");
      isEligible = false;
    }

    const { score: shiftHourScore, hoursRemaining } = this.calculateShiftHourScore(driver);
    reasons.push(`${shiftHourScore}% shift hours (${hoursRemaining} min remaining)`);

    const ratingScore = this.calculateRatingScore(driver, order);
    if (driver.rating) {
      reasons.push(`${ratingScore}% rating (${driver.rating}/5)`);
    }

    // Calculate weighted overall score
    const overallScore =
      proximityScore * 0.4 +
      capacityScore * 0.25 +
      shiftHourScore * 0.2 +
      ratingScore * 0.15;

    return {
      driverId: driver.id,
      overallScore: Math.round(overallScore),
      proximityScore,
      capacityScore,
      shiftHourScore,
      ratingScore,
      reasons,
      isEligible,
      violatedConstraints,
    };
  }

  /**
   * Get ranked list of eligible drivers for an order
   */
  public rankDriversForOrder(order: Order): DriverScore[] {
    const scores = this.drivers
      .map((driver) => this.scoreDriver(driver, order))
      .sort((a, b) => b.overallScore - a.overallScore);

    return scores;
  }

  /**
   * Assign a single order to the best available driver
   */
  public assignOrder(order: Order): AssignmentResult | null {
    const rankedDrivers = this.rankDriversForOrder(order);
    const eligible = rankedDrivers.find((s) => s.isEligible);

    if (!eligible) {
      return null;
    }

    const driver = this.drivers.find((d) => d.id === eligible.driverId)!;
    const travelTime = estimateTravelTime(
      calculateDistance(driver.currentLocation, order.pickupLocation)
    );
    const pickupTime = new Date(Date.now() + travelTime * 60000);
    const deliveryTime = new Date(
      pickupTime.getTime() + order.estimatedDuration * 60000
    );

    const distance = calculateDistance(
      driver.currentLocation,
      order.deliveryLocation
    );

    return {
      driverId: driver.id,
      orderIds: [order.id],
      score: eligible.overallScore,
      estimatedPickupTime: pickupTime,
      estimatedDeliveryTime: deliveryTime,
      routeDistance: distance,
    };
  }

  /**
   * Batch assign multiple orders with intelligent grouping
   */
  public batchAssignOrders(): BatchAssignmentResult {
    const assignments: AssignmentResult[] = [];
    const unassignedOrders: Order[] = [];
    let totalScore = 0;

    // Sort orders by priority and distance from nearest driver
    const sortedOrders = [...this.orders].sort((a, b) => {
      const aPriority = a.priority || 1;
      const bPriority = b.priority || 1;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // higher priority first
      }

      // If same priority, sort by distance to nearest driver
      const nearestDistA = Math.min(
        ...this.drivers.map((d) =>
          calculateDistance(d.currentLocation, a.pickupLocation)
        )
      );
      const nearestDistB = Math.min(
        ...this.drivers.map((d) =>
          calculateDistance(d.currentLocation, b.pickupLocation)
        )
      );

      return nearestDistA - nearestDistB;
    });

    // Try to assign each order
    for (const order of sortedOrders) {
      const assignment = this.assignOrder(order);

      if (assignment) {
        assignments.push(assignment);
        totalScore += assignment.score;

        // Update driver state
        const driver = this.drivers.find((d) => d.id === assignment.driverId);
        if (driver) {
          driver.usedCapacity.weight += order.weight || 0;
          driver.usedCapacity.volume += order.volume || 0;
          driver.completedDeliveries++;
          driver.workingHoursRemaining -= order.estimatedDuration / 60;
        }
      } else {
        unassignedOrders.push(order);
      }
    }

    return {
      assignments,
      unassignedOrders,
      totalScore: Math.round(totalScore / Math.max(1, assignments.length)),
    };
  }

  /**
   * Find nearby orders that can be batched with a given order
   */
  public findNearbyOrders(
    order: Order,
    radiusKm: number = 5
  ): { orders: Order[]; distances: number[] } {
    const nearby: Order[] = [];
    const distances: number[] = [];

    for (const otherOrder of this.orders) {
      if (otherOrder.id === order.id) continue;

      const distance = calculateDistance(
        order.deliveryLocation,
        otherOrder.deliveryLocation
      );

      if (distance <= radiusKm) {
        nearby.push(otherOrder);
        distances.push(distance);
      }
    }

    // Sort by distance
    const sorted = nearby
      .map((o, i) => ({ order: o, distance: distances[i] }))
      .sort((a, b) => a.distance - b.distance);

    return {
      orders: sorted.map((s) => s.order),
      distances: sorted.map((s) => s.distance),
    };
  }

  /**
   * Get driver utilization statistics
   */
  public getDriverUtilization(): Record<string, Record<string, number>> {
    const utilization: Record<string, Record<string, number>> = {};

    for (const driver of this.drivers) {
      const weightUtil =
        (driver.usedCapacity.weight / driver.capacity.weight) * 100;
      const volumeUtil =
        (driver.usedCapacity.volume / driver.capacity.volume) * 100;
      const deliveryUtil =
        (driver.completedDeliveries / driver.maxDeliveriesPerShift) * 100;
      const timeUtil =
        ((480 - driver.workingHoursRemaining) / 480) * 100; // 480 min = 8 hours

      utilization[driver.id] = {
        weight: Math.round(weightUtil),
        volume: Math.round(volumeUtil),
        deliveries: Math.round(deliveryUtil),
        time: Math.round(timeUtil),
      };
    }

    return utilization;
  }

  /**
   * Reset assignment state
   */
  public reset(): void {
    this.drivers = [];
    this.orders = [];
  }
}

/**
 * Create assignment engine instance
 */
export function createSmartDriverAssignment(): SmartDriverAssignment {
  return new SmartDriverAssignment();
}
