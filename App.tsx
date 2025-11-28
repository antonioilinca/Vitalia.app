

import React, { useState, useRef, useEffect } from 'react';
import { analyzeCase, assessInformationSufficiency, analyzeMedicationImage, analyzeVoiceSample, analyzeBodyMetrics, analyzeVisionSpecialized, analyzeAudioSpecialized, analyzeNutrition } from './services/geminiService';
import { MedicalAnalysisResponse, FileData, VoiceAnalysisResult, BodyMetrics, BodyAnalysisResult, VisionAnalysisResult, AudioSpecificAnalysisResult, NutritionAnalysisResult, ScannedMedicationResult } from './types';
import AnalysisResult from './components/AnalysisResult';
import FirstAidModal from './components/FirstAidModal';
import ChatBot from './components/ChatBot';
import { Shield, Mic, Camera, FileText, X, Loader2, Plus, Activity, Pill, Square, Trash2, Lightbulb, ScanLine, Target, Dumbbell, Layers, RefreshCcw, Scale, Eye, Waves, Utensils, Droplets, ArrowRight, Home, User, Baby, Sparkles, Lock, MessageCircleQuestion, BrainCircuit, Calculator, Info, AlertTriangle, Check } from 'lucide-react';

type AppMode = 'adult' | 'child' | 'sport';

const App: React.FC = () => {
  const [description, setDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  
  // New States for Features
  const [mode, setMode] = useState<AppMode>('adult');
  const [currentMeds, setCurrentMeds] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  const [status, setStatus] = useState<'idle' | 'interviewing' | 'analyzing' | 'done'>('idle');
  // New state to track which button triggered the analysis
  const [analysisSource, setAnalysisSource] = useState<'quick' | 'full' | null>(null);

  // --- NEW TRIAGE STATE ---
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [intakeAnswers, setIntakeAnswers] = useState<{question: string, answer: string}[]>([]);
  const [interviewReason, setInterviewReason] = useState<string>('');
  
  const [result, setResult] = useState<MedicalAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Controls visibility of First Aid Modal independently of result status
  const [showFirstAid, setShowFirstAid] = useState(false);
  
  // Controls the new Suggestion Popup
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const medScanRef = useRef<HTMLInputElement>(null);
  const [isScanningMeds, setIsScanningMeds] = useState(false);
  
  // --- SCAN MEDICATION ENRICHED STATE ---
  const [scannedMedResult, setScannedMedResult] = useState<ScannedMedicationResult | null>(null);
  const [showMedScanModal, setShowMedScanModal] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceAnalysisResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- SPECIALIZED MODULES STATES ---
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showNutritionModal, setShowNutritionModal] = useState(false);

  // New states for Audio Spec Recording UX
  const [isAudioSpecRecording, setIsAudioSpecRecording] = useState(false);
  const [audioCountdown, setAudioCountdown] = useState(5);

  const [bodyMetrics, setBodyMetrics] = useState<BodyMetrics>({ 
      age: '', 
      sexe: 'homme', 
      poids: '', 
      taille: '', 
      activite: 'actif', 
      frequence_sport: '3-4 jours/semaine',
      objectif: 'maintien',
      tabac: false 
  });
  
  const [bodyResult, setBodyResult] = useState<BodyAnalysisResult | null>(null);
  const [visionResult, setVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [audioSpecResult, setAudioSpecResult] = useState<AudioSpecificAnalysisResult | null>(null);
  const [nutritionResult, setNutritionResult] = useState<NutritionAnalysisResult | null>(null);
  
  const [isProcessingSpec, setIsProcessingSpec] = useState(false);

  // Vision Module Refs
  const visionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-request location for Emergency Maps features
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Geolocation denied or error", err)
      );
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: FileData[] = (Array.from(e.target.files) as File[]).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'pdf'
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input to allow selecting the same file again if needed
    if (e.target) e.target.value = '';
  };

  // OCR Medication Scan Handler
  const handleMedScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsScanningMeds(true);
      setScannedMedResult(null); // Reset prev result
      try {
        const medInfo = await analyzeMedicationImage(file);
        setScannedMedResult(medInfo);
        setShowMedScanModal(true);
      } catch (err) {
        console.error("Scan error", err);
        alert("Impossible d'analyser le médicament. Assurez-vous que l'image est nette.");
      } finally {
        setIsScanningMeds(false);
        e.target.value = '';
      }
    }
  };
  
  const confirmScannedMedication = () => {
    if (scannedMedResult) {
        setCurrentMeds(prev => prev ? `${prev}, ${scannedMedResult.nom}` : scannedMedResult.nom);
        setShowMedScanModal(false);
        setScannedMedResult(null);
    }
  };

  // --- ROBUST AUDIO RECORDING UTILS ---
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', // Safari 
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // let browser decide default
  };

  const startRecording = async () => {
    setVoiceResult(null); // Reset previous voice result
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = getSupportedMimeType() ? { mimeType: getSupportedMimeType() } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Use correct extension based on mime
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const audioFile = new File([audioBlob], `analyse_vocale.${ext}`, { type: mimeType });
        
        const newFile: FileData = {
            file: audioFile,
            preview: URL.createObjectURL(audioBlob),
            type: 'audio'
        };
        setFiles(prev => [...prev, newFile]);
        
        // Clean up tracks
        stream.getTracks().forEach(track => track.stop());

        // IMMEDIATE VOICE ANALYSIS
        setIsAnalyzingVoice(true);
        try {
            const vResult = await analyzeVoiceSample(audioFile);
            setVoiceResult(vResult);
            if (vResult.transcription && vResult.transcription.trim().length > 2) {
                setDescription(prev => {
                    if (prev.includes(vResult.transcription)) return prev;
                    const separator = prev ? "\n\n" : "";
                    return `${prev}${separator}[Transcription Vocale]: ${vResult.transcription}`;
                });
            }
        } catch (e) {
            console.error("Voice Analysis Failed", e);
        } finally {
            setIsAnalyzingVoice(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error", err);
      setError("Impossible d'accéder au micro. Vérifiez vos permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- SPECIALIZED MODULES HANDLERS ---
  
  const handleBodyAnalysis = async () => {
    setIsProcessingSpec(true);
    try {
      const res = await analyzeBodyMetrics(bodyMetrics, mode);
      setBodyResult(res);
      // Inject result into description for global context
      setDescription(prev => `${prev}\n\n[Données Corporelles]: IMC ${res.imc}, Santé ${res.score_sante_global}/100. ${res.interpretation}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingSpec(false);
    }
  };

  const handleNutritionAnalysis = async () => {
    setIsProcessingSpec(true);
    try {
      const res = await analyzeNutrition(bodyMetrics);
      setNutritionResult(res);
      setDescription(prev => `${prev}\n\n[Nutrition]: Besoin ${res.besoin_calorique_journalier} kcal. Eau ${res.eau_litres}.`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingSpec(false);
    }
  };

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      // Basic size check (optional but good practice)
      if (file.size > 20 * 1024 * 1024) {
         alert("Fichier trop volumineux. Max 20Mo.");
         e.target.value = '';
         return;
      }
      
      setIsProcessingSpec(true);
      try {
        const res = await analyzeVisionSpecialized(file, mode);
        setVisionResult(res);
        setDescription(prev => `${prev}\n\n[Vision IA]: Gravité ${res.score_gravite}/5. ${res.signes_cutanes}. ${res.respiration_visuelle}`);
      } catch (e) { 
        console.error("Vision Error", e);
        alert("Erreur lors de l'analyse vidéo/image. Réessayez.");
      } finally { 
        setIsProcessingSpec(false); 
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleAudioSpecRecord = async () => {
    // Reset previous result
    setAudioSpecResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = getSupportedMimeType() ? { mimeType: getSupportedMimeType() } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      let chunks: Blob[] = [];

      setIsAudioSpecRecording(true);
      setAudioCountdown(5);

      // Countdown Timer
      const timerInterval = setInterval(() => {
        setAudioCountdown(prev => {
           if (prev <= 1) return 0;
           return prev - 1;
        });
      }, 1000);

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        clearInterval(timerInterval);
        setIsAudioSpecRecording(false);
        
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `spec_audio.${ext}`, { type: mimeType });
        
        setIsProcessingSpec(true);
        try {
          const res = await analyzeAudioSpecialized(file, mode);
          setAudioSpecResult(res);
          setDescription(prev => `${prev}\n\n[Audio IA]: Stress ${res.score_stress}. Respiration ${res.rythme_respiratoire}.`);
        } catch (e) { 
            console.error(e);
            alert("Impossible d'analyser l'audio. Veuillez parler clairement.");
        } finally { 
            setIsProcessingSpec(false); 
        }
        
        stream.getTracks().forEach(t => t.stop());
      };
      
      mediaRecorder.start();
      
      // Safe timeout stop
      setTimeout(() => {
         if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
         }
      }, 5000); 

    } catch (e) { 
        console.error("Spec Audio Error", e); 
        alert("Accès micro refusé ou erreur technique.");
        setIsAudioSpecRecording(false);
    }
  };


  // --- MAIN ANALYSIS LOGIC ---

  const executeAnalysis = async (currentDesc: string) => {
    setStatus('analyzing'); 
    setError(null);

    try {
      const intakeCheck = await assessInformationSufficiency(currentDesc, mode);
      
      if (intakeCheck.status === 'more_info_needed') {
         // Start Conversational Interview
         const questions = intakeCheck.questions || ["Pouvez-vous préciser vos symptômes ?", "Depuis quand ?", "Âge et Sexe ?"];
         setInterviewQuestions(questions);
         setInterviewReason(intakeCheck.raison || "Informations insuffisantes pour une analyse sûre.");
         
         // Initialize conversational state
         setCurrentQuestionIndex(0);
         setCurrentAnswer('');
         setIntakeAnswers([]);
         setStatus('interviewing'); 
         setError(null);
         return; 
      }
      
      await performFullAnalysis(currentDesc);

    } catch (err) {
      console.error(err);
      await performFullAnalysis(currentDesc);
    }
  };

  const handleQuickAnalysis = (e: React.MouseEvent) => {
    e.preventDefault();
    const textLength = description.trim().split(/\s+/).length;
    if (textLength < 3) {
      setError("Veuillez décrire vos symptômes plus précisément avant d'analyser.");
      return;
    }
    setAnalysisSource('quick');
    executeAnalysis(description);
  };

  const handleFullAnalysis = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const hasText = description.trim().length > 0;
    const hasFiles = files.length > 0;
    const hasMeds = currentMeds.trim().length > 0;

    if (!hasText) {
        setError("La description des symptômes est manquante.");
        return;
    }

    if (!hasFiles || !hasMeds) {
        setError("Pour l'analyse COMPLÈTE, remplissez Photos & Traitements. Sinon utilisez 'Analyser les symptômes'.");
        return;
    }

    setAnalysisSource('full');
    executeAnalysis(description);
  };

  // --- NEW: CONVERSATIONAL ANSWER HANDLER ---
  const handleNextQuestion = () => {
    if (!currentAnswer.trim()) return;

    const newAnswers = [...intakeAnswers, { question: interviewQuestions[currentQuestionIndex], answer: currentAnswer }];
    setIntakeAnswers(newAnswers);
    
    if (currentQuestionIndex < interviewQuestions.length - 1) {
       // Go to next question
       setCurrentQuestionIndex(prev => prev + 1);
       setCurrentAnswer('');
    } else {
       // Finish Interview
       finishInterview(newAnswers);
    }
  };

  const finishInterview = async (answers: {question: string, answer: string}[]) => {
     // Compile all Q&A into description
     let transcript = "";
     answers.forEach(item => {
        transcript += `\n[Q: ${item.question} -> R: ${item.answer}]`;
     });
     
     const combinedDescription = `${description}\n\n[Précisions via Triage]:${transcript}`;
     setDescription(combinedDescription);
     
     // Launch Analysis
     await performFullAnalysis(combinedDescription);
  };

  const performFullAnalysis = async (finalDescription: string) => {
    setStatus('analyzing');
    setResult(null);
    setShowFirstAid(false);
    setShowSuggestionModal(false);

    try {
      const fileObjects = files.map(f => f.file);
      const data = await analyzeCase(finalDescription, fileObjects, mode, currentMeds, location);
      setResult(data);
      setStatus('done');
      
      if (data.niveau_urgence.code === 5) {
        setShowFirstAid(true);
      } else {
        // Show suggestions if not critical
        setShowSuggestionModal(true);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'analyse. Vérifiez votre connexion.");
      setStatus('idle');
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setFiles([]);
    setDescription('');
    setAdditionalInfo('');
    setInterviewQuestions([]);
    setCurrentMeds('');
    setMode('adult');
    setStatus('idle');
    setAnalysisSource(null);
    setError(null);
    setIsRecording(false);
    setVoiceResult(null);
    setShowFirstAid(false);
    setShowSuggestionModal(false);
    
    // Reset Specs
    setBodyResult(null);
    setVisionResult(null);
    setAudioSpecResult(null);
    setNutritionResult(null);
    
    // Reset Triage
    setCurrentQuestionIndex(0);
    setCurrentAnswer('');
    setIntakeAnswers([]);
  };

  const handleCloseFirstAid = () => {
    setShowFirstAid(false);
  };

  const canLaunchFullAnalysis = files.length > 0 && currentMeds.trim().length > 0 && description.trim().length > 0;

  // Calculate progress for intake
  const intakeProgress = interviewQuestions.length > 0 
    ? ((currentQuestionIndex + 1) / interviewQuestions.length) * 100 
    : 0;

  // STRICT DARK MODE INPUT STYLE (WHITE TEXT ON BLACK BACKGROUND)
  const darkInputClass = "p-3 border border-slate-700 rounded-xl bg-slate-900 text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all";

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900">
      
      {/* --- MODALS FOR SPECIALIZED MODULES --- */}
      
      {/* 5. MEDICATION SCAN MODAL (NEW) */}
      {showMedScanModal && scannedMedResult && (
         <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-fade-in-up shadow-2xl">
               <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                 <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Pill className="text-teal-600"/> Infos Médicament</h3>
                    <p className="text-xs text-slate-400 mt-1">Analyse visuelle par Gemini IA</p>
                 </div>
                 <button onClick={() => setShowMedScanModal(false)} className="bg-slate-50 p-2 rounded-full hover:bg-slate-100"><X size={20} className="text-slate-600"/></button>
               </div>
               
               <div className="space-y-4">
                  <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100">
                     <span className="text-xs font-bold text-teal-600 uppercase">Médicament Identifié</span>
                     <div className="text-xl font-bold text-teal-900 mt-1">{scannedMedResult.nom}</div>
                  </div>

                  <div className="flex gap-2 items-start">
                     <Info className="text-blue-500 mt-1 flex-shrink-0" size={20}/>
                     <div>
                        <span className="text-sm font-bold text-slate-700">Description</span>
                        <p className="text-sm text-slate-600 leading-snug">{scannedMedResult.description}</p>
                     </div>
                  </div>

                  <div>
                     <span className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2"><Check size={16} className="text-green-500"/> Conseils d'utilisation</span>
                     <ul className="space-y-2">
                        {scannedMedResult.conseils.map((conseil, i) => (
                           <li key={i} className="text-sm bg-slate-50 p-2 rounded-lg text-slate-700 border border-slate-100">
                              {conseil}
                           </li>
                        ))}
                     </ul>
                  </div>

                  {scannedMedResult.avertissements && (
                     <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={20}/>
                        <div>
                           <span className="text-xs font-bold text-amber-600 uppercase">Attention</span>
                           <p className="text-sm text-amber-800 leading-snug">{scannedMedResult.avertissements}</p>
                        </div>
                     </div>
                  )}
                  
                  <div className="pt-2 flex gap-3">
                      <button onClick={() => setShowMedScanModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">
                         Annuler
                      </button>
                      <button onClick={confirmScannedMedication} className="flex-[2] py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-md transition flex items-center justify-center gap-2">
                         <Plus size={18}/> Ajouter au traitement
                      </button>
                  </div>
               </div>
            </div>
         </div>
      )}
      
      {/* 1. Body Modal */}
      {showBodyModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold flex items-center gap-2"><Scale className="text-teal-600"/> Analyse Corporelle</h3>
               <button onClick={() => setShowBodyModal(false)}><X size={24}/></button>
             </div>
             
             {!bodyResult ? (
               <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Âge" className={darkInputClass} value={bodyMetrics.age} onChange={e => setBodyMetrics({...bodyMetrics, age: e.target.value})} />
                    <select className={darkInputClass} value={bodyMetrics.sexe} onChange={e => setBodyMetrics({...bodyMetrics, sexe: e.target.value as any})}>
                      <option value="homme">Homme</option>
                      <option value="femme">Femme</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Poids (kg)" className={darkInputClass} value={bodyMetrics.poids} onChange={e => setBodyMetrics({...bodyMetrics, poids: e.target.value})} />
                    <input type="number" placeholder="Taille (cm)" className={darkInputClass} value={bodyMetrics.taille} onChange={e => setBodyMetrics({...bodyMetrics, taille: e.target.value})} />
                 </div>
                 <select className={`w-full ${darkInputClass}`} value={bodyMetrics.activite} onChange={e => setBodyMetrics({...bodyMetrics, activite: e.target.value as any})}>
                    <option value="sedentaire">Sédentaire (Peu d'exercice)</option>
                    <option value="actif">Actif (1-3 fois/semaine)</option>
                    <option value="sportif">Sportif (3-5 fois/semaine)</option>
                 </select>
                 <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                    <input type="checkbox" checked={bodyMetrics.tabac} onChange={e => setBodyMetrics({...bodyMetrics, tabac: e.target.checked})} />
                    <span>Fumeur ?</span>
                 </label>
                 <button onClick={handleBodyAnalysis} disabled={isProcessingSpec} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold flex justify-center hover:bg-teal-700 transition">
                    {isProcessingSpec ? <Loader2 className="animate-spin"/> : "Calculer & Analyser"}
                 </button>
               </div>
             ) : (
               <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-500">IMC</span>
                    <span className="text-2xl font-bold text-teal-700">{bodyResult.imc.toFixed(1)}</span>
                  </div>
                  <div className="text-sm">{bodyResult.interpretation}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="bg-white p-2 rounded">Cardio: {bodyResult.risque_cardio}</div>
                     <div className="bg-white p-2 rounded">Diabète: {bodyResult.risque_diabete}</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Données ajoutées à l'analyse globale.</div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* 4. Nutrition Modal (NEW) */}
      {showNutritionModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold flex items-center gap-2"><Utensils className="text-lime-600"/> Analyse Alimentation</h3>
               <button onClick={() => setShowNutritionModal(false)}><X size={24}/></button>
             </div>
             
             {!nutritionResult ? (
               <div className="space-y-3 animate-fade-in">
                 <p className="text-sm text-slate-500 mb-2">Calculateur de calories et macros précis.</p>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Âge" className={darkInputClass} value={bodyMetrics.age} onChange={e => setBodyMetrics({...bodyMetrics, age: e.target.value})} />
                    <select className={darkInputClass} value={bodyMetrics.sexe} onChange={e => setBodyMetrics({...bodyMetrics, sexe: e.target.value as any})}>
                      <option value="homme">Homme</option>
                      <option value="femme">Femme</option>
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Poids (kg)" className={darkInputClass} value={bodyMetrics.poids} onChange={e => setBodyMetrics({...bodyMetrics, poids: e.target.value})} />
                    <input type="number" placeholder="Taille (cm)" className={darkInputClass} value={bodyMetrics.taille} onChange={e => setBodyMetrics({...bodyMetrics, taille: e.target.value})} />
                 </div>

                 {/* NEW GOAL SELECTOR */}
                 <div className="p-3 border rounded-xl bg-slate-50">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2"><Target size={14}/> Votre Objectif</label>
                    <div className="flex gap-2">
                       {['perte', 'maintien', 'prise'].map((obj) => (
                           <button 
                             key={obj}
                             onClick={() => setBodyMetrics({...bodyMetrics, objectif: obj as any})}
                             className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${bodyMetrics.objectif === obj ? 'bg-lime-500 text-white shadow-sm' : 'bg-slate-900 text-white border border-slate-700 opacity-60 hover:opacity-100'}`}
                           >
                             {obj === 'perte' ? 'Perdre' : obj === 'prise' ? 'Prendre' : 'Maintien'}
                           </button>
                       ))}
                    </div>
                 </div>

                 {/* NEW FREQUENCY SELECTOR */}
                 <div className="p-3 border rounded-xl bg-slate-50">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2"><Dumbbell size={14}/> Activité Sportive</label>
                    <select 
                      className={`w-full ${darkInputClass}`}
                      value={bodyMetrics.frequence_sport} 
                      onChange={e => setBodyMetrics({...bodyMetrics, frequence_sport: e.target.value})}
                    >
                      <option value="0 jours/semaine">Aucun sport (Sédentaire)</option>
                      <option value="1-2 jours/semaine">1-2 jours / semaine</option>
                      <option value="3-4 jours/semaine">3-4 jours / semaine</option>
                      <option value="5-6 jours/semaine">5-6 jours / semaine</option>
                      <option value="7 jours/semaine">Tous les jours (Intense)</option>
                    </select>
                 </div>
                 
                 <button onClick={handleNutritionAnalysis} disabled={isProcessingSpec} className="w-full bg-lime-600 text-white py-3 rounded-xl font-bold flex justify-center hover:bg-lime-700 transition shadow-md">
                    {isProcessingSpec ? <Loader2 className="animate-spin"/> : "Calculer le Plan"}
                 </button>
               </div>
             ) : (
               <div className="space-y-4 animate-fade-in">
                  <div className="bg-lime-50 rounded-2xl p-4 text-center border border-lime-100 relative overflow-hidden">
                    <div className="text-xs text-lime-600 font-bold uppercase mb-1">Cible Calorique Journalière</div>
                    <div className="text-4xl font-black text-lime-700 tracking-tight">{nutritionResult.besoin_calorique_journalier} kcal</div>
                    <div className="text-xs font-medium text-lime-800 bg-lime-200/50 inline-block px-2 py-1 rounded-lg mt-2">{nutritionResult.objectif_sante}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                     <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Protéines</div>
                        <div className="font-bold text-slate-800 text-lg">{nutritionResult.proteines_g}g</div>
                     </div>
                     <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Glucides</div>
                        <div className="font-bold text-slate-800 text-lg">{nutritionResult.glucides_g}g</div>
                     </div>
                     <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Lipides</div>
                        <div className="font-bold text-slate-800 text-lg">{nutritionResult.lipides_g}g</div>
                     </div>
                  </div>

                  <div className="bg-sky-50 p-3 rounded-xl flex items-center gap-3 border border-sky-100">
                     <Droplets className="text-sky-500"/>
                     <div>
                        <div className="text-xs font-bold text-sky-400 uppercase">Hydratation</div>
                        <div className="font-bold text-sky-800">{nutritionResult.eau_litres} par jour</div>
                     </div>
                  </div>

                  <div className="bg-slate-50 border rounded-xl p-3">
                     <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Lightbulb size={12}/> Conseil Nutrition</span>
                     <p className="text-sm text-slate-600 mt-1 leading-snug">{nutritionResult.conseils_repas[0]}</p>
                  </div>
                  <button onClick={() => setNutritionResult(null)} className="w-full text-xs text-slate-400 hover:text-slate-600 mt-2 underline">Modifier les paramètres</button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* 2. Vision Modal */}
      {showVisionModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold flex items-center gap-2"><Eye className="text-indigo-600"/> Vision IA</h3>
               <button onClick={() => setShowVisionModal(false)}><X size={24}/></button>
             </div>
             {!visionResult ? (
                <div className="flex flex-col gap-4">
                   <div className="p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 cursor-pointer hover:bg-slate-50" onClick={() => visionInputRef.current?.click()}>
                      {isProcessingSpec ? <Loader2 className="animate-spin" size={32}/> : <Camera size={32}/>}
                      <span>Prendre photo/vidéo (10s)</span>
                   </div>
                   <input type="file" ref={visionInputRef} className="hidden" accept="image/*,video/*" onChange={handleVisionUpload} />
                   <div className="text-xs text-slate-400 text-center">Analyse peau, respiration, motricité.</div>
                </div>
             ) : (
                <div className="bg-indigo-50 rounded-2xl p-4 space-y-3">
                   <div className="font-bold text-indigo-900">Gravité estimée: {visionResult.score_gravite}/5</div>
                   <div className="text-sm">👀 {visionResult.respiration_visuelle}</div>
                   <div className="text-sm">🩹 {visionResult.signes_cutanes}</div>
                   <div className="text-xs text-indigo-400 mt-2">Données ajoutées à l'analyse globale.</div>
                   
                   <button 
                     onClick={() => setVisionResult(null)} 
                     className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-white text-indigo-600 rounded-xl text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition"
                   >
                      <RefreshCcw size={14}/> Nouvelle Analyse
                   </button>
                </div>
             )}
          </div>
        </div>
      )}

      {/* 3. Audio Modal */}
      {showAudioModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold flex items-center gap-2"><Waves className="text-sky-600"/> Audio IA</h3>
               <button onClick={() => setShowAudioModal(false)}><X size={24}/></button>
             </div>
             {!audioSpecResult ? (
                <div className="flex flex-col gap-4 items-center py-6">
                   <button 
                     onClick={handleAudioSpecRecord} 
                     disabled={isProcessingSpec || isAudioSpecRecording} 
                     className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-all relative ${isAudioSpecRecording ? 'bg-red-500 scale-110' : 'bg-red-500 text-white hover:scale-105'}`}
                   >
                      {isProcessingSpec ? (
                         <Loader2 className="animate-spin text-white" size={32}/>
                      ) : isAudioSpecRecording ? (
                         <>
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                           <span className="relative text-3xl font-bold text-white font-mono">{audioCountdown}</span>
                         </>
                      ) : (
                         <Mic size={32}/>
                      )}
                   </button>
                   <span className={`text-sm font-bold ${isAudioSpecRecording ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                      {isAudioSpecRecording ? "Enregistrement en cours..." : "Appuyez pour enregistrer (5s)"}
                   </span>
                </div>
             ) : (
                <div className="bg-sky-50 rounded-2xl p-4 space-y-3">
                   <div className="font-bold text-sky-900">Stress détecté: {audioSpecResult.score_stress}</div>
                   <div className="text-sm">🫁 {audioSpecResult.rythme_respiratoire}</div>
                   <div className="text-sm">🗣️ Fatigue vocale: {audioSpecResult.fatigue_vocale}</div>
                   <div className="text-xs text-sky-400 mt-2">Données ajoutées à l'analyse globale.</div>
                   
                   <button 
                     onClick={() => setAudioSpecResult(null)} 
                     className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-white text-sky-600 rounded-xl text-sm font-bold border border-sky-200 hover:bg-sky-100 transition"
                   >
                      <RefreshCcw size={14}/> Recommencer
                   </button>
                </div>
             )}
          </div>
        </div>
      )}


      {/* FIRST AID MODAL (Existing) */}
      {showFirstAid && result?.premiers_secours_steps && (
        <FirstAidModal 
          steps={result.premiers_secours_steps} 
          onClose={handleCloseFirstAid} 
        />
      )}

      {/* SUGGESTION POPUP (POST-ANALYSIS) */}
      {showSuggestionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          {/* Backdrop with pointer-events-auto to close when clicking outside if needed, here just transparent */}
          <div className="absolute inset-0 bg-black/20 pointer-events-auto backdrop-blur-[2px]" onClick={() => setShowSuggestionModal(false)}></div>
          
          <div className="relative pointer-events-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 w-full max-w-lg animate-fade-in-up border border-slate-200 m-0 sm:m-4">
             <div className="flex justify-between items-start mb-4">
                <div>
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <Sparkles className="text-amber-500" size={20}/> Compléter le bilan ?
                   </h3>
                   <p className="text-sm text-slate-500 mt-1">
                     Affinez votre diagnostic avec ces modules spécialisés.
                   </p>
                </div>
                <button onClick={() => setShowSuggestionModal(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
                  <X size={20} className="text-slate-500"/>
                </button>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {setShowSuggestionModal(false); setShowBodyModal(true);}} className="p-3 rounded-2xl bg-slate-50 hover:bg-teal-50 border border-slate-100 hover:border-teal-200 transition text-left group">
                   <Calculator className="text-teal-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                   <div className="text-sm font-bold text-slate-700">Corporel</div>
                   <div className="text-[10px] text-slate-400">IMC, Santé</div>
                </button>
                <button onClick={() => {setShowSuggestionModal(false); setShowNutritionModal(true);}} className="p-3 rounded-2xl bg-slate-50 hover:bg-lime-50 border border-slate-100 hover:border-lime-200 transition text-left group">
                   <Utensils className="text-lime-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                   <div className="text-sm font-bold text-slate-700">Alimentation</div>
                   <div className="text-[10px] text-slate-400">Calories, Eau</div>
                </button>
                <button onClick={() => {setShowSuggestionModal(false); setShowVisionModal(true);}} className="p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition text-left group">
                   <Eye className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                   <div className="text-sm font-bold text-slate-700">Vision IA</div>
                   <div className="text-[10px] text-slate-400">Peau, Trauma</div>
                </button>
                <button onClick={() => {setShowSuggestionModal(false); setShowAudioModal(true);}} className="p-3 rounded-2xl bg-slate-50 hover:bg-sky-50 border border-slate-100 hover:border-sky-200 transition text-left group">
                   <Waves className="text-sky-600 mb-2 group-hover:scale-110 transition-transform" size={24}/>
                   <div className="text-sm font-bold text-slate-700">Audio IA</div>
                   <div className="text-[10px] text-slate-400">Stress, Souffle</div>
                </button>
             </div>
             
             <button onClick={() => setShowSuggestionModal(false)} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition">
                Non merci, c'est tout
             </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetAnalysis}>
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform duration-300">
              <Shield size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">Vitalia</h1>
              <span className="text-[10px] text-teal-600 font-medium tracking-wide mt-0.5 block">
                L'expertise clinique instantanée
              </span>
            </div>
          </div>

          <button
            onClick={resetAnalysis}
            className="absolute right-4 top-1/2 -translate-y-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 p-2.5 rounded-full bg-slate-50 text-slate-400 hover:bg-white hover:text-teal-600 hover:shadow-md border border-transparent hover:border-slate-100 transition-all duration-300"
            title="Retour à l'accueil"
          >
            <Home size={22} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        
        {status !== 'done' && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            {/* Disclaimer */}
            <div className="bg-gradient-to-br from-white to-blue-50/50 border border-blue-100 rounded-3xl p-6 mb-8 shadow-xl shadow-blue-500/5 relative overflow-hidden">
              <div className="relative z-10 flex items-start gap-3">
                <BrainCircuit size={28} className="text-indigo-600 mt-1"/>
                <div>
                    <h2 className="text-blue-900 font-bold mb-1 text-lg">
                    IA Médicale Haute Performance
                    </h2>
                    <p className="text-blue-800/70 text-sm leading-relaxed">
                    <strong>boosté par le nouveau modèle de Gemini</strong> : Analyse instantanée, vision X-Ray et détection OCR des traitements.
                    <br/><span className="inline-block mt-2 font-semibold text-blue-900 bg-blue-100/50 px-2 py-0.5 rounded-md text-xs">⚠️ En cas d'urgence vitale, faites le 15.</span>
                    </p>
                </div>
              </div>
            </div>

            {/* INTERVIEW MODE (ONE BY ONE) */}
            {status === 'interviewing' ? (
               <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-teal-900/10 border border-teal-100 animate-fade-in-up transform transition-all relative overflow-hidden">
                 
                 {/* Progress Bar */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
                    <div className="h-full bg-teal-500 transition-all duration-500 ease-out" style={{width: `${intakeProgress}%`}}></div>
                 </div>

                 <div className="flex flex-col items-center text-center mt-4 mb-8">
                    <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4 shadow-inner animate-pulse">
                       <MessageCircleQuestion size={32} />
                    </div>
                    <p className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-2">
                       TRIAGE INTERACTIF • QUESTION {currentQuestionIndex + 1}/{interviewQuestions.length}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-800 leading-tight max-w-lg mx-auto">
                      {interviewQuestions[currentQuestionIndex]}
                    </h3>
                 </div>
                 
                 <div className="w-full max-w-xl mx-auto">
                   <input
                      type="text"
                      className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 outline-none text-slate-800 text-lg transition-all mb-4 text-center"
                      placeholder="Tapez votre réponse ici..."
                      autoFocus
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNextQuestion()}
                   />

                   <button 
                      onClick={handleNextQuestion}
                      disabled={!currentAnswer.trim()}
                      className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                   >
                      {currentQuestionIndex === interviewQuestions.length - 1 ? "Terminer & Analyser" : "Question Suivante"} <ArrowRight size={20} />
                   </button>
                   
                   <p className="text-center text-xs text-slate-400 mt-4">
                     Répondez précisément pour un diagnostic fiable.
                   </p>
                 </div>
               </div>
            ) : (
              /* STANDARD INPUT FORM */
              <div className="space-y-8">
                
                {/* Mode Selectors */}
                <div className="grid grid-cols-3 gap-3">
                   {['adult', 'child', 'sport'].map((m) => (
                       <button 
                       key={m}
                       type="button" 
                       onClick={() => setMode(m as AppMode)}
                       className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${mode === m 
                           ? (m === 'child' ? 'border-pink-500 bg-pink-50 text-pink-800' : m === 'sport' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-teal-500 bg-teal-50 text-teal-800')
                           : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                     >
                       {m === 'adult' ? <User size={24} /> : m === 'child' ? <Baby size={24} /> : <Activity size={24} />}
                       <span className="text-xs font-bold uppercase">{m === 'child' ? 'Enfant' : m === 'sport' ? 'Sport' : 'Adulte'}</span>
                     </button>
                   ))}
                </div>

                {/* Symptoms + NEW QUICK ANALYZE BUTTON */}
                <div className="bg-white p-1 rounded-3xl shadow-lg shadow-slate-200/50 border-2 border-indigo-50 hover:border-indigo-100 transition-all duration-300 relative group">
                  <div className="bg-slate-50/50 p-6 rounded-[20px] pb-16 relative">
                    <label className="block text-lg font-bold text-slate-800 mb-3 ml-1 flex items-center gap-2">
                        <MessageCircleQuestion className="text-indigo-500" size={20} />
                        Décrivez vos symptômes
                    </label>
                    <textarea 
                        className="w-full h-40 p-5 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none text-slate-700 placeholder:text-slate-400 text-lg shadow-inner"
                        placeholder={mode === 'child' ? "Fièvre ? Comportement ? Douleur ?" : "Soyez précis : Âge, Durée, Intensité, Localisation..."}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={status === 'analyzing'}
                    />
                    
                    {/* NEW: Quick Analyze Button embedded in the Text Area */}
                    <div className="absolute bottom-4 left-0 w-full px-6 flex justify-center md:justify-end">
                        <button 
                            onClick={handleQuickAnalysis}
                            disabled={status === 'analyzing' || description.length < 5}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'analyzing' && analysisSource === 'quick' ? (
                                <>
                                  <Loader2 className="animate-spin" size={16} /> Analyse...
                                </>
                            ) : (
                                <>
                                  <Sparkles size={16} /> Analyser les symptômes
                                </>
                            )}
                        </button>
                    </div>
                  </div>
                </div>

                {/* Section Header */}
                <div className="pt-2">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers className="text-teal-500" size={20}/>
                    Dites-nous en plus 
                    <span className="text-sm font-normal text-slate-500 ml-2">(Optionnel)</span>
                  </h3>
                  
                  {/* Medications Input with Intelligent OCR */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wide ml-2 mb-2 flex items-center gap-2">
                        <Pill size={16} className="text-teal-500" />
                        Traitements en cours
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                              type="text" 
                              value={currentMeds}
                              onChange={(e) => setCurrentMeds(e.target.value)}
                              placeholder="Ex: Doliprane 1000mg..."
                              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:border-teal-500 text-slate-700 pr-10"
                          />
                           {isScanningMeds && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <Loader2 className="animate-spin text-teal-600" size={20} />
                              </div>
                           )}
                        </div>
                        
                        <button 
                           type="button"
                           onClick={() => medScanRef.current?.click()}
                           className={`px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl transition-colors flex flex-col items-center justify-center gap-1 border border-indigo-100 min-w-[80px] ${isScanningMeds ? 'opacity-50 cursor-not-allowed' : ''}`}
                           title="Scanner ordonnance ou boîte"
                           disabled={isScanningMeds}
                        >
                           <ScanLine size={20} />
                           <span className="text-[10px] font-bold uppercase">Scanner</span>
                        </button>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          ref={medScanRef} 
                          onChange={handleMedScan}
                        />
                      </div>
                  </div>

                  {/* Multimodal Input */}
                  <div className="space-y-4 mb-6">
                     <label className="text-sm font-bold text-slate-700 uppercase tracking-wide ml-2 flex items-center gap-2">
                        <Camera size={16} className="text-teal-500" />
                        Photos & Audio (Blessures, Peau, Documents...)
                     </label>
                     
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* ADD BUTTON */}
                        <div 
                          onClick={() => status !== 'analyzing' && fileInputRef.current?.click()}
                          className={`aspect-square rounded-2xl border-2 border-dashed border-slate-300 transition-all flex flex-col items-center justify-center gap-3 group bg-slate-50 cursor-pointer hover:border-teal-500 hover:bg-teal-50/50`}
                        >
                           <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform flex items-center justify-center text-slate-400 group-hover:text-teal-500">
                             <Plus size={24} strokeWidth={3} />
                           </div>
                           <span className="text-xs font-bold text-slate-500 group-hover:text-teal-600 uppercase">Ajouter</span>
                        </div>

                        {/* RECORD BUTTON */}
                        <div 
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${isRecording ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-slate-50 hover:border-teal-500 hover:bg-teal-50/50'}`}
                        >
                           <div className={`w-12 h-12 rounded-full shadow-sm border flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-110 animate-pulse border-red-500' : 'bg-white border-slate-100 text-slate-400'}`}>
                             {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={24} strokeWidth={3} />}
                           </div>
                           <span className={`text-xs font-bold uppercase ${isRecording ? 'text-red-500' : 'text-slate-500'}`}>
                             {isRecording ? 'Stop' : 'Vocal'}
                           </span>
                        </div>

                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*,video/*,audio/*,.pdf" />

                        {/* FILE PREVIEWS */}
                        {files.map((file, index) => (
                          <div key={index} className="aspect-square rounded-2xl border border-slate-200 bg-white relative overflow-hidden shadow-sm group">
                            {file.type === 'image' ? (
                              <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
                                 {file.type === 'audio' ? <Mic className="text-teal-500" size={24}/> : <FileText className="text-slate-400" size={24}/>}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-slate-500 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                     </div>
                     
                     {/* Voice Result Card */}
                     {(isAnalyzingVoice || voiceResult) && (
                        <div className="mt-4 bg-indigo-50 rounded-2xl p-4 border border-indigo-100 animate-fade-in shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-indigo-800 font-bold text-sm uppercase">
                                {isAnalyzingVoice ? <Loader2 className="animate-spin text-indigo-600" size={16} /> : <Activity className="text-indigo-600" size={16} />}
                                {isAnalyzingVoice ? "Analyse vocale..." : "Résultat Audio"}
                            </div>
                            {!isAnalyzingVoice && voiceResult && (
                                <div className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-indigo-100 italic">
                                    "{voiceResult.transcription}"
                                </div>
                            )}
                        </div>
                     )}
                  </div>

                  {/* --- NEW SPECIALIZED MODULES BUTTONS --- */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 w-full">
                      <button onClick={() => setShowBodyModal(true)} className={`w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 bg-slate-100 hover:bg-teal-100 text-slate-600 hover:text-teal-700 transition-colors shadow-sm font-semibold text-xs border border-slate-200 ${mode === 'child' ? 'hover:bg-pink-100 hover:text-pink-700' : mode === 'sport' ? 'hover:bg-orange-100 hover:text-orange-700' : ''}`}>
                         <Calculator size={18} className="flex-shrink-0"/> <span className="truncate">Analyse Corporelle</span>
                      </button>
                      <button onClick={() => setShowNutritionModal(true)} className={`w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 bg-slate-100 hover:bg-lime-100 text-slate-600 hover:text-lime-700 transition-colors shadow-sm font-semibold text-xs border border-slate-200`}>
                         <Utensils size={18} className="flex-shrink-0"/> <span className="truncate">Alimentation</span>
                      </button>
                      <button onClick={() => setShowVisionModal(true)} className={`w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 transition-colors shadow-sm font-semibold text-xs border border-slate-200`}>
                         <Eye size={18} className="flex-shrink-0"/> <span className="truncate">Analyse Vision IA</span>
                      </button>
                      <button onClick={() => setShowAudioModal(true)} className={`w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 transition-colors shadow-sm font-semibold text-xs border border-slate-200`}>
                         <Waves size={18} className="flex-shrink-0"/> <span className="truncate">Analyse Audio IA</span>
                      </button>
                  </div>
                </div>

                {/* FULL Analyze Button */}
                <div className="space-y-3">
                    <button
                    onClick={handleFullAnalysis}
                    disabled={status === 'analyzing' || !canLaunchFullAnalysis}
                    className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 
                        ${canLaunchFullAnalysis 
                            ? 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                    {status === 'analyzing' && analysisSource === 'full' ? (
                        <>
                        <Loader2 className="animate-spin" /> Analyse Complète en cours...
                        </>
                    ) : (
                        <>
                        {canLaunchFullAnalysis ? <Shield size={22} /> : <Lock size={20} />} 
                        Lancer l'Analyse Complète
                        </>
                    )}
                    </button>
                    
                    {!canLaunchFullAnalysis && (
                        <p className="text-center text-xs text-slate-400 font-medium">
                            Nécessite <span className="font-bold">Photos/Audio</span> ET <span className="font-bold">Traitements</span> remplis. Sinon, utilisez "Analyser les symptômes" plus haut.
                        </p>
                    )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-center text-sm font-bold border border-red-100 flex items-center justify-center gap-2 animate-pulse">
                    <X size={16} /> {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {status === 'done' && result && (
          <AnalysisResult data={result} />
        )}
      </main>
      
      {/* Floating Chat Bot */}
      <ChatBot />
    </div>
  );
};

export default App;