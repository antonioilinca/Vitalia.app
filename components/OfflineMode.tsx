

import React, { useState } from 'react';
import { firstAidGuides, FirstAidGuide } from '../constants/firstAidData';
import { translations } from '../constants/translations';
import { Language } from '../types';
import { AlertOctagon, ArrowLeft, Phone, HeartPulse, UserX, Droplets, EyeOff, ChevronRight, Activity, WifiOff } from 'lucide-react';

interface OfflineModeProps {
  language: Language;
  onClose?: () => void;
  forced?: boolean;
}

const OfflineMode: React.FC<OfflineModeProps> = ({ language, onClose, forced = false }) => {
  const [selectedGuide, setSelectedGuide] = useState<FirstAidGuide | null>(null);
  const t = translations[language].offline;

  const getIcon = (iconName: string, size = 24) => {
    switch(iconName) {
      case 'HeartPulse': return <HeartPulse size={size} />;
      case 'UserX': return <UserX size={size} />;
      case 'Droplets': return <Droplets size={size} />;
      case 'EyeOff': return <EyeOff size={size} />;
      default: return <Activity size={size} />;
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] bg-slate-900 text-white flex flex-col font-sans animate-fade-in safe-area-inset-bottom`}>
      {/* Header */}
      <div className="p-6 bg-red-600 shadow-xl flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
            {forced ? <WifiOff size={28} className="animate-pulse" /> : <AlertOctagon size={28} />}
            <div>
               <h1 className="text-xl font-black tracking-wider leading-none">{t.guide_title}</h1>
               <span className="text-xs font-medium text-red-200">{forced ? t.title : t.status}</span>
            </div>
         </div>
         
         {/* Hide exit arrow if a guide is selected to prevent accidental exit */}
         {onClose && !forced && !selectedGuide && (
             <button onClick={onClose} className="p-2 bg-red-800 rounded-full hover:bg-red-900 shadow-lg hover:scale-105 transition-transform">
                <ArrowLeft size={20} />
             </button>
         )}
         
         {selectedGuide && (
             <button onClick={() => setSelectedGuide(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 backdrop-blur-md shadow-lg hover:scale-105 transition-transform">
                <span className="text-xs font-bold px-2">{t.back}</span>
             </button>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         {!selectedGuide ? (
           <div className="max-w-2xl mx-auto space-y-4">
              {forced && (
                 <div className="bg-orange-500/20 border-0 shadow-lg shadow-orange-500/10 p-4 rounded-2xl mb-6 text-center">
                    <p className="text-orange-200 font-bold">{t.subtitle}</p>
                 </div>
              )}
              
              <div className="grid gap-4">
                {firstAidGuides.map((guide) => (
                   <button 
                     key={guide.id}
                     onClick={() => setSelectedGuide(guide)}
                     className={`${guide.color} w-full p-6 rounded-3xl shadow-lg hover:shadow-2xl flex items-center justify-between group hover:-translate-y-1 transition-all active:scale-95 border-0`}
                   >
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                            {getIcon(guide.icon, 28)}
                         </div>
                         <span className="text-lg md:text-2xl font-bold text-left">{guide.title[language]}</span>
                      </div>
                      <ChevronRight size={28} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                   </button>
                ))}
              </div>

              <a href="tel:112" className="mt-8 w-full bg-white text-red-600 py-5 rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:bg-red-50 transition-all shadow-xl hover:-translate-y-1 active:scale-95">
                 <Phone size={28} fill="currentColor" /> {t.call_emergency}
              </a>
           </div>
         ) : (
           <div className="max-w-xl mx-auto animate-fade-in-up">
              <div className={`${selectedGuide.color} p-6 rounded-3xl shadow-2xl mb-8 text-center border-0`}>
                 <div className="inline-block p-4 bg-white/20 rounded-full mb-3 backdrop-blur-md shadow-lg">
                   {getIcon(selectedGuide.icon, 48)}
                 </div>
                 <h2 className="text-2xl md:text-3xl font-black">{selectedGuide.title[language]}</h2>
              </div>

              <div className="space-y-6">
                 {selectedGuide.steps[language].map((step, index) => (
                    <div key={index} className="flex gap-4 items-start bg-white/5 p-4 rounded-2xl border-0 shadow-lg">
                       <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-700 font-bold flex items-center justify-center border border-slate-600 shadow-md">
                         {index + 1}
                       </div>
                       <p className="text-lg md:text-xl font-medium leading-snug">{step}</p>
                    </div>
                 ))}
              </div>
              
              <a href="tel:112" className="mt-8 w-full bg-red-600 text-white border-0 shadow-xl shadow-red-600/40 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-700 hover:-translate-y-1 active:scale-95 transition-all">
                 <Phone size={24} /> {t.call_emergency}
              </a>
           </div>
         )}
      </div>
    </div>
  );
};

export default OfflineMode;