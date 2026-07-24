/**
 * Auth Simulators Tests
 * Tests for all authentication mechanisms
 * ~150 lines
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  APIKeyValidator,
  OAuth2Server,
  BasicAuthValidator,
  BearerTokenValidator,
  JWTHandler,
  HMACSignatureGenerator,
} from "../auth-simulators";

// ───────────────────────────────────────────────────────────────────────────
// API KEY VALIDATOR TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("APIKeyValidator", () => {
  let validator: APIKeyValidator;

  beforeEach(() => {
    validator = new APIKeyValidator({
      validKeys: ["sk_test_123", "sk_test_456"],
    });
  });

  it("should validate API keys from headers", () => {
    expect(validator.validateFromHeaders({ "x-api-key": "sk_test_123" })).toBe(
      true,
    );
    expect(validator.validateFromHeaders({ "x-api-key": "invalid" })).toBe(
      false,
    );
  });

  it("should validate API keys from query parameters", () => {
    expect(validator.validateFromQuery({ api_key: "sk_test_456" })).toBe(true);
    expect(validator.validateFromQuery({ api_key: "invalid" })).toBe(false);
  });

  it("should add new keys", () => {
    validator.addKey("sk_test_789");
    expect(validator.validateFromHeaders({ "x-api-key": "sk_test_789" })).toBe(
      true,
    );
  });

  it("should remove keys", () => {
    validator.removeKey("sk_test_123");
    expect(validator.validateFromHeaders({ "x-api-key": "sk_test_123" })).toBe(
      false,
    );
  });

  it("should handle case-insensitive header names", () => {
    expect(validator.validateFromHeaders({ "X-API-KEY": "sk_test_123" })).toBe(
      true,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OAUTH2 SERVER TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("OAuth2Server", () => {
  let server: OAuth2Server;

  beforeEach(() => {
    server = new OAuth2Server({
      clientId: "client_123",
      clientSecret: "secret_456",
      redirectUri: "http://localhost/callback",
      tokenExpirySeconds: 3600,
    });
  });

  it("should generate authorization codes", () => {
    const code = server.generateAuthCode(
      "http://localhost/callback",
      "read write",
    );
    expect(code).toMatch(/^code_/);
  });

  it("should exchange authorization codes for tokens", () => {
    const code = server.generateAuthCode("http://localhost/callback");
    const token = server.exchangeAuthCode(
      code,
      "client_123",
      "secret_456",
      "http://localhost/callback",
    );

    expect(token).not.toBeNull();
    expect(token!.access_token).toBeDefined();
    expect(token!.token_type).toBe("Bearer");
    expect(token!.expires_in).toBe(3600);
  });

  it("should reject invalid client secrets", () => {
    const code = server.generateAuthCode("http://localhost/callback");
    const token = server.exchangeAuthCode(
      code,
      "client_123",
      "wrong_secret",
      "http://localhost/callback",
    );
    expect(token).toBeNull();
  });

  it("should validate access tokens", () => {
    const code = server.generateAuthCode("http://localhost/callback");
    const token = server.exchangeAuthCode(
      code,
      "client_123",
      "secret_456",
      "http://localhost/callback",
    );

    expect(server.validateAccessToken(token!.access_token)).toBe(true);
    expect(server.validateAccessToken("invalid_token")).toBe(false);
  });

  it("should support refresh tokens", () => {
    const code = server.generateAuthCode("http://localhost/callback");
    const token = server.exchangeAuthCode(
      code,
      "client_123",
      "secret_456",
      "http://localhost/callback",
    );

    expect(token!.refresh_token).toBeDefined();

    const newToken = server.refreshAccessToken(
      token!.refresh_token!,
      "client_123",
      "secret_456",
    );
    expect(newToken).not.toBeNull();
    expect(newToken!.access_token).toBeDefined();
    expect(newToken!.access_token).not.toBe(token!.access_token);
  });

  it("should revoke tokens", () => {
    const code = server.generateAuthCode("http://localhost/callback");
    const token = server.exchangeAuthCode(
      code,
      "client_123",
      "secret_456",
      "http://localhost/callback",
    );

    expect(server.validateAccessToken(token!.access_token)).toBe(true);
    server.revokeToken(token!.access_token);
    expect(server.validateAccessToken(token!.access_token)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// BASIC AUTH VALIDATOR TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("BasicAuthValidator", () => {
  let validator: BasicAuthValidator;

  beforeEach(() => {
    validator = new BasicAuthValidator();
    validator.addCredential("user1", "password123");
    validator.addCredential("user2", "password456");
  });

  it("should validate basic auth credentials", () => {
    const validAuth = Buffer.from("user1:password123").toString("base64");
    expect(validator.validateFromHeader(`Basic ${validAuth}`)).toBe(true);
  });

  it("should reject invalid credentials", () => {
    const invalidAuth = Buffer.from("user1:wrongpassword").toString("base64");
    expect(validator.validateFromHeader(`Basic ${invalidAuth}`)).toBe(false);
  });

  it("should reject missing Basic prefix", () => {
    const auth = Buffer.from("user1:password123").toString("base64");
    expect(validator.validateFromHeader(auth)).toBe(false);
  });

  it("should handle missing auth header", () => {
    expect(validator.validateFromHeader(undefined)).toBe(false);
  });

  it("should support removing credentials", () => {
    validator.removeCredential("user1");
    const auth = Buffer.from("user1:password123").toString("base64");
    expect(validator.validateFromHeader(`Basic ${auth}`)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// BEARER TOKEN VALIDATOR TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("BearerTokenValidator", () => {
  let validator: BearerTokenValidator;

  beforeEach(() => {
    validator = new BearerTokenValidator();
    validator.addToken("token_123");
    validator.addToken("token_456");
  });

  it("should validate bearer tokens", () => {
    expect(validator.validateFromHeader("Bearer token_123")).toBe(true);
  });

  it("should reject invalid tokens", () => {
    expect(validator.validateFromHeader("Bearer invalid_token")).toBe(false);
  });

  it("should reject missing Bearer prefix", () => {
    expect(validator.validateFromHeader("token_123")).toBe(false);
  });

  it("should handle missing auth header", () => {
    expect(validator.validateFromHeader(undefined)).toBe(false);
  });

  it("should support token validation", () => {
    expect(validator.validate("token_123")).toBe(true);
    expect(validator.validate("invalid")).toBe(false);
  });

  it("should support removing tokens", () => {
    validator.removeToken("token_123");
    expect(validator.validate("token_123")).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// JWT HANDLER TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("JWTHandler", () => {
  let handler: JWTHandler;

  beforeEach(() => {
    handler = new JWTHandler({
      algorithm: "HS256",
      secret: "test_secret_key",
      expirySeconds: 3600,
    });
  });

  it("should sign JWT tokens", () => {
    const token = handler.sign({ sub: "user_123", role: "admin" });
    expect(token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
  });

  it("should verify valid JWT tokens", () => {
    const payload = { sub: "user_123", role: "admin" };
    const token = handler.sign(payload);
    const verified = handler.verify(token);

    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe("user_123");
    expect(verified!.role).toBe("admin");
  });

  it("should reject tampered tokens", () => {
    const token = handler.sign({ sub: "user_123" });
    const tampered = token.slice(0, -10) + "tampered00";
    expect(handler.verify(tampered)).toBeNull();
  });

  it("should reject invalid token format", () => {
    expect(handler.verify("not.a.token")).toBeNull();
    expect(handler.verify("invalid")).toBeNull();
  });

  it("should include iat and exp claims", () => {
    const token = handler.sign({ sub: "user_123" });
    const verified = handler.verify(token);

    expect(verified!.iat).toBeDefined();
    expect(verified!.exp).toBeDefined();
    expect(verified!.exp).toBeGreaterThan(verified!.iat!);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// HMAC SIGNATURE GENERATOR TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("HMACSignatureGenerator", () => {
  it("should generate Stripe-style HMAC signatures", () => {
    const payload = JSON.stringify({ id: "evt_123", type: "charge.succeeded" });
    const secret = "whsec_test_secret";
    const signature = HMACSignatureGenerator.generateStripeSignature(
      payload,
      secret,
    );

    expect(signature).toMatch(/^[a-f0-9]+$/);
    expect(signature.length).toBe(64); // SHA256 hex = 64 chars
  });

  it("should generate Shopify-style HMAC signatures", () => {
    const payload = JSON.stringify({ id: 123, title: "Test Order" });
    const secret = "test_secret";
    const signature = HMACSignatureGenerator.generateShopifySignature(
      payload,
      secret,
    );

    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
  });

  it("should verify HMAC-SHA256 signatures", () => {
    const payload = JSON.stringify({ id: "evt_123" });
    const secret = "test_secret";
    const signature = HMACSignatureGenerator.generateStripeSignature(
      payload,
      secret,
    );

    expect(
      HMACSignatureGenerator.verifyHMACSHA256(payload, signature, secret),
    ).toBe(true);
    expect(
      HMACSignatureGenerator.verifyHMACSHA256(
        payload,
        "wrong_signature",
        secret,
      ),
    ).toBe(false);
    expect(
      HMACSignatureGenerator.verifyHMACSHA256(
        "wrong_payload",
        signature,
        secret,
      ),
    ).toBe(false);
  });

  it("should generate different signatures for different payloads", () => {
    const secret = "test_secret";
    const sig1 = HMACSignatureGenerator.generateStripeSignature(
      "payload1",
      secret,
    );
    const sig2 = HMACSignatureGenerator.generateStripeSignature(
      "payload2",
      secret,
    );

    expect(sig1).not.toBe(sig2);
  });

  it("should generate different signatures for different secrets", () => {
    const payload = "test_payload";
    const sig1 = HMACSignatureGenerator.generateStripeSignature(
      payload,
      "secret1",
    );
    const sig2 = HMACSignatureGenerator.generateStripeSignature(
      payload,
      "secret2",
    );

    expect(sig1).not.toBe(sig2);
  });
});
