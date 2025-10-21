/* ===========================================================
   AZBRY CHESS UI — STABLE VERSION (Render papan & interaksi)
   =========================================================== */

class ChessUI {
  constructor(boardEl, onClickSquare) {
    this.boardEl = boardEl;
    this.onClickSquare = onClickSquare;
    this.flipped = false;
    this.FILES = ['a','b','c','d','e','f','g','h'];
    this.initBoard();
  }

  initBoard() {
    this.boardEl.innerHTML = '';
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = this.FILES[f] + r;
        const div = document.createElement('div');
        div.className = `square ${(r + f) % 2 === 0 ? 'light' : 'dark'}`;
        div.dataset.square = sq;
        div.addEventListener('click', () => this.onClickSquare(sq));
        this.boardEl.appendChild(div);
      }
    }
  }

  render(fen, pieceMap) {
    this.boardEl.querySelectorAll('.piece').forEach(p => p.remove());
    const rows = fen.split(' ')[0].split('/');
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) {
          file += parseInt(ch, 10);
          continue;
        }
        const sq = this.FILES[file] + (8 - r);
        const cell = this.boardEl.querySelector(`[data-square="${sq}"]`);
        if (cell) {
          const el = document.createElement('div');
          el.className = `piece ${ch === ch.toUpperCase() ? 'white' : 'black'}`;
          el.textContent = pieceMap[ch];
          cell.appendChild(el);
        }
        file++;
      }
    }
  }

  toggleFlip() {
    this.flipped = !this.flipped;
    this.boardEl.classList.toggle('flipped', this.flipped);
  }
}
