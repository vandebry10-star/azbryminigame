/* ===========================
   Azbry Chess — main.js (FIX)
   =========================== */

// Pastikan semua modul sudah terload
window.addEventListener("DOMContentLoaded", () => {
  console.log("[Azbry Chess] Initializing main.js");

  // Pastikan engine tersedia
  if (!window.ChessEngine) {
    console.error("[Azbry Chess] ChessEngine tidak ditemukan!");
  } else {
    console.log("[Azbry Chess] ChessEngine ready ✅");
  }

  // Tombol global
  const app = document.querySelector("#chess-app");
  const btnFlip = document.querySelector("#btnFlip");
  const btnBoardOnly = document.querySelector("#btnBoardOnly");
  const btnBack = document.querySelector("#btnBack");

  // ===== Flip Board =====
  if (btnFlip) {
    btnFlip.addEventListener("click", () => {
      const board = document.querySelector("#board");
      if (board) {
        board.classList.toggle("flip");
        console.log("[Azbry Chess] Flip board toggled");
      }
    });
  }

  // ===== Board Only Mode =====
  if (btnBoardOnly) {
    btnBoardOnly.addEventListener("click", () => {
      app.classList.toggle("board-only");
      console.log("[Azbry Chess] Board only mode:", app.classList.contains("board-only"));
    });
  }

  // ===== Tombol Kembali =====
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      // kalau diembed di minigame hub, balik ke index.html
      if (window.location.pathname.includes("chess")) {
        window.location.href = "../index.html";
      } else {
        history.back();
      }
    });
  }

  // ===== Keyboard shortcut (optional) =====
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      const btnReset = document.querySelector("#btnReset");
      btnReset && btnReset.click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      const btnUndo = document.querySelector("#btnUndo");
      btnUndo && btnUndo.click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
      const btnRedo = document.querySelector("#btnRedo");
      btnRedo && btnRedo.click();
    }
  });

  console.log("[Azbry Chess] Main initialized 🚀");
});
