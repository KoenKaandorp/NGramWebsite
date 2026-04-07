let model = {};
let maxN = 5;
let isGenerating = false;

const textEl = () => document.getElementById("inputText");

async function loadModel() {
  try {
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

    toggleButtons(false);
  } catch (error) {
    console.error(error);
    textEl().value = "Could not load model.json. Make sure it is in the same folder.";
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

function backoffInference(maxN, currentWords, maxGenerated = 30) {
  let generatedOnly = [];

  while (generatedOnly.length < maxGenerated) {
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

    if (!nextWord || nextWord === "</s>") break;

    generatedOnly.push(nextWord);
    currentWords.push(nextWord);
  }

  return generatedOnly;
}

function formatWords(words) {
  if (words.length === 0) return "";

  let text = "";
  const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (i === 0) {
      text += word;
    } else if (noSpaceBefore.includes(word)) {
      text += word;
    } else {
      text += " " + word;
    }
  }

  return text;
}

function toggleButtons(disabled) {
  document.querySelectorAll(".mega-btn").forEach(btn => btn.disabled = disabled);
}

function clearText() {
  if (isGenerating) return;
  textEl().value = "";
  textEl().focus();
}

function getLastWords(text, count = maxN - 1) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-count)
    .map(w => w.toLowerCase());
}

async function typeAppend(textToAppend) {
  const textarea = textEl();
  const speed = 28;

  textarea.classList.add("generating");

  for (let i = 0; i < textToAppend.length; i++) {
    textarea.value += textToAppend[i];
    textarea.scrollTop = textarea.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, speed));
  }

  textarea.classList.remove("generating");
}

async function generateFromInput() {
  if (isGenerating) return;
  if (!model || Object.keys(model).length === 0) return;

  const textarea = textEl();
  const input = textarea.value.trim();

  isGenerating = true;
  toggleButtons(true);

  let startWords;
  let appendText = "";

  if (input.length === 0) {
    startWords = Array(maxN - 1).fill("<s>");
    const generatedWords = backoffInference(maxN, [...startWords]);
    appendText = formatWords(generatedWords);

    if (appendText.length > 0) {
      appendText = appendText.charAt(0).toUpperCase() + appendText.slice(1);
      if (!/[.!?]$/.test(appendText)) appendText += ".";
    }

    textarea.value = "";
  } else {
    startWords = getLastWords(input);
    const generatedWords = backoffInference(maxN, [...startWords]);
    appendText = formatWords(generatedWords);

    if (appendText.length > 0) {
      appendText = input.endsWith(" ") ? appendText : " " + appendText;
    }
  }

  await typeAppend(appendText);

  isGenerating = false;
  toggleButtons(false);
}

async function generateRandom() {
  if (isGenerating) return;
  if (!model || Object.keys(model).length === 0) return;

  isGenerating = true;
  toggleButtons(true);

  const textarea = textEl();
  const startWords = Array(maxN - 1).fill("<s>");
  const generatedWords = backoffInference(maxN, [...startWords]);
  let formatted = formatWords(generatedWords);

  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    if (!/[.!?]$/.test(formatted)) formatted += ".";
  }

  textarea.value = "";
  await typeAppend(formatted);

  isGenerating = false;
  toggleButtons(false);
}

window.onload = loadModel;