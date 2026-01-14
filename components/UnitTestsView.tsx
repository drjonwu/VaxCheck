
import React, { useState } from 'react';
import { runAllTests, TestResult } from '../services/testRunner';
import { CheckCircle, XCircle, Play, FlaskConical, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const UnitTestsView: React.FC = () => {
  // Initialize synchronously to ensure tests are visible immediately on mount
  const [results, setResults] = useState<TestResult[]>(() => runAllTests());
  const [isRunning, setIsRunning] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleRun = async () => {
    setIsRunning(true);
    // Add artificial delay to provide visual feedback that "work is happening"
    await new Promise(resolve => setTimeout(resolve, 600));
    const res = runAllTests();
    setResults(res);
    setIsRunning(false);
  };

  const toggleExpand = (id: string) => {
      const newSet = new Set(expandedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setExpandedIds(newSet);
  };

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.length - passCount;

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical className="text-emerald-500" />
              Logic Verification Suite
            </h1>
            <p className="text-slate-500 mt-1">Live unit tests verifying CDSi logic compliance (Grace Periods, Intervals, Conflicts).</p>
          </div>
          <button 
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded hover:bg-slate-700 transition-colors font-semibold shadow-sm disabled:opacity-70 disabled:cursor-wait"
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            {isRunning ? 'Running...' : 'Re-Run Tests'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><FlaskConical size={20}/></div>
                <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Total Tests</div>
                    <div className="text-2xl font-bold text-slate-900">{results.length}</div>
                </div>
            </div>
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-full"><CheckCircle size={20}/></div>
                <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Passed</div>
                    <div className="text-2xl font-bold text-emerald-600">{passCount}</div>
                </div>
            </div>
            <div className={`bg-white p-4 rounded border shadow-sm flex items-center gap-3 ${failCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className={`p-2 rounded-full ${failCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                    {failCount > 0 ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>}
                </div>
                <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Failed</div>
                    <div className={`text-2xl font-bold ${failCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>{failCount}</div>
                </div>
            </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {results.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                  <FlaskConical size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No tests found.</p>
              </div>
          )}
          {results.map((result) => (
            <div 
                key={result.testId} 
                onClick={() => toggleExpand(result.testId)}
                className={`bg-white rounded border overflow-hidden transition-all cursor-pointer group hover:shadow-md ${result.passed ? 'border-slate-200' : 'border-red-300 shadow-sm'}`}
            >
              <div className="p-4 flex items-start gap-4">
                <div className="mt-1 flex-shrink-0">
                  {result.passed ? (
                    <CheckCircle className="text-emerald-500" size={24} />
                  ) : (
                    <XCircle className="text-red-500" size={24} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800">{result.testCase.name}</h3>
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{result.testId}</span>
                    </div>
                    <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
                        {expandedIds.has(result.testId) ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{result.testCase.description}</p>
                  
                  {/* Collapsible Detail View */}
                  {expandedIds.has(result.testId) && (
                      <div className="mt-3 animate-in slide-in-from-top-1 duration-200">
                        {!result.passed && (
                            <div className="p-3 bg-red-50 rounded border border-red-100 text-sm">
                            <div className="font-semibold text-red-800 mb-1">Assertion Failed:</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-xs text-red-600 uppercase font-bold">Expected Dose Count</span>
                                    <span className="font-mono text-red-900">{result.testCase.expectedDoseCount}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-red-600 uppercase font-bold">Actual Dose Count</span>
                                    <span className="font-mono text-red-900">{result.actualDoseCount}</span>
                                </div>
                            </div>
                            <div className="mt-2 text-red-800 border-t border-red-200 pt-2 text-xs font-mono">
                                Engine Logic: {result.reason}
                            </div>
                            </div>
                        )}

                        {result.passed && (
                            <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="font-bold text-slate-600 uppercase text-[10px] mr-2">Success Trace:</span>
                                {result.reason}
                            </div>
                        )}
                        
                        <div className="mt-2 text-xs text-slate-400">
                            Patient: {result.testCase.patient.name} | Target: {result.testCase.targetSeries}
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UnitTestsView;
