import React, { useState, useEffect } from 'react';
import { MedicalAnalysisResponse, Language } from '../types';
import UrgencyGauge from './UrgencyGauge';
import { AlertTriangle, CheckCircle, FileText, Activity, Pill, Stethoscope, AlertOctagon, Volume2, ExternalLink, Loader2, Baby, Droplets, MapPin, HeartHandshake } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { generateAudioReport } from '../services/geminiService';
import { translations } from '../constants/translations';

interface AnalysisResultProps {
  data: MedicalAnalysisResponse;
  language: Language;
  autoPlay?: boolean;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, language, autoPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const t = translations[language];

  // Defensive coding: use optional chaining and defaults strictly
  const urgencyCode = data?.niveau_urgence?.code || 1;
  const isEmergency = urgencyCode === 5;
  const isPediatric = data?.mode_pediatrie === 'active';
  const planActions = data?.plan_actions || [];
  const hypotheses = data?.hypotheses_probables || [];
  const redFlags = data?.drapeaux_rouges || [];
  const resumePatient = data?.resume_patient || "No summary available.";
  
  const renderSafeItem = (item: any): string => {
    if (!item) return "";
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
      let modeText = '';
      if (isPediatric) {
          if (language === 'en') modeText = 'Pediatric mode active.';
          else if (language === 'ro') modeText = 'Modul pediatric activ.';
          else modeText = 'Mode pédiatrie activé.';
      }
      
      let urgencyText = '';
      if (language === 'en') urgencyText = `Urgency level: ${urgencyCode}`;
      else if (language === 'ro') urgencyText = `Nivel de urgență: ${urgencyCode}`;
      else urgencyText = `Niveau d'urgence: ${urgencyCode}`;

      let actionText = '';
      const actionsStr = planActions.join(', ');
      if (language === 'en') actionText = `Recommended actions: ${actionsStr}`;
      else if (language === 'ro') actionText = `Acțiuni recomandate: ${actionsStr}`;
      else actionText = `Actions recommandées: ${actionsStr}`;
      
      const textToSpeak = `Vitalia Analysis. ${modeText} ${urgencyText}. ${resumePatient}. ${actionText}`;
      const base64Audio = await generateAudioReport(textToSpeak, language);
      
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

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
      // alert("TTS Error"); // Suppress alerts for smoother UX
    } finally {
      setIsLoadingAudio(false);
    }
  };
  
  // Auto-play effect for voice interactions
  useEffect(() => {
      if (autoPlay && !isPlaying) {
          handlePlayAudio();
      }
  }, [autoPlay]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20; 
    const contentWidth = pageWidth - (margin * 2); 

    const prescriptions = Array.isArray(data.pre_ordonnance_IA) 
        ? data.pre_ordonnance_IA 
        : (data.pre_ordonnance_IA ? [data.pre_ordonnance_IA] : []);
    
    const itemCount = 
        hypotheses.length + 
        prescriptions.length + 
        planActions.length + 
        (redFlags.length > 0 ? 1 : 0);
    
    const longSummary = resumePatient.length > 300;
    
    const isCompact = itemCount > 8 || longSummary;

    const fontSizeBody = isCompact ? 9 : 10;
    const lineHeight = isCompact ? 5 : 8; 
    const sectionGap = isCompact ? 10 : 18; 
    const itemGap = isCompact ? 4 : 6;
    const titleSize = 10;
    
    const maxContentY = 260; // Leave space for bottom stamp

    let y = margin;

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 35, 'F'); 

    const logoX = margin;
    const logoY = 15;
    const logoSize = 12;
    
    doc.setFillColor(13, 148, 136); 
    
    doc.lines([
      [logoSize, 0], 
      [0, logoSize * 0.7], 
      [-logoSize * 0.5, logoSize * 0.3], 
      [-logoSize * 0.5, -logoSize * 0.3], 
      [0, -logoSize * 0.7] 
    ], logoX, logoY, [1, 1], 'F', true); 

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20); 
    doc.setTextColor(13, 148, 136); 
    
    const titleX = margin + logoSize + 4;
    doc.text(t.title, titleX, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    
    let subTitle = "Intelligence clinique";
    if (language === 'en') subTitle = "Clinical intelligence";
    if (language === 'ro') subTitle = "Inteligență clinică";
    doc.text(subTitle, titleX, 26);

    doc.setFontSize(8);
    doc.setTextColor(80);
    const dateStr = `Date: ${new Date().toLocaleDateString()}`;
    const timeLabel = language === 'en' ? 'Time' : language === 'ro' ? 'Oră' : 'Heure';
    const timeStr = `${timeLabel}: ${new Date().toLocaleTimeString()}`;
    doc.text(dateStr, pageWidth - margin, 18, { align: "right" });
    doc.text(timeStr, pageWidth - margin, 22, { align: "right" });

    doc.setFont("helvetica", "bold");
    if (isPediatric) doc.setTextColor(236, 72, 153);
    else doc.setTextColor(13, 148, 136);
    
    let modeLabel = isPediatric ? "Mode pédiatrique" : "Mode adulte";
    if (language === 'en') modeLabel = isPediatric ? "Pediatric mode" : "Adult mode";
    if (language === 'ro') modeLabel = isPediatric ? "Mod pediatric" : "Mod adult";
    
    doc.text(modeLabel, pageWidth - margin, 28, { align: "right" });

    y = 50; 

    const drawSectionTitle = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(titleSize);
        doc.setTextColor(30);
        doc.text(title, margin, y);
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += isCompact ? 8 : 12; 
    };

    drawSectionTitle(t.pdf.title);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSizeBody);
    doc.setTextColor(50);
    
    const summaryLines = doc.splitTextToSize(resumePatient, contentWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * lineHeight) + (isCompact ? 4 : 8);

    drawSectionTitle(t.pdf.analysis_title);
    
    if (redFlags.length > 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(isCompact ? 8 : 9); 
        doc.setFont("helvetica", "bold");
        redFlags.forEach(flag => {
            const line = doc.splitTextToSize(`⚠ ${renderSafeItem(flag)}`, contentWidth);
            doc.text(line, margin, y);
            y += (line.length * lineHeight); 
        });
        y += itemGap;
    }

    doc.setTextColor(0);
    doc.setFontSize(fontSizeBody);
    hypotheses.forEach(hyp => {
        doc.setFont("helvetica", "bold");
        doc.text(`• ${hyp?.cause || ''} (${hyp?.probabilite || ''})`, margin, y);
        y += isCompact ? 4 : 5; 
        
        doc.setFont("helvetica", "italic");
        doc.setTextColor(80);
        const justif = doc.splitTextToSize(hyp?.justification || '', contentWidth - 5);
        doc.text(justif, margin + 5, y);
        y += (justif.length * lineHeight) + (isCompact ? 2 : 6); 
        doc.setTextColor(0);
    });
    y += sectionGap;

    if (prescriptions.length > 0) {
        drawSectionTitle(t.pdf.therapy_title);
        
        const col1W = 55; 
        const col2W = 35; 
        const col3W = 35; 
        const col4W = 45; 

        const col1X = margin;
        const col2X = col1X + col1W;
        const col3X = col2X + col2W;
        const col4X = col3X + col3W;

        doc.setFillColor(240, 253, 250);
        doc.rect(margin, y - 4, contentWidth, isCompact ? 6 : 8, 'F'); 
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(13, 148, 136);
        
        const headerYOffset = isCompact ? 0 : 1;
        doc.text(t.pdf.med_col, col1X + 2, y + headerYOffset);
        doc.text(t.pdf.dose_col, col2X + 2, y + headerYOffset);
        doc.text(t.pdf.freq_col, col3X + 2, y + headerYOffset);
        doc.text(t.pdf.note_col, col4X + 2, y + headerYOffset);
        y += isCompact ? 8 : 10; 

        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        
        prescriptions.forEach((med, i) => {
            const name = doc.splitTextToSize(med?.medicament || "-", col1W - 4);
            const dos = doc.splitTextToSize(med?.dosage || "-", col2W - 4);
            const freq = doc.splitTextToSize(med?.frequence || "-", col3W - 4);
            const note = doc.splitTextToSize(med?.interactions || med?.contre_indications || "-", col4W - 4);

            const maxLines = Math.max(name.length, dos.length, freq.length, note.length);
            const rowLineHeight = isCompact ? 4 : 5;
            const rowHeight = (maxLines * rowLineHeight) + (isCompact ? 4 : 6); 

            if (i % 2 === 1) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
            }

            // Page break check within prescription loop
            if (y + rowHeight > maxContentY) {
               doc.addPage();
               y = margin;
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

    if (y > maxContentY && isCompact) y = maxContentY; 

    // Actions Section
    if (y < maxContentY) {
      drawSectionTitle(t.pdf.action_title);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSizeBody);
      doc.setTextColor(50);
      
      planActions.forEach(action => {
          const line = doc.splitTextToSize(`- ${renderSafeItem(action)}`, contentWidth);
          if (y + (line.length * lineHeight) < maxContentY) {
            doc.text(line, margin, y);
            y += (line.length * lineHeight) + (isCompact ? 1 : 2); 
          }
      });
    }

    // --- BOTTOM STAMP (Moved to absolute bottom) ---
    const stampW = 55;
    const stampH = 25;
    const stampX = pageWidth - margin - stampW - 5;
    const stampY = 265; // Fixed position at bottom
    
    const angle = 12; 
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const cx = stampX + stampW / 2;
    const cy = stampY + stampH / 2;

    doc.setTextColor(13, 148, 136); 
    doc.setDrawColor(13, 148, 136);

    const drawRotatedRect = (x: number, y: number, w: number, h: number) => {
        const hw = w / 2;
        const hh = h / 2;
        const corners = [
            { x: -hw, y: -hh }, 
            { x: hw, y: -hh },  
            { x: hw, y: hh },   
            { x: -hw, y: hh }   
        ];
        
        const rotated = corners.map(p => ({
            x: cx + (p.x * cos - p.y * sin),
            y: cy + (p.x * sin + p.y * cos)
        }));

        doc.line(rotated[0].x, rotated[0].y, rotated[1].x, rotated[1].y);
        doc.line(rotated[1].x, rotated[1].y, rotated[2].x, rotated[2].y);
        doc.line(rotated[2].x, rotated[2].y, rotated[3].x, rotated[3].y);
        doc.line(rotated[3].x, rotated[3].y, rotated[0].x, rotated[0].y);
    };

    doc.setLineWidth(0.5);
    drawRotatedRect(stampX, stampY, stampW, stampH);
    doc.setLineWidth(0.2);
    drawRotatedRect(stampX, stampY, stampW - 2, stampH - 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    
    doc.text("VITALIA INTELLIGENCE", cx, cy - 3, { align: "center", angle: -angle });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    
    let validationText = "Validation numérique";
    if (language === 'en') validationText = "Digital validation";
    if (language === 'ro') validationText = "Validare digitală";

    doc.text(validationText, cx, cy + 1, { align: "center", angle: -angle });

    doc.setFontSize(6);
    doc.text(`DATE: ${new Date().toLocaleDateString()}`, cx, cy + 5, { align: "center", angle: -angle });
    doc.text(`ID: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`, cx, cy + 8, { align: "center", angle: -angle });

    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");
    const footerLines = doc.splitTextToSize(t.pdf.footer, contentWidth);
    doc.text(footerLines, margin, 290); 

    doc.save("Vitalia_Report.pdf");
  };

  const prescriptions = Array.isArray(data?.pre_ordonnance_IA) 
    ? data.pre_ordonnance_IA 
    : (data?.pre_ordonnance_IA ? [data.pre_ordonnance_IA] : []);

  // Prepare UI Text helpers
  const lifeThreatTitle = language === 'en' ? 'Life threatening emergency' : language === 'ro' ? 'Urgență vitală posibilă' : 'Urgence vitale possible';
  
  let lifeThreatMsg = "Les symptômes analysés indiquent une situation critique. Ne vous fiez pas à cette application.";
  if (language === 'en') lifeThreatMsg = "Symptoms indicate a critical situation. Do not rely on this app.";
  if (language === 'ro') lifeThreatMsg = "Simptomele indică o situație critică. Nu vă bazați pe această aplicație.";

  const callEmergency = language === 'en' ? "Call 911 / 112 immediately" : language === 'ro' ? "Sunați imediat la 112" : "Appeler le 15 ou 112 immédiatement";
  
  const emotionalSupport = language === 'en' ? "Emotional support" : language === 'ro' ? "Suport emoțional" : "Soutien émotionnel";
  const helpLines = language === 'en' ? "Helplines" : language === 'ro' ? "Linii de ajutor" : "Numéros d'aide";
  const pediatricMode = language === 'en' ? "Pediatric mode" : language === 'ro' ? "Mod pediatric" : "Mode pédiatrie";

  const approxText = language === 'en' ? 'Approx ' : language === 'ro' ? 'Aprox ' : 'À environ ';

  // Safety checks for Support Emotionnel
  const hasSupport = !!data?.support_emotionnel;
  const supportLevel = hasSupport ? (data.support_emotionnel?.niveau || '').toLowerCase() : '';
  const showSupport = hasSupport && (
      supportLevel.includes('élevé') || supportLevel.includes('high') || supportLevel.includes('ridicat') ||
      supportLevel.includes('modéré') || supportLevel.includes('moderate') || supportLevel.includes('moderat')
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {isEmergency && (
        <div className="bg-red-600 text-white p-6 rounded-3xl shadow-xl shadow-red-500/30 flex items-start gap-4 animate-pulse">
          <AlertOctagon size={48} className="flex-shrink-0" />
          <div>
            <h2 className="text-2xl font-bold mb-2">{lifeThreatTitle}</h2>
            <p className="font-medium text-red-50 mb-4">
               {lifeThreatMsg}
            </p>
            <a href="tel:112" className="inline-block bg-white text-red-600 font-bold px-6 py-3 rounded-xl shadow-md hover:scale-105 transition-transform">
               {callEmergency}
            </a>
          </div>
        </div>
      )}

      {showSupport && data?.support_emotionnel && (
        <div className="bg-violet-50 border-0 shadow-md p-6 rounded-3xl flex flex-col md:flex-row gap-6">
           <div className="flex-1">
             <h3 className="text-violet-800 font-bold text-lg flex items-center gap-2 mb-2">
               <HeartHandshake className="text-violet-600" /> {emotionalSupport}
             </h3>
             <ul className="space-y-2 text-violet-700 text-sm">
               {(data.support_emotionnel.recommandations || []).map((rec, i) => (
                 <li key={i}>• {renderSafeItem(rec)}</li>
               ))}
             </ul>
           </div>
           {data.support_emotionnel.contacts_urgence_mentale && data.support_emotionnel.contacts_urgence_mentale.length > 0 && (
               <div className="bg-white p-4 rounded-2xl shadow-sm border border-violet-100 flex flex-col justify-center gap-2">
                  <span className="text-xs font-bold text-violet-400 tracking-wider text-center">{helpLines}</span>
                  {data.support_emotionnel.contacts_urgence_mentale.map((contact, i) => (
                     <a key={i} href={`tel:${contact.replace(/\D/g,'')}`} className="text-center font-bold text-violet-900 bg-violet-100 px-3 py-1 rounded-lg hover:bg-violet-200 transition-colors block">
                      {renderSafeItem(contact)}
                    </a>
                  ))}
               </div>
           )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
           
           <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 relative overflow-hidden">
             {isPediatric && (
                <div className="absolute top-0 right-0 bg-pink-100 text-pink-600 px-4 py-1 rounded-bl-2xl font-bold text-xs flex items-center gap-1">
                  <Baby size={14} /> {pediatricMode}
                </div>
             )}
             <div className="flex items-center justify-between mb-4 mt-2">
               <div className="flex items-center gap-2">
                 <Activity className="text-teal-600" />
                 <h3 className="text-lg font-bold text-slate-800">{t.results.clinical_analysis}</h3>
               </div>
               <button 
                 onClick={handlePlayAudio}
                 disabled={isPlaying || isLoadingAudio}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 text-sm font-medium"
               >
                 {isLoadingAudio ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                 {isPlaying ? t.results.playing : t.results.listen_report}
               </button>
             </div>
             
             <p className="text-slate-600 leading-relaxed whitespace-pre-line">{resumePatient}</p>
             
             {redFlags.length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 rounded-2xl border-0 shadow-inner">
                   <h4 className="text-orange-800 font-semibold text-sm mb-2 flex items-center gap-2">
                     <AlertTriangle size={16}/> {t.results.red_flags}
                   </h4>
                   <ul className="list-disc list-inside text-sm text-orange-700">
                     {redFlags.map((flag, idx) => (
                       <li key={idx}>{renderSafeItem(flag)}</li>
                     ))}
                   </ul>
                </div>
             )}
           </div>

           <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0">
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="text-teal-600" />
                <h3 className="text-lg font-bold text-slate-800">{t.results.hypotheses}</h3>
              </div>
              <div className="space-y-4">
                {hypotheses.map((hyp, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 bg-slate-50 rounded-2xl border-0 shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <div className="font-semibold text-slate-800">{hyp?.cause || 'N/A'}</div>
                      <div className="text-sm text-slate-500 mt-1">{hyp?.justification || ''}</div>
                    </div>
                    <div className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full h-fit">
                      {hyp?.probabilite || '?'}
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        <div className="space-y-6">
           <UrgencyGauge level={urgencyCode} language={language} />
           
           <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0">
              <h3 className="text-sm font-semibold text-slate-500 mb-3 tracking-wide">{t.results.immediate_actions}</h3>
              <ul className="space-y-3">
                {planActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-700 text-sm">
                    <CheckCircle size={16} className="text-teal-500 flex-shrink-0 mt-0.5" />
                    <span>{renderSafeItem(action)}</span>
                  </li>
                ))}
              </ul>
           </div>
           
           {data?.risque_desHydratation && (
             <div className={`p-4 rounded-3xl border-0 shadow-sm flex items-center gap-3 ${
                data.risque_desHydratation.toLowerCase().includes('élevé') || data.risque_desHydratation.toLowerCase().includes('high') || data.risque_desHydratation.toLowerCase().includes('ridicat')
                ? 'bg-red-50 text-red-700' 
                : 'bg-blue-50 text-blue-700'
             }`}>
                <Droplets size={24} />
                <div>
                   <div className="text-xs font-bold opacity-70">{t.results.risk_dehydration}</div>
                   <div className="font-bold capitalize">{data.risque_desHydratation}</div>
                </div>
             </div>
           )}

           {data?.urgence_proche && (
             <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0">
                <div className="flex items-center gap-2 mb-2 text-slate-800 font-bold">
                   <MapPin className="text-red-500" size={18} /> {t.results.nearest_emergency}
                </div>
                <div className="text-sm text-slate-600 mb-2">{data.urgence_proche?.hopital || 'Hôpital'}</div>
                <div className="text-xs text-slate-400 mb-3">{approxText}{data.urgence_proche?.distance || '? km'}</div>
                {data.urgence_proche?.navigation_link && (
                    <a href={data.urgence_proche.navigation_link} target="_blank" rel="noreferrer" className="block w-full text-center bg-slate-800 text-white text-xs font-bold py-2 rounded-xl shadow-lg shadow-slate-800/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                       {t.results.gps_route}
                    </a>
                )}
             </div>
           )}

           <button 
             onClick={downloadPDF}
             className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white py-3 rounded-2xl hover:scale-[1.02] transition-all font-medium shadow-lg shadow-slate-800/30 active:scale-95"
           >
             <FileText size={18} />
             {t.results.download_pdf}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {data?.analyse_medicaments && ((data.analyse_medicaments.interactions && data.analyse_medicaments.interactions.length > 0) || (data.analyse_medicaments.risques && data.analyse_medicaments.risques.length > 0)) && (
             <div className="bg-amber-50 p-6 rounded-3xl border-0 shadow-sm shadow-amber-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-amber-600" />
                  <h3 className="text-lg font-bold text-amber-800">{t.results.interactions_title}</h3>
                </div>
                {data.analyse_medicaments.interactions.length > 0 && (
                   <div className="mb-4">
                     <p className="text-xs font-bold text-amber-600 uppercase mb-1">{t.results.interactions_detected}</p>
                     <ul className="list-disc list-inside text-sm text-amber-800">
                        {data.analyse_medicaments.interactions.map((msg, i) => <li key={i}>{renderSafeItem(msg)}</li>)}
                     </ul>
                   </div>
                )}
                {data.analyse_medicaments.risques.length > 0 && (
                   <div>
                     <p className="text-xs font-bold text-amber-600 uppercase mb-1">{t.results.risks}</p>
                     <ul className="list-disc list-inside text-sm text-amber-800">
                        {data.analyse_medicaments.risques.map((msg, i) => <li key={i}>{renderSafeItem(msg)}</li>)}
                     </ul>
                   </div>
                )}
             </div>
        )}

        {data?.medicaments_suggeres_OTC && data.medicaments_suggeres_OTC.length > 0 && (
             <div className="bg-teal-50 p-6 rounded-3xl border-0 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Pill className="text-teal-600" />
                  <h3 className="text-lg font-bold text-teal-800">{t.results.otc_suggestions}</h3>
                </div>
                <ul className="space-y-2">
                   {data.medicaments_suggeres_OTC.map((med, i) => (
                      <li key={i} className="flex items-start gap-2 text-teal-700 text-sm">
                         <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                         <span>{renderSafeItem(med)}</span>
                      </li>
                   ))}
                </ul>
             </div>
        )}
      </div>

      {prescriptions.length > 0 && (
          <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-xl shadow-slate-800/20">
             <div className="flex items-center gap-2 mb-6">
                <FileText className="text-teal-400" />
                <h3 className="text-lg font-bold">{t.results.prescription_suggestion}</h3>
             </div>
             <div className="grid gap-4">
                {prescriptions.map((med, i) => (
                   <div key={i} className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                         <span className="font-bold text-lg text-teal-300">{med?.medicament || 'Medicament'}</span>
                         <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">{med?.dosage || '-'}</span>
                      </div>
                      <div className="text-sm text-slate-300 mb-2">
                         <span className="opacity-70">{t.pdf.freq_col}:</span> {med?.frequence || '-'}
                      </div>
                      <div className="text-xs text-slate-400 italic">
                         {med?.interactions || med?.contre_indications || ''}
                      </div>
                   </div>
                ))}
             </div>
          </div>
      )}

      {/* Grounding Sources */}
      {data?.groundingChunks && data.groundingChunks.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                 <ExternalLink size={12} /> {t.results.sources}
             </h4>
             <div className="flex flex-wrap gap-2">
                 {data.groundingChunks.map((chunk, i) => chunk.web?.uri && (
                     <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:underline truncate max-w-[200px]">
                         {chunk.web.title || chunk.web.uri}
                     </a>
                 ))}
             </div>
          </div>
      )}
      
      <div className="text-center mt-6">
          <p className="text-[10px] text-slate-400 font-medium">
             ID: {Math.random().toString(36).substr(2, 9).toUpperCase()} • {t.results.confidence}: {data?.confiance || 'High'} • {t.results.disclaimer}
          </p>
      </div>

    </div>
  );
};

export default AnalysisResult;