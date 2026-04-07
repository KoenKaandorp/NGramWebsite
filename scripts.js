let model = {};
let maxN = 10;
let isGenerating = false;

const textEl = () => document.getElementById("inputText");
const loadingOverlay = () => document.getElementById("loadingOverlay");

/* ─────────────────────────────────────────────
   PARTICLE SYSTEM (floating ember/ash particles)
   ───────────────────────────────────────────── */
(function initParticles() {
    const canvas = document.getElementById("particleCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W, H, particles;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function createParticle() {
        const isEmber = Math.random() < 0.3;
        return {
            x: Math.random() * W,
            y: H + 10,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -(Math.random() * 0.6 + 0.2),
            life: 1,
            decay: Math.random() * 0.003 + 0.001,
            size: Math.random() * (isEmber ? 2.5 : 1.5) + 0.5,
            color: isEmber
                ? `hsl(${20 + Math.random() * 30}, 90%, ${40 + Math.random() * 30}%)`
                : `hsl(${40 + Math.random() * 20}, 60%, ${50 + Math.random() * 20}%)`,
            flicker: Math.random() * Math.PI * 2,
        };
    }

    resize();
    particles = Array.from({ length: 60 }, createParticle).map(p => {
        p.y = Math.random() * H; // spread initial Y
        return p;
    });

    window.addEventListener("resize", resize);

    function tick() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.flicker += 0.05;

            const alpha = p.life * (0.7 + 0.3 * Math.sin(p.flicker));
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            if (p.life <= 0 || p.y < -10) {
                particles[i] = createParticle();
            }
        });
        ctx.globalAlpha = 1;
        requestAnimationFrame(tick);
    }

    tick();
})();

/* ─────────────────────────────────────────────
   MODEL LOADING
   ───────────────────────────────────────────── */
async function loadModel() {
    try {
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
    } catch (error) {
        console.error(error);
        textEl().value =
            "The archives are sealed — the palantír cannot find model.json.\n\n" +
            "Place model.json in the same directory to awaken the Chronicle.";
    }
}

/* ─────────────────────────────────────────────
   N-GRAM INFERENCE
   ───────────────────────────────────────────── */
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
    const generated = [];

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

    const noSpaceBefore = [".", ",", "!", "?", ":", ";"];
    const filtered = wordObjs.filter(obj => obj.word !== "<s>");
    let text = "";

    filtered.forEach((obj, i) => {
        const word = obj.word;
        if (i === 0) text += word;
        else if (noSpaceBefore.includes(word)) text += word;
        else text += " " + word;
    });

    return text;
}

/* ─────────────────────────────────────────────
   UI HELPERS
   ───────────────────────────────────────────── */
function clearText() {
    if (isGenerating) return;
    textEl().value = "";
    textEl().focus();
}

function getLastWords(text, count = maxN - 1) {
    return text
        .replace(/([.,!?;:()])/g, " $1 ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(-count)
        .map(w => w.toLowerCase());
}

/* ─────────────────────────────────────────────
   GENERATE — CONTINUE FROM INPUT
   ───────────────────────────────────────────── */
async function generateFromInput() {
    if (isGenerating || !Object.keys(model).length) return;

    const textarea = textEl();
    const rawInput = textarea.value;
    const input = rawInput.trim();

    isGenerating = true;
    showLoading(true);

    await new Promise(r => setTimeout(r, 400));

    let startWords;

    if (input.length) {
        const words = getLastWords(input);
        const needed = maxN - 1 - words.length;

        startWords = [
            ...Array(Math.max(0, needed)).fill("<s>"),
            ...words
        ];
    } else {
        startWords = Array(maxN - 1).fill("<s>");
    }

    const generated = backoffInference(maxN, [...startWords]);
    renderDepthViz(generated);

    let appendText = formatWords(generated);

    if (appendText.length > 0) {
        if (!input.length) {
            appendText = appendText.charAt(0).toUpperCase() + appendText.slice(1);
            if (!/[.!?]$/.test(appendText)) appendText += ".";
            textarea.value = "";
        } else {
            const needsSpace = !rawInput.match(/\s$/);
            const firstToken = generated[0]?.word;
            const noSpaceBefore = [".", ",", "!", "?", ":", ";"];
            if (needsSpace && !noSpaceBefore.includes(firstToken)) appendText = " " + appendText;
        }
    }

    showLoading(false);
    await typeAppend(appendText);
    isGenerating = false;
}

/* ─────────────────────────────────────────────
   GENERATE — RANDOM
   ───────────────────────────────────────────── */
async function generateRandom() {
    if (isGenerating || !Object.keys(model).length) return;

    isGenerating = true;
    showLoading(true);

    await new Promise(r => setTimeout(r, 400));

    const startWords = Array(maxN - 1).fill("<s>");
    const generated = backoffInference(maxN, [...startWords]);
    renderDepthViz(generated.filter(obj => obj.word !== "<s>"));

    let formatted = formatWords(generated);
    if (formatted.length > 0) {
        formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
        if (!/[.!?]$/.test(formatted)) formatted += ".";
    }

    showLoading(false);
    textEl().value = "";
    await typeAppend(formatted);
    isGenerating = false;
}

/* ─────────────────────────────────────────────
   TYPEWRITER EFFECT
   ───────────────────────────────────────────── */
async function typeAppend(textToAppend) {
    const textarea = textEl();
    textarea.classList.add("generating");

    for (const char of textToAppend) {
        textarea.value += char;
        textarea.scrollTop = textarea.scrollHeight;

        // Slightly variable delay for organic feel
        const delay = char === " " ? 6 : char.match(/[.!?,;:]/) ? 40 : 4;
        await new Promise(r => setTimeout(r, delay));
    }

    textarea.classList.remove("generating");
}

/* ─────────────────────────────────────────────
   LOADING (Palantír)
   ───────────────────────────────────────────── */
function showLoading(visible) {
    const el = loadingOverlay();
    if (!el) return;
    if (visible) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
}

/* ─────────────────────────────────────────────
   DEPTH VISUALISER
   ───────────────────────────────────────────── */
function renderDepthViz(wordObjs) {
    const container = document.querySelector(".depth-bars");
    if (!container) return;
    container.innerHTML = "";

    const tooltip = document.getElementById("depthTooltip");

    wordObjs.forEach(obj => {
        const bar = document.createElement("div");
        bar.className = "depth-bar";
        bar.style.height = ((obj.depth / maxN) * 100) + "%";
        bar.dataset.word = obj.word;
        bar.dataset.depth = obj.depth;

        bar.addEventListener("mouseenter", () => {
            tooltip.innerHTML = `<strong>${obj.word}</strong> · depth ${obj.depth}`;
            tooltip.style.opacity = 1;
        });

        bar.addEventListener("mousemove", (e) => {
            tooltip.style.left = e.clientX + "px";
            tooltip.style.top = e.clientY + "px";
        });

        bar.addEventListener("mouseleave", () => {
            tooltip.style.opacity = 0;
        });

        container.appendChild(bar);
    });
}

/* ─────────────────────────────────────────────
   KEYBOARD SHORTCUT: Ctrl/Cmd+Enter → Continue
   ───────────────────────────────────────────── */
document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        generateFromInput();
    }
});

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
window.onload = loadModel;
