/**
 * E-Signature Test Fixtures
 * Factory functions for creating test data
 * ~150 lines
 */

// ============================================================================
// ENVELOPE FIXTURES
// ============================================================================

export interface EnvelopeFixture {
  id: string;
  subject: string;
  message: string;
  documentUrl: string;
  recipients: Array<{ email: string; name: string; role: string }>;
  status: string;
}

export const createEnvelopeFixture = (
  overrides?: Partial<EnvelopeFixture>,
): EnvelopeFixture => ({
  id: `env_${Math.random().toString(36).substr(2, 9)}`,
  subject: "Standard Contract",
  message: "Please review and sign",
  documentUrl: "https://example.com/contract.pdf",
  recipients: [
    { email: "signer1@example.com", name: "John Signer", role: "signer" },
  ],
  status: "draft",
  ...overrides,
});

export const createMultiSignerEnvelopeFixture = (
  overrides?: Partial<EnvelopeFixture>,
): EnvelopeFixture => ({
  id: `env_${Math.random().toString(36).substr(2, 9)}`,
  subject: "Multi-Party Agreement",
  message: "Requires multiple signatures",
  documentUrl: "https://example.com/agreement.pdf",
  recipients: [
    { email: "signer1@example.com", name: "Alice", role: "signer" },
    { email: "signer2@example.com", name: "Bob", role: "signer" },
    { email: "cc@example.com", name: "Carol", role: "cc" },
  ],
  status: "draft",
  ...overrides,
});

export const createSentEnvelopeFixture = (
  overrides?: Partial<EnvelopeFixture>,
): EnvelopeFixture => ({
  id: `env_${Math.random().toString(36).substr(2, 9)}`,
  subject: "Sent Envelope",
  message: "Awaiting signatures",
  documentUrl: "https://example.com/doc.pdf",
  recipients: [
    { email: "signer@example.com", name: "John Doe", role: "signer" },
  ],
  status: "sent",
  ...overrides,
});

export const createCompletedEnvelopeFixture = (
  overrides?: Partial<EnvelopeFixture>,
): EnvelopeFixture => ({
  id: `env_${Math.random().toString(36).substr(2, 9)}`,
  subject: "Completed Envelope",
  message: "All signatures obtained",
  documentUrl: "https://example.com/signed.pdf",
  recipients: [
    { email: "signer@example.com", name: "Completed Signer", role: "signer" },
  ],
  status: "completed",
  ...overrides,
});

// ============================================================================
// TEMPLATE FIXTURES
// ============================================================================

export interface TemplateFixture {
  id: string;
  name: string;
  documentUrl: string;
  placeholderFields: Array<{
    name: string;
    type: string;
    pageNumber: number;
  }>;
}

export const createTemplateFixture = (
  overrides?: Partial<TemplateFixture>,
): TemplateFixture => ({
  id: `tpl_${Math.random().toString(36).substr(2, 9)}`,
  name: "Standard NDA",
  documentUrl: "https://example.com/nda-template.pdf",
  placeholderFields: [
    { name: "signature_1", type: "signature", pageNumber: 1 },
    { name: "date_1", type: "date", pageNumber: 1 },
  ],
  ...overrides,
});

export const createNdaTemplateFixture = (
  overrides?: Partial<TemplateFixture>,
): TemplateFixture => ({
  id: `tpl_${Math.random().toString(36).substr(2, 9)}`,
  name: "Non-Disclosure Agreement",
  documentUrl: "https://example.com/nda.pdf",
  placeholderFields: [
    { name: "signature_party1", type: "signature", pageNumber: 2 },
    { name: "signature_party2", type: "signature", pageNumber: 2 },
    { name: "date_party1", type: "date", pageNumber: 2 },
    { name: "date_party2", type: "date", pageNumber: 2 },
  ],
  ...overrides,
});

export const createContractTemplateFixture = (
  overrides?: Partial<TemplateFixture>,
): TemplateFixture => ({
  id: `tpl_${Math.random().toString(36).substr(2, 9)}`,
  name: "Service Contract",
  documentUrl: "https://example.com/contract.pdf",
  placeholderFields: [
    { name: "signature_client", type: "signature", pageNumber: 3 },
    { name: "signature_provider", type: "signature", pageNumber: 3 },
    { name: "initials", type: "initial", pageNumber: 1 },
  ],
  ...overrides,
});

// ============================================================================
// SIGNER FIXTURES
// ============================================================================

export interface SignerFixture {
  email: string;
  name: string;
  role: "signer" | "approver" | "cc";
  routingOrder?: number;
}

export const createSignerFixture = (
  overrides?: Partial<SignerFixture>,
): SignerFixture => ({
  email: "signer@example.com",
  name: "John Signer",
  role: "signer",
  routingOrder: 1,
  ...overrides,
});

export const createApproverFixture = (
  overrides?: Partial<SignerFixture>,
): SignerFixture => ({
  email: "approver@example.com",
  name: "Jane Approver",
  role: "approver",
  routingOrder: 1,
  ...overrides,
});

export const createCcSignerFixture = (
  overrides?: Partial<SignerFixture>,
): SignerFixture => ({
  email: "cc@example.com",
  name: "Carol Cc",
  role: "cc",
  ...overrides,
});

export const createSequentialSignersFixture = (): SignerFixture[] => [
  {
    email: "first@example.com",
    name: "First Signer",
    role: "signer",
    routingOrder: 1,
  },
  {
    email: "second@example.com",
    name: "Second Signer",
    role: "signer",
    routingOrder: 2,
  },
];

// ============================================================================
// FIELD FIXTURES
// ============================================================================

export interface FieldFixture {
  id: string;
  type: "signature" | "initial" | "text" | "date" | "checkbox";
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  label?: string;
}

export const createSignatureFieldFixture = (
  overrides?: Partial<FieldFixture>,
): FieldFixture => ({
  id: `field_${Math.random().toString(36).substr(2, 9)}`,
  type: "signature",
  pageNumber: 1,
  xPosition: 100,
  yPosition: 200,
  label: "Signature",
  ...overrides,
});

export const createInitialFieldFixture = (
  overrides?: Partial<FieldFixture>,
): FieldFixture => ({
  id: `field_${Math.random().toString(36).substr(2, 9)}`,
  type: "initial",
  pageNumber: 1,
  xPosition: 300,
  yPosition: 150,
  label: "Initial",
  ...overrides,
});

export const createDateFieldFixture = (
  overrides?: Partial<FieldFixture>,
): FieldFixture => ({
  id: `field_${Math.random().toString(36).substr(2, 9)}`,
  type: "date",
  pageNumber: 1,
  xPosition: 400,
  yPosition: 200,
  label: "Date",
  ...overrides,
});

export const createTextFieldFixture = (
  overrides?: Partial<FieldFixture>,
): FieldFixture => ({
  id: `field_${Math.random().toString(36).substr(2, 9)}`,
  type: "text",
  pageNumber: 1,
  xPosition: 150,
  yPosition: 250,
  label: "Full Name",
  ...overrides,
});

// ============================================================================
// AUDIT EVENT FIXTURES
// ============================================================================

export interface AuditEventFixture {
  envelopeId: string;
  eventType: string;
  timestamp: Date;
  actor: string;
  details: Record<string, unknown>;
}

export const createAuditEventFixture = (
  overrides?: Partial<AuditEventFixture>,
): AuditEventFixture => ({
  envelopeId: `env_${Math.random().toString(36).substr(2, 9)}`,
  eventType: "envelope_created",
  timestamp: new Date(),
  actor: "system",
  details: {},
  ...overrides,
});

export const createEnvelopeCreatedEventFixture = (
  envelopeId: string,
): AuditEventFixture => ({
  envelopeId,
  eventType: "envelope_created",
  timestamp: new Date(),
  actor: "user@example.com",
  details: { documentUrl: "https://example.com/doc.pdf" },
});

export const createEnvelopeSentEventFixture = (
  envelopeId: string,
): AuditEventFixture => ({
  envelopeId,
  eventType: "envelope_sent",
  timestamp: new Date(),
  actor: "system",
  details: { recipientCount: 2 },
});

export const createSignatureEventFixture = (
  envelopeId: string,
  signer: string,
): AuditEventFixture => ({
  envelopeId,
  eventType: "recipient_signed",
  timestamp: new Date(),
  actor: signer,
  details: { fieldCount: 3, ipAddress: "192.168.1.1" },
});

export const createEnvelopeCompletedEventFixture = (
  envelopeId: string,
): AuditEventFixture => ({
  envelopeId,
  eventType: "envelope_completed",
  timestamp: new Date(),
  actor: "system",
  details: { allSignaturesObtained: true, completionTime: 3600 },
});
