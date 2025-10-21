// assets/js/chess-ui.js — renderer papan dan bidak Azbry Chess

class ChessUI {
  constructor(boardEl, onSquareClick) {
    this.boardEl = boardEl;
    this.onSquareClick = onSquareClick;
    this.isFlipped = false;
    this.renderBoard();
  }

  // 🔹 Buat papan 8x8
  renderBoard() {
    this.boardEl.innerHTML = "";
    const files = ["a","b","c","d","e","f","g","h"];

    for (let rank = 8; rank >= 1; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = document.createElement("div");
        const sqName = files[file] + rank;
        square.dataset.square = sqName;
        square.className = `square ${(rank + file) % 2 === 0 ? "light" : "dark"}`;
        square.addEventListener("click", () => this.onSquareClick(sqName));
        this.boardEl.appendChild(square);
      }
    }
  }

  // 🔹 Render bidak dari FEN (pakai Unicode)
  renderPieces(fen) {
    const board = fen.split(" ")[0];
    const ranks = board.split("/");
    const files = ["a","b","c","d","e","f","g","h"];

    // bersihin dulu semua bidak
    for (const sq of this.boardEl.querySelectorAll(".piece")) sq.remove();

    for (let r = 0; r < 8; r++) {
      let fileIndex = 0;
      for (const char of ranks[r]) {
        if (isNaN(char)) {
          const squareName = files[fileIndex] + (8 - r);
          const piece = document.createElement("div");
          piece.className = `piece ${char === char.toUpperCase() ? "white" : "black"}`;
          piece.textContent = this.getPieceChar(char);
          piece.dataset.square = squareName;
          const target = this.boardEl.querySelector(`[data-square="${squareName}"]`);
          if (target) target.appendChild(piece);
          fileIndex++;
        } else fileIndex += parseInt(char);
      }
    }
  }

  // 🔹 Map Unicode Bidak
  getPieceChar(p) {
    const map = {
      k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
      K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    };
    return map[p] || "?";
  }

  // 🔹 Flip papan
  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    this.boardEl.classList.toggle("flipped", this.isFlipped);
  }

  // 🔹 Highlight langkah terakhir
  highlightMove(from, to) {
    this.clearHighlights();
    if (from) this.boardEl.querySelector(`[data-square="${from}"]`)?.classList.add("highlight");
    if (to) this.boardEl.querySelector(`[data-square="${to}"]`)?.classList.add("highlight");
  }

  clearHighlights() {
    this.boardEl.querySelectorAll(".highlight").forEach(sq => sq.classList.remove("highlight"));
  }
}
