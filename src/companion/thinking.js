// Thinking widget — a bottom-right overlay with a rotating quote that shows
// while the model is generating. Delayed so fast responses don't flash it in.

import * as monaco from "monaco-editor";
import { editor } from "../editor.js";

export const QUOTES = [
  "First, solve the problem. Then, write the code.",
  "Simplicity is the soul of efficiency.",
  "The best code is no code at all.",
  "Talk is cheap. Show me the code.",
  "Weeks of coding save hours of planning.",
  "Any fool can write code a computer understands. Good programmers write code humans understand.",
  "Make it work, make it right, make it fast.",
  "Programs are meant to be read by humans and only incidentally executed by machines.",
  "Debugging is like being a detective in a crime movie where you are also the murderer.",
  "There are two hard things in CS: cache invalidation, naming things, and off-by-one errors.",
  "Rubber duck says: read your code out loud.",
  "In theory, theory and practice are the same. In practice, they aren't.",
  "It works on my machine.",
];

let thinkingWidget = null;
let thinkingTimer = null;
let thinkingShowTimer = null;
const THINKING_SHOW_DELAY_MS = 700; // don't flash the widget for fast responses

function pickQuote(prev) {
  if (QUOTES.length <= 1) return QUOTES[0];
  let q = prev;
  while (q === prev) q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return q;
}

// The thinking widget lives as a Monaco OVERLAY widget pinned to a corner of
// the editor viewport — not tied to the cursor line — so it never covers the
// code the user is reading. It's also delayed by a few hundred ms so a fast
// response or cache hit doesn't flash it into view.
export function showThinking(_pos) {
  hideThinking();
  thinkingShowTimer = setTimeout(() => {
    thinkingShowTimer = null;
    if (thinkingWidget) return;

    const node = document.createElement("div");
    node.className = "companion-thinking";
    const spinner = document.createElement("span");
    spinner.className = "companion-thinking__spinner";
    const label = document.createElement("span");
    label.className = "companion-thinking__label";
    label.textContent = "Thinking";
    const quote = document.createElement("span");
    quote.className = "companion-thinking__quote";
    let current = pickQuote(null);
    quote.textContent = `“${current}”`;
    node.append(spinner, label, quote);

    thinkingWidget = {
      getId() { return "rune.companion.thinking"; },
      getDomNode() { return node; },
      getPosition() {
        return { preference: monaco.editor.OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER };
      },
    };
    editor.addOverlayWidget(thinkingWidget);

    thinkingTimer = setInterval(() => {
      current = pickQuote(current);
      quote.textContent = `“${current}”`;
    }, 3000);
  }, THINKING_SHOW_DELAY_MS);
}

export function hideThinking() {
  if (thinkingShowTimer) { clearTimeout(thinkingShowTimer); thinkingShowTimer = null; }
  if (thinkingTimer) { clearInterval(thinkingTimer); thinkingTimer = null; }
  if (thinkingWidget) { editor.removeOverlayWidget(thinkingWidget); thinkingWidget = null; }
}
