import React from 'react';
import { PatientProfile } from '../types';
import { getAgeInMonths } from '../services/logicService';
import { User, AlertCircle } from 'lucide-react';

interface PatientHeaderProps {
  patient: PatientProfile;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({ patient }) => {
  // Use Math.round to get nearest whole month as per requirements
  const rawAgeMonths = getAgeInMonths(patient.dob);
  const totalMonths = Math.round(rawAgeMonths);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  // Mock data for realism
  const mrn = patient.id.replace(/-/, '') + '01'; 

  return (
    <div className="bg-white border-b border-slate-300 px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm sticky top-0 z-20">
      {/* Left: Patient Demographics */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-lg">
          {patient.name?.charAt(0) || 'P'}
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
            <span className="text-sm font-mono text-slate-500">MRN: {mrn}</span>
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-3 mt-1 font-medium">
            <span className="flex items-center gap-1"><User size={12}/> {patient.sex}</span>
            <span>|</span>
            <span>{patient.dob.toLocaleDateString()} ({years}y {months}m)</span>
          </div>
        </div>
      </div>
      
      {/* Right: Clinical Alerts */}
      <div className="mt-2 md:mt-0 flex flex-col items-end gap-1">
        <div className="flex gap-2">
            {patient.conditions.length > 0 || patient.medications.length > 0 ? (
                <>
                     {patient.conditions.map(c => (
                        <div key={c} className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wide">
                            <AlertCircle size={10} /> {c}
                        </div>
                    ))}
                    {patient.medications.map(m => (
                        <div key={m} className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wide">
                            Rx: {m}
                        </div>
                    ))}
                </>
            ) : (
                <span className="text-xs text-slate-400 font-medium italic">No Known Allergies / Alerts</span>
            )}
        </div>
      </div>
    </div>
  );
};

export default PatientHeader;