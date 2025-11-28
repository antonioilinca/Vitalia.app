import React from 'react';

interface UrgencyGaugeProps {
  level: number; // 1 to 5
}

const UrgencyGauge: React.FC<UrgencyGaugeProps> = ({ level }) => {
  const getColor = (lvl: number) => {
    switch (lvl) {
      case 1: return 'bg-emerald-500';
      case 2: return 'bg-lime-500';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-orange-500';
      case 5: return 'bg-red-600 animate-pulse';
      default: return 'bg-slate-300';
    }
  };

  const getLabel = (lvl: number) => {
    switch (lvl) {
      case 1: return 'Non Urgent';
      case 2: return 'Médecin (72h)';
      case 3: return 'Médecin (24h)';
      case 4: return 'SOS Médecin';
      case 5: return 'URGENCE (15/112)';
      default: return 'Inconnu';
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">Niveau d'Urgence</h3>
      <div className="flex space-x-1 w-full max-w-xs mb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all duration-500 ${
              i <= level ? getColor(level) : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
      <div className={`text-xl font-bold ${level >= 5 ? 'text-red-600' : 'text-slate-800'}`}>
        Niveau {level} : {getLabel(level)}
      </div>
    </div>
  );
};

export default UrgencyGauge;
