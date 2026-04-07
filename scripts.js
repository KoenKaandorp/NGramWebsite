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
        usedDepth = n; // 👈 capture depth
        break;
      }
    }

    if (!nextWord || nextWord === "</s>") break;

    generated.push({
      word: nextWord,
      depth: usedDepth
    });

    currentWords.push(nextWord);
  }

  return generated;
}
function formatWords(wordObjs) {
  if (wordObjs.length === 0) return "";

  let text = "";
  const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

  for (let i = 0; i < wordObjs.length; i++) {
    const word = wordObjs[i].word;

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

function toggleLoadingState(isLoading) {
  document.querySelectorAll(".btn").forEach(btn => btn.disabled = isLoading);
  if (isLoading) {
    loadingOverlay().classList.remove("hidden");
  } else {
    loadingOverlay().classList.add("hidden");
  }
}

function clearText() {
  if (isGenerating) return;
  textEl().value = "";
  textEl().focus();
}

function getLastWords(text, count = maxN - 1) {
  // Pad punctuation with spaces so they become independent tokens, 
  // just like the N-gram model expects.
  const tokenizedText = text.replace(/([.,!?;:()])/g, ' $1 ');

  return tokenizedText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-count)
    .map(w => w.toLowerCase());
}

async function generateFromInput() {
  if (isGenerating) return;
  if (!model || Object.keys(model).length === 0) return;

  const textarea = textEl();
  const rawInput = textarea.value; // Keep the raw input to check for trailing spaces
  const input = rawInput.trim();

  isGenerating = true;
  toggleLoadingState(true);

  await new Promise(r => setTimeout(r, 600));

  let startWords;
  let appendText = "";
  let generatedWords = [];

  if (input.length === 0) {
    startWords = Array(maxN - 1).fill("<s>");
  const generated = backoffInference(maxN, [...startWords]);
const generatedWords = generated.map(g => g.word);

renderDepthViz(generated);
    appendText = formatWords(generatedWords);

    if (appendText.length > 0) {
      appendText = appendText.charAt(0).toUpperCase() + appendText.slice(1);
      if (!/[.!?]$/.test(appendText)) appendText += ".";
    }

    textarea.value = "";
  } else {
    startWords = getLastWords(input);
  const generated = backoffInference(maxN, [...startWords]);
const generatedWords = generated.map(g => g.word);

renderDepthViz(generated);
    appendText = formatWords(generatedWords);

    if (appendText.length > 0) {
      // Check if the user already left a space at the end of their text
      const needsSpace = !rawInput.match(/\s$/);
      
      // Don't add a space if the very first generated token is a punctuation mark
      const noSpaceBefore = [".", ",", "!", "?", ":", ";"];
      const firstToken = generatedWords[0];

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
  const speed = 3; // Slightly slower to match the ink bleed effect

  textarea.classList.add("generating");

  for (let i = 0; i < textToAppend.length; i++) {
    textarea.value += textToAppend[i];
    textarea.scrollTop = textarea.scrollHeight;
    await new Promise(resolve => setTimeout(resolve, speed));
  }

  textarea.classList.remove("generating");
}

async function generateRandom() {
  if (isGenerating) return;
  if (!model || Object.keys(model).length === 0) return;

  isGenerating = true;
  toggleLoadingState(true);

  await new Promise(r => setTimeout(r, 600));

  const textarea = textEl();
  const startWords = Array(maxN - 1).fill("<s>");
  const generated = backoffInference(maxN, [...startWords]);
const generatedWords = generated.map(g => g.word);

renderDepthViz(generated);
  let formatted = formatWords(generatedWords);

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

    // Height based on depth
    const heightPercent = (obj.depth / maxDepth) * 100;
    bar.style.height = heightPercent + "%";

    bar.title = `${obj.word} (n=${obj.depth})`;

    container.appendChild(bar);
  });
}