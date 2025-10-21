/* ===== Azbry Chess UI (final) =====
   Tugas file ini:
   - Bangun grid 8x8 sekali, simpan referensinya
   - Render pieces + highlight langkah legal / last move
   - Emit event click square ke main.js
   - Tombol Board Only & Back
*/
(function () {
  const PIECE_MAP = {
    wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
    bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
  };

  function idxToRC(i) { return { r: Math.floor(i / 8), c: i % 8 }; }
  function rcToIdx(r, c) { return r * 8 + c; }
  function inBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  class ChessUI {
    constructor({ boardEl, onSquareClick }) {
      if (!boardEl) throw new Error("boardEl is required");
      this.boardEl = boardEl;
      this.onSquareClick = onSquareClick || (() => {});
      this.flipped = false;
      this.squares = [];
      this._buildGrid();
      this._wireFooter();
    }

    _buildGrid() {
      // Pastikan class sesuai CSS
      if (!this.boardEl.classList.contains("board"))
        this.boardEl.classList.add("board");

      // Bersihkan, lalu create 64 kotak
      this.boardEl.innerHTML = "";
      this.squares = new Array(64);
      for (let i = 0; i < 64; i++) {
        const { r, c } = idxToRC(i);
        const sq = document.createElement("div");
        sq.className = `square ${(r + c) % 2 ? "dark" : "light"}`;
        sq.dataset.index = i;
        sq.addEventListener("click", () => this.onSquareClick(i));
        this.boardEl.appendChild(sq);
        this.squares[i] = sq;
      }
    }

    // pos: array 64 string "" / "wP"/"bK", lastMove: {from,to} | null
    render(pos, opts = {}) {
      const { lastMove = null, legal = [] } = opts;

      for (let i = 0; i < 64; i++) {
        const domIdx = this.flipped ? 63 - i : i; // flip tampilan
        const sq = this.squares[domIdx];
        sq.classList.remove("src", "last", "move");
        sq.innerHTML = "";

        const p = pos[i];
        if (p) {
          const span = document.createElement("span");
          span.className = "piece";
          span.textContent = PIECE_MAP[p] || "?";
          sq.appendChild(span);
        }
      }

      if (lastMove) {
        const a = this.flipped ? 63 - lastMove.from : lastMove.from;
        const b = this.flipped ? 63 - lastMove.to   : lastMove.to;
        this.squares[a]?.classList.add("last");
        this.squares[b]?.classList.add("last");
      }
      if (legal && legal.length) {
        for (const i of legal) {
          const domIdx = this.flipped ? 63 - i : i;
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
      // Reflow grid urutan DOM tetap, tapi mapping index di render()
      // cukup panggil ulang render dari main.js setelah flip.
    }

    toast(msg, ms = 1600) {
      let t = document.getElementById("resultModal");
      if (!t) {
        t = document.createElement("div");
        t.id = "resultModal";
        t.className = "az-toast";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(this._tt);
      this._tt = setTimeout(() => t.classList.remove("show"), ms);
    }

    _wireFooter() {
      const btnBoardOnly = document.getElementById("btnBoardOnly");
      const btnBack = document.getElementById("btnBack");
      if (btnBoardOnly) {
        btnBoardOnly.onclick = () => {
          document.body.classList.toggle("board-only");
        };
      }
      if (btnBack) {
        btnBack.onclick = () => history.length > 1 ? history.back() : location.href = "index.html";
      }
    }
  }

  window.AzChessUI = ChessUI;
})();
