// Koala companion — currently CSS-only, no runtime behavior. Kept as a
// module so pets/index.js has symmetry with the cat.

const petKoala = document.getElementById("pet-koala");

export function showKoala(visible) { petKoala.hidden = !visible; }

// No-op — the koala's animation lives entirely in styles.css.
export function applyKoala() {}
