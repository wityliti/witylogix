/**
 * Delivery OTP Service — WIT-92
 *
 * Handles OTP generation, validation logic, and channel dispatch
 * for high-value/regulated parcel delivery confirmation.
 *
 * Channel dispatch is stubbed (SMS/WhatsApp provider integration
 * will be wired separately once the provider contract is confirmed).
 */

export interface GenerateOTPParams {
  orderId: string;
  recipientPhone: string | null;
  channel: 'sms' | 'whatsapp';
}

export interface OTPRecord {
  orderId: string;
  code: string;
  channel: 'sms' | 'whatsapp';
  recipientPhone: string;
  expiresAt: Date;
}

export interface VerifyOTPResult {
  valid: boolean;
  reason?: string;
  attempts: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP and return the record data to persist.
 * Throws if recipientPhone is absent.
 */
export async function generateDeliveryOTP(params: GenerateOTPParams): Promise<OTPRecord> {
  if (!params.recipientPhone) {
    throw new Error('Customer phone number is required to send OTP');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // TODO: dispatch SMS/WhatsApp via provider (Twilio / Meta Cloud API)
  // await smsProvider.send({ to: params.recipientPhone, body: `Your delivery code is ${code}` });

  return {
    orderId: params.orderId,
    code,
    channel: params.channel,
    recipientPhone: params.recipientPhone,
    expiresAt,
  };
}

/**
 * Validate a submitted code against a stored OTP record.
 * Does NOT write to the database — the caller is responsible for persisting
 * the updated attempt count and verified state.
 */
export function verifyDeliveryOTP(
  record: {
    code: string;
    verified: boolean;
    verifiedAt: Date | null;
    expiresAt: Date;
    attempts: number;
  },
  submittedCode: string,
): VerifyOTPResult {
  const newAttempts = record.attempts + 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'Too many attempts. Request a new OTP.', attempts: newAttempts };
  }
  if (record.verified) {
    return { valid: false, reason: 'OTP already used', attempts: newAttempts };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'OTP expired', attempts: newAttempts };
  }
  if (record.code !== submittedCode) {
    return { valid: false, reason: 'Invalid OTP code', attempts: newAttempts };
  }

  return { valid: true, attempts: newAttempts };
}

/**
 * Mask a phone number for safe display in API responses.
 * e.g. "+61400000001" → "+61****01"
 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\+\d{2})\d+(\d{2})$/, '$1****$2');
}
