import React, { useState } from 'react';
import { Check, Copy, Volume2, Globe } from 'lucide-react'; // Using Lucide instead of custom SVGs

interface LanguageCardProps {
  language: string;
  text: string;
  code: string; // Added code for TTS
  flag?: string; // Optional flag
}

export const LanguageCard: React.FC<LanguageCardProps> = ({ language, text, code, flag }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = code;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="group relative bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/[0.08] transition-all hover:border-white/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Fallback to Globe if no flag provided */}
          <span className="text-xl">{flag || <Globe size={16} />}</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{language}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-colors ${copied ? 'text-green-400' : 'hover:bg-white/10 text-gray-400'}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button 
            onClick={handleSpeak}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>
      <p className="text-lg font-medium leading-relaxed text-gray-100 min-h-[1.5rem]">
        {text || <span className="text-gray-600 italic font-light">Waiting for voice...</span>}
      </p>
    </div>
  );
};