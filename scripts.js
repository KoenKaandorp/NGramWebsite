let model = {};
let maxN = 5;
let historyItems = [];

const resultEl = () => document.getElementById("result");
const statusEl = () => document.getElementById("modelStatus");
const historyListEl = () => document.getElementById("historyList");
const resultFrameEl = () => document.querySelector(".result-frame");
const systemLogEl = () => document.getElementById("systemLog");
const chaosValueEl = () => document.getElementById("chaosValue");
const dramaSliderEl = () => document.getElementById("dramaSlider");
const dramaLabelEl = () => document.getElementById("dramaLabel");
const tokenPulseEl = () => document.getElementById("tokenPulse");
const entropyVibeEl = () => document.getElementById("entropyVibe");
const outputLengthEl = () => document.getElementById("outputLength");
const oracleMoodEl = () => document.getElementById("oracleMood");

async function loadModel() {
  try {
    setStatus("Loading model...", "loading");
    addLog("[fetch] requesting model.json...");
    toggleButtons(true);

    const response = await fetch("model.json");
    if (!response.ok) throw new Error("Failed to load model.json");

    const data = await response.json();
    model = {};

    for (const nGramKey in data) {
      const nValue = parseInt(nGramKey.match(/\d+/)[0]);
      model[nValue] = {};

      for (const keyStr in data[nGramKey]) {
        const keyArray = JSON.parse(keyStr);
        const key = keyArray.join("|||");
        model[nValue][key] = data[nGramKey][keyStr];
      }
    }

    setStatus("Model ready", "ready");
    addLog("[ready] language matrix online.");
    addLog("[status] prediction engine stabilized.");
    oracleMoodEl().innerText = "Awakened";
    toggleButtons(false);
  } catch (error) {
    console.error(error);
    setStatus("Model failed", "error");
    addLog("[error] failed to initialize model.");
    resultEl().innerText = "Could not load model.json. Make sure it is in the same folder.";
    oracleMoodEl().innerText = "Corrupted";
  }
}

function weightedRandomChoice(options) {
  const words = Object.keys(options);
  const weights = Object.values(options);

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < words.length; i++) {
    if (r < weights[i]) return words[i];
    r -= weights[i];
  }

  return words[words.length - 1];
}

function backoffInference(maxN, currentWords) {
  let result = [...currentWords];

  while (true) {
    let nextWord = null;

    for (let n = maxN; n > 0; n--) {
      const modelLevel = model[n];
      if (!modelLevel) continue;

      const contextSize = n - 1;
      const context = contextSize > 0 ? currentWords.slice(-contextSize) : [];
      const key = context.join("|||");

      if (modelLevel[key]) {
        nextWord = weightedRandomChoice(modelLevel[key]);
        break;
      }
    }

    if (!nextWord) break;

    result.push(nextWord);
    if (nextWord === "</s>") break;

    currentWords.push(nextWord);

    if (result.length > 60) break;
  }

  return result;
}

function formatSentence(words) {
  let filtered = words.filter(w => w !== "<s>" && w !== "</s>");
  if (filtered.length === 0) return "";

  let sentence = "";
  for (let i = 0; i < filtered.length; i++) {
    const word = filtered[i];
    const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

    if (i === 0) sentence += word;
    else if (noSpaceBefore.includes(word)) sentence += word;
    else sentence += " " + word;
  }

  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  if (!/[.!?]$/.test(sentence)) sentence += ".";
  return sentence;
}

function setStatus(text, type) {
  const el = statusEl();
  el.textContent = text;
  el.className = `status-pill ${type}`;
}

function toggleButtons(disabled) {
  document.querySelectorAll(".mega-btn").forEach(btn => btn.disabled = disabled);
}

function fillPrompt(text) {
  document.getElementById("inputText").value = text;
}

function animateResult(text) {
  const frame = resultFrameEl();
  resultEl().innerText = "";
  frame.classList.remove("reveal");
  void frame.offsetWidth;
  frame.classList.add("reveal");

  typewriter(text, resultEl());
  updateTelemetry(text);
  addHistory(text);
}

function typewriter(text, element) {
  let i = 0;
  element.innerText = "";
  const speed = 14;

  const interval = setInterval(() => {
    element.innerText += text.charAt(i);
    i++;
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

function updateTelemetry(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tokenCount = words.length;
  const chaos = parseInt(dramaSliderEl().value);

  tokenPulseEl().innerText = `${Math.max(12, Math.min(99, tokenCount * 3))}%`;
  outputLengthEl().innerText = `${tokenCount} tokens`;

  if (chaos > 80) entropyVibeEl().innerText = "Unhinged";
  else if (chaos > 55) entropyVibeEl().innerText = "Volatile";
  else if (chaos > 30) entropyVibeEl().innerText = "Stable";
  else entropyVibeEl().innerText = "Restrained";

  if (tokenCount > 18) oracleMoodEl().innerText = "Visionary";
  else if (tokenCount > 10) oracleMoodEl().innerText = "Engaged";
  else oracleMoodEl().innerText = "Focused";
}

function addHistory(text) {
  historyItems.unshift(text);
  historyItems = historyItems.slice(0, 8);
  renderHistory();
}

function renderHistory() {
  const historyEl = historyListEl();

  if (historyItems.length === 0) {
    historyEl.innerHTML = `<div class="history-empty">No generations yet. Wake the machine.</div>`;
    return;
  }

  historyEl.innerHTML = historyItems
    .map(item => `<div class="history-item" onclick="reuseHistory(this)">${item}</div>`)
    .join("");
}

function reuseHistory(el) {
  const text = el.innerText;
  document.getElementById("inputText").value = text;
  addLog("[archive] restored previous prophecy to prompt field.");
}

function clearHistory() {
  historyItems = [];
  renderHistory();
  addLog("[archive] session archive purged.");
}

function addLog(message) {
  const log = systemLogEl();
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerText = message;
  log.prepend(line);

  while (log.children.length > 7) {
    log.removeChild(log.lastChild);
  }
}

function generateFromInput() {
  const input = document.getElementById("inputText").value.trim();

  if (!model || Object.keys(model).length === 0) {
    animateResult("Model not loaded yet...");
    return;
  }

  let startWords = input.length === 0
    ? Array(maxN - 1).fill("<s>")
    : input.toLowerCase().split(/\s+/);

  addLog(`[input] seeded with ${startWords.length} token(s).`);

  const generated = backoffInference(maxN, startWords);
  const formatted = formatSentence(generated);

  animateResult(formatted || "No output could be generated.");
  addLog("[output] prophecy emitted successfully.");
}

function generateRandom() {
  if (!model || Object.keys(model).length === 0) {
    animateResult("Model not loaded yet...");
    return;
  }

  addLog("[random] initiating void-born generation.");
  const startWords = Array(maxN - 1).fill("<s>");
  const generated = backoffInference(maxN, startWords);
  const formatted = formatSentence(generated);

  animateResult(formatted || "No output could be generated.");
  addLog("[output] random prophecy completed.");
}

async function copyResult() {
  const text = resultEl().innerText.trim();
  if (!text || text === "Your generated sentence will appear here.") return;

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.querySelector(".ghost-btn");
    const original = btn.textContent;
    btn.textContent = "Copied";
    addLog("[clipboard] output copied.");
    setTimeout(() => {
      btn.textContent = original;
    }, 1200);
  } catch (err) {
    console.error("Copy failed", err);
    addLog("[clipboard] copy failed.");
  }
}

function updateDramaUI() {
  const val = parseInt(dramaSliderEl().value);
  chaosValueEl().innerText = `${val}%`;

  if (val > 80) dramaLabelEl().innerText = "Maximum";
  else if (val > 55) dramaLabelEl().innerText = "High";
  else if (val > 30) dramaLabelEl().innerText = "Moderate";
  else dramaLabelEl().innerText = "Contained";
}

window.onload = () => {
  loadModel();
  dramaSliderEl().addEventListener("input", updateDramaUI);
  updateDramaUI();
};