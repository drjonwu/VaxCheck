import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Loader2, Save, AlertCircle } from 'lucide-react';
import { parseVaccineCard, ScannedDose } from '../services/geminiService';

interface VaccineCardScannerProps {
  onClose: () => void;
  onSave: (doses: ScannedDose[]) => void;
  availableCodes: string[];
  patientDOB: Date;
}

const VaccineCardScanner: React.FC<VaccineCardScannerProps> = ({ onClose, onSave, availableCodes, patientDOB }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedDose[]>([]);
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [error, setError] = useState<string | null>(null);

  // Date Constraints
  const todayStr = new Date().toISOString().split('T')[0];
  const dobStr = patientDOB instanceof Date 
    ? patientDOB.toISOString().split('T')[0] 
    : new Date(patientDOB).toISOString().split('T')[0];

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/png');
        setCapturedImage(imageDataUrl);
        stopCamera();
        processImage(imageDataUrl);
      }
    }
  };

  const processImage = async (imageData: string) => {
    setIsProcessing(true);
    setStep('review');
    try {
      const results = await parseVaccineCard(imageData);
      setScannedData(results);
    } catch (err) {
      setError("AI processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScannedData([]);
    setError(null);
    setStep('camera');
    startCamera();
  };

  const handleDeleteRow = (index: number) => {
    const newData = [...scannedData];
    newData.splice(index, 1);
    setScannedData(newData);
  };

  const handleUpdateRow = (index: number, field: keyof ScannedDose, value: string) => {
    const newData = [...scannedData];
    newData[index] = { ...newData[index], [field]: value };
    setScannedData(newData);
  };

  const handleFinalSave = () => {
    onSave(scannedData);
    onClose();
  };

  // --- VALIDATION LOGIC ---
  const getValidationError = (dateStr: string): string | null => {
      if (!dateStr) return "Required";
      
      // Simple string comparison works for ISO YYYY-MM-DD format
      if (dateStr > todayStr) return "Cannot be in future";
      if (dateStr < dobStr) return "Cannot be before DOB";
      
      // Validity Check
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Invalid Format";

      return null;
  };

  const getRowError = (row: ScannedDose) => {
      if (!row.vaccine) return "Vaccine name required";
      const dateErr = getValidationError(row.date);
      if (dateErr) return dateErr;
      return null;
  };

  const hasErrors = scannedData.some(row => getRowError(row) !== null);


  // --- CAMERA VIEW ---
  if (step === 'camera') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
          <h2 className="text-white font-medium flex items-center gap-2">
            <Camera className="text-emerald-400" /> Scan Vaccine Card
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {error ? (
                <div className="text-white text-center p-6">
                    <p className="mb-4">{error}</p>
                    <button onClick={startCamera} className="px-4 py-2 bg-emerald-600 rounded">Retry</button>
                </div>
            ) : (
                <>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
                        <div className="w-full h-full border-2 border-emerald-500/50 relative">
                             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400"></div>
                             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400"></div>
                             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400"></div>
                             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400"></div>
                        </div>
                    </div>
                </>
            )}
        </div>

        <div className="h-32 bg-black flex items-center justify-center">
            <button 
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
            >
                <div className="w-14 h-14 rounded-full bg-white border-2 border-black"></div>
            </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // --- REVIEW VIEW ---
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
       <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
             <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 {isProcessing ? <Loader2 className="animate-spin text-emerald-500"/> : <Check className="text-emerald-500"/>}
                 {isProcessing ? 'Processing Image...' : 'Review Scanned Data'}
             </h3>
             {!isProcessing && (
                 <button onClick={handleRetake} className="text-xs font-medium text-slate-500 flex items-center gap-1 hover:text-slate-800">
                     <RefreshCw size={12}/> Retake
                 </button>
             )}
          </div>

          <div className="p-6 overflow-y-auto flex-1">
             {isProcessing ? (
                 <div className="flex flex-col items-center justify-center h-48 space-y-4">
                     <div className="relative w-16 h-16">
                         <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
                         <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                     <p className="text-slate-500 text-sm">Extracting clinical data...</p>
                 </div>
             ) : (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/3 aspect-[3/4] bg-slate-100 rounded border border-slate-200 overflow-hidden relative group shrink-0">
                            <img src={capturedImage!} alt="Scan" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                        </div>
                        
                        <div className="flex-1 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 p-3 rounded flex gap-3 text-xs text-blue-800">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                    <strong>Verify Data:</strong> Check scanned dates against the image. 
                                    Dates must be between <strong>{dobStr}</strong> (DOB) and <strong>{todayStr}</strong> (Today).
                                </div>
                            </div>

                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold text-slate-400 uppercase border-b border-slate-200">
                                        <th className="pb-2 pl-1">Vaccine</th>
                                        <th className="pb-2 w-40">Date Administered</th>
                                        <th className="pb-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {scannedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-200 mt-2 block">
                                                No legible vaccines detected. Add one manually below.
                                            </td>
                                        </tr>
                                    ) : scannedData.map((row, idx) => {
                                        const dateError = getValidationError(row.date);
                                        const vaccineError = !row.vaccine;
                                        const hasRowError = dateError || vaccineError;

                                        return (
                                        <tr key={idx} className="group">
                                            <td className="py-2 pr-2 align-top">
                                                <input 
                                                    list="vaccine-codes"
                                                    type="text" 
                                                    value={row.vaccine}
                                                    onChange={(e) => handleUpdateRow(idx, 'vaccine', e.target.value)}
                                                    className={`w-full bg-slate-50 border rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 font-medium text-slate-700 ${vaccineError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                                    placeholder="e.g. MMR"
                                                />
                                            </td>
                                            <td className="py-2 pr-2 align-top">
                                                <input 
                                                    type="date"
                                                    max={todayStr}
                                                    min={dobStr}
                                                    value={row.date}
                                                    onChange={(e) => handleUpdateRow(idx, 'date', e.target.value)}
                                                    className={`w-full bg-slate-50 border rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400 font-mono text-slate-600 text-xs ${dateError ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200'}`}
                                                />
                                                {dateError && (
                                                    <div className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                                                        <AlertCircle size={10} /> {dateError}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 text-right align-top pt-2.5">
                                                <button 
                                                    onClick={() => handleDeleteRow(idx)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Remove Row"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                            <datalist id="vaccine-codes">
                                {availableCodes.map(code => <option key={code} value={code} />)}
                            </datalist>

                            <button 
                                onClick={() => setScannedData([...scannedData, { vaccine: '', date: '' }])}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wide border-b border-dashed border-indigo-300 pb-0.5"
                            >
                                + Add Manual Row
                            </button>
                        </div>
                    </div>
                </div>
             )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg flex justify-end gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded transition-colors text-sm"
             >
                 Cancel
             </button>
             <button 
                onClick={handleFinalSave}
                disabled={isProcessing || scannedData.length === 0 || hasErrors}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm transition-all"
                title={hasErrors ? "Fix validation errors to save" : "Import these records"}
             >
                 <Save size={16} /> 
                 {hasErrors ? 'Fix Errors' : 'Import Records'}
             </button>
          </div>
       </div>
    </div>
  );
};

export default VaccineCardScanner;