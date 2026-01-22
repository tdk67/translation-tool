'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Settings as SettingsIcon, X } from 'lucide-react';
import { SettingsView, SettingsData } from '@/components/SettingsView';
import { LanguageCard } from '@/components/LanguageCard';

// Mapping for UI display
const LANGUAGES_INFO: Record<string, { name: string, flag: string, code: string }> = {
  'en': { name: 'English', flag: '🇺🇸', code: 'en-US' },
  'es': { name: 'Spanish', flag: '🇪🇸', code: 'es-ES' },
  'fr': { name: 'French', flag: '🇫🇷', code: 'fr-FR' },
  'de': { name: 'German', flag: '🇩🇪', code: 'de-DE' },
  'it': { name: 'Italian', flag: '🇮🇹', code: 'it-IT' },
  'ja': { name: 'Japanese', flag: '🇯🇵', code: 'ja-JP' },
  'ko': { name: 'Korean', flag: '🇰🇷', code: 'ko-KR' },
  'zh': { name: 'Chinese', flag: '🇨🇳', code: 'zh-CN' },
};

interface TranslationResult {
  langId: string;
  langName: string;
  text: string;
  code: string;
}

export default function TranslationTool() {
  // --- STATE ---
  const [view, setView] = useState<'translator' | 'settings'>('translator');
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'result'>('idle');
  const [transcript, setTranscript] = useState('');
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  
  const [settings, setSettings] = useState<SettingsData>({
    provider: 'ollama',
    ollamaModel: 'llama3',
    openRouterKey: '',
    openRouterModel: 'google/gemini-2.0-flash-exp:free',
    targetLanguages: ['en', 'fr', 'es'],
    hotkey: 'Alt+Shift+Space'
  });

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      if ((window as any).electronAPI) {
        // Check Whisper Model
        const ready = await (window as any).electronAPI.isModelReady();
        setIsModelReady(ready);
        
        // Load Settings
        const savedSettings = await (window as any).electronAPI.getSettings();
        if (savedSettings) setSettings(savedSettings);

        // Load Ollama Models
        const models = await (window as any).electronAPI.getOllamaModels();
        if (models.success) setOllamaModels(models.models);

        // Listeners
        (window as any).electronAPI.onModelReady(() => setIsModelReady(true));
        
        // Handle "Settings" from Tray
        (window as any).electronAPI.onOpenSettings(() => setView('settings'));

        // Handle Hotkey - if we want push-to-talk logic later, currently handled by electron global shortcut toggling window
      }
    };
    init();
  }, []);

  // --- LOGIC ---

  const startRecording = async () => {
    if (!isModelReady) return;
    setTranscript('');
    setTranslations([]); // Clear old results
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      
      mediaRecorderRef.current.onstop = async () => {
        setStatus('processing');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        try {
          // Decode Audio for Whisper (Float32Array requirement)
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const rawData = audioBuffer.getChannelData(0);
          const serializedData = Array.from(rawData);

          // IPC: Transcribe
          const result = await (window as any).electronAPI.whisper.transcribe(serializedData);
          
          if (result.success) {
            setTranscript(result.text);
            handleTranslateAll(result.text);
          } else {
            setTranscript("Error: " + result.error);
            setStatus('idle');
          }
          audioContext.close();
        } catch (e) {
          console.error(e);
          setStatus('idle');
        }
      };

      mediaRecorderRef.current.start();
      setStatus('recording');
    } catch (err) {
      console.error("Mic Error", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Stop tracks to release mic
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleTranslateAll = async (text: string) => {
    const results: TranslationResult[] = [];
    
    // Loop through target languages and call Electron translation service
    for (const langId of settings.targetLanguages) {
      const langInfo = LANGUAGES_INFO[langId];
      if (!langInfo) continue;

      const result = await (window as any).electronAPI.translate({ text, targetLang: langInfo.name });
      
      if (result.success) {
        results.push({ 
          langId: langId, 
          langName: langInfo.name, 
          text: result.translation, 
          code: langInfo.code 
        });
      }
    }
    setTranslations(results);
    setStatus('result');
  };

  const handleSettingsSave = async (newSettings: SettingsData) => {
    setSettings(newSettings);
    if ((window as any).electronAPI) {
      await (window as any).electronAPI.saveSettings(newSettings);
    }
    setView('translator');
  };

  const closeApp = () => {
    if ((window as any).electronAPI) (window as any).electronAPI.hideWindow();
  };

  // --- RENDER ---
  return (
    // Main container matching dimensions and style of mockup
    <div className="w-screen h-screen flex flex-col glass-panel shadow-2xl relative overflow-hidden text-gray-100">
      
      {/* View Switcher Overlay Animation */}
      <div className={`flex-1 flex flex-col transition-transform duration-300 ease-out ${view === 'settings' ? '-translate-x-full' : 'translate-x-0'}`}>
        
        {/* Header */}
        <header className="px-6 pt-6 pb-2 flex items-center justify-between drag-handle">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              PolyVoice
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
              {isModelReady ? "System Ready" : "Loading Models..."}
            </p>
          </div>
          <div className="flex gap-2 no-drag">
            <button 
              onClick={() => setView('settings')}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-gray-400"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={closeApp}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-red-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto scroll-hide no-drag">
          
          {/* Active Transcription Panel */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-2xl transition-all">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {status === 'recording' ? 'Listening...' : status === 'processing' ? 'Processing...' : 'Transcript'}
              </span>
            </div>
            <p className="text-xl font-light text-gray-200 min-h-[3rem]">
              {transcript || <span className="opacity-30">Press and hold the microphone...</span>}
            </p>
          </div>

          {/* Translation Result Cards */}
          <div className="space-y-3">
            {translations.length > 0 ? (
              translations.map(t => (
                <LanguageCard 
                  key={t.langId}
                  language={t.langName}
                  flag={LANGUAGES_INFO[t.langId]?.flag}
                  code={t.code}
                  text={t.text}
                />
              ))
            ) : (
              // Empty State placeholders based on settings
              settings.targetLanguages.map(langId => (
                 <LanguageCard 
                  key={langId}
                  language={LANGUAGES_INFO[langId]?.name || langId}
                  flag={LANGUAGES_INFO[langId]?.flag}
                  code={LANGUAGES_INFO[langId]?.code}
                  text=""
                />
              ))
            )}
          </div>
        </div>

        {/* Action Bar (Sticky Bottom) */}
        <div className="p-8 bg-gradient-to-t from-[#0f1117] via-[#0f1117] to-transparent no-drag">
          <div className="flex flex-col items-center gap-4">
            <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording} // Safety stop if mouse drags out
              disabled={!isModelReady}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative ${
                status === 'recording'
                ? 'bg-red-600 scale-110 shadow-red-900/40' 
                : !isModelReady 
                  ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 shadow-blue-900/40'
              }`}
            >
              {status === 'recording' && (
                <div className="absolute inset-0 rounded-full border-4 border-white/20 recording-pulse"></div>
              )}
              <Mic className="w-8 h-8 text-white" />
            </button>
            <p className="text-xs font-medium text-gray-500">
              {status === 'recording' 
                ? "Release to translate" 
                : status === 'processing' 
                  ? "Translating..." 
                  : "Hold to speak"}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Panel Overlay */}
      <div className={`absolute inset-0 bg-[#0f1117] transition-transform duration-300 ease-out z-20 ${view === 'settings' ? 'translate-x-0' : 'translate-x-full'}`}>
        <SettingsView 
          settings={settings}
          onSave={handleSettingsSave}
          onBack={() => setView('translator')}
          availableModels={ollamaModels}
        />
      </div>
    </div>
  );
}