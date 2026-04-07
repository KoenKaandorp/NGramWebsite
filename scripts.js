let model = {};
let maxN = 5;

// Load model.json
async function loadModel() {
  const response = await fetch("model.json");
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
}

// Weighted sampling (same as Python)
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
  }

  return result;
}

// Clean sentence
function formatSentence(words) {
  // Remove special tokens
  let filtered = words.filter(w => w !== "<s>" && w !== "</s>");

  if (filtered.length === 0) return "";

  let sentence = "";

  for (let i = 0; i < filtered.length; i++) {
    const word = filtered[i];

    // Punctuation that should NOT have a space before it
    const noSpaceBefore = [".", ",", "!", "?", ":", ";"];

    if (i === 0) {
      sentence += word;
    } else if (noSpaceBefore.includes(word)) {
      sentence += word; // attach directly
    } else {
      sentence += " " + word;
    }
  }

  // Capitalize first letter
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  if (!/[.!?]$/.test(sentence)) {
  sentence += ".";
}

  return sentence;
}

// Use user input
function generateFromInput() {
  const input = document.getElementById("inputText").value.trim();
  const output = document.getElementById("result");

  if (!model || Object.keys(model).length === 0) {
    output.innerText = "Model not loaded yet...";
    return;
  }

  let startWords;

  if (input.length === 0) {
    // fallback to default
    startWords = Array(maxN - 1).fill("<s>");
  } else {
    startWords = input.toLowerCase().split(/\s+/);
  }

  const generated = backoffInference(maxN, startWords);
  output.innerText = formatSentence(generated);
}

function generateRandom() {
  const output = document.getElementById("result");

  const startWords = Array(maxN - 1).fill("<s>");
  const generated = backoffInference(maxN, startWords);

  output.innerText = formatSentence(generated);
}

window.onload = loadModel;