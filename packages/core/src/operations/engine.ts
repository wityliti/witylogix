/**
 * Activity Flow Engine (ADR-030).
 *
 * Stateless module that loads tenant-defined activity flows, validates
 * transitions, persists the new stage on the target entity, and emits
 * domain events so webhooks and the event bus pick them up.
 *
 * This intentionally does NOT live in BullMQ — it models *what an
 * entity is*, not *what the system does* (see `packages/framework`).
 */

import { prisma } from "@witylogix/db";
import { getWebhookManager, WebhookEventEmitter } from "../webhooks/index.js";
import type { FlowGraph, FlowStage, FlowValidationError } from "./types.js";

type ActivityEntityType = "SHIPMENT" | "ORDER";
type ActivityFlowStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type JsonInput =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonInput }
  | JsonInput[];
// `ActivityFlow` return type is inferred from Prisma calls — the core
// module intentionally does not duplicate the generated row shape.
type ActivityFlow = Awaited<
  ReturnType<typeof prisma.activityFlow.findUnique>
> & {};

// ─── Graph helpers ──────────────────────────────────────────

export function parseGraph(raw: unknown): FlowGraph {
  if (!raw || typeof raw !== "object") return { stages: [] };
  const maybeStages = (raw as { stages?: unknown }).stages;
  if (!Array.isArray(maybeStages)) return { stages: [] };
  return { stages: maybeStages as FlowStage[] };
}

export function validateGraph(graph: FlowGraph): FlowValidationError[] {
  const errors: FlowValidationError[] = [];
  const keys = new Set<string>();
  let initialCount = 0;

  for (const stage of graph.stages) {
    if (!stage.key || typeof stage.key !== "string") {
      errors.push({ code: "INVALID_STAGE", message: "Stage is missing a key" });
      continue;
    }
    if (keys.has(stage.key)) {
      errors.push({
        code: "DUPLICATE_KEY",
        message: `Duplicate stage key: ${stage.key}`,
      });
    }
    keys.add(stage.key);
    if (stage.isInitial) initialCount++;
  }

  if (graph.stages.length > 0 && initialCount !== 1) {
    errors.push({
      code: "NO_INITIAL",
      message: `Flow must have exactly one initial stage (found ${initialCount})`,
    });
  }

  for (const stage of graph.stages) {
    for (const t of stage.transitions ?? []) {
      if (!keys.has(t.to)) {
        errors.push({
          code: "UNKNOWN_TARGET",
          message: `Stage "${stage.key}" transitions to unknown stage "${t.to}"`,
        });
      }
      if (stage.isTerminal) {
        errors.push({
          code: "INVALID_TRANSITION",
          message: `Terminal stage "${stage.key}" cannot have transitions`,
        });
      }
    }
  }

  return errors;
}

export function findStage(
  graph: FlowGraph,
  key: string,
): FlowStage | undefined {
  return graph.stages.find((s) => s.key === key);
}

export function initialStage(graph: FlowGraph): FlowStage | undefined {
  return graph.stages.find((s) => s.isInitial);
}

export function listAllowedNextStages(
  graph: FlowGraph,
  currentKey: string,
): FlowStage[] {
  const current = findStage(graph, currentKey);
  if (!current || current.isTerminal) return [];
  const keyToStage = new Map(graph.stages.map((s) => [s.key, s]));
  return current.transitions
    .map((t) => keyToStage.get(t.to))
    .filter((s): s is FlowStage => Boolean(s));
}

// ─── CRUD ───────────────────────────────────────────────────

export interface CreateFlowInput {
  shopId: string;
  entityType: ActivityEntityType;
  key: string;
  name: string;
  description?: string;
  graph: FlowGraph;
  isDefault?: boolean;
  status?: ActivityFlowStatus;
}

export async function createFlow(
  input: CreateFlowInput,
): Promise<ActivityFlow> {
  const errs = validateGraph(input.graph);
  if (errs.length > 0) {
    throw new FlowValidationException(errs);
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.activityFlow.updateMany({
        where: {
          shopId: input.shopId,
          entityType: input.entityType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }
    return tx.activityFlow.create({
      data: {
        shopId: input.shopId,
        entityType: input.entityType,
        key: input.key,
        name: input.name,
        description: input.description,
        graph: input.graph as unknown as object,
        isDefault: input.isDefault ?? false,
        status: input.status ?? "DRAFT",
      },
    });
  });
}

export interface UpdateFlowInput {
  id: string;
  shopId: string;
  name?: string;
  description?: string;
  graph?: FlowGraph;
  isDefault?: boolean;
  status?: ActivityFlowStatus;
}

export async function updateFlow(
  input: UpdateFlowInput,
): Promise<ActivityFlow> {
  if (input.graph) {
    const errs = validateGraph(input.graph);
    if (errs.length > 0) throw new FlowValidationException(errs);
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.activityFlow.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.shopId !== input.shopId) {
      throw new FlowNotFoundError(`Flow ${input.id} not found for this shop`);
    }
    if (input.isDefault) {
      await tx.activityFlow.updateMany({
        where: {
          shopId: existing.shopId,
          entityType: existing.entityType,
          isDefault: true,
          id: { not: existing.id },
        },
        data: { isDefault: false },
      });
    }
    const data: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      isDefault: input.isDefault,
      status: input.status,
      version: { increment: input.graph ? 1 : 0 },
    };
    if (input.graph) {
      data.graph = input.graph as unknown as object;
    }
    return tx.activityFlow.update({ where: { id: input.id }, data });
  });
}

export async function listFlows(
  shopId: string,
  entityType?: ActivityEntityType,
): Promise<ActivityFlow[]> {
  return prisma.activityFlow.findMany({
    where: { shopId, ...(entityType ? { entityType } : {}) },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getFlow(
  id: string,
  shopId: string,
): Promise<ActivityFlow | null> {
  const row = await prisma.activityFlow.findUnique({ where: { id } });
  if (!row || row.shopId !== shopId) return null;
  return row;
}

export async function deleteFlow(id: string, shopId: string): Promise<void> {
  const existing = await prisma.activityFlow.findUnique({ where: { id } });
  if (!existing || existing.shopId !== shopId) {
    throw new FlowNotFoundError(`Flow ${id} not found for this shop`);
  }
  await prisma.activityFlow.delete({ where: { id } });
}

export async function getDefaultFlow(
  shopId: string,
  entityType: ActivityEntityType,
): Promise<ActivityFlow | null> {
  return prisma.activityFlow.findFirst({
    where: { shopId, entityType, isDefault: true, status: "ACTIVE" },
  });
}

// ─── Transitions ────────────────────────────────────────────

export interface TransitionInput {
  entityId: string;
  toStage: string;
  /**
   * Scopes held by the caller. When the target transition has a
   * `requiredScope`, it must be present in this array. Human principals
   * (dashboard/driver) can pass `['*']` to bypass scope checks since
   * their role-based ACLs are the source of truth.
   */
  scopes?: string[];
  /** Optional context merged into the emitted domain event. */
  reason?: string;
  actor?: { type: "user" | "app" | "system"; id?: string };
}

export interface TransitionResult {
  flowId: string;
  flowKey: string;
  fromStage: string | null;
  toStage: string;
  occurredAt: string;
  allowedNext: FlowStage[];
}

export async function transitionShipment(
  input: TransitionInput,
): Promise<TransitionResult> {
  return transitionEntity("SHIPMENT", input);
}

export async function transitionOrder(
  input: TransitionInput,
): Promise<TransitionResult> {
  return transitionEntity("ORDER", input);
}

async function transitionEntity(
  entityType: ActivityEntityType,
  input: TransitionInput,
): Promise<TransitionResult> {
  const { entityId, toStage, scopes = [], actor, reason } = input;

  const entity = await loadEntity(entityType, entityId);
  if (!entity) {
    throw new FlowNotFoundError(
      `${entityType.toLowerCase()} ${entityId} not found`,
    );
  }

  const flow = await resolveFlowForEntity(entityType, entity);
  if (!flow) {
    throw new FlowNotFoundError(
      `No active activity flow configured for ${entityType.toLowerCase()} in this shop`,
    );
  }

  const graph = parseGraph(flow.graph);
  const fromKey: string | null =
    entity.currentStageKey ?? initialStage(graph)?.key ?? null;
  if (!fromKey) {
    throw new FlowTransitionError(
      "Entity has no current stage and flow has no initial stage",
    );
  }

  const fromStage = findStage(graph, fromKey);
  if (!fromStage) {
    throw new FlowTransitionError(
      `Current stage "${fromKey}" is not part of the flow`,
    );
  }
  if (fromStage.isTerminal) {
    throw new FlowTransitionError(
      `Cannot transition out of terminal stage "${fromKey}"`,
    );
  }

  const transition = fromStage.transitions.find((t) => t.to === toStage);
  if (!transition) {
    throw new FlowTransitionError(
      `Transition from "${fromKey}" to "${toStage}" is not allowed`,
    );
  }

  if (
    transition.requiredScope &&
    !scopes.includes("*") &&
    !scopes.includes(transition.requiredScope)
  ) {
    throw new FlowTransitionError(
      `Caller is missing required scope "${transition.requiredScope}" for this transition`,
    );
  }

  const occurredAt = new Date();
  await persistStage(entityType, entityId, flow.id, toStage);

  const eventType =
    entityType === "SHIPMENT"
      ? "shipment.stage_changed"
      : "order.stage_changed";
  await emitEvent(flow.shopId, eventType, {
    entityId,
    entityType,
    flowId: flow.id,
    flowKey: flow.key,
    fromStage: fromKey,
    toStage,
    reason,
    actor,
    occurredAt: occurredAt.toISOString(),
  });

  return {
    flowId: flow.id,
    flowKey: flow.key,
    fromStage: fromKey,
    toStage,
    occurredAt: occurredAt.toISOString(),
    allowedNext: listAllowedNextStages(graph, toStage),
  };
}

interface EntityRow {
  id: string;
  shopId: string;
  activityFlowId: string | null;
  currentStageKey: string | null;
}

async function loadEntity(
  entityType: ActivityEntityType,
  id: string,
): Promise<EntityRow | null> {
  if (entityType === "SHIPMENT") {
    const row = await prisma.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        shopId: true,
        activityFlowId: true,
        currentStageKey: true,
      },
    });
    return row ?? null;
  }
  const row = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      shopId: true,
      activityFlowId: true,
      currentStageKey: true,
    },
  });
  return row ?? null;
}

async function resolveFlowForEntity(
  entityType: ActivityEntityType,
  entity: EntityRow,
): Promise<ActivityFlow | null> {
  if (entity.activityFlowId) {
    return prisma.activityFlow.findUnique({
      where: { id: entity.activityFlowId },
    });
  }
  return getDefaultFlow(entity.shopId, entityType);
}

async function persistStage(
  entityType: ActivityEntityType,
  entityId: string,
  flowId: string,
  stageKey: string,
): Promise<void> {
  if (entityType === "SHIPMENT") {
    await prisma.shipment.update({
      where: { id: entityId },
      data: { activityFlowId: flowId, currentStageKey: stageKey },
    });
    return;
  }
  await prisma.order.update({
    where: { id: entityId },
    data: { activityFlowId: flowId, currentStageKey: stageKey },
  });
}

// Lazily initialise the webhook emitter so test environments that stub
// prisma don't fail to import the module.
let emitter: WebhookEventEmitter | null = null;
function getEmitter(): WebhookEventEmitter {
  if (!emitter) {
    emitter = new WebhookEventEmitter(getWebhookManager(prisma), prisma);
  }
  return emitter;
}

async function emitEvent(
  shopId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await getEmitter().emit(shopId, eventType, data, "operations");
  } catch (err) {
    // Never fail a transition because webhook delivery failed — the
    // transition has already been persisted and downstream consumers
    // can replay via the event store.
    console.error(`[operations] failed to emit ${eventType}:`, err);
  }
}

// ─── Public lookups ─────────────────────────────────────────

export async function listAllowedNextForEntity(
  entityType: ActivityEntityType,
  entityId: string,
): Promise<{
  flow: ActivityFlow;
  currentStage: string | null;
  next: FlowStage[];
} | null> {
  const entity = await loadEntity(entityType, entityId);
  if (!entity) return null;
  const flow = await resolveFlowForEntity(entityType, entity);
  if (!flow) return null;
  const graph = parseGraph(flow.graph);
  const currentKey = entity.currentStageKey ?? initialStage(graph)?.key ?? null;
  return {
    flow,
    currentStage: currentKey,
    next: currentKey ? listAllowedNextStages(graph, currentKey) : [],
  };
}

// ─── Errors ────────────────────────────────────────────────

export class FlowValidationException extends Error {
  constructor(public readonly errors: FlowValidationError[]) {
    super(
      `Activity flow graph is invalid: ${errors.map((e) => e.message).join("; ")}`,
    );
    this.name = "FlowValidationException";
  }
}

export class FlowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowNotFoundError";
  }
}

export class FlowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowTransitionError";
  }
}
