import { describe, it, expect, vi, beforeEach } from "vitest";

interface SmsProvider {
  send(phoneNumber: string, message: string): Promise<void>;
}

interface SmsBulkResult {
  sent: number;
  failed: number;
  segments: number;
  errors: string[];
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phoneNumber: string, message: string): Promise<void> {
    const segments = this.calculateSegments(message);
    console.log(
      `[SMS] To: ${phoneNumber}\nMessage: ${message}\nSegments: ${segments}`,
    );
  }

  private calculateSegments(message: string): number {
    if (message.length === 0) return 0;
    if (message.length <= 160) return 1;
    return Math.ceil(message.length / 153);
  }
}

class PhoneValidator {
  static isValidPhone(phone: string): boolean {
    // Strip formatting characters: spaces, dashes, parentheses
    const cleaned = phone.replace(/[\s\-()]/g, "");
    // Require at least 7 digits (E.164 minimum is typically 7+ digits)
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    return phoneRegex.test(cleaned);
  }
}

class SmsSegmentCalculator {
  static calculate(message: string): number {
    if (message.length === 0) return 0;
    if (message.length <= 160) return 1;
    return Math.ceil(message.length / 153);
  }

  static getSegmentCharLimit(segmentNumber: number): number {
    return segmentNumber === 1 ? 160 : 153;
  }
}

interface SmsConfig {
  provider: "console" | "twilio" | "aws";
}

class SmsService {
  private provider: SmsProvider;
  private config: SmsConfig;
  private sentMessages: number[] = [];

  constructor(config: SmsConfig) {
    this.config = config;
    this.provider = new ConsoleSmsProvider();
  }

  async send(phoneNumber: string, message: string): Promise<void> {
    if (!PhoneValidator.isValidPhone(phoneNumber)) {
      throw new Error(`Invalid phone number: ${phoneNumber}`);
    }

    if (message.length === 0) {
      throw new Error("Message cannot be empty");
    }

    await this.provider.send(phoneNumber, message);
  }

  async sendBulk(
    recipients: string[],
    message: string,
  ): Promise<SmsBulkResult> {
    const result: SmsBulkResult = {
      sent: 0,
      failed: 0,
      segments: SmsSegmentCalculator.calculate(message),
      errors: [],
    };

    for (const recipient of recipients) {
      try {
        if (!PhoneValidator.isValidPhone(recipient)) {
          throw new Error(`Invalid phone number: ${recipient}`);
        }

        if (message.length === 0) {
          throw new Error("Message cannot be empty");
        }

        await this.provider.send(recipient, message);
        result.sent++;
        this.sentMessages.push(Date.now());
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Failed to send to ${recipient}: ${(error as Error).message}`,
        );
      }
    }

    return result;
  }

  setProvider(provider: SmsProvider): void {
    this.provider = provider;
  }
}

describe("SmsService", () => {
  let smsService: SmsService;
  let mockProvider: SmsProvider;

  beforeEach(() => {
    smsService = new SmsService({ provider: "console" });
    mockProvider = {
      send: vi.fn(),
    };
    smsService.setProvider(mockProvider);
  });

  describe("ConsoleSmsProvider", () => {
    it("should log SMS to console", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const provider = new ConsoleSmsProvider();

      await provider.send("+1234567890", "Hello World");

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain("+1234567890");
      expect(logCall).toContain("Hello World");

      consoleLogSpy.mockRestore();
    });

    it("should log segment count in console output", async () => {
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const provider = new ConsoleSmsProvider();

      await provider.send("+1234567890", "Short message");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Segments"),
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe("PhoneValidator", () => {
    it("should validate valid phone numbers", () => {
      expect(PhoneValidator.isValidPhone("+1234567890")).toBe(true);
      expect(PhoneValidator.isValidPhone("1234567890")).toBe(true);
      expect(PhoneValidator.isValidPhone("+44 1234 567890")).toBe(true);
      expect(PhoneValidator.isValidPhone("+33-1-23-45-67-89")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(PhoneValidator.isValidPhone("123")).toBe(false);
      expect(PhoneValidator.isValidPhone("abc")).toBe(false);
      expect(PhoneValidator.isValidPhone("")).toBe(false);
      expect(PhoneValidator.isValidPhone("+0123456789")).toBe(false);
    });

    it("should handle phone numbers with formatting", () => {
      expect(PhoneValidator.isValidPhone("+1 (234) 567-8900")).toBe(true);
      expect(PhoneValidator.isValidPhone("1-234-567-8900")).toBe(true);
    });
  });

  describe("SmsSegmentCalculator", () => {
    it("should calculate single segment for messages up to 160 chars", () => {
      expect(SmsSegmentCalculator.calculate("Short message")).toBe(1);
      expect(SmsSegmentCalculator.calculate("a".repeat(160))).toBe(1);
    });

    it("should calculate multiple segments for longer messages", () => {
      expect(SmsSegmentCalculator.calculate("a".repeat(161))).toBe(2);
      expect(SmsSegmentCalculator.calculate("a".repeat(306))).toBe(2);
      expect(SmsSegmentCalculator.calculate("a".repeat(307))).toBe(3);
    });

    it("should calculate segments correctly for various lengths", () => {
      expect(SmsSegmentCalculator.calculate("a".repeat(153))).toBe(1);
      // Multi-part segments are 153 chars each: ceil(306/153)=2, ceil(307/153)=3
      expect(SmsSegmentCalculator.calculate("a".repeat(306))).toBe(2);
      expect(SmsSegmentCalculator.calculate("a".repeat(307))).toBe(3);
    });

    it("should return 0 segments for empty message", () => {
      expect(SmsSegmentCalculator.calculate("")).toBe(0);
    });

    it("should return correct character limits per segment", () => {
      expect(SmsSegmentCalculator.getSegmentCharLimit(1)).toBe(160);
      expect(SmsSegmentCalculator.getSegmentCharLimit(2)).toBe(153);
      expect(SmsSegmentCalculator.getSegmentCharLimit(5)).toBe(153);
    });
  });

  describe("send()", () => {
    it("should send SMS with valid phone number", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await smsService.send("+1234567890", "Test message");

      expect(mockSend).toHaveBeenCalledWith("+1234567890", "Test message");
    });

    it("should throw error for invalid phone number", async () => {
      await expect(smsService.send("invalid", "Test message")).rejects.toThrow(
        "Invalid phone number",
      );
    });

    it("should throw error for empty message", async () => {
      await expect(smsService.send("+1234567890", "")).rejects.toThrow(
        "Message cannot be empty",
      );
    });

    it("should send message with various phone formats", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await smsService.send("1234567890", "Test");
      await smsService.send("+1 234 567 8900", "Test");

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("should support long messages", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const longMessage = "a".repeat(500);
      await smsService.send("+1234567890", longMessage);

      expect(mockSend).toHaveBeenCalledWith("+1234567890", longMessage);
    });
  });

  describe("sendBulk()", () => {
    it("should send SMS to multiple recipients", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ["+1234567890", "+1987654321", "+1555666777"];
      const result = await smsService.sendBulk(recipients, "Test message");

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it("should calculate segments in bulk result", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const shortMessage = "Short message";
      const result1 = await smsService.sendBulk(["+1234567890"], shortMessage);
      expect(result1.segments).toBe(1);

      const longMessage = "a".repeat(200);
      const result2 = await smsService.sendBulk(["+1234567890"], longMessage);
      expect(result2.segments).toBe(2);
    });

    it("should handle invalid phone numbers", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ["+1234567890", "invalid", "+1555666777"];
      const result = await smsService.sendBulk(recipients, "Test");

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it("should track sent and failed count", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = [
        "+1111111111",
        "bad",
        "+2222222222",
        "also bad",
        "+3333333333",
      ];
      const result = await smsService.sendBulk(recipients, "Message");

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(2);
    });

    it("should return empty errors on success", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const result = await smsService.sendBulk(
        ["+1234567890", "+1987654321"],
        "Test",
      );

      expect(result.errors).toEqual([]);
    });

    it("should handle empty recipient list", async () => {
      const result = await smsService.sendBulk([], "Message");

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it("should continue sending after error", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ["+1111111111", "invalid", "+2222222222"];
      const result = await smsService.sendBulk(recipients, "Message");

      expect(result.sent).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("should include error details in results", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const recipients = ["bad_number", "+1234567890"];
      const result = await smsService.sendBulk(recipients, "Message");

      expect(result.errors[0]).toContain("bad_number");
      expect(result.errors[0]).toContain("Invalid phone number");
    });
  });

  describe("Error Handling", () => {
    it("should handle provider errors", async () => {
      mockProvider.send = vi
        .fn()
        .mockRejectedValue(new Error("Provider connection failed"));

      await expect(smsService.send("+1234567890", "Message")).rejects.toThrow(
        "Provider connection failed",
      );
    });

    it("should include provider errors in bulk results", async () => {
      mockProvider.send = vi
        .fn()
        .mockRejectedValueOnce(new Error("Rate limit exceeded"));

      const result = await smsService.sendBulk(["+1234567890"], "Message");

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain("Rate limit exceeded");
    });

    it("should continue on provider failures in bulk send", async () => {
      let callCount = 0;
      mockProvider.send = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Network error");
        }
      });

      const result = await smsService.sendBulk(
        ["+1111111111", "+2222222222", "+3333333333"],
        "Message",
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long messages", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const veryLongMessage = "a".repeat(1000);
      const result = await smsService.sendBulk(
        ["+1234567890"],
        veryLongMessage,
      );

      expect(result.segments).toBe(Math.ceil(1000 / 153));
    });

    it("should handle messages with special characters", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const message = "Hello! @#$%^&*() 日本語 emoji:😀";
      await smsService.send("+1234567890", message);

      expect(mockSend).toHaveBeenCalledWith("+1234567890", message);
    });

    it("should handle multiple bulk sends", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      await smsService.sendBulk(["+1111111111"], "First");
      await smsService.sendBulk(["+2222222222"], "Second");
      await smsService.sendBulk(["+3333333333"], "Third");

      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });

  describe("Integration", () => {
    it("should track message statistics across bulk sends", async () => {
      const mockSend = vi.fn();
      mockProvider.send = mockSend;

      const result1 = await smsService.sendBulk(
        ["+1111111111", "+2222222222"],
        "Short",
      );
      expect(result1.sent).toBe(2);

      const result2 = await smsService.sendBulk(
        ["+3333333333", "+4444444444", "+5555555555"],
        "a".repeat(300),
      );
      expect(result2.sent).toBe(3);
      expect(result2.segments).toBe(2);
    });
  });
});
