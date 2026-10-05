// Multiplayer participant panel. Renders a compact list of everyone in the
// current room with a progress bar per participant. Placed in the console
// header area so it doesn't steal editor space.

const container = () => document.getElementById("mp-participants");

function fmtAgo(updatedAt) {
  const s = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export function renderParticipants(peers, selfUserId) {
  const el = container();
  if (!el) return;
  const list = Object.values(peers || {}).sort((a, b) => b.progress - a.progress);
  el.innerHTML = "";
  if (!list.length) {
    el.classList.remove("has-peers");
    return;
  }
  el.classList.add("has-peers");
  for (const p of list) {
    const row = document.createElement("div");
    row.className = "mp-row" + (p.userId === selfUserId ? " mp-row--self" : "");
    const dot = document.createElement("span");
    dot.className = "mp-dot";
    dot.style.background = p.color || "#4f8cff";
    const name = document.createElement("span");
    name.className = "mp-name";
    name.textContent = p.name + (p.userId === selfUserId ? " (you)" : "");
    const bar = document.createElement("div");
    bar.className = "mp-bar";
    const fill = document.createElement("div");
    fill.className = "mp-bar__fill";
    fill.style.width = Math.round((p.progress || 0) * 100) + "%";
    fill.style.background = p.color || "#4f8cff";
    bar.appendChild(fill);
    const meta = document.createElement("span");
    meta.className = "mp-meta";
    meta.textContent = `${p.chars} chars · ${fmtAgo(p.updatedAt)}`;
    row.append(dot, name, bar, meta);
    el.appendChild(row);
  }
}
