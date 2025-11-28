

export interface Hypothesis {
  cause: string;
  probabilite: string;
  justification: string;
}

export interface UrgencyLevel {
  code: number;
  description: string;
}

export interface PrePrescription {
  medicament: string;
  dosage: string;
  frequence: string;
  contre_indications: string;
  interactions: string;
  alternatives: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface PharmaAnalysis {
  interactions: string[];
  risques: string[];
  alternatives: string[];
  confiance: string;
}

export interface EmergencyLocation {
  hopital: string;
  distance: string;
  navigation_link: string;
}

export interface MentalSupport {
  niveau: string;
  recommandations: string[];
  contacts_urgence_mentale: string[];
}

export interface VoiceAnalysisResult {
  transcription: string;
  analyse_biomarqueurs: string;
  conseils_vocaux: string[];
  confiance: string;
}

// NOUVEAUX TYPES POUR MODULES SPÉCIALISÉS

export interface BodyMetrics {
  age: string;
  sexe: 'homme' | 'femme';
  poids: string;
  taille: string;
  activite: 'sedentaire' | 'actif' | 'sportif'; // Legacy compatibility
  frequence_sport: string; // New precise frequency
  objectif: 'perte' | 'maintien' | 'prise'; // New goal
  tabac: boolean;
}

export interface BodyAnalysisResult {
  imc: number;
  masse_grasse_estimee: string;
  risque_cardio: string;
  risque_diabete: string;
  risque_deshydratation: string;
  chronotype: string;
  score_sante_global: number; // sur 100
  interpretation: string;
  conseils: string[];
}

export interface NutritionAnalysisResult {
  metabolisme_base: number; // Calories au repos
  besoin_calorique_journalier: number; // TDEE
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  eau_litres: string;
  objectif_sante: string;
  conseils_repas: string[];
}

export interface VisionAnalysisResult {
  score_gravite: number; // 1-5
  respiration_visuelle: string;
  signes_cutanes: string;
  signes_trauma: string;
  evaluation_neurologique: string;
  recommandations: string[];
}

export interface AudioSpecificAnalysisResult {
  rythme_respiratoire: string;
  score_stress: string; // Bas/Moyen/Elevé
  fatigue_vocale: string;
  interpretation: string;
  recommandations: string[];
}

// NOUVEAU TYPE POUR SCAN MEDICAMENT ENRICHI
export interface ScannedMedicationResult {
  nom: string;
  description: string;
  conseils: string[];
  avertissements: string;
}

export interface MedicalAnalysisResponse {
  status: string;
  resume_patient: string;
  donnees_patient: Record<string, any>;
  symptomes: string;
  vision?: Record<string, any>;
  pdf?: Record<string, any>;
  mode_pediatrie?: string;
  hypotheses_probables: Hypothesis[];
  niveau_urgence: UrgencyLevel;
  drapeaux_rouges: string[];
  plan_actions: string[];
  medicaments_suggeres_OTC: string[];
  pre_ordonnance_IA: PrePrescription | PrePrescription[];
  analyse_medicaments?: PharmaAnalysis;
  risque_desHydratation?: string;
  urgence_proche?: EmergencyLocation;
  support_emotionnel?: MentalSupport;
  questions_suivi: string[];
  rapport_pdf: {
    url: string;
    structure: string;
  };
  confiance: string;
  groundingChunks?: GroundingChunk[];
  premiers_secours_steps?: string[];
}

export interface IntakeResponse {
  status: 'more_info_needed' | 'ok_for_analysis';
  raison?: string;
  questions?: string[];
  message?: string;
}

export interface FileData {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}