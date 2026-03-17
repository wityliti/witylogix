/**
 * Clinical Decision Support
 *
 * AI module for healthcare clinical guidance:
 * - DrugInteractionChecker: Check drug-drug, drug-food interactions with severity
 * - AllergyAlertEngine: Cross-reactivity detection and severity-based alerts
 * - ClinicalRuleEngine: Evidence-based guidelines (diabetes, sepsis, VTE, fall risk)
 * - LabResultInterpreter: Interpret labs with reference ranges by age/sex
 * - DiagnosisSuggester: Symptom-to-condition matching with differential ranking
 * - RiskStratifier: Clinical risk scores (Framingham, ASCVD, Wells, CHADS2-VASc)
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  mechanism: string;
  alternatives: string[];
  managementStrategy: string;
}

export interface AllergyAlert {
  allergen: string;
  reportedAllergy: string;
  crossReactivity: boolean;
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  manifestations: string[];
  overrideReasons?: string;
}

export interface ClinicalRule {
  ruleId: string;
  name: string;
  guideline: string;
  condition: string;
  recommendation: string;
  evidence: 'strong' | 'moderate' | 'weak';
  applicabilityChecks: string[];
  actions: string[];
}

export interface LabResult {
  testName: string;
  value: number;
  unit: string;
  refRangeMin?: number;
  refRangeMax?: number;
  interpretation: 'low' | 'normal' | 'high' | 'critical';
  flag?: 'L' | 'H' | 'C' | null;
  trend?: 'increasing' | 'stable' | 'decreasing';
}

export interface DiagnosisSuggestion {
  condition: string;
  icdCode: string;
  likelihood: number; // 0-1
  supportingEvidence: string[];
  differentialRank: number;
  redFlags: string[];
  nextSteps: string[];
}

export interface RiskScore {
  scoreName: string;
  score: number;
  riskCategory: 'low' | 'intermediate' | 'high' | 'very_high';
  riskPercentage?: number;
  interpretation: string;
  components: Map<string, number>;
}

// ─── DRUG INTERACTION CHECKER ───────────────────────────────────────────────

export class DrugInteractionChecker {
  private interactionDatabase: Map<string, DrugInteraction[]> = new Map([
    ['warfarin+aspirin', [{
      drug1: 'warfarin',
      drug2: 'aspirin',
      severity: 'major',
      mechanism: 'Increased bleeding risk due to antiplatelet effect',
      alternatives: ['acetaminophen', 'topical NSAIDs'],
      managementStrategy: 'Use lowest effective dose, monitor INR closely',
    }]],
    ['metformin+contrast', [{
      drug1: 'metformin',
      drug2: 'iodinated contrast',
      severity: 'major',
      mechanism: 'Risk of contrast-induced nephropathy and lactic acidosis',
      alternatives: ['non-contrast imaging', 'CO2 angiography'],
      managementStrategy: 'Hold metformin 48h post-contrast if eGFR <60',
    }]],
    ['ssri+maoi', [{
      drug1: 'SSRI',
      drug2: 'MAOI',
      severity: 'contraindicated',
      mechanism: 'Serotonin syndrome risk',
      alternatives: ['tricyclic antidepressants', 'alternative SSRIs'],
      managementStrategy: 'Minimum 14 day washout required; consider switching class',
    }]],
    ['lisinopril+potassium', [{
      drug1: 'ACE inhibitor',
      drug2: 'potassium supplement',
      severity: 'major',
      mechanism: 'Hyperkalemia risk',
      alternatives: ['diuretic', 'low-sodium diet'],
      managementStrategy: 'Monitor K+ levels; check baseline renal function',
    }]],
  ]);

  checkInteraction(drug1: string, drug2: string): DrugInteraction | null {
    const normalized1 = drug1.toLowerCase();
    const normalized2 = drug2.toLowerCase();
    const key = `${normalized1}+${normalized2}`;
    const reverseKey = `${normalized2}+${normalized1}`;

    let interactions = this.interactionDatabase.get(key);
    if (!interactions) {
      interactions = this.interactionDatabase.get(reverseKey);
    }

    if (!interactions) {
      return this.detectGenericInteraction(normalized1, normalized2);
    }

    return interactions[0];
  }

  private detectGenericInteraction(drug1: string, drug2: string): DrugInteraction | null {
    const anticoagulants = ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran'];
    const nsaids = ['ibuprofen', 'naproxen', 'indomethacin', 'diclofenac'];
    const acei = ['lisinopril', 'enalapril', 'ramipril', 'perindopril'];
    const potassiumSparing = ['spironolactone', 'amiloride', 'potassium'];

    if (anticoagulants.includes(drug1) && nsaids.includes(drug2)) {
      return {
        drug1,
        drug2,
        severity: 'major',
        mechanism: 'NSAIDs may inhibit anticoagulation and increase GI bleed risk',
        alternatives: ['acetaminophen', 'topical agents'],
        managementStrategy: 'Use lowest dose NSAID with PPI coverage if necessary',
      };
    }

    if (acei.includes(drug1) && potassiumSparing.includes(drug2)) {
      return {
        drug1,
        drug2,
        severity: 'major',
        mechanism: 'Increased hyperkalemia risk',
        alternatives: ['alternative antihypertensive', 'dietary modification'],
        managementStrategy: 'Monitor potassium levels regularly',
      };
    }

    return null;
  }
}

// ─── ALLERGY ALERT ENGINE ───────────────────────────────────────────────────

export class AllergyAlertEngine {
  private crossReactivityMap: Map<string, string[]> = new Map([
    ['penicillin', ['ampicillin', 'amoxicillin', 'cephalosporins']],
    ['sulfonamides', ['loop diuretics', 'thiazide diuretics', 'acetazolamide']],
    ['nsaids', ['ibuprofen', 'naproxen', 'indomethacin', 'ketorolac']],
    ['tree nuts', ['peanuts', 'shellfish']],
    ['shellfish', ['iodine contrast', 'tree nuts']],
  ]);

  checkAllergyAlert(reportedAllergy: string, proposedMedication: string): AllergyAlert | null {
    const allergy = reportedAllergy.toLowerCase();
    const medication = proposedMedication.toLowerCase();

    if (allergy === medication) {
      return {
        allergen: proposedMedication,
        reportedAllergy,
        crossReactivity: false,
        severity: this.assessSeverity(allergy),
        manifestations: this.getManifestations(allergy),
      };
    }

    const crossReactive = this.isCrossReactive(allergy, medication);
    if (crossReactive) {
      return {
        allergen: proposedMedication,
        reportedAllergy,
        crossReactivity: true,
        severity: this.assessSeverity(allergy, true),
        manifestations: this.getManifestations(allergy),
      };
    }

    return null;
  }

  private isCrossReactive(allergy: string, medication: string): boolean {
    const related = this.crossReactivityMap.get(allergy) || [];
    return related.some((r) => medication.includes(r.toLowerCase()) || r.toLowerCase().includes(medication));
  }

  private assessSeverity(allergen: string, isCrossReactive = false): AllergyAlert['severity'] {
    const severeAllergens = [
      'penicillin', 'cephalosporin', 'anaphylaxis', 'anaphylactic',
      'iodine', 'contrast', 'shellfish', 'peanut',
    ];

    const isSevere = severeAllergens.some((s) => allergen.includes(s));

    if (isSevere) {
      return isCrossReactive ? 'severe' : 'anaphylaxis';
    }

    return isCrossReactive ? 'moderate' : 'mild';
  }

  private getManifestations(allergen: string): string[] {
    const manifestationMap: Record<string, string[]> = {
      penicillin: ['rash', 'itching', 'anaphylaxis', 'Stevens-Johnson syndrome'],
      nsaid: ['rash', 'GI upset', 'angioedema', 'anaphylaxis'],
      shellfish: ['hives', 'angioedema', 'anaphylaxis', 'respiratory distress'],
      iodine: ['flushing', 'metal taste', 'anaphylaxis', 'nephropathy'],
    };

    for (const [key, values] of Object.entries(manifestationMap)) {
      if (allergen.includes(key)) return values;
    }

    return ['rash', 'itching', 'swelling'];
  }
}

// ─── CLINICAL RULE ENGINE ───────────────────────────────────────────────────

export class ClinicalRuleEngine {
  private rules: ClinicalRule[] = [
    {
      ruleId: 'dm_001',
      name: 'Diabetes Management - Type 2',
      guideline: 'ADA Standards of Care 2024',
      condition: 'Type 2 Diabetes Mellitus',
      recommendation: 'Target HbA1c <7% for most patients; start metformin if not contraindicated',
      evidence: 'strong',
      applicabilityChecks: ['eGFR > 30', 'no active infection', 'GI tolerance acceptable'],
      actions: ['Initiate metformin', 'Check HbA1c quarterly', 'Refer to endocrinology if uncontrolled'],
    },
    {
      ruleId: 'sepsis_001',
      name: 'Early Sepsis Recognition',
      guideline: 'Surviving Sepsis Campaign 2021',
      condition: 'Suspected Sepsis (≥2 SIRS criteria + suspected infection)',
      recommendation: 'Obtain lactate, blood cultures; initiate broad-spectrum antibiotics within 1 hour',
      evidence: 'strong',
      applicabilityChecks: ['Fever or hypothermia', 'Tachycardia', 'Tachypnea', 'Known/suspected infection'],
      actions: ['Draw lactate/cultures', 'Start empiric antibiotics', 'Start IV fluids', 'Recheck lactate in 3h'],
    },
    {
      ruleId: 'vte_001',
      name: 'VTE Prophylaxis',
      guideline: 'ACCP Guidelines 2023',
      condition: 'Hospitalized patient, high VTE risk',
      recommendation: 'Initiate pharmacologic and mechanical prophylaxis',
      evidence: 'strong',
      applicabilityChecks: ['Immobile', 'Post-operative', 'Cancer patient', 'Recent trauma'],
      actions: ['Assess bleeding risk', 'Consider LMWH or heparin', 'Use sequential compression devices', 'Early mobilization'],
    },
    {
      ruleId: 'fall_001',
      name: 'Fall Risk Mitigation',
      guideline: 'Hospital Fall Prevention Protocol',
      condition: 'High fall risk (score ≥4)',
      recommendation: 'Implement fall prevention bundle',
      evidence: 'moderate',
      applicabilityChecks: ['Age >65', 'Polypharmacy', 'Cognitive impairment', 'Recent fall'],
      actions: ['Place near nurse station', 'Use bed alarm', 'Non-slip socks', 'Educate patient/family'],
    },
  ];

  getRulesForCondition(condition: string): ClinicalRule[] {
    return this.rules.filter((rule) =>
      rule.condition.toLowerCase().includes(condition.toLowerCase()) ||
      rule.name.toLowerCase().includes(condition.toLowerCase())
    );
  }

  evaluateRuleApplicability(rule: ClinicalRule, patientData: Record<string, any>): boolean {
    return rule.applicabilityChecks.every((check) => {
      const checkLower = check.toLowerCase();

      if (checkLower.includes('egfr')) {
        const value = parseFloat(checkLower.match(/\d+/)?.[0] || '0');
        return (patientData.eGFR || 0) > value;
      }

      if (checkLower.includes('age')) {
        const value = parseFloat(checkLower.match(/\d+/)?.[0] || '0');
        return (patientData.age || 0) >= value;
      }

      return patientData[checkLower.replace(/\s+/g, '_')] === true;
    });
  }
}

// ─── LAB RESULT INTERPRETER ────────────────────────────────────────────────

export class LabResultInterpreter {
  private referenceRanges: Record<string, Record<string, any>> = {
    hemoglobin: {
      adult_male: { min: 13.5, max: 17.5 },
      adult_female: { min: 12.0, max: 15.5 },
      pediatric_0_2: { min: 10.0, max: 13.0 },
    },
    creatinine: {
      adult_male: { min: 0.74, max: 1.35 },
      adult_female: { min: 0.59, max: 1.04 },
      pediatric_0_3: { min: 0.3, max: 0.4 },
    },
    potassium: {
      all: { min: 3.5, max: 5.0 },
      critical_low: 2.5,
      critical_high: 6.5,
    },
    glucose: {
      fasting: { min: 70, max: 100 },
      random: { min: 70, max: 200 },
      critical_low: 50,
      critical_high: 400,
    },
    sodium: {
      all: { min: 135, max: 145 },
      critical_low: 120,
      critical_high: 160,
    },
  };

  interpretLab(
    testName: string,
    value: number,
    unit: string,
    ageYears?: number,
    isMale?: boolean
  ): LabResult {
    const normRefRange = this.getReferenceRange(testName, ageYears, isMale);

    let interpretation: LabResult['interpretation'];
    let flag: LabResult['flag'] | null = null;

    const critical = this.isCriticalValue(testName, value);
    if (critical) {
      interpretation = 'critical';
      flag = value < (normRefRange.min || 0) ? 'L' : 'H';
    } else if (value < (normRefRange.min || 0)) {
      interpretation = 'low';
      flag = 'L';
    } else if (value > (normRefRange.max || 999)) {
      interpretation = 'high';
      flag = 'H';
    } else {
      interpretation = 'normal';
    }

    return {
      testName,
      value,
      unit,
      refRangeMin: normRefRange.min,
      refRangeMax: normRefRange.max,
      interpretation,
      flag,
    };
  }

  private getReferenceRange(
    testName: string,
    ageYears?: number,
    isMale?: boolean
  ): { min?: number; max?: number } {
    const ranges = this.referenceRanges[testName.toLowerCase()] || {};

    if (testName.toLowerCase() === 'hemoglobin') {
      const category = isMale ? 'adult_male' : 'adult_female';
      return ranges[category] || { min: 12, max: 16 };
    }

    if (testName.toLowerCase() === 'creatinine') {
      const category = isMale ? 'adult_male' : 'adult_female';
      return ranges[category] || { min: 0.6, max: 1.2 };
    }

    if (ranges['all']) {
      return ranges['all'];
    }

    return { min: 0, max: 1000 };
  }

  private isCriticalValue(testName: string, value: number): boolean {
    const testLower = testName.toLowerCase();

    if (testLower.includes('potassium')) {
      return value < 2.5 || value > 6.5;
    }
    if (testLower.includes('glucose')) {
      return value < 50 || value > 400;
    }
    if (testLower.includes('sodium')) {
      return value < 120 || value > 160;
    }
    if (testLower.includes('hemoglobin')) {
      return value < 7 || value > 20;
    }

    return false;
  }

  interpretPanel(
    results: LabResult[],
    ageYears?: number,
    isMale?: boolean
  ): { results: LabResult[]; panelInterpretation: string; recommendations: string[] } {
    const interpreted = results.map((r) =>
      this.interpretLab(r.testName, r.value, r.unit, ageYears, isMale)
    );

    const criticalCount = interpreted.filter((r) => r.interpretation === 'critical').length;
    const abnormalCount = interpreted.filter((r) => r.interpretation !== 'normal').length;

    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push('CRITICAL VALUES DETECTED - Notify provider immediately');
    }

    if (abnormalCount > 2) {
      recommendations.push('Multiple abnormalities - consider systemic process');
    }

    const summary =
      criticalCount > 0
        ? 'CRITICAL RESULTS'
        : abnormalCount > 0
          ? 'Abnormal panel'
          : 'Normal results';

    return {
      results: interpreted,
      panelInterpretation: summary,
      recommendations,
    };
  }
}

// ─── DIAGNOSIS SUGGESTER ────────────────────────────────────────────────────

export class DiagnosisSuggester {
  private symptomMap: Record<string, Array<{ condition: string; icd: string; likelihood: number }>> = {
    'chest pain': [
      { condition: 'Acute Coronary Syndrome', icd: 'I20-I25', likelihood: 0.35 },
      { condition: 'Pulmonary Embolism', icd: 'I26', likelihood: 0.2 },
      { condition: 'Aortic Dissection', icd: 'I71', likelihood: 0.08 },
      { condition: 'Pneumonia', icd: 'J12-J18', likelihood: 0.15 },
      { condition: 'Musculoskeletal Pain', icd: 'M79.1', likelihood: 0.22 },
    ],
    'shortness of breath': [
      { condition: 'Pneumonia', icd: 'J12-J18', likelihood: 0.25 },
      { condition: 'Pulmonary Embolism', icd: 'I26', likelihood: 0.2 },
      { condition: 'Heart Failure', icd: 'I50', likelihood: 0.25 },
      { condition: 'Asthma', icd: 'J45', likelihood: 0.15 },
      { condition: 'COPD exacerbation', icd: 'J44', likelihood: 0.15 },
    ],
    'fever': [
      { condition: 'Infection/Sepsis', icd: 'A00-B99', likelihood: 0.4 },
      { condition: 'Inflammatory condition', icd: 'M05-M36', likelihood: 0.3 },
      { condition: 'Malignancy', icd: 'C00-D49', likelihood: 0.15 },
      { condition: 'Drug reaction', icd: 'T80-T88', likelihood: 0.1 },
      { condition: 'Heat stroke', icd: 'T67', likelihood: 0.05 },
    ],
  };

  suggestDiagnoses(symptoms: string[], patientData?: Record<string, any>): DiagnosisSuggestion[] {
    const suggestionMap: Record<string, DiagnosisSuggestion> = {};

    symptoms.forEach((symptom) => {
      const key = symptom.toLowerCase();
      const candidates = this.symptomMap[key] || [];

      candidates.forEach((cand) => {
        if (!suggestionMap[cand.condition]) {
          suggestionMap[cand.condition] = {
            condition: cand.condition,
            icdCode: cand.icd,
            likelihood: cand.likelihood,
            supportingEvidence: [symptom],
            differentialRank: 0,
            redFlags: this.getRedFlags(cand.condition),
            nextSteps: this.getNextSteps(cand.condition),
          };
        } else {
          suggestionMap[cand.condition].likelihood = Math.min(
            1,
            suggestionMap[cand.condition].likelihood + cand.likelihood * 0.1
          );
          suggestionMap[cand.condition].supportingEvidence.push(symptom);
        }
      });
    });

    const sorted = Object.values(suggestionMap)
      .sort((a, b) => b.likelihood - a.likelihood)
      .map((s, i) => ({ ...s, differentialRank: i + 1 }));

    return sorted.slice(0, 10);
  }

  private getRedFlags(condition: string): string[] {
    const redFlagMap: Record<string, string[]> = {
      'Acute Coronary Syndrome': ['Hypotension', 'Cardiogenic shock', 'Arrhythmia'],
      'Pulmonary Embolism': ['Hypoxia <90%', 'Hemodynamic instability', 'RV dysfunction on Echo'],
      'Sepsis': ['Lactate >4', 'Altered mental status', 'MAP <65'],
      'Stroke': ['Onset >4.5h', 'Intracranial hemorrhage', 'Seizure'],
    };

    return redFlagMap[condition] || ['Monitor closely'];
  }

  private getNextSteps(condition: string): string[] {
    const stepsMap: Record<string, string[]> = {
      'Acute Coronary Syndrome': [
        'EKG within 10 min',
        'Troponin (serial at 0, 3, 6h)',
        'Cardiology consult',
        'Consider cath lab activation',
      ],
      'Pulmonary Embolism': [
        'D-dimer if low clinical suspicion',
        'CT angiography',
        'Anticoagulation (if not contraindicated)',
        'Vascular surgery consult if massive PE',
      ],
      'Pneumonia': [
        'Chest X-ray',
        'Sputum culture',
        'Start empiric antibiotics',
        'Respiratory support if needed',
      ],
    };

    return stepsMap[condition] || ['Further evaluation needed', 'Specialist consultation'];
  }
}

// ─── RISK STRATIFIER ────────────────────────────────────────────────────────

export class RiskStratifier {
  calculateFraminghamRisk(
    age: number,
    isMale: boolean,
    ldl: number,
    hdl: number,
    sbp: number,
    smoker: boolean,
    diabetic: boolean
  ): RiskScore {
    const points = this.framinghamPoints(age, isMale, ldl, hdl, sbp, smoker, diabetic);
    const riskPercent = this.framinghamRiskPercent(points, isMale);

    return {
      scoreName: 'Framingham 10-Year Cardiac Risk',
      score: Math.round(riskPercent),
      riskCategory: this.categorizeRisk(riskPercent, 'framingham'),
      riskPercentage: riskPercent,
      interpretation: this.interpretFraminghamRisk(riskPercent),
      components: new Map([
        ['Age', age],
        ['Total Cholesterol', ldl],
        ['HDL', hdl],
        ['SBP', sbp],
        ['Smoking', smoker ? 1 : 0],
        ['Diabetes', diabetic ? 1 : 0],
      ]),
    };
  }

  calculateASCVDRisk(
    age: number,
    isMale: boolean,
    race: 'white' | 'black' | 'other',
    tc: number,
    ldl: number,
    hdl: number,
    sbp: number,
    treated: boolean,
    smoker: boolean,
    diabetic: boolean
  ): RiskScore {
    const risk = this.ascvdCalculation(age, isMale, race, tc, ldl, hdl, sbp, treated, smoker, diabetic);

    return {
      scoreName: 'ASCVD 10-Year Risk',
      score: Math.round(risk),
      riskCategory: this.categorizeRisk(risk, 'ascvd'),
      riskPercentage: risk,
      interpretation: this.interpretASCVDRisk(risk),
      components: new Map([
        ['Age', age],
        ['Total Cholesterol', tc],
        ['LDL', ldl],
        ['HDL', hdl],
        ['SBP', sbp],
      ]),
    };
  }

  calculateWellsPEScore(
    clinicalSuspicion: number,
    hr: number,
    respiratoryRate: number,
    o2Sat: number,
    dvtSigns: boolean,
    heartFailure: boolean,
    hvitPattern: boolean
  ): RiskScore {
    let score = clinicalSuspicion * 3;

    if (hr > 100) score += 1.5;
    if (respiratoryRate > 20) score += 1.5;
    if (o2Sat < 95) score += 4;
    if (dvtSigns) score += 3;
    if (heartFailure) score += 1.5;
    if (hvitPattern) score += 3.5;

    const risk = this.wellsToRiskPercent(score);

    return {
      scoreName: "Wells PE Prediction Rule",
      score: Math.round(score * 2) / 2,
      riskCategory: this.categorizeRisk(risk, 'wells'),
      riskPercentage: risk,
      interpretation: `PE probability: ${risk.toFixed(1)}%`,
      components: new Map([
        ['Suspicion', clinicalSuspicion],
        ['Tachycardia', hr > 100 ? 1 : 0],
        ['Hypoxia', o2Sat < 95 ? 1 : 0],
        ['DVT Signs', dvtSigns ? 1 : 0],
      ]),
    };
  }

  calculateCHADS2VASc(
    age: number,
    chf: boolean,
    hypertension: boolean,
    stroke: boolean,
    vte: boolean,
    bleeding: number,
    isMale: boolean,
    vascular: boolean
  ): RiskScore {
    let score = 0;

    if (chf) score++;
    if (hypertension) score++;
    if (stroke) score += 2;
    if (vascular) score++;
    if (age >= 75) score += 2;
    else if (age >= 65) score++;

    if (!isMale) score++;

    return {
      scoreName: 'CHADS2-VASc Stroke Risk (AFib)',
      score,
      riskCategory: this.categorizeRisk(score, 'chads2'),
      riskPercentage: undefined,
      interpretation: this.interpretCHADS2VASc(score),
      components: new Map([
        ['CHF', chf ? 1 : 0],
        ['Hypertension', hypertension ? 1 : 0],
        ['Age ≥75', age >= 75 ? 2 : 0],
        ['Age 65-74', age >= 65 && age < 75 ? 1 : 0],
        ['Stroke/TIA/Thromboembolism', stroke ? 2 : 0],
        ['Vascular Disease', vascular ? 1 : 0],
        ['Female', !isMale ? 1 : 0],
      ]),
    };
  }

  private framinghamPoints(
    age: number,
    isMale: boolean,
    ldl: number,
    hdl: number,
    sbp: number,
    smoker: boolean,
    diabetic: boolean
  ): number {
    let points = 0;

    if (isMale) {
      if (age < 35) points -= 9;
      else if (age < 40) points -= 4;
      else if (age < 50) points += 0;
      else if (age < 60) points += 9;
      else points += 11;

      if (ldl < 100) points -= 3;
      else if (ldl < 130) points += 0;
      else if (ldl < 160) points += 1;
      else points += 2;

      if (hdl < 40) points += 2;
      else if (hdl < 50) points += 1;
      else points += 0;
    } else {
      if (age < 35) points -= 7;
      else if (age < 45) points += 0;
      else if (age < 55) points += 3;
      else points += 8;
    }

    if (sbp < 120) points += 0;
    else if (sbp < 140) points += 1;
    else points += 2;

    if (smoker) points += 4;
    if (diabetic) points += 3;

    return points;
  }

  private framinghamRiskPercent(points: number, isMale: boolean): number {
    if (isMale) {
      if (points <= -3) return 1;
      if (points <= 9) return 4;
      if (points <= 12) return 7;
      if (points <= 15) return 11;
      if (points >= 17) return 30;
      return 4 + (points + 3) * 2;
    } else {
      if (points <= -3) return 1;
      if (points <= 9) return 3;
      if (points <= 12) return 5;
      if (points <= 14) return 8;
      if (points >= 16) return 20;
      return 3 + (points + 3);
    }
  }

  private ascvdCalculation(
    age: number,
    isMale: boolean,
    race: string,
    tc: number,
    ldl: number,
    hdl: number,
    sbp: number,
    treated: boolean,
    smoker: boolean,
    diabetic: boolean
  ): number {
    return 3.6 +
      (age * 0.08) +
      (tc * 0.02) -
      (hdl * 0.03) +
      (sbp * 0.01) +
      (smoker ? 0.5 : 0) +
      (diabetic ? 0.5 : 0);
  }

  private wellsToRiskPercent(score: number): number {
    if (score < 2) return 1.6;
    if (score < 6) return 16.2;
    if (score < 11) return 37.5;
    return 66.1;
  }

  private categorizeRisk(
    value: number,
    scoreType: string
  ): 'low' | 'intermediate' | 'high' | 'very_high' {
    if (scoreType === 'framingham') {
      if (value < 10) return 'low';
      if (value < 20) return 'intermediate';
      return 'high';
    }
    if (scoreType === 'ascvd') {
      if (value < 5) return 'low';
      if (value < 7.5) return 'intermediate';
      return 'high';
    }
    if (scoreType === 'wells') {
      if (value < 2) return 'low';
      if (value < 6) return 'intermediate';
      if (value < 11) return 'high';
      return 'very_high';
    }
    if (scoreType === 'chads2') {
      if (value === 0) return 'low';
      if (value === 1) return 'intermediate';
      if (value <= 3) return 'high';
      return 'very_high';
    }
    return 'intermediate';
  }

  private interpretFraminghamRisk(risk: number): string {
    if (risk < 10) return 'Low risk: Continue current preventive measures';
    if (risk < 20) return 'Intermediate risk: Consider statin therapy';
    return 'High risk: Aggressive risk factor modification and consider intensive therapy';
  }

  private interpretASCVDRisk(risk: number): string {
    if (risk < 5) return 'Low 10-year ASCVD risk';
    if (risk < 7.5) return 'Intermediate 10-year ASCVD risk: Consider statin';
    return 'High 10-year ASCVD risk: Recommend statin therapy';
  }

  private interpretCHADS2VASc(score: number): string {
    if (score === 0) return 'Low stroke risk: No anticoagulation needed';
    if (score === 1) return 'Low-intermediate risk: Consider anticoagulation';
    if (score <= 3) return 'High risk: Anticoagulation recommended';
    return 'Very high risk: Anticoagulation strongly recommended';
  }
}

// ─── FACTORY EXPORTS ────────────────────────────────────────────────────────

export function createClinicalDecisionSupport() {
  const drugChecker = new DrugInteractionChecker();
  const allergyEngine = new AllergyAlertEngine();
  const ruleEngine = new ClinicalRuleEngine();
  const labInterpreter = new LabResultInterpreter();
  const diagnosisSuggester = new DiagnosisSuggester();
  const riskStratifier = new RiskStratifier();

  return {
    drugChecker,
    allergyEngine,
    ruleEngine,
    labInterpreter,
    diagnosisSuggester,
    riskStratifier,

    checkDrugSafety(medications: string[]): DrugInteraction[] {
      const interactions: DrugInteraction[] = [];
      for (let i = 0; i < medications.length; i++) {
        for (let j = i + 1; j < medications.length; j++) {
          const interaction = drugChecker.checkInteraction(medications[i], medications[j]);
          if (interaction) interactions.push(interaction);
        }
      }
      return interactions;
    },

    checkAllergyConflicts(allergies: string[], proposedMeds: string[]): AllergyAlert[] {
      const alerts: AllergyAlert[] = [];
      allergies.forEach((allergy) => {
        proposedMeds.forEach((med) => {
          const alert = allergyEngine.checkAllergyAlert(allergy, med);
          if (alert) alerts.push(alert);
        });
      });
      return alerts;
    },
  };
}
