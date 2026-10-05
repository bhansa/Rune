// Companion section of the settings sheet — provider segmentation, style
// segmentation, API key, model dropdown, idle slider, and Ollama refresh.

import {
  state, saveState, invoke,
  DEFAULT_MODELS, ANTHROPIC_MODELS, CLAUDE_CLI_MODELS,
} from "../state.js";
import { setStatus } from "../console.js";
import { resetIdle } from "./inline.js";
import { currentModel, getCompanionBadge } from "./index.js";

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
  } else if (provider === "claude-cli") {
    for (const m of CLAUDE_CLI_MODELS) opts.push({ id: m.id, label: m.label });
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

export function syncCompanionUI() {
  const badge = getCompanionBadge();
  cEnabled.checked = state.companion.enabled;
  cFields.classList.toggle("is-open", state.companion.enabled);
  document.body.setAttribute("data-companion-provider", state.companion.provider);
  document.querySelectorAll(".seg__btn[data-provider]").forEach((b) => {
    const active = b.dataset.provider === state.companion.provider;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".seg__btn[data-style]").forEach((b) => {
    const active = b.dataset.style === state.companion.style;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  const styleHint = document.getElementById("style-hint");
  if (styleHint) {
    styleHint.textContent = state.companion.style === "code"
      ? "Ghost text will suggest raw code to complete. Tab to accept."
      : "Ghost comments will nudge you toward the next step so you can work it out yourself.";
  }
  cKey.value = state.companion.apiKey || "";
  populateModelOptions();
  cIdle.value = state.companion.idleMs;
  cIdleVal.textContent = `${state.companion.idleMs}ms`;
  cModelHint.textContent = ({
    "anthropic": "Direct API. Haiku is fastest; Sonnet/Opus are stronger for tricky code.",
    "claude-cli": "Uses your Claude Code CLI login — no API key needed.",
    "ollama": "Requires `ollama serve` running locally. Click ↻ to list installed models.",
  })[state.companion.provider] || "";
  badge.classList.toggle("is-on", state.companion.enabled);

  // On Ollama, auto-refresh the model list the first time settings open so
  // the dropdown reflects reality without the user hitting ↻.
  if (state.companion.provider === "ollama" && invoke && !cRefresh.dataset.autoDone) {
    cRefresh.dataset.autoDone = "1";
    refreshOllamaModels(true);
  }
  // On Claude CLI, probe the binary once so we can show a helpful hint if it's missing.
  if (state.companion.provider === "claude-cli" && invoke && !cModelHint.dataset.claudeProbed) {
    cModelHint.dataset.claudeProbed = "1";
    invoke("claude_cli_probe")
      .then((v) => { cModelHint.textContent = `Detected: ${v} — uses your existing Claude Code login.`; })
      .catch((e) => { cModelHint.textContent = String(e); });
  }
}

export function wireCompanionSettings() {
  cEnabled.addEventListener("change", () => {
    state.companion.enabled = cEnabled.checked;
    saveState();
    syncCompanionUI();
    if (state.companion.enabled) resetIdle();
  });
  document.querySelectorAll(".seg__btn[data-provider]").forEach((b) =>
    b.addEventListener("click", () => {
      state.companion.provider = b.dataset.provider;
      // Re-probe the newly-selected provider on next settings open.
      delete cRefresh.dataset.autoDone;
      delete cModelHint.dataset.claudeProbed;
      saveState();
      syncCompanionUI();
    })
  );
  document.querySelectorAll(".seg__btn[data-style]").forEach((b) =>
    b.addEventListener("click", () => {
      state.companion.style = b.dataset.style;
      // Different style → different cache namespace, no need to clear cache since
      // the "mode" component of the cache key changes automatically.
      saveState();
      syncCompanionUI();
      setStatus(state.companion.style === "code" ? "Suggesting code" : "Suggesting ideas", "ok");
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
}
