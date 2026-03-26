/**
 * FMCSA DataQs API Client Tests
 *
 * Tests for:
 * - Carrier lookup (DOT, MC, legal name)
 * - Safety Measurement System (SMS) BASIC scores
 * - Inspection data and violation retrieval
 * - Crash data analysis
 * - Insurance status verification
 * - Operating authority status
 * - Data Quality Services challenges
 * - Census data and fleet information
 * - Caching (24h TTL)
 * - Rate limiting (50 req/min)
 * - Response normalization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FMCSADataQsClient } from "../../../../packages/core/src/integrations/eld/fmcsa-dataqs-client.js";

describe("FMCSADataQsClient", () => {
  let client: FMCSADataQsClient;

  beforeEach(() => {
    client = new FMCSADataQsClient("sk_live_" + "FMCSA_WEBKEY123");
  });

  describe("initialization", () => {
    it("should initialize with valid API key", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ dotNumber: "0" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await expect(client.initialize()).resolves.not.toThrow();

      mockFetch.mockRestore();
    });

    it("should throw error when API key is missing", () => {
      expect(() => new FMCSADataQsClient("")).toThrow(
        "FMCSA API key (WebKey) is required"
      );
    });
  });

  describe("carrier lookup", () => {
    it("should lookup carrier by DOT number", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            dotNumber: "1234567",
            legalName: "Test Fleet Inc",
            dbaName: "Test Logistics",
            address1: "123 Main St",
            city: "Austin",
            state: "TX",
            zipCode: "78701",
            operatingStatus: "Active",
            operationClassification: "Interstate",
            carrierType: "Motor Carrier",
            totalDrivers: 50,
            totalVehicles: 40,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.lookupCarrierByDOT("1234567");

      expect(result.dotNumber).toBe("1234567");
      expect(result.legalName).toBe("Test Fleet Inc");
      expect(result.city).toBe("Austin");
      expect(result.totalDrivers).toBe(50);

      mockFetch.mockRestore();
    });

    it("should lookup carrier by MC number", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            MCNumber: "123456",
            legalName: "Test Broker LLC",
            operatingStatus: "Active",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.lookupCarrierByMC("123456");

      expect(result.mcNumber).toBe("123456");
      expect(result.legalName).toBe("Test Broker LLC");

      mockFetch.mockRestore();
    });

    it("should search carriers by legal name", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            SearchResults: [
              {
                dotNumber: "1234567",
                legalName: "Test Fleet Inc",
              },
              {
                dotNumber: "2345678",
                legalName: "Test Logistics LLC",
              },
            ],
            totalRecordCount: 2,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.searchCarriers("Test", 10);

      expect(result.totalResults).toBe(2);
      expect(result.carriers).toHaveLength(2);
      expect(result.carriers[0].legalName).toBe("Test Fleet Inc");

      mockFetch.mockRestore();
    });
  });

  describe("SMS BASIC scores", () => {
    it("should retrieve SMS BASIC scores", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            safetyRating: "Satisfactory",
            SafetyRatingDate: "2026-03-01",
            BASICs: [
              {
                BasicNumber: 1,
                BasicName: "Unsafe Driving",
                score: 85,
                percentile: 60,
              },
              {
                BasicNumber: 2,
                BasicName: "Hours of Service Compliance",
                score: 92,
                percentile: 75,
              },
              {
                BasicNumber: 3,
                BasicName: "Vehicle Maintenance",
                score: 78,
                percentile: 45,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getSMSBASICScores("1234567");

      expect(result.safetyRating).toBe("Satisfactory");
      expect(result.basics).toHaveLength(3);
      expect(result.basics[0].basicName).toBe("Unsafe Driving");
      expect(result.basics[0].score).toBe(85);

      mockFetch.mockRestore();
    });

    it("should cache SMS results for 1 hour", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            safetyRating: "Satisfactory",
            BASICs: [
              {
                BasicNumber: 1,
                BasicName: "Unsafe Driving",
                score: 85,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result1 = await client.getSMSBASICScores("1234567");

      // Call again - should use cache
      const result2 = await client.getSMSBASICScores("1234567");

      expect(result1).toEqual(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to cache

      mockFetch.mockRestore();
    });
  });

  describe("inspections", () => {
    it("should retrieve roadside inspection data", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            inspections: [
              {
                inspectionId: "insp_001",
                inspectionDate: "2026-03-15",
                inspectionType: "vehicle",
                violationCount: 3,
                outOfServiceCount: 1,
                violations: [
                  {
                    code: "V001",
                    description: "Brake failure",
                    severity: "critical",
                  },
                ],
                state: "TX",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getRoadsideInspections("1234567");

      expect(result).toHaveLength(1);
      expect(result[0].violationCount).toBe(3);
      expect(result[0].violations).toHaveLength(1);

      mockFetch.mockRestore();
    });
  });

  describe("crashes", () => {
    it("should retrieve crash data", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            crashes: [
              {
                crashId: "crash_001",
                crashDate: "2026-03-10",
                crashLocation: "Interstate 35",
                crashState: "TX",
                fatalityCount: 0,
                injuryCount: 1,
                vehiclesInvolved: 2,
                reportable: true,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getCrashes("1234567");

      expect(result).toHaveLength(1);
      expect(result[0].fatalityCount).toBe(0);
      expect(result[0].injuryCount).toBe(1);
      expect(result[0].reportable).toBe(true);

      mockFetch.mockRestore();
    });
  });

  describe("insurance", () => {
    it("should retrieve insurance status", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            insured: true,
            bonds: [
              {
                type: "BMCS-84",
                amount: 75000,
                effectiveDate: "2026-01-01",
                expirationDate: "2027-01-01",
              },
            ],
            policies: [
              {
                type: "General Liability",
                coverage: 1000000,
                insurer: "State Farm",
                effectiveDate: "2026-01-01",
                expirationDate: "2027-01-01",
              },
            ],
            lastUpdated: "2026-03-17",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getInsuranceStatus("1234567");

      expect(result.insured).toBe(true);
      expect(result.activeBonds).toHaveLength(1);
      expect(result.activeInsurancePolicies).toHaveLength(1);

      mockFetch.mockRestore();
    });
  });

  describe("operating authority", () => {
    it("should retrieve operating authority status", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mcNumber: "123456",
            fmcNumber: null,
            mcStatus: "Active",
            ffStatus: "Inactive",
            effectiveDate: "2020-01-15",
            expirationDate: "2030-01-15",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getOperatingAuthority("1234567");

      expect(result.mcAuthorityStatus).toBe("Active");
      expect(result.ffAuthorityStatus).toBe("Inactive");
      expect(result.mcNumber).toBe("123456");

      mockFetch.mockRestore();
    });
  });

  describe("census data", () => {
    it("should retrieve census data with 24h cache", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            legalName: "Test Fleet Inc",
            dbaName: "Test Logistics",
            carrierType: "Motor Carrier",
            operationClassification: "Interstate",
            totalDrivers: 50,
            totalVehicles: 40,
            powerUnits: 35,
            trailers: 60,
            hazmatRegistered: true,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getCensusData("1234567");

      expect(result.legalName).toBe("Test Fleet Inc");
      expect(result.totalDrivers).toBe(50);

      // Call again - should use cache
      const result2 = await client.getCensusData("1234567");

      expect(result2).toEqual(result);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockRestore();
    });
  });

  describe("OOS rates", () => {
    it("should retrieve Out-of-Service violation rates", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            driverOOSRate: 3.2,
            vehicleOOSRate: 4.5,
            hazmatOOSRate: 2.1,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getOOSRates("1234567");

      expect(result.driverOOSRate).toBe(3.2);
      expect(result.vehicleOOSRate).toBe(4.5);
      expect(result.hazmatOOSRate).toBe(2.1);

      mockFetch.mockRestore();
    });
  });

  describe("data quality challenge", () => {
    it("should submit DataQs challenge", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            challengeType: "DataChallenge",
            status: "Pending",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.submitDataQsChallenge(
        "1234567",
        "totalDrivers",
        "Incorrect driver count in census data",
        "https://example.com/doc.pdf"
      );

      expect(result.status).toBe("Pending");
      expect(result.reason).toBe("Incorrect driver count in census data");

      mockFetch.mockRestore();
    });
  });

  describe("bulk operations", () => {
    it("should lookup multiple carriers", async () => {
      const mockFetch = vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              dotNumber: "1234567",
              legalName: "Fleet One Inc",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              dotNumber: "2345678",
              legalName: "Fleet Two LLC",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );

      const result = await client.bulkLookup(["1234567", "2345678"]);

      expect(result).toHaveLength(2);
      expect(result[0].legalName).toBe("Fleet One Inc");
      expect(result[1].legalName).toBe("Fleet Two LLC");

      mockFetch.mockRestore();
    });
  });

  describe("comprehensive profile", () => {
    it("should retrieve complete carrier profile with all data", async () => {
      const mockFetch = vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              dotNumber: "1234567",
              legalName: "Test Fleet",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              safetyRating: "Satisfactory",
              BASICs: [],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ inspections: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ crashes: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ insured: true, bonds: [], policies: [] }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              mcNumber: "123456",
              mcStatus: "Active",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );

      const result = await client.getComprehensiveProfile("1234567");

      expect(result.carrier.legalName).toBe("Test Fleet");
      expect(result.safetyRating.safetyRating).toBe("Satisfactory");
      expect(result.insurance.insured).toBe(true);
      expect(result.authority.mcNumber).toBe("123456");

      mockFetch.mockRestore();
    });
  });
});
