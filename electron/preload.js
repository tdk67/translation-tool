const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  whisper: {
    transcribe: (audioData) => ipcRenderer.invoke('whisper-transcribe', audioData),
  },
  translate: (data) => ipcRenderer.invoke('translate', data),
  onStartListening: (callback) => ipcRenderer.on('start-listening', callback),
  onModelReady: (callback) => ipcRenderer.on('model-ready', callback),
  isModelReady: () => ipcRenderer.invoke('is-model-ready'),
  hideWindow: () => ipcRenderer.send('window-hide'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getOllamaModels: () => ipcRenderer.invoke('get-ollama-models'),
    getBuildInfo: () => ipcRenderer.invoke('get-build-info'),
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
    onOpenAbout: (callback) => ipcRenderer.on('open-about', callback),
  });
