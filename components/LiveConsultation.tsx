import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Language } from '../types';
import { translations } from '../constants/translations';
import { Mic, MicOff, Phone, Video, Loader2, Volume2, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';

interface LiveConsultationProps {
  onClose: (transcript?: string) => void;
  language: Language;
  mode?: 'audio' | 'video';
}

const LiveConsultation: React.FC<LiveConsultationProps> = ({ onClose, language, mode = 'video' }) => {
  const t = translations[language].live;
  const tModals = translations[language].modals;
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiVolume, setAiVolume] = useState(0); 
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [captions, setCaptions] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio Contexts Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    const startSession = async () => {
      setError(null);
      setIsConnected(false);

      try {
        if (!process.env.API_KEY) throw new Error("API Key missing");

        // 1. Setup Camera & Mic
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            },
            video: mode === 'video' ? { facingMode: "user" } : false
        };
        
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            console.error("Media Error", e);
            throw new Error(t.camera_error);
        }
        
        streamRef.current = stream;
        
        if (mode === 'video' && videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // 2. Setup Gemini
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Initialize Audio Contexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

        // Ensure Contexts are running
        if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
        if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

        const visionInstruction = mode === 'video' 
            ? "You see the user via video. Comment on what you see if relevant."
            : "You are in a voice-only consultation.";

        const config = {
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: language === 'en' ? 'Fenrir' : 'Kore' } },
            },
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}, 
            systemInstruction: `
              You are Dr. Vitalia, an empathetic AI doctor.
              LANGUAGE: ${language === 'en' ? 'ENGLISH' : language === 'ro' ? 'ROMANIAN' : 'FRENCH'}.
              
              YOUR BEHAVIOR:
              - Greet the patient immediately.
              - Ask "What brings you here today?".
              - Keep sentences SHORT.
              - If the user interrupts, STOP talking.
              - If info is insufficient, ask follow-up questions.
              
              ${visionInstruction}
            `,
          },
        };

        const sessionPromise = ai.live.connect({
          ...config,
          callbacks: {
            onopen: () => {
              if (mounted) setIsConnected(true);
            },
            onmessage: async (msg: LiveServerMessage) => {
               const serverContent = msg.serverContent;

               if (serverContent?.interrupted) {
                   audioSourcesRef.current.forEach(source => {
                       try { source.stop(); } catch(e) {}
                   });
                   audioSourcesRef.current.clear();
                   if(outputAudioContextRef.current) {
                       nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
                   }
                   setIsAiSpeaking(false);
                   setAiVolume(0);
               }

               if (serverContent?.inputTranscription?.text) {
                  const text = serverContent.inputTranscription.text;
                  transcriptRef.current += `Patient: ${text}\n`;
                  setCaptions(text);
               }
               if (serverContent?.outputTranscription?.text) {
                  const text = serverContent.outputTranscription.text;
                  transcriptRef.current += `Dr Vitalia: ${text}\n`;
                  setCaptions(text);
               }

               const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
               if (data && outputAudioContextRef.current) {
                  setIsAiSpeaking(true);
                  // Reset speaking indicator after a short delay if no more audio comes
                  setTimeout(() => { if (!audioSourcesRef.current.size) setIsAiSpeaking(false); }, 500); 

                  try {
                      const binaryString = atob(data);
                      const len = binaryString.length;
                      const bytes = new Uint8Array(len);
                      for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      
                      const int16Data = new Int16Array(bytes.buffer);
                      const float32Data = new Float32Array(int16Data.length);
                      for (let i=0; i<int16Data.length; i++) {
                          float32Data[i] = int16Data[i] / 32768.0;
                      }

                      const buffer = outputAudioContextRef.current.createBuffer(1, float32Data.length, 24000);
                      buffer.getChannelData(0).set(float32Data);

                      const ctx = outputAudioContextRef.current;
                      const source = ctx.createBufferSource();
                      source.buffer = buffer;
                      source.connect(ctx.destination);
                      
                      if (nextStartTimeRef.current < ctx.currentTime) {
                          nextStartTimeRef.current = ctx.currentTime;
                      }
                      
                      source.onended = () => {
                          setAiVolume(0);
                          audioSourcesRef.current.delete(source);
                          if (audioSourcesRef.current.size === 0) setIsAiSpeaking(false);
                      };

                      source.start(nextStartTimeRef.current);
                      nextStartTimeRef.current += buffer.duration;
                      audioSourcesRef.current.add(source);
                      setAiVolume(Math.random() * 0.5 + 0.5); 
                  } catch (e) {
                      console.error("Audio Decode Error", e);
                  }
               }
            },
            onclose: () => {
                if (mounted) setIsConnected(false);
            },
            onerror: (err: any) => {
                console.error("Session error", err);
                if (mounted) {
                    setIsConnected(false);
                    setError(err.message || "Network Error");
                }
            }
          }
        });

        // 3. Setup Audio Input Processing
        const source = inputAudioContextRef.current.createMediaStreamSource(stream);
        const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to base64
            let binary = '';
            const bytes = new Uint8Array(pcmData.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = window.btoa(binary);

            // SAFE SEND: Wait for sessionPromise
            sessionPromise.then(session => {
                try {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64Audio
                        }
                    });
                } catch (err) {
                    // Ignore transient send errors (e.g. socket closing)
                }
            });
        };
        
        source.connect(processor);
        processor.connect(inputAudioContextRef.current.destination);

        // 4. Setup Video Loop
        let videoInterval: number | null = null;
        if (mode === 'video') {
             videoInterval = window.setInterval(() => {
                if (!canvasRef.current || !videoRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                if (!ctx) return;
                
                canvasRef.current.width = 320; 
                canvasRef.current.height = 180;
                ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                
                try {
                    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                    sessionPromise.then(session => {
                        try {
                            session.sendRealtimeInput({
                                media: { mimeType: 'image/jpeg', data: base64Image }
                            });
                        } catch(e) {}
                    });
                } catch(e) {}
            }, 1000);
        }

        cleanup = () => {
            if (videoInterval) clearInterval(videoInterval);
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (processor) processor.disconnect();
            if (source) source.disconnect();
            
            if (inputAudioContextRef.current) inputAudioContextRef.current.close();
            if (outputAudioContextRef.current) outputAudioContextRef.current.close();
            
            audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
            
            sessionPromise.then(sess => {
                try { sess.close(); } catch(e){}
            }).catch(() => {});
        };

      } catch (err: any) {
        console.error(err);
        setError(err.message || t.camera_error);
      }
    };

    startSession();

    return () => {
        mounted = false;
        if (cleanup) cleanup();
    };
  }, [language, mode, retryCount, t.camera_error]);

  const toggleMute = () => {
      if (streamRef.current) {
          streamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !track.enabled;
          });
          setIsMuted(!isMuted);
      }
  };

  const endCall = () => {
      onClose(transcriptRef.current);
  };

  const handleRetry = () => {
      setRetryCount(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 text-white flex flex-col font-sans animate-fade-in safe-area-inset-bottom">
       
       {/* Top Bar */}
       <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
           <div className="bg-black/30 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
               <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
               <span className="text-xs font-bold tracking-wide uppercase">{isConnected ? t.session_active : t.connecting}</span>
           </div>
           
           {error && (
              <div className="flex flex-col items-end gap-2 animate-shake">
                  <div className="bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg max-w-[200px]">
                     <AlertTriangle size={16} />
                     <span className="text-xs font-bold leading-tight">{error}</span>
                  </div>
                  <button onClick={handleRetry} className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md hover:bg-slate-100 transition-colors">
                      <RefreshCw size={12} /> {tModals.live_feedback.action_retry}
                  </button>
              </div>
           )}
       </div>

       {/* Main Content */}
       <div className="flex-1 relative bg-slate-800 flex items-center justify-center overflow-hidden">
           
           {/* Video Feed */}
           {mode === 'video' && (
               <video 
                 ref={videoRef} 
                 className="absolute inset-0 w-full h-full object-cover"
                 style={{ transform: "scaleX(-1)" }}
                 playsInline 
                 muted 
                 autoPlay
               />
           )}
           
           {/* Fallback / Audio Mode Visualizer */}
           {(!isConnected || mode === 'audio') && (
              <div className="relative z-10 flex flex-col items-center gap-6">
                 <div className="relative">
                    {/* Ripple Effect when AI speaks */}
                    {isAiSpeaking && (
                        <>
                           <div className="absolute inset-0 rounded-full bg-teal-500/30 animate-ping"></div>
                           <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-pulse" style={{ animationDuration: '2s' }}></div>
                        </>
                    )}
                    
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center backdrop-blur-lg border-4 transition-all duration-300 shadow-2xl ${
                        isAiSpeaking ? 'bg-teal-600 border-teal-400 scale-110' : 'bg-slate-700/50 border-slate-600'
                    }`}>
                        {isConnected ? (
                           <Volume2 size={48} className={isAiSpeaking ? "text-white animate-bounce-slow" : "text-slate-400"} />
                        ) : (
                           <Loader2 size={48} className="animate-spin text-teal-400" />
                        )}
                    </div>
                 </div>
                 <div className="text-center">
                    <h2 className="text-2xl font-bold mb-1">{t.title}</h2>
                    <p className="text-slate-300 text-sm animate-pulse">
                       {isConnected ? (isAiSpeaking ? t.speaking : t.listening) : t.connecting}
                    </p>
                    {error && !isConnected && (
                        <div className="mt-4 flex flex-col items-center">
                            <AlertCircle className="text-red-400 mb-2" size={24}/>
                            <p className="text-xs text-red-300 max-w-[200px]">{error}</p>
                            <button onClick={handleRetry} className="mt-4 bg-teal-600 px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:bg-teal-700 transition-transform hover:scale-105">
                                {tModals.live_feedback.action_retry}
                            </button>
                        </div>
                    )}
                 </div>
              </div>
           )}

           {/* Captions Overlay */}
           {captions && (
              <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 px-8 pointer-events-none z-10">
                  <div className="bg-black/40 backdrop-blur-md p-4 rounded-3xl text-center transition-all animate-fade-in-up border border-white/5 shadow-xl">
                      <p className="text-lg md:text-2xl font-bold text-white leading-relaxed drop-shadow-md">
                         "{captions}"
                      </p>
                  </div>
              </div>
           )}

           {/* Hidden Canvas for Frame Capture */}
           <canvas ref={canvasRef} className="hidden" />
       </div>

       {/* Controls */}
       <div className="bg-slate-900 p-8 pb-10 flex items-center justify-center gap-6 z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] border-t border-white/5 rounded-t-3xl">
           <button 
             onClick={toggleMute} 
             className={`p-5 rounded-full transition-all shadow-lg active:scale-95 hover:-translate-y-1 ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'}`}
           >
              {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
           </button>
           
           <button 
             onClick={endCall} 
             className="bg-red-600 text-white p-6 rounded-full shadow-red-600/40 shadow-xl hover:bg-red-700 hover:scale-105 active:scale-95 transition-all"
           >
              <Phone size={36} className="rotate-[135deg]" fill="currentColor" />
           </button>

           <button 
             onClick={() => {/* Switch camera? Future feature */}}
             className="p-5 rounded-full bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
           >
              <RefreshCw size={28} />
           </button>
       </div>
    </div>
  );
};

export default LiveConsultation;