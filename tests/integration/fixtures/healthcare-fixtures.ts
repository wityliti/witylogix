/**
 * Healthcare Test Fixtures
 * Factory functions for FHIR resources and clinical data
 * ~150 lines
 */

// ============================================================================
// PATIENT FIXTURES
// ============================================================================

export interface PatientFixture {
  id?: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
}

export const createPatientFixture = (overrides?: Partial<PatientFixture>): PatientFixture => ({
  mrn: `MRN${Math.floor(Math.random() * 1000000)}`,
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1980-01-01',
  gender: 'male',
  ...overrides,
});

export const createFemalePatientFixture = (overrides?: Partial<PatientFixture>): PatientFixture => ({
  mrn: `MRN${Math.floor(Math.random() * 1000000)}`,
  firstName: 'Jane',
  lastName: 'Smith',
  dateOfBirth: '1985-06-15',
  gender: 'female',
  ...overrides,
});

export const createPediatricPatientFixture = (overrides?: Partial<PatientFixture>): PatientFixture => ({
  mrn: `MRN${Math.floor(Math.random() * 1000000)}`,
  firstName: 'Tommy',
  lastName: 'Child',
  dateOfBirth: '2020-03-20',
  gender: 'male',
  ...overrides,
});

// ============================================================================
// ENCOUNTER FIXTURES
// ============================================================================

export interface EncounterFixture {
  id?: string;
  patientId: string;
  type: 'office_visit' | 'hospitalization' | 'emergency' | 'telehealth';
  status: string;
  startDate: Date;
  endDate?: Date;
  provider: string;
  location: string;
}

export const createEncounterFixture = (patientId: string, overrides?: Partial<EncounterFixture>): EncounterFixture => ({
  patientId,
  type: 'office_visit',
  status: 'completed',
  startDate: new Date(),
  provider: 'Dr. Smith',
  location: 'Primary Care Clinic',
  ...overrides,
});

export const createEmergencyEncounterFixture = (patientId: string, overrides?: Partial<EncounterFixture>): EncounterFixture => ({
  patientId,
  type: 'emergency',
  status: 'in-progress',
  startDate: new Date(),
  provider: 'Dr. Emergency',
  location: 'Emergency Department',
  ...overrides,
});

export const createHospitalizationFixture = (patientId: string, overrides?: Partial<EncounterFixture>): EncounterFixture => ({
  patientId,
  type: 'hospitalization',
  status: 'completed',
  startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  provider: 'Dr. Admission',
  location: 'Hospital Ward',
  ...overrides,
});

// ============================================================================
// OBSERVATION FIXTURES
// ============================================================================

export interface ObservationFixture {
  id?: string;
  encounterId: string;
  code: string;
  description: string;
  value: string | number;
  unit: string;
  status: string;
}

export const createObservationFixture = (encounterId: string, overrides?: Partial<ObservationFixture>): ObservationFixture => ({
  encounterId,
  code: '9279-1',
  description: 'Respiratory Rate',
  value: 16,
  unit: 'breaths/min',
  status: 'final',
  ...overrides,
});

export const createBloodPressureFixture = (encounterId: string, overrides?: Partial<ObservationFixture>): ObservationFixture => ({
  encounterId,
  code: '55284-4',
  description: 'Blood Pressure',
  value: '130/80',
  unit: 'mmHg',
  status: 'final',
  ...overrides,
});

export const createTemperatureFixture = (encounterId: string, overrides?: Partial<ObservationFixture>): ObservationFixture => ({
  encounterId,
  code: '8310-5',
  description: 'Body Temperature',
  value: 98.6,
  unit: 'F',
  status: 'final',
  ...overrides,
});

export const createLabResultFixture = (encounterId: string, overrides?: Partial<ObservationFixture>): ObservationFixture => ({
  encounterId,
  code: '2345-7',
  description: 'Glucose Level',
  value: 105,
  unit: 'mg/dL',
  status: 'final',
  ...overrides,
});

// ============================================================================
// CONDITION FIXTURES
// ============================================================================

export interface ConditionFixture {
  id?: string;
  patientId: string;
  code: string;
  description: string;
  status: 'active' | 'inactive' | 'resolved';
  onsetDate: Date;
}

export const createConditionFixture = (patientId: string, overrides?: Partial<ConditionFixture>): ConditionFixture => ({
  patientId,
  code: 'I10',
  description: 'Essential Hypertension',
  status: 'active',
  onsetDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  ...overrides,
});

export const createDiabetesFixture = (patientId: string, overrides?: Partial<ConditionFixture>): ConditionFixture => ({
  patientId,
  code: 'E11',
  description: 'Type 2 Diabetes Mellitus',
  status: 'active',
  onsetDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
  ...overrides,
});

export const createAsthmaFixture = (patientId: string, overrides?: Partial<ConditionFixture>): ConditionFixture => ({
  patientId,
  code: 'J45',
  description: 'Asthma',
  status: 'active',
  onsetDate: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
  ...overrides,
});

// ============================================================================
// MEDICATION FIXTURES
// ============================================================================

export interface MedicationFixture {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'active' | 'discontinued' | 'completed';
}

export const createMedicationFixture = (overrides?: Partial<MedicationFixture>): MedicationFixture => ({
  name: 'Lisinopril',
  dosage: '10 mg',
  frequency: 'once daily',
  route: 'oral',
  status: 'active',
  ...overrides,
});

export const createAntibioticFixture = (overrides?: Partial<MedicationFixture>): MedicationFixture => ({
  name: 'Amoxicillin',
  dosage: '500 mg',
  frequency: 'three times daily',
  route: 'oral',
  status: 'active',
  ...overrides,
});

export const createInsulinFixture = (overrides?: Partial<MedicationFixture>): MedicationFixture => ({
  name: 'Insulin Glargine',
  dosage: '20 units',
  frequency: 'once daily at bedtime',
  route: 'subcutaneous',
  status: 'active',
  ...overrides,
});

// ============================================================================
// HL7 MESSAGE FIXTURES
// ============================================================================

export const createAdtA01MessageFixture = (patientId: string, mrn: string): string => {
  const timestamp = new Date().toISOString().replace(/[-:.Z]/g, '');
  return `MSH|^~\\&|HIS|HOSPITAL|RECEIVING|FACILITY|${timestamp}||ADT^A01|${patientId}|P|2.4
PID|||${mrn}^^^MRN||DOE^JOHN||19800101|M|||123 MAIN ST^^CITY^ST^12345||555-1234
PV1||I|WARD1^ROOM101|H|||${patientId}||||||||||||V`;
};

export const createOrmO01MessageFixture = (patientId: string): string => {
  const timestamp = new Date().toISOString().replace(/[-:.Z]/g, '');
  return `MSH|^~\\&|LAB|LAB_FAC|HOSPITAL|RECEIVING|${timestamp}||ORM^O01|${patientId}|P|2.4
PID|||${patientId}^^^MRN||PATIENT^TEST||19900101|M
ORC|NW|ORDER123|FILLER456|||||||
OBR|1|ORDER123|FILLER456|85025^Complete Blood Count||${timestamp}`;
};

export const createOruR01MessageFixture = (patientId: string): string => {
  const timestamp = new Date().toISOString().replace(/[-:.Z]/g, '');
  return `MSH|^~\\&|LAB|LAB_FAC|HOSPITAL|RECEIVING|${timestamp}||ORU^R01|${patientId}|P|2.4
PID|||${patientId}^^^MRN||RESULT^PATIENT||19900101|M
OBR|1|ORDER123|FILLER456|85025^Complete Blood Count||${timestamp}||F
OBX|1|NM|WBC^White Blood Cell Count||7.5|10*3/uL|4.5-11|N|||F`;
};

// ============================================================================
// FHIR BUNDLE FIXTURES
// ============================================================================

export const createFhirBundleFixture = (): Record<string, unknown> => ({
  resourceType: 'Bundle',
  type: 'batch',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }],
        birthDate: '1980-01-01',
        gender: 'male',
      },
      request: { method: 'POST', url: 'Patient' },
    },
  ],
});

export const createTransactionBundleFixture = (): Record<string, unknown> => ({
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        identifier: [{ system: 'http://hospital.org/mrn', value: 'MRN123' }],
        name: [{ given: ['Jane'], family: 'Smith' }],
      },
      request: { method: 'POST', url: 'Patient' },
    },
    {
      resource: {
        resourceType: 'Encounter',
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        subject: { reference: 'Patient/pat_123' },
        period: { start: '2024-01-01T08:00:00Z', end: '2024-01-01T09:00:00Z' },
      },
      request: { method: 'POST', url: 'Encounter' },
    },
  ],
});
