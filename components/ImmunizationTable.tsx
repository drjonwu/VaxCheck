import React from 'react';
import { VaccineSeriesStatus, VaxStatus, ForecastDose, PatientProfile, VaccineDose } from '../types';
import { Sparkles, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, ShieldAlert, X, FileText, CalendarClock, Ruler, Bot } from 'lucide-react';
import { ExplanationMarkdown } from './ExplanationMarkdown';

interface ImmunizationTableProps {
  patient: PatientProfile;
  history: VaccineDose[];
  gapAnalysis: VaccineSeriesStatus[];
  forecast: ForecastDose[];
  onExplain: (item: VaccineSeriesStatus) => void;
  explanation: Record<string, string>;
  generating: string | null;
  expandedRow: string | null;
  onToggleRow: (seriesName: string) => void;
}

const ImmunizationTable: React.FC<ImmunizationTableProps> = ({ 
    patient,
    history,
    gapAnalysis, 
    forecast,
    onExplain, 
    explanation, 
    generating,
    expandedRow,
    onToggleRow 
}) => {
  
  return (
    <div className="bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden text-sm">
      <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center">
        <h3 className="font-bold text-slate-700 uppercase tracking-wider text-xs">CDSi Logic Evaluation</h3>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs font-semibold uppercase">
            <th className="px-4 py-2 w-8"></th>
            <th className="px-4 py-2">Vaccine Series</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-center">Doses</th>
            <th className="px-4 py-2">Next Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {gapAnalysis.map((item) => {
             // Get forecast for this series
             const seriesForecast = forecast.filter(f => f.seriesName === item.seriesName);

             return (
            <React.Fragment key={item.seriesName}>
              <tr 
                id={`row-${item.seriesName}`}
                className={`hover:bg-blue-50 transition-colors cursor-pointer ${expandedRow === item.seriesName ? 'bg-blue-50/50' : ''}`}
                onClick={() => onToggleRow(item.seriesName)}
              >
                <td className="px-4 py-3 text-slate-400">
                  {expandedRow === item.seriesName ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{item.seriesName}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{item.dosesAdministered}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">
                  {item.nextDoseDue ? item.nextDoseDue.toLocaleDateString() : 'N/A'}
                </td>
              </tr>
              
              {/* Expanded Detail Row */}
              {expandedRow === item.seriesName && (
                <tr className="bg-slate-50/50">
                    <td colSpan={5} className="px-4 py-0">
                        <div className="border-l-2 border-blue-200 ml-4 my-2 pl-4 py-2 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col xl:flex-row gap-6">
                                {/* Hard Logic Section */}
                                <div className="flex-1 min-w-[300px]">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5 tracking-wider">
                                        <FileText size={12}/> CDS Logic Trace
                                    </h4>
                                    <div className="text-slate-700 bg-white border border-slate-200 p-4 rounded-lg shadow-sm text-xs font-mono leading-relaxed">
                                        <div className="mb-3 pb-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1">Reasoning</span>
                                            {item.reason}
                                        </div>
                                        
                                        {/* Rule Details */}
                                        {item.ruleApplied && (
                                            <div className="mb-3 pb-3 border-b border-slate-100">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                                                     <Ruler size={10} /> Active Logic Constraints
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 font-mono">
                                                    <div>Target Dose: <span className="font-bold text-slate-800">{item.ruleApplied.doseNumber}</span></div>
                                                    
                                                    {/* Min Age */}
                                                    {item.ruleApplied.minAgeWeeks !== undefined ? (
                                                         <div>Min Age: {item.ruleApplied.minAgeWeeks} weeks</div>
                                                    ) : item.ruleApplied.minAgeMonths !== undefined ? (
                                                         <div>Min Age: {item.ruleApplied.minAgeMonths} months</div>
                                                    ) : null}

                                                    {/* Min Interval (Prev) */}
                                                    {item.ruleApplied.minIntervalWeeks !== undefined && (
                                                        <div>Min Interval: {item.ruleApplied.minIntervalWeeks} weeks (prev)</div>
                                                    )}

                                                     {/* Min Interval (Dose 1) */}
                                                    {item.ruleApplied.minIntervalWeeksFromDose1 !== undefined && (
                                                        <div>Min Interval: {item.ruleApplied.minIntervalWeeksFromDose1} weeks (Dose 1)</div>
                                                    )}
                                                     
                                                     {/* Max Age */}
                                                     {item.ruleApplied.maxAgeWeeks !== undefined ? (
                                                         <div className="text-amber-600">Max Age: {item.ruleApplied.maxAgeWeeks} weeks</div>
                                                    ) : item.ruleApplied.maxAgeMonths !== undefined ? (
                                                         <div className="text-amber-600">Max Age: {item.ruleApplied.maxAgeMonths} months</div>
                                                    ) : null}
                                                    
                                                     {/* Recurring */}
                                                     {item.ruleApplied.isRecurring && (
                                                         <div className="text-blue-600 italic">Recurring Interval</div>
                                                     )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Future Forecast Logic */}
                                        <div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                                                <CalendarClock size={10} /> Projected Schedule
                                            </div>
                                            {seriesForecast.length > 0 ? (
                                                <ul className="space-y-1">
                                                    {seriesForecast.map(f => (
                                                        <li key={f.doseNumber} className="flex justify-between text-slate-600">
                                                            <span>Dose {f.doseNumber}</span>
                                                            <span className="font-bold text-slate-800">Due {f.dueDate.toLocaleDateString()}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-slate-400 italic">No future doses projected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* AI Section */}
                                <div className="flex-1 min-w-[300px]">
                                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase mb-2 flex items-center gap-1.5 tracking-wider">
                                        <Bot size={12} className="text-indigo-500"/> AI Clinical Explanation
                                    </h4>
                                    
                                    {explanation[item.seriesName] ? (
                                        <div className="animate-in fade-in duration-500 bg-indigo-50/50 rounded-lg p-4 border border-indigo-100">
                                            <ExplanationMarkdown text={explanation[item.seriesName]} />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3 items-start p-6 bg-indigo-50/30 border border-indigo-100 rounded-lg border-dashed h-full justify-center">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-full border border-indigo-100 shadow-sm text-indigo-500">
                                                    <Sparkles size={16} />
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    <p className="font-semibold text-slate-700">Need clinical context?</p>
                                                    <p>Generate a reasoning summary for this status.</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onExplain(item);
                                                }}
                                                disabled={generating === item.seriesName}
                                                className="mt-2 text-xs font-semibold flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-70"
                                            >
                                                {generating === item.seriesName ? (
                                                    <>
                                                        <Sparkles size={12} className="animate-spin" /> Analyzing Clinical Data...
                                                    </>
                                                ) : (
                                                    <>
                                                        Generate Explanation
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
              )}
            </React.Fragment>
          );})}
        </tbody>
      </table>
    </div>
  );
};

const StatusBadge = ({ status }: { status: VaxStatus }) => {
  const config = {
    [VaxStatus.COMPLETE]: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle, label: 'Complete' },
    [VaxStatus.UP_TO_DATE]: { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Up to Date' },
    [VaxStatus.DUE_NOW]: { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle, label: 'Due Now' },
    [VaxStatus.OVERDUE]: { color: 'text-red-700 bg-red-50 border-red-200', icon: ShieldAlert, label: 'Overdue' },
    [VaxStatus.FUTURE]: { color: 'text-slate-600 bg-slate-50 border-slate-200', icon: Clock, label: 'Scheduled' },
    [VaxStatus.CONTRAINDICATED]: { color: 'text-purple-700 bg-purple-50 border-purple-200', icon: X, label: 'Contraindicated' },
  };

  const { color, icon: Icon, label } = config[status];

  return (
    <span className={`px-2 py-0.5 rounded-sm border text-[11px] font-bold uppercase flex items-center w-fit gap-1.5 ${color}`}>
      <Icon size={10} strokeWidth={3} />
      {label}
    </span>
  );
}

export default ImmunizationTable;
