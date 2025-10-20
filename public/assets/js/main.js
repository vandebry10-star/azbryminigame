// ================================
// AZBRY CHESS MAIN CONTROLLER
// ================================

import { initUI, newGame, setModeAI } from "./chess-ui.js";

document.addEventListener("DOMContentLoaded", () => {
  initUI();

  // --- Mode tombol (Human vs Azbry-MD) ---
  const modeHumanBtn = document.getElementById("modeHuman");
  const modeAIBtn = document.getElementById("modeAI");

  modeHumanBtn.addEventListener("click", () => {
    modeHumanBtn.classList.add("seg", "active");
    modeAIBtn.classList.remove("active");
    setModeAI(false);
    newGame();
  });

  modeAIBtn.addEventListener("click", () => {
    modeAIBtn.classList.add("seg", "active");
    modeHumanBtn.classList.remove("active");
    setModeAI(true);
    newGame();
  });

  // --- Tombol lainnya ---
  document.getElementById("btnBoardOnly").addEventListener("click", () => {
    document.querySelector(".panel").classList.toggle("hidden");
    document.querySelector(".footer").classList.toggle("hidden");
  });

  document.getElementById("btnBack").addEventListener("click", () => {
    window.location.href = "index.html"; // balik ke menu utama
  });

  document.getElementById("btnFlip").addEventListener("click", () => {
    document.getElementById("board").classList.toggle("flip");
  });
});
