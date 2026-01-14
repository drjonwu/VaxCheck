import React, { useState, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { fetchRemoteRules, parseRules, exportRules } from '../services/rulesService';
import { Globe, Server, Code, RefreshCw, Upload, Download, FileJson, AlertCircle, CheckCircle } from 'lucide-react';

const RulesConfigView: React.FC = () => {
    const rules = useAppStore(state => state.activeRules);
    const source = useAppStore(state => state.rulesSource);
    const setActiveRules = useAppStore(state => state.setActiveRules);
    const resetRules = useAppStore(state => state.resetRules);
    const importRules = useAppStore(state => state.importRules);
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSimulateUpdate = async () => {
        setIsUpdating(true);
        setUploadError(null);
        setUploadSuccess(null);
        try {
            const newRules = await fetchRemoteRules();
            setActiveRules(newRules, 'REMOTE');
            setUploadSuccess('Successfully synced with remote policy server.');
        } catch (e) {
            console.error(e);
            setUploadError('Failed to fetch remote rules.');
        }
        setIsUpdating(false);
    };

    const handleDownload = () => {
        const json = exportRules(rules);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vaxcheck-rules-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        setUploadSuccess(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const parsed = parseRules(json);
                importRules(parsed);
                setUploadSuccess(`Successfully imported ${Object.keys(parsed).length} vaccine series definitions.`);
            } catch (err: any) {
                setUploadError(err.message || "Invalid JSON file");
            }
        };
        reader.readAsText(file);
        
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="p-8 overflow-y-auto h-full bg-slate-50">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Vaccination Guidelines Configuration</h1>
                    <p className="text-slate-500 mt-1">Manage Clinical Decision Support (CDSi) Logic Logic Rules</p>
                </div>
                <div className="flex items-center gap-2">
                    {source !== 'LOCAL' && (
                         <button 
                            onClick={() => {
                                resetRules();
                                setUploadSuccess('Reset to factory defaults.');
                                setUploadError(null);
                            }}
                            className="px-4 py-2 bg-white text-slate-700 font-medium text-sm rounded border border-slate-300 shadow-sm hover:bg-slate-50"
                        >
                            Reset to Default
                        </button>
                    )}
                </div>
            </div>

            {/* Status Messages */}
            {uploadError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {uploadError}
                </div>
            )}
            {uploadSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle size={16} /> {uploadSuccess}
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                 {/* Left Column: Actions */}
                 <div className="lg:col-span-1 space-y-4">
                     <div className={`p-4 rounded border transition-colors ${
                         source === 'REMOTE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                         source === 'CUSTOM' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                         'bg-white border-slate-200'
                     }`}>
                         <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Active Source</div>
                         <div className="font-bold text-lg flex items-center gap-2">
                             {source === 'REMOTE' && <Globe size={20}/>}
                             {source === 'LOCAL' && <Server size={20}/>}
                             {source === 'CUSTOM' && <FileJson size={20}/>}
                             
                             {source === 'REMOTE' ? 'Remote Server' : source === 'CUSTOM' ? 'Custom Upload' : 'Local Fallback'}
                         </div>
                         <p className="text-xs mt-2 leading-relaxed opacity-80">
                             {source === 'REMOTE' && 'Rules are being served from the remote policy server.'}
                             {source === 'CUSTOM' && 'Running on user-uploaded logic definitions.'}
                             {source === 'LOCAL' && 'Using built-in factory guidelines.'}
                         </p>
                     </div>

                     <div className="bg-white rounded border border-slate-200 p-4 space-y-3">
                         <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Management Actions</div>
                         
                         <button 
                            onClick={handleSimulateUpdate}
                            disabled={isUpdating}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 border border-transparent hover:border-slate-200"
                         >
                            {isUpdating ? <RefreshCw className="animate-spin text-slate-400" size={16}/> : <Globe className="text-indigo-500" size={16}/>}
                            Sync from Remote
                         </button>

                         <button 
                            onClick={handleDownload}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 border border-transparent hover:border-slate-200"
                         >
                            <Download className="text-emerald-500" size={16}/>
                            Export JSON
                         </button>

                         <div className="border-t border-slate-100 my-2"></div>

                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept=".json" 
                            className="hidden" 
                        />
                         <button 
                            onClick={triggerUpload}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 border border-transparent hover:border-slate-200"
                         >
                            <Upload className="text-amber-500" size={16}/>
                            Upload Definition File
                         </button>
                     </div>
                 </div>

                 {/* Right Column: Code Viewer */}
                 <div className="lg:col-span-3">
                    <div className="bg-slate-900 rounded-lg shadow-lg overflow-hidden border border-slate-700 flex flex-col h-[600px]">
                        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Code size={14} className="text-emerald-400" />
                                <span className="text-xs font-mono text-slate-400">active_ruleset.json</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                                {Object.keys(rules).length} Series Configured
                            </span>
                        </div>
                        <div className="relative flex-1 overflow-hidden">
                            <pre className="p-6 text-xs font-mono text-slate-300 overflow-auto h-full scrollbar-thin scrollbar-thumb-slate-700">
                                {JSON.stringify(rules, null, 2)}
                            </pre>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default RulesConfigView;