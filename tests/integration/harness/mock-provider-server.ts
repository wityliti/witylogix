/**
 * Mock Provider Server for Integration Tests
 * Configurable HTTP mock server with auth, rate limiting, webhooks, latency, errors
 * ~400 lines
 */

import http from "http";
import { URL } from "url";
import {
  APIKeyValidator,
  OAuth2Server,
  BasicAuthValidator,
  BearerTokenValidator,
  JWTHandler,
  HMACSignatureGenerator,
} from "./auth-simulators";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: string;
  timestamp: number;
}

export interface ProviderConfig {
  port: number;
  basePath?: string;
  authType?: "api-key" | "oauth2" | "basic" | "bearer" | "jwt" | "none";
  rpmLimit?: number;
  responseDelay?: number;
  errorRate?: number;
  fixtures?: Record<string, Record<string, any>>;
}

export interface RateLimitState {
  requestCount: number;
  windowStart: number;
  blocked: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// MOCK PROVIDER SERVER
// ───────────────────────────────────────────────────────────────────────────

export class MockProviderServer {
  private server?: http.Server;
  private config: Required<ProviderConfig>;
  private isListening: boolean = false;
  private recordedRequests: MockRequest[] = [];
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private apiKeyValidator?: APIKeyValidator;
  private oauth2Server?: OAuth2Server;
  private basicAuthValidator?: BasicAuthValidator;
  private bearerValidator?: BearerTokenValidator;
  private jwtHandler?: JWTHandler;

  constructor(config: ProviderConfig) {
    this.config = {
      basePath: "/api/v1",
      authType: "none",
      rpmLimit: 1000,
      responseDelay: 0,
      errorRate: 0,
      fixtures: {},
      ...config,
    };
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(() => {
          res.writeHead(500);
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      });

      this.server.listen(this.config.port, () => {
        this.isListening = true;
        resolve();
      });

      this.server.on("error", reject);
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.isListening = false;
        resolve();
      });
    });
  }

  /**
   * Check if server is listening
   */
  isRunning(): boolean {
    return this.isListening;
  }

  /**
   * Get the base URL for this server
   */
  getBaseUrl(): string {
    return `http://localhost:${this.config.port}`;
  }

  /**
   * Configure API Key authentication
   */
  setAPIKeyAuth(validKeys: string[]): void {
    this.apiKeyValidator = new APIKeyValidator({ validKeys });
  }

  /**
   * Configure OAuth2 authentication
   */
  setOAuth2Auth(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): void {
    this.oauth2Server = new OAuth2Server({
      ...config,
      tokenExpirySeconds: 3600,
    });
  }

  /**
   * Configure Basic authentication
   */
  setBasicAuth(credentials: Record<string, string>): void {
    this.basicAuthValidator = new BasicAuthValidator();
    for (const [username, password] of Object.entries(credentials)) {
      this.basicAuthValidator.addCredential(username, password);
    }
  }

  /**
   * Configure Bearer token authentication
   */
  setBearerAuth(tokens: string[]): void {
    this.bearerValidator = new BearerTokenValidator();
    for (const token of tokens) {
      this.bearerValidator.addToken(token);
    }
  }

  /**
   * Configure JWT authentication
   */
  setJWTAuth(secret: string): void {
    this.jwtHandler = new JWTHandler({
      algorithm: "HS256",
      secret,
      expirySeconds: 3600,
    });
  }

  /**
   * Add response fixtures for endpoints
   */
  addFixtures(fixtures: Record<string, Record<string, any>>): void {
    this.config.fixtures = {
      ...this.config.fixtures,
      ...fixtures,
    };
  }

  /**
   * Get recorded requests
   */
  getRecordedRequests(): MockRequest[] {
    return [...this.recordedRequests];
  }

  /**
   * Get recorded requests for a path
   */
  getRecordedRequestsForPath(path: string): MockRequest[] {
    return this.recordedRequests.filter((r) => r.path === path);
  }

  /**
   * Clear recorded requests
   */
  clearRecordedRequests(): void {
    this.recordedRequests = [];
  }

  /**
   * Main request handler
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://localhost:${this.config.port}`);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams);
    const method = req.method || "GET";
    const headers: Record<string, string> = {};

    // Normalize headers to lowercase
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key.toLowerCase()] = Array.isArray(value)
        ? value[0]
        : value || "";
    }

    // Collect body
    let body = "";
    if (method !== "GET" && method !== "HEAD") {
      body = await this.readBody(req);
    }

    // Record request
    const mockReq: MockRequest = {
      method,
      path,
      headers,
      query,
      body,
      timestamp: Date.now(),
    };
    this.recordedRequests.push(mockReq);

    // Check rate limiting
    const clientIp = req.socket.remoteAddress || "unknown";
    if (!this.checkRateLimit(clientIp)) {
      res.writeHead(429, { "Retry-After": "60" });
      res.end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    // Check authentication
    if (this.config.authType !== "none") {
      if (!this.validateAuth(headers, query)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    // Simulate error rate
    if (this.config.errorRate > 0 && Math.random() < this.config.errorRate) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }

    // Apply response delay
    if (this.config.responseDelay > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.responseDelay),
      );
    }

    // Handle OAuth2 endpoints
    if (
      this.oauth2Server &&
      this.handleOAuth2Endpoints(path, method, query, body, res)
    ) {
      return;
    }

    // Return fixture or 404
    const fixture = this.getFixture(path);
    if (fixture) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fixture));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  }

  /**
   * Check rate limit for client
   */
  private checkRateLimit(clientIp: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    let state = this.rateLimitStates.get(clientIp);
    if (!state || now - state.windowStart > windowMs) {
      state = {
        requestCount: 1,
        windowStart: now,
        blocked: false,
      };
    } else {
      state.requestCount++;
      if (state.requestCount > this.config.rpmLimit) {
        state.blocked = true;
      }
    }

    this.rateLimitStates.set(clientIp, state);
    return !state.blocked;
  }

  /**
   * Validate authentication based on configured type
   */
  private validateAuth(
    headers: Record<string, string>,
    query: Record<string, string>,
  ): boolean {
    switch (this.config.authType) {
      case "api-key":
        return this.apiKeyValidator?.validate(headers, query) ?? false;
      case "basic":
        return (
          this.basicAuthValidator?.validateFromHeader(
            headers["authorization"],
          ) ?? false
        );
      case "bearer":
        return (
          this.bearerValidator?.validateFromHeader(headers["authorization"]) ??
          false
        );
      case "jwt":
        if (!this.jwtHandler) return false;
        const token = this.extractBearerToken(headers["authorization"]);
        return token ? this.jwtHandler.verify(token) !== null : false;
      case "oauth2":
        return true; // OAuth2 tokens validated separately
      default:
        return true;
    }
  }

  /**
   * Handle OAuth2 endpoints
   */
  private handleOAuth2Endpoints(
    path: string,
    method: string,
    query: Record<string, string>,
    body: string,
    res: http.ServerResponse,
  ): boolean {
    if (!this.oauth2Server) return false;

    const basePath = this.config.basePath;

    // GET /authorize
    if (path === `${basePath}/oauth/authorize` && method === "GET") {
      const code = this.oauth2Server.generateAuthCode(
        query.redirect_uri || "",
        query.scope,
      );
      const redirectUri = new URL(
        query.redirect_uri || "http://localhost/callback",
      );
      redirectUri.searchParams.set("code", code);
      redirectUri.searchParams.set("state", query.state || "");

      res.writeHead(302, { Location: redirectUri.toString() });
      res.end();
      return true;
    }

    // POST /token
    if (path === `${basePath}/oauth/token` && method === "POST") {
      const bodyObj = JSON.parse(body || "{}");
      const grantType = bodyObj.grant_type;

      if (grantType === "authorization_code") {
        const token = this.oauth2Server.exchangeAuthCode(
          bodyObj.code,
          bodyObj.client_id,
          bodyObj.client_secret,
          bodyObj.redirect_uri,
        );

        if (token) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(token));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
        }
      } else if (grantType === "refresh_token") {
        const token = this.oauth2Server.refreshAccessToken(
          bodyObj.refresh_token,
          bodyObj.client_id,
          bodyObj.client_secret,
        );

        if (token) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(token));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
        }
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unsupported_grant_type" }));
      }
      return true;
    }

    // POST /revoke
    if (path === `${basePath}/oauth/revoke` && method === "POST") {
      const bodyObj = JSON.parse(body || "{}");
      this.oauth2Server.revokeToken(bodyObj.token);
      res.writeHead(200);
      res.end();
      return true;
    }

    return false;
  }

  /**
   * Get response fixture for path
   */
  private getFixture(path: string): Record<string, any> | null {
    const cleanPath = path.startsWith(this.config.basePath)
      ? path.slice(this.config.basePath.length)
      : path;
    return this.config.fixtures[cleanPath] || null;
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        resolve(body);
      });
    });
  }

  /**
   * Extract bearer token from Authorization header
   */
  private extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.slice(7);
  }
}
