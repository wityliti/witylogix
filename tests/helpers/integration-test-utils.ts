/**
 * Integration Test Utilities
 * Helper functions for integration testing
 * - Mock HTTP server for external API simulation
 * - Request recorder (capture and replay)
 * - API response fixtures loader
 * - Authentication test helper
 * - Database seed/teardown helpers
 *
 * Usage:
 *   const server = createMockHTTPServer();
 *   const recorder = new RequestRecorder();
 *   const auth = new AuthenticationHelper();
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body: any;
  delay?: number;
}

export interface HTTPRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface RecordedRequest {
  request: HTTPRequest;
  response: MockResponse;
  timestamp: number;
  duration: number;
}

export interface APIFixture {
  endpoint: string;
  method: string;
  request?: any;
  response: MockResponse;
  description?: string;
}

export interface AuthContext {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  organizationId: string;
}

// ============================================================================
// MOCK HTTP SERVER
// ============================================================================

export class MockHTTPServer {
  private routes: Map<string, MockResponse> = new Map();
  private requests: HTTPRequest[] = [];
  private requestHandlers: Array<
    (req: HTTPRequest) => MockResponse | undefined
  > = [];

  registerRoute(method: string, path: string, response: MockResponse): void {
    const key = `${method.toUpperCase()} ${path}`;
    this.routes.set(key, response);
  }

  registerHandler(
    handler: (req: HTTPRequest) => MockResponse | undefined,
  ): void {
    this.requestHandlers.push(handler);
  }

  async handleRequest(req: HTTPRequest): Promise<MockResponse> {
    this.requests.push(req);

    // Try custom handlers first
    for (const handler of this.requestHandlers) {
      const response = handler(req);
      if (response) {
        if (response.delay) {
          await new Promise((resolve) => setTimeout(resolve, response.delay));
        }
        return response;
      }
    }

    // Try exact route match
    const key = `${req.method.toUpperCase()} ${req.url}`;
    const response = this.routes.get(key);
    if (response) {
      if (response.delay) {
        await new Promise((resolve) => setTimeout(resolve, response.delay));
      }
      return response;
    }

    // Default 404
    return {
      status: 404,
      body: { error: "Not found" },
    };
  }

  getRecordedRequests(): HTTPRequest[] {
    return [...this.requests];
  }

  getRequestsByMethod(method: string): HTTPRequest[] {
    return this.requests.filter(
      (r) => r.method.toUpperCase() === method.toUpperCase(),
    );
  }

  getRequestsByPath(path: string): HTTPRequest[] {
    return this.requests.filter((r) => r.url.includes(path));
  }

  reset(): void {
    this.requests = [];
  }

  clear(): void {
    this.routes.clear();
    this.requests = [];
    this.requestHandlers = [];
  }
}

// ============================================================================
// REQUEST RECORDER & PLAYBACK
// ============================================================================

export class RequestRecorder {
  private recordings: RecordedRequest[] = [];
  private playbackIndex = 0;

  record(request: HTTPRequest, response: MockResponse, duration: number): void {
    this.recordings.push({
      request,
      response,
      timestamp: Date.now(),
      duration,
    });
  }

  getRecordings(): RecordedRequest[] {
    return [...this.recordings];
  }

  exportAsFixtures(): APIFixture[] {
    return this.recordings.map((recording) => ({
      endpoint: recording.request.url,
      method: recording.request.method,
      request: recording.request.body,
      response: recording.response,
      description: `Recorded from ${recording.request.method} ${recording.request.url}`,
    }));
  }

  importRecordings(recordings: RecordedRequest[]): void {
    this.recordings = [...recordings];
  }

  playback(request: HTTPRequest): MockResponse | undefined {
    const matching = this.recordings.find(
      (r) =>
        r.request.method === request.method &&
        r.request.url === request.url &&
        JSON.stringify(r.request.body) === JSON.stringify(request.body),
    );
    return matching?.response;
  }

  clear(): void {
    this.recordings = [];
    this.playbackIndex = 0;
  }
}

// ============================================================================
// FIXTURES LOADER
// ============================================================================

export class FixturesLoader {
  private fixtures: Map<string, APIFixture> = new Map();

  registerFixture(id: string, fixture: APIFixture): void {
    this.fixtures.set(id, fixture);
  }

  registerFixtures(fixtures: APIFixture[]): void {
    fixtures.forEach((fixture) => {
      const id = `${fixture.method} ${fixture.endpoint}`;
      this.fixtures.set(id, fixture);
    });
  }

  getFixture(id: string): APIFixture | undefined {
    return this.fixtures.get(id);
  }

  getFixturesByEndpoint(endpoint: string): APIFixture[] {
    return Array.from(this.fixtures.values()).filter((f) =>
      f.endpoint.includes(endpoint),
    );
  }

  getAllFixtures(): APIFixture[] {
    return Array.from(this.fixtures.values());
  }

  clear(): void {
    this.fixtures.clear();
  }
}

// ============================================================================
// AUTHENTICATION TEST HELPER
// ============================================================================

export class AuthenticationHelper {
  private context: AuthContext | null = null;

  createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
    this.context = {
      accessToken: overrides.accessToken || `token_${Date.now()}`,
      refreshToken: overrides.refreshToken || `refresh_${Date.now()}`,
      expiresAt: overrides.expiresAt || Date.now() + 3600000,
      userId:
        overrides.userId || `user_${Math.random().toString(36).substring(7)}`,
      organizationId:
        overrides.organizationId ||
        `org_${Math.random().toString(36).substring(7)}`,
    };
    return this.context;
  }

  getAuthContext(): AuthContext {
    if (!this.context) {
      return this.createAuthContext();
    }
    return this.context;
  }

  getAuthHeaders(): Record<string, string> {
    const context = this.getAuthContext();
    return {
      Authorization: `Bearer ${context.accessToken}`,
    };
  }

  isTokenExpired(): boolean {
    if (!this.context) return true;
    return Date.now() > this.context.expiresAt;
  }

  refreshToken(): AuthContext {
    if (!this.context) {
      return this.createAuthContext();
    }

    const newContext: AuthContext = {
      ...this.context,
      accessToken: `token_${Date.now()}`,
      expiresAt: Date.now() + 3600000,
    };
    this.context = newContext;
    return newContext;
  }

  clear(): void {
    this.context = null;
  }
}

// ============================================================================
// DATABASE TEST HELPER
// ============================================================================

export class DatabaseTestHelper {
  private seedData: Array<{ table: string; records: any[] }> = [];
  private createdTables: string[] = [];

  async seedTable(tableName: string, records: any[]): Promise<void> {
    this.seedData.push({ table: tableName, records });
  }

  async createTable(
    tableName: string,
    schema: Record<string, string>,
  ): Promise<void> {
    this.createdTables.push(tableName);
  }

  async teardown(): Promise<void> {
    // In real implementation, would delete records and tables
    this.seedData = [];
    this.createdTables = [];
  }

  getSeedData(): Array<{ table: string; records: any[] }> {
    return [...this.seedData];
  }

  getCreatedTables(): string[] {
    return [...this.createdTables];
  }

  async insertRecord(
    tableName: string,
    record: Record<string, any>,
  ): Promise<void> {
    const table = this.seedData.find((s) => s.table === tableName);
    if (table) {
      table.records.push(record);
    } else {
      this.seedData.push({ table: tableName, records: [record] });
    }
  }

  async deleteRecords(
    tableName: string,
    where: Record<string, any>,
  ): Promise<number> {
    const table = this.seedData.find((s) => s.table === tableName);
    if (!table) return 0;

    const initialLength = table.records.length;
    table.records = table.records.filter((record) => {
      for (const [key, value] of Object.entries(where)) {
        if (record[key] !== value) return true;
      }
      return false;
    });

    return initialLength - table.records.length;
  }

  async clearTable(tableName: string): Promise<void> {
    const index = this.seedData.findIndex((s) => s.table === tableName);
    if (index !== -1) {
      this.seedData[index].records = [];
    }
  }
}

// ============================================================================
// RESPONSE VALIDATOR
// ============================================================================

export class ResponseValidator {
  static validateStatus(
    response: MockResponse,
    expectedStatus: number,
  ): boolean {
    return response.status === expectedStatus;
  }

  static validateHeader(
    response: MockResponse,
    headerName: string,
    expectedValue: string,
  ): boolean {
    const headers = response.headers || {};
    return headers[headerName.toLowerCase()] === expectedValue;
  }

  static validateBodyStructure(
    body: any,
    schema: Record<string, string>,
  ): boolean {
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in body)) return false;
      if (typeof body[key] !== type && type !== "any") return false;
    }
    return true;
  }

  static validateBodyField(
    body: any,
    fieldPath: string,
    expectedValue: any,
  ): boolean {
    const parts = fieldPath.split(".");
    let current = body;

    for (const part of parts) {
      if (!(part in current)) return false;
      current = current[part];
    }

    return current === expectedValue;
  }

  static validateArrayLength(
    body: any,
    arrayPath: string,
    expectedLength: number,
  ): boolean {
    const parts = arrayPath.split(".");
    let current = body;

    for (const part of parts) {
      if (!(part in current)) return false;
      current = current[part];
    }

    return Array.isArray(current) && current.length === expectedLength;
  }
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export function assertResponseSuccess(response: MockResponse): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Expected successful response, got ${response.status}`);
  }
}

export function assertResponseError(
  response: MockResponse,
  expectedStatus: number = 400,
): void {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${response.status}`);
  }
}

export function assertResponseContains(
  response: MockResponse,
  text: string,
): void {
  const bodyStr = JSON.stringify(response.body);
  if (!bodyStr.includes(text)) {
    throw new Error(`Response does not contain "${text}"`);
  }
}

export function assertRequestWasMade(
  server: MockHTTPServer,
  method: string,
  path: string,
): void {
  const found = server
    .getRecordedRequests()
    .some(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() && r.url.includes(path),
    );
  if (!found) {
    throw new Error(`Expected request ${method} ${path} was not made`);
  }
}

export function assertRequestNotMade(
  server: MockHTTPServer,
  method: string,
  path: string,
): void {
  const found = server
    .getRecordedRequests()
    .some(
      (r) =>
        r.method.toUpperCase() === method.toUpperCase() && r.url.includes(path),
    );
  if (found) {
    throw new Error(`Unexpected request ${method} ${path} was made`);
  }
}

// ============================================================================
// FIXTURE FACTORY
// ============================================================================

export function createFixtures(): APIFixture[] {
  return [
    {
      endpoint: "/api/users",
      method: "GET",
      response: {
        status: 200,
        body: {
          users: [
            { id: "1", name: "John Doe", email: "john@example.com" },
            { id: "2", name: "Jane Smith", email: "jane@example.com" },
          ],
        },
      },
    },
    {
      endpoint: "/api/users",
      method: "POST",
      request: { name: "New User", email: "new@example.com" },
      response: {
        status: 201,
        body: { id: "3", name: "New User", email: "new@example.com" },
      },
    },
    {
      endpoint: "/api/orders",
      method: "GET",
      response: {
        status: 200,
        body: {
          orders: [
            { id: "ord_1", status: "PENDING", amount: 100 },
            { id: "ord_2", status: "COMPLETED", amount: 250 },
          ],
        },
      },
    },
    {
      endpoint: "/api/auth/login",
      method: "POST",
      request: { email: "user@example.com", password: "password" },
      response: {
        status: 200,
        body: {
          accessToken: "token_abc123",
          refreshToken: "refresh_xyz789",
          expiresIn: 3600,
        },
      },
    },
  ];
}

// ============================================================================
// INTEGRATION TEST CONTEXT
// ============================================================================

export class IntegrationTestContext {
  public server: MockHTTPServer;
  public recorder: RequestRecorder;
  public fixtures: FixturesLoader;
  public auth: AuthenticationHelper;
  public db: DatabaseTestHelper;

  constructor() {
    this.server = new MockHTTPServer();
    this.recorder = new RequestRecorder();
    this.fixtures = new FixturesLoader();
    this.auth = new AuthenticationHelper();
    this.db = new DatabaseTestHelper();

    // Load default fixtures
    this.fixtures.registerFixtures(createFixtures());
  }

  async setup(): Promise<void> {
    this.auth.createAuthContext();
  }

  async teardown(): Promise<void> {
    this.server.clear();
    this.recorder.clear();
    this.fixtures.clear();
    this.auth.clear();
    await this.db.teardown();
  }
}
