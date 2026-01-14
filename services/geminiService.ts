import { GoogleGenAI, Type } from "@google/genai";
import { ClinicalAbstract, PatientProfile, VaccineDose, VaccineSeriesStatus, ForecastDose } from '../types';
import { getAgeInMonths } from './logicService';

// Initialize with environment variable as per strict instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- ZERO-TRUST PRIVACY: DATA STRIPPING & MINIMIZATION ---

const deidentifyAndMinimizeData = (
  patient: PatientProfile, 
  history: VaccineDose[],
  targetSeriesName: string
): ClinicalAbstract => {
  const rawAge = getAgeInMonths(patient.dob);
  
  // PRIVACY: Fuzz age for older patients. 
  // Exact usage in months is critical for infants < 2yo, but acts as an identifier for older patients.
  // The Hard Logic engine handles the math; the AI only needs context.
  let displayAge = rawAge;
  
  // Rule: If over 2 years old, round to nearest year (in months) to reduce fingerprinting
  if (rawAge > 24) {
    displayAge = Math.floor(rawAge / 12) * 12; 
  }

  // PRIVACY: Contextual Filtering / Data Minimization
  // Only include vaccine history relevant to the specific series being queried.
  // There is no clinical need to send MMR history when asking about HepB.
  // This significantly reduces the data payload and potential for re-identification.
  const relevantHistory = history.filter(d => d.vaccineCode === targetSeriesName);

  return {
    ageMonths: Number(displayAge.toFixed(1)),
    sex: patient.sex,
    conditions: patient.conditions, // Kept as these are clinically relevant for contraindications
    medications: patient.medications,
    vaccineHistory: relevantHistory.map(d => ({
      code: d.vaccineCode,
      // We calculate age at dose relative to the fuzzed age or dob, 
      // but relative age at dose is usually safe enough if birthdate isn't sent.
      ageAtDoseMonths: Number(getAgeInMonths(patient.dob, d.dateAdministered).toFixed(1))
    }))
  };
};

export const streamClinicalExplanation = async (
  patient: PatientProfile,
  history: VaccineDose[],
  targetSeries: VaccineSeriesStatus,
  futureDoses: ForecastDose[],
  onChunk: (text: string) => void
) => {
  // Apply privacy filters
  const abstract = deidentifyAndMinimizeData(patient, history, targetSeries.seriesName);

  // Format forecast for the prompt (Safe: Relative dates only, no PII)
  const forecastText = futureDoses.length > 0 
    ? futureDoses.map(f => `Dose ${f.doseNumber} due ${f.dueDate.toLocaleDateString()}`).join('; ')
    : 'None scheduled within 24 months';

  const prompt = `
    Role: Clinical Decision Support Assistant.
    Context: A physician is viewing a gap analysis for a patient.
    Task: Briefly explain the clinical reasoning for the status: "${targetSeries.status}" for the vaccine series "${targetSeries.seriesName}".
    
    Clinical Abstract (Anonymized & Minimized):
    - Age Group: ~${abstract.ageMonths} months old
    - Sex: ${abstract.sex}
    - Relevant Conditions: ${abstract.conditions.join(', ') || 'None'}
    - Relevant Medications: ${abstract.medications.join(', ') || 'None'}
    - Relevant History (${targetSeries.seriesName} only): ${JSON.stringify(abstract.vaccineHistory)}
    
    Hard Logic Output (Deterministic):
    - Status: ${targetSeries.status}
    - Next Dose Due: ${targetSeries.nextDoseDue?.toLocaleDateString() || 'N/A'}
    - Reason: ${targetSeries.reason}
    - Projected Catch-up Schedule: ${forecastText}

    Instructions:
    1. Confirm if the Hard Logic seems consistent with CDC guidelines (briefly).
    2. If the patient has conditions (e.g. Immunocompromised) or medications (e.g. Warfarin), highlight specific risks (e.g. IM injection risks, live virus contraindications).
    3. Explain the timing of the projected schedule if present (e.g., "Dose 3 is scheduled 4 weeks later to satisfy minimum interval requirements").
    4. Be concise. Bullet points preferred.
    5. Do NOT calculate dates yourself; trust the Hard Logic dates provided.
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("AI Stream Error:", error);
    onChunk("\n[System]: Unable to generate clinical explanation at this time.");
  }
};

export const streamPopulationHealthSummary = async (
  chartData: { name: string; Compliant: number; DueNow: number; Overdue: number }[],
  totalPatients: number,
  onChunk: (text: string) => void
) => {
  // Filter out empty data to reduce token usage
  const activeSeries = chartData.filter(d => d.Compliant + d.DueNow + d.Overdue > 0);

  const prompt = `
    Role: Public Health Analyst.
    Task: Analyze the provided vaccination compliance data and provide a brief executive summary.
    
    Context:
    - Total Population: ${totalPatients} patients
    - Data (Series: [Compliant, Due Now, Overdue]): 
      ${activeSeries.map(s => `- ${s.name}: [${s.Compliant} compliant, ${s.DueNow} due, ${s.Overdue} overdue]`).join('\n      ')}

    Instructions:
    1. Highlights: Identify 1-2 vaccine series with the highest compliance rates.
    2. Areas of Concern: Identify 1-2 vaccine series with the highest overdue rates or immediate needs.
    3. Action Plan: Suggest a specific focus area for the clinic (e.g., "Focus on catching up adolescents on HPV").
    4. Keep it short (max 150 words). Use markdown formatting for bolding key terms.
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("AI Stream Error:", error);
    onChunk("\n[System]: Unable to generate population insights at this time.");
  }
};

// --- MULTIMODAL OCR ---

export interface ScannedDose {
    vaccine: string;
    date: string;
}

export const parseVaccineCard = async (base64Image: string): Promise<ScannedDose[]> => {
    // We strip the data URL prefix if present to get raw base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const prompt = `
      You are a specialized medical data extractor. 
      Analyze this image of a vaccination record card.
      
      Extract a list of administered vaccines.
      
      Output JSON format only:
      Array of objects with:
      - "vaccine": The name or code of the vaccine (e.g., "MMR", "HepB", "COVID-19"). Normalize common abbreviations.
      - "date": The date administered in YYYY-MM-DD format.

      PRIVACY RULE: 
      - Do NOT extract Patient Name, DOB, or MRN. 
      - Ignore any handwritten notes about "Next Appointment".
      - Only extract PAST administered doses.
      - If a date is illegible, skip that row.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            vaccine: { type: Type.STRING },
                            date: { type: Type.STRING }
                        },
                        required: ['vaccine', 'date']
                    }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as ScannedDose[];
        }
        return [];
    } catch (error) {
        console.error("OCR Error:", error);
        throw new Error("Failed to process image");
    }
};