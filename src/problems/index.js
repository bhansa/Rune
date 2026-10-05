// Problems module — loads a selected problem's full JSON via Rust and
// applies it to the editor (description as a comment header + language's
// code snippet as the starting body).

import { state, saveState, invoke } from "../state.js";
import { editor, switchLang } from "../editor.js";
import { setStatus } from "../console.js";

function commentBlock(lang, text) {
  const clean = String(text).replace(/\r\n/g, "\n").trimEnd();
  if (lang === "python") {
    return "'''\n" + clean + "\n'''";
  }
  return "/**\n" + clean.split("\n").map((l) => " * " + l).join("\n") + "\n */";
}

/** Strip HTML tags — problem descriptions come as HTML in the source dataset. */
function htmlToText(html) {
  if (!html) return "";
  // Minimal, safe stripping — we only display it inside a comment block.
  return String(html)
    .replace(/<\/?(p|br|div|ul|ol|li|pre|code|strong|em|sub|sup|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function snippetFor(problem, lang) {
  const list = problem.code_snippets || problem.codeSnippets || [];
  const wanted = lang === "python" ? ["python3", "python"] : ["javascript"];
  for (const key of wanted) {
    const hit = list.find((s) => (s.langSlug || s.lang || "").toLowerCase() === key);
    if (hit) return hit.code || "";
  }
  return "";
}

/** Fetch and apply a problem. Called by the dialog on row click. */
export async function loadProblem(entry) {
  if (!invoke) throw new Error("Not running inside Rune.");
  setStatus(`Loading ${entry.title}…`, "running");
  const full = await invoke("leetcode_get", { slug: entry.slug, numericId: entry.id });

  const lang = state.lang;
  const desc = htmlToText(full.description || full.content || "");
  const banner = `${entry.id}. ${full.title || entry.title}  ·  ${full.difficulty || entry.difficulty}`;
  const header = commentBlock(lang, `${banner}\n\n${desc}`);
  const body = snippetFor(full, lang) || (lang === "python" ? "\n\n" : "\n\n");

  editor.setValue(header + "\n\n" + body + "\n");
  state.code[lang] = editor.getValue();
  state.currentProblem = { id: entry.id, slug: entry.slug, title: entry.title };
  saveState();
  setStatus(`Loaded ${entry.title}`, "ok");
}
