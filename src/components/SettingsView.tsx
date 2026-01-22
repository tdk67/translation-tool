import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check, Keyboard, RefreshCw, AlertCircle } from 'lucide-react';

export interface SettingsData {
  provider: 'ollama' | 'openrouter';
  ollamaModel: string;
  openRouterKey: string;
  openRouterModel: string;
  targetLanguages: string[];
  hotkey: string;
}

interface SettingsViewProps {
  settings: SettingsData;
  onSave: (settings: SettingsData) => void;
  onBack: () => void;
  availableModels: string[];
}

const LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'de', name: 'German', flag: '🇩🇪' },
  { id: 'it', name: 'Italian', flag: '🇮🇹' },
  { id: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { id: 'pl', name: 'Polish', flag: '🇵🇱' },
  { id: 'cs', name: 'Czech', flag: '🇨🇿' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onBack, availableModels }) => {
  const [localSettings, setLocalSettings] = useState<SettingsData>(settings);
  // Local state to handle manual refreshing in this view
  const [currentModels, setCurrentModels] = useState<string[]>(availableModels);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync props to state if props update
  useEffect(() => {
    if(availableModels.length > 0) setCurrentModels(availableModels);
  }, [availableModels]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if ((window as any).electronAPI) {
        const res = await (window as any).electronAPI.getOllamaModels();
        if (res.success) {
            setCurrentModels(res.models);
        }
    }
    setTimeout(() => setIsRefreshing(false), 500); // Visual feedback
  };

  const toggleLanguage = (id: string) => {
    setLocalSettings(prev => {
      const isSelected = prev.targetLanguages.includes(id);
      if (isSelected) {
        return { ...prev, targetLanguages: prev.targetLanguages.filter(l => l !== id) };
      }
      if (prev.targetLanguages.length >= 3) return prev;
      return { ...prev, targetLanguages: [...prev.targetLanguages, id] };
    });
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto scroll-hide bg-[#0f1117] text-gray-100 font-sans">
      <div className="flex items-center gap-3 mb-8 no-drag">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold">Configuration</h1>
      </div>

      <div className="space-y-8 no-drag pb-10">
        <section>
          <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">AI Provider</label>
          <div className="grid grid-cols-2 gap-3">
            {['ollama', 'openrouter'].map(provider => (
              <button
                key={provider}
                onClick={() => setLocalSettings({ ...localSettings, provider: provider as any })}
                className={`p-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                  localSettings.provider === provider 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {provider}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {localSettings.provider === 'openrouter' ? (
            <>
               <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">API Key</label>
                <input
                  type="password"
                  value={localSettings.openRouterKey}
                  onChange={e => setLocalSettings({ ...localSettings, openRouterKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Model String</label>
                <input
                  type="text"
                  value={localSettings.openRouterModel}
                  onChange={e => setLocalSettings({ ...localSettings, openRouterModel: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                 <label className="block text-xs font-bold text-gray-500">Ollama Model</label>
                 {currentModels.length === 0 && (
                   <span className="text-[10px] text-red-400 flex items-center gap-1">
                     <AlertCircle size={10} /> Is Ollama running?
                   </span>
                 )}
              </div>
              
              <div className="relative">
                <select 
                  value={localSettings.ollamaModel}
                  onChange={e => setLocalSettings({ ...localSettings, ollamaModel: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  {currentModels.length > 0 ? (
                    currentModels.map(m => <option key={m} value={m} className="bg-[#1a1d26]">{m}</option>)
                  ) : (
                    <option value="" disabled>No models found</option>
                  )}
                </select>
                <button 
                    onClick={handleRefresh}
                    className={`absolute right-3 top-3 p-1 rounded-full hover:bg-white/10 text-gray-500 transition-all ${isRefreshing ? "animate-spin text-blue-400" : ""}`}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section>
          <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
            Target Languages <span className="opacity-60 font-normal normal-case">(Max 3)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => toggleLanguage(lang.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  localSettings.targetLanguages.includes(lang.id)
                  ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-inner shadow-blue-500/10'
                  : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="text-sm font-medium">{lang.name}</span>
                {localSettings.targetLanguages.includes(lang.id) && (
                  <Check size={16} className="ml-auto text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </section>
        
        <button
          onClick={() => onSave(localSettings)}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/30 active:scale-[0.98]"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};