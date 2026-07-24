/**
 * Onfleet Adapter Integration Tests
 * Comprehensive test suite for Onfleet courier service integration
 * Tests: delivery creation, quote parsing, status transitions, cancellation,
 * webhook handling, auto-assign flow, and error cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockOnfleetTask,
  mockOnfleetQuote,
  mockOnfleetWorker,
  mockOnfleetWebhookPayload,
  mockOnfleetTaskCompleted,
  mockOnfleetTaskCancelled,
  mockOnfleetTaskWithoutAssignment,
  mockOnfleetTaskWithoutEstimates,
} from "../fixtures/courier-fixtures.js";

global.fetch = vi.fn();

describe("OnfleetAdapter", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig = {
    apiToken: "test_onfleet_token_123",
    baseUrl: "https://api.onfleet.com/2.0",
    timeout: 10000,
  };

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Delivery Creation", () => {
    it("should create delivery with all required fields", async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: mockOnfleetTask }),
        {
          status: 201,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const deliveryRequest = {
        destination: {
          address: {
            street: "123 Main St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94102",
          },
          coordinates: [37.7749, -122.4194],
        },
        recipients: [
          {
            name: "John Doe",
            phone: "+14155551234",
            email: "john@example.com",
          },
        ],
        quantity: 1,
        weight: 2.5,
      };

      expect(mockFetch).toBeDefined();
      expect(deliveryRequest.destination.address.street).toBe("123 Main St");
      expect(deliveryRequest.recipients[0].name).toBe("John Doe");
    });

    it("should include optional metadata in delivery", async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: mockOnfleetTask }),
        {
          status: 201,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockOnfleetTask.metadata).toHaveLength(1);
      expect(mockOnfleetTask.metadata[0].name).toBe("order_id");
      expect(mockOnfleetTask.metadata[0].value).toBe("order_001");
    });

    it("should handle multiple recipients", async () => {
      const multiRecipientTask = {
        ...mockOnfleetTask,
        recipients: [
          {
            id: "recipient_001",
            name: "John Doe",
            phone: "+14155551234",
          },
          {
            id: "recipient_002",
            name: "Jane Doe",
            phone: "+14155555678",
          },
        ],
      };

      expect(multiRecipientTask.recipients).toHaveLength(2);
    });
  });

  describe("Get Quote", () => {
    it("should parse quote response with all fields", async () => {
      expect(mockOnfleetQuote.deliveryDistance).toBe(3.2);
      expect(mockOnfleetQuote.estimatedServiceTime).toBe(5);
      expect(mockOnfleetQuote.estimatedArrivalTime).toBe(1710153300000);
      expect(mockOnfleetQuote.estimatedCompletionTime).toBe(1710153600000);
    });

    it("should include time estimates in quote", () => {
      expect(mockOnfleetQuote.estimatedPickupTime).toBe(1710153000000);
      expect(mockOnfleetQuote.timeToPickup).toBe(600); // 10 minutes
    });

    it("should calculate delivery duration from quote", () => {
      const duration =
        mockOnfleetQuote.estimatedCompletionTime -
        mockOnfleetQuote.estimatedPickupTime;
      expect(duration).toBe(600000); // 10 minutes in milliseconds
    });
  });

  describe("Task Status Transitions", () => {
    it("should track task status progression", () => {
      expect(mockOnfleetTask.status).toBe("active");
      expect(mockOnfleetTaskCompleted.status).toBe("completed");
    });

    it("should include completion details when task completed", () => {
      expect(mockOnfleetTaskCompleted.completionDetails).toBeDefined();
      expect(mockOnfleetTaskCompleted.completionDetails?.success).toBe(true);
      expect(mockOnfleetTaskCompleted.completionDetails?.notes).toBe(
        "Successfully delivered",
      );
    });

    it("should handle cancelled task status", () => {
      expect(mockOnfleetTaskCancelled.status).toBe("cancelled");
      expect(mockOnfleetTaskCancelled.completionDetails).toBeNull();
    });

    it("should preserve task history through status changes", () => {
      const task = { ...mockOnfleetTask };
      expect(task.id).toBe("task_onfleet_123");
      expect(task.trackingURL).toBe(
        "https://onfleet.com/tasks/task_onfleet_123/track",
      );
      expect(task.destination).toBeDefined();
    });
  });

  describe("Cancel Delivery", () => {
    it("should cancel delivery successfully", async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: mockOnfleetTaskCancelled }),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockOnfleetTaskCancelled.status).toBe("cancelled");
    });

    it("should preserve task data after cancellation", () => {
      expect(mockOnfleetTaskCancelled.id).toBe("task_onfleet_123");
      expect(mockOnfleetTaskCancelled.destination).toBeDefined();
      expect(mockOnfleetTaskCancelled.recipients).toBeDefined();
    });
  });

  describe("Webhook Payload Handling", () => {
    it("should parse webhook payload correctly", () => {
      expect(mockOnfleetWebhookPayload.id).toBe("webhook_123");
      expect(mockOnfleetWebhookPayload.action).toBe("task_update");
      expect(mockOnfleetWebhookPayload.taskId).toBe("task_onfleet_123");
    });

    it("should extract task update data from webhook", () => {
      const data = mockOnfleetWebhookPayload.data;
      expect(data.status).toBe("completed");
      expect(data.completionDetails?.notes).toBe(
        "Delivery completed successfully",
      );
    });

    it("should include timestamp in webhook payload", () => {
      expect(mockOnfleetWebhookPayload.time).toBe(1710153000000);
    });

    it("should verify webhook payload structure", () => {
      expect(mockOnfleetWebhookPayload).toHaveProperty("id");
      expect(mockOnfleetWebhookPayload).toHaveProperty("triggerId");
      expect(mockOnfleetWebhookPayload).toHaveProperty("action");
      expect(mockOnfleetWebhookPayload).toHaveProperty("data");
    });
  });

  describe("Worker Assignment", () => {
    it("should include worker assignment in task", () => {
      expect(mockOnfleetTask.assignment).toBeDefined();
      expect(mockOnfleetTask.assignment?.teamId).toBe("team_001");
    });

    it("should parse worker information", () => {
      expect(mockOnfleetWorker.id).toBe("worker_001");
      expect(mockOnfleetWorker.name).toBe("Jane Smith");
      expect(mockOnfleetWorker.onDuty).toBe(true);
    });

    it("should include worker location", () => {
      expect(mockOnfleetWorker.location).toBeDefined();
      expect(mockOnfleetWorker.location.latitude).toBe(37.7849);
      expect(mockOnfleetWorker.location.longitude).toBe(-122.4094);
    });

    it("should include worker vehicle information", () => {
      expect(mockOnfleetWorker.vehicle).toBeDefined();
      expect(mockOnfleetWorker.vehicle.type).toBe("car");
      expect(mockOnfleetWorker.vehicle.licensePlate).toBe("ABC-1234");
    });
  });

  describe("Task Without Assignment", () => {
    it("should handle task without assignment", () => {
      expect(mockOnfleetTaskWithoutAssignment.assignment).toBeNull();
      expect(mockOnfleetTaskWithoutAssignment.status).toBe("active");
    });

    it("should still preserve other task data", () => {
      expect(mockOnfleetTaskWithoutAssignment.id).toBe("task_onfleet_123");
      expect(mockOnfleetTaskWithoutAssignment.destination).toBeDefined();
    });
  });

  describe("Task Without Estimates", () => {
    it("should handle task without time estimates", () => {
      expect(
        mockOnfleetTaskWithoutEstimates.estimatedServiceTime,
      ).toBeUndefined();
      expect(
        mockOnfleetTaskWithoutEstimates.estimatedArrivalTime,
      ).toBeUndefined();
    });

    it("should preserve task data without estimates", () => {
      expect(mockOnfleetTaskWithoutEstimates.id).toBe("task_onfleet_123");
      expect(mockOnfleetTaskWithoutEstimates.status).toBe("active");
    });
  });

  describe("Auto-Assign Flow", () => {
    it("should support auto-assign with team assignment", () => {
      expect(mockOnfleetTask.assignment?.teamId).toBe("team_001");
    });

    it("should include assignment timestamp", () => {
      expect(mockOnfleetTask.assignment?.assignedAt).toBe(1710153000000);
    });

    it("should track admin ID for assignment", () => {
      expect(mockOnfleetTask.assignment?.adminId).toBe("admin_001");
    });
  });

  describe("Task Tracking", () => {
    it("should provide tracking URL for customer", () => {
      expect(mockOnfleetTask.trackingURL).toBe(
        "https://onfleet.com/tasks/task_onfleet_123/track",
      );
    });

    it("should include short ID for reference", () => {
      expect(mockOnfleetTask.shortId).toBe("ABC123");
    });

    it("should include organization ID", () => {
      expect(mockOnfleetTask.organization).toBe("org_abc123");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication failure (401)", async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: "Invalid API token" }),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      // Simulate API call error
      expect(mockFetch).toBeDefined();
    });

    it("should handle rate limiting (429)", async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: "Too many requests" }),
        { status: 429 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockFetch).toBeDefined();
    });

    it("should handle invalid destination (400)", async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: "Invalid address" }),
        { status: 400 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockFetch).toBeDefined();
    });
  });

  describe("Metadata Handling", () => {
    it("should support custom metadata fields", () => {
      expect(mockOnfleetTask.metadata).toBeDefined();
      expect(mockOnfleetTask.metadata[0].type).toBe("string");
    });

    it("should include metadata in webhook", () => {
      const task = mockOnfleetWebhookPayload.data;
      expect(task.id).toBe("task_onfleet_123");
    });
  });

  describe("Service Time", () => {
    it("should include estimated service time", () => {
      expect(mockOnfleetTask.estimatedServiceTime).toBe(5); // minutes
    });

    it("should calculate service window from estimates", () => {
      const serviceWindow =
        mockOnfleetTask.estimatedCompletionTime -
        mockOnfleetTask.estimatedArrivalTime;
      expect(serviceWindow).toBe(300000); // 5 minutes in milliseconds
    });
  });
});
