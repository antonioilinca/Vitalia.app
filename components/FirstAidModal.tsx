
import React, { useEffect, useState } from 'react';
import { Phone, CheckCircle, Volume2, VolumeX, AlertOctagon } from 'lucide-react';

interface FirstAidModalProps {
  steps: string[];
  onClose: () => void;
}

const FirstAidModal: React.FC<FirstAidModalProps> = ({ steps, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(true);

  // Use browser SpeechSynthesis for IMMEDIATE low-latency response in emergency
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Announce emergency immediately
    if (isSpeaking) {
      const fullText = "Attention. Urgence vitale détectée. Gardez votre calme. Suivez les instructions. " + steps[currentStep];
      speak(fullText);
    }
    return () => window.speechSynthesis.cancel();
  }, [currentStep, steps]); // Re-speak when step changes

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const toggleMute = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speak(steps[currentStep]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-red-600 text-white flex flex-col items-center justify-between p-6 animate-fade-in font-sans">
      
      {/* Header Alert */}
      <div className="w-full flex justify-between items-start mt-4">
         <div className="flex items-center gap-3 animate-pulse">
            <AlertOctagon size={48} className="text-white" strokeWidth={3} />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">URGENCE</h1>
              <p className="text-red-100 font-bold">GUIDE DE PREMIERS SECOURS</p>
            </div>
         </div>
         <button onClick={toggleMute} className="p-3 bg-red-700 rounded-full hover:bg-red-800 transition">
            {isSpeaking ? <Volume2 size={24} /> : <VolumeX size={24} />}
         </button>
      </div>

      {/* Main Instruction Card */}
      <div className="flex-1 w-full max-w-2xl flex flex-col justify-center gap-8 my-8">
         <div className="bg-white text-slate-900 rounded-[2rem] p-8 shadow-2xl text-center border-4 border-slate-900">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">ÉTAPE {currentStep + 1} / {steps.length}</div>
            <div className="text-3xl md:text-5xl font-black leading-tight">
               {steps[currentStep]}
            </div>
         </div>

         {/* Navigation */}
         <div className="flex gap-4">
            <button 
               onClick={nextStep}
               disabled={currentStep === steps.length - 1}
               className="flex-1 bg-slate-900 text-white py-6 rounded-2xl font-bold text-xl hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
               ÉTAPE SUIVANTE
            </button>
         </div>
      </div>

      {/* Emergency Call Button */}
      <div className="w-full max-w-2xl mb-6">
         <a href="tel:15" className="w-full bg-white text-red-600 py-6 rounded-3xl font-black text-3xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-transform shadow-xl">
            <Phone size={36} fill="currentColor" /> APPELER LE 15 / 112
         </a>
         <button 
           onClick={onClose} 
           className="w-full mt-4 text-red-200 font-semibold hover:text-white underline py-2 text-sm"
         >
           Fermer le mode urgence (J'ai compris)
         </button>
      </div>
    </div>
  );
};

export default FirstAidModal;
