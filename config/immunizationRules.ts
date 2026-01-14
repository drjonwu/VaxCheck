import { VaccineRule, ImmunizationRulesMap } from '../types';

// --- CDSi / ACIP / ICE SPECIFICATION RULES (v4.6 Snapshot) ---
// Extracted from logicService to allow for independent updates

const HEPB_RULES: VaccineRule[] = [
  // ACIP: Recommended for all infants, and adults 19-59 years.
  // Logic Engine does not have max age here, so it applies generally.
  { seriesName: 'HepB', doseNumber: 1, minAgeMonths: 0 },
  { seriesName: 'HepB', doseNumber: 2, minAgeMonths: 1, minIntervalWeeks: 4 },
  // Dose 3: Min Age 24 weeks, Min Int 8w from D2, Min Int 16w from D1 (ICE/ACIP Standard)
  { seriesName: 'HepB', doseNumber: 3, minAgeWeeks: 24, minIntervalWeeks: 8, minIntervalWeeksFromDose1: 16 },
];

const ROTAVIRUS_RULES: VaccineRule[] = [
  // Rotavirus has strict max ages. 
  // Max Age for Dose 1: Do not start on or after 15 weeks 0 days. (15 weeks * 7 = 105 days)
  // Max Age for Final Dose: 8 months 0 days.
  { seriesName: 'Rotavirus', doseNumber: 1, minAgeWeeks: 6, maxAgeWeeks: 15 }, 
  { seriesName: 'Rotavirus', doseNumber: 2, minAgeWeeks: 10, minIntervalWeeks: 4 }, 
  { seriesName: 'Rotavirus', doseNumber: 3, minAgeWeeks: 14, maxAgeMonths: 8, minIntervalWeeks: 4 }, 
];

const DTAP_RULES: VaccineRule[] = [
  // DTaP is for children < 7 years (max age 84 months).
  { seriesName: 'DTaP', doseNumber: 1, minAgeWeeks: 6, maxAgeMonths: 84 }, 
  { seriesName: 'DTaP', doseNumber: 2, minAgeWeeks: 10, minIntervalWeeks: 4, maxAgeMonths: 84 },
  { seriesName: 'DTaP', doseNumber: 3, minAgeWeeks: 14, minIntervalWeeks: 4, maxAgeMonths: 84 },
  { seriesName: 'DTaP', doseNumber: 4, minAgeMonths: 15, minIntervalWeeks: 26, maxAgeMonths: 84 }, // 6 months from dose 3
  { seriesName: 'DTaP', doseNumber: 5, minAgeMonths: 48, minIntervalWeeks: 26, maxAgeMonths: 84 }, // 4 years
];

const HIB_RULES: VaccineRule[] = [
  // Healthy children >= 60 months (5 years) generally do not need Hib.
  // Late start > 15 months usually only requires 1 dose.
  { seriesName: 'Hib', doseNumber: 1, minAgeWeeks: 6, maxAgeMonths: 59 },
  { seriesName: 'Hib', doseNumber: 2, minAgeWeeks: 10, maxAgeMonths: 15, minIntervalWeeks: 4 },
  { seriesName: 'Hib', doseNumber: 3, minAgeWeeks: 14, maxAgeMonths: 15, minIntervalWeeks: 4 },
  { seriesName: 'Hib', doseNumber: 4, minAgeMonths: 12, maxAgeMonths: 59, minIntervalWeeks: 8 },
];

const PCV_RULES: VaccineRule[] = [
  // Pediatric Pneumococcal
  // Healthy children >= 60 months (5 years) generally do not need PCV.
  // Late start > 24 months usually only requires 1 dose.
  { seriesName: 'PCV', doseNumber: 1, minAgeWeeks: 6, maxAgeMonths: 59 },
  { seriesName: 'PCV', doseNumber: 2, minAgeWeeks: 10, maxAgeMonths: 24, minIntervalWeeks: 4 },
  { seriesName: 'PCV', doseNumber: 3, minAgeWeeks: 14, maxAgeMonths: 24, minIntervalWeeks: 4 },
  { seriesName: 'PCV', doseNumber: 4, minAgeMonths: 12, maxAgeMonths: 59, minIntervalWeeks: 8 },
];

const IPV_RULES: VaccineRule[] = [
  { seriesName: 'IPV', doseNumber: 1, minAgeWeeks: 6 },
  { seriesName: 'IPV', doseNumber: 2, minAgeWeeks: 10, minIntervalWeeks: 4 },
  // Dose 3 recommended 6-18 months. Absolute min 14 weeks. 
  // For "Default Schedule", we use 24 weeks (6m) to guide routine care.
  { seriesName: 'IPV', doseNumber: 3, minAgeWeeks: 24, minIntervalWeeks: 4 }, 
  { seriesName: 'IPV', doseNumber: 4, minAgeMonths: 48, minIntervalWeeks: 26 },
];

const MMR_RULES: VaccineRule[] = [
  { seriesName: 'MMR', doseNumber: 1, minAgeMonths: 12 },
  { seriesName: 'MMR', doseNumber: 2, minAgeMonths: 48, minIntervalWeeks: 4 },
];

const VARICELLA_RULES: VaccineRule[] = [
  { seriesName: 'Varicella', doseNumber: 1, minAgeMonths: 12 },
  { seriesName: 'Varicella', doseNumber: 2, minAgeMonths: 48, minIntervalWeeks: 12 }, // 3 months for children < 13y
];

const HEPA_RULES: VaccineRule[] = [
  { seriesName: 'HepA', doseNumber: 1, minAgeMonths: 12 },
  { seriesName: 'HepA', doseNumber: 2, minAgeMonths: 18, minIntervalWeeks: 26 }, // 6 months after dose 1
];

// --- ADOLESCENT SERIES ---

const MENACWY_RULES: VaccineRule[] = [
    { seriesName: 'MenACWY', doseNumber: 1, minAgeMonths: 132 }, // 11 years
    { seriesName: 'MenACWY', doseNumber: 2, minAgeMonths: 192, minIntervalWeeks: 8 } // 16 years
];

const TDAP_RULES: VaccineRule[] = [
    // Adolescent primary dose
    { seriesName: 'Tdap', doseNumber: 1, minAgeMonths: 132 } // 11 years
];

const HPV_RULES: VaccineRule[] = [
    { seriesName: 'HPV', doseNumber: 1, minAgeMonths: 108 }, // Routine at 11-12y, can start at 9y (108m)
    // ICE/ACIP: Min interval between D1 and D2 is 5 months (20 weeks) for the 2-dose series (<15y)
    { seriesName: 'HPV', doseNumber: 2, minAgeMonths: 114, minIntervalWeeks: 20 },
    // Dose 3 needed if started > 15y, logic engine handles sequential validity.
    // If started early, D2 is final. If started late, D3 might be needed (logic simplification for demo)
    { seriesName: 'HPV', doseNumber: 3, minAgeMonths: 118, minIntervalWeeks: 12 }
];

// --- ADULT SERIES (NEW) ---

const ZOSTER_RULES: VaccineRule[] = [
    // Shingrix (Recombinant Zoster Vaccine)
    // Recommended for adults 50 years and older.
    { seriesName: 'Zoster', doseNumber: 1, minAgeMonths: 600 }, // 50 years
    { seriesName: 'Zoster', doseNumber: 2, minAgeMonths: 600, minIntervalWeeks: 8 } // 2-6 months apart
];

const PNEUMO_ADULT_RULES: VaccineRule[] = [
    // Simplified ACIP: PCV20 for adults 65+ (or 19-64 with risk).
    // This logic assumes healthy 65+ path.
    { seriesName: 'PneumoAdult', doseNumber: 1, minAgeMonths: 780 } // 65 years
];

const TD_BOOSTER_RULES: VaccineRule[] = [
    // Td or Tdap booster every 10 years for adults.
    // Starts counting from age 19 (228 months)
    { 
        seriesName: 'Td/Tdap', 
        doseNumber: 1, 
        minAgeMonths: 228, 
        isRecurring: true, 
        minIntervalWeeks: 520 // 10 years * 52 weeks
    }
];

// --- NEW V4.6 SCOPE RULES ---

const COVID19_RULES: VaccineRule[] = [
  // Primary series: Dose 1 and 2
  { seriesName: 'COVID-19', doseNumber: 1, minAgeMonths: 6 },
  { seriesName: 'COVID-19', doseNumber: 2, minAgeMonths: 8, minIntervalWeeks: 8 }, 
  // Recurring / Booster logic (Simplified): Every 6 months (26 weeks)
  { seriesName: 'COVID-19', doseNumber: 3, minAgeMonths: 14, isRecurring: true, minIntervalWeeks: 26 }
];

const INFLUENZA_RULES: VaccineRule[] = [
  // Primary series for naive children: Dose 1 and 2 separated by 4 weeks
  { seriesName: 'Influenza', doseNumber: 1, minAgeMonths: 6 }, 
  { seriesName: 'Influenza', doseNumber: 2, minAgeMonths: 7, minIntervalWeeks: 4 }, 
  // Annual logic: Dose 3+ recommended at least 10 months (44 weeks) after previous dose to align with next season
  { seriesName: 'Influenza', doseNumber: 3, isRecurring: true, minIntervalWeeks: 44 }
];

const FLUMIST_RULES: VaccineRule[] = [
  // FluMist (LAIV) - Specific rules for Live Virus Conflict checking.
  // Generally fits into Influenza logic, but defined here to ensure the engine tracks the series name.
  // LAIV minimum age is 2 years.
  { seriesName: 'FluMist', doseNumber: 1, minAgeMonths: 24 },
  { seriesName: 'FluMist', doseNumber: 2, minAgeMonths: 25, minIntervalWeeks: 4 }
];

const RSV_RULES: VaccineRule[] = [
  // Maternal (32-36w gestation) or Infant (Monoclonal). 
  // Simplified for Infant path: Nirsevimab
  { seriesName: 'RSV', doseNumber: 1, minAgeMonths: 0, maxAgeMonths: 8 },
  // Senior RSV (Arexvy/Abrysvo) - Age 60+
  { seriesName: 'RSV-Adult', doseNumber: 1, minAgeMonths: 720 } // 60 years
];

// Combined Ruleset Export
export const DEFAULT_IMMUNIZATION_RULES: ImmunizationRulesMap = {
  HepB: HEPB_RULES,
  Rotavirus: ROTAVIRUS_RULES,
  DTaP: DTAP_RULES,
  Hib: HIB_RULES,
  PCV: PCV_RULES,
  IPV: IPV_RULES,
  MMR: MMR_RULES,
  Varicella: VARICELLA_RULES,
  HepA: HEPA_RULES,
  MenACWY: MENACWY_RULES,
  Tdap: TDAP_RULES,
  HPV: HPV_RULES,
  // Adult Specific
  Zoster: ZOSTER_RULES,
  PneumoAdult: PNEUMO_ADULT_RULES,
  'Td/Tdap': TD_BOOSTER_RULES,
  // Pan-Respiratory
  'COVID-19': COVID19_RULES,
  Influenza: INFLUENZA_RULES,
  FluMist: FLUMIST_RULES, 
  RSV: RSV_RULES,
};