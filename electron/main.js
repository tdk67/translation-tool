const { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { getSettings, saveSettings } = require('./settings');

let mainWindow;
let tray = null;
let transcriber = null;
let modelLoading = false;
let currentHotkey = 'Alt+Shift+Space';

const BUILD_TIME = new Date().toISOString();

function registerHotkey(hotkey) {
  globalShortcut.unregisterAll();
  const registered = globalShortcut.register(hotkey, () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
  if (registered) {
    currentHotkey = hotkey;
  } else {
    console.error('Shortcut registration failed for:', hotkey);
    // Fallback to default if custom fails
    globalShortcut.register('Alt+Shift+Space', () => {
      if (mainWindow.isVisible()) mainWindow.hide();
      else showWindow();
    });
  }
}

async function loadWhisperModel() {
  if (modelLoading || transcriber) return;
  modelLoading = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    // Tiny model is fast but we load it immediately in background
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny'); 
    console.log("Whisper Model Loaded");
    if (mainWindow) {
      mainWindow.webContents.send('model-ready');
    }
  } catch (err) {
    console.error("Failed to load Whisper:", err);
  } finally {
    modelLoading = false;
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.ico');
  const icon = fs.existsSync(iconPath) 
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Polyglot', click: () => showWindow() },
    { label: 'Settings', click: () => {
        showWindow();
        mainWindow.webContents.send('open-settings');
    }},
    { label: 'About', click: () => {
        showWindow();
        mainWindow.webContents.send('open-about');
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
    }}
  ]);

  tray.setToolTip('Polyglot Pop');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) return;
  
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;
  const [w, h] = mainWindow.getSize();
  
  mainWindow.setPosition(
    Math.round(x + (width / 2) - (w / 2)),
    Math.round(y + (height / 2) - (h / 2))
  );
  
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('start-listening');
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.ico');
  const hasIcon = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    icon: hasIcon ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  const settings = getSettings();
  createWindow();
  createTray();
  loadWhisperModel(); 
  registerHotkey(settings.hotkey || 'Alt+Shift+Space');
});

ipcMain.handle('get-ollama-models', async () => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return { success: true, models: data.models.map(m => m.name) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-build-info', () => ({ buildTime: BUILD_TIME }));

ipcMain.handle('whisper-transcribe', async (event, audioData) => {
    if (!transcriber) {
        return { success: false, error: "Model still loading... please wait a moment." };
    }
    try {
        const audio = new Float32Array(Object.values(audioData));
        const output = await transcriber(audio, { 
            chunk_length_s: 30, 
            stride_length_s: 5, 
            language: 'english', 
            task: 'transcribe' 
        });
        return { success: true, text: output.text };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('translate', async (event, { text, targetLang }) => {
    const settings = getSettings();
    try {
        if (settings.provider === 'openrouter') {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openRouterKey}`,
                    'HTTP-Referer': 'https://polyglot-pop.app', 
                    'X-Title': 'Polyglot Pop'
                },
                body: JSON.stringify({
                    model: settings.openRouterModel,
                    messages: [
                        { role: 'system', content: `Translate to ${targetLang}. Only provide the translation.` },
                        { role: 'user', content: text }
                    ]
                })
            });
            const data = await response.json();
            return { success: true, translation: data.choices[0].message.content.trim() };
        } else {
            // Default Ollama
            const response = await fetch('http://localhost:11434/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                model: settings.ollamaModel, 
                prompt: `Translate the following text to ${targetLang}. Only provide the translation, nothing else: "${text}"`, 
                stream: false 
              })
            });
            const data = await response.json();
            return { success: true, translation: data.response.trim() };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.on('window-hide', () => mainWindow.hide());
ipcMain.handle('is-model-ready', () => !!transcriber);

ipcMain.handle('get-settings', () => getSettings());
ipcMain.handle('save-settings', (event, settings) => {
    saveSettings(settings);
    if (settings.hotkey) {
      registerHotkey(settings.hotkey);
    }
    return true;
});
