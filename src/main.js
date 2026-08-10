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

sum; // last expression shows as return value
`,
  python: `# Python runs via the system python3 interpreter.
print("Hello from Rune")

nums = [1, 2, 3, 4, 5]
print("sum:", sum(nums))
`,
};

const THEMES = ["dark", "matte", "light"];
const PROVIDERS = ["anthropic", "ollama"];
const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5",
  ollama: "qwen2.5-coder:7b",
};

// Curated Anthropic list — kept in preference order (fastest → most capable).
const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5",  label: "Haiku 4.5 — fast, cheap (recommended)" },
  { id: "claude-sonnet-5",   label: "Sonnet 5 — balanced quality" },
  { id: "claude-opus-5",     label: "Opus 5 — best quality" },
  { id: "claude-fable-5",    label: "Fable 5" },
];

// ---- Persistent state ------------------------------------------------------
const state = loadState();
function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      lang: p.lang || "javascript",
      theme: THEMES.includes(p.theme) ? p.theme : "dark",
      fontSize: clamp(p.fontSize || 13, 9, 28),
      editorW: p.editorW || "60%",
      code: {
        javascript: p.code?.javascript ?? SAMPLES.javascript,
        python: p.code?.python ?? SAMPLES.python,
      },
      companion: {
        enabled: !!p.companion?.enabled,
        provider: PROVIDERS.includes(p.companion?.provider) ? p.companion.provider : "anthropic",
        apiKey: p.companion?.apiKey || "",
        model: {
          anthropic: p.companion?.model?.anthropic || DEFAULT_MODELS.anthropic,
          ollama: p.companion?.model?.ollama || DEFAULT_MODELS.ollama,
        },
        idleMs: clamp(p.companion?.idleMs || 4000, 1500, 8000),
      },
    };
  } catch {
    return defaultState();
  }
}
function defaultState() {
  return {
    lang: "javascript",
    theme: "dark",
    fontSize: 13,
    editorW: "60%",
    code: { ...SAMPLES },
    companion: {
      enabled: false,
      provider: "anthropic",
      apiKey: "",
      model: { ...DEFAULT_MODELS },
      idleMs: 4000,
    },
  };
}
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

let currentLang = state.lang;
let lastError = ""; // fed to companion for context

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
  inlineSuggest: { enabled: true, mode: "prefix" },
});

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false, noSyntaxValidation: false,
});
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
});

editor.onDidChangeModelContent(() => {
  state.code[currentLang] = editor.getValue();
  saveState();
  resetIdle();
});
const cursorEl = document.getElementById("cursor-pos");
editor.onDidChangeCursorPosition((e) => {
  cursorEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  resetIdle();
  dismissHint();
});

// ---- DOM refs --------------------------------------------------------------
const consoleEl = document.getElementById("console");
const statusEl = document.getElementById("status");
const fontLabel = document.getElementById("font-label");
const langLabel = document.getElementById("lang-label");
const panes = document.querySelector(".panes");
const divider = document.querySelector(".divider");
const overlay = document.getElementById("settings-overlay");
const companionBadge = document.getElementById("companion-badge");

panes.style.setProperty("--editor-w", state.editorW);
fontLabel.textContent = `${state.fontSize}px`;
langLabel.textContent = currentLang === "python" ? "Python" : "JavaScript";

// ---- Theme -----------------------------------------------------------------
function monacoThemeFor(theme) { return theme === "light" ? "vs" : "vs-dark"; }
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
function fmt(v) {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "function" ? `[Function: ${val.name || "anonymous"}]` : val), 2) ?? String(v);
  } catch { return String(v); }
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
  if (kind === "error") lastError = parts.map(fmt).join(" ");
}
function clearConsole() {
  consoleEl.querySelectorAll(".row").forEach((r) => r.remove());
  consoleEl.classList.remove("has-rows");
  setStatus("");
  lastError = "";
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
  if (!invoke) { addRow("error", ["Tauri bridge unavailable — run inside the desktop app."]); setStatus("Error", "error"); return; }
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
  monaco.editor.setModelLanguage(editor.getModel(), lang);
  editor.setValue(state.code[lang]);
  document.querySelectorAll(".seg__btn[data-lang]").forEach((b) => {
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
function bumpFont(delta) { state.fontSize = clamp(state.fontSize + delta, MIN_FONT, MAX_FONT); applyFontSize(); setStatus(`Font ${state.fontSize}px`); }
function resetFont() { state.fontSize = DEFAULT_FONT; applyFontSize(); setStatus(`Font ${state.fontSize}px`); }

// ===== Companion mode ======================================================
let idleTimer = null;
let allowInlineSuggestion = false;   // gates the provider so it only runs when *we* decide it should
let currentAbort = null;

function companionOn() { return state.companion.enabled; }
function currentModel() { return state.companion.model[state.companion.provider] || DEFAULT_MODELS[state.companion.provider]; }

function resetIdle() {
  clearTimeout(idleTimer);
  if (!companionOn()) return;
  idleTimer = setTimeout(triggerInlineSuggestion, state.companion.idleMs);
}

function triggerInlineSuggestion() {
  const pos = editor.getPosition();
  if (!pos) return;
  const model = editor.getModel();
  // Don't fire if inside a comment/string, or if the line after cursor already has content on the same line.
  const line = model.getLineContent(pos.lineNumber);
  const suffix = line.slice(pos.column - 1);
  if (suffix.trim().length > 0) return; // let the user finish that line first
  allowInlineSuggestion = true;
  editor.trigger("companion", "editor.action.inlineSuggest.trigger", {});
}

function contextAround(model, pos, maxLinesBefore = 60, maxLinesAfter = 20) {
  const startLine = Math.max(1, pos.lineNumber - maxLinesBefore);
  const endLine = Math.min(model.getLineCount(), pos.lineNumber + maxLinesAfter);
  const before = model.getValueInRange({
    startLineNumber: startLine, startColumn: 1,
    endLineNumber: pos.lineNumber, endColumn: pos.column,
  });
  const after = model.getValueInRange({
    startLineNumber: pos.lineNumber, startColumn: pos.column,
    endLineNumber: endLine, endColumn: model.getLineMaxColumn(endLine),
  });
  return { before, after };
}

async function callCompanion(mode) {
  if (!invoke) throw new Error("Not running inside Rune desktop app.");
  const model = editor.getModel();
  const pos = editor.getPosition();
  const { before, after } = contextAround(model, pos);
  const req = {
    provider: state.companion.provider,
    api_key: state.companion.apiKey,
    model: currentModel(),
    mode,
    language: currentLang,
    before,
    after,
    error: mode === "hint" ? lastError : "",
  };
  companionBadge.classList.add("is-thinking");
  try {
    const res = await invoke("companion_complete", { req });
    return (res?.text || "").trimEnd();
  } finally {
    companionBadge.classList.remove("is-thinking");
  }
}

monaco.languages.registerInlineCompletionsProvider(["javascript", "python"], {
  async provideInlineCompletions(model, position, _ctx, token) {
    if (!companionOn() || !allowInlineSuggestion) return { items: [] };
    allowInlineSuggestion = false;
    try {
      const text = await callCompanion("complete");
      if (token.isCancellationRequested) return { items: [] };
      if (!text) {
        setStatus("Companion had nothing to suggest here.", "");
        return { items: [] };
      }
      setStatus("Companion suggested — Tab to accept", "ok");
      return { items: [{ insertText: text, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] };
    } catch (e) {
      setStatus(`Companion: ${String(e).replace(/^Error:\s*/, "").slice(0, 140)}`, "error");
      return { items: [] };
    }
  },
  freeInlineCompletions() {},
});

// ---- Hint widget (⌘I) ------------------------------------------------------
let hintWidget = null;
function dismissHint() {
  if (hintWidget) { editor.removeContentWidget(hintWidget); hintWidget = null; }
}
async function askHint() {
  if (!companionOn()) { setStatus("Turn on Companion in Settings first.", "error"); return; }
  const pos = editor.getPosition();
  if (!pos) return;
  setStatus("Companion is thinking…", "running");
  try {
    const text = await callCompanion("hint");
    if (!text) { setStatus("Companion returned nothing.", "error"); return; }
    showHint(text, pos);
    setStatus("");
  } catch (e) {
    // Show the full Rust-side error (up to a sane length). Includes actionable
    // "install a coder model" text when a reasoning model returns empty.
    const msg = String(e).replace(/^Error:\s*/, "");
    setStatus(msg.slice(0, 180), "error");
    // Also surface it in the console pane so it doesn't just live in the tiny status pill.
    addRow("error", ["Companion: " + msg]);
  }
}
function showHint(text, pos) {
  dismissHint();
  const node = document.createElement("div");
  node.className = "companion-hint";
  node.textContent = text;
  hintWidget = {
    getId() { return "rune.companion.hint"; },
    getDomNode() { return node; },
    getPosition() {
      return {
        position: { lineNumber: pos.lineNumber, column: 1 },
        preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW],
      };
    },
  };
  editor.addContentWidget(hintWidget);
}

// ---- Keybindings — capture phase so Monaco can't swallow them -------------
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod && e.key === "Escape") {
    if (!overlay.hasAttribute("hidden")) { e.preventDefault(); closeSettings(); return; }
    if (hintWidget) { e.preventDefault(); dismissHint(); return; }
  }
  if (!mod) return;
  switch (e.code) {
    case "Enter": case "NumpadEnter": e.preventDefault(); e.stopPropagation(); run(); return;
    case "Equal": case "NumpadAdd": e.preventDefault(); e.stopPropagation(); bumpFont(1); return;
    case "Minus": case "NumpadSubtract": e.preventDefault(); e.stopPropagation(); bumpFont(-1); return;
    case "Digit0": case "Numpad0": e.preventDefault(); e.stopPropagation(); resetFont(); return;
    case "KeyK": e.preventDefault(); e.stopPropagation(); clearConsole(); return;
    case "Comma": e.preventDefault(); e.stopPropagation(); toggleSettings(); return;
    case "KeyI": e.preventDefault(); e.stopPropagation(); askHint(); return;
  }
}, { capture: true });

// ---- Resizable divider ----------------------------------------------------
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
divider.addEventListener("dblclick", () => { panes.style.setProperty("--editor-w", "60%"); state.editorW = "60%"; saveState(); });

// ===== Settings sheet =======================================================
function openSettings() {
  overlay.hidden = false;
  updateThemeCards();
  syncCompanionUI();
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

// --- Companion settings wiring
const cEnabled = document.getElementById("companion-enabled");
const cFields = document.getElementById("companion-fields");
const cKey = document.getElementById("companion-key");
const cModel = document.getElementById("companion-model");
const cIdle = document.getElementById("companion-idle");
const cIdleVal = document.getElementById("companion-idle-val");
const cModelHint = document.getElementById("companion-model-hint");
const cRefresh = document.getElementById("companion-refresh");

function populateModelOptions(availableOllama = null) {
  const provider = state.companion.provider;
  const saved = currentModel();
  cModel.innerHTML = "";

  const opts = [];
  if (provider === "anthropic") {
    for (const m of ANTHROPIC_MODELS) opts.push({ id: m.id, label: m.label });
  } else {
    // Ollama: pull from live daemon if we have it, otherwise show the saved model alone.
    if (Array.isArray(availableOllama) && availableOllama.length) {
      for (const name of availableOllama) opts.push({ id: name, label: name });
    } else if (saved) {
      opts.push({ id: saved, label: saved });
    }
  }

  // Guarantee the saved model is present even if not in the curated list.
  if (saved && !opts.some((o) => o.id === saved)) {
    opts.unshift({ id: saved, label: `${saved} (custom)` });
  }

  for (const o of opts) {
    const el = document.createElement("option");
    el.value = o.id;
    el.textContent = o.label;
    if (o.id === saved) el.selected = true;
    cModel.appendChild(el);
  }
}

function syncCompanionUI() {
  cEnabled.checked = state.companion.enabled;
  cFields.classList.toggle("is-open", state.companion.enabled);
  document.body.setAttribute("data-companion-provider", state.companion.provider);
  document.querySelectorAll(".seg__btn[data-provider]").forEach((b) => {
    const active = b.dataset.provider === state.companion.provider;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  cKey.value = state.companion.apiKey || "";
  populateModelOptions();
  cIdle.value = state.companion.idleMs;
  cIdleVal.textContent = `${state.companion.idleMs}ms`;
  cModelHint.textContent = state.companion.provider === "anthropic"
    ? "Haiku is fastest; Sonnet/Opus are stronger for tricky code."
    : "Requires `ollama serve` running locally. Click ↻ to list installed models.";
  companionBadge.classList.toggle("is-on", state.companion.enabled);

  // On Ollama, auto-refresh the model list the first time settings open so
  // the dropdown reflects reality without the user hitting ↻.
  if (state.companion.provider === "ollama" && invoke && !cRefresh.dataset.autoDone) {
    cRefresh.dataset.autoDone = "1";
    refreshOllamaModels(true);
  }
}

async function refreshOllamaModels(silent = false) {
  if (!silent) cModelHint.textContent = "Checking Ollama…";
  try {
    const models = await invoke("ollama_list_models");
    populateModelOptions(models);
    cModelHint.textContent = models.length
      ? `Installed: ${models.slice(0, 6).join(", ")}${models.length > 6 ? "…" : ""}`
      : "No models installed. Try: ollama pull qwen2.5-coder:7b";
  } catch (e) {
    if (!silent) cModelHint.textContent = String(e);
  }
}

cEnabled.addEventListener("change", () => {
  state.companion.enabled = cEnabled.checked;
  saveState();
  syncCompanionUI();
  if (state.companion.enabled) resetIdle();
});
document.querySelectorAll(".seg__btn[data-provider]").forEach((b) =>
  b.addEventListener("click", () => {
    state.companion.provider = b.dataset.provider;
    delete cRefresh.dataset.autoDone; // re-fetch Ollama list on next open if switching back
    saveState();
    syncCompanionUI();
  })
);
cKey.addEventListener("input", () => { state.companion.apiKey = cKey.value.trim(); saveState(); });
cModel.addEventListener("change", () => {
  state.companion.model[state.companion.provider] = cModel.value || DEFAULT_MODELS[state.companion.provider];
  saveState();
});
cIdle.addEventListener("input", () => {
  state.companion.idleMs = parseInt(cIdle.value, 10) || 4000;
  cIdleVal.textContent = `${state.companion.idleMs}ms`;
  saveState();
});
cRefresh.addEventListener("click", () => refreshOllamaModels(false));

document.getElementById("settings-btn").addEventListener("click", openSettings);
overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeSettings));
document.querySelectorAll(".themecard").forEach((card) =>
  card.addEventListener("click", (e) => { e.preventDefault(); applyTheme(card.dataset.themeValue); })
);
document.getElementById("font-inc").addEventListener("click", () => bumpFont(1));
document.getElementById("font-dec").addEventListener("click", () => bumpFont(-1));
document.getElementById("font-reset").addEventListener("click", resetFont);

// ---- Toolbar buttons ------------------------------------------------------
document.querySelectorAll(".seg__btn[data-lang]").forEach((b) =>
  b.addEventListener("click", () => switchLang(b.dataset.lang))
);
document.getElementById("run-btn").addEventListener("click", run);
document.getElementById("clear-btn").addEventListener("click", clearConsole);
document.getElementById("reset-btn").addEventListener("click", () => {
  editor.setValue(SAMPLES[currentLang]); state.code[currentLang] = SAMPLES[currentLang]; saveState();
});
fontLabel.addEventListener("click", resetFont);

// Sync initial UI state.
document.querySelectorAll(".seg__btn[data-lang]").forEach((b) => {
  const active = b.dataset.lang === currentLang;
  b.classList.toggle("is-active", active);
  b.setAttribute("aria-selected", String(active));
});
syncCompanionUI();
