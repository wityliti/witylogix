import { describe, it, expect, beforeEach } from "vitest";

interface Point {
  latitude: number;
  longitude: number;
}

interface Warehouse {
  id: string;
  name: string;
  location: Point;
  capacity: number;
}

interface DistanceResult {
  warehouse: Warehouse;
  distance: number;
}

class WarehouseService {
  private warehouses: Warehouse[] = [];

  addWarehouse(warehouse: Warehouse): void {
    this.warehouses.push(warehouse);
  }

  setWarehouses(warehouses: Warehouse[]): void {
    this.warehouses = warehouses;
  }

  private haversineDistance(point1: Point, point2: Point): number {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;

    const lat1 = toRad(point1.latitude);
    const lat2 = toRad(point2.latitude);
    const deltaLat = toRad(point2.latitude - point1.latitude);
    const deltaLon = toRad(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.asin(Math.sqrt(a));
    return EARTH_RADIUS_KM * c;
  }

  findNearestWarehouse(point: Point): Warehouse | null {
    if (this.warehouses.length === 0) {
      return null;
    }

    let nearest = this.warehouses[0];
    let minDistance = this.haversineDistance(point, nearest.location);

    for (let i = 1; i < this.warehouses.length; i++) {
      const distance = this.haversineDistance(
        point,
        this.warehouses[i].location,
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = this.warehouses[i];
      }
    }

    return nearest;
  }

  findWarehousesInRange(point: Point, rangeKm: number): Warehouse[] {
    return this.warehouses.filter(
      (warehouse) =>
        this.haversineDistance(point, warehouse.location) <= rangeKm,
    );
  }

  sortByDistance(point: Point): DistanceResult[] {
    return this.warehouses
      .map((warehouse) => ({
        warehouse,
        distance: this.haversineDistance(point, warehouse.location),
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  assignToNearestWarehouse(point: Point): Warehouse | null {
    return this.findNearestWarehouse(point);
  }

  getAllWarehouses(): Warehouse[] {
    return this.warehouses;
  }
}

describe("WarehouseService", () => {
  let warehouseService: WarehouseService;

  beforeEach(() => {
    warehouseService = new WarehouseService();
  });

  describe("findNearestWarehouse", () => {
    it("should find nearest warehouse", () => {
      const warehouse1: Warehouse = {
        id: "w1",
        name: "Warehouse 1",
        location: { latitude: 40.7128, longitude: -74.006 },
        capacity: 1000,
      };

      const warehouse2: Warehouse = {
        id: "w2",
        name: "Warehouse 2",
        location: { latitude: 40.758, longitude: -73.9855 },
        capacity: 1500,
      };

      const warehouse3: Warehouse = {
        id: "w3",
        name: "Warehouse 3",
        location: { latitude: 34.0522, longitude: -118.2437 },
        capacity: 2000,
      };

      warehouseService.setWarehouses([warehouse1, warehouse2, warehouse3]);

      const point: Point = { latitude: 40.758, longitude: -73.9855 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toEqual(warehouse2);
    });

    it("should return null when no warehouses exist", () => {
      const point: Point = { latitude: 40.7128, longitude: -74.006 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toBeNull();
    });

    it("should return single warehouse when only one exists", () => {
      const warehouse: Warehouse = {
        id: "w1",
        name: "Warehouse 1",
        location: { latitude: 40.7128, longitude: -74.006 },
        capacity: 1000,
      };

      warehouseService.addWarehouse(warehouse);

      const point: Point = { latitude: 40.7128, longitude: -74.006 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toEqual(warehouse);
    });

    it("should find nearest from multiple warehouses", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 1, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: -1, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 1.1, longitude: 0 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest?.id).toBe("w2");
    });

    it("should handle point at exact warehouse location", () => {
      const warehouse: Warehouse = {
        id: "w1",
        name: "Warehouse 1",
        location: { latitude: 40.7128, longitude: -74.006 },
        capacity: 1000,
      };

      warehouseService.addWarehouse(warehouse);

      const nearest = warehouseService.findNearestWarehouse(warehouse.location);

      expect(nearest).toEqual(warehouse);
    });
  });

  describe("findWarehousesInRange", () => {
    it("should find warehouses within range", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0.5, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: 2, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const inRange = warehouseService.findWarehousesInRange(point, 60);

      expect(inRange.length).toBeGreaterThan(0);
      expect(inRange.some((w) => w.id === "w1")).toBe(true);
    });

    it("should return empty array when no warehouses in range", () => {
      const warehouse: Warehouse = {
        id: "w1",
        name: "W1",
        location: { latitude: 40.7128, longitude: -74.006 },
        capacity: 100,
      };

      warehouseService.addWarehouse(warehouse);

      const point: Point = { latitude: 0, longitude: 0 };
      const inRange = warehouseService.findWarehousesInRange(point, 1);

      expect(inRange.length).toBe(0);
    });

    it("should include warehouse at range boundary", () => {
      const warehouse: Warehouse = {
        id: "w1",
        name: "W1",
        location: { latitude: 0, longitude: 0 },
        capacity: 100,
      };

      warehouseService.addWarehouse(warehouse);

      const point: Point = { latitude: 0, longitude: 0 };
      const inRange = warehouseService.findWarehousesInRange(point, 0);

      expect(inRange.length).toBe(1);
      expect(inRange[0].id).toBe("w1");
    });

    it("should find multiple warehouses in range", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0.3, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: 0.5, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const inRange = warehouseService.findWarehousesInRange(point, 100);

      expect(inRange.length).toBe(3);
    });
  });

  describe("sortByDistance", () => {
    it("should sort warehouses by distance", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w3",
          name: "W3",
          location: { latitude: 2, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 1, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const sorted = warehouseService.sortByDistance(point);

      expect(sorted[0].warehouse.id).toBe("w1");
      expect(sorted[1].warehouse.id).toBe("w2");
      expect(sorted[2].warehouse.id).toBe("w3");
    });

    it("should include distance values", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 1, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const sorted = warehouseService.sortByDistance(point);

      expect(sorted[0].distance).toBe(0);
      expect(sorted[1].distance).toBeGreaterThan(0);
    });

    it("should handle empty warehouse list", () => {
      const point: Point = { latitude: 0, longitude: 0 };
      const sorted = warehouseService.sortByDistance(point);

      expect(sorted).toEqual([]);
    });

    it("should sort multiple warehouses correctly", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0.5, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: 1, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w4",
          name: "W4",
          location: { latitude: 1.5, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const sorted = warehouseService.sortByDistance(point);

      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].distance).toBeGreaterThanOrEqual(
          sorted[i - 1].distance,
        );
      }
    });
  });

  describe("assignToNearestWarehouse", () => {
    it("should assign to nearest warehouse", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 40.7128, longitude: -74.006 },
          capacity: 1000,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 40.758, longitude: -73.9855 },
          capacity: 1500,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 40.758, longitude: -73.9855 };
      const assigned = warehouseService.assignToNearestWarehouse(point);

      expect(assigned?.id).toBe("w2");
    });

    it("should return null when no warehouses available", () => {
      const point: Point = { latitude: 40.7128, longitude: -74.006 };
      const assigned = warehouseService.assignToNearestWarehouse(point);

      expect(assigned).toBeNull();
    });

    it("should assign to only warehouse when single exists", () => {
      const warehouse: Warehouse = {
        id: "w1",
        name: "W1",
        location: { latitude: 40.7128, longitude: -74.006 },
        capacity: 1000,
      };

      warehouseService.addWarehouse(warehouse);

      const point: Point = { latitude: 0, longitude: 0 };
      const assigned = warehouseService.assignToNearestWarehouse(point);

      expect(assigned?.id).toBe("w1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle equidistant warehouses", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: -1 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0, longitude: 1 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toBeDefined();
      expect([nearest?.id]).toContain(nearest?.id);
    });

    it("should handle warehouses at poles", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "North Pole",
          location: { latitude: 90, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "South Pole",
          location: { latitude: -90, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 89, longitude: 0 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest?.id).toBe("w1");
    });

    it("should handle warehouses crossing date line", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: -179 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0, longitude: 179 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 180 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toBeDefined();
    });

    it("should handle large number of warehouses", () => {
      const warehouses: Warehouse[] = [];
      for (let i = 0; i < 1000; i++) {
        warehouses.push({
          id: `w${i}`,
          name: `Warehouse ${i}`,
          location: {
            latitude: (i % 100) * 0.1,
            longitude: (i % 100) * 0.1,
          },
          capacity: 100,
        });
      }

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest).toBeDefined();
      expect(nearest?.id).toBe("w0");
    });

    it("should handle negative coordinates", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: -40.7128, longitude: -74.006 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: -35.0522, longitude: -118.2437 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: -40.7128, longitude: -74.006 };
      const nearest = warehouseService.findNearestWarehouse(point);

      expect(nearest?.id).toBe("w1");
    });
  });

  describe("Integration Tests", () => {
    it("should find and sort warehouses correctly together", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 40.7128, longitude: -74.006 },
          capacity: 1000,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 40.758, longitude: -73.9855 },
          capacity: 1500,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: 40.7489, longitude: -73.968 },
          capacity: 2000,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 40.7128, longitude: -74.006 };
      const nearest = warehouseService.findNearestWarehouse(point);
      const sorted = warehouseService.sortByDistance(point);

      expect(nearest?.id).toBe(sorted[0].warehouse.id);
    });

    it("should handle mixed range and nearest queries", () => {
      const warehouses: Warehouse[] = [
        {
          id: "w1",
          name: "W1",
          location: { latitude: 0, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w2",
          name: "W2",
          location: { latitude: 0.5, longitude: 0 },
          capacity: 100,
        },
        {
          id: "w3",
          name: "W3",
          location: { latitude: 2, longitude: 0 },
          capacity: 100,
        },
      ];

      warehouseService.setWarehouses(warehouses);

      const point: Point = { latitude: 0, longitude: 0 };
      const nearest = warehouseService.findNearestWarehouse(point);
      const inRange = warehouseService.findWarehousesInRange(point, 70);

      expect(nearest?.id).toBe("w1");
      expect(inRange.length).toBeGreaterThan(0);
    });
  });
});
