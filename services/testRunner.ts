
import { PatientProfile, VaccineDose, VaxStatus } from '../types';
import { evaluateSeries } from './logicService';
import { DEFAULT_IMMUNIZATION_RULES } from '../config/immunizationRules';
import { addDays, addMonths, addWeeks } from 'date-fns';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  patient: PatientProfile;
  history: VaccineDose[];
  targetSeries: string;
  expectedStatus: VaxStatus | 'ANY'; // 'ANY' allows mostly checking dose counts
  expectedDoseCount: number;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  actualStatus: VaxStatus;
  actualDoseCount: number;
  reason: string;
  testCase: TestCase;
}

// --- MOCK DATA HELPERS ---
const MOCK_DOB = new Date('2023-01-01'); // Fixed DOB for consistency
const createPatient = (dob: Date = MOCK_DOB): PatientProfile => ({
  id: 'TEST-PATIENT',
  name: 'Test Subject',
  dob: dob,
  sex: 'F',
  conditions: [],
  medications: []
});

// Helper for relative dates from today
const todayMinus = (months: number) => addMonths(new Date(), -months);

// --- TEST SUITE ---
export const TEST_SUITE: TestCase[] = [
  // 1. GRACE PERIOD TESTS (DTaP Dose 1 Min Age: 6 weeks = 42 days)
  {
    id: 'GRACE-01',
    name: 'Grace Period - Valid (4 days early)',
    description: 'DTaP Dose 1 given at 38 days (42d min - 4d grace). Should be VALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'DTaP', dateAdministered: addDays(MOCK_DOB, 38), valid: true }
    ],
    targetSeries: 'DTaP',
    expectedStatus: 'ANY', 
    expectedDoseCount: 1 // If valid, count is 1
  },
  {
    id: 'GRACE-02',
    name: 'Grace Period - Invalid (5 days early)',
    description: 'DTaP Dose 1 given at 37 days (42d min - 5d grace). Should be INVALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'DTaP', dateAdministered: addDays(MOCK_DOB, 37), valid: true }
    ],
    targetSeries: 'DTaP',
    expectedStatus: 'ANY',
    expectedDoseCount: 0 // If invalid, count remains 0
  },

  // 2. LIVE VIRUS INTERFERENCE (MMR & Varicella)
  {
    id: 'LIVE-01',
    name: 'Live Virus - Conflict (<28 days)',
    description: 'Varicella given 14 days after MMR. Should be INVALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'MMR', dateAdministered: addMonths(MOCK_DOB, 12), valid: true },
      // Varicella 2 weeks later
      { id: '2', vaccineCode: 'Varicella', dateAdministered: addDays(addMonths(MOCK_DOB, 12), 14), valid: true }
    ],
    targetSeries: 'Varicella',
    expectedStatus: 'ANY',
    expectedDoseCount: 0 // Dose 1 (Varicella) is invalid due to conflict
  },
  {
    id: 'LIVE-02',
    name: 'Live Virus - Simultaneous',
    description: 'Varicella given on SAME DAY as MMR. Should be VALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'MMR', dateAdministered: addMonths(MOCK_DOB, 12), valid: true },
      { id: '2', vaccineCode: 'Varicella', dateAdministered: addMonths(MOCK_DOB, 12), valid: true }
    ],
    targetSeries: 'Varicella',
    expectedStatus: 'ANY',
    expectedDoseCount: 1
  },
  {
    id: 'LIVE-03',
    name: 'Live Virus - Safe Interval (>28 days)',
    description: 'Varicella given 30 days after MMR. Should be VALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'MMR', dateAdministered: addMonths(MOCK_DOB, 12), valid: true },
      { id: '2', vaccineCode: 'Varicella', dateAdministered: addDays(addMonths(MOCK_DOB, 12), 30), valid: true }
    ],
    targetSeries: 'Varicella',
    expectedStatus: 'ANY',
    expectedDoseCount: 1
  },

  // 3. INTERVAL CHECKS (HepB Dose 2 Min Interval: 4 weeks from Dose 1)
  {
    id: 'INT-01',
    name: 'Interval - Too Soon',
    description: 'HepB Dose 2 given 2 weeks after Dose 1. Should be INVALID.',
    patient: createPatient(),
    history: [
      { id: '1', vaccineCode: 'HepB', dateAdministered: MOCK_DOB, valid: true },
      { id: '2', vaccineCode: 'HepB', dateAdministered: addDays(MOCK_DOB, 14), valid: true }
    ],
    targetSeries: 'HepB',
    expectedStatus: 'ANY',
    expectedDoseCount: 1 // Only Dose 1 counts
  },
  {
      id: 'INT-02',
      name: 'Interval - Dose 3 vs Dose 1',
      description: 'HepB Dose 3 given 10 weeks after D1 (Min 16w). Interval vs D2 OK (8w). Should be INVALID.',
      patient: createPatient(),
      history: [
        { id: '1', vaccineCode: 'HepB', dateAdministered: MOCK_DOB, valid: true },
        // Dose 2 at 4 weeks (OK)
        { id: '2', vaccineCode: 'HepB', dateAdministered: addWeeks(MOCK_DOB, 4), valid: true },
        // Dose 3 at 14 weeks (14w from D1. Rule is 16w). 
        // Note: 14w is 10w after Dose 2 (Rule is 8w). So it passes D2 interval but fails D1 interval.
        { id: '3', vaccineCode: 'HepB', dateAdministered: addWeeks(MOCK_DOB, 14), valid: true },
      ],
      targetSeries: 'HepB',
      expectedStatus: 'ANY',
      expectedDoseCount: 2 // Dose 3 should be invalid
  },
  
  // 4. MAX AGE (Rotavirus D1 Max Age: 15 weeks 0 days)
  {
      id: 'MAX-01',
      name: 'Max Age - Exceeded',
      description: 'Rotavirus Dose 1 given at 16 weeks. Should be INVALID/CONTRAINDICATED.',
      patient: createPatient(),
      history: [
          { id: '1', vaccineCode: 'Rotavirus', dateAdministered: addDays(MOCK_DOB, 16 * 7), valid: true }
      ],
      targetSeries: 'Rotavirus',
      expectedStatus: VaxStatus.CONTRAINDICATED, // Logic engine marks series as contraindicated if started too late
      expectedDoseCount: 0 
  },
  {
      id: 'MAX-02',
      name: 'Max Age - Boundary Valid',
      description: 'Rotavirus Dose 1 given at 14 weeks 6 days (Day 104). Should be VALID.',
      patient: createPatient(),
      history: [
          // 15 weeks * 7 = 105 days. 
          // 14 weeks * 7 + 6 days = 104 days.
          { id: '1', vaccineCode: 'Rotavirus', dateAdministered: addDays(MOCK_DOB, 104), valid: true }
      ],
      targetSeries: 'Rotavirus',
      expectedStatus: 'ANY', 
      expectedDoseCount: 1 
  },
  {
      id: 'MAX-03',
      name: 'Max Age - Boundary Invalid',
      description: 'Rotavirus Dose 1 given at 15 weeks 0 days (Day 105). Should be INVALID.',
      patient: createPatient(),
      history: [
          // Exact boundary check. Logic is >= MaxAge => Invalid.
          { id: '1', vaccineCode: 'Rotavirus', dateAdministered: addDays(MOCK_DOB, 105), valid: true }
      ],
      targetSeries: 'Rotavirus',
      expectedStatus: VaxStatus.CONTRAINDICATED,
      expectedDoseCount: 0
  },

  // 5. RECURRING DOSE (Influenza Annual)
  {
      id: 'RECUR-01',
      name: 'Recurring - Annual Flu',
      description: 'Patient received 2 doses (primaryseries). Next dose should be generated by recurring rule.',
      // Patient 2 years old
      patient: createPatient(todayMinus(24)), 
      history: [
          // Dose 1 at 6m
          { id: '1', vaccineCode: 'Influenza', dateAdministered: todayMinus(18), valid: true },
          // Dose 2 at 7m (1 month later) - Primary Series Complete
          { id: '2', vaccineCode: 'Influenza', dateAdministered: todayMinus(17), valid: true }
      ],
      targetSeries: 'Influenza',
      expectedStatus: VaxStatus.OVERDUE, // 17 months ago was last dose. Interval 44 weeks. Definitely overdue.
      expectedDoseCount: 2
  },

  // 6. ADOLESCENT BOUNDARIES (HPV)
  {
      id: 'ADO-01',
      name: 'HPV - Too Young (8y)',
      description: 'HPV given at 8 years old (96m). Min age 9y (108m). Should be INVALID.',
      patient: createPatient(todayMinus(96)), // Exactly 8 years old
      history: [
           // Given recently (at 8y)
          { id: '1', vaccineCode: 'HPV', dateAdministered: todayMinus(0), valid: true }
      ],
      targetSeries: 'HPV',
      expectedStatus: 'ANY', 
      expectedDoseCount: 0 // Dose 1 invalid
  },
  {
      id: 'ADO-02',
      name: 'HPV - Eligible (11y)',
      description: 'HPV given at 11 years 1 day. Should be VALID.',
      patient: createPatient(todayMinus(140)), // ~11.6 years old
      history: [
          // Given at 11y (6 months ago)
          { id: '1', vaccineCode: 'HPV', dateAdministered: todayMinus(6), valid: true }
      ],
      targetSeries: 'HPV',
      expectedStatus: 'ANY',
      expectedDoseCount: 1
  },

  // 7. COMPLEX LIVE VIRUS INTERACTION
  {
      id: 'LIVE-CX-01',
      name: 'Live Virus - Daisy Chain',
      description: 'MMR(0d) -> Var(14d) -> FluMist(30d). Var conflicts w/ MMR. FluMist OK w/ MMR (>28d) but conflicts w/ INVALID Var (16d).',
      // Logic: Even if a live virus dose is invalid, it is still a biological administration 
      // that requires a 28-day spacing for subsequent live vaccines.
      patient: createPatient(MOCK_DOB),
      history: [
          { id: '1', vaccineCode: 'MMR', dateAdministered: addMonths(MOCK_DOB, 12), valid: true },
          // Invalid (too close to MMR)
          { id: '2', vaccineCode: 'Varicella', dateAdministered: addDays(addMonths(MOCK_DOB, 12), 14), valid: true },
          // Invalid (too close to Varicella)
          { id: '3', vaccineCode: 'FluMist', dateAdministered: addDays(addMonths(MOCK_DOB, 12), 30), valid: true }
      ],
      targetSeries: 'FluMist',
      expectedStatus: 'ANY',
      expectedDoseCount: 0 // Should be 0 valid doses for FluMist series
  }
];

export const runAllTests = (): TestResult[] => {
  return TEST_SUITE.map(test => {
    // Inject DEFAULT_IMMUNIZATION_RULES for unit tests
    const result = evaluateSeries(test.patient, test.history, test.targetSeries, DEFAULT_IMMUNIZATION_RULES);
    
    const countMatch = result.dosesAdministered === test.expectedDoseCount;
    const statusMatch = test.expectedStatus === 'ANY' ? true : result.status === test.expectedStatus;
    
    return {
      testId: test.id,
      passed: countMatch && statusMatch,
      actualStatus: result.status,
      actualDoseCount: result.dosesAdministered,
      reason: result.reason || 'No reason provided',
      testCase: test
    };
  });
};