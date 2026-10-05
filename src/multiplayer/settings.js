// Wires the Multiplayer section of the settings sheet: enable toggle,
// name/host/room inputs, and copy-invite-link.

import { state, saveState } from "../state.js";
import { connect, disconnect, inviteURL, isConnected } from "./index.js";
import { refreshRoomButton } from "./dialog.js";

let els = null;

function refs() {
  if (els) return els;
  els = {
    enabled: document.getElementById("mp-enabled"),
    fields:  document.getElementById("mp-fields"),
    name:    document.getElementById("mp-name"),
    host:    document.getElementById("mp-host"),
    room:    document.getElementById("mp-room"),
    copy:    document.getElementById("mp-copy"),
    status:  document.getElementById("mp-status"),
  };
  return els;
}

function updateStatus(text, tone = "") {
  const { status } = refs();
  if (!status) return;
  status.textContent = text;
  status.style.color = tone === "error" ? "var(--error)" : "";
}

function reconnectIfEnabled() {
  if (!state.multiplayer.enabled) { disconnect(); refreshRoomButton(); return; }
  if (!state.multiplayer.roomId?.trim()) {
    disconnect(); updateStatus("Enter a room ID to join."); refreshRoomButton(); return;
  }
  const result = connect();
  if (result?.ok === false) {
    updateStatus(result.reason || "Multiplayer connect failed.", "error");
    disconnect();
    refreshRoomButton();
    return;
  }
  updateStatus(`Connected to room "${state.multiplayer.roomId}".`);
  refreshRoomButton();
}

export function syncMultiplayerUI() {
  const { enabled, fields, name, host, room } = refs();
  if (!enabled) return; // UI not yet in DOM (settings sheet not opened)
  enabled.checked = !!state.multiplayer.enabled;
  fields.classList.toggle("is-open", !!state.multiplayer.enabled);
  name.value = state.multiplayer.name || "";
  host.value = state.multiplayer.host || "";
  room.value = state.multiplayer.roomId || "";
  if (state.multiplayer.enabled && isConnected()) {
    updateStatus(`Connected to room "${state.multiplayer.roomId}".`);
  }
}

export function wireMultiplayerSettings() {
  const { enabled, name, host, room, copy } = refs();
  if (!enabled) return;

  enabled.addEventListener("change", () => {
    state.multiplayer.enabled = enabled.checked;
    saveState();
    syncMultiplayerUI();
    reconnectIfEnabled();
  });
  name.addEventListener("input", () => {
    state.multiplayer.name = name.value.trim().slice(0, 32);
    saveState();
  });
  host.addEventListener("input", () => {
    state.multiplayer.host = host.value.trim();
    saveState();
  });
  room.addEventListener("input", () => {
    state.multiplayer.roomId = room.value.trim().slice(0, 64);
    saveState();
  });
  // Reconnect when the user commits an edit (blur) rather than on every keystroke.
  for (const el of [name, host, room]) {
    el.addEventListener("change", reconnectIfEnabled);
    el.addEventListener("blur",   reconnectIfEnabled);
  }
  copy?.addEventListener("click", async () => {
    const url = inviteURL();
    if (!url) { updateStatus("Set a room ID first.", "error"); return; }
    try {
      await navigator.clipboard.writeText(url);
      updateStatus("Invite link copied to clipboard.");
    } catch {
      updateStatus(url); // fallback: at least surface it
    }
  });
}

// Called at boot to auto-connect if multiplayer was on last session.
export function autoReconnectMultiplayer() {
  if (state.multiplayer?.enabled && state.multiplayer.roomId && state.multiplayer.host) {
    reconnectIfEnabled();
  }
}
