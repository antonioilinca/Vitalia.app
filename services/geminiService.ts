

import { GoogleGenAI, Modality } from "@google/genai";
import { MedicalAnalysisResponse, IntakeResponse, EmergencyLocation, VoiceAnalysisResult, BodyMetrics, BodyAnalysisResult, VisionAnalysisResult, AudioSpecificAnalysisResult, NutritionAnalysisResult, ScannedMedicationResult, Language, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getLanguageName = (lang: Language): string => {
  switch (lang) {
    case 'en': return 'ENGLISH';
    case 'ro': return 'ROMANIAN';
    default: return 'FRENCH';
  }
};

const getSystemInstructionAnalysis = (lang: Language) => {
  const langName = getLanguageName(lang);
  return `
You are **Vitalia — Senior Clinical AI Specialist**.
TARGET LANGUAGE FOR VALUES: ${langName}.

CRITICAL INSTRUCTION:
**DO NOT TRANSLATE JSON KEYS.** 
KEEP ALL JSON KEYS EXACTLY AS SHOWN IN THE SCHEMA BELOW (e.g., use "hypotheses_probables", NOT "ipoteze_probabile").
ONLY TRANSLATE THE *VALUES* (Strings inside the values).

MISSION:
Provide a HIGH-PRECISION, EVIDENCE-BASED MEDICAL ANALYSIS.
Your goal is to act as a senior doctor performing a differential diagnosis.

PRECISION PROTOCOL:
1. **Analyze Symptoms deeply**: Cross-reference Age, Gender, and Medical History (if provided).
2. **Rule out Red Flags**: Actively look for hidden severity signs (e.g., "silent chest" in asthma, "referred pain" in cardiac issues).
3. **Medication Analysis**: Check strictly for interactions between current meds and symptoms.

IMPORTANT FOR FINAL REPORT (PDF):
- Be EXTREMELY CONCISE but PRECISE. Use medical telegraphic style.
- "resume_patient": Max 2 phrases. accurate clinical summary.
- "plan_actions": Max 5 points. Imperative, actionable steps.

STRICT CLINICAL REFERENCES & URGENCY RULES:
1. **URGENCY LEVEL 5 (CRITICAL) IS STRICTLY RESERVED FOR**: 
   - Cardiac arrest / unconsciousness
   - Massive hemorrhage / Shock state
   - Severe respiratory distress (cyanosis, choking)
   - Stroke signs (FAST)
   
   **NEGATIVE CONSTRAINT**: 
   - IF THE PATIENT IS ABLE TO TYPE/SPEAK CALMLY TO AN APP, IT IS LIKELY **NOT** LEVEL 5.
   - PAIN ALONE (even 10/10) IS NEVER LEVEL 5 unless accompanied by shock/syncope.

OUTPUT JSON SCHEMA (STRICTLY ENFORCE THIS STRUCTURE):
{
  "status": "analysis_complete",
  "resume_patient": "String (Summary in ${langName})",
  "mode_pediatrie": "active" | "inactive",
  "hypotheses_probables": [
     { "cause": "String (${langName})", "probabilite": "String (${langName})", "justification": "String (${langName}) - Explain WHY this fits the data precisely." }
  ],
  "niveau_urgence": { "code": Number (1-5), "description": "String (${langName})" },
  "drapeaux_rouges": ["String (${langName})"],
  "plan_actions": ["String (Imperative, ${langName})"],
  "medicaments_suggeres_OTC": ["String (${langName})"],
  "pre_ordonnance_IA": [ 
      { "medicament": "String", "dosage": "String", "frequence": "String", "contre_indications": "String", "interactions": "String", "alternatives": "String" } 
  ],
  "analyse_medicaments": { 
      "interactions": ["String"], "risques": ["String"], "alternatives": ["String"], "confiance": "String" 
  },
  "risque_desHydratation": "String (Low/Medium/High translated)",
  "urgence_proche": { "hopital": "String", "distance": "String", "navigation_link": "String" },
  "support_emotionnel": { "niveau": "String", "recommandations": ["String"], "contacts_urgence_mentale": ["String"] },
  "questions_suivi": ["String"],
  "premiers_secours_steps": ["String (Step by step guide if Level 5)"],
  "confiance": "String (High/Medium/Low)"
}
`;
};

export const analyzeCase = async (
  description: string, 
  files: File[], 
  mode: 'adult' | 'child' | 'sport', 
  medications: string,
  lang: Language,
  location?: {lat: number, lng: number}
): Promise<MedicalAnalysisResponse> => {
  try {
    const isPediatric = mode === 'child';
    const systemInstruction = getSystemInstructionAnalysis(lang);
    
    let prompt = `
    PATIENT PROFILE: ${mode.toUpperCase()}
    FULL CLINICAL CONTEXT (Including Interview): "${description}"
    CURRENT MEDICATIONS: "${medications}"
    `;

    if (location) {
        prompt += `\nUSER LOCATION: Lat ${location.lat}, Lng ${location.lng} (Use this to find REAL nearby hospitals for 'urgence_proche' if urgency > 3).`;
    }

    if (isPediatric) {
        prompt += `\nWARNING: PEDIATRIC MODE. Adjust dosages and urgency thresholds for a CHILD. Be very careful with meningitis, dehydration, and respiratory distress.`;
    }

    const parts: any[] = [{ text: prompt }];

    // Convert files to inline data
    for (const file of files) {
        const base64Data = await fileToGenerativePart(file);
        parts.push(base64Data);
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.3, // Lower temperature for higher precision/determinism
        }
    });

    const text = response.text || "{}";
    try {
        return JSON.parse(text) as MedicalAnalysisResponse;
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Invalid Response Format");
    }

  } catch (error) {
    console.error("Analysis Error", error);
    throw error;
  }
};

export const assessInformationSufficiency = async (text: string, mode: string, lang: Language): Promise<IntakeResponse> => {
    // Advanced intake prompt for high precision
    const prompt = `
    ACT AS A SENIOR CLINICAL DIAGNOSTICIAN.
    Language: ${getLanguageName(lang)}.
    Patient Mode: ${mode}.
    Input: "${text}".
    
    TASK: Determine if the input is sufficient for a HIGH PRECISION differential diagnosis.
    
    CRITERIA FOR SUFFICIENCY:
    - Onset (When did it start?)
    - Provocation (What makes it worse/better?)
    - Quality (Sharp, dull, burning?)
    - Region (Exact location?)
    - Severity (1-10?)
    - Time (Constant, intermittent?)
    - Associated Symptoms (Nausea, fever, dizziness?)
    
    If the input is vague (e.g., "I have a headache", "My belly hurts"), you MUST return "more_info_needed".
    
    If "more_info_needed":
    - Generate 4 to 6 PRECISE, TARGETED medical questions to rule out serious conditions.
    - Do not ask generic questions like "How are you?". Ask specific things like "Do you have sensitivity to light?", "Is the pain radiating to your arm?".
    
    JSON Schema:
    { "status": "more_info_needed" | "ok_for_analysis", "questions": ["String"], "raison": "String (Why more info is needed, in ${getLanguageName(lang)})" }
    
    IMPORTANT: DO NOT TRANSLATE JSON KEYS.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
};

export const analyzeMedicationImage = async (file: File, lang: Language): Promise<ScannedMedicationResult> => {
    const base64 = await fileToGenerativePart(file);
    const prompt = `
    Analyze this medication image (box, pill, or prescription).
    Extract details and translate values to ${getLanguageName(lang)}.
    
    Identify:
    - Name and Dosage
    - Primary usage (what it treats)
    - Essential Warnings (e.g., don't drive, take with food)
    
    JSON Schema:
    { "nom": "String", "description": "String", "usage_principal": "String", "conseils": ["String"], "avertissements": "String" }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [base64, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const analyzeVoiceSample = async (audioFile: File, lang: Language): Promise<VoiceAnalysisResult> => {
    const base64 = await fileToGenerativePart(audioFile);
    const prompt = `
    Analyze this audio. 
    1. Transcribe the speech to text (${getLanguageName(lang)}).
    2. Analyze biomarkers (cough type, wheezing, breathless speech, pain in voice).
    
    JSON Schema:
    { "transcription": "String", "analyse_biomarqueurs": "String", "conseils_vocaux": ["String"], "confiance": "String" }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [base64, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

// --- SPECIALIZED MODULES ---

export const analyzeBodyMetrics = async (metrics: BodyMetrics, mode: string, lang: Language, imageFile?: File): Promise<BodyAnalysisResult> => {
    const parts: any[] = [];
    
    let prompt = `
    Analyze these detailed body metrics:
    ${JSON.stringify(metrics)}
    Mode: ${mode}.
    Target Language: ${getLanguageName(lang)}.
    
    Calculations required:
    1. Precise BMI.
    2. TDEE (Total Daily Energy Expenditure) implicitly.
    3. Specific health risks (Cardio, Diabetes) based on the profile.
    `;

    if (imageFile) {
        const base64 = await fileToGenerativePart(imageFile);
        parts.push(base64);
        prompt += `
        \nVISUAL ANALYSIS REQUIRED:
        An image has been provided. You MUST analyze this image for visual biomarkers of body composition.
        - Examine facial adiposity (cheek fullness, jawline definition).
        - Examine neck circumference and visible fat deposits.
        - If the body is visible, analyze overall build (endomorph/mesomorph/ectomorph).
        - COMBINE this visual data with the provided numerical weight/height to generate a HIGHLY REALISTIC Body Fat % estimate.
        - DO NOT just rely on the formula. Adjust the calculation based on the visual evidence.
        `;
    } else {
        prompt += `\n2. Estimated Body Fat % based on age/gender/activity (Use Navy or Jackson-Pollock approximations contextually).`;
    }

    parts.push({ text: prompt });
    
    prompt += `
    JSON Schema:
    { "imc": Number, "masse_grasse_estimee": "String", "risque_cardio": "String", "risque_diabete": "String", "risque_deshydratation": "String", "chronotype": "String", "score_sante_global": Number (0-100), "interpretation": "String", "conseils": ["String"] }
    `;
    
    // Update contents to include prompt in the parts array if image exists, or just text if not
    const contents = imageFile ? { parts: [...parts, { text: `JSON Schema:
    { "imc": Number, "masse_grasse_estimee": "String", "risque_cardio": "String", "risque_diabete": "String", "risque_deshydratation": "String", "chronotype": "String", "score_sante_global": Number (0-100), "interpretation": "String", "conseils": ["String"] }` }] } : prompt;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const analyzeNutrition = async (metrics: BodyMetrics, lang: Language): Promise<NutritionAnalysisResult> => {
    const prompt = `
    Calculate Personalized Nutrition Plan.
    Metrics: ${JSON.stringify(metrics)}.
    Target Language: ${getLanguageName(lang)}.
    
    Logic:
    - Calculate BMR (Mifflin-St Jeor).
    - Apply Activity Multiplier.
    - Adjust for Goal (Loss: -500kcal, Gain: +300kcal, Maintain: 0).
    - Protein: High for 'sport/athletic' or 'gain'.
    
    JSON Schema:
    { "metabolisme_base": Number, "besoin_calorique_journalier": Number, "proteines_g": Number, "glucides_g": Number, "lipides_g": Number, "eau_litres": "String", "objectif_sante": "String", "conseils_repas": ["String"] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const analyzeVisionSpecialized = async (file: File, mode: string, lang: Language): Promise<VisionAnalysisResult> => {
    const base64 = await fileToGenerativePart(file);
    const prompt = `
    Advanced Medical Vision Analysis.
    Mode: ${mode}.
    Language: ${getLanguageName(lang)}.
    
    Task:
    1. Identify image type: Skin lesion? X-Ray? Medical Document? External Wound?
    2. If Skin/Wound: Analyze color, borders, symmetry (ABCD rule for melanoma if relevant), inflammation.
    3. If Document: Extract key medical findings.
    
    JSON Schema:
    { "score_gravite": Number (1-5), "respiration_visuelle": "String", "signes_cutanes": "String", "signes_trauma": "String", "evaluation_neurologique": "String", "recommandations": ["String"] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [base64, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

export const analyzeAudioSpecialized = async (file: File, mode: string, lang: Language): Promise<AudioSpecificAnalysisResult> => {
    const base64 = await fileToGenerativePart(file);
    const prompt = `
    Deep Bio-Acoustic Analysis (Max 30s sample).
    Mode: ${mode}.
    Language: ${getLanguageName(lang)}.
    
    Analyze:
    1. Breathing Pattern (Regular, Wheezing, Stridor, Agonal).
    2. Voice Stress (Jitter, Shimmer indicators - qualitative).
    3. Cough characteristics (Dry, Wet, Barking).
    
    JSON Schema:
    { "rythme_respiratoire": "String", "score_stress": "String (Low/Medium/High)", "fatigue_vocale": "String", "interpretation": "String", "recommandations": ["String"] }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [base64, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
};

// --- CHAT & UTILS ---

export const chatWithAi = async (history: any[], newMessage: string, lang: Language, location?: {lat: number, lng: number}): Promise<string> => {
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: {
            systemInstruction: `You are MedAI. Language: ${getLanguageName(lang)}. Helpful, concise medical assistant. If location provided, use Google Maps tool for places.`,
            tools: location ? [{ googleMaps: {} }] : undefined,
            toolConfig: location ? { retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } } } : undefined
        }
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "";
};

export const generateAudioReport = async (text: string, lang: Language): Promise<string> => {
    const voiceName = lang === 'en' ? 'Fenrir' : 'Kore';
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text: text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            }
        }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No audio data");
    return audioData;
};

// Helper
const fileToGenerativePart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
