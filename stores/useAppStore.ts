import { create } from 'zustand';
import { PatientRecord, ImmunizationRulesMap, VaccineDose, AppView, PopulationStats } from '../types';
import { DEFAULT_IMMUNIZATION_RULES } from '../config/immunizationRules';
import { fetchMockPatients } from '../services/mockDataService';

interface AppState {
    // Navigation & UI
    currentView: AppView;
    setCurrentView: (view: AppView) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Data Domain
    patients: PatientRecord[];
    selectedPatientId: string;
    isLoadingPatients: boolean;
    
    // Actions
    loadPatients: () => Promise<void>;
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

// STABLE CONSTANT to prevent infinite re-renders when selector is called
const LOADING_PATIENT: PatientRecord = {
    profile: { 
        id: 'loading', 
        name: 'Loading Patient Data...', 
        dob: new Date(), // Fixed date instance
        sex: 'F', 
        conditions: [], 
        medications: [] 
    },
    history: []
};

export const useAppStore = create<AppState>((set, get) => ({
    currentView: 'patient',
    setCurrentView: (view) => set({ currentView: view }),
    
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),

    patients: [], // Start empty
    selectedPatientId: '',
    isLoadingPatients: false,

    loadPatients: async () => {
        set({ isLoadingPatients: true });
        try {
            const data = await fetchMockPatients();
            // Select the first patient if none is selected
            const currentSelected = get().selectedPatientId;
            const nextSelected = currentSelected || (data.length > 0 ? data[0].profile.id : '');

            set({ 
                patients: data, 
                isLoadingPatients: false,
                selectedPatientId: nextSelected
            });
        } catch (e) {
            console.error("Failed to load patients", e);
            set({ isLoadingPatients: false });
        }
    },
    
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
        const found = patients.find(p => p.profile.id === selectedPatientId);
        
        if (found) return found;
        if (patients.length > 0) return patients[0];
        
        return LOADING_PATIENT;
    }
}));