import { Page, Locator, expect } from "@playwright/test";

/**
 * Dispatch Dashboard Page Object Model
 * Encapsulates dispatch dashboard interactions and map-based route management
 */
export class DispatchPage {
  readonly page: Page;
  readonly statsBar: Locator;
  readonly activeDriversCount: Locator;
  readonly totalStopsCount: Locator;
  readonly totalKmCount: Locator;
  readonly totalTimeCount: Locator;
  readonly routeTimeline: Locator;
  readonly driverRows: Locator;
  readonly mapContainer: Locator;
  readonly mapMarkers: Locator;
  readonly unscheduledTab: Locator;
  readonly scheduledTab: Locator;
  readonly tabContent: Locator;
  readonly stopCards: Locator;
  readonly planRoutesButton: Locator;
  readonly draggableStops: Locator;
  readonly routeDropZones: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statsBar = page.locator(
      '[data-testid="stats-bar"], [data-testid="dispatch-header"]',
    );
    this.activeDriversCount = page.locator(
      '[data-testid="active-drivers-stat"], [data-testid="stat-drivers"]',
    );
    this.totalStopsCount = page.locator(
      '[data-testid="total-stops-stat"], [data-testid="stat-stops"]',
    );
    this.totalKmCount = page.locator(
      '[data-testid="total-km-stat"], [data-testid="stat-km"]',
    );
    this.totalTimeCount = page.locator(
      '[data-testid="total-time-stat"], [data-testid="stat-time"]',
    );
    this.routeTimeline = page.locator(
      '[data-testid="route-timeline"], [data-testid="timeline"]',
    );
    this.driverRows = page.locator(
      '[data-testid="driver-row"], [data-testid="timeline-row"]',
    );
    this.mapContainer = page.locator(
      '[data-testid="dispatch-map"], [data-testid="map-container"]',
    );
    this.mapMarkers = page.locator('[data-testid="map-marker"], .map-marker');
    this.unscheduledTab = page.locator(
      '[data-testid="tab-unscheduled"], button:has-text("Unscheduled")',
    );
    this.scheduledTab = page.locator(
      '[data-testid="tab-scheduled"], button:has-text("Scheduled")',
    );
    this.tabContent = page.locator(
      '[data-testid="tab-content"], [role="tabpanel"]',
    );
    this.stopCards = page.locator(
      '[data-testid="stop-card"], [data-testid="order-card"]',
    );
    this.planRoutesButton = page.locator(
      '[data-testid="plan-routes-btn"], button:has-text("Plan Routes")',
    );
    this.draggableStops = page.locator(
      '[data-testid="draggable-stop"], [draggable="true"]',
    );
    this.routeDropZones = page.locator(
      '[data-testid="route-drop-zone"], [data-testid="drop-target"]',
    );
    this.loadingIndicator = page.locator(
      '[data-testid="loading"], [role="progressbar"]',
    );
    this.emptyState = page.locator(
      '[data-testid="empty-state"], [data-testid="no-data"]',
    );
  }

  /**
   * Navigate to dispatch dashboard
   */
  async navigateToDispatch(): Promise<void> {
    await this.page.goto("/dispatch", { waitUntil: "networkidle" });
    await this.waitForPageLoad();
  }

  /**
   * Wait for dispatch page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle", { timeout: 10000 });
    await expect(this.statsBar).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for map to be loaded and interactive
   */
  async waitForMapLoad(): Promise<void> {
    await expect(this.mapContainer).toBeVisible({ timeout: 10000 });
    await this.page.waitForLoadState("networkidle", { timeout: 5000 });
  }

  /**
   * Get stats bar object with all metrics
   */
  async getStatsBar(): Promise<{
    drivers: string;
    stops: string;
    km: string;
    time: string;
  }> {
    await expect(this.statsBar).toBeVisible();
    const drivers = await this.activeDriversCount.textContent();
    const stops = await this.totalStopsCount.textContent();
    const km = await this.totalKmCount.textContent();
    const time = await this.totalTimeCount.textContent();

    return {
      drivers: drivers?.trim() || "0",
      stops: stops?.trim() || "0",
      km: km?.trim() || "0",
      time: time?.trim() || "0",
    };
  }

  /**
   * Get unscheduled stops count
   */
  async getUnscheduledCount(): Promise<number> {
    await this.unscheduledTab.click();
    await this.page.waitForLoadState("networkidle");
    const count = await this.stopCards.count();
    return count;
  }

  /**
   * Get scheduled stops count
   */
  async getScheduledCount(): Promise<number> {
    await this.scheduledTab.click();
    await this.page.waitForLoadState("networkidle");
    const count = await this.stopCards.count();
    return count;
  }

  /**
   * Toggle between tabs (unscheduled/scheduled)
   */
  async toggleTab(tabName: "unscheduled" | "scheduled"): Promise<void> {
    const tab =
      tabName === "unscheduled" ? this.unscheduledTab : this.scheduledTab;
    await expect(tab).toBeVisible();
    await tab.click();
    await this.page.waitForLoadState("networkidle");
    await expect(this.tabContent).toBeVisible();
  }

  /**
   * Get route timeline with driver information
   */
  async getRouteTimeline(): Promise<
    Array<{
      driverId: string;
      driverName: string;
      stops: number;
      estimatedTime: string;
      color: string;
    }>
  > {
    await expect(this.routeTimeline).toBeVisible();
    const routes: Array<{
      driverId: string;
      driverName: string;
      stops: number;
      estimatedTime: string;
      color: string;
    }> = [];

    const driverCount = await this.driverRows.count();
    for (let i = 0; i < driverCount; i++) {
      const row = this.driverRows.nth(i);
      const nameElement = row.locator('[data-testid="driver-name"]');
      const stopsElement = row.locator('[data-testid="stops-count"]');
      const timeElement = row.locator('[data-testid="estimated-time"]');
      const colorElement = row.locator('[data-testid="route-color"]');

      const name = await nameElement.textContent();
      const stops = await stopsElement.textContent();
      const time = await timeElement.textContent();
      const color = await colorElement.getAttribute("data-color");

      if (name) {
        routes.push({
          driverId: `driver-${i}`,
          driverName: name.trim(),
          stops: parseInt(stops?.trim() || "0", 10),
          estimatedTime: time?.trim() || "0h",
          color: color || "#000000",
        });
      }
    }

    return routes;
  }

  /**
   * Get all driver cards with details
   */
  async getDriverCards(): Promise<
    Array<{
      id: string;
      name: string;
      vehicle: string;
      status: string;
      stops: number;
      rating: number;
    }>
  > {
    await expect(this.driverRows).toBeVisible();
    const drivers: Array<{
      id: string;
      name: string;
      vehicle: string;
      status: string;
      stops: number;
      rating: number;
    }> = [];

    const count = await this.driverRows.count();
    for (let i = 0; i < count; i++) {
      const row = this.driverRows.nth(i);
      const name = await row
        .locator('[data-testid="driver-name"]')
        .textContent();
      const vehicle = await row
        .locator('[data-testid="vehicle-plate"]')
        .textContent();
      const status = await row
        .locator('[data-testid="driver-status"]')
        .textContent();
      const stops = await row
        .locator('[data-testid="stops-count"]')
        .textContent();
      const rating = await row
        .locator('[data-testid="driver-rating"]')
        .textContent();

      if (name) {
        drivers.push({
          id: `driver-${i}`,
          name: name.trim(),
          vehicle: vehicle?.trim() || "",
          status: status?.trim() || "active",
          stops: parseInt(stops?.trim() || "0", 10),
          rating: parseFloat(rating?.trim() || "0"),
        });
      }
    }

    return drivers;
  }

  /**
   * Select a driver from the timeline
   */
  async selectDriver(driverName: string): Promise<void> {
    const driverRow = this.page.locator(
      `[data-testid="driver-row"]:has([data-testid="driver-name"]:text("${driverName}"))`,
    );
    await expect(driverRow).toBeVisible();
    await driverRow.click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Get all map markers
   */
  async getMapMarkers(): Promise<
    Array<{ id: string; type: string; lat: number; lng: number }>
  > {
    await this.waitForMapLoad();
    const markers: Array<{
      id: string;
      type: string;
      lat: number;
      lng: number;
    }> = [];

    const count = await this.mapMarkers.count();
    for (let i = 0; i < count; i++) {
      const marker = this.mapMarkers.nth(i);
      const id = await marker.getAttribute("data-id");
      const type = await marker.getAttribute("data-type");
      const lat = await marker.getAttribute("data-lat");
      const lng = await marker.getAttribute("data-lng");

      if (id) {
        markers.push({
          id,
          type: type || "stop",
          lat: parseFloat(lat || "0"),
          lng: parseFloat(lng || "0"),
        });
      }
    }

    return markers;
  }

  /**
   * Drag and drop a stop to a different route
   */
  async dragStopToRoute(stopId: string, targetRouteId: string): Promise<void> {
    const stop = this.page.locator(
      `[data-testid="draggable-stop"][data-id="${stopId}"]`,
    );
    const targetZone = this.page.locator(
      `[data-testid="route-drop-zone"][data-route-id="${targetRouteId}"]`,
    );

    await expect(stop).toBeVisible();
    await expect(targetZone).toBeVisible();

    // Perform drag and drop
    await stop.dragTo(targetZone);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Click Plan Routes button to trigger optimization
   */
  async clickPlanRoutes(): Promise<void> {
    await expect(this.planRoutesButton).toBeVisible();
    await this.planRoutesButton.click();
    // Wait for optimization to complete
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Click on a stop card to view details
   */
  async clickStopCard(stopId: string): Promise<void> {
    const stopCard = this.page.locator(
      `[data-testid="stop-card"][data-id="${stopId}"]`,
    );
    await expect(stopCard).toBeVisible();
    await stopCard.click();
  }

  /**
   * Get stop details from a modal or expanded view
   */
  async getStopDetails(): Promise<{
    id: string;
    address: string;
    phone: string;
    timeWindow: string;
    notes: string;
  }> {
    const modal = this.page.locator(
      '[data-testid="stop-detail-modal"], [role="dialog"]',
    );
    await expect(modal).toBeVisible();

    const id = await modal.locator('[data-testid="stop-id"]').textContent();
    const address = await modal
      .locator('[data-testid="stop-address"]')
      .textContent();
    const phone = await modal
      .locator('[data-testid="stop-phone"]')
      .textContent();
    const timeWindow = await modal
      .locator('[data-testid="time-window"]')
      .textContent();
    const notes = await modal
      .locator('[data-testid="stop-notes"]')
      .textContent();

    return {
      id: id?.trim() || "",
      address: address?.trim() || "",
      phone: phone?.trim() || "",
      timeWindow: timeWindow?.trim() || "",
      notes: notes?.trim() || "",
    };
  }

  /**
   * Check if real-time updates are working
   */
  async waitForStatsUpdate(
    previousStats: { drivers: string; stops: string },
    timeout: number = 15000,
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const currentStats = await this.getStatsBar();
      if (
        currentStats.drivers !== previousStats.drivers ||
        currentStats.stops !== previousStats.stops
      ) {
        return true;
      }
      await this.page.waitForTimeout(500);
    }
    return false;
  }

  /**
   * Verify dispatch page is displayed
   */
  async expectDispatchPage(): Promise<void> {
    await expect(this.statsBar).toBeVisible();
    await expect(this.routeTimeline).toBeVisible();
  }

  /**
   * Verify stats bar displays expected values
   */
  async expectStatsBarVisible(): Promise<void> {
    await expect(this.statsBar).toBeVisible();
    await expect(this.activeDriversCount).toBeVisible();
    await expect(this.totalStopsCount).toBeVisible();
  }

  /**
   * Verify route timeline is displayed with drivers
   */
  async expectRouteTimelineWithDrivers(
    minDriverCount: number = 1,
  ): Promise<void> {
    const count = await this.driverRows.count();
    if (count < minDriverCount) {
      throw new Error(
        `Expected at least ${minDriverCount} driver rows, found ${count}`,
      );
    }
  }

  /**
   * Verify map is rendered
   */
  async expectMapVisible(): Promise<void> {
    await this.waitForMapLoad();
    const markerCount = await this.mapMarkers.count();
    if (markerCount === 0) {
      throw new Error("No map markers found on dispatch map");
    }
  }

  /**
   * Close stop detail modal
   */
  async closeStopDetail(): Promise<void> {
    const closeButton = this.page.locator(
      '[data-testid="stop-detail-close"], [aria-label="Close"]',
    );
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }
}
