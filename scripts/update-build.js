const fs = require('fs');
const path = require('path');
// Safe require for package.json
let packageJson = { version: "1.0.0" };
try { packageJson = require('../package.json'); } catch (e) {}

try {
    const now = new Date();
    const buildId = now.getTime().toString(36).toUpperCase().slice(-6); 
    const buildDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const buildTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const buildInfo = {
        appName: "PolyVoice",
        version: packageJson.version,
        buildId: buildId,
        timestamp: `${buildDate} at ${buildTime}`,
        description: "PolyVoice is a secure, local-first translation engine designed for professionals. It runs entirely on your hardware using Whisper for speech recognition and local LLMs for translation, ensuring your conversations never leave this device.",
        features: [
            "Local Whisper STT (Privacy First)",
            "Neural Translation (Ollama/Llama3)",
            "System Audio Capture",
            "Zero Cloud Dependencies"
        ]
    };

    // Ensure src directory exists
    const srcDir = path.join(__dirname, '../src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
    }

    const outputPath = path.join(srcDir, 'build-info.json');
    fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

    console.log(`✅ Build Metadata Updated: ${buildInfo.timestamp}`);
} catch (error) {
    console.error("❌ Warning: Could not update build info.", error.message);
}