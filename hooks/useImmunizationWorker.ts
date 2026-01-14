
import { useState, useCallback } from 'react';
import { PatientRecord, ImmunizationRulesMap, VaccineSeriesStatus, ForecastDose, ScheduledVisit, VaxStatus } from '../types';
import { runGapAnalysis, getFutureForecast, groupForecastIntoVisits } from '../services/logicService';

interface AnalysisResult {
  gapAnalysis: VaccineSeriesStatus[];
  forecast: ForecastDose[];
  visits: ScheduledVisit[];
}

interface PopulationStats {
  overdue: number;
  dueNow: number;
  complete: number;
  total: number;
}

export const useImmunizationWorker = () => {
  const [isComputing, setIsComputing] = useState(false);

  // NOTE: Reverted to Main Thread execution. 
  // Native Web Workers cannot share the 'importmap' from index.html in this environment,
  // causing imports of 'date-fns' to fail inside the worker.
  // We use setTimeout to yield to the event loop, allowing the UI to show the loading state.

  const analyzePatient = useCallback((
    patient: PatientRecord, 
    rules: ImmunizationRulesMap
  ): Promise<AnalysisResult> => {
    return new Promise((resolve, reject) => {
      setIsComputing(true);

      // Yield to render loop to show spinner
      setTimeout(() => {
        try {
            // 1. Run Logic
            const gapAnalysis = runGapAnalysis(patient.profile, patient.history, rules);
            gapAnalysis.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
            
            // 2. Forecast
            // Extended to 120 months (10 years) to support long-range timeline scrolling
            const forecast = getFutureForecast(patient.profile, patient.history, rules, 120);
            
            // 3. Visit Grouping
            const visits = groupForecastIntoVisits(forecast);

            setIsComputing(false);
            resolve({ gapAnalysis, forecast, visits });
        } catch (e) {
            setIsComputing(false);
            console.error("Analysis Error", e);
            reject(e);
        }
      }, 50); // Small delay to ensure UI paints
    });
  }, []);

  const analyzePopulation = useCallback((
    patients: PatientRecord[],
    rules: ImmunizationRulesMap
  ): Promise<Record<string, PopulationStats>> => {
    return new Promise((resolve, reject) => {
      // Yield to render loop
      setTimeout(() => {
        try {
            const results: Record<string, PopulationStats> = {};

            patients.forEach((p) => {
                const analysis = runGapAnalysis(p.profile, p.history, rules);
                let overdue = 0;
                let dueNow = 0;
                let complete = 0;

                analysis.forEach((s) => {
                    if (s.status === VaxStatus.OVERDUE) overdue++;
                    else if (s.status === VaxStatus.DUE_NOW) dueNow++;
                    else if (s.status === VaxStatus.COMPLETE || s.status === VaxStatus.UP_TO_DATE) complete++;
                });
                
                results[p.profile.id] = { 
                    overdue, 
                    dueNow, 
                    complete, 
                    total: analysis.length 
                };
            });
            
            resolve(results);
        } catch (e) {
            console.error("Population Analysis Error", e);
            reject(e);
        }
      }, 50);
    });
  }, []);

  return { analyzePatient, analyzePopulation, isComputing };
};