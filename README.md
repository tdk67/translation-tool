# PolyglotPop 🌍

**PolyglotPop** is a privacy-first, desktop-based voice translation widget. It sits quietly in the background and pops up via a global hotkey (`Alt+Space`) to instantly transcribe your voice and translate it into multiple languages using 100% local AI.

## 🚀 Features

* **Global Hotkey:** Press `Alt+Space` anywhere to summon the widget.
* **Privacy First:** No cloud APIs. Everything runs on your machine.
    * **STT:** Uses `Whisper` (via Transformers.js) running locally in Electron.
    * **Translation:** Uses `Ollama` (Llama 3 or similar) running locally.
* **Instant Audio Processing:** Decodes microphone input into 16kHz PCM audio for high-accuracy transcription.
* **Modern UI:** Dark mode, glassmorphism design, and animated "breathing" microphone states.
* **Text-to-Speech:** Reads the translation aloud automatically.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js (v20+):** [Download Here](https://nodejs.org/)
2.  **Git:** [Download Here](https://git-scm.com/)
3.  **Ollama:** [Download Here](https://ollama.com/)
    * *Requirement:* You must have the translation model pulled. Run `ollama pull llama3` in your terminal.

## 📦 Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd polyglot-pop

# 2. Install dependencies
npm install

# 3. Create the public assets (if missing)
# Ensure you have a file named 'icon.ico' in the /public folder.
```

## 🏃‍♂️ How to Run

Because this uses Next.js Static Exports with Electron, you generally cannot use `npm start`. Instead, use the build-and-run workflow:

```bash
# 1. Build the Next.js UI (Export to static HTML)
npm run build

# 2. Launch the Electron App
npm run electron
```

*Note: If the window doesn't appear immediately, press `Alt+Space`.*

## ⚠️ Troubleshooting

* **"Fork Bomb" / Git Errors:** This is usually caused by Antivirus (like Avira). Disable "Real-Time Protection" temporarily and reinstall Git/Node.
* **Window is White/Blank:** Ensure `next.config.mjs` has `assetPrefix: './'`.
* **Microphone Error:** Check your system privacy settings to allow Electron to access the microphone.
* **Translation Fails:** Ensure Ollama is running (`ollama serve`) and the model name in `electron/main.js` matches what you have installed (default: "llama3").

## 🛑 Antivirus Note
If you use Avira or similar aggressive antivirus software, add the project folder (`C:\Data\work\...`) and the Node.js folder (`C:\Program Files\nodejs`) to your **Exceptions / Whitelist** to prevent `npm` from being quarantined.