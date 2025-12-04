

import React, { useEffect, useState } from 'react';
import { Phone, CheckCircle, Volume2, VolumeX, AlertOctagon } from 'lucide-react';
import { Language } from '../types';

interface FirstAidModalProps {
  steps: string[];
  onClose: () => void;
  language?: Language;
}

const FirstAidModal: React.FC<FirstAidModalProps> = ({ steps, onClose, language = 'fr' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(true);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Auto-detect language or force based on prop
    if (language === 'en') utterance.lang = 'en-US';
    else if (language === 'ro') utterance.lang = 'ro-RO';
    else utterance.lang = 'fr-FR';
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (isSpeaking) {
      let alertText = "Attention. Urgence vitale détectée. Gardez votre calme. Suivez les instructions. ";
      if (language === 'en') alertText = "Warning. Life threatening emergency detected. Stay calm. Follow instructions. ";
      if (language === 'ro') alertText = "Atenție. Urgență vitală detectată. Păstrați-vă calmul. Urmați instrucțiunile. ";
      
      const fullText = alertText + steps[currentStep];
      speak(fullText);
    }
    return () => window.speechSynthesis.cancel();
  }, [currentStep, steps, language]);

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

  const title = language === 'en' ? 'Emergency' : language === 'ro' ? 'Urgență' : 'Urgence';
  const subTitle = language === 'en' ? 'First aid guide' : language === 'ro' ? 'Ghid prim ajutor' : 'Guide de premiers secours';
  const stepLabel = language === 'en' ? 'Step' : language === 'ro' ? 'Pasul' : 'Étape';
  const nextBtn = language === 'en' ? 'Next step' : language === 'ro' ? 'Pasul următor' : 'Étape suivante';
  const callBtn = language === 'en' ? 'Call 911 / 112' : language === 'ro' ? 'Sună la 112' : 'Appeler le 15 / 112';
  const closeBtn = language === 'en' ? "Close emergency mode (I understand)" : language === 'ro' ? "Închide modul de urgență (Am înțeles)" : "Fermer le mode urgence (J'ai compris)";


  return (
    <div className="fixed inset-0 z-[100] bg-red-600 text-white flex flex-col items-center justify-between p-6 animate-fade-in font-sans">
      
      <div className="w-full flex justify-between items-start mt-4">
         <div className="flex items-center gap-3 animate-pulse">
            <AlertOctagon size={48} className="text-white" strokeWidth={3} />
            <div>
              <h1 className="text-3xl font-black tracking-wider">{title}</h1>
              <p className="text-red-100 font-bold">{subTitle}</p>
            </div>
         </div>
         <button onClick={toggleMute} className="p-3 bg-red-700 rounded-full hover:bg-red-800 transition-all shadow-lg hover:scale-105 active:scale-95">
            {isSpeaking ? <Volume2 size={24} /> : <VolumeX size={24} />}
         </button>
      </div>

      <div className="flex-1 w-full max-w-2xl flex flex-col justify-center gap-8 my-8">
         <div className="bg-white text-slate-900 rounded-[2rem] p-8 shadow-2xl text-center border-4 border-slate-900">
            <div className="text-sm font-bold text-slate-400 tracking-widest mb-4">
                {stepLabel} {currentStep + 1} / {steps.length}
            </div>
            <div className="text-3xl md:text-5xl font-black leading-tight">
               {steps[currentStep]}
            </div>
         </div>

         <div className="flex gap-4">
            <button 
               onClick={nextStep}
               disabled={currentStep === steps.length - 1}
               className="flex-1 bg-slate-900 text-white py-6 rounded-2xl font-bold text-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
            >
               {nextBtn}
            </button>
         </div>
      </div>

      <div className="w-full max-w-2xl mb-6">
         <a href="tel:112" className="w-full bg-white text-red-600 py-6 rounded-3xl font-black text-3xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-black/20 hover:-translate-y-1">
            <Phone size={36} fill="currentColor" /> {callBtn}
         </a>
         <button 
           onClick={onClose} 
           className="w-full mt-4 text-red-200 font-semibold hover:text-white underline py-2 text-sm"
         >
           {closeBtn}
         </button>
      </div>
    </div>
  );
};

export default FirstAidModal;