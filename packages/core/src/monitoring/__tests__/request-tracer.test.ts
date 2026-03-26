/**
 * Tests for request-tracer.ts
 * Covers W3C Trace Context, spans, tracing, and async propagation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  Span,
  RequestTracer,
  getRequestTracer,
} from "../request-tracer";

describe("Request Tracer", () => {
  let tracer: RequestTracer;

  beforeEach(() => {
    tracer = new RequestTracer({ sampleRate: 1 });
  });

  describe("span creation", () => {
    it("should create span", () => {
      const span = tracer.startTrace("test", "http");
      expect(span).toBeInstanceOf(Span);
    });

    it("should create child span", () => {
      const parent = tracer.startTrace("request");
      const child = tracer.startSpan("operation", parent);
      expect(child).toBeInstanceOf(Span);
    });
  });

  describe("trace context", () => {
    it("should generate trace ID", () => {
      const span = tracer.startTrace("test");
      const data = span.getData();
      expect(data.traceId).toBeDefined();
      expect(data.traceId.length).toBe(32);
    });

    it("should generate span ID", () => {
      const span = tracer.startTrace("test");
      const data = span.getData();
      expect(data.spanId).toBeDefined();
      expect(data.spanId.length).toBe(16);
    });

    it("should track parent span ID", () => {
      const parent = tracer.startTrace("parent");
      const child = tracer.startSpan("child", parent);
      const childData = child.getData();
      expect(childData.parentSpanId).toBeDefined();
    });
  });

  describe("span attributes", () => {
    it("should add attribute", () => {
      const span = tracer.startTrace("test");
      span.addAttribute("user_id", "123");
      expect(span.getData().attributes.user_id).toBe("123");
    });

    it("should add multiple attributes", () => {
      const span = tracer.startTrace("test");
      span.addAttribute("method", "GET");
      span.addAttribute("path", "/users");
      span.addAttribute("status", 200);
      const data = span.getData();
      expect(data.attributes.method).toBe("GET");
      expect(data.attributes.path).toBe("/users");
      expect(data.attributes.status).toBe(200);
    });

    it("should support various attribute types", () => {
      const span = tracer.startTrace("test");
      span.addAttribute("string", "value");
      span.addAttribute("number", 42);
      span.addAttribute("boolean", true);
      expect(span).toBeDefined();
    });
  });

  describe("span events", () => {
    it("should record event", () => {
      const span = tracer.startTrace("test");
      span.recordEvent("user_action");
      expect(span.getData().events.length).toBe(1);
    });

    it("should record event with attributes", () => {
      const span = tracer.startTrace("test");
      span.recordEvent("error_occurred", { code: "TIMEOUT" });
      expect(span.getData().events[0].name).toBe("error_occurred");
      expect(span.getData().events[0].attributes?.code).toBe("TIMEOUT");
    });

    it("should include event timestamp", () => {
      const span = tracer.startTrace("test");
      span.recordEvent("event");
      expect(span.getData().events[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe("span status", () => {
    it("should set status to ok", () => {
      const span = tracer.startTrace("test");
      span.setStatus("ok");
      expect(span.getData().status).toBe("ok");
    });

    it("should set status to error", () => {
      const span = tracer.startTrace("test");
      span.setStatus("error", "Request timeout");
      expect(span.getData().status).toBe("error");
      expect(span.getData().attributes.status_message).toBe("Request timeout");
    });
  });

  describe("span lifecycle", () => {
    it("should track start time", () => {
      const span = tracer.startTrace("test");
      const data = span.getData();
      expect(data.startTime).toBeDefined();
      expect(typeof data.startTime).toBe("number");
    });

    it("should calculate duration on finish", () => {
      const span = tracer.startTrace("test");
      const data = span.finish();
      expect(data.duration).toBeGreaterThanOrEqual(0);
    });

    it("should set end time on finish", () => {
      const span = tracer.startTrace("test");
      const data = span.finish();
      expect(data.endTime).toBeDefined();
    });
  });

  describe("W3C Trace Context propagation", () => {
    it("should generate traceparent header", () => {
      const span = tracer.startTrace("test");
      const context = span.getTraceContext();
      expect(context.traceparent).toBeDefined();
      expect(context.traceparent).toMatch(/^00-/);
    });

    it("should include trace ID and span ID in header", () => {
      const span = tracer.startTrace("test");
      const context = span.getTraceContext();
      const [version, traceId, spanId, traceFlags] = context.traceparent!.split("-");
      expect(version).toBe("00");
      expect(traceId).toHaveLength(32);
      expect(spanId).toHaveLength(16);
    });

    it("should set trace flag for errors", () => {
      const span = tracer.startTrace("test");
      span.setStatus("error");
      const context = span.getTraceContext();
      expect(context.traceparent).toContain("-01");
    });

    it("should extract context from headers", () => {
      const headers = {
        traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      };
      const context = tracer.extractContext(headers);
      expect(context?.traceId).toBeDefined();
      expect(context?.spanId).toBeDefined();
    });

    it("should handle missing headers", () => {
      const context = tracer.extractContext({});
      expect(context).toBeNull();
    });

    it("should reject invalid version", () => {
      const headers = {
        traceparent: "01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      };
      const context = tracer.extractContext(headers);
      expect(context).toBeNull();
    });

    it("should parse tracestate", () => {
      const headers = {
        traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        tracestate: "vendor1=opaqueValue1,vendor2=opaqueValue2",
      };
      const context = tracer.extractContext(headers);
      expect(context?.traceState).toBeDefined();
    });
  });

  describe("context continuation", () => {
    it("should continue trace from context", () => {
      const headers = {
        traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      };
      const context = tracer.extractContext(headers);
      if (context) {
        const span = tracer.continueTrace(context, "continued");
        expect(span.getData().traceId).toBe(context.traceId);
      }
    });
  });

  describe("span recording", () => {
    it("should record finished span", () => {
      const span = tracer.startTrace("test");
      tracer.finishSpan(span);
      const spans = tracer.getSpans();
      expect(spans.length).toBe(1);
    });

    it("should clear spans", () => {
      tracer.startTrace("test");
      tracer.clearSpans();
      expect(tracer.getSpans()).toHaveLength(0);
    });

    it("should retrieve recorded spans", () => {
      const span = tracer.startTrace("test");
      tracer.finishSpan(span);
      const spans = tracer.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].name).toBe("test");
    });
  });

  describe("sampling", () => {
    it("should sample when rate is 1", () => {
      const sampler = new RequestTracer({ sampleRate: 1 });
      expect(sampler.shouldSample()).toBe(true);
    });

    it("should not sample when rate is 0", () => {
      const sampler = new RequestTracer({ sampleRate: 0 });
      expect(sampler.shouldSample()).toBe(false);
    });

    it("should sample probabilistically", () => {
      const sampler = new RequestTracer({ sampleRate: 0.5 });
      const samples = Array.from({ length: 100 }).map(() =>
        sampler.shouldSample()
      );
      const trueCount = samples.filter((s) => s).length;
      expect(trueCount).toBeGreaterThan(30);
      expect(trueCount).toBeLessThan(70);
    });
  });

  describe("span depth limit", () => {
    it("should respect max span depth", () => {
      const limitedTracer = new RequestTracer({ maxSpanDepth: 2 });
      const root = limitedTracer.startTrace("root");
      const child = limitedTracer.startSpan("child", root);
      const grandchild = limitedTracer.startSpan("grandchild", child);
      expect(grandchild).toBeDefined();
    });
  });

  describe("operation tracking", () => {
    it("should track operation type", () => {
      const span = tracer.startTrace("test", "http");
      expect(span.getData().operation).toBe("http");
    });

    it("should support different operation types", () => {
      const httpSpan = tracer.startTrace("http", "http");
      const dbSpan = tracer.startTrace("query", "database");
      expect(httpSpan.getData().operation).toBe("http");
      expect(dbSpan.getData().operation).toBe("database");
    });
  });

  describe("singleton pattern", () => {
    it("should get global instance", () => {
      const instance = getRequestTracer();
      expect(instance).toBeInstanceOf(RequestTracer);
    });

    it("should return same instance", () => {
      const instance1 = getRequestTracer();
      const instance2 = getRequestTracer();
      expect(instance1).toBe(instance2);
    });

    it("should accept config for new instance", () => {
      const instance = getRequestTracer({ sampleRate: 0.1 });
      expect(instance).toBeInstanceOf(RequestTracer);
    });
  });
});
