let model = {};
let maxN = 5;

const resultEl = () => document.getElementById("result");
const resultBoxEl = () => document.getElementById("resultBox");
const statusEl = () => document.getElementById("modelStatus");
const buttonsEl = () => document.querySelectorAll("button.primary, button.secondary");

// Load model.json
async function loadModel() {
  try {
    setStatus("Loading model...", "loading");
    toggleButtons(true);

    const response = await fetch("model.json");
    if (!response.ok) {
      throw new Error("Failed to load model.json");
    }

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

    console.log("Model loaded");
    setStatus("Model ready", "ready");
    toggleButtons(false);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load model", "error");
    resultEl().innerText = "Could not load model.json. Make sure it is in the same folder.";
  }
}

// Weighted sampling
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

// Core backoff generator
function backoffInference(maxN, currentWords) {
  let result = [...currentWords];

  while (true) {
    let nextWord = null;

    for (let n = maxN; n > 0; n--) {
      const modelLevel = model[n];
      if (!modelLevel) continue;

      const contextSize = n - 1;
      const context = contextSize > 0
        ? currentWords.slice(-contextSize)
        : [];

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

    // Prevent absurdly long output
    if (result.length > 60) break;
  }

  return result;
}

// Clean sentence
function formatSentence(words) {
  let filtered = words.filter(w => w !== "<s>" && w !== "</s>");

  if (filtered.length === 0) return "";

  let sentence = "";

  for (let i = 0; i < filtered.length; i++) {
    const word = filtered[i];
    const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

    if (i === 0) {
      sentence += word;
    } else if (noSpaceBefore.includes(word)) {
      sentence += word;
    } else {
      sentence += " " + word;
    }
  }

  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  if (!/[.!?]$/.test(sentence)) {
    sentence += ".";
  }

  return sentence;
}

// UX helpers
function setStatus(text, type) {
  const el = statusEl();
  el.textContent = text;
  el.className = `status ${type}`;
}

function toggleButtons(disabled) {
  buttonsEl().forEach(btn => btn.disabled = disabled);
}

function animateResult(text) {
  const result = resultEl();
  const box = resultBoxEl();

  result.innerText = text;
  box.classList.remove("generated");
  void box.offsetWidth;
  box.classList.add("generated");
}

// Use user input
function generateFromInput() {
  const input = document.getElementById("inputText").value.trim();

  if (!model || Object.keys(model).length === 0) {
    animateResult("Model not loaded yet...");
    return;
  }

  let startWords;

  if (input.length === 0) {
    startWords = Array(maxN - 1).fill("<s>");
  } else {
    startWords = input.toLowerCase().split(/\s+/);
  }

  const generated = backoffInference(maxN, startWords);
  const formatted = formatSentence(generated);

  animateResult(formatted || "No output could be generated.");
}

function generateRandom() {
  if (!model || Object.keys(model).length === 0) {
    animateResult("Model not loaded yet...");
    return;
  }

  const startWords = Array(maxN - 1).fill("<s>");
  const generated = backoffInference(maxN, startWords);
  const formatted = formatSentence(generated);

  animateResult(formatted || "No output could be generated.");
}

async function copyResult() {
  const text = resultEl().innerText.trim();

  if (!text || text === "Your generated sentence will appear here.") return;

  try {
    await navigator.clipboard.writeText(text);
    const copyBtn = document.querySelector(".ghost");
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1200);
  } catch (err) {
    console.error("Copy failed", err);
  }
}

window.onload = loadModel;