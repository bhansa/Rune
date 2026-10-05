// High-level companion call — assembles the request, dedupes via a small LRU
// cache, feeds recent hints back to the model, and drives the thinking widget.

import { state, invoke, DEFAULT_MODELS } from "../state.js";
import { editor } from "../editor.js";
import { getLastError } from "../console.js";
import { showThinking, hideThinking } from "./thinking.js";

const companionBadge = document.getElementById("companion-badge");
export function getCompanionBadge() { return companionBadge; }

export function companionOn() { return state.companion.enabled; }
export function currentModel() {
  return state.companion.model[state.companion.provider] || DEFAULT_MODELS[state.companion.provider];
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

// ---- Session-scoped response cache -----------------------------------------
// The model is expensive to call. If the surrounding context hasn't changed,
// re-use the previous answer for the same cursor+mode instead of asking again.
const companionCache = new Map();
const COMPANION_CACHE_MAX = 40;

// Rolling history of recent suggestions. Fed back to the model so it doesn't
// repeat itself and instead builds on the ground the user has already covered.
const companionHistory = [];
const COMPANION_HISTORY_MAX = 5;

function pushCompanionHistory(mode, text) {
  if (!text) return;
  const entry = { mode, text };
  // Skip if identical to the most recent one — happens on cache hits.
  const last = companionHistory[companionHistory.length - 1];
  if (last && last.mode === entry.mode && last.text === entry.text) return;
  companionHistory.push(entry);
  if (companionHistory.length > COMPANION_HISTORY_MAX) companionHistory.shift();
}

function companionCacheKey(req) {
  // History is part of the key so a new hint isn't served from a stale cache
  // entry that predates any progress the user has made.
  return [
    req.mode, req.provider, req.model, req.language, req.error || "",
    req.before, req.after,
    (req.prev_hints || []).join("|"),
  ].join("␞");
}

function companionCachePut(key, value) {
  if (companionCache.size >= COMPANION_CACHE_MAX) {
    const first = companionCache.keys().next().value;
    if (first !== undefined) companionCache.delete(first);
  }
  companionCache.set(key, value);
}

export async function callCompanion(mode) {
  if (!invoke) throw new Error("Not running inside Rune desktop app.");
  const model = editor.getModel();
  const pos = editor.getPosition();
  const { before, after } = contextAround(model, pos);
  const req = {
    provider: state.companion.provider,
    api_key: state.companion.apiKey,
    model: currentModel(),
    mode,
    language: state.lang,
    before,
    after,
    error: mode === "hint" ? getLastError() : "",
    // Only send hints of the same mode — code suggestions don't help avoid
    // repeated guidance and vice versa.
    prev_hints: companionHistory.filter((h) => h.mode === mode).map((h) => h.text),
  };

  // Cache hit — return instantly, no thinking widget.
  const key = companionCacheKey(req);
  if (companionCache.has(key)) {
    return companionCache.get(key);
  }

  companionBadge.classList.add("is-thinking");
  showThinking(pos);
  try {
    const res = await invoke("companion_complete", { req });
    const text = (res?.text || "").trimEnd();
    companionCachePut(key, text);
    pushCompanionHistory(mode, text);
    return text;
  } finally {
    companionBadge.classList.remove("is-thinking");
    hideThinking();
  }
}
