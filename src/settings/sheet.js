// Settings sheet — open/close/toggle, theme card selection, font row buttons,
// and Escape-to-dismiss. Companion-specific rows live in companion/settings.js.

import { state, saveState } from "../state.js";
import { applyTheme, bumpFont, resetFont } from "../editor.js";
import { syncCompanionUI } from "../companion/settings.js";
import { refreshProblemsButton } from "../problems/dialog.js";

const overlay = document.getElementById("settings-overlay");
const fontValue = document.getElementById("font-value");

export function updateThemeCards() {
  document.querySelectorAll(".themecard").forEach((card) => {
    const selected = card.dataset.themeValue === state.theme;
    card.classList.toggle("is-selected", selected);
    const radio = card.querySelector("input");
    if (radio) radio.checked = selected;
  });
}

export function isSettingsOpen() { return !overlay.hasAttribute("hidden"); }

export function openSettings() {
  overlay.hidden = false;
  updateThemeCards();
  syncCompanionUI();
  const pb = document.getElementById("problems-enabled");
  if (pb) pb.checked = !!state.problems?.enabled;
  fontValue.textContent = `${state.fontSize}px`;
}
export function closeSettings() { overlay.hidden = true; }
export function toggleSettings() { overlay.hidden ? openSettings() : closeSettings(); }

export function wireSettingsSheet() {
  document.getElementById("settings-btn").addEventListener("click", openSettings);
  overlay.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeSettings));
  document.querySelectorAll(".themecard").forEach((card) =>
    card.addEventListener("click", (e) => {
      e.preventDefault();
      applyTheme(card.dataset.themeValue);
      updateThemeCards();
    })
  );
  document.getElementById("font-inc").addEventListener("click", () => bumpFont(1));
  document.getElementById("font-dec").addEventListener("click", () => bumpFont(-1));
  document.getElementById("font-reset").addEventListener("click", resetFont);
  const pb = document.getElementById("problems-enabled");
  if (pb) pb.addEventListener("change", () => {
    state.problems = state.problems || {};
    state.problems.enabled = pb.checked;
    saveState();
    refreshProblemsButton();
  });
}
