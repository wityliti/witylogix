/**
 * Signature Tester
 * Generate and verify webhook signatures with code snippets
 */

import { createHmac } from "crypto";

/**
 * Supported signature algorithms
 */
export type SignatureAlgorithm = "sha256" | "sha512";

/**
 * Test payload template
 */
export interface TestPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Generated signature result
 */
export interface SignatureResult {
  algorithm: SignatureAlgorithm;
  signature: string;
  timestamp: string;
  payload: string;
  header: string; // Full header value
}

/**
 * Code snippet for signature verification
 */
export interface CodeSnippet {
  language: string;
  code: string;
}

/**
 * Signature Tester Service
 */
export class SignatureTester {
  /**
   * Generate test signature for a payload
   */
  generateSignature(
    payload: string,
    secret: string,
    algorithm: SignatureAlgorithm = "sha256"
  ): SignatureResult {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedContent = `${timestamp}.${payload}`;

    const signature = createHmac(algorithm, secret)
      .update(signedContent)
      .digest("hex");

    const header = `t=${timestamp},${algorithm}=${signature}`;

    return {
      algorithm,
      signature,
      timestamp,
      payload,
      header,
    };
  }

  /**
   * Generate sample payload for event type
   */
  generateSamplePayload(eventType: string): TestPayload {
    const timestamp = new Date().toISOString();

    const sampleData: Record<string, Record<string, any>> = {
      "shipment.created": {
        shipmentId: "ship_1234567890",
        orderId: "order_987654321",
        carrier: "DHL",
        trackingNumber: "1234567890123",
        status: "pending",
        estimatedDelivery: "2025-03-20",
      },
      "shipment.status_changed": {
        shipmentId: "ship_1234567890",
        previousStatus: "pending",
        newStatus: "in_transit",
        carrier: "DHL",
        location: "Distribution Center",
      },
      "order.created": {
        orderId: "order_987654321",
        customerId: "cust_123456",
        totalAmount: 99.99,
        currency: "USD",
        items: 3,
        status: "pending",
      },
      "order.updated": {
        orderId: "order_987654321",
        field: "status",
        previousValue: "pending",
        newValue: "confirmed",
      },
      "driver.assigned": {
        driverId: "driver_123",
        routeId: "route_456",
        shipmentCount: 5,
        estimatedCompletionTime: "02:30:00",
      },
      "route.completed": {
        routeId: "route_456",
        driverId: "driver_123",
        completedAt: new Date().toISOString(),
        deliveredCount: 5,
        failedCount: 0,
      },
    };

    return {
      id: `evt_${Math.random().toString(36).substring(2, 9)}`,
      event: eventType,
      timestamp,
      data: sampleData[eventType] || { example: "data" },
    };
  }

  /**
   * Verify a signature
   */
  verifySignature(
    payload: string,
    signature: string,
    timestamp: string,
    secret: string,
    algorithm: SignatureAlgorithm = "sha256",
    maxAgeSeconds: number = 300 // 5 minutes
  ): {
    valid: boolean;
    reason?: string;
    age?: number;
  } {
    // Check timestamp freshness
    const signedTimestamp = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const age = now - signedTimestamp;

    if (age > maxAgeSeconds) {
      return {
        valid: false,
        reason: `Timestamp too old: ${age}s > ${maxAgeSeconds}s`,
        age,
      };
    }

    if (age < 0) {
      return {
        valid: false,
        reason: "Timestamp is in the future",
        age,
      };
    }

    // Verify signature
    const signedContent = `${timestamp}.${payload}`;
    const expectedSignature = createHmac(algorithm, secret)
      .update(signedContent)
      .digest("hex");

    const signatureValid = signature === expectedSignature;

    return {
      valid: signatureValid,
      reason: signatureValid ? undefined : "Signature mismatch",
      age,
    };
  }

  /**
   * Get code snippet for signature verification
   */
  getVerificationSnippet(
    language: "nodejs" | "python" | "ruby" | "go" | "php"
  ): CodeSnippet {
    const snippets: Record<string, string> = {
      nodejs: `
const crypto = require('crypto');

function verifySignature(payload, signature, timestamp, secret) {
  const signedContent = \`\${timestamp}.\${payload}\`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');

  return signature === expected;
}

// Usage
const isValid = verifySignature(
  JSON.stringify(req.body),
  req.headers['x-witylogix-signature'],
  req.headers['x-witylogix-timestamp'],
  WEBHOOK_SECRET
);
      `.trim(),

      python: `
import hmac
import hashlib
import json

def verify_signature(payload, signature, timestamp, secret):
    if isinstance(payload, dict):
        payload = json.dumps(payload)

    signed_content = f"{timestamp}.{payload}"
    expected = hmac.new(
        secret.encode(),
        signed_content.encode(),
        hashlib.sha256
    ).hexdigest()

    return signature == expected

# Usage
is_valid = verify_signature(
    request.data,
    request.headers.get('X-Witylogix-Signature'),
    request.headers.get('X-Witylogix-Timestamp'),
    WEBHOOK_SECRET
)
      `.trim(),

      ruby: `
require 'openssl'
require 'json'

def verify_signature(payload, signature, timestamp, secret)
  payload_str = payload.is_a?(Hash) ? payload.to_json : payload
  signed_content = "#{timestamp}.#{payload_str}"

  expected = OpenSSL::HMAC.hexdigest(
    OpenSSL::Digest.new('sha256'),
    secret,
    signed_content
  )

  signature == expected
end

# Usage
is_valid = verify_signature(
  params[:payload],
  request.headers['X-Witylogix-Signature'],
  request.headers['X-Witylogix-Timestamp'],
  WEBHOOK_SECRET
)
      `.trim(),

      go: `
package main

import (
  "crypto/hmac"
  "crypto/sha256"
  "encoding/hex"
  "fmt"
)

func verifySignature(payload, signature, timestamp, secret string) bool {
  signedContent := fmt.Sprintf("%s.%s", timestamp, payload)

  h := hmac.New(sha256.New, []byte(secret))
  h.Write([]byte(signedContent))
  expected := hex.EncodeToString(h.Sum(nil))

  return hmac.Equal([]byte(signature), []byte(expected))
}

// Usage
isValid := verifySignature(
  string(body),
  r.Header.Get("X-Witylogix-Signature"),
  r.Header.Get("X-Witylogix-Timestamp"),
  WEBHOOK_SECRET,
)
      `.trim(),

      php: `
<?php

function verifySignature($payload, $signature, $timestamp, $secret) {
  if (is_array($payload)) {
    $payload = json_encode($payload);
  }

  $signedContent = "{$timestamp}.{$payload}";
  $expected = hash_hmac('sha256', $signedContent, $secret);

  return hash_equals($signature, $expected);
}

// Usage
$isValid = verifySignature(
  file_get_contents('php://input'),
  $_SERVER['HTTP_X_WITYLOGIX_SIGNATURE'] ?? '',
  $_SERVER['HTTP_X_WITYLOGIX_TIMESTAMP'] ?? '',
  WEBHOOK_SECRET
);
      `.trim(),
    };

    return {
      language,
      code: snippets[language] || snippets.nodejs,
    };
  }

  /**
   * Get all verification snippets
   */
  getAllVerificationSnippets(): CodeSnippet[] {
    const languages: Array<"nodejs" | "python" | "ruby" | "go" | "php"> = [
      "nodejs",
      "python",
      "ruby",
      "go",
      "php",
    ];
    return languages.map((lang) => this.getVerificationSnippet(lang));
  }

  /**
   * Test timestamp tolerance
   */
  testTimestampTolerance(
    payloadString: string,
    secret: string,
    toleranceSeconds: number = 300
  ): {
    current: SignatureResult;
    inTolerance: SignatureResult;
    outOfTolerance: SignatureResult;
    toleranceWindow: { start: Date; end: Date };
  } {
    const payload = payloadString;
    const currentSignature = this.generateSignature(payload, secret);

    // Create a signature from within tolerance window
    const pastTime = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const pastSignature = this.generateSignatureWithTimestamp(
      payload,
      secret,
      pastTime.toString()
    );

    // Create a signature outside tolerance window
    const farPastTime = Math.floor(Date.now() / 1000) - toleranceSeconds - 60; // Beyond tolerance
    const oldSignature = this.generateSignatureWithTimestamp(
      payload,
      secret,
      farPastTime.toString()
    );

    const now = new Date();

    return {
      current: currentSignature,
      inTolerance: pastSignature,
      outOfTolerance: oldSignature,
      toleranceWindow: {
        start: new Date(now.getTime() - toleranceSeconds * 1000),
        end: now,
      },
    };
  }

  /**
   * Generate signature with specific timestamp
   */
  private generateSignatureWithTimestamp(
    payload: string,
    secret: string,
    timestamp: string,
    algorithm: SignatureAlgorithm = "sha256"
  ): SignatureResult {
    const signedContent = `${timestamp}.${payload}`;
    const signature = createHmac(algorithm, secret)
      .update(signedContent)
      .digest("hex");

    const header = `t=${timestamp},${algorithm}=${signature}`;

    return {
      algorithm,
      signature,
      timestamp,
      payload,
      header,
    };
  }

  /**
   * Compare algorithms
   */
  compareAlgorithms(
    payload: string,
    secret: string
  ): Record<SignatureAlgorithm, string> {
    return {
      sha256: createHmac("sha256", secret).update(payload).digest("hex"),
      sha512: createHmac("sha512", secret).update(payload).digest("hex"),
    };
  }
}

// Export singleton instance
export const signatureTester = new SignatureTester();
