// Rune Multiplayer — TypeRacer-style progress tracking over PartyKit.
//
// Progress-only sync (no code shared). Each client periodically posts its
// current metric to the room; the relay echoes the merged state back to
// everyone.
//
// Progress metric for v1: `editor.getValue().length` normalised against the
// current buffer's max seen size. Naive but zero-config. Later we can plug
// in a task-specific metric (LeetCode test-case pass count, etc.).

import { PartySocket } from "partysocket";
import { state, saveState } from "../state.js";
import { editor } from "../editor.js";
import { renderParticipants } from "./ui.js";

// ---- Config ---------------------------------------------------------------
// Default host. Point at your deployed PartyKit URL, e.g.:
//   rune-relay.<your-partykit-slug>.partykit.dev
// Users can override in Settings → Multiplayer.
const DEFAULT_HOST = "rune-relay.YOUR-SLUG.partykit.dev";

const HEARTBEAT_MS = 1000;

let socket = null;
let heartbeatTimer = null;
let peers = {};
let selfMaxChars = 0;

// Helpers ------------------------------------------------------------------
function ensureUserId() {
  if (!state.multiplayer?.userId) {
    state.multiplayer = state.multiplayer || {};
    state.multiplayer.userId = "u_" + Math.random().toString(36).slice(2, 10);
    saveState();
  }
  return state.multiplayer.userId;
}
function myColor() {
  if (!state.multiplayer?.color) {
    // Deterministic-ish pastel from userId, so peers reliably see the same
    // color for the same user across sessions.
    const uid = ensureUserId();
    let h = 0;
    for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    state.multiplayer.color = `hsl(${h % 360} 65% 55%)`;
    saveState();
  }
  return state.multiplayer.color;
}
function myName() { return state.multiplayer?.name || "guest"; }
function currentRoom() { return state.multiplayer?.roomId || ""; }
function currentHost() { return (state.multiplayer?.host || DEFAULT_HOST).trim(); }

// ---- Connect / disconnect -------------------------------------------------
export function isConnected() { return !!socket && socket.readyState === WebSocket.OPEN; }

export function connect() {
  disconnect(); // idempotent
  const room = currentRoom();
  if (!room) return { ok: false, reason: "no room" };
  const host = currentHost();
  if (!host || host.includes("YOUR-SLUG")) {
    return { ok: false, reason: "Multiplayer host not configured. Deploy the PartyKit relay and set the host in Settings." };
  }

  ensureUserId();
  socket = new PartySocket({ host, room });
  socket.addEventListener("message", (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg?.type === "state" && msg.peers) {
      peers = msg.peers;
      renderParticipants(peers, state.multiplayer.userId);
    }
  });
  socket.addEventListener("close", () => { peers = {}; renderParticipants(peers, state.multiplayer.userId); });

  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  // Send one immediately so we appear in the list without waiting a full tick.
  sendHeartbeat();
  return { ok: true };
}

export function disconnect() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (socket) { try { socket.close(); } catch {} socket = null; }
  peers = {};
  renderParticipants(peers, state.multiplayer?.userId);
}

function sendHeartbeat() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const value = editor?.getValue?.() ?? "";
  const chars = value.length;
  if (chars > selfMaxChars) selfMaxChars = chars;
  const progress = selfMaxChars > 0 ? chars / selfMaxChars : 0;
  const pos = editor?.getPosition?.();
  socket.send(JSON.stringify({
    type: "heartbeat",
    userId: state.multiplayer.userId,
    name: myName(),
    color: myColor(),
    progress,
    chars,
    cursorLine: pos?.lineNumber || 1,
  }));
}

// Reset the local max whenever the user changes room (or resets to sample).
export function resetProgressBaseline() { selfMaxChars = 0; }

// ---- Invite link ----------------------------------------------------------
// A shareable URL that other Rune installs can paste to auto-join.
export function inviteURL() {
  const room = currentRoom();
  if (!room) return "";
  return `rune://join?room=${encodeURIComponent(room)}&host=${encodeURIComponent(currentHost())}`;
}
