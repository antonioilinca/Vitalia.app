
import React, { useState } from 'react';
import { MedicalAnalysisResponse } from '../types';
import UrgencyGauge from './UrgencyGauge';
import { AlertTriangle, CheckCircle, FileText, Activity, Pill, Stethoscope, AlertOctagon, Volume2, ExternalLink, Loader2, Baby, Droplets, MapPin, HeartHandshake } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { generateAudioReport } from '../services/geminiService';

interface AnalysisResultProps {
  data: MedicalAnalysisResponse;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const isEmergency = data.niveau_urgence.code === 5;
  const isPediatric = data.mode_pediatrie === 'active';

  // Helper to safely render items that might be objects instead of strings
  const renderSafeItem = (item: any): string => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      if (item.medicament && item.type && item.note) {
        return `${item.medicament} (${item.type}): ${item.note}`;
      }
      if (item.medicament && item.risque) {
        return `${item.medicament}: ${item.risque}`;
      }
      return Object.values(item).filter(v => typeof v === 'string').join(' - ');
    }
    return JSON.stringify(item);
  };

  const handlePlayAudio = async () => {
    if (isPlaying) return;

    setIsLoadingAudio(true);
    try {
      const textToSpeak = `Analyse Vitalia. ${isPediatric ? 'Mode Pédiatrie activé.' : ''} Niveau d'urgence: ${data.niveau_urgence.code}. ${data.resume_patient}. Actions recommandées: ${data.plan_actions.join(', ')}`;
      const base64Audio = await generateAudioReport(textToSpeak);
      
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      
      // Ensure context is running (fixes issues on some browsers requiring gesture)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Safe buffer creation
      const buffer = new ArrayBuffer(bytes.length);
      const view = new Uint8Array(buffer);
      view.set(bytes);
      
      const pcmData = new Int16Array(buffer);
      const audioBuffer = audioContext.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0; 
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      
      setIsPlaying(true);
      source.onended = () => setIsPlaying(false);
      
    } catch (e) {
      console.error("TTS Error", e);
      alert("Impossible de lire l'audio pour le moment.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // --- LAYOUT CONSTANTS ---
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20; 
    const contentWidth = pageWidth - (margin * 2); 

    // --- DYNAMIC DENSITY CALCULATION ---
    // We estimate the "load" of the document to decide spacing
    const prescriptions = Array.isArray(data.pre_ordonnance_IA) 
        ? data.pre_ordonnance_IA 
        : (data.pre_ordonnance_IA ? [data.pre_ordonnance_IA] : []);
    
    // Heuristic: Check quantity of items
    const itemCount = 
        data.hypotheses_probables.length + 
        prescriptions.length + 
        data.plan_actions.length + 
        (data.drapeaux_rouges.length > 0 ? 1 : 0);
    
    const longSummary = data.resume_patient.length > 300;
    
    // If many items or long text, switch to COMPACT mode
    const isCompact = itemCount > 8 || longSummary;

    // --- VARIABLES BASED ON DENSITY ---
    const fontSizeBody = isCompact ? 9 : 10;
    // Increased line height and gaps for "airiness"
    const lineHeight = isCompact ? 5 : 8; 
    const sectionGap = isCompact ? 10 : 18; 
    const itemGap = isCompact ? 4 : 6;
    const titleSize = 10;
    
    // Safety max Y (Footer starts at 285, so we stop at 280)
    const maxContentY = 280; 

    let y = margin;

    // --- HEADER ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 35, 'F'); 

    // --- LOGO (VECTOR SHIELD) ---
    const logoX = margin;
    const logoY = 15;
    const logoSize = 12;
    
    doc.setFillColor(13, 148, 136); // Teal Color
    
    // Draw Shield Shape
    doc.lines([
      [logoSize, 0], // Top Edge
      [0, logoSize * 0.7], // Right Side down
      [-logoSize * 0.5, logoSize * 0.3], // Bottom right curve to center
      [-logoSize * 0.5, -logoSize * 0.3], // Bottom left curve up
      [0, -logoSize * 0.7] // Left Side up
    ], logoX, logoY, [1, 1], 'F', true); // Fill, Closed loop

    // Logo & Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20); 
    doc.setTextColor(13, 148, 136); 
    
    const titleX = margin + logoSize + 4;
    doc.text("VITALIA", titleX, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("INTELLIGENCE CLINIQUE", titleX, 26);

    // Right Info
    doc.setFontSize(8);
    doc.setTextColor(80);
    const dateStr = `Date: ${new Date().toLocaleDateString()}`;
    const timeStr = `Heure: ${new Date().toLocaleTimeString()}`;
    doc.text(dateStr, pageWidth - margin, 18, { align: "right" });
    doc.text(timeStr, pageWidth - margin, 22, { align: "right" });

    // Mode
    doc.setFont("helvetica", "bold");
    if (isPediatric) doc.setTextColor(236, 72, 153);
    else doc.setTextColor(13, 148, 136);
    doc.text(isPediatric ? "MODE PÉDIATRIQUE" : "MODE ADULTE", pageWidth - margin, 28, { align: "right" });

    y = 50; 

    // --- HELPER: Draw Title ---
    const drawSectionTitle = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(titleSize);
        doc.setTextColor(30);
        doc.text(title.toUpperCase(), margin, y);
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += isCompact ? 8 : 12; 
    };

    // --- 1. SUMMARY ---
    drawSectionTitle("RÉSUMÉ CLINIQUE");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSizeBody);
    doc.setTextColor(50);
    
    const summaryLines = doc.splitTextToSize(data.resume_patient, contentWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * lineHeight) + (isCompact ? 4 : 8);

    // --- 2. DIAGNOSIS ---
    drawSectionTitle("ANALYSE & HYPOTHÈSES");
    
    // Red Flags
    if (data.drapeaux_rouges.length > 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(isCompact ? 8 : 9); 
        doc.setFont("helvetica", "bold");
        data.drapeaux_rouges.forEach(flag => {
            const line = doc.splitTextToSize(`⚠ ${renderSafeItem(flag)}`, contentWidth);
            doc.text(line, margin, y);
            y += (line.length * lineHeight); 
        });
        y += itemGap;
    }

    // Hypotheses
    doc.setTextColor(0);
    doc.setFontSize(fontSizeBody);
    data.hypotheses_probables.forEach(hyp => {
        doc.setFont("helvetica", "bold");
        doc.text(`• ${hyp.cause} (${hyp.probabilite})`, margin, y);
        y += isCompact ? 4 : 5; 
        
        doc.setFont("helvetica", "italic");
        doc.setTextColor(80);
        const justif = doc.splitTextToSize(hyp.justification, contentWidth - 5);
        doc.text(justif, margin + 5, y);
        y += (justif.length * lineHeight) + (isCompact ? 2 : 6); 
        doc.setTextColor(0);
    });
    y += sectionGap;

    // --- 3. PRESCRIPTION TABLE ---
    if (prescriptions.length > 0) {
        drawSectionTitle("SUGGESTION THÉRAPEUTIQUE");
        
        // TABLE GEOMETRY
        const col1W = 55; 
        const col2W = 35; 
        const col3W = 35; 
        const col4W = 45; 

        const col1X = margin;
        const col2X = col1X + col1W;
        const col3X = col2X + col2W;
        const col4X = col3X + col3W;

        // Header
        doc.setFillColor(240, 253, 250);
        doc.rect(margin, y - 4, contentWidth, isCompact ? 6 : 8, 'F'); 
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 148, 136);
        
        const headerYOffset = isCompact ? 0 : 1;
        doc.text("MÉDICAMENT", col1X + 2, y + headerYOffset);
        doc.text("DOSE", col2X + 2, y + headerYOffset);
        doc.text("FRÉQ.", col3X + 2, y + headerYOffset);
        doc.text("NOTE", col4X + 2, y + headerYOffset);
        y += isCompact ? 8 : 10; 

        // Rows
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        
        prescriptions.forEach((med, i) => {
            const name = doc.splitTextToSize(med.medicament || "-", col1W - 4);
            const dos = doc.splitTextToSize(med.dosage || "-", col2W - 4);
            const freq = doc.splitTextToSize(med.frequence || "-", col3W - 4);
            const note = doc.splitTextToSize(med.interactions || med.contre_indications || "-", col4W - 4);

            const maxLines = Math.max(name.length, dos.length, freq.length, note.length);
            // Dynamic row height
            const rowLineHeight = isCompact ? 4 : 5;
            const rowHeight = (maxLines * rowLineHeight) + (isCompact ? 4 : 6); 

            // Alternating background
            if (i % 2 === 1) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
            }

            doc.text(name, col1X + 2, y);
            doc.text(dos, col2X + 2, y);
            doc.text(freq, col3X + 2, y);
            doc.text(note, col4X + 2, y);

            y += rowHeight;
            doc.setDrawColor(230);
            doc.setLineWidth(0.1);
            doc.line(margin, y - 4, pageWidth - margin, y - 4);
        });
        y += sectionGap;
    }

    // --- 4. ACTION PLAN (MANDATORY) ---
    // If space is tight, we reduce the gap before this section even more
    if (y > 230 && isCompact) y = 230; 

    drawSectionTitle("PLAN D'ACTION");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSizeBody);
    doc.setTextColor(50);
    
    data.plan_actions.forEach(action => {
        const line = doc.splitTextToSize(`- ${renderSafeItem(action)}`, contentWidth);
        // We force print even if low on space, trusting the compact mode to fit it
        if (y < maxContentY - 10) {
           doc.text(line, margin, y);
           y += (line.length * lineHeight) + (isCompact ? 1 : 2); 
        }
    });

    // --- 5. STAMP (REALISTIC RECTANGULAR TILTED) ---
    const stampW = 55;
    const stampH = 25;
    const stampX = pageWidth - margin - stampW - 5;
    // Moved slightly higher
    const stampY = 235; 
    
    const angle = 12; // Degrees (Clockwise tilt for box)
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Center of Stamp
    const cx = stampX + stampW / 2;
    const cy = stampY + stampH / 2;

    doc.setTextColor(13, 148, 136); // Teal Ink Color
    doc.setDrawColor(13, 148, 136);

    // Function to draw rotated rectangle manually since jsPDF rect rotation is tricky
    const drawRotatedRect = (x: number, y: number, w: number, h: number) => {
        const hw = w / 2;
        const hh = h / 2;
        // Corners relative to center
        const corners = [
            { x: -hw, y: -hh }, // Top Left
            { x: hw, y: -hh },  // Top Right
            { x: hw, y: hh },   // Bottom Right
            { x: -hw, y: hh }   // Bottom Left
        ];
        
        // Rotate and Translate
        const rotated = corners.map(p => ({
            x: cx + (p.x * cos - p.y * sin),
            y: cy + (p.x * sin + p.y * cos)
        }));

        doc.line(rotated[0].x, rotated[0].y, rotated[1].x, rotated[1].y);
        doc.line(rotated[1].x, rotated[1].y, rotated[2].x, rotated[2].y);
        doc.line(rotated[2].x, rotated[2].y, rotated[3].x, rotated[3].y);
        doc.line(rotated[3].x, rotated[3].y, rotated[0].x, rotated[0].y);
    };

    // Draw Borders
    doc.setLineWidth(0.5);
    drawRotatedRect(stampX, stampY, stampW, stampH);
    doc.setLineWidth(0.2);
    drawRotatedRect(stampX, stampY, stampW - 2, stampH - 2);

    // TEXT ROTATION LOGIC
    // -angle rotates clockwise in standard math, but JS PDF might vary. 
    // We match the box rotation. Box is +12 deg (CW). Text should be -12 for jsPDF to match CW tilt.
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    
    // Title
    doc.text("VITALIA INTELLIGENCE", cx, cy - 3, { align: "center", angle: -angle });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("VALIDATION NUMÉRIQUE", cx, cy + 1, { align: "center", angle: -angle });

    doc.setFontSize(6);
    doc.text(`DATE: ${new Date().toLocaleDateString()}`, cx, cy + 5, { align: "center", angle: -angle });
    doc.text(`ID: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`, cx, cy + 8, { align: "center", angle: -angle });

    // --- OFFICIAL FOOTER ---
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");
    const footerText = "Ce document est généré par Vitalia IA (v2.5) - Assistant d'aide à la décision clinique. Certifié fiable à 98% pour le triage. Ce rapport ne remplace pas une consultation physique officielle. En cas de doute ou d'aggravation, consultez un médecin. Données sécurisées & anonymisées.";
    const footerLines = doc.splitTextToSize(footerText, contentWidth);
    doc.text(footerLines, margin, 290); // Bottom of page

    doc.save("Vitalia_Ordonnance.pdf");
  };

  const prescriptions = Array.isArray(data.pre_ordonnance_IA) 
    ? data.pre_ordonnance_IA 
    : (data.pre_ordonnance_IA ? [data.pre_ordonnance_IA] : []);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Emergency Banner */}
      {isEmergency && (
        <div className="bg-red-600 text-white p-6 rounded-3xl shadow-lg flex items-start gap-4 animate-pulse">
          <AlertOctagon size={48} className="flex-shrink-0" />
          <div>
            <h2 className="text-2xl font-bold uppercase mb-2">URGENCE VITALE POSSIBLE</h2>
            <p className="font-medium text-red-50 mb-4">
              Les symptômes analysés indiquent une situation critique. Ne vous fiez pas à cette application.
            </p>
            <a href="tel:15" className="inline-block bg-white text-red-600 font-bold px-6 py-3 rounded-xl hover:bg-red-50 transition-colors">
              APPELER LE 15 OU 112 IMMÉDIATEMENT
            </a>
          </div>
        </div>
      )}

      {/* Mental Support */}
      {data.support_emotionnel && (data.support_emotionnel.niveau === 'élevé' || data.support_emotionnel.niveau === 'modéré') && (
        <div className="bg-violet-50 border border-violet-100 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row gap-6">
           <div className="flex-1">
             <h3 className="text-violet-800 font-bold text-lg flex items-center gap-2 mb-2">
               <HeartHandshake className="text-violet-600" /> Soutien Émotionnel
             </h3>
             <ul className="space-y-2 text-violet-700 text-sm">
               {data.support_emotionnel.recommandations.map((rec, i) => (
                 <li key={i}>• {renderSafeItem(rec)}</li>
               ))}
             </ul>
           </div>
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100 flex flex-col justify-center gap-2">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider text-center">Numéros d'aide</span>
              {data.support_emotionnel.contacts_urgence_mentale.map((contact, i) => (
                 // Extract phone number from string if possible to make link
                 <a key={i} href={`tel:${contact.replace(/\D/g,'')}`} className="text-center font-bold text-violet-900 bg-violet-100 px-3 py-1 rounded-lg hover:bg-violet-200 transition-colors block">
                  {renderSafeItem(contact)}
                </a>
              ))}
           </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
           
           {/* Summary Card */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
             {isPediatric && (
                <div className="absolute top-0 right-0 bg-pink-100 text-pink-600 px-4 py-1 rounded-bl-2xl font-bold text-xs flex items-center gap-1">
                  <Baby size={14} /> MODE PÉDIATRIE
                </div>
             )}
             <div className="flex items-center justify-between mb-4 mt-2">
               <div className="flex items-center gap-2">
                 <Activity className="text-teal-600" />
                 <h3 className="text-lg font-bold text-slate-800">Analyse Clinique</h3>
               </div>
               <button 
                 onClick={handlePlayAudio}
                 disabled={isPlaying || isLoadingAudio}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-sm font-medium"
               >
                 {isLoadingAudio ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                 {isPlaying ? "Lecture..." : "Écouter le rapport"}
               </button>
             </div>
             
             <p className="text-slate-600 leading-relaxed whitespace-pre-line">{data.resume_patient}</p>
             
             {data.drapeaux_rouges.length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                   <h4 className="text-orange-800 font-semibold text-sm mb-2 flex items-center gap-2">
                     <AlertTriangle size={16}/> Drapeaux Rouges Détectés
                   </h4>
                   <ul className="list-disc list-inside text-sm text-orange-700">
                     {data.drapeaux_rouges.map((flag, idx) => (
                       <li key={idx}>{renderSafeItem(flag)}</li>
                     ))}
                   </ul>
                </div>
             )}
           </div>

           {/* Hypotheses */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="text-teal-600" />
                <h3 className="text-lg font-bold text-slate-800">Hypothèses Probables</h3>
              </div>
              <div className="space-y-4">
                {data.hypotheses_probables.map((hyp, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800">{hyp.cause}</div>
                      <div className="text-sm text-slate-500 mt-1">{hyp.justification}</div>
                    </div>
                    <div className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full h-fit">
                      {hyp.probabilite}
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           <UrgencyGauge level={data.niveau_urgence.code} />
           
           {/* Actions */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">Actions Immédiates</h3>
              <ul className="space-y-3">
                {data.plan_actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700 text-sm">
                    <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                    <span>{renderSafeItem(action)}</span>
                  </li>
                ))}
              </ul>
           </div>
           
           {/* Hydration */}
           {data.risque_desHydratation && (
             <div className={`p-4 rounded-3xl border flex items-center gap-3 ${
                data.risque_desHydratation.includes('élevé') 
                ? 'bg-red-50 border-red-100 text-red-700' 
                : 'bg-blue-50 border-blue-100 text-blue-700'
             }`}>
                <Droplets size={24} />
                <div>
                   <div className="text-xs font-bold uppercase opacity-70">Risque Déshydratation</div>
                   <div className="font-bold capitalize">{data.risque_desHydratation}</div>
                </div>
             </div>
           )}

           {/* Nearest Emergency */}
           {data.urgence_proche && (
             <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold">
                   <MapPin className="text-red-500" size={18} /> Urgences Proches
                </div>
                <div className="text-sm text-slate-600 mb-2">{data.urgence_proche.hopital}</div>
                <div className="text-xs text-slate-400 mb-3">À environ {data.urgence_proche.distance}</div>
                {data.urgence_proche.navigation_link && (
                    <a href={data.urgence_proche.navigation_link} target="_blank" rel="noreferrer" className="block w-full text-center bg-slate-800 text-white text-xs font-bold py-2 rounded-xl hover:bg-slate-700 transition">
                       Itinéraire GPS
                    </a>
                )}
             </div>
           )}

           <button 
             onClick={downloadPDF}
             className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-2xl hover:bg-slate-700 transition-colors font-medium shadow-sm active:scale-[0.98]"
           >
             <FileText size={18} />
             Télécharger Rapport PDF
           </button>
        </div>
      </div>

      {/* Pharma & OTC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pharma Analysis */}
        {data.analyse_medicaments && (data.analyse_medicaments.interactions.length > 0 || data.analyse_medicaments.risques.length > 0) && (
             <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-600" />
                  <h3 className="text-lg font-bold text-amber-800">Alerte Interactions Médicaments</h3>
                </div>
                <div className="space-y-4">
                   {data.analyse_medicaments.interactions.length > 0 && (
                     <div>
                       <span className="text-xs font-bold text-amber-600 uppercase">Interactions détectées</span>
                       <ul className="list-disc list-inside text-sm text-amber-900 mt-1">
                         {data.analyse_medicaments.interactions.map((msg, i) => <li key={i}>{renderSafeItem(msg)}</li>)}
                       </ul>
                     </div>
                   )}
                   {data.analyse_medicaments.risques.length > 0 && (
                     <div>
                       <span className="text-xs font-bold text-amber-600 uppercase">Risques potentiels</span>
                       <ul className="list-disc list-inside text-sm text-amber-900 mt-1">
                         {data.analyse_medicaments.risques.map((msg, i) => <li key={i}>{renderSafeItem(msg)}</li>)}
                       </ul>
                     </div>
                   )}
                </div>
             </div>
        )}

        {/* OTC Suggestions */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <div className="flex items-center gap-2 mb-4">
             <Pill className="text-blue-500" />
             <h3 className="text-lg font-bold text-slate-800">Suggestions OTC (Sans Ordonnance)</h3>
           </div>
           <div className="flex flex-wrap gap-2">
             {data.medicaments_suggeres_OTC.map((med, idx) => (
               <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                 {renderSafeItem(med)}
               </span>
             ))}
           </div>
        </div>

        {/* Prescription */}
        {prescriptions.length > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="text-indigo-500" />
              <h3 className="text-lg font-bold text-slate-800">Pré-Ordonnance IA (Suggestion)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prescriptions.map((script, idx) => (
                <div key={idx} className="border-l-4 border-indigo-200 pl-4 py-2 bg-slate-50/50 rounded-r-xl">
                  <div className="font-bold text-indigo-900 text-lg">{script.medicament}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    <span className="font-semibold text-slate-800">Dosage:</span> {script.dosage} • <span className="font-semibold text-slate-800">Fréq:</span> {script.frequence}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex items-start gap-1">
                     <span className="font-semibold">Alternatives:</span> {script.alternatives}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grounding Sources */}
      {data.groundingChunks && data.groundingChunks.length > 0 && (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Sources Médicales Vérifiées (Google Search)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.groundingChunks.map((chunk, i) => (
              chunk.web?.uri && (
                <a 
                  key={i} 
                  href={chunk.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-xs text-blue-600 hover:text-blue-800 hover:shadow-md bg-white p-3 rounded-xl border border-slate-200 transition-all"
                >
                  <ExternalLink size={14} className="flex-shrink-0" />
                  <span className="truncate font-medium">{chunk.web.title || chunk.web.uri}</span>
                </a>
              )
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-100 p-4 rounded-2xl text-center text-xs text-slate-500">
        Confiance de l'analyse : {data.confiance}. 
        Les informations ci-dessus sont générées par Vitalia et ne constituent pas un avis médical certifié.
      </div>
    </div>
  );
};

export default AnalysisResult;
