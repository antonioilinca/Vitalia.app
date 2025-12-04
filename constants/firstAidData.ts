

import { Language } from '../types';

export interface FirstAidGuide {
  id: string;
  icon: string; // Lucide icon name placeholder
  title: Record<Language, string>;
  steps: Record<Language, string[]>;
  color: string;
}

export const firstAidGuides: FirstAidGuide[] = [
  {
    id: 'cpr',
    icon: 'HeartPulse',
    color: 'bg-red-500',
    title: {
      fr: "Arrêt cardiaque / RCR",
      en: "Cardiac arrest / CPR",
      ro: "Stop cardiac / RCR"
    },
    steps: {
      fr: [
        "Vérifiez si la victime respire et réagit.",
        "Si non : Appelez immédiatement le 15 ou 112.",
        "Placez les mains au centre de la poitrine (sternum).",
        "Appuyez fort et vite (100-120 compressions/minute).",
        "Enfoncez le thorax de 5 à 6 cm.",
        "Continuez sans arrêt jusqu'à l'arrivée des secours."
      ],
      en: [
        "Check if the victim is breathing and responsive.",
        "If not: Call 911 or 112 immediately.",
        "Place hands in the center of the chest (sternum).",
        "Push hard and fast (100-120 compressions/minute).",
        "Compress the chest about 5-6 cm (2 inches).",
        "Continue without stopping until help arrives."
      ],
      ro: [
        "Verificați dacă victima respiră și reacționează.",
        "Dacă nu: Sunați imediat la 112.",
        "Așezați mâinile în centrul pieptului (stern).",
        "Apăsați tare și repede (100-120 compresii/minut).",
        "Comprimați toracele aproximativ 5-6 cm.",
        "Continuați fără oprire până la sosirea ajutoarelor."
      ]
    }
  },
  {
    id: 'choking',
    icon: 'UserX',
    color: 'bg-orange-500',
    title: {
      fr: "Étouffement (Heimlich)",
      en: "Choking (Heimlich)",
      ro: "Înecare (Heimlich)"
    },
    steps: {
      fr: [
        "Demandez à la victime de tousser.",
        "Si aucun son ne sort : Penchez la victime en avant.",
        "Donnez 5 claques vigoureuses dans le dos (entre les omoplates).",
        "Si inefficace : Placez votre poing au creux de l'estomac (sous le sternum).",
        "Effectuez 5 compressions vers l'arrière et le haut (Manœuvre de Heimlich).",
        "Alternez 5 claques / 5 compressions."
      ],
      en: [
        "Ask the victim to cough.",
        "If silent: Lean the victim forward.",
        "Give 5 sharp back blows between the shoulder blades.",
        "If ineffective: Place fist just above the navel.",
        "Perform 5 quick upward abdominal thrusts (Heimlich Maneuver).",
        "Alternate 5 back blows / 5 thrusts."
      ],
      ro: [
        "Cereți victimei să tușească.",
        "Dacă nu se aude nimic: Aplecați victima în față.",
        "Aplicați 5 lovituri puternice pe spate (între omoplați).",
        "Dacă nu funcționează: Plasați pumnul deasupra buricului.",
        "Efectuați 5 compresii spre interior și în sus (Manevra Heimlich).",
        "Alternați 5 lovituri / 5 compresii."
      ]
    }
  },
  {
    id: 'bleeding',
    icon: 'Droplets',
    color: 'bg-rose-600',
    title: {
      fr: "Hémorragie sévère",
      en: "Severe bleeding",
      ro: "Hemoragie severă"
    },
    steps: {
      fr: [
        "Appelez le 15 ou 112.",
        "Allongez la victime.",
        "Comprimez la plaie directement avec un tissu propre ou la main.",
        "Maintenez la pression sans relâcher jusqu'à l'arrivée des secours.",
        "Si possible, posez un pansement compressif.",
        "Ne jamais faire de garrot sauf formation spécifique."
      ],
      en: [
        "Call 911 or 112.",
        "Lay the victim down.",
        "Apply direct pressure to the wound with a clean cloth or hand.",
        "Maintain pressure continuously until help arrives.",
        "Apply a pressure bandage if available.",
        "Do NOT apply a tourniquet unless trained."
      ],
      ro: [
        "Sunați la 112.",
        "Așezați victima întinsă.",
        "Aplicați presiune directă pe rană cu o cârpă curată sau cu mâna.",
        "Mențineți presiunea continuu până la sosirea ajutoarelor.",
        "Aplicați un pansament compresiv dacă este posibil.",
        "NU aplicați garou decât dacă aveți instruire."
      ]
    }
  },
  {
    id: 'unconscious',
    icon: 'EyeOff',
    color: 'bg-slate-700',
    title: {
      fr: "Inconscience (PLS)",
      en: "Unconscious (Recovery pos.)",
      ro: "Inconștiență (PLS)"
    },
    steps: {
      fr: [
        "Vérifiez la respiration (le ventre se soulève).",
        "Si elle respire : Placez-la sur le côté (Position Latérale de Sécurité - PLS).",
        "Ouvrez la bouche pour éviter l'étouffement.",
        "Appelez le 112.",
        "Surveillez la respiration en attendant les secours."
      ],
      en: [
        "Check breathing (chest rising).",
        "If breathing: Place in Recovery Position (on their side).",
        "Tilt head back to keep airway open.",
        "Call 911 or 112.",
        "Monitor breathing continuously until help arrives."
      ],
      ro: [
        "Verificați respirația (pieptul se mișcă).",
        "Dacă respiră: Așezați în Poziția Laterală de Siguranță (pe o parte).",
        "Deschideți gura pentru a preveni sufocarea.",
        "Sunați la 112.",
        "Monitorizați respirația continuu până la sosire."
      ]
    }
  }
];