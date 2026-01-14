import React from 'react';
import { PatientProfile, ScheduledVisit } from '../types';
import { Calendar, Printer, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface CatchUpCalendarProps {
  patient: PatientProfile;
  visits: ScheduledVisit[];
  onClose: () => void;
}

const CatchUpCalendar: React.FC<CatchUpCalendarProps> = ({ patient, visits, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const today = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm print:bg-white print:p-0 print:block">
      {/* Modal Container */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:shadow-none print:w-full print:max-w-none print:h-auto print:max-h-none print:rounded-none">
        
        {/* Modal Header (Screen Only) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden bg-slate-50 rounded-t-lg">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar className="text-emerald-500" />
            <h2 className="text-lg font-bold">Projected Catch-Up Schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors text-sm font-medium shadow-sm"
            >
              <Printer size={16} /> Print Plan
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div id="printable-area" className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
            
            {/* Print Header */}
            <div className="mb-8 border-b-2 border-slate-800 pb-4">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-2xl tracking-tighter mb-1">
                             <ShieldAlert className="text-emerald-500" size={28} /> VaxCheck
                        </div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Immunization Intelligence</div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-light text-slate-400">Catch-Up Plan</div>
                        <div className="text-sm font-mono text-slate-600">Generated: {today.toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            {/* Patient Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-8 flex justify-between print:bg-white print:border-slate-300">
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">Patient Name</div>
                    <div className="text-lg font-bold text-slate-900">{patient.name}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">Date of Birth</div>
                    <div className="text-lg text-slate-900 font-mono">{patient.dob.toLocaleDateString()}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">MRN / ID</div>
                    <div className="text-lg text-slate-900 font-mono">{patient.id}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">Sex</div>
                    <div className="text-lg text-slate-900">{patient.sex}</div>
                </div>
            </div>

            {/* Schedule List */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                     <h3 className="text-lg font-bold text-slate-800">Proposed Appointment Schedule</h3>
                     <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">
                        {visits.length} Visits Identified
                     </span>
                </div>
                
                {visits.length === 0 ? (
                     <div className="p-8 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                        <p>No catch-up doses needed based on current forecast logic.</p>
                     </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {visits.map((visit, idx) => (
                            <div key={idx} className="flex border border-slate-200 rounded-lg overflow-hidden break-inside-avoid shadow-sm print:shadow-none print:border-slate-300">
                                {/* Date Column */}
                                <div className="bg-slate-100 w-32 p-4 flex flex-col justify-center items-center text-center border-r border-slate-200 print:bg-slate-50">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Visit {idx + 1}</div>
                                    <div className="text-2xl font-bold text-slate-800 leading-none mt-1">
                                        {visit.visitDate.getDate()}
                                    </div>
                                    <div className="text-sm font-semibold text-slate-600 uppercase">
                                        {visit.visitDate.toLocaleString('default', { month: 'short' })}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 font-mono">
                                        {visit.visitDate.getFullYear()}
                                    </div>
                                </div>
                                
                                {/* Vaccine List */}
                                <div className="flex-1 p-4 bg-white">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b border-slate-100 pb-1">Vaccines to Administer</h4>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                        {visit.doses.map((dose, dIdx) => (
                                            <div key={dIdx} className="flex items-center gap-2 text-sm text-slate-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span className="font-semibold">{dose.seriesName}</span>
                                                <span className="text-slate-500">Dose {dose.doseNumber}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Disclaimer Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed text-justify">
                <p className="font-bold mb-1">CLINICAL DISCLAIMER:</p>
                <p>
                    This report is generated by the VaxCheck Clinical Decision Support System based on CDSi v4.6 logic specifications. 
                    It serves as a proposal to optimize appointment scheduling by grouping future doses. 
                    All dates shown represent the earliest calculated eligibility date for the grouped appointment; vaccines may be administered after this date but not before. 
                    Providers must verify eligibility at the point of care.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CatchUpCalendar;