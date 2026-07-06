/**
 * Global error handler — maps application errors to structured JSON responses.
 * Also handles Zod validation errors and unexpected errors.
 */
import type { FastifyInstance } from "fastify";
declare function errorHandlerPlugin(fastify: FastifyInstance): Promise<void>;
declare const _default: typeof errorHandlerPlugin;
export default _default;
//# sourceMappingURL=error-handler.d.ts.map
