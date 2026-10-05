// Python execution — thin wrapper around the `run_python` Tauri command that
// streams stdout/stderr into the app's console.

import { invoke } from "../state.js";
import { addRow, setStatus } from "../console.js";

function elapsed(t0) {
  const ms = performance.now() - t0;
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export async function runPython(code) {
  if (!invoke) { addRow("error", ["Tauri bridge unavailable — run inside the desktop app."]); setStatus("Error", "error"); return; }
  const t0 = performance.now();
  try {
    const res = await invoke("run_python", { code });
    if (res.stdout) res.stdout.replace(/\n$/, "").split("\n").forEach((line) => addRow("log", [line]));
    if (res.stderr) res.stderr.replace(/\n$/, "").split("\n").forEach((line) => addRow("error", [line]));
    if (res.code === 0) setStatus(`Done · ${elapsed(t0)}`, "ok");
    else setStatus(`Exited ${res.code} · ${elapsed(t0)}`, "error");
  } catch (err) {
    addRow("error", [String(err)]);
    setStatus("Error", "error");
  }
}
