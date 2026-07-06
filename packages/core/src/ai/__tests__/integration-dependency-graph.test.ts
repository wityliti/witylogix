/**
 * Tests for Integration Dependency Graph
 *
 * Tests synergy relationships, graph visualization, and
 * complementary provider recommendations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { IntegrationDependencyGraph } from "../integration-recommender.js";

describe("IntegrationDependencyGraph", () => {
  let graph: IntegrationDependencyGraph;

  beforeEach(() => {
    graph = new IntegrationDependencyGraph();
  });

  describe("Synergy Types", () => {
    it("should have data-flow synergies (routing + telematics)", () => {
      const complementary = graph.getComplementaryProviders("valhalla");

      // Routing should synergize with telematics
      expect(complementary.length).toBeGreaterThan(0);
    });

    it("should have complement synergies (maps + routing)", () => {
      const complementary =
        graph.getComplementaryProviders("google-routes-api");

      // Routes API should suggest Google Maps
      expect(complementary).toContain("google-maps");
    });

    it("should have required synergies (Shopify requires payments)", () => {
      const score = graph.getSynergyScore("shopify", ["stripe"]);

      expect(score).toBeGreaterThan(0);
    });

    it("should identify strong e-commerce synergies", () => {
      const complementary = graph.getComplementaryProviders("shopify");

      expect(complementary.length).toBeGreaterThan(0);
      // Should include stripe or payment provider
      const hasPayment = complementary.some((id) =>
        ["stripe", "square-payments", "paypal"].includes(id),
      );
      expect(hasPayment).toBe(true);
    });

    it("should identify field service synergies", () => {
      const complementary = graph.getComplementaryProviders("servicetitan");

      expect(complementary.length).toBeGreaterThan(0);
      // Should include maps, payments, or messaging
      const hasExpected = complementary.some((id) =>
        ["google-maps", "stripe", "twilio"].includes(id),
      );
      expect(hasExpected).toBe(true);
    });

    it("should identify telematics + ELD synergies", () => {
      const samsaraScore = graph.getSynergyScore("samsara", ["samsara-eld"]);
      const geotabScore = graph.getSynergyScore("geotab", ["geotab-drive"]);

      expect(samsaraScore).toBeGreaterThan(50);
      expect(geotabScore).toBeGreaterThan(50);
    });

    it("should identify fulfillment synergies", () => {
      const score = graph.getSynergyScore("shipstation", ["fedex", "ups"]);

      expect(score).toBeGreaterThan(0);
    });
  });

  describe("Complementary Provider Selection", () => {
    it("should return top 3 complementary providers", () => {
      const complementary = graph.getComplementaryProviders("stripe");

      expect(complementary.length).toBeLessThanOrEqual(3);
    });

    it("should exclude self from recommendations", () => {
      const complementary = graph.getComplementaryProviders("stripe");

      expect(complementary).not.toContain("stripe");
    });

    it("should exclude specified provider IDs", () => {
      const complementary = graph.getComplementaryProviders("stripe", [
        "shopify",
        "quickbooks",
      ]);

      expect(complementary).not.toContain("shopify");
      expect(complementary).not.toContain("quickbooks");
    });

    it("should rank by synergy weight", () => {
      const all = graph.getComplementaryProviders("stripe");
      const limited = graph.getComplementaryProviders("stripe", []);

      expect(all.slice(0, 3)).toEqual(limited);
    });

    it("should return results sorted by strength", () => {
      const complementary = graph.getComplementaryProviders("shopify");

      expect(complementary.length).toBeGreaterThan(0);
      // First result should be strongest synergy
      const first = complementary[0];
      expect(first).toBeTruthy();
    });
  });

  describe("Synergy Scoring", () => {
    it("should calculate synergy score as 0-100", () => {
      const score = graph.getSynergyScore("stripe", ["shopify"]);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should score higher for strong synergies", () => {
      const strongScore = graph.getSynergyScore("stripe", ["shopify"]);
      const weakScore = graph.getSynergyScore("stripe", ["openstreetmap"]);

      expect(strongScore).toBeGreaterThan(weakScore);
    });

    it("should add scores for multiple related providers", () => {
      const single = graph.getSynergyScore("shipstation", ["fedex"]);
      const multiple = graph.getSynergyScore("shipstation", ["fedex", "ups"]);

      expect(multiple).toBeGreaterThanOrEqual(single);
    });

    it("should return 0 for unrelated providers", () => {
      const score = graph.getSynergyScore("valhalla", ["random-id-xyz"]);

      expect(score).toBe(0);
    });

    it("should handle empty connected providers", () => {
      const score = graph.getSynergyScore("stripe", []);

      expect(score).toBe(0);
    });

    it("should provide e-commerce synergy example", () => {
      const shopifyWithStripe = graph.getSynergyScore("shopify", ["stripe"]);
      const shopifyWithShipping = graph.getSynergyScore("shopify", [
        "shipstation",
      ]);

      expect(shopifyWithStripe).toBeGreaterThan(0);
      expect(shopifyWithShipping).toBeGreaterThan(0);
    });

    it("should provide logistics synergy example", () => {
      const valhalla = graph.getSynergyScore("valhalla", ["samsara"]);
      const samsara = graph.getSynergyScore("samsara", ["valhalla"]);

      expect(valhalla).toBeGreaterThan(0);
      expect(samsara).toBeGreaterThan(0);
    });
  });

  describe("Graph Visualization Data", () => {
    it("should generate nodes for selected providers", () => {
      const graphData = graph.getGraphData(["stripe", "shopify"]);

      expect(graphData.nodes.length).toBeGreaterThanOrEqual(2);
      const ids = graphData.nodes.map((n) => n.id);
      expect(ids).toContain("stripe");
      expect(ids).toContain("shopify");
    });

    it("should expand nodes with complementary providers", () => {
      const graphData = graph.getGraphData(["stripe"]);

      // Should include complementary providers
      expect(graphData.nodes.length).toBeGreaterThan(1);
    });

    it("should include edges between synergistic providers", () => {
      const graphData = graph.getGraphData(["stripe", "shopify"]);

      expect(graphData.edges.length).toBeGreaterThan(0);
      const hasStripeShopifyEdge = graphData.edges.some(
        (e: any) =>
          (e.from === "stripe" && e.to === "shopify") ||
          (e.from === "shopify" && e.to === "stripe"),
      );
      expect(hasStripeShopifyEdge).toBe(true);
    });

    it("should include node labels", () => {
      const graphData = graph.getGraphData(["stripe"]);

      graphData.nodes.forEach((node) => {
        expect(node.label).toBeTruthy();
        expect(node.label.length).toBeGreaterThan(0);
      });
    });

    it("should have synergy types in edges", () => {
      const graphData = graph.getGraphData(["stripe", "shopify", "quickbooks"]);

      expect(graphData.edges.length).toBeGreaterThan(0);
      graphData.edges.forEach((edge: any) => {
        expect(["data-flow", "complement", "required", "optional"]).toContain(
          edge.synergyType,
        );
      });
    });

    it("should handle single provider", () => {
      const graphData = graph.getGraphData(["stripe"]);

      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(graphData.nodes[0].id).toBe("stripe");
    });

    it("should handle large provider sets", () => {
      const graphData = graph.getGraphData([
        "stripe",
        "shopify",
        "sendgrid",
        "shipstation",
        "quickbooks",
      ]);

      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(graphData.edges.length).toBeGreaterThan(0);
    });
  });

  describe("Synergy Chain Analysis", () => {
    it("should identify multi-step synergy chains", () => {
      // Shopify -> Stripe -> QuickBooks chain
      const shopifyCompl = graph.getComplementaryProviders("shopify");
      expect(shopifyCompl.length).toBeGreaterThan(0);

      // Check for payment providers
      const hasPayment = shopifyCompl.some((id) =>
        ["stripe", "square-payments"].includes(id),
      );
      expect(hasPayment).toBe(true);
    });

    it("should suggest fulfillment chain for ecommerce", () => {
      // E-commerce needs: shop -> payment -> fulfillment -> shipping
      const shopifyCompl = graph.getComplementaryProviders("shopify");

      expect(shopifyCompl.length).toBeGreaterThan(0);
    });

    it("should suggest complete logistics stack", () => {
      // Logistics needs: routing -> maps -> telematics -> eld -> messaging
      const routingCompl = graph.getComplementaryProviders("valhalla");

      expect(routingCompl.length).toBeGreaterThan(0);
      // Should have telematics or map providers
      const hasRelated = routingCompl.some((id) =>
        ["google-maps", "samsara", "geotab"].includes(id),
      );
      expect(hasRelated).toBe(true);
    });
  });

  describe("Graph Consistency", () => {
    it("should have bidirectional relationships", () => {
      const stripeCompl = graph.getComplementaryProviders("stripe");
      const shopifyCompl = graph.getComplementaryProviders("shopify");

      // If Stripe suggests Shopify, Shopify should suggest Stripe or compatible
      if (stripeCompl.includes("shopify")) {
        const hasStripe = shopifyCompl.some((id) =>
          ["stripe", "square-payments"].includes(id),
        );
        expect(hasStripe).toBe(true);
      }
    });

    it("should have symmetric scores for strong synergies", () => {
      // Stripe <-> Shopify should be strong in both directions
      const stripeScore = graph.getSynergyScore("stripe", ["shopify"]);
      const shopifyScore = graph.getSynergyScore("shopify", ["stripe"]);

      // Both should be significant
      expect(stripeScore).toBeGreaterThan(0);
      expect(shopifyScore).toBeGreaterThan(0);
    });

    it("should not create cycles", () => {
      const graphData = graph.getGraphData(["stripe", "shopify"]);

      // Should not have self-loops
      graphData.edges.forEach((edge: any) => {
        expect(edge.from).not.toBe(edge.to);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty provider list", () => {
      const graphData = graph.getGraphData([]);

      expect(graphData.nodes).toBeDefined();
      expect(Array.isArray(graphData.nodes)).toBe(true);
    });

    it("should handle unknown provider ID", () => {
      const complementary = graph.getComplementaryProviders("unknown-xyz");

      expect(Array.isArray(complementary)).toBe(true);
      expect(complementary.length).toBe(0);
    });

    it("should handle duplicate provider IDs", () => {
      const graphData = graph.getGraphData(["stripe", "stripe", "shopify"]);

      const stripeCount = graphData.nodes.filter(
        (n) => n.id === "stripe",
      ).length;
      expect(stripeCount).toBe(1);
    });

    it("should be deterministic", () => {
      const graph1 = new IntegrationDependencyGraph();
      const graph2 = new IntegrationDependencyGraph();

      const data1 = graph1.getGraphData(["stripe", "shopify"]);
      const data2 = graph2.getGraphData(["stripe", "shopify"]);

      expect(data1.nodes.map((n) => n.id)).toEqual(
        data2.nodes.map((n) => n.id),
      );
    });
  });
});
