// Rune — entry point. Wires modules together: initial UI sync, top-level
// event listeners, and the split-pane divider. Everything else lives in
// its own module.

import { state, saveState, SAMPLES, clamp } from "./state.js";
import {
  editor, applyTheme, applyFontSize, bumpFont, resetFont,
  switchLang, resetCurrentToSample, setOnChange, setOnCursor,
} from "./editor.js";
import { clearConsole, setStatus } from "./console.js";
import { runJavaScript } from "./execution/js.js";
import { runPython } from "./execution/py.js";
import { registerInlineCompletions, resetIdle, askHint } from "./companion/inline.js";
import { wireCompanionSettings, syncCompanionUI } from "./companion/settings.js";
import { applyPet, wirePetButtons } from "./pets/index.js";
import {
  wireSettingsSheet, openSettings, closeSettings, toggleSettings,
  updateThemeCards, isSettingsOpen,
} from "./settings/sheet.js";
import { scheduleUpdateCheck } from "./updater.js";
import { wireMultiplayerSettings, syncMultiplayerUI, autoReconnectMultiplayer } from "./multiplayer/settings.js";
import { wireRoomDialog, refreshRoomButton, isRoomOpen, closeRoom } from "./multiplayer/dialog.js";
import { wireProblemsDialog, refreshProblemsButton, isProblemsOpen, closeProblems } from "./problems/dialog.js";

// ---- Initial paint ---------------------------------------------------------
const panes = document.querySelector(".panes");
const divider = document.querySelector(".divider");
panes.style.setProperty("--editor-w", state.editorW);
applyTheme(state.theme);
applyFontSize();

// The idle timer for auto-suggestions is fed by every keystroke and cursor move.
setOnChange(resetIdle);
setOnCursor(resetIdle);

// ---- Run ------------------------------------------------------------------
async function run() {
  const code = editor.getValue();
  setStatus("Running…", "running");
  if (state.lang === "javascript") await runJavaScript(code);
  else await runPython(code);
}

// ---- Keybindings — capture phase so Monaco can't swallow them -------------
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod && e.key === "Escape") {
    if (isSettingsOpen()) { e.preventDefault(); closeSettings(); return; }
    if (isRoomOpen())     { e.preventDefault(); closeRoom();     return; }
    if (isProblemsOpen()) { e.preventDefault(); closeProblems(); return; }
    // Ghost completions dismiss themselves on any typed key; Esc suffices.
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
divider.addEventListener("dblclick", () => {
  panes.style.setProperty("--editor-w", "60%");
  state.editorW = "60%";
  saveState();
});

// ---- Toolbar buttons ------------------------------------------------------
document.querySelectorAll(".seg__btn[data-lang]").forEach((b) =>
  b.addEventListener("click", () => switchLang(b.dataset.lang))
);
document.getElementById("run-btn").addEventListener("click", run);
document.getElementById("clear-btn").addEventListener("click", clearConsole);
document.getElementById("reset-btn").addEventListener("click", resetCurrentToSample);
document.getElementById("font-label").addEventListener("click", resetFont);

// ---- Companion + pets + settings + multiplayer wiring --------------------
registerInlineCompletions();
wireCompanionSettings();
wireSettingsSheet();
wirePetButtons();
applyPet();
wireRoomDialog();
wireMultiplayerSettings();
autoReconnectMultiplayer();
refreshRoomButton();
wireProblemsDialog();
refreshProblemsButton();

// Sync initial UI state.
document.querySelectorAll(".seg__btn[data-lang]").forEach((b) => {
  const active = b.dataset.lang === state.lang;
  b.classList.toggle("is-active", active);
  b.setAttribute("aria-selected", String(active));
});
syncCompanionUI();

// Silently check for updates a moment after launch (fails quietly if the
// endpoint isn't reachable or no release has been published yet).
scheduleUpdateCheck();
