import { runGapAnalysis, getFutureForecast, groupForecastIntoVisits } from './logicService';
import { VaxStatus } from '../types';

// Web Worker for VaxCheck Logic Engine
// Handles heavy date math and rule evaluation off the main thread.

self.onmessage = (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'ANALYZE_PATIENT') {
      const { profile, history, rules } = payload;
      
      // 1. Run Gap Analysis
      // We must reconstruct Dates because JSON serialization turns them into strings
      const hydrateDate = (d: any) => new Date(d);
      
      const hydratedProfile = {
          ...profile,
          dob: hydrateDate(profile.dob)
      };

      const hydratedHistory = history.map((h: any) => ({
          ...h,
          dateAdministered: hydrateDate(h.dateAdministered)
      }));
      
      const gapAnalysis = runGapAnalysis(hydratedProfile, hydratedHistory, rules);
      
      // Sort: Alphabetical by series name (matching UI expectation)
      gapAnalysis.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
      
      // 2. Run Forecasting (120 months / 10 years)
      const forecast = getFutureForecast(hydratedProfile, hydratedHistory, rules, 120);
      
      // 3. Optimize Visits
      const visits = groupForecastIntoVisits(forecast);

      self.postMessage({ 
        type: 'ANALYZE_PATIENT_RESULT', 
        id,
        payload: { gapAnalysis, forecast, visits } 
      });

    } else if (type === 'ANALYZE_POPULATION') {
      const { patients, rules } = payload;
      const results: Record<string, { overdue: number; dueNow: number; complete: number; total: number }> = {};

      // Iterate all patients to generate summary stats
      patients.forEach((p: any) => {
          const hydratedProfile = { ...p.profile, dob: new Date(p.profile.dob) };
          const hydratedHistory = p.history.map((h: any) => ({ ...h, dateAdministered: new Date(h.dateAdministered) }));

          const analysis = runGapAnalysis(hydratedProfile, hydratedHistory, rules);
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

      self.postMessage({
          type: 'ANALYZE_POPULATION_RESULT',
          id,
          payload: results
      });
    }
  } catch (error) {
    console.error("Worker Error:", error);
    self.postMessage({ type: 'ERROR', id, error: String(error) });
  }
};