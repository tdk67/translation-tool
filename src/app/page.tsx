'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Settings as SettingsIcon, X, ChevronLeft, Square, Monitor, Loader2, Shield, Zap, Cpu, Activity } from 'lucide-react';
import { SettingsView, SettingsData } from '@/components/SettingsView';
import { LanguageCard } from '@/components/LanguageCard';
import buildInfo from '@/build-info.json';

// --- CONFIGURATION: European Languages Only ---
const LANGUAGES_INFO: Record<string, { name: string, flag: string, code: string }> = {
  'en': { name: 'English', flag: '🇺🇸', code: 'en-US' },
  'es': { name: 'Spanish', flag: '🇪🇸', code: 'es-ES' },
  'fr': { name: 'French', flag: '🇫🇷', code: 'fr-FR' },
  'de': { name: 'German', flag: '🇩🇪', code: 'de-DE' },
  'it': { name: 'Italian', flag: '🇮🇹', code: 'it-IT' },
  'hu': { name: 'Hungarian', flag: '🇭🇺', code: 'hu-HU' },
  'pl': { name: 'Polish', flag: '🇵🇱', code: 'pl-PL' },
  'cs': { name: 'Czech', flag: '🇨🇿', code: 'cs-CZ' },
};

interface TranslationResult {
  langId: string;
  langName: string;
  text: string;
  code: string;
}

export default function TranslationTool() {
  const [view, setView] = useState<'translator' | 'settings' | 'about'>('translator');
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'translating' | 'result'>('idle');
  const [transcript, setTranscript] = useState('');
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [inputMode, setInputMode] = useState<'mic' | 'system'>('mic'); 
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const [settings, setSettings] = useState<SettingsData>({
    provider: 'ollama',
    ollamaModel: 'llama3',
    openRouterKey: '',
    openRouterModel: 'google/gemini-2.0-flash-exp:free',
    targetLanguages: ['en', 'hu', 'pl'], 
    hotkey: 'Alt+Shift+Space'
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- INIT ---
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const init = async () => {
      if ((window as any).electronAPI) {
        const ready = await (window as any).electronAPI.isModelReady();
        setIsModelReady(ready);
        
        // --- CRITICAL FIX: CLEAN UP OLD SETTINGS ---
        const s = await (window as any).electronAPI.getSettings();
        if (s) {
            // Check if saved languages actually exist in our new European list
            const validLangs = s.targetLanguages.filter((l: string) => LANGUAGES_INFO[l]);
            
            // If they are valid, keep them. If they contained Asian/Old langs, reset to default.
            const cleanSettings = {
                ...s,
                targetLanguages: validLangs.length > 0 ? validLangs : ['en', 'hu', 'pl']
            };
            setSettings(cleanSettings);
            // Force save the clean settings immediately
            if(JSON.stringify(s.targetLanguages) !== JSON.stringify(cleanSettings.targetLanguages)) {
                (window as any).electronAPI.saveSettings(cleanSettings);
            }
        }

        (window as any).electronAPI.onModelReady(() => setIsModelReady(true));
        (window as any).electronAPI.onOpenSettings(() => setView('settings'));
        (window as any).electronAPI.onOpenAbout(() => setView('about'));
      }
    };
    init();
  }, []);

  // --- AUDIO CAPTURE ---
  const captureAudio = async () => {
    if (!isModelReady) return;
    setTranscript('');
    setTranslations([]); 
    
    try {
      let stream;
      if (inputMode === 'system') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); 
        setStatus('processing');
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);
            
            const result = await (window as any).electronAPI.whisper.transcribe(Array.from(rawData));
            if (result.success) {
                setTranscript(result.text);
                setStatus('translating');
                await handleBatchTranslate(result.text);
            } else {
                setTranscript("Transcription failed: " + result.error);
                setStatus('idle');
            }
            ctx.close();
        } catch (e: any) {
            console.error(e);
            setTranscript("Error: " + (e.message || "Unknown error"));
            setStatus('idle');
        }
      };

      mediaRecorderRef.current.start();
      setStatus('recording');
    } catch (err) {
      console.error("Capture failed", err);
      setStatus('idle');
    }
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleBatchTranslate = async (text: string) => {
    if (!(window as any).electronAPI.translateBatch) return;

    const targetNames = settings.targetLanguages.map(id => LANGUAGES_INFO[id]?.name).filter(Boolean);
    
    const response = await (window as any).electronAPI.translateBatch({ 
        text, 
        targetLangs: targetNames 
    });

    if (response.success && response.results) {
        const newTranslations = settings.targetLanguages.map(id => {
            const info = LANGUAGES_INFO[id];
            return {
                langId: id,
                langName: info?.name,
                code: info?.code,
                text: response.results[info?.name || ''] || "..."
            } as TranslationResult;
        });
        setTranslations(newTranslations);
        setStatus('result');
    } else {
        setTranscript("Translation Error: " + (response.error || "Unknown"));
        setStatus('idle');
    }
  };

  // --- RENDER ---
  return (
    <div className="w-screen h-screen flex flex-col glass-panel shadow-2xl relative overflow-hidden text-gray-100 font-sans">
        {/* HEADER */}
        <header className="px-6 pt-6 pb-4 flex items-center justify-between drag-handle z-20">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">PolyVoice</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{isModelReady ? "System Ready" : "Loading Model..."}</p>
          </div>
          <div className="flex gap-2 no-drag">
             <button onClick={() => setInputMode(prev => prev === 'mic' ? 'system' : 'mic')} 
                className={`p-2 rounded-xl transition-colors ${inputMode === 'system' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-white/10 text-gray-400'}`} 
                title={inputMode === 'mic' ? "Switch to System Audio" : "Switch to Microphone"}>
                {inputMode === 'mic' ? <Mic size={18} /> : <Monitor size={18} />}
             </button>
             <button onClick={() => setView('settings')} className="p-2 rounded-xl hover:bg-white/10 text-gray-400"><SettingsIcon size={18} /></button>
             <button onClick={() => (window as any).electronAPI.hideWindow()} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-red-400"><X size={18} /></button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 pb-44 scroll-hide no-drag space-y-4">
            <div className={`p-5 rounded-2xl transition-all border ${status === 'recording' ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🇩🇪</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">German (Source)</span>
                </div>
                <p className="text-lg text-gray-200 min-h-[1.5rem] font-medium leading-relaxed">
                   {transcript || <span className="opacity-30 italic">Waiting for input...</span>}
                </p>
            </div>

            {status === 'translating' && (
                <div className="flex items-center justify-center py-6 gap-3 animate-pulse bg-white/5 rounded-2xl border border-white/5">
                    <Loader2 className="animate-spin text-blue-400" size={20} />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Translating...</span>
                </div>
            )}

            {status !== 'translating' && settings.targetLanguages.map(id => {
                const info = LANGUAGES_INFO[id];
                const trans = translations.find(t => t.langId === id);
                return (
                    <LanguageCard 
                        key={id}
                        language={info?.name || id}
                        flag={info?.flag}
                        code={info?.code}
                        text={trans?.text || ""}
                    />
                );
            })}
        </div>

        {/* FOOTER */}
        <div className="absolute bottom-0 w-full p-8 bg-gradient-to-t from-[#0f1117] via-[#0f1117] to-transparent z-30 flex justify-center no-drag">
             <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={status === 'recording' ? stopCapture : captureAudio}
                  disabled={!isModelReady || status === 'processing' || status === 'translating'}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl relative ${
                    status === 'recording' ? 'bg-red-600 scale-110' : !isModelReady ? 'bg-gray-800' : 'bg-blue-600 hover:scale-105'
                  }`}
                >
                   {status === 'recording' ? <Square className="fill-white text-white" /> : inputMode === 'mic' ? <Mic className="text-white" /> : <Monitor className="text-white" />}
                </button>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {status === 'recording' ? 'Stop' : status === 'processing' ? 'Transcribing...' : status === 'translating' ? 'Translating...' : inputMode === 'mic' ? 'Tap to Speak' : 'Tap to Stream'}
                </span>
             </div>
        </div>

        {/* SETTINGS OVERLAY */}
        <div className={`absolute inset-0 bg-[#0f1117] z-40 transition-transform duration-300 ${view === 'settings' ? 'translate-x-0' : 'translate-x-full'}`}>
            <SettingsView 
                settings={settings} 
                onSave={async (s) => { setSettings(s); await (window as any).electronAPI.saveSettings(s); setView('translator'); }} 
                onBack={() => setView('translator')} 
                availableModels={[]} 
            /> 
        </div>

        {/* ABOUT OVERLAY (Redesigned) */}
        <div className={`absolute inset-0 bg-[#0f1117] z-50 transition-transform duration-300 flex flex-col ${view === 'about' ? 'translate-x-0' : 'translate-x-full'}`}>
             <div className="absolute top-6 left-6 no-drag z-50">
                <button onClick={() => setView('translator')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <ChevronLeft size={20} />
                </button>
             </div>
             
             <div className="flex-1 flex flex-col px-8 pt-12 pb-8 overflow-y-auto no-drag">
                 <div className="text-center space-y-2 mb-8">
                    <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-900/40 mb-2">
                        <Activity size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">PolyVoice</h2>
                    <p className="text-sm font-medium text-blue-400 tracking-wide uppercase">Privacy-First Translation</p>
                 </div>

                 {/* Description Box */}
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
                    <p className="text-gray-300 text-sm leading-relaxed text-center">
                        {buildInfo.description}
                    </p>
                 </div>

                 {/* Features Grid */}
                 <div className="grid grid-cols-2 gap-3 mb-8">
                    {(buildInfo.features || []).map((feature: string, i: number) => (
                        <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center gap-2">
                            {i === 0 ? <Shield size={16} className="text-emerald-400"/> : 
                             i === 1 ? <Cpu size={16} className="text-amber-400"/> :
                             <Zap size={16} className="text-blue-400"/>}
                            <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{feature}</span>
                        </div>
                    ))}
                 </div>

                 {/* Version Info Footer */}
                 <div className="mt-auto border-t border-white/10 pt-6">
                    <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-gray-500 font-medium">Version</span>
                        <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded">{buildInfo.version}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Build</span>
                        <span className="text-gray-400 font-mono">{buildInfo.buildId} ({buildInfo.timestamp})</span>
                    </div>
                 </div>
             </div>
        </div>
    </div>
  );
}