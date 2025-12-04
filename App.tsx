
import React, { useState, useRef, useEffect } from 'react';
import { analyzeCase, assessInformationSufficiency, analyzeMedicationImage, analyzeVoiceSample, analyzeBodyMetrics, analyzeVisionSpecialized, analyzeAudioSpecialized, analyzeNutrition } from './services/geminiService';
import { MedicalAnalysisResponse, FileData, VoiceAnalysisResult, BodyMetrics, BodyAnalysisResult, VisionAnalysisResult, AudioSpecificAnalysisResult, NutritionAnalysisResult, ScannedMedicationResult, Language } from './types';
import AnalysisResult from './components/AnalysisResult';
import FirstAidModal from './components/FirstAidModal';
import LiveConsultation from './components/LiveConsultation';
import OfflineMode from './components/OfflineMode';
import { Shield, Mic, Camera, FileText, X, Loader2, Plus, Activity, Pill, Square, Trash2, ScanLine, Target, Dumbbell, Scale, Eye, Waves, Utensils, Droplets, ArrowRight, Home, User, Baby, Sparkles, Lock, MessageCircleQuestion, BrainCircuit, Calculator, Info, AlertTriangle, Check, Globe, Video, Keyboard, RotateCcw, HeartPulse, WifiOff, Send, Paperclip, ChevronUp, Pause, Play, StopCircle, Stethoscope, RefreshCw } from 'lucide-react';
import { translations } from './constants/translations';

type AppMode = 'adult' | 'child' | 'sport';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('fr');
  const t = translations[language];

  // Offline State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMenu, setShowOfflineMenu] = useState(false);

  // Core Data State
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [mode, setMode] = useState<AppMode>('adult');
  
  // Medications State
  const [currentMeds, setCurrentMeds] = useState(''); // Text input buffer
  const [medsList, setMedsList] = useState<string[]>([]); // Confirmed text meds
  const [scannedMedsList, setScannedMedsList] = useState<ScannedMedicationResult[]>([]); // Scanned objects

  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  // Flow State
  const [status, setStatus] = useState<'idle' | 'interviewing' | 'analyzing' | 'done'>('idle');
  const [analysisSource, setAnalysisSource] = useState<'quick' | 'full' | 'live' | null>(null);

  // Interview State
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [intakeAnswers, setIntakeAnswers] = useState<{question: string, answer: string}[]>([]);
  
  // Results
  const [result, setResult] = useState<MedicalAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPlayResponse, setAutoPlayResponse] = useState(false);
  
  // Modals Visibility
  const [showFirstAid, setShowFirstAid] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  
  // Scanning & Tools State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const medScanRef = useRef<HTMLInputElement>(null);
  const [isScanningMeds, setIsScanningMeds] = useState(false);
  
  const [scannedMedResult, setScannedMedResult] = useState<ScannedMedicationResult | null>(null);
  const [showMedScanModal, setShowMedScanModal] = useState(false);
  const [isViewingMed, setIsViewingMed] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Specialized Modules State
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  
  // Live Consultation State: 'audio' or 'video' or null (closed)
  const [liveMode, setLiveMode] = useState<'audio' | 'video' | null>(null);

  const [isAudioSpecRecording, setIsAudioSpecRecording] = useState(false);
  const [audioTimer, setAudioTimer] = useState(0); // 0 to 30

  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics>({ 
      age: '', 
      sexe: 'homme', 
      poids: '', 
      taille: '', 
      activite: 'actif', 
      frequence_sport: '3-4',
      objectif: 'maintien',
      tabac: false 
  });
  const [bodyPhoto, setBodyPhoto] = useState<File | null>(null);
  const bodyPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const [bodyResult, setBodyResult] = useState<BodyAnalysisResult | null>(null);
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [audioSpecResult, setAudioSpecResult] = useState<AudioSpecificAnalysisResult | null>(null);
  const [nutritionResult, setNutritionResult] = useState<NutritionAnalysisResult | null>(null);
  
  const [isProcessingSpec, setIsProcessingSpec] = useState(false);

  const visionInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Flip state for previews
  const [flippedFiles, setFlippedFiles] = useState<Record<number, boolean>>({});

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [description]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Geolocation denied or error", err)
      );
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleLanguage = () => {
    setLanguage(prev => {
        if (prev === 'fr') return 'en';
        if (prev === 'en') return 'ro';
        return 'fr';
    });
  };

  const toggleFileFlip = (index: number) => {
    setFlippedFiles(prev => ({
        ...prev,
        [index]: !prev[index]
    }));
  };

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: FileData[] = (Array.from(e.target.files) as File[]).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'pdf'
      }));
      setFiles(prev => [...prev, ...newFiles]);
      setShowToolsMenu(false);
    }
    if (e.target) e.target.value = '';
  };

  const handleMedScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsScanningMeds(true);
      setScannedMedResult(null); 
      setIsViewingMed(false);
      setShowToolsMenu(false);
      setShowMedScanModal(true);
      try {
        const medInfo = await analyzeMedicationImage(file, language);
        setScannedMedResult(medInfo);
      } catch (err) {
        console.error("Scan error", err);
        alert("Error scanning medication. Ensure image is clear.");
        setShowMedScanModal(false);
      } finally {
        setIsScanningMeds(false);
        e.target.value = '';
      }
    }
  };
  
  const confirmScannedMedication = () => {
    if (scannedMedResult) {
        if (scannedMedsList.length >= 10) {
            alert("Maximum 10 medications allowed.");
            return;
        }
        setScannedMedsList(prev => [...prev, scannedMedResult]);
        setShowMedScanModal(false);
        setScannedMedResult(null);
    }
  };

  const handleRemoveMed = (index: number) => {
    setScannedMedsList(prev => prev.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFlippedFiles(prev => {
        const newState = {...prev};
        delete newState[index];
        return newState;
    });
  };

  // --- Specialized Modules Handlers --- 
  const handleBodyPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setBodyPhoto(e.target.files[0]);
      }
  };

  const handleBodyAnalysis = async () => {
    if(!bodyMetrics.poids || !bodyMetrics.taille || !bodyMetrics.age) return;
    setIsProcessingSpec(true);
    try {
      const res = await analyzeBodyMetrics(bodyMetrics, mode, language, bodyPhoto || undefined);
      setBodyResult(res);
      setDescription(prev => `${prev}\n[Body Profile]: Age ${bodyMetrics.age}, BMI ${res.imc}.`);
    } catch (e) { console.error(e); } finally { setIsProcessingSpec(false); }
  };

  const handleNutritionAnalysis = async () => {
    if(!bodyMetrics.poids || !bodyMetrics.taille || !bodyMetrics.age) return;
    setIsProcessingSpec(true);
    try {
      const res = await analyzeNutrition(bodyMetrics, language);
      setNutritionResult(res);
      setDescription(prev => `${prev}\n[Nutrition]: Needs ${res.besoin_calorique_journalier} kcal/day.`);
    } catch (e) { console.error(e); } finally { setIsProcessingSpec(false); }
  };

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsProcessingSpec(true);
      try {
        const res = await analyzeVisionSpecialized(file, mode, language);
        setVisionResult(res);
        setDescription(prev => `${prev}\n[Vision Analysis]: ${res.signes_cutanes} (Score ${res.score_gravite}/5)`);
      } catch (e) { console.error(e); alert("Error"); } finally { setIsProcessingSpec(false); e.target.value = ''; }
    }
  };

  const handleAudioSpecRecord = async () => {
    setAudioSpecResult(null);
    setAudioTimer(0);
    try {
      // Use advanced audio constraints for analysis quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
          } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      let chunks: Blob[] = [];
      setIsAudioSpecRecording(true);
      mediaRecorderRef.current = mediaRecorder; 

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      
      mediaRecorder.onstop = async () => {
        setIsAudioSpecRecording(false);
        const file = new File([new Blob(chunks)], "spec_audio_analysis.webm", { type: 'audio/webm' });
        setIsProcessingSpec(true);
        try {
          const res = await analyzeAudioSpecialized(file, mode, language);
          setAudioSpecResult(res);
          setDescription(prev => `${prev}\n[Audio Analysis]: Stress Level ${res.score_stress}`);
        } catch (e) { console.error(e); } finally { setIsProcessingSpec(false); }
        stream.getTracks().forEach(t => t.stop());
      };
      
      mediaRecorder.start();
      
      // Timer Logic with 30s limit
      let seconds = 0;
      const interval = setInterval(() => {
         seconds++;
         setAudioTimer(seconds);
         if(seconds >= 30) {
             clearInterval(interval);
             if(mediaRecorder.state === 'recording') mediaRecorder.stop();
         }
      }, 1000);

      (mediaRecorder as any).timerInterval = interval;

    } catch (e) { 
        console.error("Audio record error:", e);
        setError("Erreur microphone.");
        setIsAudioSpecRecording(false); 
    }
  };

  const stopAudioSpecRecordEarly = () => {
      if(mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          clearInterval((mediaRecorderRef.current as any).timerInterval);
          mediaRecorderRef.current.stop();
      }
  };

  // --- Main Analysis Logic ---

  const executeAnalysis = async (currentDesc: string, isFull: boolean) => {
    setStatus('analyzing'); 
    setError(null);
    setShowToolsMenu(false);

    try {
      if (!isFull) {
          const intakeCheck = await assessInformationSufficiency(currentDesc, mode, language);
          if (intakeCheck.status === 'more_info_needed') {
             setInterviewQuestions(intakeCheck.questions || ["Précisez les symptômes?"]);
             setCurrentQuestionIndex(0);
             setCurrentAnswer('');
             setIntakeAnswers([]);
             setStatus('interviewing'); 
             return; 
          }
      }
      await performFullAnalysis(currentDesc);
    } catch (err) {
      console.error(err);
      await performFullAnalysis(currentDesc);
    }
  };

  const handleSendMessage = () => {
    if (!description.trim() && files.length === 0 && scannedMedsList.length === 0) return;
    
    setAutoPlayResponse(false); // Manual send does not auto-play audio

    // Smart logic: if we have files/meds OR a long description, treat as full analysis request.
    const isRichData = files.length > 0 || scannedMedsList.length > 0 || medsList.length > 0;
    const isLongText = description.split(/\s+/).length > 5;
    
    if (isRichData) {
        setAnalysisSource('full');
        executeAnalysis(description, true);
    } else {
        setAnalysisSource('quick');
        executeAnalysis(description, false);
    }
  };

  const handleNextQuestion = () => {
    if (!currentAnswer.trim()) return;
    const newAnswers = [...intakeAnswers, { question: interviewQuestions[currentQuestionIndex], answer: currentAnswer }];
    setIntakeAnswers(newAnswers);
    if (currentQuestionIndex < interviewQuestions.length - 1) {
       setCurrentQuestionIndex(prev => prev + 1);
       setCurrentAnswer('');
    } else {
       finishInterview(newAnswers);
    }
  };

  const finishInterview = async (answers: {question: string, answer: string}[]) => {
     let transcript = "";
     answers.forEach(item => transcript += `\n[Q: ${item.question} -> R: ${item.answer}]`);
     const combinedDescription = `${description}\n\n[Triage]:${transcript}`;
     setDescription(combinedDescription);
     await performFullAnalysis(combinedDescription);
  };

  const performFullAnalysis = async (finalDescription: string) => {
    setStatus('analyzing');
    setResult(null);
    setShowFirstAid(false);
    setShowSuggestionModal(false);

    try {
      const fileObjects = files.map(f => f.file);
      let combinedMeds = medsList.join(', ');
      if (currentMeds.trim()) combinedMeds += `, ${currentMeds}`; // include unsaved text input
      if (scannedMedsList.length > 0) {
        const scannedNames = scannedMedsList.map(m => `${m.nom} (${m.usage_principal})`).join(', ');
        combinedMeds = combinedMeds ? `${combinedMeds}, ${scannedNames}` : scannedNames;
      }
      
      const data = await analyzeCase(finalDescription, fileObjects, mode, combinedMeds, language, location);
      setResult(data);
      setStatus('done');
      
      if (data.niveau_urgence.code === 5) setShowFirstAid(true);
      else setShowSuggestionModal(true);

      // window.scrollTo({ top: 0, behavior: 'smooth' }); // Stay at bottom for chat feel? No, scroll to result.
    } catch (err) {
      console.error(err);
      setError("Erreur analyse.");
      setStatus('idle');
    }
  };

  const handleLiveConsultationClose = (transcript?: string) => {
    setLiveMode(null);
    if (!transcript || transcript.trim().split(/\s+/).length < 6) {
        // Only show feedback if transcription was empty or very short, usually implies instant close
        // But if user just closed without talking, maybe don't trigger anything.
        // setShowLiveFeedbackModal(true); 
        return;
    }
    const fullDescription = description ? `${description}\n\n[LIVE]:\n${transcript}` : `[LIVE]:\n${transcript}`;
    setDescription(fullDescription);
    setAnalysisSource('live');
    performFullAnalysis(fullDescription);
  };

  const resetAnalysis = () => {
    setResult(null);
    setFiles([]);
    setDescription('');
    setInterviewQuestions([]);
    setCurrentMeds('');
    setMedsList([]);
    setScannedMedsList([]);
    setStatus('idle');
    setAnalysisSource(null);
    setError(null);
    setIsRecording(false);
    setVoiceResult(null);
    setShowFirstAid(false);
    setShowSuggestionModal(false);
    setBodyResult(null);
    setVisionResult(null);
    setAudioSpecResult(null);
    setNutritionResult(null);
    setShowToolsMenu(false);
    setAutoPlayResponse(false);
    setBodyPhoto(null);
  };

  const addMedFromInput = () => {
    if (currentMeds.trim()) {
        if(medsList.length + scannedMedsList.length >= 10) {
             alert("Limit 10 meds");
             return;
        }
        setMedsList(prev => [...prev, currentMeds.trim()]);
        setCurrentMeds('');
    }
  };

  // --- Renderers ---

  const renderToolsMenu = () => (
    <div className={`absolute bottom-full left-4 mb-4 bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-4 w-[calc(100%-2rem)] max-w-sm grid grid-cols-4 gap-4 animate-fade-in-up origin-bottom-left z-[70]`}>
       <button onClick={() => setLiveMode('video')} className="col-span-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-pink-500/30 hover:shadow-xl hover:-translate-y-1 transition-all">
           <Video size={24} />
           <span className="font-bold">{translations[language].live.title}</span>
       </button>

       <button onClick={() => medScanRef.current?.click()} className="col-span-2 flex flex-col items-center gap-2 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-2xl text-indigo-700 transition-all shadow-md shadow-indigo-100/50 hover:-translate-y-1">
           <Pill size={24} />
           <span className="text-xs font-bold text-center">{t.medications.scan_btn}</span>
       </button>
       <button onClick={() => fileInputRef.current?.click()} className="col-span-2 flex flex-col items-center gap-2 p-3 bg-teal-50 hover:bg-teal-100 rounded-2xl text-teal-700 transition-all shadow-md shadow-teal-100/50 hover:-translate-y-1">
           <Camera size={24} />
           <span className="text-xs font-bold text-center">Photo/Doc</span>
       </button>

       <div className="col-span-4 h-px bg-slate-100 my-1"></div>

       <button onClick={() => {setShowToolsMenu(false); setShowBodyModal(true);}} className="flex flex-col items-center gap-2 p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all hover:-translate-y-0.5">
           <Scale size={20} />
           <span className="text-[10px] font-bold">Corps</span>
       </button>
       <button onClick={() => {setShowToolsMenu(false); setShowNutritionModal(true);}} className="flex flex-col items-center gap-2 p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all hover:-translate-y-0.5">
           <Utensils size={20} />
           <span className="text-[10px] font-bold">Nutri</span>
       </button>
       <button onClick={() => {setShowToolsMenu(false); setShowVisionModal(true);}} className="flex flex-col items-center gap-2 p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all hover:-translate-y-0.5">
           <Eye size={20} />
           <span className="text-[10px] font-bold">Vision</span>
       </button>
       <button onClick={() => {setShowToolsMenu(false); setShowAudioModal(true);}} className="flex flex-col items-center gap-2 p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all hover:-translate-y-0.5">
           <Waves size={20} />
           <span className="text-[10px] font-bold">Audio</span>
       </button>

       {/* Hidden Inputs */}
       <input type="file" ref={medScanRef} accept="image/*" className="hidden" onChange={handleMedScan} />
       <input type="file" ref={fileInputRef} multiple accept="image/*,video/*,audio/*,.pdf" className="hidden" onChange={handleFileChange} />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* --- Overlays & Modals --- */}
      {(showOfflineMenu || !isOnline) && <OfflineMode language={language} onClose={() => setShowOfflineMenu(false)} forced={!isOnline} />}
      {liveMode && <LiveConsultation onClose={handleLiveConsultationClose} language={language} mode={liveMode} />}
      {showFirstAid && result?.premiers_secours_steps && <FirstAidModal steps={result.premiers_secours_steps} onClose={() => setShowFirstAid(false)} language={language}/>}
      
      {/* 1. Medication Scanner Modal */}
      {showMedScanModal && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
             <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-fade-in-up border border-indigo-50 relative flex flex-col z-[100] max-h-[80vh] overflow-hidden">
                 <div className="absolute top-4 right-4 z-20">
                    <button onClick={() => setShowMedScanModal(false)} className="p-2 bg-slate-100/50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                 </div>
                 
                 <div className="overflow-y-auto p-6 h-full custom-scrollbar">
                    {isScanningMeds ? (
                        <div className="flex flex-col items-center py-12">
                           <Pill size={48} className="text-indigo-500 animate-bounce mb-6"/>
                           <Loader2 className="animate-spin text-slate-400" size={24}/>
                           <p className="mt-4 text-slate-600 font-medium text-center">Analyse du médicament...</p>
                        </div>
                     ) : scannedMedResult ? (
                        <>
                         <div className="flex items-start gap-4 mb-4 mt-2">
                            <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
                               <Pill size={32} />
                            </div>
                            <div>
                               <h3 className="text-xl font-bold text-slate-900 leading-tight">{scannedMedResult.nom}</h3>
                               <p className="text-sm text-indigo-600 font-medium mt-1">{scannedMedResult.usage_principal}</p>
                            </div>
                         </div>
                         <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-6 border border-slate-100">
                            <p className="mb-2"><strong>Détails:</strong> {scannedMedResult.description}</p>
                            {scannedMedResult.avertissements && <p className="text-amber-600"><strong>⚠️ {scannedMedResult.avertissements}</strong></p>}
                         </div>
                         <div className="flex gap-2 pb-2">
                             <button onClick={() => setShowMedScanModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-all">{t.modals.med_cancel}</button>
                             <button onClick={confirmScannedMedication} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 transition-all">{t.modals.med_add}</button>
                         </div>
                        </>
                     ) : null}
                 </div>
             </div>
         </div>
      )}

      {/* 2. Body Metrics Modal (Full Form) - CENTERED & SCROLLABLE */}
      {showBodyModal && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
           <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] relative animate-fade-in-up overflow-hidden z-[100]">
             
             {/* Sticky Close Button */}
             <div className="absolute top-4 right-4 z-20">
                <button onClick={() => setShowBodyModal(false)} className="p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
             </div>

             {/* Scrollable Area */}
             <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar h-full">
                 <div className="flex items-center gap-2 mb-6">
                    <Scale className="text-teal-600"/>
                    <h3 className="font-bold text-lg">{t.modals.body_title}</h3>
                 </div>
                 
                 <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.gender}</label>
                           <select className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-teal-500" value={bodyMetrics.sexe} onChange={e=>setBodyMetrics({...bodyMetrics, sexe: e.target.value as any})}>
                              <option value="homme">{t.forms.male}</option>
                              <option value="femme">{t.forms.female}</option>
                           </select>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.age}</label>
                           <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder="Ex: 30" value={bodyMetrics.age} onChange={e=>setBodyMetrics({...bodyMetrics, age: e.target.value})}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.weight}</label>
                           <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder="kg" value={bodyMetrics.poids} onChange={e=>setBodyMetrics({...bodyMetrics, poids: e.target.value})}/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.height}</label>
                           <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder="cm" value={bodyMetrics.taille} onChange={e=>setBodyMetrics({...bodyMetrics, taille: e.target.value})}/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.activity}</label>
                        <select className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" value={bodyMetrics.activite} onChange={e=>setBodyMetrics({...bodyMetrics, activite: e.target.value as any})}>
                           <option value="sedentaire">{t.forms.sedentary}</option>
                           <option value="actif">{t.forms.active}</option>
                           <option value="sportif">{t.forms.athletic}</option>
                        </select>
                    </div>

                    {/* NEW PHOTO INPUT FOR BODY ANALYSIS */}
                    <div className="mt-2">
                        <label className="text-xs font-bold text-slate-500 ml-1">Photo (Visage/Corps) - Optionnel</label>
                        <button 
                            onClick={() => bodyPhotoInputRef.current?.click()} 
                            className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-teal-600 hover:border-teal-400 hover:bg-teal-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Camera size={18} /> {bodyPhoto ? "Photo sélectionnée" : "Ajouter une photo"}
                        </button>
                        <input type="file" ref={bodyPhotoInputRef} accept="image/*" className="hidden" onChange={handleBodyPhotoUpload} />
                        {bodyPhoto && <p className="text-xs text-teal-600 mt-1 text-center font-semibold">{bodyPhoto.name}</p>}
                    </div>
                    
                    <button onClick={handleBodyAnalysis} disabled={isProcessingSpec} className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 transition-all mt-2">
                      {isProcessingSpec ? <Loader2 className="animate-spin mx-auto"/> : t.forms.submit_body}
                    </button>
                    
                    {bodyResult && (
                       <div className="mt-4 p-5 bg-teal-50 rounded-2xl border border-teal-100 animate-fade-in shadow-sm">
                          <div className="flex justify-between items-end mb-3">
                             <span className="font-bold text-teal-800 text-xl">IMC: {bodyResult.imc}</span>
                             <span className="text-xs text-teal-600 font-bold bg-white px-2 py-1 rounded-md shadow-sm">{bodyResult.masse_grasse_estimee} Fat</span>
                          </div>
                          <p className="text-sm text-teal-700 leading-relaxed">{bodyResult.interpretation}</p>
                       </div>
                    )}
                    
                    {/* Extra space at bottom to ensure visibility */}
                    <div className="h-4"></div>
                 </div>
             </div>
           </div>
         </div>
      )}

      {/* 3. Nutrition Modal (Full Form) */}
      {showNutritionModal && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
           <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] relative animate-fade-in-up overflow-hidden z-[100]">
             
             <div className="absolute top-4 right-4 z-20">
                <button onClick={() => setShowNutritionModal(false)} className="p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
             </div>

             <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar h-full">
                 <div className="flex items-center gap-2 mb-6">
                    <Utensils className="text-lime-600"/>
                    <h3 className="font-bold text-lg">{t.modals.nutrition_title}</h3>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder={t.forms.weight} value={bodyMetrics.poids} onChange={e=>setBodyMetrics({...bodyMetrics, poids: e.target.value})}/>
                        <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder={t.forms.height} value={bodyMetrics.taille} onChange={e=>setBodyMetrics({...bodyMetrics, taille: e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" placeholder={t.forms.age} value={bodyMetrics.age} onChange={e=>setBodyMetrics({...bodyMetrics, age: e.target.value})}/>
                        <select className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" value={bodyMetrics.sexe} onChange={e=>setBodyMetrics({...bodyMetrics, sexe: e.target.value as any})}>
                              <option value="homme">{t.forms.male}</option>
                              <option value="femme">{t.forms.female}</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 ml-1">{t.forms.goal}</label>
                        <select className="w-full p-3 bg-slate-50 rounded-xl border-none shadow-sm" value={bodyMetrics.objectif} onChange={e=>setBodyMetrics({...bodyMetrics, objectif: e.target.value as any})}>
                           <option value="maintien">{t.forms.maintain}</option>
                           <option value="perte">{t.forms.loss}</option>
                           <option value="prise">{t.forms.gain}</option>
                        </select>
                    </div>
                    
                    <button onClick={handleNutritionAnalysis} disabled={isProcessingSpec} className="w-full bg-lime-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-lime-500/30 hover:-translate-y-0.5 transition-all mt-4">
                      {isProcessingSpec ? <Loader2 className="animate-spin mx-auto"/> : t.forms.submit_nutri}
                    </button>
                    
                    {nutritionResult && (
                       <div className="mt-4 p-5 bg-lime-50 rounded-2xl border border-lime-100 animate-fade-in shadow-sm">
                          <div className="text-center mb-4">
                             <span className="block text-4xl font-black text-lime-700 tracking-tighter">{nutritionResult.besoin_calorique_journalier}</span>
                             <span className="text-xs uppercase font-bold text-lime-500 tracking-wide">kcal / jour</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-slate-600 mb-2 px-2">
                             <span>Prot: {nutritionResult.proteines_g}g</span>
                             <span>Carb: {nutritionResult.glucides_g}g</span>
                             <span>Fat: {nutritionResult.lipides_g}g</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                              <div className="bg-red-400 h-full" style={{width: '30%'}}></div>
                              <div className="bg-amber-400 h-full" style={{width: '40%'}}></div>
                              <div className="bg-blue-400 h-full" style={{width: '30%'}}></div>
                          </div>
                       </div>
                    )}
                    <div className="h-4"></div>
                 </div>
             </div>
           </div>
         </div>
      )}

      {/* 4. Vision Modal */}
      {showVisionModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] relative animate-fade-in-up overflow-hidden z-[100]">
              <div className="absolute top-4 right-4 z-20">
                <button onClick={() => setShowVisionModal(false)} className="p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar h-full">
                  <h3 className="font-bold mb-6 flex items-center gap-2"><Eye className="text-indigo-600"/> {t.modals.vision_title}</h3>
                  <div className="space-y-6">
                     <button onClick={()=>visionInputRef.current?.click()} className="w-full py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 transition-all group bg-slate-50">
                         <Camera size={48} className="mb-2 group-hover:scale-110 transition-transform"/>
                         <span className="font-bold">{t.modals.upload_doc}</span>
                     </button>
                     <input type="file" ref={visionInputRef} className="hidden" onChange={handleVisionUpload} />
                     
                     {isProcessingSpec && <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></div>}

                     {visionResult && (
                        <div className="p-6 bg-indigo-50 rounded-2xl text-indigo-900 border border-indigo-100 animate-fade-in shadow-sm">
                           <h4 className="font-bold mb-3 text-lg">Analyse: {visionResult.signes_cutanes || visionResult.signes_trauma}</h4>
                           <div className="flex gap-2 mb-3">
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${visionResult.score_gravite > 3 ? 'bg-red-200 text-red-900' : 'bg-green-200 text-green-900'}`}>Score: {visionResult.score_gravite}/5</span>
                           </div>
                           <p className="text-sm leading-relaxed">{visionResult.recommandations?.[0]}</p>
                        </div>
                     )}
                     <div className="h-4"></div>
                  </div>
              </div>
            </div>
          </div>
      )}

      {/* 5. Audio Modal (30s Timer) */}
      {showAudioModal && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
           <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] relative animate-fade-in-up overflow-hidden text-center z-[100]">
             <div className="absolute top-4 right-4 z-20">
                <button onClick={() => setShowAudioModal(false)} className="p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
             </div>

             <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar h-full">
                 <h3 className="font-bold mb-8 flex items-center justify-center gap-2"><Waves className="text-sky-500"/> {t.modals.audio_title}</h3>
                 
                 <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
                     {/* Progress Ring */}
                     <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="10" fill="none" />
                        <circle 
                          cx="80" cy="80" r="70" 
                          stroke="#0ea5e9" strokeWidth="10" fill="none" 
                          strokeDasharray="440" 
                          strokeDashoffset={440 - (440 * audioTimer) / 30}
                          className="transition-all duration-1000 ease-linear"
                          strokeLinecap="round"
                        />
                     </svg>
                     
                     {isAudioSpecRecording ? (
                         <div className="text-4xl font-black text-sky-600 animate-pulse">{30 - audioTimer}s</div>
                     ) : (
                         <button onClick={handleAudioSpecRecord} disabled={isProcessingSpec} className="w-24 h-24 bg-gradient-to-br from-sky-400 to-sky-600 hover:from-sky-500 hover:to-sky-700 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-all z-10 active:scale-95">
                            {isProcessingSpec ? <Loader2 className="animate-spin" size={32}/> : <Mic size={36}/>}
                         </button>
                     )}
                 </div>

                 {isAudioSpecRecording && (
                    <button onClick={stopAudioSpecRecordEarly} className="mb-6 px-6 py-2.5 bg-red-100 text-red-600 rounded-full font-bold text-sm hover:bg-red-200 transition-colors flex items-center gap-2 mx-auto shadow-sm">
                       <StopCircle size={18}/> {t.modals.stop_early}
                    </button>
                 )}
                 
                 {audioSpecResult && (
                     <div className="p-6 bg-sky-50 rounded-2xl text-left border border-sky-100 animate-fade-in shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                           <span className="font-bold text-sky-900 text-lg">Stress: {audioSpecResult.score_stress}</span>
                           <span className="text-xs bg-white px-3 py-1 rounded-full text-sky-600 border border-sky-200 font-bold">{audioSpecResult.rythme_respiratoire}</span>
                        </div>
                        <ul className="text-sm text-sky-700 list-disc list-inside space-y-1">
                           {audioSpecResult.recommandations?.slice(0,2).map((r,i)=><li key={i}>{r}</li>)}
                        </ul>
                     </div>
                 )}
                 <div className="h-4"></div>
             </div>
           </div>
         </div>
      )}

      {/* --- Header --- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 flex-shrink-0 z-40 h-16 flex items-center justify-between px-4 sticky top-0">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAnalysis}>
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <Shield size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">{t.title}</h1>
              <span className="text-[10px] text-teal-600 font-medium tracking-wide mt-0.5 block">{t.subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowOfflineMenu(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${isOnline ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-red-600 text-white border-red-600 animate-pulse'}`}>
                <HeartPulse size={14} fill={!isOnline ? "currentColor" : "none"}/>
             </button>
             <button onClick={toggleLanguage} className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-[9px] font-bold text-slate-600 hover:bg-slate-50 transition-all capitalize shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-px h-auto">
                <Globe size={10}/> {language}
             </button>
          </div>
      </header>

      {/* --- Main Content Area (Scrollable Feed) --- */}
      <main className="flex-1 overflow-y-auto p-4 pb-32 scroll-smooth">
         <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end">
            
            {status === 'idle' && (
               <div className="flex flex-col items-center justify-center flex-1 py-12 text-center space-y-8 h-full">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(20,184,166,0.2)] mb-4">
                     <Stethoscope size={48} className="text-teal-600" />
                  </div>
                  <div className="space-y-2 max-w-md">
                     <h2 className="text-2xl font-bold text-slate-800">Bonjour.</h2>
                     <p className="text-slate-500 font-medium leading-relaxed">{t.disclaimer.text}</p>
                     <p className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full inline-block mt-4">
                        {t.disclaimer.emergency}
                     </p>
                  </div>
               </div>
            )}

            {status === 'analyzing' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-fade-in">
                   <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-teal-500 animate-spin"></div>
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-500" size={24} />
                   </div>
                   <p className="text-slate-500 font-medium animate-pulse">{t.main_action.analyzing}</p>
                </div>
            )}

            {status === 'interviewing' && (
               <div className="bg-white p-6 rounded-3xl shadow-xl border border-teal-100 animate-fade-in-up my-4">
                  <div className="flex items-center gap-3 mb-4 text-teal-600">
                     <MessageCircleQuestion size={24} />
                     <span className="font-bold text-sm uppercase tracking-wider">{t.intake.title}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-6">{interviewQuestions[currentQuestionIndex]}</h3>
                  <div className="flex gap-2">
                     <input 
                        type="text" 
                        autoFocus
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNextQuestion()}
                        className="flex-1 bg-slate-50 border-none shadow-inner rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                        placeholder={t.intake.placeholder}
                     />
                     <button onClick={handleNextQuestion} disabled={!currentAnswer.trim()} className="bg-teal-600 text-white p-3 rounded-xl disabled:opacity-50 hover:bg-teal-700 shadow-lg shadow-teal-500/30 hover:-translate-y-0.5 transition-all">
                        <ArrowRight size={24} />
                     </button>
                  </div>
                  <div className="w-full bg-slate-100 h-1 mt-6 rounded-full overflow-hidden">
                     <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${((currentQuestionIndex) / interviewQuestions.length) * 100}%` }}></div>
                  </div>
               </div>
            )}

            {status === 'done' && result && (
               <div className="animate-fade-in-up pb-8">
                  <div className="bg-slate-800 text-white px-4 py-2 rounded-t-3xl rounded-br-3xl inline-block text-sm font-bold mb-4 shadow-lg shadow-slate-800/20">
                     Vitalia Analysis
                  </div>
                  <AnalysisResult data={result} language={language} autoPlay={autoPlayResponse} />
                  
                  {/* Suggestion to continue conversation */}
                  <div className="mt-8 text-center">
                     <button onClick={resetAnalysis} className="text-slate-400 text-sm hover:text-teal-600 flex items-center justify-center gap-2 mx-auto transition-colors">
                        <RotateCcw size={16} /> Nouvelle analyse
                     </button>
                  </div>
               </div>
            )}
            
            {error && (
               <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-3 my-4 animate-shake shadow-sm">
                  <AlertTriangle size={20} />
                  <span className="font-bold text-sm">{error}</span>
               </div>
            )}

         </div>
      </main>

      {/* --- Bottom Conversation Bar --- */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 p-4 pb-8 md:pb-4 relative z-50">
         <div className="max-w-3xl mx-auto relative">
             
             {/* Mode Selector (Above Bar) */}
             <div className="absolute bottom-full left-0 mb-14 flex gap-3 origin-bottom-left px-2">
                {['adult', 'child', 'sport'].map((m) => (
                   <button 
                     key={m} 
                     onClick={() => setMode(m as AppMode)}
                     className={`px-4 py-2 rounded-2xl text-[11px] font-bold capitalize transition-all hover:-translate-y-1 ${mode === m 
                        ? (m === 'child' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30' : m === 'sport' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30')
                        : 'bg-white text-slate-600 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-none ring-0'}`}
                   >
                     {t.modes[m as AppMode]}
                   </button>
                ))}
             </div>

             {/* Context Chips (Files, Meds) */}
             <div className="flex-1 flex flex-col items-center gap-2 mb-2">
                {files.map((f, i) => (
                   <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 shadow-sm animate-scale-in">
                      <Paperclip size={12} /> 
                      <span className="max-w-[100px] truncate">{f.file.name}</span>
                      {f.type === 'image' && (
                        <button onClick={() => toggleFileFlip(i)} className="hover:text-teal-600 ml-1" title="Flip Image">
                            <RefreshCw size={10} className={flippedFiles[i] ? "text-teal-600" : ""} />
                        </button>
                      )}
                      <button onClick={() => removeFile(i)} className="hover:text-red-500 ml-1"><X size={12}/></button>
                      {f.type === 'image' && flippedFiles[i] && (
                        <style>{`
                            /* Apply flip to preview if shown elsewhere, though mostly specific to video feeds */
                        `}</style>
                      )}
                   </div>
                ))}
                {scannedMedsList.map((m, i) => (
                   <div key={i} className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg text-xs font-medium text-indigo-600 shadow-sm animate-scale-in border border-indigo-100">
                      <Pill size={12} /> {m.nom.substring(0, 10)}... <button onClick={() => handleRemoveMed(i)} className="hover:text-red-500"><X size={12}/></button>
                   </div>
                ))}
                {medsList.map((m, i) => (
                   <div key={i} className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg text-xs font-medium text-indigo-600 shadow-sm animate-scale-in border border-indigo-100">
                      <Pill size={12} /> {m} <button onClick={() => setMedsList(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500"><X size={12}/></button>
                   </div>
                ))}
             </div>

             {/* Tools Menu Popover */}
             {showToolsMenu && (
                 <>
                     <div className="fixed inset-0 z-[60] bg-black/5" onClick={() => setShowToolsMenu(false)}></div>
                     {renderToolsMenu()}
                 </>
             )}

             {/* Input Bar */}
             <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-[26px] shadow-[0_2px_15px_rgba(0,0,0,0.05)] focus-within:shadow-[0_4px_20px_rgba(20,184,166,0.15)] focus-within:ring-1 focus-within:ring-teal-100 transition-all border border-slate-100">
                
                <button 
                  onClick={() => setShowToolsMenu(!showToolsMenu)} 
                  className={`p-3 rounded-full flex-shrink-0 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${showToolsMenu ? 'bg-slate-200 rotate-45 text-slate-600' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                >
                   <Plus size={24} strokeWidth={3} />
                </button>

                <div className="flex-1 relative">
                   <textarea
                     ref={textareaRef}
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleSendMessage();
                        }
                     }}
                     placeholder={status === 'interviewing' ? t.intake.placeholder : (mode === 'child' ? t.symptoms.placeholder_child : t.symptoms.placeholder_adult)}
                     className="w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400 resize-none max-h-24 text-base leading-normal py-2 px-2"
                     rows={1}
                     disabled={status === 'analyzing' || status === 'interviewing'}
                   />
                </div>

                <div className="flex items-center gap-2">
                    <button 
                       onClick={status === 'interviewing' ? handleNextQuestion : handleSendMessage} 
                       disabled={status === 'analyzing' || (!description.trim() && files.length === 0 && medsList.length === 0 && scannedMedsList.length === 0)}
                       className={`p-3 rounded-full transition-all duration-200 ${
                          status === 'analyzing' || (!description.trim() && files.length === 0 && medsList.length === 0 && scannedMedsList.length === 0)
                          ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed' 
                          : 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:-translate-y-0.5 active:scale-95'
                       }`}
                    >
                       {status === 'analyzing' ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="ml-0.5" />}
                    </button>
                </div>
             </div>
             
             {/* Extra mini-text for meds input if user types specific med names not in description */}
             {currentMeds && (
                 <div className="absolute top-full right-4 mt-2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-indigo-700 animate-fade-in-up flex items-center gap-1 shadow-md hover:-translate-y-0.5 transition-transform" onClick={addMedFromInput}>
                    <Plus size={12}/> Ajouter "{currentMeds}" aux traitements
                 </div>
             )}
         </div>
      </div>

    </div>
  );
};

export default App;
