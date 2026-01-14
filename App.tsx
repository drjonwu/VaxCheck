import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PatientRecord, VaccineSeriesStatus, ForecastDose, VaccineDose, ScheduledVisit, PopulationStats, VaxStatus } from './types';
import { streamClinicalExplanation, streamPopulationHealthSummary, ScannedDose } from './services/geminiService';
import { downloadFhirBundle } from './services/fhirAdapter';
import { useImmunizationWorker } from './hooks/useImmunizationWorker';
import { useAppStore } from './stores/useAppStore'; // Store import
import { runGapAnalysis } from './services/logicService';

import PatientHeader from './components/PatientHeader';
import VaccineTimeline from './components/VaccineTimeline';
import ImmunizationTable from './components/ImmunizationTable';
import CatchUpCalendar from './components/CatchUpCalendar';
import UnitTestsView from './components/UnitTestsView';
import VaccineCardScanner from './components/VaccineCardScanner';
import PatientListView from './components/PatientListView';
import RulesConfigView from './components/RulesConfigView'; // NEW IMPORT
import { ExplanationMarkdown } from './components/ExplanationMarkdown';

import { 
  ShieldAlert, 
  LayoutDashboard, 
  Settings, 
  Search,
  Users,
  Sliders,
  Activity,
  CheckCircle2,
  Server,
  Calendar,
  FlaskConical,
  Camera,
  Download,
  Globe,
  Loader2,
  Filter,
  Eye,
  Sparkles,
  FileJson
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const App: React.FC = () => {
  // --- ZUSTAND STATE SELECTION ---
  const currentView = useAppStore(state => state.currentView);
  const setCurrentView = useAppStore(state => state.setCurrentView);
  const selectedPatientId = useAppStore(state => state.selectedPatientId);
  const setSelectedPatientId = useAppStore(state => state.setSelectedPatientId);
  const searchQuery = useAppStore(state => state.searchQuery);
  const setSearchQuery = useAppStore(state => state.setSearchQuery);
  const patients = useAppStore(state => state.patients);
  const activeRules = useAppStore(state => state.activeRules);
  const rulesSource = useAppStore(state => state.rulesSource);
  const filteredPatients = useAppStore(state => state.getFilteredPatients());
  const currentPatient = useAppStore(state => state.getCurrentPatient());
  const setPopulationStats = useAppStore(state => state.setPopulationStats);
  const addDosesToPatient = useAppStore(state => state.addDosesToPatient);

  // --- LOCAL UI STATE (Ephemeral) ---
  const [explanation, setExplanation] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showCatchUpModal, setShowCatchUpModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showAllSeries, setShowAllSeries] = useState(false);
  
  // --- ASYNC WORKER INTEGRATION ---
  // Note: These computed results are tied to the UI render cycle so we keep them local to App
  // but fed by the Store data.
  const { analyzePatient, analyzePopulation, isComputing } = useImmunizationWorker();
  
  const [gapAnalysis, setGapAnalysis] = useState<VaccineSeriesStatus[]>([]);
  const [forecast, setForecast] = useState<ForecastDose[]>([]);
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledVisit[]>([]);

  // EFFECT: Run Analysis when Patient or Rules Change
  useEffect(() => {
    let mounted = true;
    analyzePatient(currentPatient, activeRules)
        .then(result => {
            if (mounted) {
                setGapAnalysis(result.gapAnalysis);
                setForecast(result.forecast);
                setScheduledVisits(result.visits);
            }
        })
        .catch(err => console.error("Patient Analysis Failed", err));
    return () => { mounted = false; };
  }, [currentPatient, activeRules, analyzePatient]);

  // EFFECT: Run Population Stats when Patient List or Rules Change
  useEffect(() => {
      let mounted = true;
      analyzePopulation(patients, activeRules)
        .then(stats => {
            if (mounted) setPopulationStats(stats); // Sync to Store
        })
        .catch(err => console.error("Population Analysis Failed", err));
      return () => { mounted = false; };
  }, [patients, activeRules, analyzePopulation, setPopulationStats]);

  // --- FILTERING LOGIC ---
  const filteredGapAnalysis = useMemo(() => {
    if (showAllSeries) return gapAnalysis;

    return gapAnalysis.filter(series => {
        // 1. Always show if patient has history of this vaccine
        const hasHistory = currentPatient.history.some(h => h.vaccineCode === series.seriesName);
        if (hasHistory) return true;

        // 2. Always show if actionable or complete
        if ([VaxStatus.OVERDUE, VaxStatus.DUE_NOW, VaxStatus.UP_TO_DATE, VaxStatus.COMPLETE].includes(series.status)) {
            return true;
        }

        // 3. Hide FUTURE series if they are too far out (e.g. > 10 years away)
        // This hides Zoster (50y) for infants/teens, Pneumo (65y) for adults < 55, etc.
        if (series.status === VaxStatus.FUTURE && series.nextDoseDue) {
             const horizon = new Date();
             horizon.setFullYear(horizon.getFullYear() + 10);
             if (series.nextDoseDue > horizon) return false;
        }

        // 4. Hide CONTRAINDICATED if it is purely Age-based (e.g. Rotavirus for Adults)
        // LogicService returns reasons containing "age ... exceeded" for max age violations.
        if (series.status === VaxStatus.CONTRAINDICATED) {
             if (series.reason?.toLowerCase().includes('age')) return false;
             // Keep medical contraindications (e.g. Immunocompromised)
             return true; 
        }

        return true;
    });
  }, [gapAnalysis, showAllSeries, currentPatient.history]);


  // --- HANDLERS ---

  const handleExplain = useCallback(async (seriesStatus: VaccineSeriesStatus) => {
    setGenerating(seriesStatus.seriesName);
    setExplanation(prev => ({ ...prev, [seriesStatus.seriesName]: '' }));
    
    const seriesForecast = forecast.filter(f => f.seriesName === seriesStatus.seriesName);

    await streamClinicalExplanation(
      currentPatient.profile,
      currentPatient.history,
      seriesStatus,
      seriesForecast,
      (text) => {
        setExplanation(prev => ({
          ...prev,
          [seriesStatus.seriesName]: prev[seriesStatus.seriesName] ? prev[seriesStatus.seriesName] + text : text
        }));
      }
    );
    setGenerating(null);
  }, [currentPatient, forecast]);

  const handleSeriesClick = useCallback((seriesName: string) => {
    setExpandedRow(seriesName);
    setTimeout(() => {
        const element = document.getElementById(`row-${seriesName}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
  }, []);

  const handleRowToggle = useCallback((seriesName: string) => {
    setExpandedRow(prev => prev === seriesName ? null : seriesName);
  }, []);

  const handleOCRData = (scannedDoses: ScannedDose[]) => {
      const newDoses: VaccineDose[] = scannedDoses.map((s, idx) => ({
          id: `scan-${Date.now()}-${idx}`,
          vaccineCode: s.vaccine,
          dateAdministered: new Date(s.date),
          valid: true 
      })).filter(d => !isNaN(d.dateAdministered.getTime()));

      addDosesToPatient(selectedPatientId, newDoses);
  };

  const handleExportFHIR = () => {
      downloadFhirBundle(currentPatient.profile, currentPatient.history, forecast);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      
      {/* 1. Sidebar */}
      <aside className="w-16 md:w-64 bg-slate-900 text-slate-400 flex flex-col flex-shrink-0 z-30 shadow-xl transition-all">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 bg-slate-950 text-emerald-400 font-bold tracking-tighter text-xl gap-2">
           <ShieldAlert size={24} />
           <span className="hidden md:inline text-white">VaxCheck</span>
        </div>
        
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Population Health Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
          />
          <SidebarItem 
            icon={Users} 
            label="Patient List" 
            active={currentView === 'patient-list'} 
            onClick={() => setCurrentView('patient-list')}
          />
          <SidebarItem 
            icon={Sliders} 
            label="Vaccination Guidelines Configuration" 
            active={currentView === 'rules'} 
            onClick={() => setCurrentView('rules')}
          />
          
          <div className="mt-8 px-6 text-xs font-semibold uppercase tracking-wider text-slate-600 hidden md:block">
            Recently Selected Patients
          </div>
          <div className="mt-2 space-y-1">
             {filteredPatients.length === 0 && (
                 <div className="px-6 py-2 text-xs text-slate-500 italic">No matching patients</div>
             )}
             {filteredPatients.map(p => (
                <button 
                  key={p.profile.id}
                  onClick={() => setSelectedPatientId(p.profile.id)}
                  className={`w-full flex items-center gap-3 px-3 md:px-6 py-2 text-sm transition-colors ${
                    currentView === 'patient' && selectedPatientId === p.profile.id 
                    ? 'bg-slate-800 text-white border-r-4 border-emerald-500' 
                    : 'hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                   <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                     {p.profile.name?.charAt(0)}
                   </div>
                   <span className="hidden md:block truncate">{p.profile.name}</span>
                </button>
             ))}
          </div>

          <div className="mt-8 px-6 text-xs font-semibold uppercase tracking-wider text-slate-600 hidden md:block">
            Dev Tools
          </div>
          <div className="mt-2 space-y-1">
             <SidebarItem 
                icon={FlaskConical} 
                label="Run Unit Tests" 
                active={currentView === 'tests'} 
                onClick={() => setCurrentView('tests')}
             />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
           <SidebarItem 
             icon={Settings} 
             label="System Settings" 
             active={currentView === 'settings'}
             onClick={() => setCurrentView('settings')}
           />
        </div>
      </aside>

      {/* 2. Main Layout */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100 h-full relative">
        
        {/* Top Search Bar */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2 w-full max-w-md bg-slate-100 rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-shadow">
                <Search size={16} className="text-slate-400"/>
                <input 
                    type="text" 
                    placeholder="Search patient ID..." 
                    className="bg-transparent border-none text-sm w-full focus:outline-none text-slate-700 placeholder:text-slate-400" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-3">
                 <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-all ${isComputing ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-transparent'}`}>
                     {isComputing && <Loader2 size={12} className="animate-spin" />}
                     {isComputing ? 'Evaluating Logic...' : ''}
                 </div>
                 <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-colors ${
                    rulesSource === 'REMOTE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                    rulesSource === 'CUSTOM' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-500 border-slate-200'
                 }`}>
                     {rulesSource === 'REMOTE' && <Globe size={12} />}
                     {rulesSource === 'LOCAL' && <Server size={12} />}
                     {rulesSource === 'CUSTOM' && <FileJson size={12} />}
                     
                     {rulesSource === 'REMOTE' ? 'Live Config' : rulesSource === 'CUSTOM' ? 'Custom Rules' : 'Local Config'}
                 </div>
            </div>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'patient-list' && <PatientListView />}
            {currentView === 'rules' && <RulesConfigView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'tests' && <UnitTestsView />}
            {currentView === 'patient' && (
                <>
                    <PatientHeader patient={currentPatient.profile} />
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in duration-300">
                        {/* Timeline Panel */}
                        <div className="bg-white p-4 rounded-sm border border-slate-300 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Vaccination History & Forecast</h2>
                                
                                <div className="flex gap-2">
                                     <button 
                                        onClick={() => setShowAllSeries(!showAllSeries)}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase rounded border transition-colors ${showAllSeries ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                        title={showAllSeries ? "Hide irrelevant series" : "Show all supported series"}
                                     >
                                        {showAllSeries ? <Eye size={14} /> : <Filter size={14} />}
                                        {showAllSeries ? 'Show All' : 'Relevant'}
                                     </button>

                                     <button 
                                        onClick={() => setShowScanner(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase rounded shadow-sm transition-colors"
                                     >
                                        <Camera size={14} />
                                        Scan Card
                                     </button>

                                     <button 
                                        onClick={() => setShowCatchUpModal(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold uppercase rounded border border-indigo-200 transition-colors"
                                     >
                                        <Calendar size={14} />
                                        Catch-Up Plan
                                     </button>

                                     <button 
                                        onClick={handleExportFHIR}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase rounded border border-slate-300 transition-colors shadow-sm"
                                        title="Download HL7 FHIR Bundle (R4)"
                                     >
                                        <Download size={14} />
                                        Export FHIR
                                     </button>

                                    <div className="hidden xl:flex flex-wrap gap-4 bg-slate-50 px-3 py-1.5 rounded border border-slate-100 ml-2">
                                        <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <circle cx="10" cy="10" r="9" fill="#059669" />
                                            <path d="M6 10 L9 13 L14 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Given
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <circle cx="10" cy="10" r="9" fill="#d97706" />
                                            <circle cx="10" cy="10" r="3" fill="white" />
                                        </svg>
                                        Due
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <circle cx="10" cy="10" r="9" fill="#dc2626" />
                                            <rect x="9" y="5" width="2" height="6" rx="1" fill="white" />
                                            <circle cx="10" cy="14" r="1.5" fill="white" />
                                        </svg>
                                        Overdue
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                            <circle cx="10" cy="10" r="8" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" fill="white" />
                                        </svg>
                                        Plan
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded border border-slate-200 overflow-hidden relative min-h-[300px]">
                                {filteredGapAnalysis.length > 0 ? (
                                    <VaccineTimeline 
                                        history={currentPatient.history} 
                                        gapAnalysis={filteredGapAnalysis} 
                                        forecast={forecast}
                                        dob={currentPatient.profile.dob}
                                        onSeriesClick={handleSeriesClick}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            {gapAnalysis.length === 0 ? (
                                                <>
                                                    <Loader2 size={24} className="animate-spin" />
                                                    <span className="text-sm font-medium">Evaluating clinical history...</span>
                                                </>
                                            ) : (
                                                <span className="text-sm font-medium">No relevant series found. Try "Show All".</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 pointer-events-none z-30">
                                    <div className="bg-white/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-200 shadow-sm">
                                        Scroll for history →
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Flowsheet */}
                        <ImmunizationTable 
                            patient={currentPatient.profile}
                            history={currentPatient.history}
                            gapAnalysis={filteredGapAnalysis} 
                            forecast={forecast}
                            explanation={explanation}
                            generating={generating}
                            onExplain={handleExplain}
                            expandedRow={expandedRow}
                            onToggleRow={handleRowToggle}
                        />
                    </div>
                </>
            )}
        </div>
      </div>
      
      {/* Catch-Up Modal */}
      {showCatchUpModal && (
        <CatchUpCalendar 
            patient={currentPatient.profile} 
            visits={scheduledVisits}
            onClose={() => setShowCatchUpModal(false)}
        />
      )}

      {/* OCR Scanner Modal */}
      {showScanner && (
        <VaccineCardScanner 
            onClose={() => setShowScanner(false)}
            onSave={handleOCRData}
            availableCodes={Object.keys(activeRules)}
            patientDOB={currentPatient.profile.dob} // PASS DOB FOR VALIDATION
        />
      )}
    </div>
  );
};

// --- SUB-VIEWS (Connected to Store) ---

const DashboardView = () => {
    const patients = useAppStore(state => state.patients);
    const activeRules = useAppStore(state => state.activeRules);
    const populationStats = useAppStore(state => state.populationStats);
    
    // AI Insights State
    const [aiSummary, setAiSummary] = useState('');
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    const stats = React.useMemo(() => {
        let overdueCount = 0;
        let upToDateCount = 0;
        let totalSeries = 0;
        
        Object.values(populationStats).forEach((pStats: PopulationStats) => {
            overdueCount += pStats.overdue;
            if (pStats.overdue === 0 && pStats.dueNow === 0) {
                upToDateCount++; 
            }
            totalSeries += pStats.total;
        });

        const totalP = patients.length || 1; 
        return { overdueCount, upToDateCount, totalP, totalSeries };
    }, [patients, populationStats]);

    // Compute Chart Data: Aggregation by Series
    const chartData = useMemo(() => {
        const dataMap: Record<string, { name: string; Compliant: number; DueNow: number; Overdue: number }> = {};
        
        // Initialize with keys from activeRules
        Object.keys(activeRules).forEach(series => {
            dataMap[series] = { name: series, Compliant: 0, DueNow: 0, Overdue: 0 };
        });

        patients.forEach(p => {
             const analysis = runGapAnalysis(p.profile, p.history, activeRules);
             analysis.forEach(series => {
                 if (!dataMap[series.seriesName]) return;
                 
                 if (series.status === VaxStatus.COMPLETE || series.status === VaxStatus.UP_TO_DATE) {
                     dataMap[series.seriesName].Compliant++;
                 } else if (series.status === VaxStatus.DUE_NOW) {
                     dataMap[series.seriesName].DueNow++;
                 } else if (series.status === VaxStatus.OVERDUE) {
                     dataMap[series.seriesName].Overdue++;
                 }
             });
        });

        // Filter to series that have at least one relevant data point to reduce noise
        return Object.values(dataMap)
            .filter(d => d.Compliant + d.DueNow + d.Overdue > 0)
            .sort((a,b) => (b.Overdue + b.DueNow) - (a.Overdue + a.DueNow)); // Sort by urgency
    }, [patients, activeRules]);

    const isLoaded = Object.keys(populationStats).length > 0;

    const handleGenerateSummary = useCallback(async () => {
        if (isGeneratingSummary) return; // Prevent double firing
        setIsGeneratingSummary(true);
        setAiSummary('');
        try {
            await streamPopulationHealthSummary(chartData, patients.length, (text) => {
                setAiSummary(prev => prev + text);
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingSummary(false);
        }
    }, [chartData, patients.length, isGeneratingSummary]);

    // Auto-trigger analysis when data is loaded or patients change
    useEffect(() => {
        if (isLoaded) {
            handleGenerateSummary();
        }
    }, [isLoaded, patients.length]);

    // Enhanced Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
            return (
                <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-xs z-50 min-w-[180px]">
                    <p className="font-bold text-slate-800 mb-2 pb-2 border-b border-slate-100">{label}</p>
                    {/* Reverse to match visual stack order (Top: Overdue -> Bottom: Compliant) */}
                    {payload.slice().reverse().map((entry: any, index: number) => ( 
                        <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-600 font-medium">{entry.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{entry.value}</span>
                                <span className="text-slate-400 w-8 text-right font-mono">
                                    {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    ))}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Total Patients</span>
                        <span className="font-bold text-slate-800 text-sm">{total}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-8 overflow-y-auto h-full flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                Population Health Dashboard
                {!isLoaded && <Loader2 size={20} className="animate-spin text-slate-400" />}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 flex-shrink-0">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Active Patients</p>
                            <p className="text-2xl font-bold text-slate-900">{patients.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Patients Compliant</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {isLoaded ? stats.upToDateCount : '-'} 
                                <span className="text-sm font-normal text-slate-400 ml-1">/ {stats.totalP}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-full text-red-600">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Overdue Doses</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {isLoaded ? stats.overdueCount : '-'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Card */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex-1 min-h-[500px] flex flex-col mb-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                         <h3 className="text-lg font-bold text-slate-800">Vaccination Compliance by Series</h3>
                         <p className="text-xs text-slate-500">Population-level breakdown of immunization status.</p>
                    </div>
                </div>
                
                <div className="flex-1 w-full min-h-0">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            layout="vertical" 
                            data={chartData} 
                            margin={{ top: 10, right: 30, left: 0, bottom: 30 }} 
                            barSize={32}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis 
                                type="number" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#94a3b8', fontSize: 11}} 
                                label={{ value: "Number of Patients", position: "insideBottom", offset: -10, fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                            />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#475569', fontSize: 11, fontWeight: 600}} 
                                width={110} 
                                interval={0} 
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                            <Legend 
                                iconType="circle" 
                                wrapperStyle={{paddingTop: '20px', fontSize: '12px', fontFamily: 'Inter', fontWeight: 500}} 
                                formatter={(value) => <span className="text-slate-600 ml-1">{value}</span>}
                            />
                            {/* Uses 600-scale colors for better contrast and match Timeline markers */}
                            <Bar name="Compliant" dataKey="Compliant" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                            <Bar name="Due Now" dataKey="DueNow" stackId="a" fill="#d97706" radius={[0, 0, 0, 0]} />
                            <Bar name="Overdue" dataKey="Overdue" stackId="a" fill="#dc2626" radius={[0, 0, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100 shadow-sm relative overflow-hidden flex-shrink-0">
                <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-200 text-indigo-700 rounded-lg">
                              <Sparkles size={20} />
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-indigo-900">AI Population Insights</h3>
                              <p className="text-xs text-indigo-700/80">Automated analysis of vaccination trends and risk factors.</p>
                          </div>
                     </div>
                     {!isGeneratingSummary && (
                          <button 
                             onClick={handleGenerateSummary}
                             disabled={!isLoaded || isGeneratingSummary}
                             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Sparkles size={14} /> Regenerate Analysis
                          </button>
                     )}
                </div>
                
                {(aiSummary || isGeneratingSummary) ? (
                    <div className="bg-white/60 rounded border border-indigo-100 p-4 text-sm text-slate-800 leading-relaxed shadow-sm animate-in fade-in duration-500">
                        <ExplanationMarkdown text={aiSummary} />
                        {isGeneratingSummary && (
                            <span className="inline-block ml-1 animate-pulse text-indigo-500">▋</span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-indigo-500 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Generating initial insights...
                    </div>
                )}
            </div>
        </div>
    );
};

const SettingsView = () => {
    return (
        <div className="p-8 overflow-y-auto h-full bg-slate-50">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">System Settings</h1>
            
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-semibold text-slate-700">Application Information</h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500">System Name</label>
                            <div className="mt-1 text-slate-900 font-medium">VaxCheck CDSi Engine</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500">Version</label>
                            <div className="mt-1 text-slate-900 font-mono text-sm">v1.2.0 (Zustand Store)</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500">Logic Engine</label>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                    Async Worker
                                </span>
                                <span className="text-slate-700 text-sm">Multi-threaded Calculation</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500">AI Model</label>
                            <div className="mt-1 text-slate-900">Gemini 2.5 Flash (Privacy Mode)</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-semibold text-slate-700">Environment</h2>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-sm">
                        <Server size={16} />
                        <span>Running in client-side demonstration mode. No PHI is persisted.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SidebarItem = ({ 
    icon: Icon, 
    label, 
    active = false, 
    onClick 
}: { 
    icon: any, 
    label: string, 
    active?: boolean, 
    onClick?: () => void 
}) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 md:px-6 py-3 cursor-pointer transition-colors text-left ${
            active 
            ? 'bg-slate-800 text-white border-l-4 border-emerald-400' 
            : 'hover:bg-slate-800 hover:text-white border-l-4 border-transparent'
        }`}
    >
        <Icon size={20} />
        <span className="hidden md:inline text-sm font-medium">{label}</span>
    </button>
);

export default App;
