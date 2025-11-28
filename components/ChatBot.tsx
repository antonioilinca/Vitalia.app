
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, MapPin, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { chatWithAi } from '../services/geminiService';
import { ChatMessage } from '../types';

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Bonjour, je suis votre assistant MedAI. Je peux vous aider à comprendre un symptôme ou trouver un établissement de santé (pharmacie, hôpital) via Google Maps. Comment puis-je vous aider ?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Focus input when opening on desktop, but maybe not on mobile to avoid keyboard jumping
  useEffect(() => {
    if (isOpen && window.innerWidth > 640) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Format history for Gemini API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await chatWithAi(history, userMsg, location);
      
      setMessages(prev => [...prev, { role: 'model', text: responseText || "Désolé, je n'ai pas compris." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "Erreur de connexion. Veuillez réessayer.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-teal-700 hover:scale-110 transition-all z-50 group"
        aria-label="Ouvrir le chat médical"
      >
        <MessageSquare size={26} className="group-hover:animate-bounce" />
      </button>
    );
  }

  return (
    <div className={`
      fixed z-[100] flex flex-col bg-slate-50 font-sans border-slate-200 shadow-2xl
      /* MOBILE STYLES: Full Screen */
      inset-0 w-full h-full rounded-none
      /* DESKTOP STYLES: Floating Widget */
      sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[600px] sm:rounded-3xl sm:border
      animate-fade-in-up
    `}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-teal-600 text-white flex items-center justify-between sm:rounded-t-3xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Sparkles size={20} className="text-teal-50" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-none">Assistant MedAI</h3>
            <span className="text-xs text-teal-100 opacity-80 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> En ligne
            </span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)} 
          className="p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
          aria-label="Fermer"
        >
          {/* Chevron down on mobile to imply sliding down, X on desktop */}
          <ChevronDown size={28} className="sm:hidden" /> 
          <X size={24} className="hidden sm:block" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-teal-600 text-white rounded-br-none' 
                : msg.isError 
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
            }`}>
              {/* Basic markdown parsing for links */}
              {msg.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                part.match(/^https?:\/\//) ? (
                  <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-bold break-all text-blue-300 hover:text-white">
                    {part}
                  </a>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-200 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-teal-600" />
              <span className="text-sm text-slate-500 font-medium">Analyse en cours...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="flex-shrink-0 p-3 bg-white border-t border-slate-200 sm:rounded-b-3xl">
        <div className="relative flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question..."
            // text-base prevents zoom on iOS
            className="flex-1 pl-5 pr-4 py-3.5 bg-slate-100 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400 text-slate-800"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="p-3.5 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md flex-shrink-0"
            aria-label="Envoyer"
          >
            <Send size={20} className={isLoading ? "opacity-0" : "ml-0.5"} />
            {isLoading && <Loader2 size={20} className="animate-spin absolute" />}
          </button>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400 pl-4">
            <MapPin size={12} className="text-teal-500" />
            <span>Géolocalisation active pour la recherche de proximité</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatBot;
