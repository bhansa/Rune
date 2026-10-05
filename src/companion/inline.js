// Inline-completion plumbing — idle timer, ⌘I hint entry point, and the
// Monaco provider that turns callCompanion output into ghost text (or a
// ghost comment for hints). All three funnel through the same pipeline so
// Tab-to-accept works uniformly.

import * as monaco from "monaco-editor";
import { state } from "../state.js";
import { editor } from "../editor.js";
import { setStatus } from "../console.js";
import { callCompanion, companionOn } from "./index.js";

// "complete" for autocomplete on idle, "hint" for a plain-English nudge via ⌘I.
// null = provider is dormant.
let nextSuggestionMode = null;
let idleTimer = null;

// Progress-based cooldown so we don't re-fire while the user is still working
// with the previous hint. After a suggestion, auto-triggering is blocked until
// EITHER enough time has passed OR the user has added enough new content.
let lastAutoSuggestionAt = 0;
let lastAutoSuggestionBufferLen = 0;
const AUTO_COOLDOWN_MS = 15000;
const AUTO_COOLDOWN_MIN_CHARS = 20;

function commentPrefix(lang) {
  return lang === "python" ? "# " : "// ";
}

export function resetIdle() {
  clearTimeout(idleTimer);
  if (!companionOn()) return;
  idleTimer = setTimeout(triggerInlineSuggestion, state.companion.idleMs);
}

export function triggerInlineSuggestion() {
  const pos = editor.getPosition();
  if (!pos) return;
  const model = editor.getModel();
  // Don't fire if the rest of this line already has content — let the user finish typing.
  const line = model.getLineContent(pos.lineNumber);
  const suffix = line.slice(pos.column - 1);
  if (suffix.trim().length > 0) return;

  // Cooldown: if we recently offered a suggestion, wait until the user has
  // either had time to think (AUTO_COOLDOWN_MS) OR made meaningful progress
  // (AUTO_COOLDOWN_MIN_CHARS new characters). Either is enough — neither
  // means the user is still working with the previous hint.
  if (lastAutoSuggestionAt > 0) {
    const now = performance.now();
    const timeSince = now - lastAutoSuggestionAt;
    const bufferLen = model.getValueLength();
    const charsSince = bufferLen - lastAutoSuggestionBufferLen;
    if (timeSince < AUTO_COOLDOWN_MS && charsSince < AUTO_COOLDOWN_MIN_CHARS) return;
  }

  // Style choice decides whether the model gives a plain-English nudge
  // (guidance, rendered as a ghost comment) or raw code (autocomplete).
  nextSuggestionMode = state.companion.style === "code" ? "complete" : "hint";
  editor.trigger("companion", "editor.action.inlineSuggest.trigger", {});
}

/// ⌘I — request a plain-English nudge and paint it as a ghost COMMENT on the
/// current line, using the language's own comment syntax. Reuses the same
/// inline-completion pipeline as ghost text, so Tab accepts it and turns it
/// into a real comment in the buffer.
export function askHint() {
  if (!companionOn()) { setStatus("Turn on Companion in Settings first.", "error"); return; }
  const pos = editor.getPosition();
  if (!pos) return;
  nextSuggestionMode = "hint";
  editor.trigger("companion", "editor.action.inlineSuggest.trigger", {});
}

export function registerInlineCompletions() {
  monaco.languages.registerInlineCompletionsProvider(["javascript", "python"], {
    async provideInlineCompletions(model, position, _ctx, token) {
      if (!companionOn() || !nextSuggestionMode) return { items: [] };
      const mode = nextSuggestionMode;
      nextSuggestionMode = null;
      try {
        const text = await callCompanion(mode);
        if (token.isCancellationRequested) return { items: [] };
        if (!text) {
          setStatus(mode === "hint" ? "No hint returned." : "Companion had nothing to suggest here.", "");
          return { items: [] };
        }

        let insertText;
        if (mode === "hint") {
          // Render the hint as a code comment on the current line so it lives
          // inside the editor natively. Strip any leading comment marker the
          // model might have added itself.
          const prefix = commentPrefix(state.lang);
          const clean = text.replace(/^\s*(\/\/|#)\s*/, "").trim();
          insertText = prefix + clean;
          setStatus("Companion hint — Tab to keep it as a comment", "ok");
        } else {
          insertText = text;
          setStatus("Companion suggested — Tab to accept", "ok");
        }

        // Start the cooldown clock now — next auto-trigger has to wait for
        // either time-elapsed or new-content threshold.
        lastAutoSuggestionAt = performance.now();
        lastAutoSuggestionBufferLen = model.getValueLength();

        return {
          items: [{
            insertText,
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          }],
        };
      } catch (e) {
        const msg = String(e).replace(/^Error:\s*/, "");
        setStatus(`Companion: ${msg.slice(0, 140)}`, "error");
        return { items: [] };
      }
    },
    freeInlineCompletions() {},
  });
}
