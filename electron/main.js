const { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { getSettings, saveSettings } = require('./settings');

let mainWindow;
let tray = null;
let transcriber = null;
let modelLoading = false;
let currentHotkey = 'Alt+Shift+Space';

const BUILD_TIME = new Date().toISOString();

// UPGRADE: 'whisper-small' is much better for songs/fast speech than 'base'
const WHISPER_MODEL = 'Xenova/whisper-small'; 

function registerHotkey(hotkey) {
  globalShortcut.unregisterAll();
  try {
    const registered = globalShortcut.register(hotkey, () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        showWindow();
      }
    });
    if (registered) currentHotkey = hotkey;
  } catch (err) {
    console.error('[ERROR] Hotkey Error:', err);
  }
}

async function loadWhisperModel() {
  if (modelLoading || transcriber) return;
  modelLoading = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    
    console.log(`[INFO] Lade Whisper Modell: ${WHISPER_MODEL}`);
    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        progress_callback: (data) => {
            if (data.status === 'progress') {
                const percent = data.progress ? (data.progress).toFixed(1) : 0;
                process.stdout.write(`\r       Downloading... ${percent}%`);
            }
        }
    }); 
    console.log("\n[ERFOLG] Whisper Modell geladen!");
    if (mainWindow) mainWindow.webContents.send('model-ready');
  } catch (err) {
    console.error("\n[FEHLER] Konnte Whisper nicht laden:", err);
  } finally {
    modelLoading = false;
  }
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
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.ico');
  const icon = fs.existsSync(iconPath) 
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  
  // GERMAN MENU
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Polyglot öffnen', click: () => showWindow() },
    { type: 'separator' },
    { label: 'Einstellungen', click: () => {
        showWindow();
        mainWindow.webContents.send('open-settings');
    }},
    { label: 'Über', click: () => {
        showWindow();
        mainWindow.webContents.send('open-about');
    }},
    { type: 'separator' },
    { label: 'Beenden', click: () => {
        app.isQuitting = true;
        app.quit();
    }}
  ]);

  tray.setToolTip('Polyglot Pop');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showWindow());
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.ico');
  
  mainWindow = new BrowserWindow({
    width: 520, 
    height: 700,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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
  
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- IPC HANDLERS ---

ipcMain.handle('is-model-ready', () => !!transcriber);

ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({ 
    types: ['window', 'screen'],
    thumbnailSize: { width: 0, height: 0 }
  });
  return sources.map(s => ({ id: s.id, name: s.name }));
});

ipcMain.handle('get-ollama-models', async () => {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) throw new Error(`Ollama status: ${response.status}`);
    const data = await response.json();
    return { success: true, models: data.models.map(m => m.name) };
  } catch (e) {
    return { success: false, error: "Verbindung zu Ollama fehlgeschlagen" };
  }
});

ipcMain.handle('get-build-info', () => ({ buildTime: BUILD_TIME }));

ipcMain.handle('whisper-transcribe', async (event, audioData) => {
    if (!transcriber) return { success: false, error: "KI wird geladen..." };
    
    try {
        let inputValues = Array.isArray(audioData) ? audioData : Object.values(audioData);
        const audio = new Float32Array(inputValues);
        
        let maxAmp = 0;
        for(let i=0; i<audio.length; i++) if (Math.abs(audio[i]) > maxAmp) maxAmp = Math.abs(audio[i]);
        if (maxAmp < 0.01) return { success: true, text: "" };

        const output = await transcriber(audio, { 
            chunk_length_s: 30, 
            stride_length_s: 5, 
            language: 'german', 
            task: 'transcribe' 
        });
        return { success: true, text: output.text };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('translate-batch', async (event, { text, targetLangs }) => {
    const settings = getSettings();
    const langString = targetLangs.join(", ");
    
    // STRICTER PROMPT to avoid "Here is your JSON" chatter
    const systemPrompt = `You are a strict translation API. 
    Task: Translate German text to: ${langString}.
    Format: Return ONLY a valid JSON object. No Markdown. No Intro.
    Example: {"English": "Hello", "French": "Salut"}`;

    const userPrompt = `"${text}"`;

    try {
        const baseUrl = 'http://127.0.0.1:11434';
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: settings.ollamaModel, 
                prompt: `${systemPrompt}\n\nInput: ${userPrompt}`, 
                stream: false,
                format: "json",
                options: { temperature: 0.1 }
            })
        });
        const data = await response.json();
        
        // Clean JSON before parsing just in case
        let cleanJson = data.response.replace(/```json/g, '').replace(/```/g, '').trim();
        return { success: true, results: JSON.parse(cleanJson) };
    } catch (e) {
        console.error("[ERROR] Translation failed:", e);
        return { success: false, error: e.message };
    }
});

ipcMain.on('window-hide', () => mainWindow.hide());
ipcMain.handle('get-settings', () => getSettings());
ipcMain.handle('save-settings', (event, settings) => {
    saveSettings(settings);
    if (settings.hotkey) registerHotkey(settings.hotkey);
    return true;
});

app.whenReady().then(() => {
  const settings = getSettings();
  createWindow();
  createTray();
  loadWhisperModel(); 
  registerHotkey(settings.hotkey || 'Alt+Shift+Space');
});