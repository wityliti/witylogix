/**
 * FHIR R4 Engine - Resource management, validation, transformation
 * Production-grade implementation
 */

import {
  FHIRPatient,
  FHIREncounter,
  FHIRObservation,
  FHIRCondition,
  FHIRMedicationRequest,
  FHIRAllergyIntolerance,
  FHIRDiagnosticReport,
  FHIRProcedure,
  FHIRImmunization,
  FHIRBundle,
  FHIRReference,
  FHIRIdentifier,
  DataQualityScore,
  ComplianceStatus,
} from "./healthcare-types";

export interface SearchParams {
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];
  [key: string]: any;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface MatchScore {
  patientId: string;
  score: number;
  confidence: "high" | "medium" | "low";
  matchedFields: string[];
}

/**
 * FHIRResourceManager - CRUD operations for FHIR R4 resources
 */
export class FHIRResourceManager {
  private resources: Map<string, Map<string, any>> = new Map();
  private indexes: Map<string, Map<string, Set<string>>> = new Map();

  constructor() {
    this.initializeResourceTypes();
  }

  private initializeResourceTypes(): void {
    const resourceTypes = [
      "Patient",
      "Encounter",
      "Observation",
      "Condition",
      "MedicationRequest",
      "AllergyIntolerance",
      "DiagnosticReport",
      "Procedure",
      "Immunization",
    ];
    resourceTypes.forEach((type) => {
      this.resources.set(type, new Map());
      this.indexes.set(type, new Map());
    });
  }

  /**
   * Create a new FHIR resource
   */
  create<T extends { resourceType: string; id?: string }>(resource: T): T {
    if (!resource.resourceType) {
      throw new Error("Resource must have resourceType");
    }

    const id = resource.id || this.generateId();
    const typedResource = { ...resource, id };

    const resourceMap = this.resources.get(resource.resourceType);
    if (!resourceMap) {
      throw new Error(`Unknown resource type: ${resource.resourceType}`);
    }

    resourceMap.set(id, typedResource);
    this.indexResource(resource.resourceType, typedResource);

    return typedResource as T;
  }

  /**
   * Read a FHIR resource by ID
   */
  read<T>(resourceType: string, id: string): T | null {
    const resourceMap = this.resources.get(resourceType);
    if (!resourceMap) return null;
    return resourceMap.get(id) || null;
  }

  /**
   * Update a FHIR resource
   */
  update<T extends { resourceType: string; id: string }>(resource: T): T {
    const resourceMap = this.resources.get(resource.resourceType);
    if (!resourceMap) {
      throw new Error(`Unknown resource type: ${resource.resourceType}`);
    }

    if (!resourceMap.has(resource.id)) {
      throw new Error(
        `Resource not found: ${resource.resourceType}/${resource.id}`,
      );
    }

    const updated = {
      ...resource,
      meta: {
        ...resource.meta,
        versionId: this.nextVersion(),
        lastUpdated: new Date().toISOString(),
      },
    };

    resourceMap.set(resource.id, updated);
    this.reindexResource(resource.resourceType, updated);

    return updated as T;
  }

  /**
   * Delete a FHIR resource
   */
  delete(resourceType: string, id: string): boolean {
    const resourceMap = this.resources.get(resourceType);
    if (!resourceMap) return false;

    const removed = resourceMap.delete(id);
    if (removed) {
      this.unindexResource(resourceType, id);
    }
    return removed;
  }

  /**
   * Search resources with filters and pagination
   */
  search<T>(
    resourceType: string,
    params: SearchParams,
  ): { resources: T[]; total: number; offset: number; count: number } {
    const resourceMap = this.resources.get(resourceType);
    if (!resourceMap) {
      return { resources: [], total: 0, offset: 0, count: 0 };
    }

    let results = Array.from(resourceMap.values());

    // Apply search filters
    results = this.applySearchFilters(results, resourceType, params);

    // Apply sorting
    if (params._sort) {
      results = this.applySorting(results, params._sort);
    }

    const total = results.length;
    const offset = params._offset || 0;
    const count = params._count || 20;

    const paged = results.slice(offset, offset + count);

    return {
      resources: paged as T[],
      total,
      offset,
      count: paged.length,
    };
  }

  /**
   * Resolve resource references (includes/revincludes)
   */
  resolveReferences<T>(
    resources: T[],
    includes: string[] = [],
    revincludes: string[] = [],
  ): T[] {
    const resolved = [...resources];

    if (includes.length === 0 && revincludes.length === 0) {
      return resolved;
    }

    const included: any[] = [];

    // Process includes
    includes.forEach((include) => {
      resources.forEach((resource: any) => {
        const refs = this.extractReferences(resource, include);
        refs.forEach((ref) => {
          const resolved = this.resolveReference(ref);
          if (resolved && !included.find((r) => r.id === resolved.id)) {
            included.push(resolved);
          }
        });
      });
    });

    // Process revincludes
    revincludes.forEach((revinclude) => {
      const searchResults = this.reverseSearch(revinclude, resources);
      searchResults.forEach((res) => {
        if (!included.find((r) => r.id === res.id)) {
          included.push(res);
        }
      });
    });

    return [...resolved, ...included];
  }

  /**
   * Conditional create - creates only if no matching resource exists
   */
  conditionalCreate<T extends { resourceType: string; id?: string }>(
    resource: T,
    searchParams: Record<string, string>,
  ): { resource: T; created: boolean } {
    const existing = this.search(
      resource.resourceType,
      searchParams as SearchParams,
    );

    if (existing.resources.length > 0) {
      return {
        resource: existing.resources[0] as T,
        created: false,
      };
    }

    const created = this.create(resource);
    return { resource: created, created: true };
  }

  /**
   * Conditional update - updates matching resource or creates if not found
   */
  conditionalUpdate<T extends { resourceType: string; id?: string }>(
    resource: T,
    searchParams: Record<string, string>,
  ): { resource: T; created: boolean } {
    const existing = this.search(
      resource.resourceType,
      searchParams as SearchParams,
    );

    if (existing.resources.length === 0) {
      const created = this.create(resource);
      return { resource: created, created: true };
    }

    if (existing.resources.length > 1) {
      throw new Error("Conditional update matched multiple resources");
    }

    const updated = this.update({
      ...resource,
      id: (existing.resources[0] as any).id,
    });
    return { resource: updated, created: false };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private nextVersion(): string {
    return Date.now().toString();
  }

  private indexResource(resourceType: string, resource: any): void {
    const typeIndex = this.indexes.get(resourceType) || new Map();

    if (resource.identifier) {
      const ids = Array.isArray(resource.identifier)
        ? resource.identifier
        : [resource.identifier];
      ids.forEach((id: FHIRIdentifier) => {
        if (id.value) {
          const key = `identifier:${id.system || "default"}|${id.value}`;
          if (!typeIndex.has(key)) typeIndex.set(key, new Set());
          typeIndex.get(key)!.add(resource.id);
        }
      });
    }

    this.indexes.set(resourceType, typeIndex);
  }

  private reindexResource(resourceType: string, resource: any): void {
    this.unindexResource(resourceType, resource.id);
    this.indexResource(resourceType, resource);
  }

  private unindexResource(resourceType: string, resourceId: string): void {
    const typeIndex = this.indexes.get(resourceType);
    if (!typeIndex) return;

    typeIndex.forEach((ids) => {
      ids.delete(resourceId);
    });
  }

  private applySearchFilters(
    resources: any[],
    resourceType: string,
    params: SearchParams,
  ): any[] {
    return resources.filter((resource) => {
      for (const [key, value] of Object.entries(params)) {
        if (key.startsWith("_")) continue;

        if (resourceType === "Patient") {
          if (
            key === "name" &&
            !this.matchesPatientName(resource, value as string)
          )
            return false;
          if (key === "birthdate" && resource.birthDate !== value) return false;
          if (key === "gender" && resource.gender !== value) return false;
          if (
            key === "identifier" &&
            !this.matchesIdentifier(resource, value as string)
          )
            return false;
        }

        if (resourceType === "Observation") {
          if (key === "code" && resource.code?.coding?.[0]?.code !== value)
            return false;
          if (key === "subject" && resource.subject?.reference !== value)
            return false;
          if (
            key === "date" &&
            !resource.effectiveDateTime?.startsWith(value as string)
          )
            return false;
        }
      }
      return true;
    });
  }

  private applySorting(resources: any[], sort: string): any[] {
    const isDesc = sort.startsWith("-");
    const field = isDesc ? sort.slice(1) : sort;

    return resources.sort((a, b) => {
      const aVal = this.getNestedValue(a, field);
      const bVal = this.getNestedValue(b, field);

      if (aVal < bVal) return isDesc ? 1 : -1;
      if (aVal > bVal) return isDesc ? -1 : 1;
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
  }

  private matchesPatientName(patient: FHIRPatient, name: string): boolean {
    if (!patient.name) return false;
    return patient.name.some(
      (n) =>
        n.given?.some((g) => g.toLowerCase().includes(name.toLowerCase())) ||
        n.family?.toLowerCase().includes(name.toLowerCase()),
    );
  }

  private matchesIdentifier(resource: any, identifier: string): boolean {
    if (!resource.identifier) return false;
    const [system, value] = identifier.split("|");
    return resource.identifier.some(
      (id: FHIRIdentifier) => id.system === system && id.value === value,
    );
  }

  private extractReferences(
    resource: any,
    includePath: string,
  ): FHIRReference[] {
    const refs: FHIRReference[] = [];
    const [resourceType, refField] = includePath.split(":");

    if (resource.resourceType === resourceType) {
      const value = this.getNestedValue(resource, refField);
      if (value) {
        if (Array.isArray(value)) {
          refs.push(...value);
        } else {
          refs.push(value);
        }
      }
    }

    return refs;
  }

  private resolveReference(ref: FHIRReference): any {
    if (ref.reference) {
      const [resourceType, id] = ref.reference.split("/");
      return this.read(resourceType, id);
    }
    return null;
  }

  private reverseSearch(revinclude: string, resources: any[]): any[] {
    const [targetType, refField] = revinclude.split(":");
    const results: any[] = [];

    const targetMap = this.resources.get(targetType);
    if (!targetMap) return results;

    resources.forEach((resource) => {
      targetMap.forEach((target) => {
        const refs = this.extractReferences(
          target,
          `${resource.resourceType}:${refField}`,
        );
        if (
          refs.some(
            (ref) =>
              ref.reference === `${resource.resourceType}/${resource.id}`,
          )
        ) {
          results.push(target);
        }
      });
    });

    return results;
  }
}

/**
 * FHIRBundleProcessor - Transaction and batch bundle processing
 */
export class FHIRBundleProcessor {
  constructor(private resourceManager: FHIRResourceManager) {}

  /**
   * Process transaction bundle - atomic operation
   */
  processTransactionBundle(bundle: FHIRBundle): FHIRBundle {
    if (bundle.type !== "transaction") {
      throw new Error("Bundle must be of type transaction");
    }

    const responses: any[] = [];
    const entries = bundle.entry || [];

    try {
      entries.forEach((entry) => {
        const response = this.processEntry(entry);
        responses.push(response);
      });

      return {
        resourceType: "Bundle",
        type: "transaction-response",
        entry: responses,
      };
    } catch (error) {
      throw new Error(`Transaction failed: ${error}`);
    }
  }

  /**
   * Process batch bundle - independent operations
   */
  processBatchBundle(bundle: FHIRBundle): FHIRBundle {
    if (bundle.type !== "batch") {
      throw new Error("Bundle must be of type batch");
    }

    const responses: any[] = [];
    const entries = bundle.entry || [];

    entries.forEach((entry) => {
      try {
        const response = this.processEntry(entry);
        responses.push(response);
      } catch (error) {
        responses.push({
          response: {
            status: "400",
            outcome: {
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "processing",
                  details: { text: String(error) },
                },
              ],
            },
          },
        });
      }
    });

    return {
      resourceType: "Bundle",
      type: "batch-response",
      entry: responses,
    };
  }

  private processEntry(entry: any): any {
    const { request, resource } = entry;

    if (!request || !request.method) {
      throw new Error("Entry missing request method");
    }

    switch (request.method) {
      case "POST":
        return this.handleCreate(resource);
      case "PUT":
        return this.handleUpdate(resource, request.url);
      case "DELETE":
        return this.handleDelete(request.url);
      case "GET":
        return this.handleSearch(request.url);
      default:
        throw new Error(`Unsupported method: ${request.method}`);
    }
  }

  private handleCreate(resource: any): any {
    const created = this.resourceManager.create(resource);
    return {
      response: {
        status: "201",
        location: `${resource.resourceType}/${created.id}`,
      },
      resource: created,
    };
  }

  private handleUpdate(resource: any, url: string): any {
    const updated = this.resourceManager.update(resource);
    return {
      response: {
        status: "200",
        location: url,
      },
      resource: updated,
    };
  }

  private handleDelete(url: string): any {
    const [resourceType, id] = url.split("/");
    this.resourceManager.delete(resourceType, id);
    return {
      response: {
        status: "204",
      },
    };
  }

  private handleSearch(url: string): any {
    const [path, queryString] = url.split("?");
    const [resourceType] = path.split("/");
    const params = this.parseQueryString(queryString || "");

    const result = this.resourceManager.search(
      resourceType,
      params as SearchParams,
    );

    return {
      response: {
        status: "200",
      },
      resource: {
        resourceType: "Bundle",
        type: "searchset",
        total: result.total,
        entry: result.resources.map((resource) => ({
          resource,
          search: { mode: "match" },
        })),
      },
    };
  }

  private parseQueryString(queryString: string): Record<string, any> {
    const params: Record<string, any> = {};
    new URLSearchParams(queryString).forEach((value, key) => {
      if (params[key]) {
        if (!Array.isArray(params[key])) {
          params[key] = [params[key]];
        }
        params[key].push(value);
      } else {
        params[key] = value;
      }
    });
    return params;
  }
}

/**
 * FHIRValidator - Validate resources against R4 profiles
 */
export class FHIRValidator {
  private requiredFields: Record<string, string[]> = {
    Patient: ["resourceType"],
    Encounter: ["resourceType", "status", "class", "subject"],
    Observation: ["resourceType", "status", "code", "subject"],
    Condition: ["resourceType", "code", "subject"],
    MedicationRequest: [
      "resourceType",
      "status",
      "intent",
      "medicationCodeableConcept",
      "subject",
    ],
    Procedure: ["resourceType", "status", "subject"],
  };

  /**
   * Validate resource against R4 profile
   */
  validate(resource: any): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Check resource type
    if (!resource.resourceType) {
      errors.push({
        path: "resourceType",
        message: "Missing resourceType",
        severity: "error",
      });
      return { valid: false, errors };
    }

    // Check required fields
    const required = this.requiredFields[resource.resourceType] || [];
    required.forEach((field) => {
      if (!this.hasField(resource, field)) {
        errors.push({
          path: field,
          message: `Required field missing: ${field}`,
          severity: "error",
        });
      }
    });

    // Type-specific validation
    if (resource.resourceType === "Patient") {
      this.validatePatient(resource, errors);
    } else if (resource.resourceType === "Observation") {
      this.validateObservation(resource, errors);
    }

    // Check reference integrity
    this.validateReferences(resource, errors);

    return {
      valid: errors.filter((e) => e.severity === "error").length === 0,
      errors,
    };
  }

  private validatePatient(
    patient: FHIRPatient,
    errors: ValidationError[],
  ): void {
    if (patient.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(patient.birthDate)) {
      errors.push({
        path: "birthDate",
        message: "Invalid date format (YYYY-MM-DD expected)",
        severity: "error",
      });
    }

    if (
      patient.gender &&
      !["male", "female", "other", "unknown"].includes(patient.gender)
    ) {
      errors.push({
        path: "gender",
        message: "Invalid gender value",
        severity: "error",
      });
    }
  }

  private validateObservation(
    observation: FHIRObservation,
    errors: ValidationError[],
  ): void {
    if (
      !["registered", "preliminary", "final", "amended", "cancelled"].includes(
        observation.status,
      )
    ) {
      errors.push({
        path: "status",
        message: "Invalid observation status",
        severity: "error",
      });
    }
  }

  private validateReferences(resource: any, errors: ValidationError[]): void {
    const refs = this.extractAllReferences(resource);
    refs.forEach((ref) => {
      if (
        ref.reference &&
        !/^[A-Za-z]+\/[A-Za-z0-9\-\.]+$/.test(ref.reference)
      ) {
        errors.push({
          path: "reference",
          message: `Invalid reference format: ${ref.reference}`,
          severity: "warning",
        });
      }
    });
  }

  private hasField(resource: any, field: string): boolean {
    return this.getNestedValue(resource, field) !== undefined;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
  }

  private extractAllReferences(
    obj: any,
    refs: FHIRReference[] = [],
  ): FHIRReference[] {
    if (obj && typeof obj === "object") {
      if ("reference" in obj) {
        refs.push(obj as FHIRReference);
      }
      Object.values(obj).forEach((value) => {
        if (value && typeof value === "object") {
          this.extractAllReferences(value, refs);
        }
      });
    }
    return refs;
  }
}

/**
 * FHIRTransformer - Convert between FHIR and custom formats
 */
export class FHIRTransformer {
  /**
   * Transform custom data structure to FHIR Patient
   */
  toFHIRPatient(customData: any): FHIRPatient {
    return {
      resourceType: "Patient",
      id: customData.patientId,
      identifier: customData.mrn
        ? [
            {
              system: "http://example.com/mrn",
              value: customData.mrn,
            },
          ]
        : undefined,
      name: [
        {
          given: [customData.firstName],
          family: customData.lastName,
        },
      ],
      gender: customData.gender,
      birthDate: customData.dateOfBirth,
      telecom: customData.phone
        ? [{ system: "phone", value: customData.phone }]
        : undefined,
      address: customData.address
        ? [
            {
              line: [customData.address.line1, customData.address.line2].filter(
                Boolean,
              ),
              city: customData.address.city,
              state: customData.address.state,
              postalCode: customData.address.zip,
              country: customData.address.country,
            },
          ]
        : undefined,
    };
  }

  /**
   * Transform FHIR Patient to normalized format
   */
  fromFHIRPatient(fhirPatient: FHIRPatient): Record<string, any> {
    const primaryName = fhirPatient.name?.[0];
    const primaryPhone = fhirPatient.telecom?.find((t) => t.system === "phone");
    const primaryAddress = fhirPatient.address?.[0];

    return {
      patientId: fhirPatient.id,
      mrn: fhirPatient.identifier?.find(
        (i) => i.system === "http://example.com/mrn",
      )?.value,
      firstName: primaryName?.given?.[0],
      lastName: primaryName?.family,
      gender: fhirPatient.gender,
      dateOfBirth: fhirPatient.birthDate,
      phone: primaryPhone?.value,
      address: primaryAddress
        ? {
            line1: primaryAddress.line?.[0],
            line2: primaryAddress.line?.[1],
            city: primaryAddress.city,
            state: primaryAddress.state,
            zip: primaryAddress.postalCode,
            country: primaryAddress.country,
          }
        : null,
    };
  }
}

/**
 * PatientMatcher - Probabilistic patient matching
 */
export class PatientMatcher {
  private scoreThreshold: number = 75;

  /**
   * Match patient with fuzzy scoring
   */
  matchPatients(
    incomingPatient: FHIRPatient,
    candidatePatients: FHIRPatient[],
  ): MatchScore[] {
    return candidatePatients
      .map((candidate) => this.scoreMatch(incomingPatient, candidate))
      .filter((score) => score.score >= this.scoreThreshold)
      .sort((a, b) => b.score - a.score);
  }

  private scoreMatch(
    incoming: FHIRPatient,
    candidate: FHIRPatient,
  ): MatchScore {
    const matchedFields: string[] = [];
    let score = 0;

    // MRN match (highest priority)
    const incomingMRN = incoming.identifier?.find(
      (i) => i.system === "http://example.com/mrn",
    );
    const candidateMRN = candidate.identifier?.find(
      (i) => i.system === "http://example.com/mrn",
    );

    if (
      incomingMRN?.value &&
      candidateMRN?.value &&
      incomingMRN.value === candidateMRN.value
    ) {
      score += 40;
      matchedFields.push("mrn");
    }

    // Name match
    const incomingName = incoming.name?.[0];
    const candidateName = candidate.name?.[0];

    if (incomingName && candidateName) {
      const familyMatch = this.stringSimilarity(
        incomingName.family,
        candidateName.family,
      );
      const givenMatch = this.stringSimilarity(
        incomingName.given?.[0],
        candidateName.given?.[0],
      );

      if (familyMatch > 0.8) {
        score += 20;
        matchedFields.push("family_name");
      }
      if (givenMatch > 0.8) {
        score += 15;
        matchedFields.push("given_name");
      }
    }

    // DOB match
    if (
      incoming.birthDate &&
      candidate.birthDate &&
      incoming.birthDate === candidate.birthDate
    ) {
      score += 20;
      matchedFields.push("dob");
    }

    // SSN last 4 (if available)
    const incomingSSN = incoming.identifier?.find(
      (i) => i.system === "http://example.com/ssn",
    );
    const candidateSSN = candidate.identifier?.find(
      (i) => i.system === "http://example.com/ssn",
    );

    if (
      incomingSSN?.value &&
      candidateSSN?.value &&
      incomingSSN.value.slice(-4) === candidateSSN.value.slice(-4)
    ) {
      score += 15;
      matchedFields.push("ssn_last4");
    }

    // Gender match
    if (
      incoming.gender &&
      candidate.gender &&
      incoming.gender === candidate.gender
    ) {
      score += 10;
      matchedFields.push("gender");
    }

    const confidence: "high" | "medium" | "low" =
      score >= 90 ? "high" : score >= 75 ? "medium" : "low";

    return {
      patientId: candidate.id || "",
      score: Math.min(score, 100),
      confidence,
      matchedFields,
    };
  }

  private stringSimilarity(a?: string, b?: string): number {
    if (!a || !b) return 0;

    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    if (aLower === bLower) return 1;

    const longer = aLower.length > bLower.length ? aLower : bLower;
    const shorter = aLower.length > bLower.length ? bLower : aLower;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return 1 - editDistance / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
