// Standalone Room dialog — separated from the Settings sheet so join + invite
// is a one-click affordance from the toolbar. Everything in here is UI shell:
// the fields inside re-use the wiring in `./settings.js`.

import { state } from "../state.js";
import { isConnected } from "./index.js";
import { syncMultiplayerUI } from "./settings.js";

const overlay = () => document.getElementById("room-overlay");
const roomBtn = () => document.getElementById("room-btn");
const roomLabel = () => document.getElementById("room-btn__label");

export function isRoomOpen() { return !overlay()?.hasAttribute("hidden"); }
export function openRoom() {
  const el = overlay(); if (!el) return;
  el.hidden = false;
  syncMultiplayerUI();
}
export function closeRoom() {
  const el = overlay(); if (!el) return;
  el.hidden = true;
}
export function toggleRoom() {
  isRoomOpen() ? closeRoom() : openRoom();
}

/** Refresh the toolbar Room button's live dot + label. Called after any
 *  connect/disconnect so the toolbar always reflects reality. */
export function refreshRoomButton() {
  const btn = roomBtn(); const label = roomLabel();
  if (!btn || !label) return;
  const live = state.multiplayer?.enabled && isConnected();
  btn.classList.toggle("is-live", !!live);
  if (live && state.multiplayer?.roomId) {
    label.textContent = state.multiplayer.roomId;
    btn.title = `In room "${state.multiplayer.roomId}" — click to change or copy invite`;
  } else {
    label.textContent = "Room";
    btn.title = "Multiplayer room";
  }
}

export function wireRoomDialog() {
  const btn = roomBtn(); if (btn) btn.addEventListener("click", toggleRoom);
  const el = overlay(); if (!el) return;
  el.querySelectorAll("[data-close-room]").forEach((n) =>
    n.addEventListener("click", closeRoom)
  );
}
