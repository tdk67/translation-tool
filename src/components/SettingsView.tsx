import React from 'react';
import { ChevronLeft, Check } from 'lucide-react';

// Shared interfaces
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
  availableModels: string[]; // From Ollama
}

const LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸' },
  { id: 'fr', name: 'French', flag: '🇫🇷' },
  { id: 'de', name: 'German', flag: '🇩🇪' },
  { id: 'it', name: 'Italian', flag: '🇮🇹' },
  { id: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { id: 'ko', name: 'Korean', flag: '🇰🇷' },
  { id: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onBack, availableModels }) => {
  const [localSettings, setLocalSettings] = React.useState<SettingsData>(settings);

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

  const handleSave = () => {
    onSave(localSettings);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto scroll-hide bg-[#0f1117]">
      <div className="flex items-center gap-3 mb-8 no-drag">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
      </div>

      <div className="space-y-8 no-drag">
        {/* Provider Selection */}
        <section>
          <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">AI Provider</label>
          <div className="grid grid-cols-2 gap-3">
            {['ollama', 'openrouter'].map(provider => (
              <button
                key={provider}
                onClick={() => setLocalSettings({ ...localSettings, provider: provider as any })}
                className={`p-3 rounded-xl text-sm font-medium transition-all ${
                  localSettings.provider === provider 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Dynamic Fields */}
        <section className="space-y-4">
          {localSettings.provider === 'openrouter' ? (
            <>
               <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">API Key</label>
                <input
                  type="password"
                  value={localSettings.openRouterKey}
                  onChange={e => setLocalSettings({ ...localSettings, openRouterKey: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Model String</label>
                <input
                  type="text"
                  value={localSettings.openRouterModel}
                  onChange={e => setLocalSettings({ ...localSettings, openRouterModel: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Ollama Model</label>
              <select 
                value={localSettings.ollamaModel}
                onChange={e => setLocalSettings({ ...localSettings, ollamaModel: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                {availableModels.map(m => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
              </select>
            </div>
          )}
        </section>

        {/* Language Selection */}
        <section>
          <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Target Languages <span className="text-xs normal-case opacity-60">(Max 3)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => toggleLanguage(lang.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  localSettings.targetLanguages.includes(lang.id)
                  ? 'bg-blue-600/20 border-blue-500/50 text-white'
                  : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm font-medium">{lang.name}</span>
                {localSettings.targetLanguages.includes(lang.id) && (
                  <Check size={16} className="ml-auto text-blue-400" />
                )}
              </button>
            ))}
          </div>
        </section>
        
        <button
          onClick={handleSave}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};