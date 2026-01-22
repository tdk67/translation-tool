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
const WHISPER_MODEL = 'Xenova/whisper-base'; 

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
    
    // Check if model already exists to avoid re-download logs if not needed
    console.log(`[INFO] Loading Whisper Model: ${WHISPER_MODEL}`);
    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        progress_callback: (data) => {
            if (data.status === 'progress') {
                const percent = data.progress ? (data.progress).toFixed(1) : 0;
                process.stdout.write(`\r       Downloading... ${percent}%`);
            }
        }
    }); 
    console.log("\n[SUCCESS] Whisper Model Loaded!");
    if (mainWindow) mainWindow.webContents.send('model-ready');
  } catch (err) {
    console.error("\n[ERROR] Failed to load Whisper:", err);
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
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Polyglot', click: () => showWindow() },
    { label: 'Quit', click: () => {
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

// --- FIXED: FORCE IPv4 (127.0.0.1) ---
ipcMain.handle('get-ollama-models', async () => {
  try {
    // 127.0.0.1 is much safer than localhost in Node environment
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    
    const data = await response.json();
    return { success: true, models: data.models.map(m => m.name) };
  } catch (e) {
    console.error("[ERROR] Ollama connection failed:", e.message);
    return { success: false, error: "Could not connect to Ollama (127.0.0.1:11434)" };
  }
});

ipcMain.handle('get-build-info', () => ({ buildTime: BUILD_TIME }));

ipcMain.handle('whisper-transcribe', async (event, audioData) => {
    if (!transcriber) return { success: false, error: "AI warming up..." };
    
    try {
        let inputValues = Array.isArray(audioData) ? audioData : Object.values(audioData);
        const audio = new Float32Array(inputValues);
        
        // Silence check
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
    
    const prompt = `Translate this German text: "${text}" into: ${langString}.
    Return JSON only. Keys = language name, Values = translation.
    Example: {"English": "Hello"}
    No markdown.`;

    try {
        // FORCE IPv4 HERE TOO
        const baseUrl = 'http://127.0.0.1:11434';
        
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
            model: settings.ollamaModel, 
            prompt: prompt, 
            stream: false,
            format: "json"
            })
        });
        const data = await response.json();
        return { success: true, results: JSON.parse(data.response) };
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