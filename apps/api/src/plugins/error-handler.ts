/**
 * Global error handler — maps application errors to structured JSON responses.
 * Also handles Zod validation errors and unexpected errors.
 */

import type {
  FastifyInstance,
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { captureException } from "../lib/sentry.js";

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(
    (
      error: FastifyError | Error,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      // Application errors (expected, thrown by our code)
      if (error instanceof AppError) {
        request.log.warn(
          { err: error, statusCode: error.statusCode },
          error.message,
        );
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        });
      }

      // Zod validation errors
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }));
        request.log.warn({ err: error }, "Validation error");
        return reply.status(422).send({
          statusCode: 422,
          error: "VALIDATION_ERROR",
          message: "Request validation failed",
          details,
        });
      }

      // Fastify-native validation errors
      if ((error as FastifyError).validation) {
        request.log.warn({ err: error }, "Schema validation error");
        return reply.status(422).send({
          statusCode: 422,
          error: "VALIDATION_ERROR",
          message: error.message,
        });
      }

      // JWT errors from @fastify/jwt. Match on the library's error CODE, not a
      // substring of the message — otherwise unrelated errors that merely mention
      // "token" (e.g. a Prisma error whose context includes a "refresh token"
      // comment) get masked as a 401 auth failure, hiding the real bug.
      if (
        typeof (error as FastifyError).code === "string" &&
        (error as FastifyError).code.startsWith("FST_JWT")
      ) {
        request.log.warn({ err: error }, "Auth error");
        return reply.status(401).send({
          statusCode: 401,
          error: "UNAUTHORIZED",
          message: "Invalid or expired authentication token",
        });
      }

      // Prisma errors
      if (error.name === "PrismaClientKnownRequestError") {
        const prismaError = error as any;
        if (prismaError.code === "P2002") {
          request.log.warn({ err: error }, "Unique constraint violation");
          return reply.status(409).send({
            statusCode: 409,
            error: "CONFLICT",
            message: `A record with that value already exists`,
            details: { fields: prismaError.meta?.target },
          });
        }
        if (prismaError.code === "P2025") {
          request.log.warn({ err: error }, "Record not found");
          return reply.status(404).send({
            statusCode: 404,
            error: "NOT_FOUND",
            message: "Record not found",
          });
        }
      }

      // Unexpected errors — log full stack, capture to Sentry, return generic message
      request.log.error({ err: error }, "Unhandled error");
      void captureException(error, {
        url: request.url,
        method: request.method,
      });
      return reply.status(500).send({
        statusCode: 500,
        error: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "development"
            ? error.message
            : "An unexpected error occurred",
      });
    },
  );
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
