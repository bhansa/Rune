// Console output rendering + status line. Owns the rows in the console pane
// and exposes `lastError` for the companion to feed back to the model.

const consoleEl = document.getElementById("console");
const statusEl = document.getElementById("status");

let lastError = "";
export function getLastError() { return lastError; }

export function fmt(v) {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "function" ? `[Function: ${val.name || "anonymous"}]` : val), 2) ?? String(v);
  } catch { return String(v); }
}

export function addRow(kind, parts) {
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

export function clearConsole() {
  consoleEl.querySelectorAll(".row").forEach((r) => r.remove());
  consoleEl.classList.remove("has-rows");
  setStatus("");
  lastError = "";
}

export function setStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = "console__status" + (tone ? ` is-${tone}` : "");
}

export function setConsoleFontSize(px) {
  consoleEl.style.fontSize = px + "px";
}
