# PolyVoice 🌍

**PolyVoice** (formerly PolyglotPop) is a privacy-first, desktop-based translation engine designed for professionals. It runs entirely on your local hardware using high-performance AI models to provide instant speech-to-text and translation without sending a single byte of data to the cloud.

## 🚀 Key Features

* **100% Local Privacy:**
    * **STT:** Uses `Xenova/whisper-small` (approx. 500MB) running locally in Electron for high-accuracy transcription (even for songs/lyrics).
    * **Translation:** Connects to a local **Ollama** instance (Llama 3 recommended).
* **Dual Audio Modes:**
    * 🎤 **Microphone:** Translate your own voice in real-time.
    * 🖥️ **System Audio:** Capture and translate audio from other apps (Teams meetings, YouTube videos, Movies).
* **European Focus:** Optimized for English, German, French, Spanish, Italian, Hungarian, Polish, and Czech.
* **Global Hotkey:** Press `Alt+Shift+Space` to toggle the overlay instantly.
* **Modern UI:** Glassmorphism design, German localization, and auto-hiding interface.

## 🛠️ Prerequisites

1.  **Node.js (v20+):** [Download Here](https://nodejs.org/)
2.  **Ollama:** [Download Here](https://ollama.com/)
    * *Required:* You must pull a model. Open your terminal and run:
        ```bash
        ollama pull llama3
        ```
    * *Note:* Ensure Ollama is running (`ollama serve`) before starting the app.

## 📦 Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd translation-tool_v04

# 2. Install dependencies
npm install
```

## 🏃‍♂️ How to Run

Since this is a hybrid Next.js + Electron app, use the build-and-run workflow:

```bash
# 1. Build the UI & Scripts (Auto-increments patch version)
node scripts/update-build.js

# 2. Compile Next.js
npm run build

# 3. Launch Electron
npm run electron
```

## ⚠️ Troubleshooting

* **System Audio is Silent:** When selecting a screen/tab to share, **you must check the "Share Audio" box** in the popup window.
* **Ollama Not Found:** The app tries to connect to `127.0.0.1:11434`. Ensure no firewall is blocking this port.
* **"No handler registered":** If you see this error, ensure you have run `npm run build` after any code changes. The Electron backend relies on the built static files.

## 📜 License
MIT