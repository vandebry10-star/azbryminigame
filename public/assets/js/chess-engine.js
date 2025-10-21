class ChessUI {
  constructor(boardEl, onSquareClick) {
    this.boardEl = boardEl;
    this.onSquareClick = onSquareClick;
    this.renderEmptyBoard();
  }

  renderEmptyBoard() {
    this.boardEl.innerHTML = "";
    for (let r = 8; r >= 1; r--) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement("div");
        sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
        sq.dataset.square = "abcdefgh"[c] + r;
        this.boardEl.appendChild(sq);
      }
    }
  }

  toggleFlip() {}
}
