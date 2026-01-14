import { PatientProfile, VaccineDose, VaccineSeriesStatus, VaxStatus, VaccineRule, ForecastDose, ScheduledVisit, ImmunizationRulesMap } from '../types';
import { 
  addMonths, 
  addWeeks, 
  addDays,
  differenceInDays, 
  isAfter, 
  startOfDay, 
  isValid,
  subDays
} from 'date-fns';

// CVX Codes or Group Names for Live Vaccines that interfere (Parenteral + Live Flu)
const LIVE_VACCINES = ['MMR', 'Varicella', 'Measles', 'Mumps', 'Rubella', 'FluMist', 'Zoster']; 

// --- DATE UTILS (Using date-fns for Robustness) ---

/**
 * Replaces legacy addCalendarMonths with robust date-fns implementation.
 * Handles leap years and end-of-month rollovers correctly.
 */
export const addCalendarMonths = (date: Date, months: number): Date => {
    return addMonths(date, months);
};

// Precise additions for logic.
// We use addDays with (weeks * 7) to ensure no floating point truncations occur with addWeeks
const addWeeksPrecise = (date: Date, weeks: number): Date => {
  return addDays(date, Math.floor(weeks * 7));
};

// Precise age calculation for display and logic
// Uses differenceInDays / 30.44 to maintain the "float" precision needed for AI context,
// but relies on date-fns for the diffing to handle DST/Leap years better than ms math.
export const getAgeInMonths = (dob: Date, targetDate: Date = new Date()): number => {
  if (!isValid(dob) || !isValid(targetDate)) return 0;
  const days = differenceInDays(targetDate, dob);
  return days / 30.4375; // More precise average month length
};

// --- CORE ENGINE ---

export const evaluateSeries = (
  patient: PatientProfile,
  history: VaccineDose[],
  seriesName: string,
  allRules: ImmunizationRulesMap,
  gracePeriodDays: number = 4
): VaccineSeriesStatus => {
  const rules = allRules[seriesName] || [];
  
  // 1. Filter and Sort History for this Series
  const seriesDoses = history
    .filter((d) => d.vaccineCode === seriesName)
    .sort((a, b) => a.dateAdministered.getTime() - b.dateAdministered.getTime());

  // OPTIMIZATION: Pre-calculate Live Virus Conflict List
  // If the current series is NOT a live vaccine, we don't need to check conflicts.
  // If it IS, we gather all other live vaccine administrations once.
  // This reduces complexity from O(N*M) to O(N + K*M) roughly, preventing full history scans inside the loop.
  const isLiveSeries = LIVE_VACCINES.includes(seriesName);
  const liveVirusHistory = isLiveSeries 
    ? history.filter(d => LIVE_VACCINES.includes(d.vaccineCode)) 
    : [];

  // 2. Validate History (Apply Grace Period & Cross-Series Checks)
  // We must determine which doses are VALID before deciding the next step.
  // Standard CDSi Logic: Evaluate chronologically. If a dose is invalid, it doesn't count.
  const validDoses: VaccineDose[] = [];
  
  for (const dose of seriesDoses) {
      // Determine which target dose number we are attempting to satisfy
      // e.g. If validDoses.length is 0, we are attempting Target Dose 1.
      const targetDoseNum = validDoses.length + 1;
      
      // Find the rule. Handle recurring logic if we've exhausted defined rules.
      let rule = rules[targetDoseNum - 1];
      if (!rule && rules.length > 0 && rules[rules.length - 1].isRecurring) {
          rule = { ...rules[rules.length - 1], doseNumber: targetDoseNum };
      }

      // If no rule exists for this dose number (and not recurring), the series is likely done.
      // Any further doses are superfluous. We treat them as valid for history but they don't advance the series count.
      if (!rule) {
          validDoses.push(dose);
          continue;
      }

      let isValidDose = true;

      // --- CHECK A: LIVE VACCINE INTERFERENCE ---
      if (isLiveSeries) {
          // Use the pre-filtered list
          const conflict = liveVirusHistory.some(other => {
              if (other.id === dose.id) return false;
              // Note: We've already filtered for LIVE_VACCINES codes above
              
              // Only look at doses given BEFORE the current one
              if (other.dateAdministered >= dose.dateAdministered) return false;

              const diff = differenceInDays(dose.dateAdministered, other.dateAdministered);
              // ACIP: Live vaccines must be given on same day OR >= 28 days apart.
              return diff < 28 && diff > 0; 
          });

          if (conflict) {
              isValidDose = false;
              // console.log(`Invalid Dose: ${seriesName} on ${dose.dateAdministered} due to Live Virus Conflict`);
          }
      }

      // --- CHECK B: MINIMUM AGE (Grace Period Applied) ---
      if (isValidDose) {
          let minAgeDate = startOfDay(patient.dob);
          if (rule.minAgeWeeks) {
              minAgeDate = addWeeksPrecise(minAgeDate, rule.minAgeWeeks);
          } else if (rule.minAgeMonths) {
              minAgeDate = addCalendarMonths(minAgeDate, rule.minAgeMonths);
          }

          // Apply Grace Period
          // If administered >= (MinAge - 4 days), it is Valid.
          const minAgeWithGrace = subDays(minAgeDate, gracePeriodDays);
          
          if (dose.dateAdministered < minAgeWithGrace) {
              isValidDose = false;
          }
      }

      // --- CHECK C: MINIMUM INTERVAL (Grace Period Applied) ---
      if (isValidDose && validDoses.length > 0) {
          const prevDose = validDoses[validDoses.length - 1]; // Compare against last VALID dose
          
          if (rule.minIntervalWeeks) {
              // Interval is calculated from the previous dose's administration date
              const minIntervalDate = addWeeksPrecise(startOfDay(prevDose.dateAdministered), rule.minIntervalWeeks);
              const minIntervalWithGrace = subDays(minIntervalDate, gracePeriodDays);

              if (dose.dateAdministered < minIntervalWithGrace) {
                  isValidDose = false;
              }
          }
          
          if (rule.minIntervalWeeksFromDose1 && validDoses.length > 0) {
              const dose1 = validDoses[0];
              const minIntervalDose1 = addWeeksPrecise(startOfDay(dose1.dateAdministered), rule.minIntervalWeeksFromDose1);
              const minIntervalDose1WithGrace = subDays(minIntervalDose1, gracePeriodDays);

              if (dose.dateAdministered < minIntervalDose1WithGrace) {
                  isValidDose = false;
              }
          }
      }

      // --- CHECK D: MAX AGE ---
      // Grace periods typically do NOT apply to max age.
      if (isValidDose) {
          let maxAgeDate: Date | null = null;
          
          if (rule.maxAgeWeeks !== undefined) {
               maxAgeDate = addWeeksPrecise(startOfDay(patient.dob), rule.maxAgeWeeks);
          } else if (rule.maxAgeMonths !== undefined) {
               maxAgeDate = addCalendarMonths(startOfDay(patient.dob), rule.maxAgeMonths);
          }

          if (maxAgeDate) {
              // Standard: Administered date must be BEFORE max age date.
              // If administered ON or AFTER max age date, it is invalid.
              // ACIP: "Do not start series on or after age 15 weeks 0 days"
              if (dose.dateAdministered >= maxAgeDate) {
                   isValidDose = false;
              }
          }
      }

      if (isValidDose) {
          validDoses.push(dose);
      }
  }

  const count = validDoses.length;
  const currentAgeMonths = getAgeInMonths(patient.dob);

  // 3. Check for Contraindications (Hard Logic)
  const isImmunocompromised = patient.conditions.includes('Immunocompromised');
  const isPregnant = patient.conditions.includes('Pregnancy');

  if (isImmunocompromised && (seriesName === 'MMR' || seriesName === 'Varicella' || seriesName === 'Rotavirus' || seriesName === 'FluMist')) {
    return {
      seriesName,
      status: VaxStatus.CONTRAINDICATED,
      dosesAdministered: count,
      reason: 'Contraindication: Patient is Immunocompromised (Live Virus Risk)',
    };
  }

  // ACIP: Live vaccines contraindicated during pregnancy
  if (isPregnant && LIVE_VACCINES.includes(seriesName)) {
      return {
          seriesName,
          status: VaxStatus.CONTRAINDICATED,
          dosesAdministered: count,
          reason: 'Contraindication: Patient is Pregnant (Live Virus Risk)',
      };
  }

  // 4. Identify the Next Target Rule based on VALID Count
  let nextRule: VaccineRule | undefined = rules[count];
  let isVirtualRecurringDose = false;

  if (!nextRule && count > 0 && rules.length > 0) {
    const lastDefinedRule = rules[rules.length - 1];
    if (lastDefinedRule.isRecurring) {
        nextRule = {
            ...lastDefinedRule,
            doseNumber: count + 1
        };
        isVirtualRecurringDose = true;
    }
  }

  // 5. Series Complete?
  if (!nextRule) {
    return {
      seriesName,
      status: VaxStatus.COMPLETE,
      dosesAdministered: count,
      reason: 'Series complete per ACIP schedule.',
    };
  }

  // 6. Evaluate Next Dose (ICE Compliant Logic)
  
  // A. Check Maximum Age Constraint
  // Using ICE "Is Before" logic roughly: If Age > MaxAge, then Not Indicated.
  if (nextRule.maxAgeMonths && currentAgeMonths > nextRule.maxAgeMonths) {
    // Catch-up logic: If we have already started the series or are in a catch-up phase where fewer doses are needed,
    // hitting a max age on a specific dose rule means we are done.
    if (count > 0) {
         return {
             seriesName,
             status: VaxStatus.COMPLETE,
             dosesAdministered: count,
             reason: `Patient age (${currentAgeMonths.toFixed(1)}m) exceeds limit for Dose ${nextRule.doseNumber} (${nextRule.maxAgeMonths}m). Series concluded.`,
             ruleApplied: nextRule
         };
    }

    return {
        seriesName,
        status: VaxStatus.CONTRAINDICATED, // Or "Not Indicated"
        dosesAdministered: count,
        reason: `Maximum age (${nextRule.maxAgeMonths}m) exceeded for Dose ${nextRule.doseNumber}.`,
        ruleApplied: nextRule
    };
  }

  // Check Precise Max Age (Weeks)
  if (nextRule.maxAgeWeeks) {
      // Calculate max age date
      const maxAgeDate = addWeeksPrecise(patient.dob, nextRule.maxAgeWeeks);
      const today = new Date();
      // ICE Standard: Max Age is usually "Must be administered BEFORE x weeks".
      if (isAfter(today, maxAgeDate)) {
          if (count > 0) {
              return {
                  seriesName,
                  status: VaxStatus.COMPLETE,
                  dosesAdministered: count,
                  reason: `Patient age exceeds precise limit for Dose ${nextRule.doseNumber} (${nextRule.maxAgeWeeks.toFixed(1)}w). Series concluded.`,
                  ruleApplied: nextRule
              };
          }
          return {
             seriesName,
             status: VaxStatus.CONTRAINDICATED,
             dosesAdministered: count,
             reason: `Maximum age (${nextRule.maxAgeWeeks.toFixed(1)}w) exceeded.`,
             ruleApplied: nextRule
         };
      }
  }
  
  // B. Calculate earliest eligible date based on Min Age
  // Priority: minAgeWeeks (Precise) > minAgeMonths (Calendar)
  // Use date-fns startOfDay to ensure we aren't tripped up by time components
  let minAgeDate = startOfDay(patient.dob);
  let minAgeLabel = '';

  if (nextRule.minAgeWeeks !== undefined) {
      minAgeDate = addWeeksPrecise(minAgeDate, nextRule.minAgeWeeks);
      minAgeLabel = `${nextRule.minAgeWeeks}w`;
  } else if (nextRule.minAgeMonths !== undefined) {
      minAgeDate = addCalendarMonths(minAgeDate, nextRule.minAgeMonths);
      minAgeLabel = `${nextRule.minAgeMonths}m`;
  }

  // C. Calculate earliest eligible date based on Min Interval from last VALID dose
  let minIntervalDate = new Date(0); // Epoch
  if (count > 0 && nextRule.minIntervalWeeks) {
    const lastDose = validDoses[count - 1]; // Use Valid Doses for Interval calc
    // Ensure we calculate interval from start of day of administration
    minIntervalDate = addWeeksPrecise(startOfDay(lastDose.dateAdministered), nextRule.minIntervalWeeks);
  }

  // D. Calculate earliest eligible date based on Min Interval from DOSE 1 (Specific for HepB D3)
  let minIntervalDose1Date = new Date(0);
  if (count > 0 && nextRule.minIntervalWeeksFromDose1) {
      const dose1 = validDoses[0]; 
      if (dose1) {
          minIntervalDose1Date = addWeeksPrecise(startOfDay(dose1.dateAdministered), nextRule.minIntervalWeeksFromDose1);
      }
  }

  // The Due Date is the later of all constraints
  // Note: We do NOT apply grace period to the Future Due Date calculation. 
  // You cannot *schedule* a patient 4 days early; you can only *accept* a patient who came 4 days early.
  const constraints = [minAgeDate, minIntervalDate, minIntervalDose1Date];
  const dueDate = new Date(Math.max(...constraints.map(d => d.getTime())));
  
  const today = startOfDay(new Date());
  
  // Clean up time components on dueDate for comparison
  dueDate.setHours(0,0,0,0);

  let status = VaxStatus.FUTURE;
  // If the vaccine is due or overdue, the actionable date is Today.
  // This ensures forecast logic branches from the present, not the past.
  let effectiveDueDate = dueDate;

  // Use date-fns check
  if (!isAfter(dueDate, today)) {
    // If due date is <= today
    const overdueThreshold = addWeeksPrecise(dueDate, 8);
    // If today is after overdueThreshold, it's overdue
    status = isAfter(today, overdueThreshold) ? VaxStatus.OVERDUE : VaxStatus.DUE_NOW;
    effectiveDueDate = today;
  }

  // Generate logic reason text
  let reasonText = isVirtualRecurringDose
    ? `Recurring Dose ${nextRule.doseNumber} due.`
    : `Dose ${nextRule.doseNumber} due (Min Age: ${minAgeLabel}${count > 0 ? `, Interval: ${nextRule.minIntervalWeeks}w` : ''}).`;

  // Append invalid dose warning if any were dropped
  if (validDoses.length < seriesDoses.length) {
      reasonText += ` [Alert: ${seriesDoses.length - validDoses.length} invalid dose(s) found in history]`;
  }

  return {
    seriesName,
    status,
    dosesAdministered: count,
    nextDoseDue: effectiveDueDate,
    reason: reasonText,
    ruleApplied: nextRule
  };
};

// Forecast future doses for the next 12 months
export const getFutureForecast = (patient: PatientProfile, history: VaccineDose[], allRules: ImmunizationRulesMap, horizonMonths: number = 12): ForecastDose[] => {
  const horizonDate = addCalendarMonths(new Date(), horizonMonths);
  const forecast: ForecastDose[] = [];
  const today = startOfDay(new Date());

  Object.keys(allRules).forEach(seriesName => {
      const simHistory = [...history];
      let iterations = 0;
      
      while(iterations < 5) {
          const status = evaluateSeries(patient, simHistory, seriesName, allRules);
          
          if (!status.nextDoseDue || status.status === VaxStatus.COMPLETE || status.status === VaxStatus.CONTRAINDICATED) {
              break;
          }

          if (isAfter(status.nextDoseDue, horizonDate)) {
              break;
          }

          if (iterations > 0 || status.status === VaxStatus.FUTURE) {
             forecast.push({
                 seriesName,
                 doseNumber: status.dosesAdministered + 1,
                 dueDate: status.nextDoseDue,
                 status: VaxStatus.FUTURE 
             });
          }

          // In simulation, assume administration happened on the due date (which is clamped to Today if overdue)
          const effectiveAdminDate = isAfter(today, status.nextDoseDue) ? today : status.nextDoseDue;

          simHistory.push({
              id: `sim-${seriesName}-${iterations}`,
              vaccineCode: seriesName,
              dateAdministered: effectiveAdminDate,
              valid: true
          });
          
          iterations++;
      }
  });

  return forecast;
};

export const runGapAnalysis = (patient: PatientProfile, history: VaccineDose[], allRules: ImmunizationRulesMap): VaccineSeriesStatus[] => {
  return Object.keys(allRules).map((series) => 
    evaluateSeries(patient, history, series, allRules)
  );
};

/**
 * Optimizes a list of forecast doses into grouped visits to minimize office trips.
 * Groups doses due within a tight window (e.g. 5 days) into a single visit,
 * aligning the visit date to the LATEST eligible date in the group to ensure compliance.
 */
export const groupForecastIntoVisits = (forecast: ForecastDose[]): ScheduledVisit[] => {
  if (forecast.length === 0) return [];

  // Sort by date ASC
  const sorted = [...forecast].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const visits: ScheduledVisit[] = [];
  let currentVisit: ScheduledVisit | null = null;

  // Threshold to group visits (e.g., 7 days) to minimize trips.
  // Real-world logic: Parents prefer coming once even if it means waiting 5 days for the next shot to be eligible.
  const GROUPING_THRESHOLD_DAYS = 7;

  for (const dose of sorted) {
    if (!currentVisit) {
      currentVisit = { visitDate: dose.dueDate, doses: [dose] };
      continue;
    }

    const diffDays = Math.abs(differenceInDays(dose.dueDate, currentVisit.visitDate));

    if (diffDays <= GROUPING_THRESHOLD_DAYS) {
        // Add to current visit
        currentVisit.doses.push(dose);
        // The visit date must be the LATEST of the group to ensure all are eligible.
        // We cannot give a vaccine before its minimum age/interval.
        if (isAfter(dose.dueDate, currentVisit.visitDate)) {
            currentVisit.visitDate = dose.dueDate;
        }
    } else {
        // Finalize previous visit
        visits.push(currentVisit);
        // Start new
        currentVisit = { visitDate: dose.dueDate, doses: [dose] };
    }
  }

  if (currentVisit) {
    visits.push(currentVisit);
  }

  return visits;
};