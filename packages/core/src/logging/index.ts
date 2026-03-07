/**
 * Structured Logging Module
 * Exports public API for logging and request tracing
 */

export {
  // Types
  LogLevel,
  type LogEntry,
  type LoggerConfig,
  type RequestContext,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_HEADERS,
} from './types.js';

export {
  // Logger
  Logger,
  createLogger,
} from './logger.js';

export {
  // Request logger plugin
  createRequestLoggerPlugin,
  attachRequestContext,
  generateTraceId,
  getRequestContext,
} from './request-logger.js';
