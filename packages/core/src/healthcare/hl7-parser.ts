/**
 * HL7v2 Parser - ADT, ORM, ORU, SIU message parsing and encoding
 * Production-grade implementation
 */

import {
  HL7Message,
  HL7Segment,
  FHIREncounter,
  FHIRObservation,
  FHIRCondition,
  FHIRReference,
  FHIRCodeableConcept,
} from './healthcare-types';

export interface SegmentData {
  MSH?: MSHSegment;
  PID?: PIDSegment;
  PV1?: PV1Segment;
  OBR?: OBRSegment;
  OBX?: OBXSegment;
  DG1?: DG1Segment;
  IN1?: IN1Segment;
  NK1?: NK1Segment;
  [key: string]: any;
}

export interface MSHSegment {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: string;
  security?: string;
  messageType: string;
  messageControlId: string;
  processingId: string;
  versionId: string;
}

export interface PIDSegment {
  patientId: string;
  mrn: string;
  name: { firstName: string; lastName: string };
  dateOfBirth: string;
  gender: string;
  address?: { line: string; city: string; state: string; zip: string; country: string };
  phone?: string;
  maritalStatus?: string;
  race?: string;
  religion?: string;
}

export interface PV1Segment {
  eventId: string;
  admitDateTime: string;
  dischargeDateTime?: string;
  lengthOfStay?: number;
  admissionType: string;
  admitSource: string;
  location?: string;
  dischargeDisposition?: string;
}

export interface OBRSegment {
  orderId: string;
  fillerOrderNumber?: string;
  orderCode: string;
  orderDescription?: string;
  orderDateTime: string;
  orderingProvider?: string;
}

export interface OBXSegment {
  observationId: string;
  valueType: string;
  code: string;
  codeDescription: string;
  value: any;
  unit?: string;
  referenceRange?: string;
  abnormalFlag?: string;
  resultStatus: string;
  observationDateTime: string;
}

export interface DG1Segment {
  sequenceId: number;
  codingMethod: string;
  diagnosisCode: string;
  diagnosisDescription: string;
  diagnosisType: string;
  diagnosisDateTime?: string;
}

export interface IN1Segment {
  insuranceId: string;
  insurancePlanId: string;
  insuredId?: string;
  insuredName?: string;
  relationshipToInsured?: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
}

export interface NK1Segment {
  relationshipCode: string;
  name: { firstName: string; lastName: string };
  phoneNumber?: string;
  relationship?: string;
}

export class HL7v2Parser {
  private fieldSeparator: string = '|';
  private componentSeparator: string = '^';
  private subComponentSeparator: string = '&';
  private escapeCharacter: string = '\\';
  private repetitionSeparator: string = '~';

  /**
   * Parse HL7v2 message string into HL7Message object
   */
  parse(messageText: string): HL7Message {
    const lines = messageText.trim().split('\n').filter(line => line.length > 0);
    if (lines.length === 0) {
      throw new Error('Empty HL7 message');
    }

    const mshSegment = this.parseMSHSegment(lines[0]);
    const segments: HL7Segment[] = [];

    lines.forEach((line, index) => {
      const [segmentId, ...fields] = line.split(this.fieldSeparator);
      segments.push({
        id: segmentId,
        fields,
        sequence: index,
      });
    });

    return {
      messageId: mshSegment.messageControlId,
      messageType: mshSegment.messageType,
      sendingApplication: mshSegment.sendingApplication,
      sendingFacility: mshSegment.sendingFacility,
      receivingApplication: mshSegment.receivingApplication,
      receivingFacility: mshSegment.receivingFacility,
      timestamp: this.parseTimestamp(mshSegment.timestamp),
      security: mshSegment.security,
      versionId: mshSegment.versionId,
      messageControlId: mshSegment.messageControlId,
      processingId: mshSegment.processingId,
      segments,
      raw: messageText,
    };
  }

  /**
   * Parse specific segment types
   */
  parseSegments(message: HL7Message): SegmentData {
    const data: SegmentData = {};

    message.segments.forEach((segment) => {
      switch (segment.id) {
        case 'MSH':
          data.MSH = this.parseMSHSegment(segment.fields.join(this.fieldSeparator));
          break;
        case 'PID':
          data.PID = this.parsePIDSegment(segment.fields);
          break;
        case 'PV1':
          data.PV1 = this.parsePV1Segment(segment.fields);
          break;
        case 'OBR':
          data.OBR = this.parseOBRSegment(segment.fields);
          break;
        case 'OBX':
          if (!data.OBX) data.OBX = [];
          data.OBX.push(this.parseOBXSegment(segment.fields));
          break;
        case 'DG1':
          if (!data.DG1) data.DG1 = [];
          data.DG1.push(this.parseDG1Segment(segment.fields));
          break;
        case 'IN1':
          data.IN1 = this.parseIN1Segment(segment.fields);
          break;
        case 'NK1':
          if (!data.NK1) data.NK1 = [];
          data.NK1.push(this.parseNK1Segment(segment.fields));
          break;
      }
    });

    return data;
  }

  private parseMSHSegment(line: string): MSHSegment {
    const parts = line.split(this.fieldSeparator);
    return {
      sendingApplication: parts[2] || '',
      sendingFacility: parts[3] || '',
      receivingApplication: parts[4] || '',
      receivingFacility: parts[5] || '',
      timestamp: parts[6] || new Date().toISOString(),
      security: parts[7],
      messageType: parts[8]?.split(this.componentSeparator)[0] || '',
      messageControlId: parts[9] || '',
      processingId: parts[10] || 'P',
      versionId: parts[11] || '2.5',
    };
  }

  private parsePIDSegment(fields: string[]): PIDSegment {
    const nameComponents = fields[4]?.split(this.componentSeparator) || [];
    const [lastName, firstName] = nameComponents;

    const addressComponents = fields[10]?.split(this.componentSeparator) || [];

    return {
      patientId: fields[2] || '',
      mrn: fields[3] || '',
      name: {
        firstName: firstName || '',
        lastName: lastName || '',
      },
      dateOfBirth: this.parseDate(fields[7] || ''),
      gender: fields[8] || '',
      address: addressComponents[0]
        ? {
            line: addressComponents[0],
            city: addressComponents[2] || '',
            state: addressComponents[3] || '',
            zip: addressComponents[4] || '',
            country: addressComponents[5] || '',
          }
        : undefined,
      phone: fields[12] || undefined,
      maritalStatus: fields[15],
      race: fields[9],
      religion: fields[16],
    };
  }

  private parsePV1Segment(fields: string[]): PV1Segment {
    return {
      eventId: fields[0] || 'Encounter',
      admitDateTime: this.parseDate(fields[43] || ''),
      dischargeDateTime: this.parseDate(fields[45] || ''),
      lengthOfStay: parseInt(fields[20] || '0', 10),
      admissionType: fields[2] || '',
      admitSource: fields[4] || '',
      location: fields[3],
      dischargeDisposition: fields[36],
    };
  }

  private parseOBRSegment(fields: string[]): OBRSegment {
    return {
      orderId: fields[1] || '',
      fillerOrderNumber: fields[3],
      orderCode: fields[4] || '',
      orderDescription: fields[4]?.split(this.componentSeparator)[1],
      orderDateTime: this.parseDate(fields[6] || ''),
      orderingProvider: fields[16],
    };
  }

  private parseOBXSegment(fields: string[]): OBXSegment {
    return {
      observationId: fields[2] || '',
      valueType: fields[1] || 'ST',
      code: fields[2]?.split(this.componentSeparator)[0] || '',
      codeDescription: fields[2]?.split(this.componentSeparator)[1] || '',
      value: this.parseValue(fields[5] || '', fields[1] || 'ST'),
      unit: fields[5]?.split(this.componentSeparator)[1],
      referenceRange: fields[6],
      abnormalFlag: fields[7],
      resultStatus: fields[11] || 'F',
      observationDateTime: this.parseDate(fields[12] || ''),
    };
  }

  private parseDG1Segment(fields: string[]): DG1Segment {
    return {
      sequenceId: parseInt(fields[0] || '1', 10),
      codingMethod: fields[1] || 'ICD10',
      diagnosisCode: fields[2] || '',
      diagnosisDescription: fields[3] || '',
      diagnosisType: fields[5] || '',
      diagnosisDateTime: this.parseDate(fields[6] || ''),
    };
  }

  private parseIN1Segment(fields: string[]): IN1Segment {
    const insuredNameComponents = fields[10]?.split(this.componentSeparator) || [];
    return {
      insuranceId: fields[1] || '',
      insurancePlanId: fields[2] || '',
      insuredId: fields[18],
      insuredName: insuredNameComponents[0],
      relationshipToInsured: fields[19],
      insuranceCompanyId: fields[4]?.split(this.componentSeparator)[0],
      insuranceCompanyName: fields[4]?.split(this.componentSeparator)[1],
    };
  }

  private parseNK1Segment(fields: string[]): NK1Segment {
    const nameComponents = fields[2]?.split(this.componentSeparator) || [];
    return {
      relationshipCode: fields[2] || '',
      name: {
        firstName: nameComponents[1] || '',
        lastName: nameComponents[0] || '',
      },
      phoneNumber: fields[5],
      relationship: fields[2],
    };
  }

  private parseDate(dateString: string): string {
    if (!dateString) return new Date().toISOString();

    // HL7 format: YYYYMMDD or YYYYMMDDHHMM or YYYYMMDDHHMMSS
    if (dateString.length >= 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      const hour = dateString.substring(8, 10) || '00';
      const minute = dateString.substring(10, 12) || '00';
      const second = dateString.substring(12, 14) || '00';

      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
    }

    return new Date().toISOString();
  }

  private parseTimestamp(ts: string): string {
    return this.parseDate(ts);
  }

  private parseValue(value: string, valueType: string): any {
    switch (valueType) {
      case 'NM':
        return parseFloat(value);
      case 'DT':
      case 'DTM':
        return this.parseDate(value);
      case 'CWE':
      case 'CE':
        const [code, text] = value.split(this.componentSeparator);
        return { code, text };
      default:
        return value;
    }
  }
}

/**
 * HL7toFHIR - Convert HL7v2 messages to FHIR resources
 */
export class HL7toFHIR {
  constructor(private parser: HL7v2Parser) {}

  /**
   * Convert ADT message to FHIR Encounter
   */
  adtToEncounter(message: HL7Message): FHIREncounter {
    const segments = this.parser.parseSegments(message);
    const pv1 = segments.PV1 || {};

    return {
      resourceType: 'Encounter',
      identifier: [
        {
          system: 'http://example.com/encounter-id',
          value: pv1.eventId || '',
        },
      ],
      status: message.messageType === 'A03' ? 'finished' : 'in-progress',
      class: {
        code: pv1.admissionType || 'IMP',
      },
      subject: {
        reference: `Patient/${segments.PID?.patientId}`,
      },
      period: {
        start: pv1.admitDateTime,
        end: pv1.dischargeDateTime,
      },
      location: pv1.location
        ? [
            {
              location: { reference: `Location/${pv1.location}` },
              status: 'completed',
            },
          ]
        : undefined,
      hospitalization: {
        admitSource: {
          coding: [{ code: pv1.admitSource || '' }],
        },
        dischargeDisposition: {
          coding: [{ code: pv1.dischargeDisposition || '' }],
        },
      },
    };
  }

  /**
   * Convert ORU message to FHIR Observation
   */
  oruToObservation(message: HL7Message): FHIRObservation[] {
    const segments = this.parser.parseSegments(message);
    const obxSegments = Array.isArray(segments.OBX) ? segments.OBX : [segments.OBX].filter(Boolean);

    return obxSegments.map((obx) => ({
      resourceType: 'Observation',
      identifier: [
        {
          system: 'http://example.com/observation-id',
          value: obx.observationId,
        },
      ],
      status: obx.resultStatus as any,
      code: {
        coding: [
          {
            code: obx.code,
            display: obx.codeDescription,
          },
        ],
      },
      subject: {
        reference: `Patient/${segments.PID?.patientId}`,
      },
      effectiveDateTime: obx.observationDateTime,
      valueQuantity: {
        value: typeof obx.value === 'number' ? obx.value : undefined,
        unit: obx.unit,
      },
      referenceRange: obx.referenceRange
        ? [{ text: obx.referenceRange }]
        : undefined,
      interpretation: obx.abnormalFlag
        ? [
            {
              coding: [
                {
                  code: obx.abnormalFlag,
                },
              ],
            },
          ]
        : undefined,
    }));
  }

  /**
   * Convert ORM message to FHIR ServiceRequest
   */
  ormToServiceRequest(message: HL7Message): any {
    const segments = this.parser.parseSegments(message);
    const obr = segments.OBR || {};

    return {
      resourceType: 'ServiceRequest',
      identifier: [
        {
          system: 'http://example.com/order-id',
          value: obr.orderId,
        },
      ],
      status: 'active',
      code: {
        coding: [
          {
            code: obr.orderCode,
            display: obr.orderDescription,
          },
        ],
      },
      subject: {
        reference: `Patient/${segments.PID?.patientId}`,
      },
      authoredOn: obr.orderDateTime,
      requester: obr.orderingProvider
        ? { reference: `Practitioner/${obr.orderingProvider}` }
        : undefined,
    };
  }

  /**
   * Convert diagnosis codes to FHIR Condition
   */
  dg1ToCondition(message: HL7Message): FHIRCondition[] {
    const segments = this.parser.parseSegments(message);
    const dg1Segments = Array.isArray(segments.DG1) ? segments.DG1 : [segments.DG1].filter(Boolean);

    return dg1Segments.map((dg1) => ({
      resourceType: 'Condition',
      code: {
        coding: [
          {
            code: dg1.diagnosisCode,
            display: dg1.diagnosisDescription,
          },
        ],
      },
      subject: {
        reference: `Patient/${segments.PID?.patientId}`,
      },
      recordedDate: dg1.diagnosisDateTime,
      clinicalStatus: {
        coding: [{ code: 'active' }],
      },
    }));
  }
}

/**
 * HL7Encoder - Build HL7v2 messages
 */
export class HL7Encoder {
  private fieldSeparator: string = '|';
  private componentSeparator: string = '^';
  private repetitionSeparator: string = '~';
  private escapeCharacter: string = '\\';
  private subComponentSeparator: string = '&';

  /**
   * Encode HL7 message from structured data
   */
  encode(msh: MSHSegment, segments: SegmentData): string {
    const lines: string[] = [];

    // Build MSH
    lines.push(
      [
        'MSH',
        this.fieldSeparator + this.componentSeparator + this.repetitionSeparator + this.escapeCharacter + this.subComponentSeparator,
        msh.sendingApplication,
        msh.sendingFacility,
        msh.receivingApplication,
        msh.receivingFacility,
        this.formatTimestamp(msh.timestamp),
        msh.security || '',
        msh.messageType,
        msh.messageControlId,
        msh.processingId,
        msh.versionId,
      ].join(this.fieldSeparator)
    );

    // Build PID if present
    if (segments.PID) {
      lines.push(this.encodePID(segments.PID));
    }

    // Build PV1 if present
    if (segments.PV1) {
      lines.push(this.encodePV1(segments.PV1));
    }

    // Build OBR if present
    if (segments.OBR) {
      lines.push(this.encodeOBR(segments.OBR));
    }

    // Build OBX segments if present
    if (segments.OBX) {
      const obxSegments = Array.isArray(segments.OBX) ? segments.OBX : [segments.OBX];
      obxSegments.forEach((obx, index) => {
        lines.push(this.encodeOBX(obx, index + 1));
      });
    }

    return lines.join('\n');
  }

  private encodePID(pid: PIDSegment): string {
    return [
      'PID',
      '1',
      pid.patientId,
      pid.mrn,
      `${pid.name.lastName}${this.componentSeparator}${pid.name.firstName}`,
      '',
      '',
      pid.dateOfBirth,
      pid.gender,
      pid.race || '',
      pid.address
        ? `${pid.address.line}${this.componentSeparator}${this.componentSeparator}${pid.address.city}${this.componentSeparator}${pid.address.state}${this.componentSeparator}${pid.address.zip}${this.componentSeparator}${pid.address.country}`
        : '',
      '',
      pid.phone || '',
    ].join(this.fieldSeparator);
  }

  private encodePV1(pv1: PV1Segment): string {
    return [
      'PV1',
      '1',
      pv1.admissionType,
      pv1.location || '',
      pv1.admitSource,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      pv1.lengthOfStay?.toString() || '0',
    ].join(this.fieldSeparator);
  }

  private encodeOBR(obr: OBRSegment): string {
    return [
      'OBR',
      '1',
      obr.orderId,
      obr.fillerOrderNumber || '',
      `${obr.orderCode}${this.componentSeparator}${obr.orderDescription || ''}`,
      '',
      this.formatTimestamp(obr.orderDateTime),
    ].join(this.fieldSeparator);
  }

  private encodeOBX(obx: OBXSegment, sequence: number): string {
    return [
      'OBX',
      sequence.toString(),
      obx.valueType,
      `${obx.code}${this.componentSeparator}${obx.codeDescription}`,
      obx.abnormalFlag || '',
      `${obx.value}${this.componentSeparator}${obx.unit || ''}`,
      obx.referenceRange || '',
      obx.abnormalFlag || '',
      '',
      '',
      '',
      obx.resultStatus,
      this.formatTimestamp(obx.observationDateTime),
    ].join(this.fieldSeparator);
  }

  private formatTimestamp(iso8601: string): string {
    try {
      const date = new Date(iso8601);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');

      return `${year}${month}${day}${hours}${minutes}${seconds}`;
    } catch {
      return new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
    }
  }
}

/**
 * AcknowledgmentBuilder - Build ACK/NACK messages
 */
export class AcknowledgmentBuilder {
  /**
   * Build positive acknowledgment (ACK)
   */
  buildACK(originalMessage: HL7Message): string {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
    return [
      `MSH|^~\\&|RECEIVING_APP|RECEIVING_FAC|${originalMessage.sendingApplication}|${originalMessage.sendingFacility}|${timestamp}||ACK^A01|${this.generateMessageId()}|P|2.5`,
      `MSA|AA|${originalMessage.messageControlId}|Application accepted`,
    ].join('\n');
  }

  /**
   * Build negative acknowledgment (NACK)
   */
  buildNACK(originalMessage: HL7Message, errorMessage: string): string {
    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
    return [
      `MSH|^~\\&|RECEIVING_APP|RECEIVING_FAC|${originalMessage.sendingApplication}|${originalMessage.sendingFacility}|${timestamp}||ACK^A01|${this.generateMessageId()}|P|2.5`,
      `MSA|AE|${originalMessage.messageControlId}|${errorMessage}`,
      `ERR||${errorMessage}`,
    ].join('\n');
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}
