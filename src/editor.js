// Monaco editor setup — instance, language switching, theme, font size.
// Owns the editor's DOM footprint and the labels that mirror its state.

import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import { state, saveState, SAMPLES, THEMES, clamp } from "./state.js";
import { setConsoleFontSize, setStatus } from "./console.js";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

const cursorEl = document.getElementById("cursor-pos");
const fontLabel = document.getElementById("font-label");
const langLabel = document.getElementById("lang-label");
const fontValue = document.getElementById("font-value");

export function monacoThemeFor(theme) { return theme === "light" ? "vs" : "vs-dark"; }

export const editor = monaco.editor.create(document.getElementById("editor"), {
  value: state.code[state.lang],
  language: state.lang,
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
  inlineSuggest: { enabled: true, mode: "prefix", showToolbar: "always" },
});

monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false, noSyntaxValidation: false,
});
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
});

// Hooks: consumers (companion idle timer, main.js persistence) plug in via
// these setters so this module doesn't have to import them.
let onChangeHook = null;
let onCursorHook = null;
export function setOnChange(fn) { onChangeHook = fn; }
export function setOnCursor(fn) { onCursorHook = fn; }

editor.onDidChangeModelContent(() => {
  state.code[state.lang] = editor.getValue();
  saveState();
  if (onChangeHook) onChangeHook();
});
editor.onDidChangeCursorPosition((e) => {
  cursorEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  if (onCursorHook) onCursorHook(e);
});

langLabel.textContent = state.lang === "python" ? "Python" : "JavaScript";
fontLabel.textContent = `${state.fontSize}px`;

export function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "dark";
  state.theme = theme;
  document.body.setAttribute("data-theme", theme);
  monaco.editor.setTheme(monacoThemeFor(theme));
  saveState();
}

export function switchLang(lang) {
  if (lang === state.lang) return;
  state.code[state.lang] = editor.getValue();
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

const DEFAULT_FONT = 13;
const MIN_FONT = 9;
const MAX_FONT = 28;

export function applyFontSize() {
  editor.updateOptions({ fontSize: state.fontSize });
  setConsoleFontSize(state.fontSize);
  fontLabel.textContent = `${state.fontSize}px`;
  fontValue.textContent = `${state.fontSize}px`;
  saveState();
}

export function bumpFont(delta) {
  state.fontSize = clamp(state.fontSize + delta, MIN_FONT, MAX_FONT);
  applyFontSize();
  setStatus(`Font ${state.fontSize}px`);
}

export function resetFont() {
  state.fontSize = DEFAULT_FONT;
  applyFontSize();
  setStatus(`Font ${state.fontSize}px`);
}

export function resetCurrentToSample() {
  editor.setValue(SAMPLES[state.lang]);
  state.code[state.lang] = SAMPLES[state.lang];
  saveState();
}
