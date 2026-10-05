// Pet dispatcher — reads state.pet and shows the right companion, wiring up
// its runtime behavior (cat wander) or leaving it CSS-driven (koala).

import { state, saveState } from "../state.js";
import { showCat, startCatWander, stopCatWander } from "./cat.js";
import { showKoala, applyKoala } from "./koala.js";

export function applyPet() {
  showCat(state.pet === "cat");
  showKoala(state.pet === "koala");
  document.querySelectorAll(".seg__btn[data-pet]").forEach((b) => {
    const active = b.dataset.pet === state.pet;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  if (state.pet === "cat") startCatWander();
  else stopCatWander();
  if (state.pet === "koala") applyKoala();
}

export function wirePetButtons() {
  document.querySelectorAll(".seg__btn[data-pet]").forEach((b) =>
    b.addEventListener("click", () => {
      state.pet = b.dataset.pet;
      saveState();
      applyPet();
    })
  );
}
