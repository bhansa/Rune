// JavaScript execution — runs the user's code inside a proxied console/fs
// sandbox and pipes captured output into the app's console pane.

import { invoke } from "../state.js";
import { addRow, setStatus } from "../console.js";

const fs = {
  readFile: (path) => invoke("read_file", { path }),
  writeFile: (path, contents) => invoke("write_file", { path, contents }),
  readDir: (path) => invoke("read_dir", { path }),
  exists: (path) => invoke("exists", { path }),
};

function elapsed(t0) {
  const ms = performance.now() - t0;
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export async function runJavaScript(code) {
  const captured = [];
  const proxy = {
    log: (...a) => captured.push(["log", a]),
    info: (...a) => captured.push(["log", a]),
    debug: (...a) => captured.push(["log", a]),
    warn: (...a) => captured.push(["warn", a]),
    error: (...a) => captured.push(["error", a]),
  };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  let returnValue;
  const t0 = performance.now();
  try {
    const fn = new AsyncFn("console", "fs", `"use strict";\nreturn (async () => {\n${code}\n})();`);
    returnValue = await fn(proxy, fs);
  } catch (err) {
    for (const [k, a] of captured) addRow(k, a);
    addRow("error", [err instanceof Error ? err : String(err)]);
    setStatus(`Error · ${elapsed(t0)}`, "error");
    return;
  }
  for (const [k, a] of captured) addRow(k, a);
  if (returnValue !== undefined) addRow("return", [returnValue]);
  setStatus(`Done · ${elapsed(t0)}`, "ok");
}
