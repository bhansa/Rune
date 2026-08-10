import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

const invoke = window.__TAURI__?.core?.invoke;
const STORE_KEY = "rune.state.v1";

const SAMPLES = {
  javascript: `// JavaScript runs in the app's webview.
// A basic filesystem is available via the injected \`fs\` API.
console.log("Hello from Rune");

const nums = [1, 2, 3, 4, 5];
const sum = nums.reduce((a, b) => a + b, 0);
console.log("sum:", sum);

// Filesystem example (uncomment to try):
// await fs.writeFile("note.txt", "written from JS");
// console.log(await fs.readFile("note.txt"));

sum; // last expression shows as return value
`,
  python: `# Python runs via the system python3 interpreter.
print("Hello from Rune")

nums = [1, 2, 3, 4, 5]
print("sum:", sum(nums))

# The filesystem is real — ordinary open()/read/write works:
# with open("note.txt", "w") as f:
#     f.write("written from Python")
# print(open("note.txt").read())
`,
};

const THEMES = ["dark", "matte", "light"];

// ---- Persistent state ------------------------------------------------------
const state = loadState();
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      lang: parsed.lang || "javascript",
      theme: THEMES.includes(parsed.theme) ? parsed.theme : "dark",
      fontSize: clamp(parsed.fontSize || 13, 9, 28),
      editorW: parsed.editorW || "60%",
      code: {
        javascript: parsed.code?.javascript ?? SAMPLES.javascript,
        python: parsed.code?.python ?? SAMPLES.python,
      },
    };
  } catch {
    return { lang: "javascript", theme: "dark", fontSize: 13, editorW: "60%", code: { ...SAMPLES } };
  }
}
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

let currentLang = state.lang;

// ---- Editor ----------------------------------------------------------------
const editor = monaco.editor.create(document.getElementById("editor"), {
  value: state.code[currentLang],
  language: currentLang,
  theme: monacoThemeFor(state.theme),
  automaticLayout: true,
  fontSize: state.fontSize,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: "smooth",
  renderLineHighlight: "line",
  tabSize: 2,
  wordWrap: "on",
  padding: { top: 10, bottom: 10 },
});

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
});

editor.onDidChangeModelContent(() => {
  state.code[currentLang] = editor.getValue();
  saveState();
});

const cursorEl = document.getElementById("cursor-pos");
editor.onDidChangeCursorPosition((e) => {
  cursorEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
});

// ---- DOM refs --------------------------------------------------------------
const consoleEl = document.getElementById("console");
const statusEl = document.getElementById("status");
const fontLabel = document.getElementById("font-label");
const langLabel = document.getElementById("lang-label");
const panes = document.querySelector(".panes");
const divider = document.querySelector(".divider");

panes.style.setProperty("--editor-w", state.editorW);
fontLabel.textContent = `${state.fontSize}px`;
langLabel.textContent = currentLang === "python" ? "Python" : "JavaScript";

// ---- Theme -----------------------------------------------------------------
function monacoThemeFor(theme) {
  return theme === "light" ? "vs" : "vs-dark";
}
function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "dark";
  state.theme = theme;
  document.body.setAttribute("data-theme", theme);
  monaco.editor.setTheme(monacoThemeFor(theme));
  saveState();
  updateThemeCards();
}
applyTheme(state.theme);

// ---- Console rendering -----------------------------------------------------
function fmt(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(
      value,
      (_k, v) => (typeof v === "function" ? `[Function: ${v.name || "anonymous"}]` : v),
      2
    ) ?? String(value);
  } catch {
    return String(value);
  }
}

function addRow(kind, parts) {
  consoleEl.classList.add("has-rows");
  const row = document.createElement("div");
  row.className = `row row--${kind}`;
  const gutter = document.createElement("span");
  gutter.className = "row__gutter";
  gutter.textContent = kind === "return" ? "←" : kind === "error" ? "✕" : kind === "warn" ? "⚠" : "›";
  const body = document.createElement("span");
  body.className = "row__body";
  body.textContent = parts.map(fmt).join(" ");
  row.append(gutter, body);
  consoleEl.appendChild(row);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearConsole() {
  consoleEl.querySelectorAll(".row").forEach((r) => r.remove());
  consoleEl.classList.remove("has-rows");
  setStatus("");
}

function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = "console__status" + (tone ? ` is-${tone}` : "");
}

// ---- Filesystem bridge -----------------------------------------------------
const fs = {
  readFile: (path) => invoke("read_file", { path }),
  writeFile: (path, contents) => invoke("write_file", { path, contents }),
  readDir: (path) => invoke("read_dir", { path }),
  exists: (path) => invoke("exists", { path }),
};

// ---- Execution -------------------------------------------------------------
function elapsed(t0) {
  const ms = performance.now() - t0;
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

async function runJavaScript(code) {
  const captured = [];
  const proxy = {
    log: (...a) => captured.push(["log", a]),
    info: (...a) => captured.push(["log", a]),
    debug: (...a) => captured.push(["log", a]),
    warn: (...a) => captured.push(["warn", a]),
    error: (...a) => captured.push(["error", a]),
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  let returnValue;
  const t0 = performance.now();
  try {
    const fn = new AsyncFn("console", "fs", `"use strict";\nreturn (async () => {\n${code}\n})();`);
    returnValue = await fn(proxy, fs);
  } catch (err) {
    for (const [k, a] of captured) addRow(k, a);
    addRow("error", [err instanceof Error ? err : String(err)]);
    setStatus(`Error · ${elapsed(t0)}`, "error");
    return;
  }
  for (const [k, a] of captured) addRow(k, a);
  if (returnValue !== undefined) addRow("return", [returnValue]);
  setStatus(`Done · ${elapsed(t0)}`, "ok");
}

async function runPython(code) {
  if (!invoke) {
    addRow("error", ["Tauri bridge unavailable — run inside the desktop app."]);
    setStatus("Error", "error");
    return;
  }
  const t0 = performance.now();
  try {
    const res = await invoke("run_python", { code });
    if (res.stdout) res.stdout.replace(/\n$/, "").split("\n").forEach((line) => addRow("log", [line]));
    if (res.stderr) res.stderr.replace(/\n$/, "").split("\n").forEach((line) => addRow("error", [line]));
    if (res.code === 0) setStatus(`Done · ${elapsed(t0)}`, "ok");
    else setStatus(`Exited ${res.code} · ${elapsed(t0)}`, "error");
  } catch (err) {
    addRow("error", [String(err)]);
    setStatus("Error", "error");
  }
}

async function run() {
  const code = editor.getValue();
  setStatus("Running…", "running");
  if (currentLang === "javascript") await runJavaScript(code);
  else await runPython(code);
}

// ---- Language switching ----------------------------------------------------
function switchLang(lang) {
  if (lang === currentLang) return;
  state.code[currentLang] = editor.getValue();
  currentLang = lang;
  state.lang = lang;
  const model = editor.getModel();
  monaco.editor.setModelLanguage(model, lang);
  editor.setValue(state.code[lang]);
  document.querySelectorAll(".seg__btn").forEach((b) => {
    const active = b.dataset.lang === lang;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  langLabel.textContent = lang === "python" ? "Python" : "JavaScript";
  saveState();
  setStatus("");
}

// ---- Font size -------------------------------------------------------------
const DEFAULT_FONT = 13;
const MIN_FONT = 9;
const MAX_FONT = 28;
const fontValue = document.getElementById("font-value");

function applyFontSize() {
  editor.updateOptions({ fontSize: state.fontSize });
  consoleEl.style.fontSize = state.fontSize + "px";
  fontLabel.textContent = `${state.fontSize}px`;
  fontValue.textContent = `${state.fontSize}px`;
  saveState();
}
applyFontSize();

function bumpFont(delta) {
  state.fontSize = clamp(state.fontSize + delta, MIN_FONT, MAX_FONT);
  applyFontSize();
  setStatus(`Font ${state.fontSize}px`);
}
function resetFont() {
  state.fontSize = DEFAULT_FONT;
  applyFontSize();
  setStatus(`Font ${state.fontSize}px`);
}

// ---- Keybindings — capture phase so Monaco can't swallow them --------------
document.addEventListener(
  "keydown",
  (e) => {
    const mod = e.metaKey || e.ctrlKey;
    // Settings sheet Escape close (no modifier).
    if (!mod && e.key === "Escape" && !overlay.hasAttribute("hidden")) {
      e.preventDefault();
      closeSettings();
      return;
    }
    if (!mod) return;

    switch (e.code) {
      case "Enter":
      case "NumpadEnter":
        e.preventDefault(); e.stopPropagation();
        run();
        return;
      case "Equal":
      case "NumpadAdd":
        e.preventDefault(); e.stopPropagation();
        bumpFont(1);
        return;
      case "Minus":
      case "NumpadSubtract":
        e.preventDefault(); e.stopPropagation();
        bumpFont(-1);
        return;
      case "Digit0":
      case "Numpad0":
        e.preventDefault(); e.stopPropagation();
        resetFont();
        return;
      case "KeyK":
        e.preventDefault(); e.stopPropagation();
        clearConsole();
        return;
      case "Comma":
        e.preventDefault(); e.stopPropagation();
        toggleSettings();
        return;
    }
  },
  { capture: true }
);

// ---- Resizable divider -----------------------------------------------------
divider.addEventListener("mousedown", (e) => {
  e.preventDefault();
  document.body.classList.add("is-resizing");
  divider.classList.add("is-dragging");
  const onMove = (ev) => {
    const rect = panes.getBoundingClientRect();
    const pct = clamp(((ev.clientX - rect.left) / rect.width) * 100, 20, 80);
    const pctStr = pct.toFixed(2) + "%";
    panes.style.setProperty("--editor-w", pctStr);
    state.editorW = pctStr;
  };
  const onUp = () => {
    document.body.classList.remove("is-resizing");
    divider.classList.remove("is-dragging");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    saveState();
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});
divider.addEventListener("dblclick", () => {
  panes.style.setProperty("--editor-w", "60%");
  state.editorW = "60%";
  saveState();
});

// ---- Settings sheet --------------------------------------------------------
const overlay = document.getElementById("settings-overlay");

function openSettings() {
  overlay.hidden = false;
  updateThemeCards();
  fontValue.textContent = `${state.fontSize}px`;
}
function closeSettings() { overlay.hidden = true; }
function toggleSettings() { overlay.hidden ? openSettings() : closeSettings(); }

function updateThemeCards() {
  document.querySelectorAll(".themecard").forEach((card) => {
    const selected = card.dataset.themeValue === state.theme;
    card.classList.toggle("is-selected", selected);
    const radio = card.querySelector("input");
    if (radio) radio.checked = selected;
  });
}

document.getElementById("settings-btn").addEventListener("click", openSettings);
overlay.querySelectorAll("[data-close]").forEach((el) =>
  el.addEventListener("click", closeSettings)
);
document.querySelectorAll(".themecard").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    applyTheme(card.dataset.themeValue);
  });
});
document.getElementById("font-inc").addEventListener("click", () => bumpFont(1));
document.getElementById("font-dec").addEventListener("click", () => bumpFont(-1));
document.getElementById("font-reset").addEventListener("click", resetFont);

// ---- Buttons ---------------------------------------------------------------
document.querySelectorAll(".seg__btn").forEach((b) =>
  b.addEventListener("click", () => switchLang(b.dataset.lang))
);
document.getElementById("run-btn").addEventListener("click", run);
document.getElementById("clear-btn").addEventListener("click", clearConsole);
document.getElementById("reset-btn").addEventListener("click", () => {
  editor.setValue(SAMPLES[currentLang]);
  state.code[currentLang] = SAMPLES[currentLang];
  saveState();
});
fontLabel.addEventListener("click", resetFont);

// Sync initial UI state.
document.querySelectorAll(".seg__btn").forEach((b) => {
  const active = b.dataset.lang === currentLang;
  b.classList.toggle("is-active", active);
  b.setAttribute("aria-selected", String(active));
});
