const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
let packageJson = require(packagePath);

// 1. Determine Version Increment
// Run with: node scripts/update-build.js --minor OR --major
const args = process.argv.slice(2);
const versionParts = packageJson.version.split('.').map(Number);

if (args.includes('--major')) {
    versionParts[0]++;
    versionParts[1] = 0;
    versionParts[2] = 0;
} else if (args.includes('--minor')) {
    versionParts[1]++;
    versionParts[2] = 0;
} else {
    // Default: Patch increment
    versionParts[2]++;
}

const newVersion = versionParts.join('.');
packageJson.version = newVersion;

// 2. Save new version to package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// 3. Generate Build Metadata for App
const now = new Date();
const buildId = now.getTime().toString(36).toUpperCase().slice(-6);
const buildDate = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
const buildTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const buildInfo = {
    appName: "PolyVoice",
    version: newVersion,
    buildId: buildId,
    timestamp: `${buildDate} ${buildTime}`,
    description: "PolyVoice ist ein datenschutzorientiertes Übersetzungstool für Profis. Es läuft vollständig lokal auf Ihrer Hardware und nutzt Whisper für Spracherkennung sowie lokale LLMs für Übersetzungen.",
    features: [
        "Lokale Whisper STT (Datenschutz)",
        "Neuronale Übersetzung (Ollama/Llama3)",
        "System-Audio Aufnahme",
        "Keine Cloud-Abhängigkeiten"
    ]
};

const srcDir = path.join(__dirname, '../src');
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

fs.writeFileSync(path.join(srcDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));

console.log(`✅ Version updated to ${newVersion} (Build ${buildId})`);