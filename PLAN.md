# PolyglotPop Implementation Plan & Context

## 1. Architecture Overview

The app is a hybrid **Electron + Next.js** application.
- **Frontend:** Next.js (React) handles the UI, Microphone access, and Audio Decoding.
- **Backend:** Electron (`main.js`) handles the System Hotkey, Window Management, and AI Model execution.
- **AI Stack:**
    - **Speech-to-Text:** `@xenova/transformers` (Whisper Small) running inside the Electron Main process.
    - **Translation:** `Ollama` (External API call to localhost:11434).

## 2. File Structure

```text
polyglot-pop/
├── electron/
│   ├── main.js          # Core logic (Hotkeys, IPC, Whisper setup)
│   └── preload.js       # Exposes IPC to React window
├── src/
│   ├── app/
│   │   ├── page.tsx     # Main UI (Mic handling, Animations)
│   │   ├── globals.css  # Tailwind styling (Dark mode defaults)
│   │   └── layout.tsx   # Root layout
│   └── components/ui/   # Reusable Shadcn UI components
├── public/
│   └── icon.ico         # App icon (Critical for Tray/Taskbar)
├── next.config.mjs      # Specific config for Electron compatibility
└── package.json         # Scripts and dependencies
```

## 3. Critical Implementation Details

### A. The Next.js Config (`next.config.mjs`)
We use a static export (`output: 'export'`) so Electron can load the file via the `file://` protocol.
**Crucial:** We set `assetPrefix: './'` so the built HTML files can find the CSS/JS files using relative paths.

### B. Audio Handling (The "Float32" Fix)
Raw WebM/MP3 data from the browser MediaRecorder crashes the AI model.
**The Fix:**
1.  **Frontend (`page.tsx`):** Captures audio -> Decodes it using `AudioContext` -> Extracts Channel Data -> Sends `Array<number>` via IPC.
2.  **Backend (`main.js`):** Receives the array -> Reconstructs it into a `Float32Array` -> Feeds it to Whisper.

### C. The Hotkey Logic
Defined in `electron/main.js`.
- **Trigger:** `Alt+Space` (Configurable via `const HOTKEY`).
- **Behavior:**
    - If hidden: Center on mouse cursor -> Show -> Auto-start listening.
    - If shown: Hide.

### D. Styling
- **Glassmorphism:** Uses `backdrop-blur` and semi-transparent backgrounds.
- **Menu Bar:** The standard Electron menu is stripped via `autoHideMenuBar: true` and `mainWindow.removeMenu()`.

## 4. Current State & Known Quirks

* **Start-up:** The app launches visible (`show: true`) for debugging purposes. In production, this can be changed to `show: false` to start effectively "minimized" to the tray.
* **Ollama Dependency:** The app assumes Ollama is running on port 11434. If the fetch fails, the app logs an error to the console but doesn't currently show a UI error message.
* **Tray Icon:** The code attempts to load `icon.ico`. If missing, it gracefully degrades but won't show a tray icon.

## 5. Future Roadmap / Next Steps

1.  **System Audio Hook:** Capture desktop audio (what you hear) instead of just microphone audio (what you say) to translate meetings/videos.
2.  **Settings Menu:** Create a settings slide-out to change:
    -   Target Language (Persistent storage).
    -   Hotkey configuration.
    -   Ollama Model selection.
3.  **Performance:** Move the Whisper model loading to a hidden "Worker" window or separate process to prevent UI lag during initial load.