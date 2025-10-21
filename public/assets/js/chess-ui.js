/*
  Azbry Chess UI — fixed render board + pieces (Febry final)
  Handle flip, move highlight, dan board-only mode.
*/

(function () {
  const PIECE_MAP = {
    wp: "♙", wr: "♖", wn: "♘", wb: "♗", wq: "♕", wk: "♔",
    bp: "♟", br: "♜", bn: "♞", bb: "♝", bq: "♛", bk: "♚",
  };

  function idxToRC(i) { return { r: Math.floor(i / 8), c: i % 8 }; }
  function rcToIdx(r, c) { return r * 8 + c; }

  class ChessUI {
    constructor(boardEl, onSquareClick) {
      if (!boardEl) throw new Error("boardEl is required");
      this.boardEl = boardEl;
      this.onSquareClick = onSquareClick || (() => {});
      this.flipped = false;
      this.squares = [];
      this._buildGrid();
    }

    _buildGrid() {
      this.boardEl.innerHTML = "";
      this.squares = new Array(64);
      for (let i = 0; i < 64; i++) {
        const { r, c } = idxToRC(i);
        const sq = document.createElement("div");
        sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
        sq.dataset.index = i;
        sq.addEventListener("click", () => this.onSquareClick(i));
        this.boardEl.appendChild(sq);
        this.squares[i] = sq;
      }
    }

    render({ pos = [], lastMove = null, legal = [] } = {}) {
      for (let i = 0; i < 64; i++) {
        const domIdx = this.flipped ? 63 - i : i;
        const sq = this.squares[domIdx];
        sq.classList.remove("src", "last", "move", "white", "black");
        sq.textContent = "";

        const piece = pos[i];
        if (piece) {
          const color = piece[0] === "w" ? "white" : "black";
          sq.classList.add(color);
          sq.textContent = PIECE_MAP[piece] ?? "";
        }
      }

      if (lastMove) {
        const from = this.flipped ? 63 - lastMove.from : lastMove.from;
        const to = this.flipped ? 63 - lastMove.to : lastMove.to;
        this.squares[from]?.classList.add("last");
        this.squares[to]?.classList.add("last");
      }

      if (legal && legal.length) {
        for (const idx of legal) {
          const domIdx = this.flipped ? 63 - idx : idx;
          this.squares[domIdx]?.classList.add("move");
        }
      }
    }

    markSource(idx) {
      const domIdx = this.flipped ? 63 - idx : idx;
      this.squares[domIdx]?.classList.add("src");
    }

    flip() {
      this.flipped = !this.flipped;
      this.render({ pos: this._lastPos || [] });
    }
  }

  window.ChessUI = ChessUI;
})();
