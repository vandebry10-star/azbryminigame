// assets/js/chess-ui.js
// UI ringan: bangun grid, render FEN, highlight & klik.

(function () {
  const FILES = ['a','b','c','d','e','f','g','h'];
  const PIECE_CHAR = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟', K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' };

  class ChessUI {
    constructor(boardEl, onSquareClick) {
      if (!boardEl) throw new Error('board element required');
      this.el = boardEl;
      this.onSquareClick = onSquareClick || (()=>{});
      this.flipped = false;

      // Pastikan grid 8x8 ada
      this._buildGrid();
    }

    _buildGrid() {
      this.el.innerHTML = '';
      this.el.classList.add('board');
      this.sq = new Array(64);

      for (let r = 8; r >= 1; r--) {
        for (let f = 0; f < 8; f++) {
          const sq = `${FILES[f]}${r}`;
          const i = (8 - r) * 8 + f;

          const d = document.createElement('div');
          d.className = `square ${((r + f) % 2 === 0) ? 'light' : 'dark'}`;
          d.dataset.square = sq;

          // label file/rank kecil
          if (f === 0) {
            const rk = document.createElement('span');
            rk.className = 'rank-label';
            rk.textContent = String(r);
            d.appendChild(rk);
          }
          if (r === 1) {
            const fl = document.createElement('span');
            fl.className = 'file-label';
            fl.textContent = FILES[f];
            d.appendChild(fl);
          }

          d.addEventListener('click', () => this.onSquareClick(sq));
          this.el.appendChild(d);
          this.sq[i] = d;
        }
      }
    }

    toggleFlip() {
      this.flipped = !this.flipped;
      this.el.classList.toggle('flipped', this.flipped);
    }

    clearHighlights() {
      this.el.querySelectorAll('.sel,.move,.src,.dst,.check').forEach(n=>{
        n.classList.remove('sel','move','src','dst','check');
      });
    }

    renderFEN(fen, opts = {}) {
      // bersihkan pieces
      this.el.querySelectorAll('.piece').forEach(n => n.remove());
      this.clearHighlights();

      const part = fen.split(' ')[0];
      const rows = part.split('/');
      // rows[0] = rank 8
      for (let r = 0; r < 8; r++) {
        let file = 0;
        for (const ch of rows[r]) {
          if (/\d/.test(ch)) { file += parseInt(ch, 10); continue; }
          const sq = FILES[file] + (8 - r);
          const cell = this.el.querySelector(`[data-square="${sq}"]`);
          if (cell) {
            const p = document.createElement('div');
            p.className = `piece ${ch === ch.toUpperCase() ? 'white' : 'black'}`;
            p.textContent = PIECE_CHAR[ch] || '?';
            cell.appendChild(p);
          }
          file++;
        }
      }

      // highlight optional
      if (opts.sel) {
        const c = this.el.querySelector(`[data-square="${opts.sel}"]`);
        c && c.classList.add('sel');
      }
      if (opts.legal && opts.legal.length) {
        opts.legal.forEach(to => {
          const c = this.el.querySelector(`[data-square="${to}"]`);
          c && c.classList.add('move');
        });
      }
      if (opts.last) {
        const a = this.el.querySelector(`[data-square="${opts.last.from}"]`);
        const b = this.el.querySelector(`[data-square="${opts.last.to}"]`);
        a && a.classList.add('src');
        b && b.classList.add('dst');
      }
      if (opts.checkSquare) {
        const k = this.el.querySelector(`[data-square="${opts.checkSquare}"]`);
        k && k.classList.add('check');
      }
    }
  }

  // expose
  window.ChessUI = ChessUI;
})();
