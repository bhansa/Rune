// Problems dialog — standalone overlay (peer of Room and Settings) that
// browses the curated LeetCode index. Click a row → fetches full JSON via
// Rust → replaces the editor buffer with a header comment + code stub.

import { state, saveState, invoke } from "../state.js";
import { PROBLEMS, DIFFICULTIES } from "./data.js";
import { loadProblem } from "./index.js";

const overlay = () => document.getElementById("problems-overlay");
const listEl = () => document.getElementById("problems-list");
const searchEl = () => document.getElementById("problems-search");
const statusEl = () => document.getElementById("problems-status");
const problemsBtn = () => document.getElementById("problems-btn");

let currentDifficulty = "All";
let currentQuery = "";

export function isProblemsOpen() { return !overlay()?.hasAttribute("hidden"); }
export function openProblems()  { const el = overlay(); if (el) { el.hidden = false; render(); searchEl()?.focus(); } }
export function closeProblems() { const el = overlay(); if (el) el.hidden = true; }
export function toggleProblems(){ isProblemsOpen() ? closeProblems() : openProblems(); }

/** Show or hide the toolbar button based on the enabled toggle. */
export function refreshProblemsButton() {
  const btn = problemsBtn(); if (!btn) return;
  btn.hidden = !state.problems?.enabled;
}

function filtered() {
  const q = currentQuery.trim().toLowerCase();
  return PROBLEMS.filter((p) => {
    if (currentDifficulty !== "All" && p.difficulty !== currentDifficulty) return false;
    if (!q) return true;
    if (p.title.toLowerCase().includes(q)) return true;
    if (p.topics.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

function render() {
  const list = listEl(); if (!list) return;
  list.innerHTML = "";
  const rows = filtered();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "problems__empty";
    empty.textContent = "No matches.";
    list.appendChild(empty);
    return;
  }
  for (const p of rows) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "problem-row";
    row.setAttribute("data-difficulty", p.difficulty.toLowerCase());
    const idEl = document.createElement("span"); idEl.className = "problem-row__id";    idEl.textContent = String(p.id).padStart(4, "0");
    const nameEl = document.createElement("span"); nameEl.className = "problem-row__name"; nameEl.textContent = p.title;
    const diffEl = document.createElement("span"); diffEl.className = "problem-row__diff"; diffEl.textContent = p.difficulty;
    const topEl  = document.createElement("span"); topEl.className  = "problem-row__topics"; topEl.textContent = p.topics.slice(0, 3).join(" · ");
    row.append(idEl, nameEl, diffEl, topEl);
    row.addEventListener("click", () => onPick(p));
    list.appendChild(row);
  }
}

async function onPick(entry) {
  const status = statusEl();
  try {
    if (status) status.textContent = `Fetching ${entry.title}…`;
    await loadProblem(entry);
    closeProblems();
  } catch (e) {
    if (status) status.textContent = `Failed: ${e?.message || e}`;
  }
}

export function wireProblemsDialog() {
  const btn = problemsBtn(); if (btn) btn.addEventListener("click", toggleProblems);
  const el = overlay(); if (!el) return;
  el.querySelectorAll("[data-close-problems]").forEach((n) =>
    n.addEventListener("click", closeProblems)
  );

  // Difficulty chips
  const chips = el.querySelectorAll(".problems__chip");
  const setActive = (val) => {
    currentDifficulty = val;
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.diff === val));
    render();
  };
  chips.forEach((c) => c.addEventListener("click", () => setActive(c.dataset.diff)));
  // Default: All is active
  const initial = DIFFICULTIES[0];
  setActive(initial);

  // Search
  searchEl()?.addEventListener("input", (e) => { currentQuery = e.target.value; render(); });

  // Clear cache
  document.getElementById("problems-clear-cache")?.addEventListener("click", async () => {
    if (!invoke) return;
    try {
      const n = await invoke("leetcode_clear_cache");
      const s = statusEl(); if (s) s.textContent = `Cleared ${n} cached problem${n === 1 ? "" : "s"}.`;
    } catch (e) {
      const s = statusEl(); if (s) s.textContent = `Failed to clear: ${e?.message || e}`;
    }
  });
}
