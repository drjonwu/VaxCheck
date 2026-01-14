import { ImmunizationRulesMap, VaccineRule } from '../types';
import { DEFAULT_IMMUNIZATION_RULES } from '../config/immunizationRules';

// --- MOCK REMOTE DATA ---
// Represents a newer version of rules that might be fetched from a server
const MOCK_REMOTE_RULES: ImmunizationRulesMap = {
    ...DEFAULT_IMMUNIZATION_RULES,
    'HepB': [
        { seriesName: 'HepB', doseNumber: 1, minAgeMonths: 0 },
        { seriesName: 'HepB', doseNumber: 2, minAgeMonths: 1, minIntervalWeeks: 4 },
        // UPDATE: Min Age increased to 30 weeks (Hypothetical Policy Change)
        { seriesName: 'HepB', doseNumber: 3, minAgeWeeks: 30, minIntervalWeeks: 8, minIntervalWeeksFromDose1: 16 },
    ],
    'Shingrix': [
        { seriesName: 'Shingrix', doseNumber: 1, minAgeMonths: 600 }, // 50 years
        { seriesName: 'Shingrix', doseNumber: 2, minAgeMonths: 602, minIntervalWeeks: 8 }
    ]
};

/**
 * Simulates fetching rules from a remote CDSi Endpoint.
 */
export const fetchRemoteRules = async (): Promise<ImmunizationRulesMap> => {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_REMOTE_RULES;
};

/**
 * Validates the schema of a loaded rule object to ensure it won't crash the logic engine.
 */
export const validateRules = (rules: any): { valid: boolean; error?: string } => {
    if (typeof rules !== 'object' || rules === null) {
        return { valid: false, error: "Root must be an object" };
    }
    
    // Check keys
    const series = Object.keys(rules);
    if (series.length === 0) {
        return { valid: false, error: "No vaccine series definitions found" };
    }

    for (const s of series) {
        const rulesArray = rules[s];
        if (!Array.isArray(rulesArray)) {
            return { valid: false, error: `Series '${s}' is not an array` };
        }
        
        // Deep check a few items
        for (let i = 0; i < rulesArray.length; i++) {
            const rule = rulesArray[i];
            if (!rule.seriesName || typeof rule.doseNumber !== 'number') {
                return { valid: false, error: `Invalid rule definition in '${s}' at index ${i}` };
            }
        }
    }
    
    return { valid: true };
};

/**
 * Parses a JSON string into a Rules Map.
 */
export const parseRules = (jsonString: string): ImmunizationRulesMap => {
    try {
        const parsed = JSON.parse(jsonString);
        const validation = validateRules(parsed);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        return parsed as ImmunizationRulesMap;
    } catch (e: any) {
        throw new Error(`Failed to parse rules: ${e.message}`);
    }
};

/**
 * Exports current rules to a formatted JSON string for download.
 */
export const exportRules = (rules: ImmunizationRulesMap): string => {
    return JSON.stringify(rules, null, 2);
};