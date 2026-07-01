const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../services/aiService.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Replace askGemini signature and fallback list
const originalAsk = `exports.askGemini = async (prompt, modelName = "gemini-2.5-flash", attachment = null, history = [], systemInstruction = null) => {
    let targetModel = modelName;
    if (targetModel === "gemini-2.5-flash" && !hasImageAttachment(attachment)) {
        console.log("[GEMINI SERVICE] No image attachment detected. Dynamically downgrading gemini-2.5-flash to gemini-2.5-flash-lite for cost optimization.");
        targetModel = "gemini-2.5-flash-lite";
    }

    const fallbackModels = Array.from(new Set([
        targetModel, 
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash", 
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-pro-latest"
    ]));`;

const replacementAsk = `exports.askGemini = async (prompt, modelName = "gemini-3.1-flash-lite", attachment = null, history = [], systemInstruction = null) => {
    let targetModel = modelName;
    if ((targetModel === "gemini-2.5-flash" || targetModel === "gemini-3.1-flash-lite") && !hasImageAttachment(attachment)) {
        targetModel = "gemini-3.1-flash-lite";
    }

    const fallbackModels = Array.from(new Set([
        targetModel, 
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash", 
        "gemini-flash-lite-latest",
        "gemini-pro-latest"
    ]));`;

// 2. Replace askGeminiStream signature and fallback list
const originalAskStream = `exports.askGeminiStream = async (prompt, modelName = "gemini-2.5-flash", attachment = null, history = [], systemInstruction = null) => {
    let targetModel = modelName;
    if (targetModel === "gemini-2.5-flash" && !hasImageAttachment(attachment)) {
        console.log("[GEMINI SERVICE] No image attachment detected. Dynamically downgrading gemini-2.5-flash to gemini-2.5-flash-lite for cost optimization.");
        targetModel = "gemini-2.5-flash-lite";
    }

    const fallbackModels = Array.from(new Set([
        targetModel, 
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash", 
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-pro-latest"
    ]));`;

const replacementAskStream = `exports.askGeminiStream = async (prompt, modelName = "gemini-3.1-flash-lite", attachment = null, history = [], systemInstruction = null) => {
    let targetModel = modelName;
    if ((targetModel === "gemini-2.5-flash" || targetModel === "gemini-3.1-flash-lite") && !hasImageAttachment(attachment)) {
        targetModel = "gemini-3.1-flash-lite";
    }

    const fallbackModels = Array.from(new Set([
        targetModel, 
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash", 
        "gemini-flash-lite-latest",
        "gemini-pro-latest"
    ]));`;

// 3. Replace transcribeAudio fallback list
const originalTranscribeList = `const fallbackModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest"];`;
const replacementTranscribeList = `const fallbackModels = ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-pro-latest"];`;

// Normalize CRLF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOriginalAsk = originalAsk.replace(/\r\n/g, '\n');
const normalizedOriginalAskStream = originalAskStream.replace(/\r\n/g, '\n');
const normalizedOriginalTranscribeList = originalTranscribeList.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedOriginalAsk)) {
    console.error('originalAsk not found in file!');
    process.exit(1);
}
if (!normalizedContent.includes(normalizedOriginalAskStream)) {
    console.error('originalAskStream not found in file!');
    process.exit(1);
}
if (!normalizedContent.includes(normalizedOriginalTranscribeList)) {
    console.error('originalTranscribeList not found in file!');
    process.exit(1);
}

let patched = normalizedContent
    .replace(normalizedOriginalAsk, replacementAsk)
    .replace(normalizedOriginalAskStream, replacementAskStream)
    .replace(normalizedOriginalTranscribeList, replacementTranscribeList);

const finalContent = content.includes('\r\n') ? patched.replace(/\n/g, '\r\n') : patched;
fs.writeFileSync(file, finalContent, 'utf8');
console.log('SUCCESS: Patched aiService.js models to use gemini-3.1-flash-lite for blazingly fast responses!');
