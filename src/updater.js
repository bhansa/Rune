// Rune — auto-updater client.
//
// On app startup we quietly check the endpoint configured in tauri.conf.json.
// If a newer signed release is available, we ask the user before downloading
// and installing it. Any error (offline, endpoint missing, unreachable) is
// swallowed to a console.debug so we never bother the user during launch.

import { check } from "@tauri-apps/plugin-updater";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

// Delay the check so it never competes with the app's first paint. The user
// almost always wants to see Rune load first, then optionally be told about
// an update a moment later.
const STARTUP_DELAY_MS = 2500;

export function scheduleUpdateCheck() {
  setTimeout(() => { checkForUpdate({ silent: true }); }, STARTUP_DELAY_MS);
}

export async function checkForUpdate({ silent = false } = {}) {
  try {
    const update = await check();
    if (!update?.available) {
      if (!silent) {
        await message("You're on the latest version.", { title: "Rune", kind: "info" });
      }
      return;
    }
    const yes = await ask(
      `Rune ${update.version} is available (you're on ${update.currentVersion || "an older version"}). Install now?`,
      { title: "Update available", kind: "info", okLabel: "Install", cancelLabel: "Later" }
    );
    if (!yes) return;
    await update.downloadAndInstall();
    try { await relaunch(); } catch { /* installer already restarted the app */ }
  } catch (e) {
    // Endpoint 404s (no release published yet), no network, invalid signature,
    // dev builds, etc. Never crash launch on any of those.
    console.debug("[updater] skipped:", e?.message || e);
    if (!silent) {
      await message(`Update check failed: ${e?.message || e}`, { title: "Rune", kind: "error" });
    }
  }
}
