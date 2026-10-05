// Wandering cat companion — walks between random rest spots along the
// editor pane's bottom edge with pauses in between.

const petCat = document.getElementById("pet-cat");
const editorPane = document.querySelector(".pane--editor");

const CAT_WIDTH = 130;
const CAT_MARGIN = 14;
const CAT_WALK_PX_PER_SEC = 22;      // real cat pace — slow amble
const CAT_REST_MIN_MS = 6000;
const CAT_REST_MAX_MS = 22000;

let catWanderTimer = null;
let catWalkTimer = null;

export function stopCatWander() {
  if (catWanderTimer) { clearTimeout(catWanderTimer); catWanderTimer = null; }
  if (catWalkTimer)   { clearTimeout(catWalkTimer);   catWalkTimer = null;   }
  petCat.classList.remove("is-walking");
  petCat.style.transition = "";
}

export function startCatWander() {
  stopCatWander();
  scheduleCatRest();
}

function scheduleCatRest() {
  const restMs = CAT_REST_MIN_MS + Math.random() * (CAT_REST_MAX_MS - CAT_REST_MIN_MS);
  catWanderTimer = setTimeout(catWalkToRandomSpot, restMs);
}

function catWalkToRandomSpot() {
  const paneW = editorPane?.clientWidth || 600;
  const minLeft = CAT_MARGIN;
  const maxLeft = Math.max(minLeft + 40, paneW - CAT_WIDTH - CAT_MARGIN);

  const currentLeft = parseFloat(petCat.style.left) || CAT_MARGIN;
  // Pick a destination noticeably different from the current spot so the
  // cat doesn't just twitch in place.
  let target;
  do {
    target = minLeft + Math.random() * (maxLeft - minLeft);
  } while (Math.abs(target - currentLeft) < 40 && (maxLeft - minLeft) > 80);

  const distance = Math.abs(target - currentLeft);
  const direction = target > currentLeft ? 1 : -1;
  const durationMs = (distance / CAT_WALK_PX_PER_SEC) * 1000;

  petCat.style.setProperty("--facing", direction);
  petCat.classList.add("is-walking");
  petCat.style.transition = `left ${durationMs}ms linear`;
  petCat.style.left = target + "px";

  catWalkTimer = setTimeout(() => {
    petCat.classList.remove("is-walking");
    petCat.style.transition = "";
    scheduleCatRest();
  }, durationMs + 40);
}

export function showCat(visible) { petCat.hidden = !visible; }
