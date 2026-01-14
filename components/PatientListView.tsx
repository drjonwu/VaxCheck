import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { ChevronRight, AlertCircle, CheckCircle2, AlertTriangle, ShieldAlert, StickyNote, Loader2 } from 'lucide-react';

const PatientListView: React.FC = () => {
  const patients = useAppStore(state => state.getFilteredPatients());
  const populationStats = useAppStore(state => state.populationStats);
  const onSelectPatient = useAppStore(state => state.setSelectedPatientId);
  const onUpdateNote = useAppStore(state => state.updatePatientNote);

  const getAgeDisplay = (dob: Date) => {
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - dob.getTime());
    const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    
    if (diffMonths < 24) return `${diffMonths}m`;
    return `${Math.floor(diffMonths / 12)}y ${diffMonths % 12}m`;
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Patient List</h1>
                <p className="text-slate-500 mt-1">Manage patient records and view immunization compliance summaries.</p>
            </div>
            <div className="bg-white px-4 py-2 rounded border border-slate-200 text-sm font-medium text-slate-600 shadow-sm">
                Total Patients: <span className="font-bold text-slate-900">{patients.length}</span>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <th className="px-6 py-4">Patient Identity</th>
                        <th className="px-6 py-4">Demographics</th>
                        <th className="px-6 py-4">Clinical Alerts</th>
                        <th className="px-6 py-4">Compliance Status</th>
                        <th className="px-6 py-4 w-64">Clinical Notes</th>
                        <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {patients.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                No patients found matching your search.
                            </td>
                        </tr>
                    ) : (
                        patients.map((p) => {
                            const stats = populationStats[p.profile.id];
                            const age = getAgeDisplay(p.profile.dob);

                            return (
                                <tr 
                                    key={p.profile.id} 
                                    onClick={() => onSelectPatient(p.profile.id)}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                                {p.profile.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{p.profile.name}</div>
                                                <div className="text-xs font-mono text-slate-400 whitespace-nowrap">ID: {p.profile.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col text-sm text-slate-600">
                                            <span className="font-medium">{age} old</span>
                                            <span className="text-xs text-slate-400">{p.profile.sex === 'M' ? 'Male' : 'Female'} • {p.profile.dob.toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {p.profile.conditions.length > 0 ? (
                                                p.profile.conditions.map(c => (
                                                    <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold uppercase border border-red-100">
                                                        <AlertCircle size={10} /> {c}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">None</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {stats ? (
                                            <>
                                                <div className="flex gap-3 text-xs font-medium">
                                                    <div className={`flex items-center gap-1 ${stats.overdue > 0 ? 'text-red-700 font-bold' : 'text-slate-300'}`} title="Overdue Series">
                                                        <ShieldAlert size={14} /> {stats.overdue}
                                                    </div>
                                                    <div className={`flex items-center gap-1 ${stats.dueNow > 0 ? 'text-amber-700 font-bold' : 'text-slate-300'}`} title="Due Now">
                                                        <AlertTriangle size={14} /> {stats.dueNow}
                                                    </div>
                                                    <div className={`flex items-center gap-1 ${stats.complete > 0 ? 'text-emerald-700' : 'text-slate-300'}`} title="Up to Date">
                                                        <CheckCircle2 size={14} /> {stats.complete}
                                                    </div>
                                                </div>
                                                {/* Mini progress bar with Accessibility */}
                                                <div 
                                                    className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden flex"
                                                    role="img"
                                                    aria-label={`Compliance Summary: ${stats.complete} complete, ${stats.dueNow} due now, ${stats.overdue} overdue out of ${stats.total} total series.`}
                                                >
                                                    <div style={{ width: `${(stats.complete / stats.total) * 100}%` }} className="bg-emerald-600 h-full" />
                                                    <div style={{ width: `${(stats.dueNow / stats.total) * 100}%` }} className="bg-amber-600 h-full" />
                                                    <div style={{ width: `${(stats.overdue / stats.total) * 100}%` }} className="bg-red-600 h-full" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                                                <Loader2 size={12} className="animate-spin" /> Calculating...
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative group/note">
                                            <StickyNote size={14} className="absolute top-2 left-2 text-yellow-600/50 pointer-events-none" />
                                            <textarea
                                                className="w-full text-xs bg-yellow-50 focus:bg-yellow-100 border border-yellow-100 focus:border-yellow-300 rounded p-2 pl-7 min-h-[60px] resize-none focus:outline-none transition-colors placeholder:text-yellow-600/40 text-slate-700 leading-tight shadow-sm"
                                                placeholder="Add clinical note..."
                                                value={p.profile.notes || ''}
                                                onChange={(e) => onUpdateNote(p.profile.id, e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-300">
                                        <ChevronRight size={18} className="group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default PatientListView;