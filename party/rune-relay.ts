// Rune Relay — a tiny PartyKit server that echoes participant state to
// everyone in a room. Deploy with: `npx partykit deploy`.
//
// Each Rune client connects to /party/<roomId>. When a client sends a JSON
// message we merge it into the room state (keyed by userId) and broadcast
// the full state map back to everyone. On disconnect we drop that peer.
//
// No persistence — a room is ephemeral in-memory and evaporates when the
// last peer leaves. That's fine for the typeracer-style use case.

import type * as Party from "partykit/server";

type PeerState = {
  userId: string;
  name: string;
  color: string;
  progress: number;      // 0..1
  chars: number;         // raw editor.getValue().length
  cursorLine: number;
  updatedAt: number;     // epoch ms (server time)
};

export default class RuneRelay implements Party.Server {
  state: Record<string, PeerState> = {};

  constructor(readonly party: Party.Party) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", peers: this.state }));
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg?.type !== "heartbeat" || typeof msg.userId !== "string") return;

    this.state[msg.userId] = {
      userId: msg.userId,
      name: String(msg.name || "guest").slice(0, 32),
      color: String(msg.color || "#4f8cff").slice(0, 20),
      progress: clamp01(msg.progress),
      chars: nonneg(msg.chars),
      cursorLine: nonneg(msg.cursorLine),
      updatedAt: Date.now(),
    };
    // Attach the userId to the connection so we can clean up on disconnect.
    (sender as any).__runeUserId = msg.userId;

    this.party.broadcast(JSON.stringify({ type: "state", peers: this.state }));
  }

  onClose(conn: Party.Connection) {
    const uid = (conn as any).__runeUserId as string | undefined;
    if (uid && this.state[uid]) {
      delete this.state[uid];
      this.party.broadcast(JSON.stringify({ type: "state", peers: this.state }));
    }
  }
}

function clamp01(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function nonneg(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
}
