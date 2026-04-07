let model = {};
let maxN = 5;
let isGenerating = false;

const textEl = () => document.getElementById("inputText");
const loadingOverlay = () => document.getElementById("loadingOverlay");

async function loadModel() {
  try {
    toggleLoadingState(true);

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

    toggleLoadingState(false);
  } catch (error) {
    console.error(error);
    textEl().value = "The archives are sealed. Could not load model.json.";
    toggleLoadingState(false);
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
  let generated = [];

  while (generated.length < maxGenerated) {
    let nextWord = null;
    let usedDepth = 0;

    for (let n = maxN; n > 0; n--) {
      const modelLevel = model[n];
      if (!modelLevel) continue;

      const contextSize = n - 1;
      const context = contextSize > 0 ? currentWords.slice(-contextSize) : [];
      const key = context.join("|||");

      if (modelLevel[key]) {
        nextWord = weightedRandomChoice(modelLevel[key]);
        usedDepth = n;
        break;
      }
    }

    if (!nextWord || nextWord === "</s>") break;

    generated.push({ word: nextWord, depth: usedDepth });
    currentWords.push(nextWord);
  }

  return generated;
}

function formatWords(wordObjs) {
  if (!wordObjs.length) return "";

  let text = "";
  const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

  // Filter out special tokens like <s>
  const filtered = wordObjs.filter(obj => obj.word !== "<s>");

  filtered.forEach((obj, i) => {
    const word = obj.word;

    if (i === 0) {
      text += word;
    } else if (noSpaceBefore.includes(word)) {
      text += word;
    } else {
      text += " " + word;
    }
  });

  return text;
}

function toggleLoadingState(isLoading) {
  document.querySelectorAll(".btn").forEach(btn => btn.disabled = isLoading);
  loadingOverlay().classList.toggle("hidden", !isLoading);
}

function clearText() {
  if (isGenerating) return;
  textEl().value = "";
  textEl().focus();
}

function getLastWords(text, count = maxN - 1) {
  const tokenizedText = text.replace(/([.,!?;:()])/g, ' $1 ');

  return tokenizedText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-count)
    .map(w => w.toLowerCase());
}

async function generateFromInput() {
  if (isGenerating || !Object.keys(model).length) return;

  const textarea = textEl();
  const rawInput = textarea.value;
  const input = rawInput.trim();

  isGenerating = true;
  toggleLoadingState(true);

  await new Promise(r => setTimeout(r, 400));

  let startWords;
  let appendText = "";

  if (!input.length) {
    startWords = Array(maxN - 1).fill("<s>");
  } else {
    startWords = getLastWords(input);
  }

  const generated = backoffInference(maxN, [...startWords]);
  renderDepthViz(generated);

  appendText = formatWords(generated);

  if (appendText.length > 0) {
    if (!input.length) {
      appendText = appendText.charAt(0).toUpperCase() + appendText.slice(1);
      if (!/[.!?]$/.test(appendText)) appendText += ".";
      textarea.value = "";
    } else {
      const needsSpace = !rawInput.match(/\s$/);
      const firstToken = generated[0]?.word;
      const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

      if (needsSpace && !noSpaceBefore.includes(firstToken)) {
        appendText = " " + appendText;
      }
    }
  }

  toggleLoadingState(false);
  await typeAppend(appendText);

  isGenerating = false;
}

async function typeAppend(textToAppend) {
  const textarea = textEl();
  textarea.classList.add("generating");

  for (let char of textToAppend) {
    textarea.value += char;
    textarea.scrollTop = textarea.scrollHeight;
    await new Promise(r => setTimeout(r, 3));
  }

  textarea.classList.remove("generating");
}

async function generateRandom() {
  if (isGenerating || !Object.keys(model).length) return;

  isGenerating = true;
  toggleLoadingState(true);

  await new Promise(r => setTimeout(r, 400));

  const textarea = textEl();
  const startWords = Array(maxN - 1).fill("<s>");

  const generated = backoffInference(maxN, [...startWords]);
  renderDepthViz(generated);

  let formatted = formatWords(generated);

  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    if (!/[.!?]$/.test(formatted)) formatted += ".";
  }

  textarea.value = "";
  toggleLoadingState(false);
  await typeAppend(formatted);

  isGenerating = false;
}

window.onload = loadModel;

function renderDepthViz(wordObjs) {
  const container = document.getElementById("depthViz");
  container.innerHTML = "";

  const maxDepth = maxN;

  wordObjs.forEach(obj => {
    const bar = document.createElement("div");
    bar.className = "depth-bar";

    const heightPercent = (obj.depth / maxDepth) * 100;
    bar.style.height = heightPercent + "%";

    bar.title = `${obj.word} (n=${obj.depth})`;

    container.appendChild(bar);
  });
}
