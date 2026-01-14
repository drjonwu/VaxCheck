import { create } from 'zustand';
import { PatientRecord, ImmunizationRulesMap, VaccineSeriesStatus, ForecastDose, ScheduledVisit, VaccineDose, AppView, PopulationStats } from '../types';
import { DEFAULT_IMMUNIZATION_RULES } from '../config/immunizationRules';

// --- DATE HELPERS ---
const NOW = new Date();
const addM = (d: Date, m: number) => new Date(new Date(d).setMonth(d.getMonth() + m));
const addY = (d: Date, y: number) => new Date(new Date(d).setFullYear(d.getFullYear() + y));

// --- MOCK DOBs ---
const BABY_DOB = new Date(NOW.getFullYear() - 1, NOW.getMonth() - 2, 15); // ~14 months old
const CHILD_DOB = new Date(NOW.getFullYear() - 5, NOW.getMonth(), 15); // 5 years old
const TEEN_DOB = new Date(NOW.getFullYear() - 13, NOW.getMonth() - 1, 10); // 13 years old
const COLLEGE_DOB = new Date(NOW.getFullYear() - 19, NOW.getMonth() - 3, 5); // 19 years old
const PREGNANT_DOB = new Date(NOW.getFullYear() - 28, NOW.getMonth() - 6, 22); // 28 years old
const ADULT_DOB = new Date(NOW.getFullYear() - 52, NOW.getMonth(), 5); // 52 years old
const SENIOR_DOB = new Date(NOW.getFullYear() - 66, NOW.getMonth() - 4, 20); // 66 years old

// --- HISTORY GENERATOR ---
// Generates a standard compliant history for a healthy child up to a certain age.
// Used to backfill older patients so they aren't flagged as overdue for infant shots.
const generateStandardHistory = (dob: Date, ageYears: number, excludeSeries: string[] = []): VaccineDose[] => {
    let doses: VaccineDose[] = [];
    let idCounter = 1000;
    const add = (code: string, date: Date) => {
        if (excludeSeries.includes(code)) return;
        doses.push({ id: `hist-${idCounter++}`, vaccineCode: code, dateAdministered: date, valid: true });
    };

    // Birth
    add('HepB', dob);

    // 2 Months
    if (ageYears * 12 >= 2) {
        const d2m = addM(dob, 2);
        add('HepB', d2m);
        add('Rotavirus', d2m);
        add('DTaP', d2m);
        add('Hib', d2m);
        add('PCV', d2m);
        add('IPV', d2m);
    }

    // 4 Months
    if (ageYears * 12 >= 4) {
        const d4m = addM(dob, 4);
        add('Rotavirus', d4m);
        add('DTaP', d4m);
        add('Hib', d4m);
        add('PCV', d4m);
        add('IPV', d4m);
    }

    // 6 Months
    if (ageYears * 12 >= 6) {
        const d6m = addM(dob, 6);
        add('HepB', d6m);
        add('Rotavirus', d6m); // Rota-3
        add('DTaP', d6m);
        add('Hib', d6m);
        add('PCV', d6m);
        add('IPV', d6m); // IPV-3 often given here or later
        add('Influenza', d6m); // Primary 1
        add('Influenza', addM(d6m, 1)); // Primary 2
    }

    // 12-15 Months
    if (ageYears * 12 >= 15) {
        const d12m = addM(dob, 12);
        const d15m = addM(dob, 15);
        add('Hib', d12m); // Booster
        add('PCV', d12m); // Booster
        add('MMR', d12m);
        add('Varicella', d12m);
        add('HepA', d12m);
        add('DTaP', d15m); // Dose 4
    }

    // 18 Months
    if (ageYears * 12 >= 18) {
        const d18m = addM(dob, 18);
        add('HepA', d18m); // Dose 2
    }

    // 4-6 Years (Kindergarten)
    if (ageYears >= 5) {
        const d4y = addY(dob, 4);
        add('DTaP', d4y); // Dose 5
        add('IPV', d4y); // Dose 4
        add('MMR', d4y); // Dose 2
        add('Varicella', d4y); // Dose 2
    }

    // 11-12 Years (Adolescent)
    if (ageYears >= 11) {
        const d11y = addY(dob, 11);
        add('Tdap', d11y);
        add('MenACWY', d11y);
        add('HPV', d11y); // Dose 1
        add('HPV', addM(d11y, 6)); // Dose 2
    }

    // 16 Years
    if (ageYears >= 16) {
        const d16y = addY(dob, 16);
        add('MenACWY', d16y); // Dose 2
    }

    return doses;
};


const INITIAL_PATIENTS: PatientRecord[] = [
  {
    profile: {
      id: '84920-X',
      name: 'Doe, Baby',
      dob: BABY_DOB, // ~14 months
      sex: 'F',
      conditions: ['Immunocompromised'],
      medications: [],
      notes: 'Parent hesitant about live vaccines. Immunocompromised status requires careful scheduling.'
    },
    // Baby Doe has completed 6-month shots but hasn't come in for 12m shots yet.
    history: generateStandardHistory(BABY_DOB, 0.6) 
  },
  {
    profile: {
      id: '99210-Z',
      name: 'Child, Charlie',
      dob: CHILD_DOB, // 5 years old
      sex: 'M',
      conditions: [],
      medications: []
    },
    // Charlie has done all toddler shots (up to 4y) but is Due Now for Kindergarten boosters (DTaP, IPV, MMR, Var).
    history: generateStandardHistory(CHILD_DOB, 2) // Generate up to 2 years, effectively missing 4-5y shots
  },
  {
    profile: {
      id: '75921-T',
      name: 'Teen, Tina',
      dob: TEEN_DOB, // 13 years old
      sex: 'F',
      conditions: [],
      medications: [],
      notes: 'Needs school forms.'
    },
    history: [
        // Full childhood history Backfill
        ...generateStandardHistory(TEEN_DOB, 10), 
        // Recent Adolescent Shots
        { id: 't-1', vaccineCode: 'Tdap', dateAdministered: addY(TEEN_DOB, 11), valid: true },
        { id: 't-2', vaccineCode: 'MenACWY', dateAdministered: addY(TEEN_DOB, 11), valid: true },
        { id: 't-3', vaccineCode: 'HPV', dateAdministered: addY(TEEN_DOB, 11), valid: true },
        // Intentionally Missing HPV Dose 2 (Due at 11.5y) to trigger OVERDUE
    ]
  },
  {
    profile: {
        id: '22839-C',
        name: 'College, Casey',
        dob: COLLEGE_DOB, // 19 years
        sex: 'M',
        conditions: [],
        medications: [],
        notes: 'Transferring to university. Missing booster records.'
    },
    history: [
        // Casey missed his 16y MenACWY booster and never started HPV.
        // We generate up to 14y, but exclude HPV and MenACWY to manually add partials.
        ...generateStandardHistory(COLLEGE_DOB, 14, ['HPV', 'MenACWY']),
        // He got his 11y MenACWY
        { id: 'c-1', vaccineCode: 'MenACWY', dateAdministered: addY(COLLEGE_DOB, 11), valid: true }
        // He is now 19. 
        // MenACWY: D1 at 11y. D2 due at 16y. Currently Overdue.
        // HPV: 0 doses. Due Now.
    ]
  },
  {
    profile: {
        id: '33910-P',
        name: 'Mom, Mary',
        dob: PREGNANT_DOB, // 28 years
        sex: 'F',
        conditions: ['Pregnancy'],
        medications: ['Prenatal Vitamins'],
        notes: 'Currently 26 weeks pregnant. Needs Tdap (every pregnancy).'
    },
    history: [
        // Mary missed her 2nd MMR as a child. 
        // Normally this would be "Overdue", but because she is Pregnant, it should show "CONTRAINDICATED".
        ...generateStandardHistory(PREGNANT_DOB, 20, ['MMR']),
        { id: 'p-1', vaccineCode: 'MMR', dateAdministered: addY(PREGNANT_DOB, 1), valid: true }
        // She needs Tdap (Adult rule will recur), Flu (Safe), but NOT Live vaccines.
    ]
  },
  {
      profile: {
          id: '42891-M',
          name: 'Mid, Mike',
          dob: ADULT_DOB, // 52 years
          sex: 'M',
          conditions: ['Hypertension'],
          medications: ['Lisinopril'],
          notes: 'New patient establishment.'
      },
      history: [
          // Assume childhood history exists implicitly or was entered historically
          ...generateStandardHistory(ADULT_DOB, 18), 
          
          // Adult Td booster 5 years ago
          { id: 'm-1', vaccineCode: 'Td/Tdap', dateAdministered: addY(ADULT_DOB, 47), valid: true },
          // COVID series in 2021
          { id: 'm-2', vaccineCode: 'COVID-19', dateAdministered: addY(ADULT_DOB, 50), valid: true },
          { id: 'm-3', vaccineCode: 'COVID-19', dateAdministered: addM(addY(ADULT_DOB, 50), 1), valid: true },
          // Needs Shingles (Zoster) - None recorded
      ]
  },
  {
      profile: {
          id: '19432-B',
          name: 'Boomer, Bob',
          dob: SENIOR_DOB, // 66 years
          sex: 'M',
          conditions: ['Diabetes Type 2', 'COPD'],
          medications: ['Metformin', 'Albuterol'],
          notes: 'Discuss RSV and Pneumo.'
      },
      history: [
           // Assume childhood history
           ...generateStandardHistory(SENIOR_DOB, 18),
           
           // Recent Activity
           // Shingles Dose 1 given recently
           { id: 'b-1', vaccineCode: 'Zoster', dateAdministered: new Date(NOW.getFullYear(), NOW.getMonth() - 2, 1), valid: true },
           // Annual Flu given 11 months ago (Due Again)
           { id: 'b-2', vaccineCode: 'Influenza', dateAdministered: new Date(NOW.getFullYear() - 1, NOW.getMonth() - 2, 1), valid: true },
           // Tdap Booster overdue (last one 12 years ago)
           { id: 'b-3', vaccineCode: 'Td/Tdap', dateAdministered: addY(SENIOR_DOB, 54), valid: true },
      ]
  }
];

interface AppState {
    // Navigation & UI
    currentView: AppView;
    setCurrentView: (view: AppView) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Data Domain
    patients: PatientRecord[];
    selectedPatientId: string;
    
    // Actions
    setSelectedPatientId: (id: string) => void;
    updatePatientNote: (patientId: string, note: string) => void;
    addDosesToPatient: (patientId: string, doses: VaccineDose[]) => void;

    // Rules Engine Config
    activeRules: ImmunizationRulesMap;
    rulesSource: 'LOCAL' | 'REMOTE' | 'CUSTOM';
    setActiveRules: (rules: ImmunizationRulesMap, source: 'LOCAL' | 'REMOTE' | 'CUSTOM') => void;
    resetRules: () => void;
    importRules: (rules: ImmunizationRulesMap) => void;

    // Async/Computed State (Fed by Worker)
    populationStats: Record<string, PopulationStats>;
    setPopulationStats: (stats: Record<string, PopulationStats>) => void;
    
    // Derived/Memoized Selectors
    getFilteredPatients: () => PatientRecord[];
    getCurrentPatient: () => PatientRecord;
}

export const useAppStore = create<AppState>((set, get) => ({
    currentView: 'patient',
    setCurrentView: (view) => set({ currentView: view }),
    
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),

    patients: INITIAL_PATIENTS,
    selectedPatientId: INITIAL_PATIENTS[0].profile.id,
    
    setSelectedPatientId: (id) => set({ selectedPatientId: id, currentView: 'patient' }),

    updatePatientNote: (patientId, note) => set((state) => ({
        patients: state.patients.map(p => 
            p.profile.id === patientId 
                ? { ...p, profile: { ...p.profile, notes: note } }
                : p
        )
    })),

    addDosesToPatient: (patientId, doses) => set((state) => ({
        patients: state.patients.map(p => 
            p.profile.id === patientId 
                ? { ...p, history: [...p.history, ...doses] }
                : p
        )
    })),

    activeRules: DEFAULT_IMMUNIZATION_RULES,
    rulesSource: 'LOCAL',
    setActiveRules: (rules, source) => set({ activeRules: rules, rulesSource: source }),
    resetRules: () => set({ activeRules: DEFAULT_IMMUNIZATION_RULES, rulesSource: 'LOCAL' }),
    importRules: (rules) => set({ activeRules: rules, rulesSource: 'CUSTOM' }),

    populationStats: {},
    setPopulationStats: (stats) => set({ populationStats: stats }),

    // Selectors
    getFilteredPatients: () => {
        const { patients, searchQuery } = get();
        if (!searchQuery) return patients;
        const lowerQ = searchQuery.toLowerCase();
        return patients.filter(p => 
            p.profile.name?.toLowerCase().includes(lowerQ) || 
            p.profile.id.toLowerCase().includes(lowerQ)
        );
    },

    getCurrentPatient: () => {
        const { patients, selectedPatientId } = get();
        return patients.find(p => p.profile.id === selectedPatientId) || patients[0];
    }
}));