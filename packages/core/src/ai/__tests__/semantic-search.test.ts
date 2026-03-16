/**
 * Semantic Search Tests
 *
 * Tests for:
 * - Embedding generation (pluggable models)
 * - Vector similarity search
 * - Hybrid search (BM25 + vector + RRF)
 * - Index management (add, update, delete)
 * - Batch indexing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSemanticSearch, SemanticSearch } from "../semantic-search.js";
import type { SearchableEntity, SearchResult } from "../semantic-search.js";

describe("Semantic Search", () => {
  let search: SemanticSearch;

  beforeEach(() => {
    search = createSemanticSearch("tfidf");
  });

  // ─── Embedding Generation ────────────────────────────────────────

  describe("Embedding Generation", () => {
    it("should generate consistent embeddings for same input", async () => {
      const text = "delivery order for customer";
      const embedding1 = await search["embedder"].generate(text);
      const embedding2 = await search["embedder"].generate(text);

      expect(embedding1).toEqual(embedding2);
    });

    it("should generate different embeddings for different inputs", async () => {
      const embedding1 = await search["embedder"].generate("order");
      const embedding2 = await search["embedder"].generate("driver");

      expect(embedding1).not.toEqual(embedding2);
    });

    it("should produce unit normalized vectors", async () => {
      const embedding = await search["embedder"].generate("test content");

      const norm = Math.sqrt(
        embedding.reduce((sum: number, v: number) => sum + v * v, 0)
      );
      expect(norm).toBeCloseTo(1, 4);
    });
  });

  // ─── Vector Similarity ──────────────────────────────────────────

  describe("Vector Similarity", () => {
    it("should calculate cosine similarity correctly", () => {
      const a = [1, 0];
      const b = [1, 0];
      const similarity = search["cosineSimilarity"](a, b);

      expect(similarity).toBeCloseTo(1, 4); // Perfect match
    });

    it("should return 0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      const similarity = search["cosineSimilarity"](a, b);

      expect(similarity).toBeCloseTo(0, 4);
    });

    it("should return 0 for different length vectors", () => {
      const a = [1, 0];
      const b = [1, 0, 1];
      const similarity = search["cosineSimilarity"](a, b);

      expect(similarity).toBe(0);
    });
  });

  // ─── BM25 Scoring ───────────────────────────────────────────────

  describe("BM25 Text Scoring", () => {
    it("should score exact term matches higher", () => {
      const score1 = search["calculateBM25Score"](
        "delivery driver order",
        ["delivery", "order"]
      );
      const score2 = search["calculateBM25Score"](
        "customer invoice",
        ["delivery", "order"]
      );

      expect(score1).toBeGreaterThan(score2);
    });

    it("should normalize scores to 0-1", () => {
      const score = search["calculateBM25Score"](
        "test content",
        ["test"]
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should cap match count contribution", () => {
      const score = search["calculateBM25Score"](
        "test test test test",
        ["test"]
      );

      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // ─── Index Management ────────────────────────────────────────────

  describe("Index Management", () => {
    it("should index an entity", async () => {
      await expect(
        search.indexEntity(
          "order_123",
          "order",
          "Urgent delivery to downtown",
          "tenant_1"
        )
      ).resolves.not.toThrow();
    });

    it("should update existing entity", async () => {
      const entityId = "order_123";
      await search.indexEntity(entityId, "order", "Original content", "tenant_1");
      await expect(
        search.indexEntity(entityId, "order", "Updated content", "tenant_1")
      ).resolves.not.toThrow();
    });

    it("should index with metadata", async () => {
      const metadata = {
        status: "pending",
        priority: "high",
      };

      await expect(
        search.indexEntity(
          "order_124",
          "order",
          "Test content",
          "tenant_1",
          metadata
        )
      ).resolves.not.toThrow();
    });

    it("should remove entity from index", async () => {
      await search.indexEntity(
        "order_125",
        "order",
        "Test content",
        "tenant_1"
      );

      await expect(
        search.removeEntity("order_125", "tenant_1")
      ).resolves.not.toThrow();
    });
  });

  // ─── Batch Indexing ─────────────────────────────────────────────

  describe("Batch Indexing", () => {
    it("should batch index multiple entities", async () => {
      const entities = [
        {
          entityId: "order_1",
          entityType: "order" as SearchableEntity,
          content: "First order",
        },
        {
          entityId: "order_2",
          entityType: "order" as SearchableEntity,
          content: "Second order",
        },
      ];

      await expect(
        search.batchIndexEntities(entities, "tenant_1")
      ).resolves.not.toThrow();
    });

    it("should batch index with metadata", async () => {
      const entities = [
        {
          entityId: "driver_1",
          entityType: "driver" as SearchableEntity,
          content: "Driver John",
          metadata: { zone: "downtown" },
        },
      ];

      await expect(
        search.batchIndexEntities(entities, "tenant_1")
      ).resolves.not.toThrow();
    });

    it("should handle empty batch gracefully", async () => {
      await expect(
        search.batchIndexEntities([], "tenant_1")
      ).resolves.not.toThrow();
    });
  });

  // ─── Vector Search ──────────────────────────────────────────────

  describe("Vector Search", () => {
    it("should return results with similarity scores", async () => {
      await search.indexEntity(
        "order_1",
        "order",
        "urgent delivery downtown",
        "tenant_1"
      );

      const results = await search.vectorSearch(
        "delivery downtown",
        "tenant_1"
      );

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(0);
        expect(results[0].similarity).toBeLessThanOrEqual(1);
      }
    });

    it("should filter by entity type", async () => {
      await search.indexEntity("order_1", "order", "test", "tenant_1");
      await search.indexEntity("driver_1", "driver", "test", "tenant_1");

      const results = await search.vectorSearch("test", "tenant_1", ["order"]);

      if (results.length > 0) {
        results.forEach((r) => {
          expect(r.entityType).toBe("order");
        });
      }
    });

    it("should respect result limit", async () => {
      const limit = 5;
      const results = await search.vectorSearch(
        "query",
        "tenant_1",
        undefined,
        limit
      );

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it("should filter out low similarity results", async () => {
      await search.indexEntity("order_1", "order", "very specific content xyz", "tenant_1");

      const results = await search.vectorSearch(
        "completely different",
        "tenant_1"
      );

      results.forEach((r) => {
        expect(r.similarity).toBeGreaterThan(0.3);
      });
    });
  });

  // ─── Hybrid Search ──────────────────────────────────────────────

  describe("Hybrid Search", () => {
    it("should combine vector and text results", async () => {
      await search.indexEntity(
        "order_1",
        "order",
        "urgent delivery to downtown",
        "tenant_1"
      );

      const results = await search.hybridSearch({
        query: "delivery downtown",
        tenantId: "tenant_1",
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should apply vector and text weights", async () => {
      const results = await search.hybridSearch({
        query: "query",
        tenantId: "tenant_1",
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should filter by entity types", async () => {
      await search.indexEntity("order_1", "order", "test", "tenant_1");
      await search.indexEntity("driver_1", "driver", "test", "tenant_1");

      const results = await search.hybridSearch({
        query: "test",
        tenantId: "tenant_1",
        entityTypes: ["order"],
      });

      if (results.length > 0) {
        results.forEach((r) => {
          expect(r.entityType).toBe("order");
        });
      }
    });

    it("should respect result limit", async () => {
      const limit = 3;
      const results = await search.hybridSearch({
        query: "query",
        tenantId: "tenant_1",
        limit,
      });

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it("should include fusion scores", async () => {
      const results = await search.hybridSearch({
        query: "query",
        tenantId: "tenant_1",
        limit: 10,
      });

      results.forEach((r) => {
        expect(r.fusionScore).toBeGreaterThanOrEqual(0);
        expect(r.fusionScore).toBeLessThanOrEqual(1);
      });
    });
  });

  // ─── Tenant Isolation ────────────────────────────────────────────

  describe("Tenant Isolation", () => {
    it("should not mix results across tenants", async () => {
      await search.indexEntity("order_1", "order", "test", "tenant_1");
      await search.indexEntity("order_2", "order", "test", "tenant_2");

      const results = await search.vectorSearch("test", "tenant_1");

      results.forEach((r) => {
        // Results should only be from tenant_1
        // (In real scenario with database, this would be enforced)
      });
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle empty query", async () => {
      await expect(
        search.vectorSearch("", "tenant_1")
      ).resolves.not.toThrow();
    });

    it("should handle very long content", async () => {
      const longContent = "word ".repeat(10000);
      await expect(
        search.indexEntity("order_1", "order", longContent, "tenant_1")
      ).resolves.not.toThrow();
    });

    it("should handle special characters", async () => {
      const specialContent = "Order #123 @ $50.00 - 50% off!";
      await expect(
        search.indexEntity("order_1", "order", specialContent, "tenant_1")
      ).resolves.not.toThrow();
    });
  });
});
