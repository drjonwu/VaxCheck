export type Sex = 'M' | 'F';

export interface PatientProfile {
  id: string; // Internal ID, not MRN
  name?: string; // Optional for display convenience in lists
  dob: Date;
  sex: Sex;
  conditions: string[]; // e.g., 'Asplenia', 'Immunocompromised'
  medications: string[]; // e.g., 'Warfarin'
  notes?: string; // Clinician notes
}

// Minimal record for logic engine
export interface VaccineDose {
  id: string;
  vaccineCode: string; // CVX code or similar short code
  dateAdministered: Date;
  valid: boolean; // Computed by logic engine
}

export interface PatientRecord {
  profile: PatientProfile;
  history: VaccineDose[];
}

export enum VaxStatus {
  COMPLETE = 'COMPLETE',
  UP_TO_DATE = 'UP_TO_DATE',
  DUE_NOW = 'DUE_NOW',
  OVERDUE = 'OVERDUE',
  FUTURE = 'FUTURE',
  CONTRAINDICATED = 'CONTRAINDICATED',
}

export interface VaccineSeriesStatus {
  seriesName: string; // e.g., "HepB", "MMR"
  status: VaxStatus;
  dosesAdministered: number;
  nextDoseDue?: Date;
  reason?: string; // Short logic reason
  aiExplanation?: string; // Streamed explanation
  ruleApplied?: VaccineRule; // The specific rule triggering the current status
}

export interface ForecastDose {
  seriesName: string;
  doseNumber: number;
  dueDate: Date;
  status: VaxStatus;
}

export interface ScheduledVisit {
  visitDate: Date;
  doses: ForecastDose[];
}

export interface VaccineRule {
  seriesName: string;
  doseNumber: number;
  minAgeMonths?: number; // Whole Calendar Months (e.g., 6 months)
  minAgeWeeks?: number;  // Precise Weeks (e.g., 6 weeks = 42 days). Takes precedence if defined.
  maxAgeMonths?: number; // For "Not Indicated" logic (e.g. Rotavirus)
  maxAgeWeeks?: number;  // Precise Weeks for max age (e.g. Rotavirus)
  minIntervalWeeks?: number; // From previous dose
  minIntervalWeeksFromDose1?: number; // From Dose 1 (e.g. HepB Dose 3)
  isRecurring?: boolean; // CDSi v4.6: Allows any target dose to act as a recurring anchor
}

export type ImmunizationRulesMap = Record<string, VaccineRule[]>;

export interface ClinicalAbstract {
  ageMonths: number;
  sex: Sex;
  conditions: string[];
  medications: string[];
  vaccineHistory: { code: string; ageAtDoseMonths: number }[];
}

export type AppView = 'dashboard' | 'patient-list' | 'patient' | 'rules' | 'settings' | 'tests';

export interface PopulationStats {
    overdue: number;
    dueNow: number;
    complete: number;
    total: number;
}
