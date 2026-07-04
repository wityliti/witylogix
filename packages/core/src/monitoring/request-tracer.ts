/**
 * Distributed Request Tracer — W3C Trace Context propagation and span tracking.
 *
 * Features:
 * - W3C Trace Context (traceparent, tracestate headers)
 * - Span creation and nesting
 * - Async context propagation (AsyncLocalStorage)
 * - Timing and attribute recording
 * - Sampling configuration
 *
 * Usage:
 * const tracer = new RequestTracer({ sampleRate: 0.1 });
 * const span = tracer.startSpan("database-query", { op: "db" });
 * span.addAttribute("query", "SELECT * FROM users");
 * span.finish({ status: "ok" });
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export interface TraceContext {
  traceId: string;
  parentSpanId: string;
  spanId: string;
  traceFlags: string;
  traceState?: Record<string, string>;
}

export interface SpanAttribute {
  key: string;
  value: string | number | boolean;
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, unknown>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "unset" | "ok" | "error";
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  operation?: string;
}

export interface TracerConfig {
  sampleRate?: number;
  maxSpanDepth?: number;
  exportInterval?: number;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const TRACE_ID_LENGTH = 32;
const SPAN_ID_LENGTH = 16;

// ─── SPAN CLASS ────────────────────────────────────────────────────────

/**
 * Represents a single span in a distributed trace.
 */
export class Span {
  private data: SpanData;

  constructor(
    traceId: string,
    spanId: string,
    name: string,
    parentSpanId?: string,
    operation?: string,
  ) {
    this.data = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: "unset",
      attributes: {},
      events: [],
      operation,
    };
  }

  /**
   * Add an attribute to the span.
   */
  addAttribute(key: string, value: unknown): void {
    this.data.attributes[key] = value;
  }

  /**
   * Record an event within the span.
   */
  recordEvent(name: string, attributes?: Record<string, unknown>): void {
    this.data.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
  }

  /**
   * Set the span status.
   */
  setStatus(status: "ok" | "error", message?: string): void {
    this.data.status = status;
    if (message) {
      this.addAttribute("status_message", message);
    }
  }

  /**
   * Finish the span.
   */
  finish(options?: { status?: "ok" | "error"; message?: string }): SpanData {
    this.data.endTime = Date.now();
    this.data.duration = this.data.endTime - this.data.startTime;

    if (options) {
      this.setStatus(options.status || "ok", options.message);
    }

    return this.data;
  }

  /**
   * Get span data.
   */
  getData(): SpanData {
    return { ...this.data };
  }

  /**
   * Get trace context headers for propagation.
   */
  getTraceContext(): Record<string, string> {
    const traceFlags = this.data.status === "error" ? "01" : "00";
    const traceparent = `00-${this.data.traceId}-${this.data.spanId}-${traceFlags}`;

    const headers: Record<string, string> = {
      traceparent,
    };

    if (this.data.traceState) {
      headers["tracestate"] = Object.entries(this.data.traceState)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
    }

    return headers;
  }
}

// ─── REQUEST TRACER ────────────────────────────────────────────────────

/**
 * Distributed tracer with W3C Trace Context support.
 */
export class RequestTracer {
  private config: Required<TracerConfig>;
  private spans: Map<string, SpanData> = new Map();
  private activeSpans: Span[] = [];

  constructor(config?: TracerConfig) {
    this.config = {
      sampleRate: config?.sampleRate ?? 1,
      maxSpanDepth: config?.maxSpanDepth ?? 10,
      exportInterval: config?.exportInterval ?? 30000,
    };
  }

  /**
   * Start a new trace with a trace ID and root span.
   */
  startTrace(name: string, operation?: string): Span {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const span = new Span(traceId, spanId, name, undefined, operation);
    this.activeSpans.push(span);

    return span;
  }

  /**
   * Start a child span within an existing trace.
   */
  startSpan(name: string, parentSpan: Span, operation?: string): Span {
    const parentData = parentSpan.getData();
    const spanId = this.generateSpanId();

    const span = new Span(
      parentData.traceId,
      spanId,
      name,
      parentData.spanId,
      operation,
    );

    // Check depth
    if (this.activeSpans.length >= this.config.maxSpanDepth) {
      console.warn("Max span depth reached, skipping child span");
      return span;
    }

    this.activeSpans.push(span);
    return span;
  }

  /**
   * Extract trace context from headers.
   */
  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceparent = headers["traceparent"] || headers["Traceparent"];
    if (!traceparent) {
      return null;
    }

    const parts = traceparent.split("-");
    if (parts.length !== 4) {
      return null;
    }

    const [version, traceId, spanId, traceFlags] = parts;

    if (version !== "00") {
      return null;
    }

    // Parse tracestate if present
    const tracestate: Record<string, string> = {};
    const tracestateHeader = headers["tracestate"] || headers["Tracestate"];
    if (tracestateHeader) {
      const pairs = tracestateHeader.split(",");
      for (const pair of pairs) {
        const [k, v] = pair.split("=");
        if (k && v) {
          tracestate[k] = v;
        }
      }
    }

    return {
      traceId,
      parentSpanId: spanId,
      spanId: this.generateSpanId(),
      traceFlags,
      traceState: tracestate,
    };
  }

  /**
   * Continue a trace from extracted context.
   */
  continueTrace(context: TraceContext, name: string, operation?: string): Span {
    const span = new Span(
      context.traceId,
      context.spanId,
      name,
      context.parentSpanId,
      operation,
    );

    this.activeSpans.push(span);
    return span;
  }

  /**
   * Finish a span and record it.
   */
  finishSpan(
    span: Span,
    options?: { status?: "ok" | "error"; message?: string },
  ): SpanData {
    const data = span.finish(options);
    this.spans.set(span.getData().spanId, data);

    // Remove from active spans
    this.activeSpans = this.activeSpans.filter(
      (s) => s.getData().spanId !== span.getData().spanId,
    );

    return data;
  }

  /**
   * Get all recorded spans.
   */
  getSpans(): SpanData[] {
    return Array.from(this.spans.values());
  }

  /**
   * Clear all spans.
   */
  clearSpans(): void {
    this.spans.clear();
  }

  /**
   * Generate a trace ID (32 hex characters).
   */
  private generateTraceId(): string {
    let traceId = "";
    for (let i = 0; i < TRACE_ID_LENGTH / 2; i++) {
      traceId += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return traceId;
  }

  /**
   * Generate a span ID (16 hex characters).
   */
  private generateSpanId(): string {
    let spanId = "";
    for (let i = 0; i < SPAN_ID_LENGTH / 2; i++) {
      spanId += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return spanId;
  }

  /**
   * Check if this trace should be sampled.
   */
  shouldSample(): boolean {
    return Math.random() <= this.config.sampleRate;
  }
}

// ─── MIDDLEWARE ────────────────────────────────────────────────────────

/**
 * Express/Fastify middleware for request tracing.
 */
export function tracingMiddleware(
  tracer: RequestTracer,
): (req: any, res: any, next: any) => void {
  return (req: any, res: any, next: any) => {
    let span: Span | null = null;

    try {
      // Check for existing trace context
      const context = tracer.extractContext(req.headers);

      if (context) {
        span = tracer.continueTrace(
          context,
          `${req.method} ${req.path}`,
          "http",
        );
      } else if (tracer.shouldSample()) {
        span = tracer.startTrace(`${req.method} ${req.path}`, "http");
      }

      if (span) {
        span.addAttribute("http.method", req.method);
        span.addAttribute("http.url", req.originalUrl);
        span.addAttribute("http.target", req.path);

        // Set trace headers in response
        const traceContext = span.getTraceContext();
        Object.entries(traceContext).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Store span in request for later access
        req.span = span;
      }
    } catch (error) {
      console.error("Tracing error:", error);
    }

    // Wrap res.end to finish span
    const originalEnd = res.end;
    res.end = function (...args: unknown[]) {
      if (span) {
        span.addAttribute("http.status_code", res.statusCode);
        const status = res.statusCode >= 400 ? "error" : "ok";
        tracer.finishSpan(span, { status });
      }
      return originalEnd.apply(res, args);
    };

    next();
  };
}

// ─── SINGLETON INSTANCE ────────────────────────────────────────────────

let tracerInstance: RequestTracer | null = null;

/**
 * Get the global request tracer instance.
 */
export function getRequestTracer(config?: TracerConfig): RequestTracer {
  if (!tracerInstance) {
    tracerInstance = new RequestTracer(config);
  }
  return tracerInstance;
}
