

import { GoogleGenAI, Modality } from "@google/genai";
import { MedicalAnalysisResponse, IntakeResponse, EmergencyLocation, VoiceAnalysisResult, BodyMetrics, BodyAnalysisResult, VisionAnalysisResult, AudioSpecificAnalysisResult, NutritionAnalysisResult, ScannedMedicationResult } from "../types";

const SYSTEM_INSTRUCTION_ANALYSIS = `
Tu es **Vitalia — Assistant Médical IA Clinique**.

TA MISSION :
Fournir une analyse de triage MÉDICALE BASÉE SUR DES PREUVES.

IMPORTANT POUR LE RAPPORT FINAL (PDF) :
- Sois EXTRÊMEMENT CONCIS. Utilise un style télégraphique médical.
- "resume_patient": Max 2 phrases. Va à l'essentiel.
- "plan_actions": Max 4 points. Phrases courtes impératives. (DOIT TOUJOURS ÊTRE REMPLI, MÊME EN PÉDIATRIE).
- Le but est que tout tienne sur une seule page A4 aérée.

RÉFÉRENCES CLINIQUES STRICTES :
1. ÉCHELLE DE TRIAGE (URGENCE 1-5).
2. FORMAT DE RÉPONSE JSON STRICT.

PROTOCOL "VISION X-RAY" (OBLIGATOIRE SI IMAGES PRÉSENTES) :
1. Analyse Pixel par Pixel.
2. SIGNES VITAUX : Cherche Cyanose, Marbrures, Purpura.
3. TRAUMA : Déformation, Plaie, Brûlure.

FORMAT DE RÉPONSE JSON (Strict) :
{
"status": "ok",
"resume_patient": "Synthèse ultra-courte (Age, Sexe, Symptôme majeur, Durée).",
"mode_pediatrie": "active" ou null,
"donnees_patient": {},
"symptomes": "...",
"hypotheses_probables": [
{"cause": "Pathologie", "probabilite": "Haute", "justification": "Justification courte."}
],
"niveau_urgence":{
"code": 1 à 5,
"description": "Selon triage."
},
"drapeaux_rouges":["Alerte 1", "Alerte 2"],
"plan_actions":["Action 1 (Court)", "Action 2 (Court)", "Action 3 (Court)"],
"medicaments_suggeres_OTC":["Nom molécule"],
"pre_ordonnance_IA": [
    {
    "medicament":"Nom",
    "dosage":"Dose",
    "frequence":"Freq",
    "contre_indications":"CI courtes",
    "interactions":"Interactions courtes",
    "alternatives":"Alt courtes"
    }
],
"analyse_medicaments": {
  "interactions": [],
  "risques": [],
  "alternatives": [],
  "confiance": "..."
},
"risque_desHydratation": "faible/modéré/élevé",
"urgence_proche": null,
"support_emotionnel":{
  "niveau": "bas/modéré/élevé",
  "recommandations":[],
  "contacts_urgence_mentale": []
},
"premiers_secours_steps": ["ETAPE 1 COURTE", "ETAPE 2 COURTE"],
"questions_suivi":["Question 1"],
"confiance":"XX%"
}
`;

const SYSTEM_INSTRUCTION_INTAKE = `
Tu es un **CLINICIEN DE TRIAGE EXPERT (Intelligent & Adaptatif)**.
OBJECTIF : Déterminer si les infos suffisent pour un diagnostic sûr, sinon poser des questions CIBLÉES.

1. ANALYSE LE PROFIL & CONTEXTE :
- Si Mode = ENFANT : Vérifie fièvre, hydratation, comportement, respiration.
- Si Mode = ADULTE : Vérifie antécédents, facteurs de risque, localisation.
- Si Mode = SPORT : Vérifie mécanisme, mobilité.

2. DÉCISION :
- Si description vague -> STATUS: more_info_needed.
- Si description riche -> STATUS: ok_for_analysis.

3. GÉNÉRATION DE QUESTIONS (Si more_info_needed) :
- Génère une liste de 3 à 10 questions MAX, ordonnées par priorité.
- Questions COURTES et DIRECTES.

FORMAT JSON :
{
  "status": "more_info_needed" | "ok_for_analysis",
  "raison": "Explication courte",
  "questions": ["Question 1", "Question 2"]
}
`;

const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeBodyMetrics = async (data: BodyMetrics, mode: string): Promise<BodyAnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
  Agis comme un Physiologiste Expert. Analyse ces données pour un patient mode '${mode}'.
  Données: ${JSON.stringify(data)}.
  
  Calculs requis: IMC, Masse grasse (YMCA/RFM), Risques, Score Santé.
  
  JSON Strict:
  {
    "imc": number,
    "masse_grasse_estimee": "XX %",
    "risque_cardio": "Court",
    "risque_diabete": "Court",
    "risque_deshydratation": "Bas/Haut",
    "chronotype": "Matin/Soir",
    "score_sante_global": number,
    "interpretation": "Phrase courte",
    "conseils": ["Conseil 1", "Conseil 2"]
  }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.1 }
  });

  return JSON.parse(response.text) as BodyAnalysisResult;
};

// --- MODULE 1.5: ANALYSE NUTRITIONNELLE (AMÉLIORÉ) ---
export const analyzeNutrition = async (data: BodyMetrics): Promise<NutritionAnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
  Agis comme un Nutritionniste Sportif Expert. 
  Profil Patient: 
  - Sexe: ${data.sexe}
  - Poids: ${data.poids}kg, Taille: ${data.taille}cm, Age: ${data.age}
  - Fréquence Sport: ${data.frequence_sport}
  - OBJECTIF: ${data.objectif} (IMPORTANT)
  
  CALCULE PRÉCISÉMENT :
  1. TDEE (Maintenance) selon l'activité déclarée.
  2. Ajuste les calories selon l'OBJECTIF (Déficit -300/500 si perte, Surplus +300 si prise, TDEE si maintien).
  3. Macros adaptés à l'objectif.
  
  JSON Strict:
  {
    "metabolisme_base": number (kcal),
    "besoin_calorique_journalier": number (kcal final avec objectif),
    "proteines_g": number,
    "glucides_g": number,
    "lipides_g": number,
    "eau_litres": "Ex: 2.5 L",
    "objectif_sante": "Phrase courte résumant la stratégie (ex: Déficit calorique modéré)",
    "conseils_repas": ["Conseil 1", "Conseil 2"]
  }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.1 }
  });

  return JSON.parse(response.text) as NutritionAnalysisResult;
};

export const analyzeVisionSpecialized = async (file: File, mode: string): Promise<VisionAnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const filePart = await fileToPart(file);

  const prompt = `
  Expert Vision Médicale (${mode}). Analyse l'image ou la vidéo fournie.
  SI L'IMAGE EST FLOU OU INVISIBLE : Réponds avec un score de gravité bas et mentionne "Qualité insuffisante" dans les champs.
  
  JSON Strict:
  {
    "score_gravite": number (1-5),
    "respiration_visuelle": "Observation respiration (si visible) ou 'Non visible'",
    "signes_cutanes": "Observation peau (si visible)",
    "signes_trauma": "Observation trauma ou 'Rien de visible'",
    "evaluation_neurologique": "Court",
    "recommandations": ["Action 1", "Action 2"]
  }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [filePart, { text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.0 }
  });

  return JSON.parse(response.text) as VisionAnalysisResult;
};

export const analyzeAudioSpecialized = async (file: File, mode: string): Promise<AudioSpecificAnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const filePart = await fileToPart(file);

  const prompt = `
  Expert ORL et Pneumologie (${mode}). Analyse cet audio (souffle, toux, voix).
  Ignore les bruits de fond mineurs. Si l'audio est silencieux, indique "Audio non exploitable".
  
  JSON Strict:
  {
    "rythme_respiratoire": "Rapide/Lent/Normal ou Non audible",
    "score_stress": "Bas/Moyen/Élevé",
    "fatigue_vocale": "Oui/Non",
    "interpretation": "Synthèse courte",
    "recommandations": ["Conseil 1"]
  }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [filePart, { text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.0 }
  });

  return JSON.parse(response.text) as AudioSpecificAnalysisResult;
};

export const analyzeMedicationImage = async (file: File): Promise<ScannedMedicationResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const filePart = await fileToPart(file);
  
  const prompt = `
  Agis comme un Pharmacien. Analyse cette image (boîte de médicament, blister, flacon ou ordonnance).
  Identifie le médicament visible.
  
  Génère une fiche courte et structurée pour le patient.
  
  JSON Strict:
  {
    "nom": "Nom Exact + Dosage (ex: Doliprane 1000mg)",
    "description": "À quoi ça sert (1 phrase simple)",
    "conseils": ["Conseil prise (ex: pendant repas)", "Conseil conservation"],
    "avertissements": "Contre-indications ou dangers principaux (court)"
  }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: { parts: [filePart, { text: prompt }] },
    config: { responseMimeType: "application/json", temperature: 0.1 }
  });
  
  return JSON.parse(response.text) as ScannedMedicationResult;
};

const findNearestEmergency = async (lat: number, lng: number): Promise<EmergencyLocation | null> => {
  if (!process.env.API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Hôpital le plus proche de Lat: ${lat}, Lng: ${lng}. JSON: { "hopital": "Nom", "distance": "X min", "navigation_link": "url" }`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: { tools: [{ googleMaps: {} }], toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }, temperature: 0.0 }
    });
    const text = response.text;
    if (!text) return null;
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as EmergencyLocation;
  } catch (e) { return null; }
};

export const analyzeVoiceSample = async (file: File): Promise<VoiceAnalysisResult> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const filePart = await fileToPart(file);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: { parts: [filePart, { text: "Transcription et analyse courte. JSON: {transcription, analyse_biomarqueurs, conseils_vocaux[], confiance}" }] },
      config: { responseMimeType: "application/json", temperature: 0.0 }
    });
    return JSON.parse(response.text) as VoiceAnalysisResult;
  } catch (e) { return { transcription: "", analyse_biomarqueurs: "Erreur", conseils_vocaux: [], confiance: "0%" }; }
};

export const assessInformationSufficiency = async (currentDescription: string, mode: string): Promise<IntakeResponse> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contextPrompt = `CONTEXTE: Mode ${mode}. Desc: "${currentDescription}". Analyse suffisance.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: contextPrompt }] },
      config: { systemInstruction: SYSTEM_INSTRUCTION_INTAKE, responseMimeType: "application/json", temperature: 0.1 }
    });
    return JSON.parse(response.text) as IntakeResponse;
  } catch (e) { return { status: 'ok_for_analysis' }; }
};

export const analyzeCase = async (
  description: string,
  files: File[],
  mode: string,
  medications: string,
  location?: { lat: number, lng: number }
): Promise<MedicalAnalysisResponse> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const fileParts = await Promise.all(files.map(fileToPart));
  const contextPrompt = `PATIENT: Mode ${mode}. Meds: ${medications}. Symp: ${description}`;
  const analysisPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [...fileParts, { text: contextPrompt }] },
    config: { systemInstruction: SYSTEM_INSTRUCTION_ANALYSIS, responseMimeType: "application/json", temperature: 0.0 }
  });
  const mapsPromise = location ? findNearestEmergency(location.lat, location.lng) : Promise.resolve(null);
  try {
    const [analysisResponse, mapsResult] = await Promise.all([analysisPromise, mapsPromise]);
    const data = JSON.parse(analysisResponse.text) as MedicalAnalysisResponse;
    if (mapsResult) data.urgence_proche = mapsResult;
    return data;
  } catch (error) { throw error; }
};

export const generateAudioReport = async (text: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const chatWithAi = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  location?: { lat: number, lng: number }
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const tools: any[] = [{ googleSearch: {} }];
  let toolConfig = {};
  if (location) {
    tools.push({ googleMaps: {} });
    toolConfig = { retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } } };
  }
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history as any,
    config: { systemInstruction: 'Assistant médical concis.', tools: tools, toolConfig: Object.keys(toolConfig).length > 0 ? toolConfig : undefined }
  });
  const response = await chat.sendMessage({ message });
  return response.text;
};