const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  provider: 'ollama', // 'ollama' or 'openrouter'
  ollamaModel: 'llama3',
  openRouterKey: '',
  openRouterModel: 'google/gemini-2.0-flash-exp:free',
  targetLanguages: ['es', 'fr', 'de'],
  hotkey: 'Alt+Shift+Space'
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to read settings:', err);
  }
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

module.exports = { getSettings, saveSettings };
