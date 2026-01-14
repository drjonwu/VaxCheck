
import { PatientProfile, VaccineDose, ForecastDose, VaccineSeriesStatus } from '../types';

// --- FHIR R4 TYPE DEFINITIONS (Minimal Subset) ---

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: { system: string; value: string }[];
  active: boolean;
  name: { family?: string; given?: string[]; text?: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
}

export interface FhirImmunization extends FhirResource {
  resourceType: 'Immunization';
  status: 'completed' | 'entered-in-error' | 'not-done';
  vaccineCode: {
    coding: { system: string; code: string; display?: string }[];
    text?: string;
  };
  patient: { reference: string };
  occurrenceDateTime: string;
  primarySource?: boolean;
}

export interface FhirImmunizationRecommendation extends FhirResource {
  resourceType: 'ImmunizationRecommendation';
  patient: { reference: string };
  date: string;
  recommendation: {
    vaccineCode?: { text: string }[];
    targetDisease?: { text: string };
    doseNumberPositiveInt?: number;
    forecastStatus: {
      coding: { system: string; code: string; display: string }[];
    };
    dateCriterion?: {
      code: { coding: { system: string; code: string }[] };
      value: string;
    }[];
  }[];
}

export interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: 'collection' | 'transaction' | 'document';
  timestamp: string;
  entry: { resource: FhirResource }[];
}

// --- CVX CODE MAPPING (Internal -> HL7 Standard) ---
// https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx
const CVX_MAP: Record<string, { code: string; display: string }> = {
  'HepB': { code: '08', display: 'Hep B, adolescent or pediatric' },
  'Rotavirus': { code: '119', display: 'rotavirus, monovalent' },
  'DTaP': { code: '20', display: 'DTaP' },
  'Hib': { code: '17', display: 'Hib, unspecified formulation' },
  'PCV': { code: '133', display: 'pneumococcal conjugate PCV 13' },
  'IPV': { code: '10', display: 'IPV' },
  'MMR': { code: '03', display: 'MMR' },
  'Varicella': { code: '21', display: 'varicella' },
  'HepA': { code: '83', display: 'Hep A, ped/adol, 2 dose' },
  'MenACWY': { code: '147', display: 'meningococcal MCV4, unspecified' },
  'Tdap': { code: '115', display: 'Tdap' },
  'HPV': { code: '165', display: 'HPV9' },
  'COVID-19': { code: '213', display: 'SARS-COV-2, unspecified' },
  'Influenza': { code: '88', display: 'influenza, unspecified formulation' },
  'RSV': { code: '305', display: 'RSV, monoclonal antibody (Nirsevimab)' }
};

// --- ADAPTER FUNCTIONS ---

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const toFhirPatient = (profile: PatientProfile): FhirPatient => {
  const nameParts = profile.name ? profile.name.split(', ') : ['Unknown', 'Patient'];
  const family = nameParts[0];
  const given = nameParts.slice(1);

  return {
    resourceType: 'Patient',
    id: profile.id,
    active: true,
    identifier: [
      {
        system: 'urn:oid:2.16.840.1.113883.4.1', // Mock OID for internal MRN system
        value: profile.id
      }
    ],
    name: [
      {
        family,
        given,
        text: profile.name
      }
    ],
    gender: profile.sex === 'M' ? 'male' : profile.sex === 'F' ? 'female' : 'unknown',
    birthDate: formatDate(profile.dob)
  };
};

export const toFhirImmunization = (dose: VaccineDose, patientId: string): FhirImmunization => {
  const cvx = CVX_MAP[dose.vaccineCode];
  
  return {
    resourceType: 'Immunization',
    id: dose.id,
    status: 'completed',
    primarySource: true, // Assuming this is the source of truth
    patient: {
      reference: `Patient/${patientId}`
    },
    occurrenceDateTime: formatDate(dose.dateAdministered),
    vaccineCode: {
      coding: cvx ? [
        {
          system: 'http://hl7.org/fhir/sid/cvx',
          code: cvx.code,
          display: cvx.display
        }
      ] : [],
      text: dose.vaccineCode
    }
  };
};

export const toFhirImmunizationRecommendation = (
  patientId: string, 
  forecast: ForecastDose[]
): FhirImmunizationRecommendation => {
  return {
    resourceType: 'ImmunizationRecommendation',
    patient: { reference: `Patient/${patientId}` },
    date: new Date().toISOString(),
    recommendation: forecast.map(f => {
      const cvx = CVX_MAP[f.seriesName];
      return {
        targetDisease: { text: f.seriesName }, // Simplified, typically SNOMED
        vaccineCode: cvx ? [{ text: cvx.display }] : [{ text: f.seriesName }],
        doseNumberPositiveInt: f.doseNumber,
        forecastStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/immunization-recommendation-status',
            code: 'due',
            display: 'Due'
          }]
        },
        dateCriterion: [
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '30980-7', // Date vaccine due
              }]
            },
            value: formatDate(f.dueDate)
          }
        ]
      };
    })
  };
};

export const generateFhirBundle = (
  patient: PatientProfile, 
  history: VaccineDose[], 
  forecast: ForecastDose[]
): FhirBundle => {
  const patientResource = toFhirPatient(patient);
  const immResources = history.map(d => toFhirImmunization(d, patient.id));
  const recResource = toFhirImmunizationRecommendation(patient.id, forecast);

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { resource: patientResource },
      ...immResources.map(r => ({ resource: r })),
      { resource: recResource }
    ]
  };
};

export const downloadFhirBundle = (patient: PatientProfile, history: VaccineDose[], forecast: ForecastDose[]) => {
    const bundle = generateFhirBundle(patient, history, forecast);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-bundle-${patient.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
